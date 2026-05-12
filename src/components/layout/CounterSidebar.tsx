import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Monitor,
    Clock,
    User,
    LogOut,
    Shield
} from "lucide-react";
import { getCurrentUser, logout } from "../../auth/auth";

const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/counter/dashboard" },
    { icon: Monitor, label: "POS Terminal", path: "/counter/pos" },
    { icon: Clock, label: "Order History", path: "/counter/orders" },
];

interface CounterSidebarProps {
    className?: string;
    onNavigate?: () => void;
}

export function CounterSidebar({ className, onNavigate }: CounterSidebarProps) {
    const location = useLocation();
    const user = getCurrentUser();
    const branchName = user?.branch_name || "Counter Panel";

    return (
        <div className={cn("flex h-full flex-col gradient-espresso text-sidebar-foreground", className)}>
            {/* Logo */}
            <div className="flex items-center gap-3 border-b border-sidebar-border px-6 py-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-full overflow-hidden border border-white/10 bg-white/5 p-1">
                    <img src="/logos/logo1white.jfif" alt="AMA BAKERY" className="h-full w-full object-contain rounded-full" />
                </div>
                <div>
                    <h1 className="font-rockwell font-bold text-lg leading-none mb-1 text-white">AMA BAKERY</h1>
                    <p className="text-[10px] text-primary font-black uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-sm inline-block">
                        {branchName}
                    </p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 px-3 py-6">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;

                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={onNavigate}
                            className={cn(
                                "flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-bold transition-all group",
                                isActive
                                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-primary/20"
                                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            )}
                        >
                            <item.icon className={cn("h-5 w-5", isActive ? "text-white" : "text-slate-500 group-hover:text-primary")} />
                            {item.label}
                        </NavLink>
                    );
                })}
            </nav>

            {/* User Info / Role Specifics */}
            <div className="p-4 border-t border-sidebar-border space-y-4">
                <div className="px-4 py-3 rounded-2xl bg-sidebar-accent/50 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-sidebar-primary/10 flex items-center justify-center text-sidebar-primary font-black">
                        {user?.username?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-white truncate">{user?.username}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{user?.role}</p>
                    </div>
                </div>

                { (user?.role === "ADMIN" || user?.role === "BRANCH_MANAGER" || user?.role === "SUPER_ADMIN") && (
                    <button
                        onClick={() => {
                            window.location.href = user.role === "SUPER_ADMIN" ? "/super-admin/dashboard" : "/admin/dashboard";
                        }}
                        className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-xs font-black text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all border border-sidebar-border"
                    >
                        <Shield className="h-4 w-4" />
                        Manager Portal
                    </button>
                )}
            </div>
        </div>
    );
}
