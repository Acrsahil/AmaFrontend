import { useState, useEffect, useMemo } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, Download, Eye, Loader2, ChevronDown, ChevronUp, Plus, Minus, Trash2, MoveRight, ShoppingBag } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { fetchInvoices, fetchProducts, fetchBranches, fetchInvoiceDetail, patchInvoice } from "@/api/index.js";
import { toast } from "sonner";
import { getCurrentUser } from "@/auth/auth";

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
  const [isFetchingDetail, setIsFetchingDetail] = useState(false);
  const [showPopupItems, setShowPopupItems] = useState(true);
  const [isUpdatingItem, setIsUpdatingItem] = useState(false);
  const [showAddItemsModal, setShowAddItemsModal] = useState(false);
  const [showTransferTableModal, setShowTransferTableModal] = useState(false);
  const [newTableNo, setNewTableNo] = useState("");
  const [isTransferringTable, setIsTransferringTable] = useState(false);
  const [tempAddedItems, setTempAddedItems] = useState<{ product: any, quantity: number }[]>([]);
  const [addItemsSearch, setAddItemsSearch] = useState("");

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
    setIsFetchingDetail(true);
    try {
      const fullDetail = await fetchInvoiceDetail(order.id);
      setSelectedOrder(fullDetail);
    } catch (err: any) {
      console.error("Failed to fetch invoice details:", err);
      // We keep the partial info from the list if detail fetch fails
    } finally {
      setIsFetchingDetail(false);
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
        product: parseInt(item.product.id),
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
                    <StatusBadge status={(order.payment_status || 'unpaid').toLowerCase()} />
                  </td>
                  <td className="px-6 py-4 text-right font-semibold">Rs.{order.total_amount}</td>
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
        <DialogContent className="max-w-[540px]">
          <DialogHeader>
            <DialogTitle>Invoice {selectedOrder?.invoice_number}</DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground font-bold text-[10px] uppercase">Branch</p>
                  <p className="font-medium">{selectedOrder.branch_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-bold text-[10px] uppercase">Created By</p>
                  <p className="font-medium">{selectedOrder.created_by_name}</p>
                </div>
                {(selectedOrder.received_by_waiter_name || selectedOrder.received_by_counter_name) && (
                  <div>
                    <p className="text-muted-foreground font-bold text-[10px] uppercase">Received By</p>
                    <p className="font-medium">{selectedOrder.received_by_waiter_name || selectedOrder.received_by_counter_name}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground font-bold text-[10px] uppercase">Customer</p>
                  <p className="font-medium">{selectedOrder.customer_name || 'Walk-in'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground font-bold text-[10px] uppercase">Payment Status</p>
                  <StatusBadge status={selectedOrder.payment_status.toLowerCase()} />
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="bg-muted/30 p-2 rounded text-xs italic">
                  <p className="text-muted-foreground font-bold text-[9px] uppercase mb-1">Notes</p>
                  {selectedOrder.notes}
                </div>
              )}

              <div className="border-t pt-4">
                <button
                  onClick={() => setShowPopupItems(!showPopupItems)}
                  className="w-full flex justify-between items-center text-xs font-bold uppercase text-muted-foreground mb-2 tracking-widest hover:text-primary transition-colors"
                >
                  <span>Items</span>
                  {showPopupItems ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {isFetchingDetail ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : showPopupItems ? (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200">
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
                    {selectedOrder.items?.map((item: any, idx: number) => {
                      const productName = item.product_name || productsMap[String(item.product)]?.name || `Product #${item.product}`;
                      const isPrepared = item.status === "READY" || item.status === "COMPLETED";
                      const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "SUPER_ADMIN" || currentUser?.is_superuser;
                      const disableDecrement = isPrepared && !isAdmin;
                      const isEditable = selectedOrder?.payment_status !== "PAID" && selectedOrder?.payment_status !== "CANCELLED";

                      return (
                        <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-100 text-sm">
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
                      <p className="text-xs text-muted-foreground italic">No items recorded</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic px-1">Click to expand items ({(selectedOrder.items || []).length})</p>
                )}
              </div>

              <div className="border-t pt-4 space-y-1">
                {isFetchingDetail ? (
                  <div className="flex justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
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
                    <div className="flex justify-between font-bold text-base pt-2 text-primary">
                      <span>Total</span>
                      <span>Rs.{selectedOrder.total_amount}</span>
                    </div>
                    <div className="border-t mt-2 pt-2 space-y-1">
                      <div className="flex justify-between text-xs font-medium text-success">
                        <span>Paid Amount</span>
                        <span>Rs.{selectedOrder.paid_amount || '0.00'}</span>
                      </div>
                      {parseFloat(selectedOrder.due_amount || '0') > 0 && (
                        <div className="flex justify-between text-xs font-medium text-destructive">
                          <span>Due Amount</span>
                          <span>Rs.{selectedOrder.due_amount}</span>
                        </div>
                      )}
                    </div>

                    {/* Payment Details Section */}
                    {selectedOrder.payment_details && selectedOrder.payment_details.length > 0 && (
                      <div className="border-t mt-3 pt-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Payment Breakdown</p>
                        <div className="space-y-1.5">
                          {selectedOrder.payment_details.map((payment: any, idx: number) => (
                            <div key={payment.id || idx} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
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
                  </>
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
