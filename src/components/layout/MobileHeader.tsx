import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  KeyRound,
  LogOut,
  ChevronDown
} from "lucide-react";
import { getCurrentUser, logout } from "@/auth/auth";
import { ChangePasswordModal } from "../auth/ChangePasswordModal";
import { useState } from "react";

interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
}

export function MobileHeader({ title, showBack = false }: MobileHeaderProps) {
  const navigate = useNavigate();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Get current user and branch
  const user = getCurrentUser();
  const userName = user?.username || "Staff";
  const userRole = user?.role || "Staff";
  const branchName = user?.branch_name || "Ama Bakery";

  return (
    <header className="sticky top-0 z-50 h-[60px] flex items-center bg-white/85 backdrop-blur-xl border-b border-slate-200/60 px-3.5 shadow-2xs">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2.5 min-w-0">
          {showBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="h-8 w-8 rounded-full text-slate-500 hover:bg-slate-100 shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-xl bg-white p-1 shadow-2xs border border-slate-200/70 shrink-0 overflow-hidden flex items-center justify-center">
              <img src="/logos/logo1white.jfif" alt="AMA BAKERY" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0 flex flex-col">
              <h1 className="text-xs md:text-sm font-black text-slate-900 tracking-tight leading-tight truncate">
                AMA BAKERY
              </h1>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-none truncate">
                {title}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 h-9 pl-2 pr-2.5 rounded-full bg-white border border-slate-200/80 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95 group focus:outline-none"
                title="Account & Session"
              >
                <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-primary to-orange-400 text-white flex items-center justify-center text-[10px] font-black shadow-xs shrink-0">
                  {(user?.username || "W")[0].toUpperCase()}
                </div>
                <span className="text-[11px] font-bold text-slate-700 max-w-[80px] truncate">
                  {user?.username || "Waiter"}
                </span>
                <ChevronDown className="h-3 w-3 text-slate-400 group-hover:text-slate-600 transition-colors shrink-0" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="w-48 p-1.5 rounded-2xl bg-white/95 backdrop-blur-2xl border border-slate-200/80 shadow-2xl animate-in fade-in-50 zoom-in-95"
            >
              <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <p className="text-xs font-bold text-slate-800 truncate">{user?.username || "Staff"}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                    {user?.role || "Waiter"} {user?.branch_name ? `• ${user.branch_name}` : ""}
                  </p>
                </div>
              </div>

              <DropdownMenuItem
                onClick={() => setShowChangePassword(true)}
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 rounded-xl hover:bg-slate-100/80 cursor-pointer transition-colors"
              >
                <KeyRound className="h-3.5 w-3.5 text-slate-500" />
                <span>Change Password</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1 bg-slate-100" />

              <DropdownMenuItem
                onClick={() => setShowLogoutConfirm(true)}
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 rounded-xl hover:bg-rose-50 hover:text-rose-700 cursor-pointer transition-colors"
              >
                <LogOut className="h-3.5 w-3.5 text-rose-500" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent className="rounded-3xl border-none shadow-2xl max-w-[320px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black text-slate-800">Sign Out?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium text-slate-500">
              Are you sure you want to log out of your session?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 sm:space-x-0">
            <AlertDialogCancel className="flex-1 rounded-xl border-slate-100 font-bold h-11">No</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => logout()}
              className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 font-bold h-11"
            >
              Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
