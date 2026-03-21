import { useState, useEffect } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, Download, Eye, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { fetchInvoices, fetchProducts } from "@/api/index.js";
import { toast } from "sonner";
import { getCurrentUser } from "@/auth/auth";

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [productsMap, setProductsMap] = useState<Record<string, any>>({});
  const currentUser = getCurrentUser();
  const branchId = currentUser?.branch_id ?? null;

  useEffect(() => {
    loadInvoices();
    loadProducts();
  }, [branchId]);

  const loadProducts = async () => {
    try {
      const data = await fetchProducts();
      const map = data.reduce((acc: any, p: any) => {
        acc[String(p.id)] = p;
        return acc;
      }, {});
      setProductsMap(map);
    } catch (err) {
      console.error("Failed to load products for mapping", err);
    }
  };

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const data = await fetchInvoices();
      const scoped =
        branchId != null
          ? (data || []).filter(
            (o: any) => o.branch === branchId || o.branch_id === branchId
          )
          : data || [];
      setOrders(scoped);
    } catch (err: any) {
      toast.error(err.message || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      order.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.customer_name && order.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.created_by_name && order.created_by_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || order.payment_status === statusFilter;
    
    const orderDate = order.created_at ? format(parseISO(order.created_at), 'yyyy-MM-dd') : null;
    const matchesDate = !dateFilter || orderDate === dateFilter;
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  const handleExport = () => {
    try {
      const exportData = filteredOrders.map(order => ({
        'Invoice #': order.invoice_number,
        'Branch': order.branch_name || 'N/A',
        'Created By': order.created_by_name || 'N/A',
        'Customer': order.customer_name || 'Walk-in',
        'Date': order.created_at ? format(parseISO(order.created_at), 'MMM d, yyyy h:mm a') : 'N/A',
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
          <h1 className="text-3xl font-bold text-foreground">Orders</h1>
          <p className="text-muted-foreground">View and manage all orders</p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={filteredOrders.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <div className="card-elevated p-4 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
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
          className="w-[180px]" 
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
                <th className="px-6 py-4 text-left font-medium text-muted-foreground">Branch</th>
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
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-8 w-8 text-primary animate-spin" />
                      <p className="text-muted-foreground">Loading invoices...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.map((order) => (
                <tr
                  key={order.id}
                  className="border-t hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedOrder(order)}
                >
                  <td className="px-6 py-4 font-medium">{order.invoice_number}</td>
                  <td className="px-6 py-4">{order.branch_name}</td>
                  <td className="px-6 py-4">{order.created_by_name}</td>
                  <td className="px-6 py-4">{order.customer_name || 'Walk-in'}</td>
                  <td className="px-6 py-4 text-muted-foreground text-sm">
                    {order.created_at ? format(parseISO(order.created_at), 'MMM d, h:mm a') : 'N/A'}
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

        {filteredOrders.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            No orders found matching your criteria
          </div>
        )}
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-md">
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
                <p className="text-xs font-bold uppercase text-muted-foreground mb-2 tracking-widest">Items</p>
                <div className="space-y-2">
                  {selectedOrder.items?.map((item: any, idx: number) => {
                    const productName = item.product_name || productsMap[String(item.product)]?.name || `Product #${item.product}`;
                    return (
                      <div key={idx} className="flex justify-between text-sm">
                        <div className="flex flex-col text-left">
                          <span className="font-medium">{item.quantity}× {productName}</span>
                        </div>
                        <span className="font-medium">Rs.{(parseFloat(item.unit_price) * item.quantity).toFixed(2)}</span>
                      </div>
                    );
                  })}
                  {(!selectedOrder.items || selectedOrder.items.length === 0) && (
                    <p className="text-xs text-muted-foreground italic">No items recorded</p>
                  )}
                </div>
              </div>

              <div className="border-t pt-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>Rs.{selectedOrder.subtotal}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>Rs.{selectedOrder.tax_amount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span>-Rs.{selectedOrder.discount}</span>
                </div>
                <div className="border-t mt-2 pt-2 flex justify-between">
                  <span className="font-bold">Total</span>
                  <span className="text-xl font-black text-primary">Rs.{selectedOrder.total_amount}</span>
                </div>
                <div className="flex justify-between text-xs font-medium text-success">
                  <span>Paid Amount</span>
                  <span>Rs.{selectedOrder.paid_amount}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
