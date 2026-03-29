import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
    const [statusFilter, setStatusFilter] = useState<"ALL" | "PAID" | "UNPAID" | "PARTIAL" | "PENDING" | "WAITER RECEIVED">("ALL");

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

    // Global Keyboard State
    const [showKeypad, setShowKeypad] = useState(false);
    const [activeKeypadField, setActiveKeypadField] = useState<'search' | 'payment' | null>(null);
    const keyboardRef = useRef<HTMLDivElement>(null);
    const backspaceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const backspaceIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const stopBackspace = () => {
        if (backspaceTimeoutRef.current) clearTimeout(backspaceTimeoutRef.current);
        if (backspaceIntervalRef.current) clearInterval(backspaceIntervalRef.current);
        backspaceTimeoutRef.current = null;
        backspaceIntervalRef.current = null;
    };

    const deleteWord = (text: string) => {
        const trimmed = text.trimEnd();
        const lastSpace = trimmed.lastIndexOf(' ');
        if (lastSpace === -1) return '';
        return trimmed.slice(0, lastSpace);
    };

    useEffect(() => {
        if (showReceipt && autoPrint) {
            const timer = setTimeout(() => {
                // window.print(); // Disabled system print
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


    // WebSocket: auto-refresh when invoice created or status updated
    useOrdersWebSocket(
        useCallback(
            (data) => {
                if (data.type === "invoice_created") {
                    // New order - auto-refresh list
                    loadInvoices();
                } else if (data.type === "invoice_updated" && data.status === "READY") {
                    // Order ready - auto-refresh list
                    loadInvoices();
                } else if (data.type === "invoice_updated") {
                    loadInvoices();
                }
            },
            [loadInvoices]
        )
    );

    const handlePayOpen = (order: any) => {
        setSelectedOrder(order);
        setPaymentAmount(order.due_amount || (order.total_amount - (order.paid_amount || 0)));
        
        // Pick a sensitive default for waiter-handled orders
        if (order.received_by_waiter && !order.received_by_counter && order.payment_methods?.length > 0) {
            setPaymentMethod(order.payment_methods[0] as any);
        } else {
            setPaymentMethod("CASH");
        }
        
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
        
        // Pick a sensitive default for waiter-handled orders
        if (order.received_by_waiter && !order.received_by_counter && order.payment_methods?.length > 0) {
            setPaymentMethod(order.payment_methods[0] as any);
        } else {
            setPaymentMethod("CASH");
        }
        
        setPaymentNotes("");
        setActiveTab(order.payment_status === 'PAID' ? "items" : "payment");
        setShowDetailModal(true);
    };

    const handlePaymentSubmit = async () => {
        if (!selectedOrder) return;

        const currentDue = parseFloat(selectedOrder?.due_amount || (selectedOrder ? (selectedOrder.total_amount - (selectedOrder.paid_amount || 0)) : 0));

        // Allow 0 amount if we are just confirming waiter handover
        const isConfirmingHandover = (selectedOrder.payment_status === 'PAID' || selectedOrder.payment_status === 'PARTIAL' || selectedOrder.payment_status === 'WAITER RECEIVED') && selectedOrder.received_by_waiter && !selectedOrder.received_by_counter && currentDue <= 0;

        if (!isConfirmingHandover && (!paymentAmount || parseFloat(paymentAmount) <= 0)) {
            toast.error("Please enter a valid amount");
            return;
        }

        setIsPaying(true);
        try {
            // Cap the payment amount at the actual due amount for database accuracy
            const actualPayment = Math.min(parseFloat(paymentAmount), currentDue);

            await addPayment(selectedOrder.id, {
                amount: isConfirmingHandover ? 0 : actualPayment,
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
    </div>
    <div class="thermal-branding">
        POS-BY: DragUpTech
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
                (order.invoice_description?.toLowerCase() || "").includes(query) ||
                (order.created_by_name?.toLowerCase() || "").includes(query) ||
                (order.items || []).some((item: any) => {
                    const productName = item.product_name || productsMap[String(item.product)]?.name || "";
                    return productName.toLowerCase().includes(query);
                })
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
                        onFocus={() => {
                            setActiveKeypadField('search');
                            setShowKeypad(true);
                        }}
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
                        <DropdownMenuItem className="h-10 rounded-lg text-indigo-600" onClick={() => setStatusFilter("WAITER RECEIVED")}>
                            Waiter Received
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
                                                        {(() => {
                                                            const tableMatch = (order.description || order.invoice_description || "").match(/Table (\d+)/);
                                                            const tableNo = order.table_no || (tableMatch ? tableMatch[1] : null);
                                                            return tableNo ? `Table ${tableNo}` : "Takeaway";
                                                        })()}
                                                    </span>
                                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{order.customer_name || 'Walk-in'}</span>
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
                                                        (() => {
                                                            // If waiter ever handled it, prioritize QR then first method for single view
                                                            if (order.received_by_waiter) {
                                                                const hasQR = order.payment_methods.some((m: string) => m.toUpperCase() === 'QR');
                                                                const displayMethod = hasQR ? 'QR' : order.payment_methods[0];
                                                                return (
                                                                    <span className="text-[11px] font-black px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 uppercase tracking-tight border border-indigo-100">
                                                                        {displayMethod}
                                                                    </span>
                                                                );
                                                            }
                                                            return order.payment_methods.map((m: string, i: number) => (
                                                                <span key={i} className="text-[11px] font-black px-2 py-0.5 rounded bg-slate-100 text-slate-500 uppercase tracking-tight">
                                                                    {m}
                                                                </span>
                                                            ));
                                                        })()
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

            {/* Order Details / Payment Dialog - Non-modal to allow external keyboard */}
            <Dialog open={showDetailModal} onOpenChange={setShowDetailModal} modal={false}>
                {showDetailModal && (
                    <div 
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[40] animate-in fade-in duration-300" 
                        onClick={() => !showKeypad && setShowDetailModal(false)}
                    />
                )}
                <DialogContent 
                    onInteractOutside={(e) => {
                        const target = e.target as HTMLElement;
                        if (target?.closest('.global-keyboard') || target?.closest('.keyboard-backdrop')) {
                            e.preventDefault();
                        }
                    }}
                    className="max-w-[480px] p-0 overflow-hidden border-none shadow-3xl rounded-[2.5rem] z-[50]"
                >
                    <div className="bg-white">
                        <div className="p-6 pb-2">
                            <DialogHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <DialogTitle className="text-2xl font-black text-slate-800">Order Details</DialogTitle>
                                            {(() => {
                                                const tableMatch = (selectedOrder?.description || selectedOrder?.invoice_description || "").match(/Table (\d+)/);
                                                const tableNo = selectedOrder?.table_no || (tableMatch ? tableMatch[1] : null);
                                                return tableNo && (
                                                    <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                                                        Table {tableNo}
                                                    </span>
                                                );
                                            })()}
                                        </div>
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
                        <div className="px-6 flex border-b">
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

                        <div className="p-6 pt-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
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
                                    )}                                    {(selectedOrder?.payment_status !== 'PAID' && parseFloat(selectedOrder?.due_amount || "0") > 0) ? (() => {
                                        const currentDue = parseFloat(selectedOrder?.due_amount || (selectedOrder ? (selectedOrder.total_amount - (selectedOrder.paid_amount || 0)) : 0));
                                        const changeAmount = Math.max(0, parseFloat(paymentAmount || "0") - currentDue);

                                        return (
                                            <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Amount to Pay</Label>
                                                    <div className="relative">
                                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-300">Rs.</span>
                                                        <Input
                                                            type="number"
                                                            max="1000000"
                                                            className="h-16 text-3xl font-black text-center border-2 border-primary/20 focus:border-primary rounded-2xl pl-10"
                                                            value={paymentAmount}
                                                            onFocus={() => {
                                                                setActiveKeypadField('payment');
                                                                setShowKeypad(true);
                                                            }}
                                                            onChange={(e) => {
                                                                const val = parseFloat(e.target.value);
                                                                if (val > 1000000) return;
                                                                setPaymentAmount(e.target.value);
                                                            }}
                                                        />
                                                        {changeAmount > 0 && (
                                                            <div className="absolute -bottom-5 right-2 text-emerald-600 font-black text-[15px] animate-in slide-in-from-top-1 fade-in">
                                                                Return: Rs.{changeAmount.toLocaleString()}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Payment Method</Label>
                                                    <div className="grid grid-cols-3 gap-3">
                                                        {[
                                                            { id: 'CASH', icon: Banknote, label: 'Cash' },
                                                            { id: 'QR', icon: QrCode, label: 'QR' },
                                                            { id: 'ONLINE', icon: CreditCard, label: 'Online' }
                                                        ].filter(method => {
                                                            // Detect if waiter ever handled it (Lock to their method)
                                                            if (selectedOrder?.received_by_waiter && selectedOrder.payment_methods?.length > 0) {
                                                                // Compare case-insensitive to be safe
                                                                return selectedOrder.payment_methods.some((m: string) => m.toUpperCase() === method.id.toUpperCase());
                                                            }
                                                            return true;
                                                        }).map((method) => (
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

                                                <Button
                                                    className="w-full h-16 rounded-[1.5rem] font-black text-xl gradient-warm shadow-xl shadow-primary/20"
                                                    onClick={handlePaymentSubmit}
                                                    disabled={isPaying}
                                                >
                                                    {isPaying ? <Loader2 className="h-6 w-6 animate-spin" /> : 
                                                     (selectedOrder?.payment_status === 'WAITER RECEIVED' ? "Confirm & Finalize" : "Receive Payment")}
                                                </Button>
                                            </div>
                                        );
                                    })() : (
                                        <div className="py-4 text-center space-y-3 bg-emerald-50 rounded-[1.5rem] border border-emerald-100 animate-in zoom-in-95">
                                            <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                                                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                                            </div>
                                            <div className="px-4">
                                                <p className="text-lg font-black text-emerald-800 leading-tight">Fully Paid</p>
                                                <p className="text-xs text-emerald-600 font-medium">This order is fully paid by the customer.</p>

                                                {selectedOrder?.received_by_waiter && !selectedOrder?.received_by_counter && (
                                                    <div className="mt-4 pt-4 border-t border-emerald-100 space-y-3">
                                                        {selectedOrder.payment_methods?.includes('QR') ? (
                                                            <p className="text-[11px] text-emerald-700 font-bold italic">Online payment (QR). Finalize receipt at counter.</p>
                                                        ) : (
                                                            <p className="text-[11px] text-emerald-700 font-bold italic">Waiter ({selectedOrder.received_by_waiter_name}) has cash. Confirm once received.</p>
                                                        )}
                                                        <Button
                                                            className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 font-bold rounded-xl shadow-lg"
                                                            onClick={() => {
                                                                const method = selectedOrder.payment_methods?.includes('QR') ? 'QR' : 'CASH';
                                                                setPaymentMethod(method as any);
                                                                setPaymentAmount("0");
                                                                // Small timeout to ensure state is updated
                                                                setTimeout(() => handlePaymentSubmit(), 50);
                                                            }}
                                                            disabled={isPaying}
                                                        >
                                                            {isPaying ? <Loader2 className="h-4 w-4 animate-spin" /> : (selectedOrder.payment_methods?.includes('QR') ? "Finalize Receipt" : "Confirm Handover")}
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
                        <div className="p-6 pt-0 flex gap-4">
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
                            </div>
                            <div className="thermal-branding">
                                POS-BY: DragUpTech
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            {/* Global Floating Virtual Keyboard */}
            {showKeypad && activeKeypadField && (
                <>
                {/* Backdrop Layer to capture outside clicks and block background actions */}
                <div 
                    className="fixed inset-0 z-[999] bg-transparent pointer-events-auto keyboard-backdrop"
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        setShowKeypad(false);
                        (document.activeElement as HTMLElement)?.blur();
                    }}
                />
                <div 
                    ref={keyboardRef as any}
                    onMouseDown={(e) => e.stopPropagation()} // Prevent closing when clicking inside
                    className="global-keyboard fixed bottom-0 left-0 right-0 z-[1000] bg-white/95 backdrop-blur-md border-t-2 border-primary/20 shadow-[0_-15px_40px_-10px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom-full duration-300 p-2 md:p-4 pointer-events-auto"
                >
                    <div className="max-w-7xl mx-auto">
                        <div className="flex items-center justify-between mb-2 px-1">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-primary">
                                    {activeKeypadField === 'payment' ? 'Payment Amount' : 
                                     activeKeypadField === 'search' ? 'Search Orders' : 'Virtual Keyboard'}
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                        if (activeKeypadField === 'search') setSearchQuery("");
                                        else if (activeKeypadField === 'payment') setPaymentAmount("");
                                    }}
                                    className="h-7 px-2 text-[9px] font-black uppercase text-slate-400 hover:text-destructive"
                                >
                                    Clear
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="icon"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                        setShowKeypad(false);
                                        (document.activeElement as HTMLElement)?.blur();
                                    }}
                                    className="h-6 w-6 rounded-full shadow-inner"
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>

                        {/* Keyboard Layouts */}
                        {(activeKeypadField === 'search') ? (
                            <div className="space-y-1 select-none">
                                {[
                                    '1234567890',
                                    'QWERTYUIOP',
                                    'ASDFGHJKL',
                                    'ZXCVBNM'
                                ].map((row, rIdx) => (
                                    <div key={rIdx} className="flex justify-center gap-1">
                                        {row.split('').map(char => (
                                            <Button
                                                key={char}
                                                variant="outline"
                                                onMouseDown={(e) => e.preventDefault()}
                                                className="h-12 md:h-16 min-w-[40px] md:min-w-[85px] flex-1 md:flex-none text-sm md:text-xl font-black rounded-xl border shadow-sm active:scale-95 bg-white hover:border-primary/40 transition-all p-0"
                                                onClick={() => {
                                                    setSearchQuery(prev => prev + char);
                                                }}
                                            >
                                                {char}
                                            </Button>
                                        ))}
                                        {rIdx === 3 && (
                                            <Button
                                                variant="outline"
                                                className="h-12 md:h-16 px-6 md:px-12 text-sm md:text-xl font-black rounded-xl border-2 border-primary/20 bg-primary/5 text-primary active:scale-95"
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    // Initial character delete
                                                    setSearchQuery(prev => prev.slice(0, -1));
                                                    
                                                    stopBackspace();
                                                    backspaceTimeoutRef.current = setTimeout(() => {
                                                        backspaceIntervalRef.current = setInterval(() => {
                                                            setSearchQuery(prev => deleteWord(prev));
                                                        }, 150);
                                                    }, 400);
                                                }}
                                                onMouseUp={stopBackspace}
                                                onMouseLeave={stopBackspace}
                                                onTouchEnd={stopBackspace}
                                            >
                                                ⌫
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                <div className="flex justify-center gap-1.5 mt-1">
                                    <Button
                                        variant="outline"
                                        onMouseDown={(e) => e.preventDefault()}
                                        className="h-12 md:h-16 flex-1 max-w-[800px] text-xs md:text-sm font-black rounded-xl border bg-slate-50 active:scale-95 uppercase tracking-widest shadow-inner"
                                        onClick={() => {
                                            setSearchQuery(prev => prev + " ");
                                        }}
                                    >
                                        Space
                                    </Button>
                                    <Button
                                        onMouseDown={(e) => e.preventDefault()}
                                        className="h-12 md:h-16 px-10 md:px-20 text-xs md:text-sm font-black rounded-xl bg-primary text-white shadow-lg active:scale-95 uppercase tracking-widest"
                                        onClick={() => {
                                        setShowKeypad(false);
                                        (document.activeElement as HTMLElement)?.blur();
                                    }}
                                    >
                                        Done
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="max-w-[360px] md:max-w-md mx-auto grid grid-cols-3 gap-3 md:gap-4">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, "00", 0, "⌫"].map((key) => (
                                    <Button
                                        key={key.toString()}
                                        variant="outline"
                                        onMouseDown={(e) => e.stopPropagation()}
                                        className={cn(
                                            "h-14 md:h-16 text-xl md:text-3xl font-black rounded-2xl transition-all active:scale-90 bg-white hover:bg-slate-50 border-2 shadow-sm p-0",
                                            key === "⌫" ? "text-destructive border-destructive/20 bg-destructive/5" : "hover:border-primary/40"
                                        )}
                                        onClick={() => {
                                            if (activeKeypadField === 'payment') {
                                                if (key === "⌫") setPaymentAmount(prev => (prev.toString().length > 0 ? prev.toString().slice(0, -1) : ""));
                                                else if (key === "00") setPaymentAmount(prev => {
                                                    const newVal = `${prev}00`;
                                                    return parseFloat(newVal) <= 1000000 ? newVal : prev;
                                                });
                                                else setPaymentAmount(prev => {
                                                    // If prev is "0" or the field was just pre-filled (numeric type), we might want to replace,
                                                    // but for now let's just ensure string concatenation.
                                                    const current = prev.toString();
                                                    const newVal = current === "0" ? key.toString() : `${current}${key}`;
                                                    return parseFloat(newVal) <= 1000000 ? newVal : prev;
                                                });
                                            }
                                        }}
                                    >
                                        {key}
                                    </Button>
                                ))}
                                <Button
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="col-span-3 h-14 md:h-16 text-base md:text-xl font-black rounded-2xl bg-primary text-white shadow-xl active:scale-95 uppercase tracking-widest mt-2"
                                    onClick={() => {
                                        setShowKeypad(false);
                                        (document.activeElement as HTMLElement)?.blur();
                                    }}
                                >
                                    Confirm
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
                </>
            )}
        </div>
    );
}
