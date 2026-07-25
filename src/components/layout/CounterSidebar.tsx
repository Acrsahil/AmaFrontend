import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Monitor,
    Clock,
    Shield,
    BarChart3,
    FileText
} from "lucide-react";
import { getCurrentUser } from "../../auth/auth";

const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/counter/dashboard" },
    { icon: Monitor, label: "POS Terminal", path: "/counter/pos" },
    { icon: Clock, label: "Order History", path: "/counter/orders" },
    { icon: BarChart3, label: "Daily Sales", path: "/counter/daily-sales" },
    { icon: FileText, label: "Reports", path: "/counter/reports" },
];

interface CounterSidebarProps {
    className?: string;
    onNavigate?: () => void;
}

export function CounterSidebar({ className, onNavigate }: CounterSidebarProps) {
    const location = useLocation();
    const user = getCurrentUser();
    const branchName = user?.branch_name || "Counter Terminal";

    return (
        <div className={cn("flex h-full flex-col gradient-espresso text-sidebar-foreground", className)}>
            {/* Logo */}
            <div className="flex items-center gap-3 border-b border-sidebar-border px-6 py-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-full overflow-hidden border border-white/20">
                    <img src="/logos/logo2brown.jpeg" alt="AMA BAKERY" className="h-full w-full object-cover" />
                </div>
                <div>
                    <h1 className="font-rockwell font-bold text-lg leading-none mb-1 text-white">AMA BAKERY</h1>
                    <p className="text-[10px] text-white/70 font-black uppercase tracking-widest bg-white/10 px-2 py-0.5 rounded-sm inline-block">
                        {branchName}
                    </p>
                </div>
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
                                "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all text-left",
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

            {/* Back to Admin Info */}
            <div className="p-4 border-t border-sidebar-border space-y-2">
                {(user?.role === "ADMIN" || user?.role === "BRANCH_MANAGER" || user?.role === "SUPER_ADMIN") && (
                    <NavLink
                        to="/admin/dashboard"
                        className="w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white hover:bg-primary transition-all mb-2 border border-white/40 hover:border-primary"
                    >
                        <Shield className="h-5 w-5" />
                        Back to Admin Dashboard
                    </NavLink>
                )}
            </div>
        </div>
    );
}
