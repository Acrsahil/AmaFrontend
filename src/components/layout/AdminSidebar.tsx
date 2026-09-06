import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  UtensilsCrossed,
  Users,
  FileBarChart,
  Settings,
  LogOut,
  ChefHat,
  Monitor,
  Shield,
  BarChart3
} from "lucide-react";
import { getCurrentUser, logout } from "../../auth/auth";
import { useState } from "react";



const allNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin/dashboard" },
  { icon: Monitor, label: "POS Terminal", path: "/admin/dashboard/pos" },
  { icon: ClipboardList, label: "Orders", path: "/admin/dashboard/orders" },
  { icon: UtensilsCrossed, label: "Menu", path: "/admin/dashboard/menu" },
  { icon: Users, label: "Customers", path: "/admin/dashboard/customers" },
  { icon: ChefHat, label: "Staff", path: "/admin/dashboard/users" },
  { icon: FileBarChart, label: "Reports", path: "/admin/dashboard/reports" },
  { icon: BarChart3, label: "Daily Stats", path: "/admin/dashboard/daily-stats" },
  { icon: BarChart3, label: "Global Analytics", path: "/admin/dashboard/global-analytics" },
  { icon: UtensilsCrossed, label: "Table Management", path: "/admin/dashboard/tables" },
  { icon: Settings, label: "Settings", path: "/admin/dashboard/settings" },
];

interface AdminSidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function AdminSidebar({ className, onNavigate }: AdminSidebarProps) {
  const location = useLocation();


  // Get current user and branch
  const user = getCurrentUser();
  const branchName = user?.branch_name || "Admin Panel";

  // Hide Global Analytics for branch manager and admin (show only for super admin at HQ)
  const navItems = allNavItems.filter(
    (item) =>
      item.path !== "/admin/dashboard/global-analytics" ||
      (user?.is_superuser && !user?.is_branch_scoped)
  );

  return (
    <div className={cn("flex h-full flex-col gradient-espresso text-sidebar-foreground", className)}>
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-6 py-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-full overflow-hidden border border-white/20">
          <img src="/logos/logo2brown.jpeg" alt="AMA BAKERY" className="h-full w-full object-cover" />
        </div>
        <div>
          <h1 className="font-rockwell font-bold text-lg leading-none mb-1">AMA BAKERY</h1>
          <p className="text-[10px] text-sidebar-foreground font-black uppercase tracking-widest bg-white/10 px-2 py-0.5 rounded-sm inline-block">
            {branchName}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = item.path === "/admin/dashboard"
            ? location.pathname === item.path || location.pathname === item.path + "/"
            : location.pathname.startsWith(item.path);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Security Info */}
      <div className="p-4 border-t border-sidebar-border space-y-2">
        {user?.role == "ADMIN" && (
          <button
            onClick={() => {
              localStorage.removeItem('selectedBranch');
              window.location.href = "/super-admin/dashboard";
            }}
            className="w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white hover:bg-primary transition-all mb-2 border border-white/40 hover:border-primary"
          >
            <Shield className="h-5 w-5" />
            Back to HQ Dashboard
          </button>
        )}

      </div>
    </div>
  );
}
