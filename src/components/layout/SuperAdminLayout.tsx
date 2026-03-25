import { useState } from "react";
import { Outlet } from "react-router-dom";
import { SuperAdminSidebar } from "@/components/layout/SuperAdminSidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, LogOut, User as UserIcon, Shield, Key } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout, getCurrentUser } from "@/auth/auth";
import { ChangePasswordModal } from "../auth/ChangePasswordModal";

export function SuperAdminLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const user = getCurrentUser();

    return (
        <div className="min-h-screen bg-slate-50/50">
            {/* Desktop Sidebar */}
            <aside className="fixed left-0 top-0 z-[60] h-screen w-64 hidden md:block border-r bg-white">
                <SuperAdminSidebar />
            </aside>

            {/* Desktop Header */}
            <header className="sticky top-0 z-50 h-16 hidden md:flex items-center justify-between px-8 bg-white/80 backdrop-blur-md border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="font-black text-slate-800 tracking-tight uppercase text-xs tracking-widest">HQ Command Center</span>
                </div>

                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-auto p-2 hover:bg-slate-50 flex items-center gap-3 rounded-2xl transition-all">
                                <div className="text-right">
                                    <p className="text-sm font-black text-slate-900 leading-none">{user?.username || "Super Admin"}</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-primary mt-1">Global Administrator</p>
                                </div>
                                <div className="h-10 w-10 rounded-full bg-slate-900 flex items-center justify-center text-white shrink-0 shadow-sm">
                                    <UserIcon className="h-5 w-5" />
                                </div>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 font-bold">
                            <DropdownMenuItem
                                className="h-10 rounded-xl cursor-pointer transition-colors"
                                onClick={() => setIsResetModalOpen(true)}
                            >
                                <Key className="mr-2 h-4 w-4 text-slate-400" />
                                <span>Change Password</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-slate-100 my-1" />
                            <DropdownMenuItem
                                className="h-10 rounded-xl cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50 transition-colors"
                                onClick={() => {
                                    window.dispatchEvent(new CustomEvent("show-logout-confirm"));
                                }}
                            >
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Logout</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            <ChangePasswordModal
                isOpen={isResetModalOpen}
                onClose={() => setIsResetModalOpen(false)}
            />

            {/* Mobile Header */}
            <div className="md:hidden sticky top-0 z-50 flex items-center justify-between p-4 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
                <div className="flex items-center gap-3">
                    <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="mr-2">
                                <Menu className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="p-0 w-64 border-r-0">
                            <SuperAdminSidebar onNavigate={() => setSidebarOpen(false)} />
                        </SheetContent>
                    </Sheet>
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg overflow-hidden border border-primary/20 bg-white">
                            <img src="/logos/logo2brown.jpeg" alt="Ama Bakery" className="h-full w-full object-cover" />
                        </div>
                        <h1 className="font-bold text-base">Ama HQ</h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 rounded-full bg-slate-900 flex items-center justify-center text-white shrink-0 p-0 shadow-sm border border-slate-800">
                                <UserIcon className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 font-bold z-[100]">
                            <div className="px-2 py-1.5 md:hidden">
                                <p className="text-sm font-black text-slate-900 leading-none">{user?.username || "Super Admin"}</p>
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary mt-1">Global Administrator</p>
                            </div>
                            <DropdownMenuSeparator className="md:hidden" />
                            <DropdownMenuItem
                                className="h-10 rounded-xl cursor-pointer transition-colors"
                                onClick={() => setIsResetModalOpen(true)}
                            >
                                <Key className="mr-2 h-4 w-4 text-slate-400" />
                                <span>Change Password</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-slate-100 my-1" />
                            <DropdownMenuItem
                                className="h-10 rounded-xl cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50 transition-colors"
                                onClick={() => {
                                    window.dispatchEvent(new CustomEvent("show-logout-confirm"));
                                }}
                            >
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Logout</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Main Content */}
            <main className="md:ml-64 p-4 md:p-6 lg:p-8 space-y-6 text-slate-900">
                <Outlet />
            </main>
        </div>
    );
}
