import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AdminSidebar } from "./AdminSidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, MapPin, LogOut, User as UserIcon, Key } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { logout, getCurrentUser } from "@/auth/auth";
import { ChangePasswordModal } from "../auth/ChangePasswordModal";

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const user = getCurrentUser();
  const branchName = user?.branch_name || "Ama Bakery";

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 z-[60] h-screen w-64 hidden md:block">
        <AdminSidebar />
      </aside>

      {/* Desktop Header */}
      <header className="sticky top-0 z-50 h-16 hidden md:flex items-center justify-between px-8 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="font-bold text-slate-700">{branchName}</span>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto p-2 hover:bg-slate-50 flex items-center gap-3 rounded-2xl transition-all">
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900 leading-none">{user?.username || "Admin"}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary mt-1">
                    {user?.is_branch_scoped ? "Super Admin (Scoped)" : "Branch Manager"}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary border-2 border-primary/20 shrink-0 shadow-sm">
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
      <div className="md:hidden sticky top-0 z-50 flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-1">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="mr-1">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 border-r-0">
              <AdminSidebar onNavigate={() => setSidebarOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg overflow-hidden border border-primary/20 bg-white">
              <img src="/logos/logo2brown.jpeg" alt="Ama Bakery" className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-col text-left">
              <h1 className="font-bold text-sm leading-none">{branchName}</h1>
              <span className="text-[10px] text-muted-foreground font-medium">Branch Admin</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0 p-0">
                <UserIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 font-bold z-[100]">
              <div className="px-2 py-1.5 md:hidden">
                <p className="text-sm font-bold text-slate-900 leading-none">{user?.username || "Admin"}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-primary mt-1">
                  {user?.is_branch_scoped ? "Super Admin (Scoped)" : "Branch Manager"}
                </p>
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

      <main className="md:ml-64 min-h-screen transition-all duration-200 ease-in-out">
        <Outlet />
      </main>
    </div>
  );
}
