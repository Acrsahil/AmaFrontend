import { API_BASE_URL, DASHBOARD_POLL_INTERVAL } from "./config";
export { API_BASE_URL, DASHBOARD_POLL_INTERVAL };

const apiBaseUrl = API_BASE_URL; // Internal helper name

// --- TOKEN MANAGEMENT ---
// In-memory access token (more secure against XSS)
let _accessToken = null;

// Helper to save tokens
function saveTokens(tokens) {
  _accessToken = tokens.access;
}

// Clear tokens (logout)
export async function clearTokens() {
  // 1. Clear local state (SYNCHRONOUS)
  _accessToken = null;
  localStorage.removeItem("currentUser");
  localStorage.removeItem("currentWaiter");
  localStorage.removeItem("token");
  localStorage.removeItem("selectedBranch");
  localStorage.removeItem("kitchenFloorFilter");

  // Set a flag to prevent immediate auto-relogin during this session
  localStorage.setItem("just_logged_out", "true");

  // 2. Call backend logout to clear cookie
  try {
    const res = await fetch(apiBaseUrl + "/api/logout/", {
      method: "POST",
      credentials: "include",
      headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) {
      console.warn("Backend logout responded with status:", res.status);
    }
  } catch (err) {
    console.error("Logout API call failed:", err);
  }
}

// Get the current access token
export function getAccessToken() {
  return _accessToken;
}

// --- REFRESH TOKEN MUTEX (Auth Loop Fix) ---
let isRefreshing = false;
let refreshSubscribers = [];

function onTokenRefreshed(newToken) {
  refreshSubscribers.map(cb => cb(newToken));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb) {
  refreshSubscribers.push(cb);
}

// Refresh the access token
export async function refreshAccessToken() {
  // If a refresh is already in progress, wait for it
  if (isRefreshing) {
    return new Promise(resolve => {
      addRefreshSubscriber(token => resolve(token));
    });
  }

  isRefreshing = true;
  const url = apiBaseUrl + "/api/token/refresh/";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include" // This is key to send the refresh cookie
    });

    if (res.status === 200) {
      const data = await res.json();
      _accessToken = data.access;
      onTokenRefreshed(_accessToken);
      return _accessToken;
    } else {
      // 400/401 means session is truly dead
      _accessToken = null;
      localStorage.removeItem("currentUser");
      localStorage.removeItem("currentWaiter");
      onTokenRefreshed(null);
      // Don't throw here to avoid unhandled rejections in parallel calls
      return null;
    }
  } catch (err) {
    console.error("Token refresh network failure:", err);
    onTokenRefreshed(null);
    return null;
  } finally {
    isRefreshing = false;
  }
}

// Check if we have a session to restore
export async function initializeAuth() {
  if (_accessToken) return true;

  // If the user just logged out, don't try to revive the session via cookie
  // This prevents the loop if the cookie delete hasn't propagated yet
  if (localStorage.getItem("just_logged_out") === "true") {
    return false;
  }

  try {
    // Attempt to refresh using cookie
    const token = await refreshAccessToken();
    return !!token;
  } catch (err) {
    // No valid refresh cookie or refresh failed
    return false;
  }
}

// --- SECURE FETCHER ---
// This wrapper handles:
// 1. Automatically adding Authorization header
// 2. Handling 401 errors by attempting a token refresh
// 3. Retrying the original request after refresh
async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith("http") ? endpoint : apiBaseUrl + endpoint;

  // Prepare headers
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Add access token if available
  if (_accessToken) {
    headers["Authorization"] = `Bearer ${_accessToken}`;
  }

  const fetchOptions = {
    ...options,
    headers,
    credentials: "include", // Always include cookies
  };

  let response = await fetch(url, fetchOptions);

  // If 401 Unauthorized, try to refresh token once
  // EXCEPTION: Don't try to refresh if we're actually TRYING to login
  if (response.status === 401 && !endpoint.includes("/api/token/")) {
    console.warn("Access token expired, attempting refresh for:", endpoint);
    try {
      const newToken = await refreshAccessToken();
      if (newToken) {
        // Retry with new token
        headers["Authorization"] = `Bearer ${newToken}`;
        response = await fetch(url, { ...fetchOptions, headers });
      } else {
        // Refresh failed (no login info)
        window.dispatchEvent(new CustomEvent("unauthorized"));
      }
    } catch (refreshErr) {
      console.error("Refresh logic error:", refreshErr);
      window.dispatchEvent(new CustomEvent("unauthorized"));
    }
  }

  return response;
}

// --- UTILS ---
function safePreview(text, n = 300) {
  return (text || "").slice(0, n).replace(/\s+/g, " ").trim();
}

async function safeJson(res) {
  const text = await res.text();
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return text ? JSON.parse(text) : null;
  }

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      `Server did not return JSON.\nStatus: ${res.status}\nContent-Type: ${contentType}\nPreview: ${safePreview(text)}`
    );
  }
}

