import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    ChevronLeft,
    Search,
    Trash2,
    FileText,
    Calendar,
    User,
    Ban,
    Banknote,
    QrCode,
    CreditCard,
    Wallet,
    Clock,
    AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { format, parseISO } from "date-fns";
import { fetchDeletedInvoices } from "@/api/index.js";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/auth/auth";

export default function DeletedInvoices() {
    const navigate = useNavigate();
    const [deletedOrders, setDeletedOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [dateFilter, setDateFilter] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [deletedTodayCount, setDeletedTodayCount] = useState(0);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [currentUser, setCurrentUser] = useState<any>(() => getCurrentUser());

    useEffect(() => {
        loadDeletedInvoices();
    }, [dateFilter]);

    const loadDeletedInvoices = async () => {
        setLoading(true);
        try {
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            console.log("🔍 DELETED INVOICES - FETCH START");
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            console.log("📅 Date filter:", dateFilter);
            
            const data = await fetchDeletedInvoices({ date: dateFilter });
            
            console.log("✅ API Response received");
            console.log("📦 Response structure:", {
                success: data?.success,
                deleted_today_count: data?.deleted_today_count,
                count: data?.count,
                results_length: data?.results?.length
            });
            
            if (data.results && data.results.length > 0) {
                console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                console.log("📝 FIRST INVOICE ANALYSIS");
                console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                const firstInvoice = data.results[0];
                console.log("🔑 Invoice Keys:", Object.keys(firstInvoice));
                console.log("📄 Full Invoice Object:", JSON.stringify(firstInvoice, null, 2));
                console.log("🚨 deleted_reason field:", firstInvoice.deleted_reason);
                console.log("🚨 deleted_reason type:", typeof firstInvoice.deleted_reason);
                console.log("🚨 deleted_reason value (raw):", JSON.stringify(firstInvoice.deleted_reason));
                console.log("🚨 Has 'deleted_reason' property?", firstInvoice.hasOwnProperty('deleted_reason'));
                
                // Check all possible field names
                console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                console.log("� CHECKING ALL POSSIBLE FIELD NAMES:");
                const possibleFields = [
                    'deleted_reason', 
                    'deletion_reason', 
                    'reason', 
                    'delete_reason',
                    'deletedReason',
                    'deletionReason'
                ];
                possibleFields.forEach(field => {
                    console.log(`   ${field}:`, firstInvoice[field]);
                });
                console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                
                // Check if field exists but is empty
                if (firstInvoice.hasOwnProperty('deleted_reason')) {
                    if (!firstInvoice.deleted_reason || firstInvoice.deleted_reason.trim() === '') {
                        console.warn("⚠️ WARNING: 'deleted_reason' field exists but is EMPTY or NULL");
                    } else {
                        console.log("✅ 'deleted_reason' field exists and has value:", firstInvoice.deleted_reason);
                    }
                } else {
                    console.error("❌ CRITICAL: 'deleted_reason' field does NOT exist in response");
                    toast.error("Backend API Error: 'deleted_reason' field is missing from response");
                }
            } else {
                console.log("📭 No deleted invoices in response");
            }
            
            setDeletedOrders(data.results || []);
            setDeletedTodayCount(data.deleted_today_count || 0);
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            console.log("✅ State updated successfully");
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        } catch (err: any) {
            console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            console.error("❌ DELETED INVOICES - FETCH ERROR");
            console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            console.error("Error type:", err.constructor.name);
            console.error("Error message:", err.message);
            console.error("Error stack:", err.stack);
            console.error("Full error object:", err);
            console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            
            // Handle different error types
            if (err.message.includes('403')) {
                toast.error("Access denied. You don't have permission to view deleted invoices.");
            } else if (err.message.includes('404')) {
                toast.error("Deleted invoices API endpoint not found. Please contact administrator.");
            } else if (err.message.includes('401')) {
                toast.error("Authentication required. Please log in again.");
            } else {
                toast.error(err.message || "Failed to load deleted invoices");
            }
        } finally {
            setLoading(false);
        }
    };

    const filteredOrders = deletedOrders.filter(order => {
        const query = searchQuery.toLowerCase();
        return (
            order.invoice_number?.toLowerCase().includes(query) ||
            order.customer_name?.toLowerCase().includes(query) ||
            order.deleted_reason?.toLowerCase().includes(query)
        );
    });

    const handleViewDetails = (order: any) => {
        setSelectedOrder(order);
        setShowDetailModal(true);
    };

    const getPaymentMethodIcon = (method: string) => {
        switch (method?.toUpperCase()) {
            case 'CASH': return <Banknote className="h-4 w-4" />;
            case 'QR': return <QrCode className="h-4 w-4" />;
            case 'CARD': return <CreditCard className="h-4 w-4" />;
            case 'CREDIT': return <Wallet className="h-4 w-4" />;
            default: return <Banknote className="h-4 w-4" />;
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100">
            {/* Apple-Inspired Header */}
            <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
                <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(-1)}
                            className="h-9 w-9 rounded-full hover:bg-slate-100 transition-colors"
                        >
                            <ChevronLeft className="h-5 w-5 text-slate-700" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                                <div className="h-8 w-8 rounded-xl bg-red-500/10 flex items-center justify-center">
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                </div>
                                Deleted Invoices
                            </h1>
                            {deletedTodayCount > 0 && (
                                <p className="text-xs text-red-600 font-semibold mt-0.5 ml-11">
                                    {deletedTodayCount} deleted today
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Search and Filters - Apple Style */}
                <div className="px-6 pb-4 flex gap-3 items-center">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search by invoice #, customer, or reason..."
                            className="pl-11 h-11 rounded-2xl border-slate-200/60 bg-white/60 backdrop-blur shadow-sm focus:bg-white transition-colors font-medium"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Date Filter */}
                    <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />
                        <Input
                            type="date"
                            className="pl-11 h-11 rounded-2xl border-slate-200/60 w-48 bg-white/60 backdrop-blur shadow-sm font-medium"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                        />
                    </div>

                    <Button
                        variant="outline"
                        onClick={() => setDateFilter('')}
                        className="h-11 rounded-2xl font-bold border-slate-200/60 bg-white/60 backdrop-blur hover:bg-white shadow-sm"
                    >
                        All Time
                    </Button>
                </div>
            </header>

            {/* Orders List - Apple Card Design */}
            <main className="p-6 max-w-5xl mx-auto">
                {loading ? (
                    <div className="text-center py-20">
                        <div className="inline-block h-10 w-10 animate-spin rounded-full border-[3px] border-solid border-slate-300 border-r-transparent"></div>
                        <p className="mt-3 text-sm text-slate-500 font-medium">Loading deleted invoices...</p>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                            <Ban className="h-8 w-8 text-slate-300" />
                        </div>
                        <p className="text-slate-900 font-semibold text-lg">No deleted invoices found</p>
                        <p className="text-sm text-slate-500 mt-1">
                            {searchQuery ? "Try adjusting your search" : "No invoices have been deleted"}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredOrders.map((order) => (
                            <div
                                key={order.id}
                                onClick={() => handleViewDetails(order)}
                                className="bg-white rounded-2xl p-5 border border-slate-200/60 hover:border-red-300/60 hover:shadow-lg cursor-pointer transition-all duration-200 backdrop-blur"
                            >
                                {/* Header Row */}
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
                                            <FileText className="h-5 w-5 text-slate-600" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="font-black text-slate-900 text-base tracking-tight">#{order.invoice_number}</span>
                                                <StatusBadge status={order.payment_status} />
                                            </div>
                                            {order.customer_name && (
                                                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                                    <User className="h-3.5 w-3.5" />
                                                    {order.customer_name}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xl font-black text-slate-900 tracking-tight">
                                            ₹{parseFloat(order.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </div>
                                        {order.payment_details && order.payment_details.length > 0 && (
                                            <div className="flex items-center gap-1.5 justify-end mt-1">
                                                <div className="h-5 w-5 rounded-md bg-slate-100 flex items-center justify-center">
                                                    {getPaymentMethodIcon(order.payment_details[0].payment_method)}
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                                    {order.payment_details[0].payment_method}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Deletion Reason - Prominent Display */}
                                {order.deleted_reason && order.deleted_reason.trim() !== '' ? (
                                    <div className="bg-red-50 border border-red-200/60 rounded-xl p-3 mb-3">
                                        <div className="flex items-start gap-2.5">
                                            <div className="h-6 w-6 rounded-lg bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                                                <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-black uppercase text-red-600 tracking-widest mb-1">Deletion Reason</p>
                                                <p className="text-sm text-red-800 font-medium leading-relaxed">{order.deleted_reason}</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-3 mb-3">
                                        <div className="flex items-start gap-2.5">
                                            <div className="h-6 w-6 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                                                <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest mb-1">Deletion Reason</p>
                                                <p className="text-xs text-amber-700 font-medium italic">No reason provided</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Footer Row */}
                                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                                        <div className="h-1.5 w-1.5 rounded-full bg-slate-400"></div>
                                        {order.branch_name}
                                    </span>
                                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                                        <Clock className="h-3.5 w-3.5" />
                                        {order.created_at && format(parseISO(order.created_at), 'MMM dd, HH:mm')}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Detail Modal - Apple Design */}
            <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
                <DialogContent className="max-w-[640px] max-h-[85vh] overflow-hidden rounded-3xl p-0 bg-white">
                    <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100">
                        <DialogTitle className="flex items-center gap-3 text-xl font-black text-slate-900">
                            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
                                <FileText className="h-5 w-5 text-slate-600" />
                            </div>
                            Invoice #{selectedOrder?.invoice_number}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="overflow-y-auto max-h-[calc(85vh-100px)] px-6 py-4">
                        {selectedOrder && (
                            <div className="space-y-5">
                                {/* Delete Reason - Most Prominent */}
                                {selectedOrder.deleted_reason && selectedOrder.deleted_reason.trim() !== '' ? (
                                    <div className="bg-gradient-to-br from-red-50 to-red-50/50 border-2 border-red-200/80 rounded-2xl p-5">
                                        <div className="flex items-start gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                                                <AlertCircle className="h-5 w-5 text-red-600" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs font-black uppercase text-red-600 tracking-widest mb-2">Deletion Reason</p>
                                                <p className="text-base text-red-900 font-semibold leading-relaxed">{selectedOrder.deleted_reason}</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-amber-50 border-2 border-amber-200/80 rounded-2xl p-5">
                                        <div className="flex items-start gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                                                <AlertCircle className="h-5 w-5 text-amber-600" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-black uppercase text-amber-600 tracking-widest mb-1">Deletion Reason</p>
                                                <p className="text-sm text-amber-800 font-medium italic">No reason provided</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Customer & Branch Info */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <User className="h-4 w-4 text-slate-500" />
                                            <p className="text-xs text-slate-600 font-bold uppercase tracking-wide">Customer</p>
                                        </div>
                                        <p className="text-sm font-bold text-slate-900">{selectedOrder.customer_name || "Walk-in Customer"}</p>
                                    </div>
                                    <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="h-1.5 w-1.5 rounded-full bg-slate-500"></div>
                                            <p className="text-xs text-slate-600 font-bold uppercase tracking-wide">Branch</p>
                                        </div>
                                        <p className="text-sm font-bold text-slate-900">{selectedOrder.branch_name}</p>
                                    </div>
                                </div>

                                {/* Items List */}
                                <div>
                                    <p className="text-xs text-slate-600 font-bold uppercase tracking-wide mb-3">Order Items</p>
                                    <div className="space-y-2">
                                        {selectedOrder.items?.map((item: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-center bg-white border border-slate-100 p-4 rounded-xl hover:border-slate-200 transition-colors">
                                                <div className="flex-1">
                                                    <p className="text-sm font-bold text-slate-900">{item.product_name}</p>
                                                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                                                        {item.quantity} × ₹{parseFloat(item.unit_price).toFixed(2)}
                                                    </p>
                                                </div>
                                                <p className="font-black text-slate-900 text-base">
                                                    ₹{(item.quantity * parseFloat(item.unit_price)).toFixed(2)}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Price Breakdown */}
                                <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-100 space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 font-medium">Subtotal</span>
                                        <span className="font-bold text-slate-900">₹{parseFloat(selectedOrder.subtotal).toFixed(2)}</span>
                                    </div>
                                    {parseFloat(selectedOrder.tax_amount) > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-600 font-medium">Tax</span>
                                            <span className="font-bold text-slate-900">₹{parseFloat(selectedOrder.tax_amount).toFixed(2)}</span>
                                        </div>
                                    )}
                                    {parseFloat(selectedOrder.discount) > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-emerald-600 font-medium">Discount</span>
                                            <span className="font-bold text-emerald-600">-₹{parseFloat(selectedOrder.discount).toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-lg font-black pt-3 border-t border-slate-200">
                                        <span className="text-slate-900">Total</span>
                                        <span className="text-slate-900">₹{parseFloat(selectedOrder.total_amount).toFixed(2)}</span>
                                    </div>
                                </div>

                                {/* Payment Status */}
                                <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-100">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs text-slate-600 font-bold uppercase tracking-wide">Payment Status</span>
                                        <StatusBadge status={selectedOrder.payment_status} />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-slate-600 font-medium">Paid Amount</span>
                                            <span className="font-bold text-slate-900">₹{parseFloat(selectedOrder.paid_amount).toFixed(2)}</span>
                                        </div>
                                        {parseFloat(selectedOrder.due_amount) > 0 && (
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-red-600 font-medium">Due Amount</span>
                                                <span className="font-bold text-red-600">₹{parseFloat(selectedOrder.due_amount).toFixed(2)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Timestamp */}
                                <div className="flex items-center justify-center gap-2 text-xs text-slate-500 font-medium pt-2">
                                    <Clock className="h-3.5 w-3.5" />
                                    Deleted on {selectedOrder.created_at && format(parseISO(selectedOrder.created_at), 'MMMM dd, yyyy • HH:mm')}
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
