import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  User as UserIcon,
  Settings,
  HelpCircle
} from "lucide-react";
import { getCurrentUser } from "@/auth/auth";
import { ChangePasswordModal } from "../auth/ChangePasswordModal";
import { useState } from "react";

interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
}

export function MobileHeader({ title, showBack = false }: MobileHeaderProps) {
  const navigate = useNavigate();
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Get current user and branch
  const user = getCurrentUser();
  const userName = user?.username || "Staff";
  const userRole = user?.role || "Staff";
  const branchName = user?.branch_name || "Ama Bakery";

  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-slate-200/60 px-3.5 pr-36 py-2 shadow-2xs">
      <div className="flex items-center justify-between">
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

        <div className="flex items-center gap-2">
        </div>
      </div>
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </header>
  );
}
