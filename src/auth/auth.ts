import { jwtDecode } from "jwt-decode";
import { getAccessToken, clearTokens } from "../api/index.js";

interface DecodedToken {
  user_id: string;
  username: string;
  user_type: string;
  is_superuser: boolean;
  is_staff: boolean;
  branch_id?: number;
  branch_name?: string;
  kitchentype_id?: number;
  kitchentype_name?: string;
  exp: number;
}

export function isLoggedIn() {
  const token = getAccessToken();
  if (!token) return false;

  try {
    const decoded = jwtDecode<DecodedToken>(token);
    // Check if token is expired
    return decoded.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function getDecodedToken(): DecodedToken | null {
  const token = getAccessToken();
  if (!token) return null;
  try {
    return jwtDecode<DecodedToken>(token);
  } catch {
    return null;
  }
}

export function getCurrentUser() {
  const decoded = getDecodedToken();
  if (decoded) {
    const userRole = decoded.user_type;
    const isSuperuser = decoded.is_superuser || userRole === "SUPER_ADMIN";
    const canScopeBranch = isSuperuser || userRole === "ADMIN";

    // If SuperAdmin/Admin has selected a specific branch, override the branch details
    if (canScopeBranch) {
      const selectedBranchStr = localStorage.getItem('selectedBranch');
      if (selectedBranchStr) {
        try {
          const selectedBranch = JSON.parse(selectedBranchStr);
          return {
            id: decoded.user_id,
            username: decoded.username,
            role: userRole,
            is_superuser: decoded.is_superuser,
            is_staff: decoded.is_staff,
            branch_id: selectedBranch.id,
            branch_name: selectedBranch.name,
            is_branch_scoped: true // Added flag to indicate this is a scoped view
          };
        } catch (e) {
          console.error("Error parsing selectedBranch", e);
        }
      }
    }

    return {
      id: decoded.user_id,
      username: decoded.username,
      role: userRole,
      is_superuser: isSuperuser,
      is_staff: decoded.is_staff,
      branch_id: decoded.branch_id,
      branch_name: decoded.branch_name,
      kitchentype_id: decoded.kitchentype_id,
      kitchentype_name: decoded.kitchentype_name,
    };
  }

  // Fallback for legacy data (if any)
  const u = localStorage.getItem("currentUser");
  if (!u || u === "undefined") return null;
  try {
    const parsed = JSON.parse(u);
    // Ensure normalization of field names if coming from legacy or mock data
    return {
      ...parsed,
      kitchentype_id: parsed.kitchentype_id || parsed.kitchenType,
      kitchentype_name: parsed.kitchentype_name || (parsed.kitchenType ? parsed.kitchenType.toUpperCase() : undefined)
    };
  } catch {
    return null;
  }
}

export async function logout() {
  localStorage.removeItem("mustChangePassword");
  localStorage.removeItem("defaultPasswordUsed");
  await clearTokens();
  window.location.replace("/login");
}