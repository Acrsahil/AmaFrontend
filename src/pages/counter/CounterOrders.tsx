import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    ChevronLeft,
    Search,
    Clock,
    CheckCircle2,
    Printer,
    MoreHorizontal,
    Monitor,
    Calendar,
    Filter,
    Loader2,
    Banknote,
    QrCode,
    CreditCard,
    ShoppingBag,
    FileText,
    Check,
    User,
    LogOut,
    Key
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { format, parseISO } from "date-fns";
import { fetchInvoices, addPayment, fetchProducts } from "@/api/index.js";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getCurrentUser, logout } from "@/auth/auth";
import { ChangePasswordModal } from "@/components/auth/ChangePasswordModal";
import { X } from "lucide-react";
import { useOrdersWebSocket } from "@/hooks/useOrdersWebSocket";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function CounterOrders() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"ALL" | "PAID" | "UNPAID" | "PARTIAL" | "PENDING">("ALL");

    // Payment States
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [paymentAmount, setPaymentAmount] = useState("");
    const [paymentMethod, setPaymentMethod] = useState<"CASH" | "ONLINE" | "QR">("CASH");
    const [paymentNotes, setPaymentNotes] = useState("");
    const [isPaying, setIsPaying] = useState(false);
    const [productsMap, setProductsMap] = useState<Record<string, any>>({});
    const [activeTab, setActiveTab] = useState<"payment" | "items">("payment");
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showReceipt, setShowReceipt] = useState(false);
    const [autoPrint, setAutoPrint] = useState(false);
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        if (showReceipt && autoPrint) {
            const timer = setTimeout(() => {
                window.print();
                setAutoPrint(false);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [showReceipt, autoPrint]);

    useEffect(() => {
        setCurrentUser(getCurrentUser());
    }, []);

    const loadProducts = useCallback(async () => {
        try {
            const data = await fetchProducts();
            if (!Array.isArray(data)) {
                console.warn("fetchProducts returned non-array:", data);
                setProductsMap({});
                return;
            }
            const map = data.reduce((acc: any, p: any) => {
                acc[String(p.id)] = p;
                return acc;
            }, {});
            setProductsMap(map);
        } catch (err) {
            console.error("Failed to load products for mapping", err);
            setProductsMap({});
        }
    }, []);

    const loadInvoices = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchInvoices();
            if (Array.isArray(data)) {
                // Filter locally to avoid crashing on invalid/deleted invoices
                const validOrders = data.filter((inv: any) =>
                    inv.invoice_type === 'SALE' && !inv.is_deleted
                );
                // Sort by ID descending (newest first)
                validOrders.sort((a: any, b: any) => b.id - a.id);
                setOrders(validOrders);
            } else {
                setOrders([]);
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to load orders");
            setOrders([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadInvoices();
        loadProducts();
    }, [loadInvoices, loadProducts]);

    // Play notification sound
    const playNotificationSound = useCallback(() => {
        try {
            const audio = new Audio("/noti.mp3");
            audio.play().catch(() => {
                // Autoplay may be blocked by browser until user interaction
            });
        } catch {
            // Ignore audio errors
        }
    }, []);

    // WebSocket: auto-refresh when invoice created or status updated
    useOrdersWebSocket(
        useCallback(
            (data) => {
                if (data.type === "invoice_created") {
                    // New order - play sound
                    playNotificationSound();
                    loadInvoices();
                } else if (data.type === "invoice_updated" && data.status === "READY") {
                    // Order ready - play sound
                    playNotificationSound();
                    loadInvoices();
                } else if (data.type === "invoice_updated") {
                    loadInvoices();
                }
            },
            [loadInvoices, playNotificationSound]
        )
    );

    const handlePayOpen = (order: any) => {
        setSelectedOrder(order);
        setPaymentAmount(order.due_amount || (order.total_amount - (order.paid_amount || 0)));
        setPaymentMethod("CASH");
        setPaymentNotes("");
        setActiveTab("payment");
        setShowDetailModal(true);
    };

    const handleRowPrint = (e: React.MouseEvent, order: any) => {
        e.stopPropagation();
        setSelectedOrder(order);
        setAutoPrint(true);
        setShowReceipt(true);
    };

    const handleRowClick = (order: any) => {
        setSelectedOrder(order);
        setPaymentAmount(order.due_amount || (order.total_amount - (order.paid_amount || 0)));
        setPaymentMethod("CASH");
        setPaymentNotes("");
        setActiveTab(order.payment_status === 'PAID' ? "items" : "payment");
        setShowDetailModal(true);
    };

    const handlePaymentSubmit = async () => {
        if (!selectedOrder) return;
        // Allow 0 amount if we are just confirming waiter handover
        const isConfirmingHandover = (selectedOrder.payment_status === 'PAID' || selectedOrder.payment_status === 'PARTIAL' || selectedOrder.payment_status === 'WAITER RECEIVED') && selectedOrder.received_by_waiter && !selectedOrder.received_by_counter && parseFloat(selectedOrder.due_amount || 0) <= 0;
        if (!isConfirmingHandover && (!paymentAmount || parseFloat(paymentAmount) <= 0)) {
            toast.error("Please enter a valid amount");
            return;
        }

        setIsPaying(true);
        try {
            await addPayment(selectedOrder.id, {
                amount: parseFloat(paymentAmount),
                payment_method: paymentMethod,
                notes: paymentNotes
            });
            toast.success("Payment added successfully");
            setShowDetailModal(false);
            loadInvoices(); // Refresh list
        } catch (err: any) {
            toast.error(err.message || "Failed to process payment");
        } finally {
            setIsPaying(false);
        }
    };

    const handlePrint = () => {
        if (!selectedOrder) return;
        const subtotal = parseFloat(selectedOrder.total_amount) - parseFloat(selectedOrder.tax_amount || 0) + parseFloat(selectedOrder.discount || 0);
        const taxAmount = parseFloat(selectedOrder.tax_amount || 0);
        const discountAmount = parseFloat(selectedOrder.discount || 0);
        const total = parseFloat(selectedOrder.total_amount);

        const itemRows = selectedOrder.items?.map((item: any, index: number) => {
            const productName = item.product_name || productsMap[String(item.product)]?.name || `Product #${item.product}`;
            return `
            <div class="receipt-item-grid">
                <div>${index + 1}</div>
                <div>
                    ${productName}
                    ${item.description ? `<div style="font-size: 8pt; text-transform: none; margin-top: 1mm;">"${item.description}"</div>` : ""}
                </div>
                <div>${item.quantity}</div>
                <div style="text-align: right;">${(parseFloat(item.unit_price) * item.quantity).toFixed(2)}</div>
            </div>
        `}).join("") || "";

        const taxRow = taxAmount > 0 ? `
            <div class="thermal-row">
                <span>TAX</span>
                <span>${taxAmount.toFixed(2)}</span>
            </div>` : "";

        const discountRow = discountAmount > 0 ? `
            <div class="thermal-row" style="color: #dc2626 !important;">
                <span>DISCOUNT</span>
                <span>-${discountAmount.toFixed(2)}</span>
            </div>` : "";

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"/>
    <title>Receipt - Ama Bakery</title>
    <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+39&display=swap" rel="stylesheet">
    <style>
        * { margin:0; padding:0; box-sizing:border-box; color: black !important; background: white !important; font-family: 'Courier New', Courier, monospace !important; }
        body { width: 80mm; padding: 4mm; }
        .thermal-header { text-align: center; margin-bottom: 4mm; }
        .thermal-title { font-size: 16pt; font-weight: bold; margin-bottom: 1mm; letter-spacing: 1px; text-transform: uppercase; }
        .thermal-subtitle { font-size: 9pt; margin-bottom: 2mm; text-align: center; }
        .thermal-info-grid { display: grid; grid-template-columns: 1fr 1fr; font-size: 9pt; margin-bottom: 4mm; line-height: 1.4; gap: 2mm; }
        .thermal-info-left { text-align: left; }
        .thermal-info-right { text-align: right; }
        .thermal-row { display: flex; justify-content: space-between; margin-bottom: 1mm; font-size: 10pt; }
        .thermal-divider { border-top: 1px dashed black; margin: 3mm 0; }
        .thermal-total-row { font-size: 14pt; font-weight: bold; display: flex; justify-content: space-between; margin-top: 2mm; border-top: 1px dashed black; padding-top: 2mm; }
        .receipt-item-grid { display: grid; grid-template-columns: 6mm 1fr 10mm 18mm; gap: 1mm; font-size: 9pt; margin-bottom: 1mm; text-transform: uppercase; }
        .thermal-footer { text-align: center; margin-top: 6mm; font-size: 9pt; font-weight: bold; text-transform: uppercase; }
        .thermal-barcode { text-align: center; margin-top: 4mm; font-family: 'Libre Barcode 39', monospace !important; font-size: 30pt; }
        .thermal-branding { text-align: center; font-size: 7pt; color: #aaa !important; margin-top: 2mm; }
        
        @media print {
            @page { size: 80mm auto; margin: 0; }
            body { width: 80mm; padding: 4mm; }
        }
    </style>
</head>
<body>
    <div class="thermal-header">
        <div class="thermal-title">AMA BAKERY</div>
        <div class="thermal-subtitle">Tel: 9816020731</div>
    </div>
    
    <div class="thermal-divider"></div>

    <div class="thermal-info-grid">
        <div class="thermal-info-left">
            <div>INV: #${selectedOrder.invoice_number}</div>
            <div>DATE: ${selectedOrder.created_at ? format(parseISO(selectedOrder.created_at), 'dd/MM/yyyy HH:mm') : new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <div class="thermal-info-right">
            <div>CSHR: ${currentUser?.name || "Counter"}</div>
            <div>CUST: ${selectedOrder.customer_name || "Walk-in"}</div>
        </div>
    </div>

    <div class="thermal-divider"></div>
    
    <div class="receipt-item-grid" style="font-weight: bold;">
        <div>SN</div>
        <div>ITEM</div>
        <div>QTY</div>
        <div style="text-align: right;">TOTAL</div>
    </div>
    
    ${itemRows}

    <div class="thermal-divider"></div>

    <div style="font-size: 10pt; line-height: 1.5;">
        <div class="thermal-row">
            <span>SUBTOTAL</span>
            <span>${subtotal.toFixed(2)}</span>
        </div>
        ${taxRow}
        ${discountRow}
        <div class="thermal-divider"></div>
        <div class="thermal-total-row">
            <span>TOTAL</span>
            <span>${total.toFixed(2)}</span>
        </div>
        <div class="thermal-divider"></div>
        <div class="thermal-row">
            <span>STATUS</span>
            <span>${selectedOrder.payment_status}</span>
        </div>
        <div class="thermal-divider"></div>
        
        <div class="thermal-row" style="font-size: 9pt; opacity: 0.8;">
            <span>PAID AMOUNT</span>
            <span>${parseFloat(selectedOrder.paid_amount || 0).toFixed(2)}</span>
        </div>
        ${parseFloat(selectedOrder.due_amount) > 0 ? `
        <div class="thermal-row" style="font-size: 9pt; font-weight: bold;">
            <span>BALANCE DUE</span>
            <span>${parseFloat(selectedOrder.due_amount).toFixed(2)}</span>
        </div>` : ""}
    </div>

    <div class="thermal-footer">
        THANK YOU FOR YOUR VISIT!
    </div>
    <div class="thermal-barcode">
        *AMA-POS-BILL*
    </div>
    <div class="thermal-branding">
        POS-BY: nishchalacharya.com.np
    </div>

    <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};</script>
</body>
</html>`;

        const win = window.open('', '_blank', 'width=400,height=700');
        if (win) {
            win.document.write(html);
            win.document.close();
        }
    };

    const getDisplayStatus = (order: any) => {
        if ((order.payment_status === 'PAID' || order.payment_status === 'WAITER RECEIVED') && order.received_by_waiter && !order.received_by_counter) {
            return 'waiter-paid'; // maps to 'Waiter Received' label in StatusBadge
        }
        return order.payment_status?.toLowerCase() || 'unpaid';
    };

    const filteredOrders = useMemo(() => {
        if (!Array.isArray(orders)) return [];
        let result = orders;

        // 1. Status Filter
        if (statusFilter !== "ALL") {
            result = result.filter(order => order.payment_status === statusFilter);
        }

        // 2. Search Query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(order =>
                (order.invoice_number?.toLowerCase() || "").includes(query) ||
                (order.customer_name?.toLowerCase() || "").includes(query) ||
                (String(order.table_no || "")).includes(query) ||
                (order.invoice_description?.toLowerCase() || "").includes(query)
            );
        }

        // 3. Sort (newest first)
        return result.sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA;
        });
    }, [orders, searchQuery, statusFilter]);

    return (
        <div className="h-screen bg-stone-50 flex flex-col overflow-hidden font-sans">
            {/* Header */}
            <header className="h-16 bg-white border-b px-6 pr-14 flex items-center justify-between shrink-0 z-10">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/counter/pos')} className="rounded-xl">
                        <ChevronLeft className="h-6 w-6" />
                    </Button>
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 h-10 w-10 rounded-xl flex items-center justify-center">
                            <Monitor className="h-6 w-6 text-primary" />
                        </div>
                        <h1 className="text-xl font-black text-slate-800">Order History</h1>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <Button
                        variant="default"
                        onClick={() => navigate('/counter/pos')}
                        className="h-11 px-6 rounded-xl font-black bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 gap-2"
                    >
                        <ShoppingBag className="h-5 w-5" />
                        Sell Items
                    </Button>
                    <Separator orientation="vertical" className="h-8" />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-auto p-2 hover:bg-slate-50 flex items-center gap-3 rounded-2xl transition-all text-left">
                                <div className="text-right hidden md:block">
                                    <p className="text-sm font-black text-slate-700">{currentUser?.name || "Counter User"}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{currentUser?.role}</p>
                                </div>
                                <div className="h-10 w-10 rounded-full bg-slate-900 flex items-center justify-center text-white shrink-0 shadow-sm">
                                    <User className="h-5 w-5" />
                                </div>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 font-bold z-[100]">
                            <DropdownMenuItem
                                className="h-10 rounded-xl cursor-pointer transition-colors"
                                onClick={() => setShowChangePassword(true)}
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
                isOpen={showChangePassword}
                onClose={() => setShowChangePassword(false)}
            />

            {/* Toolbar */}
            <div className="px-6 py-4 shrink-0 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search ID, Table, Customer or Mode..."
                        className="pl-10 h-10 rounded-lg border-slate-200 bg-white shadow-sm focus-visible:ring-1"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className={cn(
                            "h-10 px-4 rounded-lg font-medium border-slate-200 hover:bg-slate-50 gap-2 shadow-sm",
                            statusFilter !== "ALL" && "border-primary text-primary bg-primary/5"
                        )}>
                            <Filter className="h-4 w-4" />
                            {statusFilter === "ALL" ? "Filters" : statusFilter.charAt(0) + statusFilter.slice(1).toLowerCase()}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-xl p-2 font-bold z-[100]">
                        <DropdownMenuItem className="h-10 rounded-lg" onClick={() => setStatusFilter("ALL")}>
                            All Orders
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="h-10 rounded-lg text-emerald-600" onClick={() => setStatusFilter("PAID")}>
                            Paid
                        </DropdownMenuItem>
                        <DropdownMenuItem className="h-10 rounded-lg text-blue-600" onClick={() => setStatusFilter("PENDING")}>
                            Pending
                        </DropdownMenuItem>
                        <DropdownMenuItem className="h-10 rounded-lg text-amber-600" onClick={() => setStatusFilter("PARTIAL")}>
                            Partial
                        </DropdownMenuItem>
                        <DropdownMenuItem className="h-10 rounded-lg text-red-600" onClick={() => setStatusFilter("UNPAID")}>
                            Unpaid
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Orders Table */}
            <main className="flex-1 overflow-hidden px-6 pb-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col overflow-hidden">
                    <div className="overflow-x-auto h-full custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-slate-50/80 backdrop-blur-sm z-10 border-b">
                                <tr>
                                    <th className="px-6 py-4 text-base font-bold text-slate-700">Order ID</th>
                                    <th className="px-6 py-4 text-base font-bold text-slate-700">Table / Mode</th>
                                    <th className="px-6 py-4 text-base font-bold text-slate-700">Items</th>
                                    <th className="px-6 py-4 text-base font-bold text-slate-700">Time</th>
                                    <th className="px-6 py-4 text-base font-bold text-slate-700">Method</th>
                                    <th className="px-6 py-4 text-base font-bold text-slate-700">Created By</th>
                                    <th className="px-6 py-4 text-base font-bold text-slate-700">Total</th>
                                    <th className="px-6 py-4 text-base font-bold text-slate-700">Status</th>
                                    <th className="px-6 py-4 text-base font-bold text-slate-700">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                                                <p className="text-xl font-bold text-slate-500">Loading orders...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-4 opacity-30">
                                                <ShoppingBag className="h-16 w-16" />
                                                <p className="text-xl font-bold">No orders found</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredOrders.map(order => (
                                        <tr
                                            key={order.id}
                                            className="hover:bg-slate-50 transition-colors group cursor-pointer"
                                            onClick={() => handleRowClick(order)}
                                        >
                                            <td className="px-6 py-5">
                                                <span className="font-mono text-[15px] font-semibold text-slate-600">#{order.invoice_number}</span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col">
                                                    <span className="text-base font-bold text-slate-800">
                                                        {order.customer_name || 'Walk-in'}
                                                    </span>
                                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{order.invoice_description || 'Sale'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col gap-0.5 max-w-[180px]">
                                                    {order.items?.slice(0, 2).map((item: any, i: number) => {
                                                        const productName = item.product_name || productsMap[String(item.product)]?.name || `Product #${item.product}`;
                                                        return (
                                                            <span key={i} className="text-sm font-medium text-slate-600 truncate">
                                                                {item.quantity}x {productName}
                                                            </span>
                                                        );
                                                    })}
                                                    {(order.items?.length || 0) > 2 && (
                                                        <span className="text-xs font-bold text-primary">+{order.items.length - 2} more items</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className="text-[15px] font-medium text-slate-500">
                                                    {order.created_at ? format(parseISO(order.created_at), 'hh:mm a') : 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {order.payment_methods?.length > 0 ? (
                                                        order.payment_methods.map((m: string, i: number) => (
                                                            <span key={i} className="text-[11px] font-black px-2 py-0.5 rounded bg-slate-100 text-slate-500 uppercase tracking-tight">
                                                                {m}
                                                            </span>
                                                        ))
                                                    ) : order.payment_status === 'PAID' || order.payment_status === 'PARTIAL' ? (
                                                        <span className="text-[11px] font-black px-2 py-0.5 rounded bg-amber-50 text-amber-600 uppercase tracking-tight">
                                                            {order.payment_status}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] font-bold text-slate-300 italic">UNPAID</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-1.5">
                                                    <User className="h-4 w-4 text-slate-400" />
                                                    <span className="text-sm font-semibold text-slate-600 truncate max-w-[120px]">
                                                        {order.created_by_name || 'Waiter'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className="text-lg font-black text-slate-900">Rs.{parseFloat(order.total_amount).toFixed(2)}</span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-2">
                                                    <StatusBadge
                                                        status={getDisplayStatus(order)}
                                                        className="text-[11px] px-2.5 py-1"
                                                        label={getDisplayStatus(order) === 'waiter-paid' ? `Received by ${order.received_by_waiter_name || 'Waiter'}` : undefined}
                                                    />
                                                    {order.payment_status === 'PAID' && (
                                                        <div className="h-5 w-5 rounded-full bg-success/20 flex items-center justify-center">
                                                            <Check className="h-3 w-3 text-success font-bold" />
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-9 w-9 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100"
                                                        onClick={(e) => handleRowPrint(e, order)}
                                                    >
                                                        <Printer className="h-4 w-4 text-slate-500" />
                                                    </Button>
                                                    {(order.payment_status === 'UNPAID' || order.payment_status === 'PARTIAL') && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-9 w-9 rounded-lg hover:bg-success/5 hover:border-success/20 text-success"
                                                            onClick={(e) => { e.stopPropagation(); handlePayOpen(order); }}
                                                        >
                                                            <CheckCircle2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:text-white">
                                                        <MoreHorizontal className="h-4 w-4 text-slate-400 hover:text-white" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* Order Details / Payment Dialog */}
            <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
                <DialogContent className="max-w-[480px] p-0 overflow-hidden border-none shadow-3xl rounded-[2.5rem]">
                    <div className="bg-white">
                        <div className="p-8 pb-4">
                            <DialogHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <DialogTitle className="text-2xl font-black text-slate-800">Order Details</DialogTitle>
                                        <p className="text-sm text-slate-400 font-medium">#{selectedOrder?.invoice_number} • {selectedOrder?.customer_name || 'Walk-in'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Grand Total</p>
                                        <p className="text-2xl font-black text-primary">Rs.{selectedOrder?.total_amount}</p>
                                    </div>
                                </div>
                            </DialogHeader>
                        </div>

                        {/* Tabs */}
                        <div className="px-8 flex border-b">
                            <button
                                onClick={() => setActiveTab("payment")}
                                className={cn(
                                    "flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-all",
                                    activeTab === "payment" ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-600"
                                )}
                            >
                                <Banknote className="h-4 w-4" />
                                Payment
                            </button>
                            <button
                                onClick={() => setActiveTab("items")}
                                className={cn(
                                    "flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-all",
                                    activeTab === "items" ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-600"
                                )}
                            >
                                <FileText className="h-4 w-4" />
                                Order Items
                            </button>
                        </div>

                        <div className="p-8 pt-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            {activeTab === "payment" ? (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                                        <div className="space-y-1">
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Paid Amount</p>
                                            <p className="text-xl font-black text-emerald-600">Rs.{selectedOrder?.paid_amount || 0}</p>
                                        </div>
                                        <div className="space-y-1 text-right">
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Due Balance</p>
                                            <p className="text-xl font-black text-slate-800">Rs.{selectedOrder?.due_amount || (selectedOrder ? (selectedOrder.total_amount - (selectedOrder.paid_amount || 0)) : 0)}</p>
                                        </div>
                                    </div>

                                    {(selectedOrder?.received_by_waiter_name || selectedOrder?.received_by_counter_name) && (
                                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Payment Receipt Log</p>
                                            <div className="flex justify-between items-center text-xs">
                                                {selectedOrder?.received_by_waiter_name && (
                                                    <div className="flex flex-col">
                                                        <span className="text-slate-400 font-medium">Waiter Handled:</span>
                                                        <span className="font-bold text-indigo-600">{selectedOrder.received_by_waiter_name}</span>
                                                    </div>
                                                )}
                                                {selectedOrder?.received_by_counter_name && (
                                                    <div className="flex flex-col text-right">
                                                        <span className="text-slate-400 font-medium">Counter Received:</span>
                                                        <span className="font-bold text-emerald-600">{selectedOrder.received_by_counter_name}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {(selectedOrder?.payment_status !== 'PAID' && parseFloat(selectedOrder?.due_amount || "0") > 0) ? (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Amount to Pay</Label>
                                                <div className="relative">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-300">Rs.</span>
                                                    <Input
                                                        type="number"
                                                        className="h-16 text-3xl font-black text-center border-2 border-primary/20 focus:border-primary rounded-2xl pl-10"
                                                        value={paymentAmount}
                                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Payment Method</Label>
                                                <div className="grid grid-cols-3 gap-3">
                                                    {[
                                                        { id: 'CASH', icon: Banknote, label: 'Cash' },
                                                        { id: 'QR', icon: QrCode, label: 'QR' },
                                                        { id: 'ONLINE', icon: CreditCard, label: 'Online' }
                                                    ].map((method) => (
                                                        <button
                                                            key={method.id}
                                                            onClick={() => setPaymentMethod(method.id as any)}
                                                            className={cn(
                                                                "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-1",
                                                                paymentMethod === method.id ? "border-primary bg-primary/5 text-primary shadow-sm" : "border-slate-100 text-slate-400 hover:border-slate-200"
                                                            )}
                                                        >
                                                            <method.icon className="h-6 w-6" />
                                                            <span className="text-[10px] font-black uppercase tracking-tighter">{method.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Internal Notes</Label>
                                                <Input
                                                    placeholder="Add any internal payment notes..."
                                                    className="h-12 rounded-xl"
                                                    value={paymentNotes}
                                                    onChange={(e) => setPaymentNotes(e.target.value)}
                                                />
                                            </div>

                                            <Button
                                                className="w-full h-16 rounded-[1.5rem] font-black text-xl gradient-warm shadow-xl shadow-primary/20"
                                                onClick={handlePaymentSubmit}
                                                disabled={isPaying}
                                            >
                                                {isPaying ? <Loader2 className="h-6 w-6 animate-spin" /> : "Receive Payment"}
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="py-10 text-center space-y-6 bg-emerald-50 rounded-[2rem] border border-emerald-100 animate-in zoom-in-95">
                                            <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                                                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                                            </div>
                                            <div className="px-6">
                                                <p className="text-xl font-black text-emerald-800">Fully Paid</p>
                                                <p className="text-sm text-emerald-600 font-medium">This order is fully paid by the customer.</p>

                                                {selectedOrder?.received_by_waiter && !selectedOrder?.received_by_counter && (
                                                    <div className="mt-6 pt-6 border-t border-emerald-100 space-y-4">
                                                        {selectedOrder.payment_methods?.includes('QR') ? (
                                                            <>
                                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700/50">Online Payment Received</p>
                                                                <p className="text-xs text-emerald-700 font-bold italic">This order was paid via QR. Click below to verify and finalize receipt at the counter.</p>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700/50">Cash Handover Required</p>
                                                                <p className="text-xs text-emerald-700 font-bold italic">Wait! The waiter ({selectedOrder.received_by_waiter_name}) still has this cash. Click below once you receive it at the counter.</p>
                                                            </>
                                                        )}
                                                        <Button
                                                            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 font-bold rounded-xl shadow-lg"
                                                            onClick={() => {
                                                                const method = selectedOrder.payment_methods?.includes('QR') ? 'QR' : 'CASH';
                                                                setPaymentMethod(method as any);
                                                                setPaymentAmount("0");
                                                                // Small timeout to ensure state is updated
                                                                setTimeout(() => handlePaymentSubmit(), 50);
                                                            }}
                                                            disabled={isPaying}
                                                        >
                                                            {isPaying ? <Loader2 className="h-4 w-4 animate-spin" /> : (selectedOrder.payment_methods?.includes('QR') ? "Finalize Receipt" : "Confirm Handover to Counter")}
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                                    <div className="space-y-3">
                                        {selectedOrder?.items?.map((item: any, idx: number) => {
                                            const productName = item.product_name || productsMap[String(item.product)]?.name || `Product #${item.product}`;
                                            return (
                                                <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center font-black text-primary border border-slate-100">
                                                            {item.quantity}x
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-800">{productName}</p>
                                                            <p className="text-[10px] text-slate-400 font-bold">Rs.{item.unit_price} / unit</p>
                                                        </div>
                                                    </div>
                                                    <p className="font-black text-slate-900">Rs.{(parseFloat(item.unit_price) * item.quantity).toFixed(2)}</p>
                                                </div>
                                            );
                                        })}
                                        {(!selectedOrder?.items || selectedOrder.items.length === 0) && (
                                            <div className="text-center py-10 text-slate-300">
                                                <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
                                                <p className="font-bold">No items found</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-4 border-t border-dashed space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400 font-bold">Subtotal</span>
                                            <span className="font-bold text-slate-600">Rs.{(parseFloat(selectedOrder?.total_amount || 0) - parseFloat(selectedOrder?.tax_amount || 0)).toFixed(2)}</span>
                                        </div>
                                        {parseFloat(selectedOrder?.tax_amount || 0) > 0 && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-400 font-bold">Tax</span>
                                                <span className="font-bold text-slate-600">Rs.{parseFloat(selectedOrder?.tax_amount || 0).toFixed(2)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center pt-2">
                                            <span className="text-lg font-black text-slate-800">Grand Total</span>
                                            <span className="text-2xl font-black text-primary">Rs.{selectedOrder?.total_amount}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <Button variant="outline" className="h-14 rounded-2xl font-black gap-2 border-2" onClick={() => { setAutoPrint(true); setShowReceipt(true); }}>
                                            <Printer className="h-5 w-5" />
                                            POS Print
                                        </Button>
                                        <Button className="h-14 rounded-2xl font-black gap-2 gradient-warm" onClick={() => setShowReceipt(true)}>
                                            <FileText className="h-5 w-5" />
                                            View Bill
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-8 pt-0 flex gap-4">
                            <Button variant="ghost" className="h-12 flex-1 rounded-xl font-bold text-slate-400" onClick={() => setShowDetailModal(false)}>Close</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Receipt View logic updated for professional thermal look */}
            <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
                <DialogContent className="max-w-[400px] w-[95vw] p-0 border-none bg-transparent shadow-none overflow-visible max-h-[95vh] flex flex-col">
                    <DialogTitle className="sr-only">Digital Receipt</DialogTitle>
                    <div className="flex justify-end mb-2 no-print">
                        <button
                            onClick={() => setShowReceipt(false)}
                            className="h-10 w-10 flex items-center justify-center rounded-full bg-slate-900/80 text-white backdrop-blur-sm shadow-xl z-50 transition-all active:scale-95"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl overflow-y-auto shadow-2xl relative custom-scrollbar flex flex-col">
                        <div className="no-print p-4 bg-slate-50 border-b flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-500 uppercase">Receipt Preview</span>
                            <Button size="sm" onClick={() => handlePrint()} className="h-8 text-xs font-bold px-4">
                                <Printer className="h-3.5 w-3.5 mr-1.5" />
                                Print
                            </Button>
                        </div>
                        <div className="thermal-receipt printable-receipt" id="bill-print-root">
                            <div className="thermal-header">
                                <h1 className="thermal-title">AMA BAKERY</h1>
                                <div className="thermal-subtitle">Tel: 9816020731</div>
                            </div>

                            <div className="thermal-divider"></div>

                            <div className="thermal-info-grid">
                                <div className="thermal-info-left">
                                    <div>INV: #{selectedOrder?.invoice_number}</div>
                                    <div>DATE: {selectedOrder?.created_at ? format(parseISO(selectedOrder.created_at), 'dd/MM/yyyy HH:mm') : new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                                </div>
                                <div className="thermal-info-right">
                                    <div>CSHR: {currentUser?.name || "Counter"}</div>
                                    <div>CUST: {selectedOrder?.customer_name || "Walk-in"}</div>
                                </div>
                            </div>

                            <div className="thermal-divider"></div>

                            <div className="receipt-item-grid" style={{ fontWeight: 'bold' }}>
                                <div>SN</div>
                                <div>ITEM</div>
                                <div>QTY</div>
                                <div style={{ textAlign: 'right' }}>TOTAL</div>
                            </div>

                            <div className="thermal-divider"></div>

                            {selectedOrder?.items?.map((item: any, idx: number) => {
                                const productName = item.product_name || productsMap[String(item.product)]?.name || `Product #${item.product}`;
                                return (
                                    <div key={idx} className="receipt-item-grid">
                                        <div>{idx + 1}</div>
                                        <div>
                                            {productName}
                                            {item.description && <div style={{ fontSize: '8pt', textTransform: 'none', marginTop: '1mm' }}>"{item.description}"</div>}
                                        </div>
                                        <div>{item.quantity}</div>
                                        <div style={{ textAlign: 'right' }}>{(parseFloat(item.unit_price) * item.quantity).toFixed(2)}</div>
                                    </div>
                                );
                            })}

                            <div className="thermal-divider"></div>

                            <div style={{ fontSize: '10pt', lineHeight: '1.5' }}>
                                <div className="thermal-row">
                                    <span>SUBTOTAL</span>
                                    <span>{(parseFloat(selectedOrder?.total_amount || 0) - parseFloat(selectedOrder?.tax_amount || 0) + parseFloat(selectedOrder?.discount || 0)).toFixed(2)}</span>
                                </div>
                                {parseFloat(selectedOrder?.tax_amount || 0) > 0 && (
                                    <div className="thermal-row">
                                        <span>TAX</span>
                                        <span>{parseFloat(selectedOrder?.tax_amount || 0).toFixed(2)}</span>
                                    </div>
                                )}
                                {parseFloat(selectedOrder?.discount || 0) > 0 && (
                                    <div className="thermal-row text-red-600 font-bold">
                                        <span>DISCOUNT</span>
                                        <span>-{parseFloat(selectedOrder?.discount || 0).toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="thermal-divider"></div>
                                <div className="thermal-total-row">
                                    <span>TOTAL</span>
                                    <span>{selectedOrder?.total_amount}</span>
                                </div>
                                <div className="thermal-divider"></div>
                                <div className="thermal-row">
                                    <span>STATUS</span>
                                    <span>{selectedOrder?.payment_status}</span>
                                </div>
                                <div className="thermal-divider"></div>
                                
                                <div className="thermal-row" style={{ fontSize: '9pt', opacity: 0.8 }}>
                                    <span>PAID AMOUNT</span>
                                    <span>{parseFloat(selectedOrder?.paid_amount || 0).toFixed(2)}</span>
                                </div>
                                {parseFloat(selectedOrder?.due_amount) > 0 && (
                                    <div className="thermal-row" style={{ fontSize: '9pt', fontWeight: 'bold' }}>
                                        <span>BALANCE DUE</span>
                                        <span>{parseFloat(selectedOrder?.due_amount).toFixed(2)}</span>
                                    </div>
                                )}
                            </div>

                            <div className="thermal-footer">
                                THANK YOU FOR YOUR VISIT!
                            </div>
                            <div className="thermal-barcode">
                                *AMA-POS-BILL*
                            </div>
                            <div className="thermal-branding">
                                POS-BY: nishchalacharya.com.np
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
