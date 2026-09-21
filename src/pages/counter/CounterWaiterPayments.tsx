import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { 
    Banknote, 
    ArrowDownRight, 
    Clock, 
    Search, 
    CheckCircle2, 
    Receipt, 
    Menu, 
    History, 
    Check, 
    X, 
    Coins, 
    ShieldCheck,
    Keyboard
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

import { fetchUsers, fetchWaiterPayments, createWaiterPayment, fetchInvoices, addPayment } from "@/api/index.js";
import { getCurrentUser } from "@/auth/auth";
import { useOrdersWebSocket } from "@/hooks/useOrdersWebSocket";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";

// Helper to format staff name cleanly in Title Case
function formatStaffName(fullName?: string, username?: string): string {
    const raw = (fullName && fullName.trim().length > 0) ? fullName.trim() : (username || "Staff Member");
    const spaced = raw.replace(/([a-z])([A-Z])/g, "$1 $2");
    return spaced
        .split(/[\s_]+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ");
}

// Helper to format currency
function formatCurrency(val: number | string | undefined | null): string {
    const num = typeof val === "number" ? val : parseFloat(val || "0");
    if (isNaN(num)) return "Rs. 0.00";
    return `Rs. ${num.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

// Helper to format date & time
function formatDateTime(dateStr: string) {
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return format(d, "MMM dd • hh:mm a");
    } catch {
        return dateStr;
    }
}

// iOS Keyboard Rows for search
const KEYBOARD_ROWS = [
    '1234567890',
    'QWERTYUIOP',
    'ASDFGHJKL',
    'ZXCVBNM'
];

// Apple Calculator Touch Numpad Keys
const NUMPAD_KEYS = [
    "1", "2", "3",
    "4", "5", "6",
    "7", "8", "9",
    "C", "0", "⌫"
];

export default function CounterWaiterPayments() {
    const [waiters, setWaiters] = useState<any[]>([]);
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Filters & Search
    const [searchQuery, setSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "settled">("all");
    const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);

    // Register Modal for Selected Waiter
    const [selectedWaiter, setSelectedWaiter] = useState<any | null>(null);
    const [isRegisterOpen, setIsRegisterOpen] = useState(false);
    const [transferAmount, setTransferAmount] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // History Log Modal
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historySearch, setHistorySearch] = useState("");

    const wsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const loadData = useCallback(async (isInitial = false) => {
        if (isInitial) setLoading(true);

        try {
            const [usersRes, paymentsRes] = await Promise.all([
                fetchUsers(),
                fetchWaiterPayments()
            ]);

            const currentUser = getCurrentUser();
            const branchWaiters = (usersRes || [])
                .filter((u: any) => u.user_type === "WAITER" && (!currentUser?.branch_id || u.branch === currentUser?.branch_id))
                .sort((a: any, b: any) => (parseFloat(b.cash_in_hand) || 0) - (parseFloat(a.cash_in_hand) || 0));

            setWaiters(branchWaiters);

            const pList = Array.isArray(paymentsRes) ? paymentsRes : (paymentsRes?.results || paymentsRes?.data || []);
            const sortedPayments = pList.sort(
                (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            setPayments(sortedPayments);
        } catch (error: any) {
            toast.error(error.message || "Failed to load waiter data");
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadData(true);
    }, [loadData]);

    // WebSocket: Real-time auto-fetch whenever waiter collects or hands over cash
    const currentUser = getCurrentUser();
    useOrdersWebSocket(
        useCallback(() => {
            if (wsDebounceRef.current) clearTimeout(wsDebounceRef.current);
            wsDebounceRef.current = setTimeout(() => {
                loadData(false);
            }, 350);
        }, [loadData]),
        currentUser?.branch_id
    );

    // Cross-tab and window sync listener
    useEffect(() => {
        const handleSync = () => {
            loadData(false);
        };
        window.addEventListener("waiter-payment-updated", handleSync);
        return () => {
            window.removeEventListener("waiter-payment-updated", handleSync);
            if (wsDebounceRef.current) clearTimeout(wsDebounceRef.current);
        };
    }, [loadData]);

    // KPI summaries
    const totalOutstanding = useMemo(() => {
        return waiters.reduce((acc, w) => {
            const cash = parseFloat(w.cash_in_hand || 0);
            return cash > 0 ? acc + cash : acc;
        }, 0);
    }, [waiters]);

    const waitersWithPendingCash = useMemo(() => {
        return waiters.filter(w => (parseFloat(w.cash_in_hand) || 0) > 0);
    }, [waiters]);

    const todayCollected = useMemo(() => {
        const todayStr = new Date().toDateString();
        return payments
            .filter(p => {
                try {
                    return new Date(p.created_at).toDateString() === todayStr;
                } catch {
                    return false;
                }
            })
            .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    }, [payments]);

    // Filter waiters
    const filteredWaiters = useMemo(() => {
        return waiters.filter(w => {
            const q = searchQuery.toLowerCase().trim();
            const matchesSearch = 
                !q || 
                (w.full_name && w.full_name.toLowerCase().includes(q)) ||
                (w.username && w.username.toLowerCase().includes(q)) ||
                (w.id && w.id.toString().includes(q));

            const cash = parseFloat(w.cash_in_hand || 0);
            const matchesStatus = 
                filterStatus === "all" ? true :
                filterStatus === "pending" ? cash > 0 :
                cash <= 0;

            return matchesSearch && matchesStatus;
        });
    }, [waiters, searchQuery, filterStatus]);

    // Filter payments for history modal
    const filteredPayments = useMemo(() => {
        if (!historySearch.trim()) return payments;
        const q = historySearch.toLowerCase().trim();
        return payments.filter(p => 
            (p.paid_by_name && p.paid_by_name.toLowerCase().includes(q)) ||
            (p.amount && p.amount.toString().includes(q))
        );
    }, [payments, historySearch]);

    // Open Register for a staff member
    const handleOpenRegister = (waiter: any) => {
        setSelectedWaiter(waiter);
        const pending = parseFloat(waiter.cash_in_hand || 0);
        setTransferAmount(pending > 0 ? pending.toString() : "");
        setIsRegisterOpen(true);
    };

    // Touch Numpad Handler
    const handleNumpadPress = (key: string) => {
        if (key === "C") {
            setTransferAmount("");
        } else if (key === "⌫") {
            setTransferAmount(prev => (prev.length > 0 ? prev.slice(0, -1) : ""));
        } else {
            setTransferAmount(prev => {
                if (prev === "0") return key;
                if (prev.length >= 7) return prev;
                return prev + key;
            });
        }
    };

    // Quick presets
    const handleQuickPreset = (amount: number) => {
        setTransferAmount(amount.toString());
    };

    const handleQuickAdd = (addAmount: number) => {
        const current = parseFloat(transferAmount) || 0;
        setTransferAmount((current + addAmount).toString());
    };

    // Confirm payment submission
    const handleConfirmPayment = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!selectedWaiter) return;

        const amountNum = parseFloat(transferAmount);
        if (!transferAmount || isNaN(amountNum) || amountNum <= 0) {
            toast.error("Please enter a valid amount greater than 0");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await createWaiterPayment({
                paid_by: selectedWaiter.id,
                amount: amountNum
            });

            toast.success(`Received ${formatCurrency(amountNum)} from ${formatStaffName(selectedWaiter.full_name, selectedWaiter.username)}`);
            setPayments(prev => [res, ...prev]);

            // Also mark the waiter's cash invoices in backend database so received_by_counter is set
            try {
                const todayStr = new Date().toISOString().split('T')[0];
                const invoicesRes = await fetchInvoices({ date: todayStr });
                const allInvoices = invoicesRes?.results || (Array.isArray(invoicesRes) ? invoicesRes : []);
                const waiterOrdersToSettle = allInvoices.filter((inv: any) => {
                    const isWaiterOrder = String(inv.created_by) === String(selectedWaiter.id) || String(inv.received_by_waiter) === String(selectedWaiter.id);
                    const isPaidOrWaiter = (inv.payment_status === 'PAID' || inv.payment_status === 'WAITER RECEIVED' || inv.received_by_waiter);
                    return isWaiterOrder && isPaidOrWaiter && !inv.received_by_counter;
                });

                await Promise.allSettled(
                    waiterOrdersToSettle.map((inv: any) =>
                        addPayment(inv.id, {
                            amount: 0,
                            payment_method: "CASH",
                            notes: `Cash handover settled by counter for Staff #${selectedWaiter.id}`
                        })
                    )
                );
            } catch (invErr) {
                console.warn("Auto-settling individual invoices for waiter handover:", invErr);
            }

            // Close dialog
            setIsRegisterOpen(false);
            setSelectedWaiter(null);
            setTransferAmount("");

            // Re-sync data locally & notify other open tabs
            window.dispatchEvent(new CustomEvent("waiter-payment-updated"));
            await loadData(false);
        } catch (error: any) {
            toast.error(error.message || "Failed to record payment");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Listen for physical keyboard input when register modal is open
    useEffect(() => {
        if (!isRegisterOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const activeTag = (document.activeElement as HTMLElement)?.tagName;
            if (activeTag === "INPUT" || activeTag === "TEXTAREA") {
                return;
            }

            if (e.key >= "0" && e.key <= "9") {
                handleNumpadPress(e.key);
            } else if (e.key === "Backspace") {
                handleNumpadPress("⌫");
            } else if (e.key === "Escape") {
                setIsRegisterOpen(false);
            } else if (e.key === "Enter") {
                e.preventDefault();
                handleConfirmPayment();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isRegisterOpen, transferAmount, selectedWaiter, isSubmitting]);

    const selectedPendingAmount = parseFloat(selectedWaiter?.cash_in_hand || 0);
    const parsedTransferAmount = parseFloat(transferAmount) || 0;
    const remainingBalance = selectedPendingAmount - parsedTransferAmount;

    return (
        <div className="h-[100dvh] flex flex-col p-3 md:p-4 bg-[#F5F5F7] overflow-hidden text-[#1D1D1F] select-none font-sans">

            {/* Apple-Inspired Navigation Bar */}
            <header className="shrink-0 bg-white/90 backdrop-blur-xl rounded-2xl border border-black/[0.06] px-4 py-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex items-center justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => window.dispatchEvent(new CustomEvent("open-counter-sidebar"))}
                        className="md:hidden p-1.5 rounded-xl text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
                        aria-label="Open sidebar"
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                Counter Cashier
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-[10px] font-semibold text-slate-500">
                                Settlements
                            </span>
                        </div>
                        <h1 className="text-base md:text-lg font-semibold text-slate-900 tracking-tight leading-none mt-0.5">
                            Staff Cash Handover
                        </h1>
                    </div>
                </div>

                {/* Apple-Style Soft Metric Pills & Actions */}
                <div className="flex items-center gap-2">
                    <div className="bg-[#F5F5F7] border border-black/[0.04] px-3 py-1.5 rounded-xl flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        <span className="text-xs font-medium text-slate-500">Outstanding:</span>
                        <span className="font-semibold text-slate-900 text-xs md:text-sm tabular-nums">
                            {formatCurrency(totalOutstanding)}
                        </span>
                    </div>

                    <div className="hidden sm:flex bg-[#F5F5F7] border border-black/[0.04] px-3 py-1.5 rounded-xl items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="text-xs font-medium text-slate-500">Today:</span>
                        <span className="font-semibold text-slate-900 text-xs md:text-sm tabular-nums">
                            {formatCurrency(todayCollected)}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowHistoryModal(true)}
                        className="h-9 px-3.5 rounded-xl bg-white text-slate-800 border border-black/[0.08] hover:bg-[#F5F5F7] font-medium text-xs gap-1.5 active:scale-95 shadow-xs flex items-center transition-all"
                    >
                        <History className="h-3.5 w-3.5 text-slate-500" />
                        <span>History ({payments.length})</span>
                    </button>

                    {/* Apple-style Live Connection Badge (No reload or sync button) */}
                    <div className="h-9 px-3 rounded-xl bg-emerald-50 border border-emerald-200/60 text-emerald-800 font-medium text-xs flex items-center gap-1.5 shadow-2xs">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="font-semibold text-[11px]">Live Socket</span>
                    </div>
                </div>
            </header>

            {/* Apple Inset Segmented Filter & Search Toolbar */}
            <div className="shrink-0 bg-white/90 backdrop-blur-xl rounded-2xl border border-black/[0.06] p-2.5 mb-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row items-center justify-between gap-2.5">
                {/* Search Bar with Keyboard Trigger */}
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        type="text"
                        placeholder="Search staff..."
                        value={searchQuery}
                        onFocus={() => setShowVirtualKeyboard(true)}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-14 h-9 text-xs md:text-sm font-normal bg-[#F5F5F7] border-none rounded-xl text-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-300 placeholder:text-slate-400 transition-all shadow-none"
                    />
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {searchQuery && (
                            <button 
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="p-1 text-slate-400 hover:text-slate-700"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowVirtualKeyboard(prev => !prev)}
                            className={`p-1.5 rounded-lg border transition-all active:scale-95 ${
                                showVirtualKeyboard 
                                    ? "bg-[#1D1D1F] text-white border-transparent shadow-xs" 
                                    : "bg-white text-slate-600 hover:bg-slate-100 border-black/[0.06]"
                            }`}
                            title="Touch Keyboard"
                        >
                            <Keyboard className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>

                {/* Apple Segmented Control Tabs */}
                <div className="bg-[#E5E5EA]/70 p-1 rounded-xl flex items-center gap-1 w-full sm:w-auto">
                    <button
                        type="button"
                        onClick={() => setFilterStatus("all")}
                        className={cn(
                            "flex-1 sm:flex-none py-1 px-3.5 rounded-lg text-xs transition-all text-center",
                            filterStatus === "all"
                                ? "bg-white text-slate-900 font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                                : "text-slate-600 hover:text-slate-900 font-medium"
                        )}
                    >
                        All ({waiters.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilterStatus("pending")}
                        className={cn(
                            "flex-1 sm:flex-none py-1 px-3.5 rounded-lg text-xs transition-all text-center flex items-center justify-center gap-1.5",
                            filterStatus === "pending"
                                ? "bg-white text-slate-900 font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                                : "text-slate-600 hover:text-slate-900 font-medium"
                        )}
                    >
                        <span>Pending Handover</span>
                        {waitersWithPendingCash.length > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-900 font-semibold">
                                {waitersWithPendingCash.length}
                            </span>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilterStatus("settled")}
                        className={cn(
                            "flex-1 sm:flex-none py-1 px-3.5 rounded-lg text-xs transition-all text-center",
                            filterStatus === "settled"
                                ? "bg-white text-slate-900 font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                                : "text-slate-600 hover:text-slate-900 font-medium"
                        )}
                    >
                        Settled ({waiters.length - waitersWithPendingCash.length})
                    </button>
                </div>
            </div>

            {/* Main 4-Boxes-Per-Line Grid (Apple Tiles, No Outer Scrolling) */}
            <main className="flex-1 min-h-0 bg-transparent overflow-y-auto">
                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                            <div key={i} className="h-28 rounded-2xl bg-white border border-black/[0.06] animate-pulse" />
                        ))}
                    </div>
                ) : filteredWaiters.length === 0 ? (
                    <div className="py-24 text-center text-slate-400 text-sm font-medium">
                        No staff members found.
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {filteredWaiters.map(waiter => {
                            const pendingAmount = parseFloat(waiter.cash_in_hand || 0);
                            const hasCash = pendingAmount > 0;
                            const isCredit = pendingAmount < 0;

                            return (
                                <div
                                    key={waiter.id}
                                    onClick={() => handleOpenRegister(waiter)}
                                    className={cn(
                                        "min-h-[115px] p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between select-none active:scale-[0.98] shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.06)] hover:-translate-y-0.5",
                                        hasCash 
                                            ? "border-amber-300/80 bg-gradient-to-b from-amber-50/40 to-white" 
                                            : isCredit
                                                ? "border-blue-200/80 bg-gradient-to-b from-blue-50/30 to-white"
                                                : "border-black/[0.06] bg-white hover:bg-slate-50/50"
                                    )}
                                >
                                    {/* Top Row: Waiter Name & Subtitle */}
                                    <div>
                                        <h3 className="font-semibold text-slate-900 text-sm md:text-base tracking-tight leading-tight truncate">
                                            {formatStaffName(waiter.full_name, waiter.username)}
                                        </h3>
                                        <p className="text-[11px] text-slate-400 font-normal truncate mt-0.5">
                                            @{waiter.username || "waiter"} • ID #{waiter.id}
                                        </p>
                                    </div>

                                    {/* Middle Row: Cash Holdings */}
                                    <div className="my-1">
                                        <span className="text-[9px] font-medium uppercase tracking-wider text-slate-400 block leading-none">
                                            Holdings
                                        </span>
                                        <p className={cn(
                                            "font-semibold text-base md:text-lg tabular-nums tracking-tight mt-0.5",
                                            hasCash ? "text-slate-900" : isCredit ? "text-blue-900" : "text-slate-400"
                                        )}>
                                            {isCredit 
                                                ? `${formatCurrency(Math.abs(pendingAmount))} Cr` 
                                                : formatCurrency(pendingAmount)}
                                        </p>
                                    </div>

                                    {/* Bottom Row: Status Pill & Action Button */}
                                    <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-100">
                                        {hasCash ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100/90 text-amber-900 border border-amber-200/60">
                                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                Pending
                                            </span>
                                        ) : isCredit ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-900 border border-blue-200/60">
                                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                                Credit
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                Settled
                                            </span>
                                        )}

                                        <button
                                            type="button"
                                            className={cn(
                                                "px-3 py-1 rounded-xl text-xs font-medium transition-all active:scale-95 shadow-xs",
                                                hasCash 
                                                    ? "bg-[#1D1D1F] hover:bg-[#2C2C2E] text-white" 
                                                    : "bg-[#F5F5F7] hover:bg-[#E5E5EA] text-slate-700 border border-black/[0.04]"
                                            )}
                                        >
                                            {hasCash ? "Collect" : "Settle"}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Apple-Inspired POS Touch Register Modal */}
            <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
                <DialogContent className="max-w-md bg-white/95 backdrop-blur-2xl rounded-3xl border border-black/[0.08] p-5 md:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.15)]">
                    <DialogHeader className="text-left pb-3 border-b border-black/[0.04]">
                        <DialogTitle className="text-base font-semibold text-slate-900 tracking-tight flex items-center justify-between">
                            <span>Collect Cash Handover</span>
                            {selectedWaiter && (
                                <span className="text-xs font-normal px-2.5 py-1 bg-[#F5F5F7] text-slate-600 rounded-full border border-black/[0.04]">
                                    Staff #{selectedWaiter.id}
                                </span>
                            )}
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            Collect cash handover from waiter into counter register
                        </DialogDescription>
                    </DialogHeader>

                    {selectedWaiter && (
                        <div className="space-y-3.5 pt-1">
                            {/* Server Info Card */}
                            <div className="p-3.5 rounded-2xl bg-[#F5F5F7] border border-black/[0.04] flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                                        Staff Member
                                    </p>
                                    <p className="text-base font-semibold text-slate-900 leading-tight mt-0.5">
                                        {formatStaffName(selectedWaiter.full_name, selectedWaiter.username)}
                                    </p>
                                    <p className="text-xs text-slate-500 font-normal">
                                        @{selectedWaiter.username || "waiter"}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                                        Cash in Hand
                                    </p>
                                    <p className="text-lg font-semibold text-slate-900 tabular-nums leading-tight mt-0.5">
                                        {formatCurrency(selectedWaiter.cash_in_hand)}
                                    </p>
                                </div>
                            </div>

                            {/* Apple Calculator Style Register Amount Display */}
                            <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-black/[0.04] flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                                        Collection Amount
                                    </p>
                                    <p className="text-3xl font-bold text-slate-900 tabular-nums tracking-tight mt-0.5">
                                        Rs. {transferAmount || "0"}
                                    </p>
                                </div>
                                {transferAmount && !isNaN(parsedTransferAmount) && (
                                    <div className="text-right">
                                        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                                            Remaining
                                        </p>
                                        <p className="text-xs font-medium text-slate-600 tabular-nums mt-0.5">
                                            {formatCurrency(remainingBalance)}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Quick Presets (Apple Pills) */}
                            <div className="flex flex-wrap gap-1.5">
                                {selectedPendingAmount > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => handleQuickPreset(selectedPendingAmount)}
                                        className="h-8 px-3 text-xs font-medium rounded-full bg-amber-100/80 text-amber-900 hover:bg-amber-100 border border-amber-200/60 active:scale-95 transition-all"
                                    >
                                        Full Balance ({selectedPendingAmount})
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => handleQuickAdd(500)}
                                    className="h-8 px-3 text-xs font-medium rounded-full bg-[#F5F5F7] hover:bg-[#E5E5EA] text-slate-800 border border-black/[0.04] active:scale-95 transition-all"
                                >
                                    +500
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleQuickAdd(1000)}
                                    className="h-8 px-3 text-xs font-medium rounded-full bg-[#F5F5F7] hover:bg-[#E5E5EA] text-slate-800 border border-black/[0.04] active:scale-95 transition-all"
                                >
                                    +1,000
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleQuickAdd(2000)}
                                    className="h-8 px-3 text-xs font-medium rounded-full bg-[#F5F5F7] hover:bg-[#E5E5EA] text-slate-800 border border-black/[0.04] active:scale-95 transition-all"
                                >
                                    +2,000
                                </button>
                                {transferAmount && (
                                    <button
                                        type="button"
                                        onClick={() => setTransferAmount("")}
                                        className="h-8 px-3 text-xs font-medium rounded-full text-rose-600 bg-rose-50 hover:bg-rose-100 active:scale-95 transition-all ml-auto"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>

                            {/* Apple Calculator Touch Numpad */}
                            <div className="grid grid-cols-3 gap-2 pt-1">
                                {NUMPAD_KEYS.map((key) => {
                                    const isClear = key === "C";
                                    const isBackspace = key === "⌫";

                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => handleNumpadPress(key)}
                                            className={cn(
                                                "h-12 md:h-13 text-xl md:text-2xl font-medium rounded-2xl active:scale-95 transition-all flex items-center justify-center select-none shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
                                                isClear 
                                                    ? "bg-rose-50 text-rose-600 hover:bg-rose-100 active:bg-rose-200" 
                                                    : isBackspace 
                                                        ? "bg-[#E5E5EA] text-slate-800 hover:bg-[#D1D1D6]" 
                                                        : "bg-[#F5F5F7] hover:bg-[#E5E5EA] active:bg-[#D1D1D6] text-slate-900"
                                            )}
                                        >
                                            {key}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Apple-Style Action Buttons */}
                            <div className="pt-2 flex items-center gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setIsRegisterOpen(false)}
                                    className="h-12 px-5 rounded-2xl bg-[#F5F5F7] hover:bg-[#E5E5EA] text-slate-700 font-medium text-sm transition-all active:scale-95"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={isSubmitting || !transferAmount || parsedTransferAmount <= 0}
                                    onClick={() => handleConfirmPayment()}
                                    className="h-12 flex-1 rounded-2xl bg-[#1D1D1F] hover:bg-[#2C2C2E] disabled:opacity-40 text-white font-medium text-sm md:text-base shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <Check className="h-4 w-4" />
                                            <span>
                                                Confirm Handover {parsedTransferAmount > 0 ? `(${formatCurrency(parsedTransferAmount)})` : ""}
                                            </span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Apple Sheet Style Audit History Modal */}
            <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
                <DialogContent className="max-w-xl bg-white/95 backdrop-blur-2xl rounded-3xl border border-black/[0.08] p-6 shadow-2xl">
                    <DialogHeader className="text-left pb-3 border-b border-black/[0.04] flex flex-row items-center justify-between">
                        <div>
                            <DialogTitle className="text-lg font-semibold text-slate-900 tracking-tight">
                                Handover Audit Log
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-400 font-normal mt-0.5">
                                Verified chronological record of counter cash collections
                            </DialogDescription>
                        </div>
                        <span className="bg-[#F5F5F7] px-3 py-1 rounded-full text-xs font-medium text-slate-700 border border-black/[0.04]">
                            {payments.length} Records
                        </span>
                    </DialogHeader>

                    <div className="py-2">
                        {/* Search Filter */}
                        <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                type="text"
                                placeholder="Filter history..."
                                value={historySearch}
                                onChange={(e) => setHistorySearch(e.target.value)}
                                className="pl-9 h-9 text-xs bg-[#F5F5F7] border-none rounded-xl text-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-300"
                            />
                        </div>

                        {/* List */}
                        <div className="max-h-[360px] overflow-y-auto divide-y divide-black/[0.04]">
                            {filteredPayments.length === 0 ? (
                                <div className="p-10 text-center text-slate-400 text-xs font-normal">
                                    No transfer records found.
                                </div>
                            ) : (
                                filteredPayments.map((p, idx) => (
                                    <div key={p.id || idx} className="py-3 px-1 flex items-center justify-between hover:bg-[#F5F5F7] rounded-xl transition-colors">
                                        <div className="min-w-0 pr-3">
                                            <p className="font-semibold text-slate-900 text-sm truncate leading-snug">
                                                {formatStaffName(p.paid_by_name, `Waiter #${p.paid_by}`)}
                                            </p>
                                            <p className="text-[11px] text-slate-400 font-normal mt-0.5">
                                                {formatDateTime(p.created_at)}
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className="font-semibold text-emerald-600 text-sm md:text-base tabular-nums">
                                                + {formatCurrency(p.amount)}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* iOS Touch Keyboard for Search (Glass Blur Style) */}
            {showVirtualKeyboard && (
                <>
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 z-[998] bg-black/15 backdrop-blur-[2px]"
                        onClick={() => setShowVirtualKeyboard(false)}
                    />

                    {/* iOS Slide-Up Keyboard */}
                    <div className="fixed bottom-0 left-0 right-0 z-[999] bg-[#D1D1D6]/85 backdrop-blur-2xl border-t border-black/10 shadow-2xl p-2.5 md:p-3 animate-in slide-in-from-bottom duration-200">
                        <div className="max-w-4xl mx-auto">
                            {/* Keyboard Top Bar */}
                            <div className="flex items-center justify-between mb-2 px-1">
                                <div className="flex items-center gap-2">
                                    <Keyboard className="h-4 w-4 text-slate-700" />
                                    <span className="text-xs font-medium text-slate-800">
                                        Search Staff
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery("")}
                                        className="h-7 px-3 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg"
                                    >
                                        Clear
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowVirtualKeyboard(false)}
                                        className="h-7 px-3.5 text-xs font-medium rounded-lg bg-white text-slate-900 shadow-xs"
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>

                            {/* QWERTY Rows */}
                            <div className="space-y-1.5 select-none">
                                {KEYBOARD_ROWS.map((row, rIdx) => (
                                    <div key={rIdx} className="flex justify-center gap-1.5">
                                        {row.split('').map(char => (
                                            <button
                                                key={char}
                                                type="button"
                                                className="h-11 md:h-13 flex-1 max-w-[72px] text-base md:text-lg font-medium rounded-lg bg-white text-slate-900 hover:bg-slate-50 active:scale-95 shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-all flex items-center justify-center"
                                                onClick={() => setSearchQuery(prev => prev + char)}
                                            >
                                                {char}
                                            </button>
                                        ))}
                                        {rIdx === 3 && (
                                            <button
                                                type="button"
                                                className="h-11 md:h-13 px-6 md:px-8 text-base font-medium rounded-lg bg-[#E5E5EA] text-slate-800 hover:bg-[#D1D1D6] active:scale-95 shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-all flex items-center justify-center"
                                                onClick={() => setSearchQuery(prev => prev.slice(0, -1))}
                                            >
                                                ⌫
                                            </button>
                                        )}
                                    </div>
                                ))}

                                {/* Space & Done Row */}
                                <div className="flex justify-center gap-2 pt-1">
                                    <button
                                        type="button"
                                        className="h-11 md:h-13 flex-1 max-w-[500px] text-xs font-medium rounded-lg bg-white text-slate-800 uppercase tracking-wider active:scale-95 shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
                                        onClick={() => setSearchQuery(prev => prev + " ")}
                                    >
                                        Space
                                    </button>
                                    <button
                                        type="button"
                                        className="h-11 md:h-13 px-8 md:px-12 text-xs font-semibold rounded-lg bg-[#0071E3] hover:bg-[#0077ED] text-white uppercase tracking-wider active:scale-95 shadow-md"
                                        onClick={() => setShowVirtualKeyboard(false)}
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

        </div>
    );
}
