import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Pages
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// Waiter Pages
import TableSelection from "./pages/waiter/TableSelection";
import OrderEntry from "./pages/waiter/OrderEntry";
import Checkout from "./pages/waiter/Checkout";
import OrderStatus from "./pages/waiter/OrderStatus";
import PaymentCollection from "./pages/waiter/PaymentCollection";

// Counter Pages
import { CounterLayout } from "./components/layout/CounterLayout";
import CounterPOS from "./pages/counter/CounterPOS";
import CounterOrders from "./pages/counter/CounterOrders";
import CounterDashboard from "./pages/counter/CounterDashboard";

// Kitchen Pages
import KitchenDisplay from "./pages/kitchen/KitchenDisplay";

// Admin Pages & Layout
import { AdminLayout } from "./components/layout/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminMenu from "./pages/admin/AdminMenu";
import AdminInventory from "./pages/admin/AdminInventory";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminReports from "./pages/admin/AdminReports";
import AdminDailyStats from "./pages/admin/AdminDailyStats";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminTables from "./pages/admin/AdminTables";

// Super Admin
import SuperAdminLogin from "./pages/SuperAdminLogin";
import { SuperAdminLayout } from "./components/layout/SuperAdminLayout";
import SuperAdminOverview from "./pages/superadmin/SuperAdminOverview";
import SuperAdminBranches from "./pages/superadmin/SuperAdminBranches";
import SuperAdminAnalytics from "./pages/superadmin/SuperAdminAnalytics";
import SuperAdminAccess from "./pages/superadmin/SuperAdminAccess";
import SuperAdminSettings from "./pages/superadmin/SuperAdminSettings";

const queryClient = new QueryClient();

import { isLoggedIn, getCurrentUser } from "./auth/auth";
import { GlobalLogout } from "@/components/ui/GlobalLogout";
import { initializeAuth } from "./api";
import { useState, useEffect } from "react";

const roleRedirectPath = (role?: string) => {
  switch (role) {
    case "SUPER_ADMIN":
    case "ADMIN":
      return "/super-admin/dashboard";
    case "BRANCH_MANAGER":
      return "/admin/dashboard";
    case "WAITER":
      return "/waiter/tables";
    case "COUNTER":
      return "/counter/dashboard";
    case "KITCHEN":
      return "/kitchen/display";
    default:
      return "/login";
  }
};

// Landing route component: / -> role dashboard if logged in, else /login
const HomeRedirect = () => {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  const user = getCurrentUser();
  return <Navigate to={roleRedirectPath(user?.role)} replace />;
};

// Generic ProtectedRoute with optional allowed roles
const ProtectedRoute = ({
  children,
  allowedRoles,
}: {
  children: JSX.Element;
  allowedRoles?: string[];
}) => {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;

  if (allowedRoles && allowedRoles.length > 0) {
    const user = getCurrentUser();
    if (!user?.role || !allowedRoles.includes(user.role)) {
      return <Navigate to={roleRedirectPath(user?.role)} replace />;
    }
  }

  return children;
};

const App = () => {
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        await initializeAuth();
      } finally {
        setInitializing(false);
      }
    };
    init();
  }, []);

  if (initializing) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gradient-cream">
        <div className="h-20 w-20 bg-primary rounded-3xl shadow-xl flex items-center justify-center animate-bounce mb-4 text-white">
          <img src="/logos/logo1white.jfif" alt="Logo" className="w-12 h-12 object-contain" />
        </div>
        <p className="font-black text-slate-400 uppercase tracking-[0.3em] text-[10px] animate-pulse">Initializing Secure Session</p>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-center" />
        <BrowserRouter>
          <GlobalLogout />

          <Routes>
            {/* ✅ MAIN ENTRY */}
            <Route path="/" element={<HomeRedirect />} />

            {/* ✅ LOGIN */}
            <Route path="/login" element={<Login />} />

            {/* ✅ SUPER ADMIN LOGIN (optional separate page) */}
            <Route path="/super-admin" element={<SuperAdminLogin />} />

            {/* ✅ SUPER ADMIN PROTECTED */}
            <Route
              element={
                <ProtectedRoute allowedRoles={["ADMIN", "SUPER_ADMIN"]}>
                  <SuperAdminLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/super-admin/dashboard" element={<SuperAdminOverview />} />
              <Route path="/super-admin/branches" element={<SuperAdminBranches />} />
              <Route path="/super-admin/analytics" element={<SuperAdminAnalytics />} />
              <Route path="/super-admin/access" element={<SuperAdminAccess />} />
            </Route>

            {/* ✅ WAITER PROTECTED */}
            <Route
              path="/waiter/tables"
              element={
                <ProtectedRoute allowedRoles={["WAITER"]}>
                  <TableSelection />
                </ProtectedRoute>
              }
            />
            <Route
              path="/waiter/order/:tableNumber"
              element={
                <ProtectedRoute allowedRoles={["WAITER"]}>
                  <OrderEntry />
                </ProtectedRoute>
              }
            />
            <Route
              path="/waiter/checkout"
              element={
                <ProtectedRoute allowedRoles={["WAITER"]}>
                  <Checkout />
                </ProtectedRoute>
              }
            />
            <Route
              path="/waiter/orders"
              element={
                <ProtectedRoute allowedRoles={["WAITER"]}>
                  <OrderStatus />
                </ProtectedRoute>
              }
            />
            <Route
              path="/waiter/payment"
              element={
                <ProtectedRoute allowedRoles={["WAITER"]}>
                  <PaymentCollection />
                </ProtectedRoute>
              }
            />

            <Route
              element={
                <ProtectedRoute allowedRoles={["COUNTER", "ADMIN", "BRANCH_MANAGER"]}>
                  <CounterLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/counter/dashboard" element={<CounterDashboard />} />
              <Route path="/counter/pos" element={<CounterPOS />} />
              <Route path="/counter/orders" element={<CounterOrders />} />
            </Route>

            {/* ✅ KITCHEN PROTECTED */}
            <Route
              path="/kitchen/display"
              element={
                <ProtectedRoute allowedRoles={["KITCHEN", "ADMIN"]}>
                  <KitchenDisplay />
                </ProtectedRoute>
              }
            />

            {/* ✅ ADMIN PROTECTED (nested layout stays working) */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={["BRANCH_MANAGER", "ADMIN", "SUPER_ADMIN"]}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="menu" element={<AdminMenu />} />
              <Route path="inventory" element={<AdminInventory />} />
              <Route path="customers" element={<AdminCustomers />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="daily-stats" element={<AdminDailyStats />} />
              <Route path="global-analytics" element={<SuperAdminAnalytics />} />
              <Route path="tables" element={<AdminTables />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>

            {/* Optional: redirect base role paths */}
            <Route path="/waiter" element={<Navigate to="/waiter/tables" replace />} />
            <Route path="/counter" element={<Navigate to="/counter/dashboard" replace />} />
            <Route path="/kitchen" element={<Navigate to="/kitchen/display" replace />} />
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;