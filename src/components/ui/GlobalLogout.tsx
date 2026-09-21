import { LogOut, KeyRound, ChevronDown } from "lucide-react";
import { logout, isLoggedIn, getCurrentUser } from "@/auth/auth";
import { ChangePasswordModal } from "../auth/ChangePasswordModal";
import { useLocation } from "react-router-dom";
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";

export function GlobalLogout() {
    const location = useLocation();
    const [showConfirm, setShowConfirm] = useState(false);
    const [showChangePassword, setShowChangePassword] = useState(false);
    const isLoginPage = location.pathname === "/login" || location.pathname === "/super-admin";

    // Handle unauthorized event from api/index.js and manual logout triggers
    useEffect(() => {
        const handleUnauthorized = () => {
            console.warn("Session expired or unauthorized. Logging out...");
            logout();
        };

        const handleShowConfirm = () => {
            setShowConfirm(true);
        };

        window.addEventListener("unauthorized", handleUnauthorized);
        window.addEventListener("show-logout-confirm", handleShowConfirm);
        return () => {
            window.removeEventListener("unauthorized", handleUnauthorized);
            window.removeEventListener("show-logout-confirm", handleShowConfirm);
        };
    }, []);

    if (!isLoggedIn() || isLoginPage) return null;

    const user = getCurrentUser();
    // Hide floating button for Admin and HQ roles as they'll have it in their dedicated layout header
    const hideFloating = user?.role === "ADMIN" || user?.role === "BRANCH_MANAGER" || user?.role === "COUNTER" || user?.role === "KITCHEN";

    const userInitial = (user?.username || "W")[0].toUpperCase();

    return (
        <>
            {!hideFloating && (
                <div className="fixed top-3 right-4 z-[100] no-print">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                className="flex items-center gap-2 h-9 md:h-10 pl-2.5 pr-3 rounded-full bg-white/90 backdrop-blur-xl border border-slate-200/80 hover:bg-white hover:border-slate-300 transition-all shadow-sm hover:shadow active:scale-95 group focus:outline-none focus:ring-2 focus:ring-primary/20"
                                title="Account & Session"
                            >
                                <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-primary to-orange-400 text-white flex items-center justify-center text-[10px] font-black shadow-xs">
                                    {userInitial}
                                </div>
                                <span className="text-xs font-bold text-slate-700 max-w-[90px] md:max-w-[120px] truncate">
                                    {user?.username || "Waiter"}
                                </span>
                                <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                            </button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent
                            align="end"
                            sideOffset={8}
                            className="w-56 p-1.5 rounded-2xl bg-white/95 backdrop-blur-2xl border border-slate-200/80 shadow-2xl animate-in fade-in-50 zoom-in-95"
                        >
                            <div className="px-3 py-2 border-b border-slate-100 mb-1">
                                <p className="text-xs font-bold text-slate-800 truncate">{user?.username || "Staff"}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        {user?.role || "Waiter"} {user?.branch_name ? `• ${user.branch_name}` : ""}
                                    </p>
                                </div>
                            </div>

                            <DropdownMenuItem
                                onClick={() => setShowChangePassword(true)}
                                className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 rounded-xl hover:bg-slate-100/80 cursor-pointer transition-colors"
                            >
                                <KeyRound className="h-4 w-4 text-slate-500" />
                                <span>Change Password</span>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator className="my-1 bg-slate-100" />

                            <DropdownMenuItem
                                onClick={() => setShowConfirm(true)}
                                className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 rounded-xl hover:bg-rose-50 hover:text-rose-700 cursor-pointer transition-colors"
                            >
                                <LogOut className="h-4 w-4 text-rose-500" />
                                <span>Sign Out</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}

            <ChangePasswordModal
                isOpen={showChangePassword}
                onClose={() => setShowChangePassword(false)}
            />

            <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
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
        </>
    );
}
