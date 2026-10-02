import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { CounterSidebar } from "@/components/layout/CounterSidebar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function CounterLayout() {
    const location = useLocation();
    const isPOSRoute = location.pathname.includes('/counter/pos');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    useEffect(() => {
        const handleOpenSidebar = () => {
            setSidebarOpen(true);
        };
        window.addEventListener("open-counter-sidebar", handleOpenSidebar);
        return () => {
            window.removeEventListener("open-counter-sidebar", handleOpenSidebar);
        };
    }, []);

    return (
        <div className="min-h-screen bg-slate-50/50 flex">
            {/* Desktop Sidebar */}
            {!isPOSRoute && (
                <aside className={cn(
                    "fixed left-0 top-0 z-[60] h-screen hidden md:block border-r bg-white shrink-0 transition-all duration-300",
                    isCollapsed ? "w-[72px]" : "w-64"
                )}>
                    <CounterSidebar
                        isCollapsed={isCollapsed}
                        onToggle={() => setIsCollapsed(!isCollapsed)}
                    />
                </aside>
            )}

            {/* Mobile Sidebar Sheet */}
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetContent side="left" className="p-0 w-64 border-r-0 z-[100]">
                    <CounterSidebar onNavigate={() => setSidebarOpen(false)} />
                </SheetContent>
            </Sheet>

            {/* Main Content Area */}
            <div className={cn(
                "flex-1 min-h-screen flex flex-col overflow-hidden transition-all duration-300",
                isPOSRoute ? "" : isCollapsed ? "md:pl-[72px]" : "md:pl-64"
            )}>
                <main className="flex-1 flex flex-col overflow-hidden">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
