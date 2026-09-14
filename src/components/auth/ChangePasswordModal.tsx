import { useState, useEffect } from "react";
import { Lock, Eye, EyeOff, ShieldAlert, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { changePassword } from "@/api";
import { cn } from "@/lib/utils";
import { logout, getCurrentUser } from "@/auth/auth";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";

interface ChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    isForced?: boolean;
    defaultOldPassword?: string;
}

export function ChangePasswordModal({
    isOpen,
    onClose,
    isForced = false,
    defaultOldPassword = ""
}: ChangePasswordModalProps) {
    const [oldPassword, setOldPassword] = useState(defaultOldPassword);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showOld, setShowOld] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setOldPassword(defaultOldPassword || "");
            setNewPassword("");
            setConfirmPassword("");
        }
    }, [isOpen, defaultOldPassword]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword === "amabakery@123" || (defaultOldPassword && newPassword === defaultOldPassword)) {
            toast.error("New password cannot be the default password. Please choose a different password.");
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        if (newPassword.length < 8) {
            toast.error("New password must be at least 8 characters long");
            return;
        }

        setLoading(true);
        try {
            await changePassword(oldPassword, newPassword);
            toast.success("Password changed successfully", {
                description: "Your account is now secured with your new password."
            });

            // Clear forced password flags
            localStorage.removeItem("mustChangePassword");
            localStorage.removeItem("defaultPasswordUsed");
            const currentUser = getCurrentUser();
            if (currentUser?.id || currentUser?.username) {
                sessionStorage.setItem("checked_default_pw_" + (currentUser.id || currentUser.username), "changed");
            }
            window.dispatchEvent(new CustomEvent("password-changed"));

            setOldPassword("");
            setNewPassword("");
            setConfirmPassword("");
            onClose();
        } catch (err: any) {
            toast.error("Failed to change password", {
                description: err.message || "Please check your current password and try again."
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open && isForced) return;
                onClose();
            }}
        >
            <DialogContent
                className={cn(
                    "sm:max-w-[425px] rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden",
                    isForced && "[&>button]:hidden"
                )}
                onPointerDownOutside={(e) => {
                    if (isForced) e.preventDefault();
                }}
                onEscapeKeyDown={(e) => {
                    if (isForced) e.preventDefault();
                }}
            >
                <div className={cn("p-8 text-white relative", isForced ? "bg-amber-600" : "bg-primary")}>
                    {isForced && (
                        <div className="inline-flex items-center gap-1.5 bg-amber-700/80 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-amber-100 mb-3">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            Action Required
                        </div>
                    )}
                    <DialogTitle className="text-2xl font-black mb-1">
                        {isForced ? "Update Default Password" : "Security Update"}
                    </DialogTitle>
                    <DialogDescription className="text-white/80 font-medium text-xs leading-relaxed">
                        {isForced
                            ? "Your account is currently using the default system password. For security compliance, you must set a new personal password before continuing."
                            : "Choose a strong password to keep your account secure."}
                    </DialogDescription>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-5 bg-white">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                            Current Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                type={showOld ? "text" : "password"}
                                value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)}
                                className="pl-11 h-12 bg-slate-50 border-slate-100 rounded-xl focus:ring-primary/20"
                                placeholder="••••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowOld(!showOld)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                {showOld ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                            </button>
                        </div>
                        {isForced && defaultOldPassword && (
                            <p className="text-[11px] text-amber-600 font-semibold mt-1 ml-1">
                                Default password detected and pre-filled.
                            </p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                            New Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                type={showNew ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="pl-11 h-12 bg-slate-50 border-slate-100 rounded-xl focus:ring-primary/20"
                                placeholder="••••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowNew(!showNew)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                {showNew ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                            Confirm New Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                type={showConfirm ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="pl-11 pr-11 h-12 bg-slate-50 border-slate-100 rounded-xl focus:ring-primary/20"
                                placeholder="••••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirm(!showConfirm)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                {showConfirm ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={loading}
                        className={cn(
                            "w-full h-12 rounded-xl mt-4 font-bold text-sm uppercase tracking-widest shadow-lg transition-all",
                            isForced
                                ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20 hover:shadow-amber-600/30 text-white"
                                : "shadow-primary/20 hover:shadow-primary/30"
                        )}
                    >
                        {loading
                            ? "Updating Password..."
                            : isForced
                            ? "Set New Password & Continue"
                            : "Update Password"}
                    </Button>

                    {isForced && (
                        <div className="pt-3 text-center border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => logout()}
                                className="text-xs font-bold text-slate-400 hover:text-red-600 transition-colors uppercase tracking-wider inline-flex items-center gap-1.5"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                                Sign out instead
                            </button>
                        </div>
                    )}
                </form>
            </DialogContent>
        </Dialog>
    );
}
