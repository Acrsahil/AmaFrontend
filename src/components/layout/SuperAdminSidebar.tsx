import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Store,
    BarChart3,
    Users,
    Settings,
    LogOut,
    Monitor,
    Trash2
} from "lucide-react";
import { logout } from "../../auth/auth";
import { useState } from "react";



const navItems = [
    { icon: LayoutDashboard, label: "HQ Dashboard", path: "/super-admin/dashboard" },
    // { icon: Monitor, label: "POS Terminal", path: "/counter/pos" },
    { icon: Store, label: "All Branches", path: "/super-admin/branches" },
    { icon: BarChart3, label: "Global Analytics", path: "/super-admin/analytics" },
    { icon: Users, label: "Admin Access", path: "/super-admin/access" },
    { icon: Trash2, label: "Deleted Invoices", path: "/super-admin/deleted-invoices" },
];

interface SuperAdminSidebarProps {
    className?: string;
    onNavigate?: () => void;
}

export function SuperAdminSidebar({ className, onNavigate }: SuperAdminSidebarProps) {
    const location = useLocation();
    const navigate = useNavigate();


    return (
        <div className={cn("flex h-full flex-col gradient-espresso text-sidebar-foreground", className)}>
            {/* Logo */}
            <div className="flex items-center gap-3 border-b border-sidebar-border px-6 py-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-full overflow-hidden border border-white/20">
                    <img src="/logos/logo2brown.jpeg" alt="AMA BAKERY" className="h-full w-full object-cover" />
                </div>
                <div>
                    <h1 className="font-rockwell font-bold text-lg leading-none mb-1 text-white text-left">AMA HQ</h1>
                    <p className="text-[10px] text-white/70 font-black uppercase tracking-widest bg-white/10 px-2 py-0.5 rounded-sm inline-block">
                        Global Admin
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

            {/* Security Info */}
            <div className="p-4 border-t border-sidebar-border space-y-2">

            </div>
        </div>
    );
}
