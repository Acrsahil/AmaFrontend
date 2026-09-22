import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Monitor,
    Clock,
    Shield,
    BarChart3,
    FileText,
    LayoutGrid
} from "lucide-react";
import { getCurrentUser } from "../../auth/auth";
import { HandCoins, Menu } from "lucide-react";

const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/counter/dashboard" },
    { icon: Monitor, label: "POS Terminal", path: "/counter/pos" },
    { icon: Clock, label: "Order History", path: "/counter/orders" },
    { icon: LayoutGrid, label: "Table Orders", path: "/counter/tables" },
    { icon: BarChart3, label: "Daily Sales", path: "/counter/daily-sales" },
    { icon: FileText, label: "Reports", path: "/counter/reports" },
    { icon: HandCoins, label: "Waiter Payments", path: "/counter/waiter-payments" },
];

interface CounterSidebarProps {
    className?: string;
    onNavigate?: () => void;
    isCollapsed?: boolean;
    onToggle?: () => void;
}

export function CounterSidebar({ className, onNavigate, isCollapsed, onToggle }: CounterSidebarProps) {
    const location = useLocation();
    const user = getCurrentUser();
    const branchName = user?.branch_name || "Counter Terminal";

    return (
        <div className={cn("flex h-full flex-col gradient-espresso text-sidebar-foreground relative", className)}>
            {/* Header / Logo & Toggle */}
            <div className={cn(
                "flex border-b border-sidebar-border py-4 transition-all duration-300",
                isCollapsed ? "flex-col items-center gap-4 px-2" : "items-center justify-between px-4"
            )}>
                <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-3")}>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full overflow-hidden border border-white/20 shrink-0">
                        <img src="/logos/logo2brown.jpeg" alt="AMA BAKERY" className="h-full w-full object-cover" />
                    </div>
                    {!isCollapsed && (
                        <div className="overflow-hidden">
                            <h1 className="font-rockwell font-bold text-base leading-none mb-1 text-white truncate">AMA BAKERY</h1>
                            <p className="text-[9px] text-white/70 font-black uppercase tracking-widest bg-white/10 px-1.5 py-0.5 rounded-sm inline-block truncate max-w-[120px]">
                                {branchName}
                            </p>
                        </div>
                    )}
                </div>

                {onToggle && (
                    <button
                        onClick={onToggle}
                        className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors shrink-0",
                            isCollapsed && "mx-auto"
                        )}
                        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        <Menu className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 px-3 py-4">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;

                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={onNavigate}
                            className={cn(
                                "flex items-center rounded-lg text-sm font-medium transition-all",
                                isCollapsed ? "justify-center h-10 w-10 mx-auto" : "gap-3 px-4 py-3 text-left",
                                isActive
                                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            )}
                            title={isCollapsed ? item.label : undefined}
                        >
                            <item.icon className="h-5 w-5 shrink-0" />
                            {!isCollapsed && <span className="truncate">{item.label}</span>}
                        </NavLink>
                    );
                })}
            </nav>

            {/* Back to Admin Info */}
            <div className="p-4 border-t border-sidebar-border space-y-2">
                {(user?.role === "ADMIN" || user?.role === "BRANCH_MANAGER" || user?.role === "SUPER_ADMIN") && (
                    <NavLink
                        to="/admin/dashboard"
                        title={isCollapsed ? "Back to Admin Dashboard" : undefined}
                        className={cn(
                            "flex items-center rounded-lg text-sm font-medium text-white hover:bg-primary transition-all mb-2 border border-white/40 hover:border-primary",
                            isCollapsed ? "justify-center h-10 w-10 mx-auto p-0" : "gap-3 px-4 py-3 w-full"
                        )}
                    >
                        <Shield className="h-5 w-5 shrink-0" />
                        {!isCollapsed && <span className="truncate">Back to Admin Dashboard</span>}
                    </NavLink>
                )}
            </div>
        </div>
    );
}
