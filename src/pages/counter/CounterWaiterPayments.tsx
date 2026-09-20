import { useState, useEffect } from "react";
import { HandCoins, User, IndianRupee, CheckCircle2, History } from "lucide-react";
import { toast } from "sonner";

import { fetchUsers, fetchWaiterPayments, createWaiterPayment } from "@/api/index.js";
import { getCurrentUser } from "@/auth/auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function CounterWaiterPayments() {
    const [waiters, setWaiters] = useState<any[]>([]);
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [activeWaiterInput, setActiveWaiterInput] = useState<string | null>(null);
    const [transferAmount, setTransferAmount] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [usersRes, paymentsRes] = await Promise.all([
                fetchUsers(),
                fetchWaiterPayments()
            ]);

            const currentUser = getCurrentUser();
            // Get all waiters in this branch, sort them so those with cash appear first
            const branchWaiters = usersRes
                .filter((u: any) => u.user_type === "WAITER" && u.branch === currentUser?.branch_id)
                .sort((a: any, b: any) => (b.cash_in_hand || 0) - (a.cash_in_hand || 0));

            setWaiters(branchWaiters);
            setPayments(paymentsRes.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        } catch (error: any) {
            toast.error(error.message || "Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePayment = async (waiterId: number) => {
        if (!transferAmount || isNaN(Number(transferAmount)) || Number(transferAmount) <= 0) {
            toast.error("Please enter a valid amount");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await createWaiterPayment({
                paid_by: waiterId,
                amount: parseFloat(transferAmount)
            });
            toast.success("Payment recorded successfully!");
            setPayments(prev => [res, ...prev]);

            // Optionally refresh user data to update the cash pending
            await loadData();

            setActiveWaiterInput(null);
            setTransferAmount("");
        } catch (error: any) {
            toast.error(error.message || "Failed to record payment");
        } finally {
            setIsSubmitting(false);
        }
    };

    const WaiterCard = ({ waiter }: { waiter: any }) => {
        const isEditing = activeWaiterInput === waiter.id.toString();
        const pendingAmount = parseFloat(waiter.cash_in_hand || 0);

        return (
            <div className={`p-5 rounded-2xl border-2 transition-all ${pendingAmount > 0 ? "border-primary/20 bg-primary/5" : "border-slate-100 bg-white"}`}>
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full overflow-hidden bg-slate-200 border-2 border-white shadow-sm shrink-0">
                        <img
                            src={`https://api.dicebear.com/7.x/notionists/svg?seed=${waiter.username}`}
                            alt={waiter.username}
                            className="h-full w-full object-cover"
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-black text-slate-800 text-lg truncate">{waiter.full_name || waiter.username}</p>
                        <p className={`text-sm font-bold uppercase tracking-wider ${pendingAmount > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                            Holdings: Rs.{pendingAmount.toFixed(2)}
                        </p>
                    </div>

                    {!isEditing ? (
                        <Button
                            variant={pendingAmount > 0 ? "default" : "outline"}
                            className={`rounded-xl font-bold h-10 ${pendingAmount > 0 ? "gradient-main shadow-lg" : ""}`}
                            onClick={() => {
                                setActiveWaiterInput(waiter.id.toString());
                                setTransferAmount(pendingAmount > 0 ? pendingAmount.toString() : "");
                            }}
                        >
                            Collect
                        </Button>
                    ) : (
                        <Button
                            variant="ghost"
                            className="text-slate-400 hover:text-slate-600"
                            onClick={() => {
                                setActiveWaiterInput(null);
                                setTransferAmount("");
                            }}
                        >
                            Cancel
                        </Button>
                    )}
                </div>

                {isEditing && (
                    <div className="mt-4 pt-4 border-t border-slate-200/50 animate-in slide-in-from-top-2 fade-in">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <Input
                                    type="number"
                                    placeholder="Amount"
                                    className="pl-10 h-12 text-lg font-black rounded-xl bg-white border-primary/20"
                                    value={transferAmount}
                                    onChange={(e) => setTransferAmount(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <Button
                                className="h-12 rounded-xl font-bold gap-2 px-6 shadow-md"
                                disabled={isSubmitting || !transferAmount}
                                onClick={() => handleCreatePayment(waiter.id)}
                            >
                                {isSubmitting ? (
                                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-5 w-5" />
                                        Save
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex-1 overflow-auto bg-slate-50 p-6 md:p-10">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Active Waiters</h1>
                        <p className="text-slate-500 font-medium">Manage pending handovers from servers</p>
                    </div>
                </div>

                {/* Waiter Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-28 rounded-2xl bg-white/50 border-2 border-slate-100 animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {waiters.map(w => (
                            <WaiterCard key={w.id} waiter={w} />
                        ))}
                        {waiters.length === 0 && (
                            <div className="col-span-full py-12 text-center bg-white rounded-3xl border border-slate-100">
                                <User className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                                <p className="text-slate-400 font-bold">No waiters assigned to this branch.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Recent Transfers Log */}
                <Card className="rounded-[2xl] border-none shadow-lg bg-white overflow-hidden mt-8">
                    <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-row items-center justify-between">
                        <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                            <History className="h-5 w-5 text-slate-500" />
                            Transfer History Log
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {payments.length === 0 ? (
                            <div className="p-10 text-center text-slate-400 font-medium">No transfer history found.</div>
                        ) : (
                            <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                                {payments.map((p, idx) => (
                                    <div key={idx} className="p-4 px-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 shrink-0 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center border">
                                                <HandCoins className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 text-sm">
                                                    {p.paid_by_name || `Waiter #${p.paid_by}`}
                                                </p>
                                                <p className="text-xs font-semibold text-slate-400">
                                                    {new Date(p.created_at).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Amount</span>
                                            <span className="text-lg font-black text-emerald-600">
                                                Rs.{parseFloat(p.amount).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}
