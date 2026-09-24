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
    Wallet
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
            console.log("🔍 Loading deleted invoices with date filter:", dateFilter);
            const data = await fetchDeletedInvoices({ date: dateFilter });
            console.log("✅ Successfully loaded deleted invoices:", data);
            setDeletedOrders(data.results || []);
            setDeletedTodayCount(data.deleted_today_count || 0);
        } catch (err: any) {
            console.error("❌ Failed to load deleted invoices:", err);
            
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
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-white border-b shadow-sm">
                <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(-1)}
                            className="rounded-full"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <Trash2 className="h-5 w-5 text-red-500" />
                                Deleted Invoices
                            </h1>
                            <p className="text-xs text-slate-500 font-medium">
                                {deletedTodayCount > 0 && (
                                    <span className="text-red-600 font-bold">{deletedTodayCount} deleted today</span>
                                )}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="px-4 pb-4 flex gap-3 items-center">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search by invoice #, customer, or reason..."
                            className="pl-10 h-10 rounded-lg border-slate-200 bg-white shadow-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Date Filter */}
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <Input
                            type="date"
                            className="pl-10 h-10 rounded-lg border-slate-200 w-44 bg-white shadow-sm"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                        />
                    </div>

                    <Button
                        variant="outline"
                        onClick={() => setDateFilter('')}
                        className="h-10 rounded-lg font-bold"
                    >
                        All Time
                    </Button>
                </div>
            </header>

            {/* Orders List */}
            <main className="p-4">
                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                        <p className="mt-2 text-sm text-slate-500">Loading deleted invoices...</p>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="text-center py-12">
                        <Ban className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">No deleted invoices found</p>
                        <p className="text-xs text-slate-400 mt-1">
                            {searchQuery ? "Try adjusting your search" : "No invoices have been deleted"}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredOrders.map((order) => (
                            <div
                                key={order.id}
                                onClick={() => handleViewDetails(order)}
                                className="bg-white rounded-xl p-4 border border-slate-200 hover:border-red-300 cursor-pointer transition-all hover:shadow-md"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-black text-slate-900">#{order.invoice_number}</span>
                                            <StatusBadge status={order.payment_status} />
                                        </div>
                                        {order.customer_name && (
                                            <div className="flex items-center gap-1 text-xs text-slate-500">
                                                <User className="h-3 w-3" />
                                                {order.customer_name}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-black text-slate-900">Rs.{parseFloat(order.total_amount).toFixed(2)}</div>
                                        {order.payment_details && order.payment_details.length > 0 && (
                                            <div className="flex items-center gap-1 justify-end mt-1">
                                                {getPaymentMethodIcon(order.payment_details[0].payment_method)}
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">
                                                    {order.payment_details[0].payment_method}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Delete Reason */}
                                <div className="bg-red-50 border border-red-200 rounded-lg p-2 mt-2">
                                    <div className="flex items-start gap-2">
                                        <Ban className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black uppercase text-red-600 tracking-wider">Deletion Reason</p>
                                            <p className="text-xs text-red-700 font-medium mt-0.5">{order.deleted_reason}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mt-2 pt-2 border-t">
                                    <span className="text-[10px] text-slate-400 font-medium">{order.branch_name}</span>
                                    <span className="text-[10px] text-slate-400 font-medium">
                                        {order.created_at && format(parseISO(order.created_at), 'MMM dd, yyyy HH:mm')}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Detail Modal */}
            <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
                <DialogContent className="max-w-[600px] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Invoice #{selectedOrder?.invoice_number}
                        </DialogTitle>
                    </DialogHeader>

                    {selectedOrder && (
                        <div className="space-y-4 mt-4">
                            {/* Delete Reason - Prominent */}
                            <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <Ban className="h-5 w-5 text-red-500 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-black uppercase text-red-600 tracking-wider mb-1">Deletion Reason</p>
                                        <p className="text-sm text-red-800 font-medium">{selectedOrder.deleted_reason}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Customer & Branch */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-slate-500 font-medium mb-1">Customer</p>
                                    <p className="text-sm font-bold">{selectedOrder.customer_name || "Walk-in"}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-medium mb-1">Branch</p>
                                    <p className="text-sm font-bold">{selectedOrder.branch_name}</p>
                                </div>
                            </div>

                            {/* Items */}
                            <div>
                                <p className="text-xs text-slate-500 font-medium mb-2">Items</p>
                                <div className="space-y-2">
                                    {selectedOrder.items?.map((item: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                                            <div>
                                                <p className="text-sm font-bold">{item.product_name}</p>
                                                <p className="text-xs text-slate-500">Qty: {item.quantity} × Rs.{item.unit_price}</p>
                                            </div>
                                            <p className="font-bold">Rs.{(item.quantity * parseFloat(item.unit_price)).toFixed(2)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Totals */}
                            <div className="border-t pt-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Subtotal</span>
                                    <span className="font-bold">Rs.{selectedOrder.subtotal}</span>
                                </div>
                                {parseFloat(selectedOrder.tax_amount) > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600">Tax</span>
                                        <span className="font-bold">Rs.{selectedOrder.tax_amount}</span>
                                    </div>
                                )}
                                {parseFloat(selectedOrder.discount) > 0 && (
                                    <div className="flex justify-between text-sm text-emerald-600">
                                        <span>Discount</span>
                                        <span className="font-bold">-Rs.{selectedOrder.discount}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-lg font-black pt-2 border-t">
                                    <span>Total</span>
                                    <span className="text-primary">Rs.{selectedOrder.total_amount}</span>
                                </div>
                            </div>

                            {/* Payment Status */}
                            <div className="bg-slate-50 p-3 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-600">Payment Status</span>
                                    <StatusBadge status={selectedOrder.payment_status} />
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-xs text-slate-600">Paid Amount</span>
                                    <span className="font-bold">Rs.{selectedOrder.paid_amount}</span>
                                </div>
                                {parseFloat(selectedOrder.due_amount) > 0 && (
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-xs text-slate-600">Due Amount</span>
                                        <span className="font-bold text-red-600">Rs.{selectedOrder.due_amount}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
