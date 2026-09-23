import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search,
  Filter,
  Download,
  Eye,
  Loader2,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  Trash2,
  MoveRight,
  ShoppingBag,
  Banknote,
  QrCode,
  CreditCard,
  Wallet,
  CheckCircle2,
  Printer,
  FileText,
  Check,
  User,
  X
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { fetchInvoices, fetchProducts, fetchBranches, fetchBranch, fetchInvoiceDetail, patchInvoice, addPayment } from "@/api/index.js";
import { toast } from "sonner";
import { getCurrentUser } from "@/auth/auth";
import { useOrdersWebSocket } from "@/hooks/useOrdersWebSocket";

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [productsMap, setProductsMap] = useState<Record<string, any>>({});
  const [branchesMap, setBranchesMap] = useState<Record<string, any>>({});
  const [branchInfo, setBranchInfo] = useState<any>(null);
  const [isFetchingDetail, setIsFetchingDetail] = useState(false);
  const [showPopupItems, setShowPopupItems] = useState(true);
  const [isUpdatingItem, setIsUpdatingItem] = useState(false);
  const [showAddItemsModal, setShowAddItemsModal] = useState(false);
  const [showTransferTableModal, setShowTransferTableModal] = useState(false);
  const [newTableNo, setNewTableNo] = useState("");
  const [isTransferringTable, setIsTransferringTable] = useState(false);
  const [tempAddedItems, setTempAddedItems] = useState<{ product: any, quantity: number }[]>([]);
  const [addItemsSearch, setAddItemsSearch] = useState("");

  // Payment States
  const [activeTab, setActiveTab] = useState<"payment" | "items">("payment");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "ONLINE" | "QR" | "CARD">("CASH");
  const [paymentNotes, setPaymentNotes] = useState<string>("");
  const [isPaying, setIsPaying] = useState<boolean>(false);

  // Helper to parse dates with space format
  const parseSafeDate = (dateStr: string) => {
    if (!dateStr) return null;
    try {
      const formatted = dateStr.replace(' ', 'T');
      return parseISO(formatted);
    } catch {
      return new Date(dateStr);
    }
  };

  // Pagination state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const currentUser = getCurrentUser();
  const branchId = currentUser?.branch_id ?? null;

  // Handle initial metadata load
  useEffect(() => {
    loadProducts();
    loadBranches();
    if (branchId) {
      fetchBranch(branchId).then(data => {
        if (data?.success) setBranchInfo(data.data);
        else if (data?.data) setBranchInfo(data.data);
        else if (data) setBranchInfo(data);
      }).catch(err => {
        console.error("Failed to fetch branch info:", err);
      });
    }
  }, [branchId]);

  // Real-time WebSocket sync for orders and payments
  const wsRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleWSUpdate = useCallback((data: any) => {
    if (wsRefreshTimerRef.current) clearTimeout(wsRefreshTimerRef.current);
    wsRefreshTimerRef.current = setTimeout(() => {
      loadInvoices(1, false);
      if (selectedOrder && (String(data?.invoice_id) === String(selectedOrder.id))) {
        fetchInvoiceDetail(selectedOrder.id).then(detail => {
          setSelectedOrder(detail);
        }).catch(err => console.error("Failed to update selected invoice via WS:", err));
      }
    }, 500);
  }, [selectedOrder]);

  useOrdersWebSocket(handleWSUpdate, branchId);

  useEffect(() => {
    return () => {
      if (wsRefreshTimerRef.current) clearTimeout(wsRefreshTimerRef.current);
    };
  }, []);

  // Handle invoice loading and filter changes
  useEffect(() => {
    // Debounce search term changes, but trigger date changes immediately
    const delay = searchTerm ? 500 : 0;
    const timer = setTimeout(() => {
      loadInvoices(1, true);
    }, delay);

    return () => clearTimeout(timer);
  }, [branchId, dateFilter, searchTerm]);

  const loadProducts = async () => {
    try {
      const data = await fetchProducts();
      // data is an array here (fetchProducts returns data.data)
      if (Array.isArray(data)) {
        const map = data.reduce((acc: any, p: any) => {
          acc[String(p.id)] = p;
          return acc;
        }, {});
        setProductsMap(map);
      }
    } catch (err) {
      console.error("Failed to load products for mapping", err);
    }
  };

  const loadBranches = async () => {
    try {
      const data = await fetchBranches();
      // fetchBranches returns data.data (array)
      if (Array.isArray(data)) {
        const map = data.reduce((acc: any, b: any) => {
          acc[String(b.id)] = b;
          return acc;
        }, {});
        setBranchesMap(map);
      }
    } catch (err) {
      console.error("Failed to load branches for mapping", err);
    }
  };

  const loadInvoices = async (pageNumber: number = 1, isReset: boolean = false) => {
    if (isReset) {
      setLoading(true);
      setPage(1);
    } else {
      setLoadingMore(true);
    }

    try {
      const params: any = {
        page: pageNumber,
      };

      // Add other filters if backend supports them (or for future-proofing)
      // Search and date filters are handled by the server
      if (searchTerm) params.search = searchTerm;
      if (dateFilter) params.date = dateFilter;
      if (branchId) params.branch = branchId;

      const data = await fetchInvoices(params);

      let results = [];
      let nextUrl = null;
      let count = 0;

      // Handle paginated response
      if (data && typeof data === 'object' && 'results' in data) {
        results = data.results;
        nextUrl = data.next;
        count = data.count || 0;
      } else if (Array.isArray(data)) {
        // Fallback for non-paginated response
        results = data;
        count = data.length;
      }

      const scoped = branchId != null
        ? results.filter((o: any) => o.branch === branchId || o.branch_id === branchId)
        : results;

      if (isReset) {
        setOrders(scoped);
      } else {
        setOrders(prev => [...prev, ...scoped]);
      }

      setHasMore(!!nextUrl);
      setTotalCount(count);
      if (!isReset) setPage(pageNumber);

    } catch (err: any) {
      toast.error(err.message || "Failed to load invoices");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSearchKeyDown = async (e: any) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const term = searchTerm.trim();
      if (!term) return;

      // Loose check for invoice-like format (e.g. 04-2026-...) or common search terms
      setIsFetchingDetail(true);
      try {
        const res = await fetchInvoices({ search: term });
        const results = res.results || res;

        // Try to find an exact invoice number match in the results
        const exactMatch = results.find((o: any) =>
          o.invoice_number.toLowerCase() === term.toLowerCase()
        );

        if (exactMatch) {
          handleRowClick(exactMatch);
          // Also update the list with these search results to keep them in sync
          setOrders(results);
          setTotalCount(res.count || results.length);
          setHasMore(!!res.next);
          return;
        }
      } catch (err) {
        console.error("Direct invoice lookup failed:", err);
      } finally {
        setIsFetchingDetail(false);
      }

      // Default: immediate search for other terms/if no exact invoice match
      loadInvoices(1, true);
    }
  };

  const handleRowClick = async (order: any) => {
    setSelectedOrder(order); // Show partial info immediately
    const due = parseFloat(order.due_amount ?? (order.total_amount - (order.paid_amount || 0)));
    setPaymentAmount(due > 0 ? String(due) : "");
    if (order.received_by_waiter && !order.received_by_counter && (order.payment_methods_list || order.payment_methods || []).length > 0) {
      setPaymentMethod((order.payment_methods_list || order.payment_methods || [])[0] as any);
    } else {
      setPaymentMethod("CASH");
    }
    setPaymentNotes("");
    setActiveTab((order.payment_status === 'PAID' || due <= 0) ? "items" : "payment");
    setIsFetchingDetail(true);
    try {
      const fullDetail = await fetchInvoiceDetail(order.id);
      setSelectedOrder(fullDetail);
      const fullDue = parseFloat(fullDetail.due_amount ?? (fullDetail.total_amount - (fullDetail.paid_amount || 0)));
      if (fullDue > 0) {
        setPaymentAmount(String(fullDue));
      }
    } catch (err: any) {
      console.error("Failed to fetch invoice details:", err);
    } finally {
      setIsFetchingDetail(false);
    }
  };

  const handlePayOpen = async (order: any) => {
    setSelectedOrder(order);
    const due = parseFloat(order.due_amount ?? (order.total_amount - (order.paid_amount || 0)));
    setPaymentAmount(due > 0 ? String(due) : "");
    if (order.received_by_waiter && !order.received_by_counter && (order.payment_methods_list || order.payment_methods || []).length > 0) {
      setPaymentMethod((order.payment_methods_list || order.payment_methods || [])[0] as any);
    } else {
      setPaymentMethod("CASH");
    }
    setPaymentNotes("");
    setActiveTab("payment");
    setIsFetchingDetail(true);
    try {
      const fullDetail = await fetchInvoiceDetail(order.id);
      setSelectedOrder(fullDetail);
      const fullDue = parseFloat(fullDetail.due_amount ?? (fullDetail.total_amount - (fullDetail.paid_amount || 0)));
      if (fullDue > 0) {
        setPaymentAmount(String(fullDue));
      }
    } catch (err: any) {
      console.error("Failed to fetch invoice details:", err);
    } finally {
      setIsFetchingDetail(false);
    }
  };

  const handlePaymentSubmit = async () => {
    if (!selectedOrder) return;

    const currentDue = parseFloat(
      selectedOrder?.due_amount ?? (selectedOrder ? (selectedOrder.total_amount - (selectedOrder.paid_amount || 0)) : 0)
    );

    const isConfirmingHandover =
      (selectedOrder.payment_status === 'PAID' ||
        selectedOrder.payment_status === 'PARTIAL' ||
        selectedOrder.payment_status === 'WAITER RECEIVED') &&
      selectedOrder.received_by_waiter &&
      !selectedOrder.received_by_counter &&
      currentDue <= 0;

    const enteredAmount = parseFloat(paymentAmount);

    if (!isConfirmingHandover && (!paymentAmount || isNaN(enteredAmount) || enteredAmount <= 0)) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsPaying(true);
    try {
      const actualPayment = isConfirmingHandover ? 0 : Math.min(enteredAmount, currentDue);

      await addPayment(selectedOrder.id, {
        amount: actualPayment,
        payment_method: paymentMethod,
        notes: paymentNotes || undefined
      });

      toast.success("Payment added successfully");

      const fullDetail = await fetchInvoiceDetail(selectedOrder.id);
      setSelectedOrder(fullDetail);
      const remainingDue = parseFloat(fullDetail.due_amount ?? (fullDetail.total_amount - (fullDetail.paid_amount || 0)));
      setPaymentAmount(remainingDue > 0 ? String(remainingDue) : "");
      setPaymentNotes("");

      loadInvoices(page, false);
    } catch (err: any) {
      toast.error(err.message || "Failed to process payment");
    } finally {
      setIsPaying(false);
    }
  };

  const handlePrint = (orderToPrint?: any) => {
    const order = orderToPrint || selectedOrder;
    if (!order) return;

    const branch = branchInfo || branchesMap[order.branch || order.branch_id] || {};
    const subtotal = parseFloat(order.total_amount) - parseFloat(order.tax_amount || 0) + parseFloat(order.discount || 0);
    const taxAmount = parseFloat(order.tax_amount || 0);
    const discountAmount = parseFloat(order.discount || 0);
    const total = parseFloat(order.total_amount);

    const itemRows = order.items?.map((item: any, index: number) => {
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
      `;
    }).join("") || "";

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
        @media print {
            @page { size: 80mm auto; margin: 0; }
            body { width: 80mm; padding: 4mm; }
        }
    </style>
</head>
<body>
    <div class="thermal-header">
        <div class="thermal-title">${branch.receipt_header || branch.name || "AMA BAKERY"}</div>
        <div class="thermal-subtitle">Tel: ${branch.phone || "9816020731"}</div>
        ${branch.location ? `<div class="thermal-subtitle">${branch.location.toUpperCase()}</div>` : ""}
    </div>
    
    <div class="thermal-divider"></div>

    <div class="thermal-info-grid">
        <div class="thermal-info-left">
            <div>INV: #${order.invoice_number}</div>
            <div>DATE: ${order.created_at ? format(parseSafeDate(order.created_at)!, 'dd/MM/yyyy HH:mm') : new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <div class="thermal-info-right">
            <div>BY: ${order.created_by_name || currentUser?.username || "Manager"}</div>
            <div>CUST: ${order.customer_name || "Walk-in"}</div>
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
    
    <div>
        <div class="thermal-row">
            <span>SUBTOTAL</span>
            <span>${subtotal.toFixed(2)}</span>
        </div>
        ${taxRow}
        ${discountRow}
        <div class="thermal-total-row">
            <span>TOTAL</span>
            <span>Rs.${total.toFixed(2)}</span>
        </div>
        <div class="thermal-row" style="font-size: 9pt; margin-top: 1mm;">
            <span>STATUS</span>
            <span>${order.payment_status}</span>
        </div>
        <div class="thermal-divider"></div>
        
        <div class="thermal-row" style="font-size: 9pt; opacity: 0.8;">
            <span>PAID AMOUNT</span>
            <span>Rs.${parseFloat(order.paid_amount || 0).toFixed(2)}</span>
        </div>
        ${parseFloat(order.due_amount || 0) > 0 ? `
        <div class="thermal-row" style="font-size: 9pt; font-weight: bold;">
            <span>BALANCE DUE</span>
            <span>Rs.${parseFloat(order.due_amount).toFixed(2)}</span>
        </div>` : ""}
    </div>

    <div class="thermal-footer">
        ${branch.receipt_footer || "THANK YOU FOR YOUR VISIT!"}
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

  const handleRowPrint = async (e: React.MouseEvent, order: any) => {
    e.stopPropagation();
    try {
      const fullDetail = await fetchInvoiceDetail(order.id);
      handlePrint(fullDetail);
    } catch (err) {
      handlePrint(order);
    }
  };

  const handleUpdateQuantity = async (invoiceItemId: number, newQty: number, itemStatus: string) => {
    if (newQty <= 0) {
      handleRemoveItem(invoiceItemId, itemStatus);
      return;
    }

    const isPrepared = itemStatus === "READY" || itemStatus === "COMPLETED";
    const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "SUPER_ADMIN" || currentUser?.is_superuser;
    if (isPrepared && !isAdmin && newQty < selectedOrder.items.find((it: any) => it.id === invoiceItemId)?.quantity) {
      toast.error("This item is already prepared and can't be reduced");
      return;
    }

    setIsUpdatingItem(true);
    try {
      const updatedInvoice = await patchInvoice(selectedOrder.id, {
        update_items: [{ invoice_item_id: invoiceItemId, quantity: newQty }]
      });
      setSelectedOrder(updatedInvoice);
      loadInvoices(page, false);
      toast.success("Quantity updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update quantity");
    } finally {
      setIsUpdatingItem(false);
    }
  };

  const handleRemoveItem = async (invoiceItemId: number, itemStatus: string) => {
    const isPrepared = itemStatus === "READY" || itemStatus === "COMPLETED";
    const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "SUPER_ADMIN" || currentUser?.is_superuser;
    if (isPrepared && !isAdmin) {
      toast.error("This item is already prepared and can't be reduced");
      return;
    }

    if (!window.confirm("Remove this item?")) {
      return;
    }

    setIsUpdatingItem(true);
    try {
      const updatedInvoice = await patchInvoice(selectedOrder.id, {
        remove_items: [invoiceItemId]
      });
      setSelectedOrder(updatedInvoice);
      loadInvoices(page, false);
      toast.success("Item removed");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove item");
    } finally {
      setIsUpdatingItem(false);
    }
  };

  const handleAddItemsSubmit = async () => {
    if (tempAddedItems.length === 0) return;
    setIsUpdatingItem(true);
    try {
      const payload = tempAddedItems.map(item => ({
        product: parseInt(item.product.id || item.product),
        quantity: item.quantity
      }));
      const updatedInvoice = await patchInvoice(selectedOrder.id, {
        add_items: payload
      });
      setSelectedOrder(updatedInvoice);
      loadInvoices(page, false);
      setTempAddedItems([]);
      setShowAddItemsModal(false);
      toast.success("Items added successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to add items");
    } finally {
      setIsUpdatingItem(false);
    }
  };

  const handleTransferTableSubmit = async () => {
    if (!newTableNo) return;
    const tableNum = parseInt(newTableNo);
    if (isNaN(tableNum) || tableNum <= 0) {
      toast.error("Please enter a valid table number");
      return;
    }
    setIsTransferringTable(true);
    try {
      const res = await patchInvoice(selectedOrder.id, {
        transfer_to_table: tableNum
      });
      toast.success(res.message || `Transferred to Table ${tableNum}`);
      setSelectedOrder(res.data || res);
      loadInvoices(page, false);
      setShowTransferTableModal(false);
      setNewTableNo("");
    } catch (err: any) {
      toast.error(err.message || "Failed to transfer table");
    } finally {
      setIsTransferringTable(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadInvoices(page + 1);
    }
  };

  // Status filter operates on the loaded data (client-side)
  const displayOrders = useMemo(() => {
    if (statusFilter === "all") return orders;
    return orders.filter(o =>
      (o.payment_status || "PENDING").toUpperCase() === statusFilter.toUpperCase()
    );
  }, [orders, statusFilter]);

  const handleExport = () => {
    try {
      const exportData = displayOrders.map(order => ({
        'Invoice #': order.invoice_number,
        'Created By': order.created_by_name || 'N/A',
        'Customer': order.customer_name?.trim() || 'Walk-in',
        'Date': order.created_at ? format(parseSafeDate(order.created_at)!, 'MMM d, yyyy h:mm a') : 'N/A',
        'Status': order.payment_status || 'PENDING',
        'Total Amount': `${order.total_amount}`
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");

      // Generate Excel file and trigger download
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], { type: 'application/octet-stream' });
      saveAs(data, `Orders_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

      toast.success("Orders exported successfully!");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export orders. Please try again.");
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Orders</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">View and manage {totalCount > 0 ? `${totalCount} ` : 'all '}orders</p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={displayOrders.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <div className="card-elevated p-3 sm:p-4 flex flex-wrap gap-3 sm:gap-4 items-center">
        <div className="relative flex-1 min-w-full sm:min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="WAITER RECEIVED">Waiter Received</SelectItem>
            <SelectItem value="PARTIAL">Partial</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          className="w-full sm:w-[180px]"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
      </div>

      {/* Orders Table */}
      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-6 py-4 text-left font-medium text-muted-foreground">Invoice #</th>
                <th className="px-6 py-4 text-left font-medium text-muted-foreground">Created By</th>
                <th className="px-6 py-4 text-left font-medium text-muted-foreground">Customer</th>
                <th className="px-6 py-4 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-6 py-4 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-6 py-4 text-right font-medium text-muted-foreground">Amount</th>
                <th className="px-6 py-4 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-8 w-8 text-primary animate-spin" />
                      <p className="text-muted-foreground">Loading invoices...</p>
                    </div>
                  </td>
                </tr>
              ) : displayOrders.map((order) => (
                <tr
                  key={order.id}
                  className="border-t hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => handleRowClick(order)}
                >
                  <td className="px-6 py-4 font-medium">{order.invoice_number}</td>
                  <td className="px-6 py-4">{order.created_by_name}</td>
                  <td className="px-6 py-4">{order.customer_name?.trim() || 'Walk-in'}</td>
                  <td className="px-6 py-4 text-muted-foreground text-sm">
                    {order.created_at ? format(parseSafeDate(order.created_at)!, 'MMM d, h:mm a') : 'N/A'}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge 
                      status={(order.payment_status || 'unpaid').toLowerCase()} 
                      label={
                        (order.payment_status || '').toLowerCase() === 'creadit'
                          ? `Credited by ${order.received_by_counter_name || order.received_by_waiter_name || order.created_by_name || 'User'}`
                          : (order.payment_status || '').toLowerCase() === 'waiter received'
                          ? `Received by ${order.received_by_waiter_name || 'Waiter'}`
                          : undefined
                      }
                    />
                  </td>
                  <td className="px-6 py-4 text-right font-semibold">Rs.{order.total_amount}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Print Receipt"
                        className="h-8 w-8 rounded-lg hover:bg-slate-100 text-slate-500"
                        onClick={(e) => handleRowPrint(e, order)}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      {(order.payment_status === 'UNPAID' || order.payment_status === 'PARTIAL' || order.payment_status === 'WAITER RECEIVED') && (
                        <Button
                          size="sm"
                          className="h-8 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1 shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePayOpen(order);
                          }}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Pay
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {displayOrders.length === 0 && !loading && (
          <div className="py-12 text-center text-muted-foreground">
            No orders found matching your criteria
          </div>
        )}

        {hasMore && (
          <div className="p-4 border-t flex justify-center bg-muted/20">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="gap-2"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading more...
                </>
              ) : (
                <>
                  Load More Orders
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-[560px] max-h-[92vh] overflow-hidden p-0 rounded-3xl border-none shadow-2xl">
          {selectedOrder && (
            <div className="bg-white flex flex-col max-h-[92vh]">
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-slate-100">
                <DialogHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <DialogTitle className="text-xl font-semibold text-slate-900">Order Details</DialogTitle>
                        {(() => {
                          const tableMatch = (selectedOrder?.description || selectedOrder?.invoice_description || "").match(/Table (\d+)/);
                          const tableNo = selectedOrder?.table_no || (tableMatch ? tableMatch[1] : null);
                          return tableNo && (
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-medium">
                              Table {tableNo}
                            </span>
                          );
                        })()}
                      </div>
                      <p className="text-sm text-slate-400 mt-0.5">#{selectedOrder?.invoice_number} · {selectedOrder?.customer_name || 'Walk-in'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400 font-medium">Total</p>
                      <p className="text-xl font-semibold text-slate-900">Rs.{selectedOrder?.total_amount}</p>
                    </div>
                  </div>
                </DialogHeader>
              </div>

              {/* Tabs */}
              <div className="px-6 flex gap-1 border-b border-slate-100 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => setActiveTab("payment")}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                    activeTab === "payment" ? "border-slate-900 text-slate-900 font-bold" : "border-transparent text-slate-400 hover:text-slate-600"
                  )}
                >
                  <Banknote className="h-4 w-4" />
                  Payment
                  {parseFloat(selectedOrder?.due_amount ?? (selectedOrder.total_amount - (selectedOrder.paid_amount || 0))) > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-amber-100 text-amber-800 font-bold">
                      Due
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("items")}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                    activeTab === "items" ? "border-slate-900 text-slate-900 font-bold" : "border-transparent text-slate-400 hover:text-slate-600"
                  )}
                >
                  <FileText className="h-4 w-4" />
                  Items ({(selectedOrder?.items || []).length})
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                {activeTab === "payment" ? (
                  <div className="space-y-5">
                    {/* Paid / Due Grid */}
                    <div className="grid grid-cols-2 gap-4 p-5 rounded-xl bg-slate-50 border border-slate-100">
                      <div>
                        <p className="text-xs text-slate-400 font-medium mb-1">Paid Amount</p>
                        <p className="text-lg font-bold text-emerald-600">Rs.{selectedOrder?.paid_amount || 0}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400 font-medium mb-1">Due Amount</p>
                        <p className={cn(
                          "text-lg font-bold",
                          parseFloat(selectedOrder?.due_amount ?? (selectedOrder.total_amount - (selectedOrder.paid_amount || 0))) > 0 ? "text-destructive" : "text-slate-900"
                        )}>
                          Rs.{parseFloat(selectedOrder?.due_amount ?? (selectedOrder.total_amount - (selectedOrder.paid_amount || 0))).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Receipt Staff Log */}
                    {isFetchingDetail ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      </div>
                    ) : (selectedOrder?.received_by_waiter_name || selectedOrder?.received_by_counter_name) && (
                      <div className="p-4 rounded-xl bg-slate-50 space-y-2 border border-slate-100">
                        <p className="text-xs text-slate-400 font-medium">Receipt Log</p>
                        <div className="flex justify-between text-sm">
                          {selectedOrder?.received_by_waiter_name && (
                            <div>
                              <span className="text-slate-400 text-xs">Waiter: </span>
                              <span className="font-medium text-slate-700">{selectedOrder.received_by_waiter_name}</span>
                            </div>
                          )}
                          {selectedOrder?.received_by_counter_name && (
                            <div className="text-right">
                              <span className="text-slate-400 text-xs">Counter / Manager: </span>
                              <span className="font-medium text-slate-700">{selectedOrder.received_by_counter_name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Payment Breakdown */}
                    {selectedOrder?.payment_details && selectedOrder.payment_details.length > 0 && (
                      <div className="p-4 rounded-xl bg-slate-50 space-y-2 border border-slate-100">
                        <p className="text-xs text-slate-400 font-medium">Payment Breakdown</p>
                        <div className="space-y-1.5">
                          {selectedOrder.payment_details.map((payment: any, idx: number) => (
                            <div key={payment.id || idx} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-100 shadow-sm">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider",
                                  payment.payment_method === "CASH" ? "bg-green-100 text-green-700" :
                                  payment.payment_method === "QR" ? "bg-blue-100 text-blue-700" :
                                  payment.payment_method === "ONLINE" ? "bg-purple-100 text-purple-700" :
                                  payment.payment_method === "CARD" ? "bg-amber-100 text-amber-700" :
                                  "bg-slate-100 text-slate-700"
                                )}>
                                  {payment.payment_method}
                                </span>
                                <span className="text-xs text-slate-500">{payment.received_by_name || ''}</span>
                              </div>
                              <span className="font-bold text-sm">Rs.{parseFloat(payment.amount).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Payment Collection Form (if due > 0) */}
                    {(selectedOrder?.payment_status !== 'PAID' && parseFloat(selectedOrder?.due_amount ?? (selectedOrder.total_amount - (selectedOrder.paid_amount || 0))) > 0) ? (() => {
                      const currentDue = parseFloat(selectedOrder?.due_amount ?? (selectedOrder.total_amount - (selectedOrder.paid_amount || 0)));
                      const changeAmount = Math.max(0, (parseFloat(paymentAmount) || 0) - currentDue);
                      const effectiveBranch = branchInfo || (selectedOrder ? branchesMap[selectedOrder.branch || selectedOrder.branch_id] : null);
                      const qrImageUrl = effectiveBranch?.image_url;

                      return (
                        <div className="space-y-5 animate-in fade-in slide-in-from-top-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Amount to Pay</Label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-300">Rs.</span>
                              <Input
                                type="number"
                                step="any"
                                className="h-16 text-3xl font-black text-center border-2 border-primary/20 focus:border-primary rounded-2xl pl-10"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                              />
                              {changeAmount > 0 && (
                                <div className="absolute -bottom-5 right-2 text-emerald-600 font-black text-[13px] animate-in slide-in-from-top-1 fade-in">
                                  Return: Rs.{changeAmount.toFixed(2)}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Payment Method</Label>
                            <div className="grid grid-cols-4 gap-2">
                              {[
                                { id: 'CASH', icon: Banknote, label: 'Cash' },
                                { id: 'QR', icon: QrCode, label: 'QR' },
                                { id: 'ONLINE', icon: Wallet, label: 'Online' },
                                { id: 'CARD', icon: CreditCard, label: 'Card' }
                              ].map((method) => (
                                <button
                                  key={method.id}
                                  type="button"
                                  onClick={() => setPaymentMethod(method.id as any)}
                                  className={cn(
                                    "flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-1",
                                    paymentMethod === method.id
                                      ? "border-primary bg-primary/5 text-primary shadow-sm"
                                      : "border-slate-100 text-slate-400 hover:border-slate-200"
                                  )}
                                >
                                  <method.icon className="h-5 w-5" />
                                  <span className="text-[10px] font-black uppercase tracking-tighter">{method.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* QR Code Display if QR is selected */}
                          {paymentMethod === 'QR' && (
                            <div className="flex flex-col items-center gap-2 pt-2">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scan QR Code</Label>
                              <div className="bg-white p-2 rounded-2xl shadow-md border border-slate-100 w-32 h-32 flex items-center justify-center overflow-hidden mx-auto">
                                {qrImageUrl ? (
                                  <img
                                    src={qrImageUrl}
                                    alt="QR Code"
                                    className="h-full w-full object-cover"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.src = "/qr.png";
                                    }}
                                  />
                                ) : (
                                  <img
                                    src="/qr.png"
                                    alt="QR Code"
                                    className="h-full w-full object-cover"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.src = "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=AMABAKERY_PAYMENT";
                                    }}
                                  />
                                )}
                              </div>
                            </div>
                          )}

                          {/* Notes */}
                          <div className="space-y-1">
                            <Label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Notes (Optional)</Label>
                            <Input
                              placeholder="e.g. Transaction ID, remark..."
                              value={paymentNotes}
                              onChange={(e) => setPaymentNotes(e.target.value)}
                              className="h-10 rounded-xl"
                            />
                          </div>

                          <Button
                            className="w-full h-14 rounded-2xl font-black text-lg gradient-warm shadow-xl shadow-primary/20 text-white"
                            onClick={handlePaymentSubmit}
                            disabled={isPaying}
                          >
                            {isPaying ? <Loader2 className="h-5 w-5 animate-spin" /> :
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
                              {(() => {
                                const pMethods = selectedOrder?.payment_methods_list || selectedOrder?.payment_methods || [];
                                const hasQR = pMethods.includes('QR');
                                return (
                                  <>
                                    <p className="text-[11px] text-emerald-700 font-bold italic">
                                      {hasQR ? "Online payment (QR). Finalize receipt." : `Waiter (${selectedOrder.received_by_waiter_name}) collected cash. Confirm handover.`}
                                    </p>
                                    <Button
                                      className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 font-bold rounded-xl shadow-lg text-white"
                                      onClick={() => {
                                        const method = hasQR ? 'QR' : 'CASH';
                                        setPaymentMethod(method as any);
                                        setPaymentAmount("0");
                                        setTimeout(() => handlePaymentSubmit(), 50);
                                      }}
                                      disabled={isPaying}
                                    >
                                      {isPaying ? <Loader2 className="h-4 w-4 animate-spin" /> : (hasQR ? "Finalize Receipt" : "Confirm Handover")}
                                    </Button>
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Print Receipt Button */}
                    <div className="pt-2 border-t flex gap-2">
                      <Button
                        variant="outline"
                        className="w-full h-11 rounded-xl font-bold gap-2 border-slate-200"
                        onClick={() => handlePrint(selectedOrder)}
                      >
                        <Printer className="h-4 w-4" />
                        Print Receipt
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                    {/* Item list and operations */}
                    <div className="space-y-3">
                      {(() => {
                        const isEditable = selectedOrder?.payment_status !== "PAID" && selectedOrder?.payment_status !== "CANCELLED";
                        return isEditable && (
                          <div className="flex gap-2 mb-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 h-9 rounded-lg font-bold border-dashed border hover:border-primary hover:text-primary gap-1 text-xs"
                              onClick={() => {
                                setTempAddedItems([]);
                                setAddItemsSearch("");
                                setShowAddItemsModal(true);
                              }}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Add Item
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 h-9 rounded-lg font-bold border-dashed border hover:border-primary hover:text-primary gap-1 text-xs"
                              onClick={() => {
                                const tableMatch = (selectedOrder?.description || selectedOrder?.invoice_description || "").match(/Table (\d+)/);
                                const tableNo = selectedOrder?.table_no || (tableMatch ? tableMatch[1] : "");
                                setNewTableNo(tableNo ? String(tableNo) : "");
                                setShowTransferTableModal(true);
                              }}
                            >
                              <MoveRight className="h-3.5 w-3.5" />
                              Change Table
                            </Button>
                          </div>
                        );
                      })()}

                      {isFetchingDetail ? (
                        <div className="flex justify-center py-6">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                          {selectedOrder.items?.map((item: any, idx: number) => {
                            const productName = item.product_name || productsMap[String(item.product)]?.name || `Product #${item.product}`;
                            const isPrepared = item.status === "READY" || item.status === "COMPLETED";
                            const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "SUPER_ADMIN" || currentUser?.is_superuser;
                            const disableDecrement = isPrepared && !isAdmin;
                            const isEditable = selectedOrder?.payment_status !== "PAID" && selectedOrder?.payment_status !== "CANCELLED";

                            return (
                              <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm">
                                <div className="flex flex-col text-left flex-1 min-w-0 pr-2">
                                  <span className="font-medium break-words whitespace-normal leading-tight">{productName}</span>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] text-slate-400 font-bold flex-shrink-0">Rs.{item.unit_price} / unit</span>
                                    {item.status && (
                                      <span className={cn(
                                        "text-[8px] font-bold px-1 py-0.2 rounded uppercase tracking-wider scale-90 origin-left flex-shrink-0",
                                        isPrepared ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                                      )}>
                                        {item.status}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {isEditable && (
                                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm scale-90">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        disabled={disableDecrement || isUpdatingItem}
                                        onClick={() => handleUpdateQuantity(item.id, item.quantity - 1, item.status)}
                                        className="h-6 w-6 rounded text-slate-500 hover:text-slate-700"
                                      >
                                        <Minus className="h-3 w-3" />
                                      </Button>
                                      <span className="w-4 text-center font-bold text-xs">{item.quantity}</span>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        disabled={isUpdatingItem}
                                        onClick={() => handleUpdateQuantity(item.id, item.quantity + 1, item.status)}
                                        className="h-6 w-6 rounded text-slate-500 hover:text-slate-700"
                                      >
                                        <Plus className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                  <div className="text-right min-w-[50px]">
                                    <p className="font-semibold text-xs">Rs.{(parseFloat(item.unit_price) * item.quantity).toFixed(0)}</p>
                                  </div>
                                  {isEditable && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      disabled={disableDecrement || isUpdatingItem}
                                      onClick={() => handleRemoveItem(item.id, item.status)}
                                      className="h-7 w-7 text-slate-400 hover:text-destructive hover:bg-destructive/5 rounded-lg scale-90"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {(!selectedOrder.items || selectedOrder.items.length === 0) && (
                            <p className="text-xs text-muted-foreground italic text-center py-6">No items recorded</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Totals Summary */}
                    <div className="border-t pt-4 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>Rs.{selectedOrder.subtotal || '0.00'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tax</span>
                        <span>Rs.{selectedOrder.tax_amount || '0.00'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Discount</span>
                        <span>-Rs.{selectedOrder.discount || '0.00'}</span>
                      </div>
                      <div className="flex justify-between font-bold text-base pt-2 text-primary border-t border-dashed">
                        <span>Total Amount</span>
                        <span>Rs.{selectedOrder.total_amount}</span>
                      </div>
                    </div>

                    {/* Actions in Items tab */}
                    <div className="pt-2 border-t flex gap-2">
                      <Button
                        variant="outline"
                        className="w-full h-11 rounded-xl font-bold gap-2 border-slate-200"
                        onClick={() => handlePrint(selectedOrder)}
                      >
                        <Printer className="h-4 w-4" />
                        Print Receipt
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Items Modal */}
      <Dialog open={showAddItemsModal} onOpenChange={setShowAddItemsModal}>
        <DialogContent className="max-w-[400px] rounded-3xl p-6 flex flex-col max-h-[85vh] z-[110]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              Add Items to Order
            </DialogTitle>
          </DialogHeader>

          {/* Search */}
          <div className="relative my-3 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search products..."
              className="pl-10 h-10 rounded-lg border-slate-200"
              value={addItemsSearch}
              onChange={(e) => setAddItemsSearch(e.target.value)}
            />
          </div>

          {/* Product list */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {Object.values(productsMap)
              .filter(p => !addItemsSearch.trim() || p.name.toLowerCase().includes(addItemsSearch.toLowerCase()))
              .map(product => {
                const tempItem = tempAddedItems.find(it => it.product.id === product.id);
                const qty = tempItem ? tempItem.quantity : 0;
                return (
                  <div key={product.id} className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/50 rounded-xl transition-all border border-slate-100">
                    <div className="flex flex-col text-left">
                      <span className="font-bold text-sm text-slate-800">{product.name}</span>
                      <span className="text-xs font-semibold text-slate-400">Rs.{parseFloat(product.selling_price).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {qty > 0 ? (
                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-500"
                            onClick={() => {
                              setTempAddedItems(prev => {
                                const existing = prev.find(it => it.product.id === product.id);
                                if (existing && existing.quantity > 1) {
                                  return prev.map(it => it.product.id === product.id ? { ...it, quantity: it.quantity - 1 } : it);
                                }
                                return prev.filter(it => it.product.id !== product.id);
                              });
                            }}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-5 text-center font-bold text-xs">{qty}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-500"
                            onClick={() => {
                              setTempAddedItems(prev => prev.map(it => it.product.id === product.id ? { ...it, quantity: it.quantity + 1 } : it));
                            }}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setTempAddedItems(prev => [...prev, { product, quantity: 1 }]);
                          }}
                          className="h-8 pr-3 pl-2 rounded-lg gap-1 border-primary/20 text-primary hover:bg-primary/5 font-bold"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            {Object.values(productsMap).length === 0 && (
              <p className="text-center py-6 text-slate-400 font-semibold text-sm">No products available</p>
            )}
          </div>

          {/* Selected summary & submit */}
          {tempAddedItems.length > 0 && (
            <div className="border-t pt-4 mt-3 bg-white space-y-3 shrink-0">
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold text-slate-600">Selected Items ({tempAddedItems.length})</span>
                <span className="font-black text-primary text-base">
                  Rs.{tempAddedItems.reduce((acc, curr) => acc + (parseFloat(curr.product.selling_price) * curr.quantity), 0).toFixed(2)}
                </span>
              </div>
              <Button
                className="w-full h-12 rounded-xl font-bold bg-primary text-white"
                onClick={handleAddItemsSubmit}
                disabled={isUpdatingItem}
              >
                {isUpdatingItem ? <Loader2 className="h-5 w-5 animate-spin" /> : `Add to Order`}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transfer Table Modal */}
      <Dialog open={showTransferTableModal} onOpenChange={setShowTransferTableModal}>
        <DialogContent className="max-w-[320px] rounded-2xl p-6 z-[110]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Transfer Table</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-3">
            <Input
              type="number"
              placeholder="Enter table number"
              value={newTableNo}
              onChange={(e) => setNewTableNo(e.target.value)}
              className="text-center font-bold text-xl h-12"
            />
            <Button
              className="w-full h-12 rounded-xl font-bold bg-primary text-white"
              onClick={handleTransferTableSubmit}
              disabled={isTransferringTable}
            >
              {isTransferringTable ? <Loader2 className="h-5 w-5 animate-spin" /> : "Transfer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