// --- API METHODS ---

export async function loginUsers(username, password) {
  const url = "/api/token/";
  const res = await apiFetch(url, {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

  const data = await safeJson(res);
  if (!res.ok) {
    // Return specific error message from server if possible
    throw new Error(data?.detail || data?.message || (data?.non_field_errors ? data.non_field_errors[0] : "Invalid username or password"));
  }

  if (!data?.access) {
    throw new Error("Login response missing access token.");
  }

  // Clear the logout flag if it exists
  localStorage.removeItem("just_logged_out");

  saveTokens(data);
  return data;
}

export async function changePassword(oldPassword, newPassword) {
  const res = await apiFetch("/api/change-password/", {
    method: "POST",
    body: JSON.stringify({
      old_password: oldPassword,
      new_password: newPassword
    }),
  });
  const data = await safeJson(res);
  if (!res.ok) {
    throw new Error(data?.message || JSON.stringify(data?.errors) || "Failed to change password");
  }
  return data;
}

export async function adminResetPassword(userId, newPassword) {
  const res = await apiFetch(`/api/admin-reset-password/${userId}/`, {
    method: "POST",
    body: JSON.stringify({
      new_password: newPassword
    }),
  });
  const data = await safeJson(res);
  if (!res.ok) {
    throw new Error(data?.message || "Failed to reset password");
  }
  return data;
}

export async function fetchMe() {
  const res = await apiFetch("/api/me/");
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.detail || "Failed to fetch user profile");
  return data;
}

export async function fetchUsers() {
  const res = await apiFetch("/api/users/");
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to fetch users");
  // Be robust with different response structures
  return data.users || data.data || (Array.isArray(data) ? data : []);
}

export async function createUser(userData) {
  const res = await apiFetch("/api/users/", {
    method: "POST",
    body: JSON.stringify(userData),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || JSON.stringify(data?.errors) || "Failed to create user");
  return data.user || data.data || data;
}

export async function updateUser(id, userData) {
  const res = await apiFetch(`/api/users/${id}/`, {
    method: "PUT",
    body: JSON.stringify(userData),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || JSON.stringify(data?.errors) || "Failed to update user");
  return data.user || data.data || data;
}

export async function deleteUser(id) {
  const res = await apiFetch(`/api/users/${id}/`, {
    method: "DELETE",
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to delete user");
  return data;
}

export async function fetchProducts() {
  const res = await apiFetch("/api/products/");
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to fetch products");
  return data.data;
}

export async function createProduct(productData) {
  const res = await apiFetch("/api/products/", {
    method: "POST",
    body: JSON.stringify(productData),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || JSON.stringify(data?.errors) || "Failed to create product");
  return data.data;
}

export async function updateProduct(id, productData) {
  const res = await apiFetch(`/api/products/${id}/`, {
    method: "PUT",
    body: JSON.stringify(productData),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || JSON.stringify(data?.errors) || "Failed to update product");
  return data.data;
}

export async function deleteProduct(id) {
  const res = await apiFetch(`/api/products/${id}/`, {
    method: "DELETE",
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to delete product");
  return data;
}

export async function fetchCategories() {
  const res = await apiFetch("/api/category/");
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to fetch categories");
  return data.data;
}

export async function createCategory(categoryData) {
  const res = await apiFetch("/api/category/", {
    method: "POST",
    body: JSON.stringify(categoryData),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to create category");
  return data;
}

export async function updateCategory(id, categoryData) {
  const res = await apiFetch(`/api/category/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(categoryData),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to update category");
  return data;
}

export async function deleteCategory(id) {
  const res = await apiFetch(`/api/category/${id}/`, {
    method: "DELETE",
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to delete category");
  return data;
}

export async function fetchBranches() {
  const res = await apiFetch("/api/branch/");
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to fetch branches");
  return data;
}

export async function createBranch(branchData) {
  const res = await apiFetch("/api/branch/", {
    method: "POST",
    body: JSON.stringify(branchData),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to create branch");
  return data;
}

export async function updateBranch(id, branchData) {
  const res = await apiFetch(`/api/branch/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(branchData),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to update branch");
  return data;
}

export async function deleteBranch(id) {
  const res = await apiFetch(`/api/branch/${id}/`, {
    method: "DELETE",
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to delete branch");
  return data;
}

export async function fetchCustomers() {
  const res = await apiFetch("/api/customer/");
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to fetch customers");
  return data.data;
}

export async function createCustomer(customerData) {
  const res = await apiFetch("/api/customer/", {
    method: "POST",
    body: JSON.stringify(customerData),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to create customer");
  return data.data;
}

export async function updateCustomer(id, customerData) {
  const res = await apiFetch(`/api/customer/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(customerData),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to update customer");
  return data.data;
}

export async function deleteCustomer(id) {
  const res = await apiFetch(`/api/customer/${id}/`, {
    method: "DELETE",
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to delete customer");
  return data;
}

export async function createInvoice(invoiceData) {
  const res = await apiFetch("/api/invoice/", {
    method: "POST",
    body: JSON.stringify(invoiceData),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to create invoice");
  return data.data;
}

export async function fetchInvoices() {
  const res = await apiFetch("/api/invoice/");
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to fetch invoices");
  return data.data;
}

export async function updateInvoiceStatus(id, status, extraData = {}) {
  const res = await apiFetch(`/api/invoice/${id}/`, {
    method: "PATCH",
    body: JSON.stringify({ invoice_status: status, ...extraData }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to update invoice status");
  return data.data;
}

export async function addPayment(invoiceId, paymentData) {
  const res = await apiFetch(`/api/invoice/${invoiceId}/payments/`, {
    method: "POST",
    body: JSON.stringify(paymentData),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to add payment");
  return data;
}

export async function createTable(tableData) {
  const res = await apiFetch("/api/floor/", {
    method: "POST",
    body: JSON.stringify(tableData),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to create table");
  return data;
}

export async function fetchTables() {
  const res = await apiFetch("/api/floor/");
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to fetch tables");
  return data.data;
}

export async function patchTable(id, tableData) {
  const res = await apiFetch(`/api/floor/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(tableData),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to update table");
  return data.data;
}

export async function deleteTable(id) {
  const res = await apiFetch(`/api/floor/${id}/`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await safeJson(res);
    throw new Error(data?.message || "Failed to delete table");
  }
  return true;
}

export async function addItemActivity(productId, type, activityData) {
  const res = await apiFetch(`/api/itemactivity/${productId}/${type}/`, {
    method: "POST",
    body: JSON.stringify(activityData),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to modify product");
  return data;
}

export async function fetchItemActivity(productId) {
  const res = await apiFetch(`/api/itemactivity/${productId}/detail/`);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to fetch item activity");
  return data.data;
}

export async function fetchDashboardDetails(branchId = null, filters = {}) {
  let url = branchId
    ? `/api/calculate/dashboard-details/${branchId}/`
    : `/api/calculate/dashboard-details/`;

  if (filters && Object.keys(filters).length > 0) {
    const params = new URLSearchParams(filters);
    url += `?${params.toString()}`;
  }

  const res = await apiFetch(url);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to fetch dashboard details");
  return data;
}

/**
 * Fetch dashboard stats (alias for fetchDashboardDetails)
 * Use this for polling to keep naming consistent
 */
export async function fetchDashboardStats(branchId = null, filters = {}) {
  return fetchDashboardDetails(branchId, filters);
}

export async function fetchReportDashboard(branchId = null, filters = {}) {
  let url = branchId
    ? `/api/calculate/report-dashboard/${branchId}/`
    : `/api/calculate/report-dashboard/`;

  if (filters && Object.keys(filters).length > 0) {
    const params = new URLSearchParams(filters);
    url += `?${params.toString()}`;
  }

  const res = await apiFetch(url);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to fetch report dashboard");
  return data;
}

export async function fetchStaffReport(branchId = null, filters = {}) {
  let url = branchId
    ? `/api/calculate/staff-report/${branchId}/`
    : `/api/calculate/staff-report/`;

  if (filters && Object.keys(filters).length > 0) {
    const params = new URLSearchParams(filters);
    url += `?${params.toString()}`;
  }

  const res = await apiFetch(url);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to fetch staff report");
  return data;
}

/**
 * Manual refresh dashboard (one-time fetch)
 */
export async function refreshDashboard(branchId = null) {
  return fetchDashboardDetails(branchId);
}

export async function fetchInvoicesByCustomer(customerId) {
  const res = await apiFetch(`/api/invoice/?customer=${customerId}`);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to fetch invoices for customer");
  return data.data;
}

// Kitchen Type APIs
export async function fetchKitchenTypes() {
  const res = await apiFetch("/api/kitchentype/");
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to fetch kitchen types");
  return data.data;
}

export async function createKitchenType(kitchenData) {
  const res = await apiFetch("/api/kitchentype/", {
    method: "POST",
    body: JSON.stringify(kitchenData),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to create kitchen type");
  return data;
}

export async function updateKitchenType(id, kitchenData) {
  const res = await apiFetch(`/api/kitchentype/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(kitchenData),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to update kitchen type");
  return data;
}

export async function deleteKitchenType(id) {
  const res = await apiFetch(`/api/kitchentype/${id}/`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await safeJson(res);
    throw new Error(data?.message || "Failed to delete kitchen type");
  }
  return true;
}

export async function fetchNotifications() {
  const res = await apiFetch("/api/notifications/");
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to fetch notifications");
  return data.data;
}

export async function markNotificationRead(id, markAsReceived = false) {
  const payload = { is_read: true };
  if (markAsReceived) {
    payload.mark_as_received = true;
  }

  const res = await apiFetch(`/api/notifications/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.message || "Failed to update notification");
  return data;
}
