import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WaiterBottomNav } from "@/components/waiter/WaiterBottomNav";
import { CreditCard, Banknote, CheckCircle2, IndianRupee, Printer, Clock, X, Loader2, Wallet, QrCode, ChevronDown, ChevronUp, User } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { fetchInvoices, addPayment } from "@/api/index.js";
import { useOrdersWebSocket } from "@/hooks/useOrdersWebSocket";

export default function PaymentCollection() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showCashDialog, setShowCashDialog] = useState(false);
  const [cashReceived, setCashReceived] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showOnlineDialog, setShowOnlineDialog] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<any | null>(null);
  const [completedChange, setCompletedChange] = useState<number>(0);
  const [showAlreadyPaidDialog, setShowAlreadyPaidDialog] = useState(false);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchInvoices();
      // Filter for orders that are NOT fully paid yet
      const pendingPayments = (data || []).filter(
        (o: any) => o.payment_status !== "PAID" && o.invoice_status !== "CANCELLED"
      );
      setOrders(pendingPayments);
    } catch (err: any) {
      toast.error(err.message || "Failed to load pending payments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // Play notification sound


  // WebSocket: auto-refresh when invoice created or status updated
  useOrdersWebSocket(
    useCallback(
      (data) => {
        if (data.type === "invoice_updated" && data.status === "READY") {
          // Order ready - refresh list
          loadInvoices();
        } else if (data.type === "invoice_created" || data.type === "invoice_updated") {
          loadInvoices();
        }
      },
      [loadInvoices]
    )
  );

  const handlePaymentClick = (order: any) => {
    setSelectedOrder(order);
    const isPaid = order.payment_status === 'PAID' || order.payment_status === 'WAITER RECEIVED' || (order.payment_status === 'PARTIAL' && order.received_by_waiter);
    if (isPaid) {
      setShowAlreadyPaidDialog(true);
    } else {
      setShowPaymentDialog(true);
    }
  };

  const handlePaymentMethod = (method: 'CASH' | 'CARD' | 'ONLINE' | 'QR') => {
    if (method === 'CASH') {
      setShowPaymentDialog(false);
      setShowCashDialog(true);
    } else if (method === 'ONLINE') {
      setShowPaymentDialog(false);
      processPayment('QR', parseFloat(selectedOrder.due_amount || selectedOrder.total_amount));
    } else {
      processPayment(method, parseFloat(selectedOrder.due_amount || selectedOrder.total_amount));
    }
  };

  const processPayment = async (method: string, amount: number, change = 0) => {
    if (!selectedOrder) return;

    setIsProcessing(true);
    try {
      // Logic for adding payment to backend
      const paymentData = {
        amount: amount,
        payment_method: method,
        notes: `Payment collected by waiter for Order #${selectedOrder.invoice_number}`
      };

      await addPayment(selectedOrder.id, paymentData);

      toast.success("Payment Received!", {
        description: method === 'CASH' && change > 0
          ? `Change to return: Rs.${change.toFixed(2)}`
          : `Order #${selectedOrder.invoice_number?.slice(-4)} - Rs.${amount.toFixed(2)} paid via ${method}`,
        icon: <CheckCircle2 className="h-5 w-5 text-success" />
      });

      // Refresh list
      await loadInvoices();

      setShowPaymentDialog(false);
      setShowCashDialog(false);
      setShowOnlineDialog(false);

      // Set completed order for receipt display
      setCompletedOrder({
        ...selectedOrder,
        payment_method: method,
        payment_status: 'PAID'
      });
      setCompletedChange(change);
      setShowReceipt(true);

      setSelectedOrder(null);
      setCashReceived("");
    } catch (err: any) {
      toast.error(err.message || "Failed to process payment");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCashPaymentSubmit = () => {
    const received = parseFloat(cashReceived);
    const due = parseFloat(selectedOrder?.due_amount || selectedOrder?.total_amount || 0);

    if (!cashReceived || isNaN(received)) {
      toast.error("Please enter amount received");
      return;
    }

    if (received < due) {
      toast.error("Insufficient amount");
      return;
    }



    if (received >= due) {
      const change = received - due;
      processPayment('CASH', due, change);
    } else {
      processPayment('CASH', received, 0);
    }

  };

  const pendingOrdersList = orders.filter(o => !(o.payment_status === 'PAID' || o.payment_status === 'WAITER RECEIVED' || (o.payment_status === 'PARTIAL' && o.received_by_waiter)));
  const completedOrdersList = orders.filter(o => o.payment_status === 'PAID' || o.payment_status === 'WAITER RECEIVED' || (o.payment_status === 'PARTIAL' && o.received_by_waiter));

  // Extracted Order Card Component for better state management
  const PaymentOrderCard = ({ order, onPaymentClick }: { order: any; onPaymentClick: (order: any) => void }) => {
    const [showItems, setShowItems] = useState(false);

    return (
      <div
        className="card-elevated w-full text-left overflow-hidden transition-all mb-4"
      >
        <button
          className="w-full text-left focus:outline-none active:bg-slate-50 transition-colors"
          onClick={() => onPaymentClick(order)}
        >
          <div className="bg-slate-50/80 px-4 py-3 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base">Order #{order.invoice_number?.slice(-4) || '??'}</span>
              <span className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-slate-500">
                Table {order.table_no || order.floor_name || '??'}
              </span>
            </div>
            <StatusBadge
              status={
                (order.payment_status === 'PAID' || order.payment_status === 'WAITER RECEIVED' || (order.payment_status === 'PARTIAL' && order.received_by_waiter))
                  ? 'paid'
                  : order.payment_status?.toLowerCase() || 'pending'
              }
            />
          </div>
        </button>

        <div className="px-4 py-3">
          {/* Dropdown Items Header */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowItems(!showItems);
            }}
            className="w-full flex justify-between items-center py-2 px-1 border-b border-slate-100/50 hover:bg-slate-50/80 transition-all group rounded-md mb-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-slate-400 group-hover:text-primary transition-colors">
                Items ({(order.items || []).length})
              </span>
            </div>
            {showItems ? (
              <ChevronUp className="h-4 w-4 text-slate-400 group-hover:text-primary transition-colors" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-primary transition-colors" />
            )}
          </button>

          {/* Expandable Items List */}
          {showItems && (
            <div className="space-y-1 mb-4 animate-in fade-in slide-in-from-top-1 duration-200">
              {order.items?.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center text-sm bg-slate-50/50 p-1.5 rounded-lg border border-slate-100/50">
                  <span className="text-slate-700 font-medium leading-tight inline-flex gap-1.5 items-center">
                    <span className="text-primary font-bold bg-primary/10 px-1.5 py-0.5 rounded text-[11px]">{item.quantity}×</span>
                    {item.product_name || 'Item'}
                  </span>
                  <span className="text-slate-500 text-[11px] tabular-nums font-bold">Rs.{Number(item.unit_price * item.quantity).toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center pt-2">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs">
              <User className="h-3.5 w-3.5" />
              <span className="font-medium">{order.created_by_name || 'Waiter'}</span>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">Amount Due</p>
              <p className="text-lg font-black text-primary leading-none">Rs.{Number(order.due_amount ?? order.total_amount).toFixed(2)}</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => onPaymentClick(order)}
          className="w-full py-2.5 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest transition-colors border-t border-primary/10"
        >
          Collect Payment
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <MobileHeader title="Payments" showBack={false} />

      <main className="p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground animate-pulse">Fetching pending bills...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <div className="h-20 w-20 rounded-full bg-success/10 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">All sets!</h3>
            <p className="text-sm">No pending payments found today.</p>
            <Button
              variant="outline"
              className="mt-6 rounded-xl"
              onClick={loadInvoices}
            >
              Refresh List
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                {pendingOrdersList.length} Pending Bills
              </p>
              <Button variant="ghost" size="sm" onClick={loadInvoices} className="h-7 text-[10px] font-bold">
                REFRESH
              </Button>
            </div>

            {pendingOrdersList.map(order => (
              <PaymentOrderCard key={order.id} order={order} onPaymentClick={handlePaymentClick} />
            ))}

            {completedOrdersList.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                    {completedOrdersList.length} Collected Today
                  </p>
                </div>
                {completedOrdersList.map(order => (
                  <PaymentOrderCard key={order.id} order={order} onPaymentClick={handlePaymentClick} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Payment Method Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-[calc(100%-2rem)] w-[360px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-primary p-6 text-white text-center">
            <div className="h-14 w-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3 border border-white/20">
              <Wallet className="h-7 w-7 text-white" />
            </div>
            <h3 className="text-xl font-bold">Collect Payment</h3>
            <p className="text-white/70 text-sm">Order #{selectedOrder?.invoice_number?.slice(-4)}</p>
          </div>

          <div className="p-6 space-y-6">
            <div className="text-center py-6 bg-slate-50 rounded-2xl border-2 border-slate-100">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Total Bill Amount</p>
              <p className="text-4xl font-black text-primary">Rs.{Number(selectedOrder?.due_amount || selectedOrder?.total_amount || 0).toFixed(2)}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-24 flex-col gap-2 rounded-2xl border-2 hover:border-success hover:bg-success/5 hover:text-success transition-all group"
                onClick={() => handlePaymentMethod('CASH')}
              >
                <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-success/20">
                  <Banknote className="h-6 w-6 text-slate-400 group-hover:text-success" />
                </div>
                <span className="font-bold">Cash</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex-col gap-2 rounded-2xl border-2 hover:border-info hover:bg-info/5 hover:text-info transition-all group"
                onClick={() => handlePaymentMethod('QR')}
              >
                <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-info/20">
                  <QrCode className="h-6 w-6 text-slate-400 group-hover:text-info" />
                </div>
                <span className="font-bold">QR</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog >

      {/* Already Paid Dialog */}
      <Dialog open={showAlreadyPaidDialog} onOpenChange={setShowAlreadyPaidDialog}>
        <DialogContent className="max-w-[calc(100%-2rem)] w-[360px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-success p-6 text-white text-center">
            <div className="h-14 w-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3 border border-white/20">
              <CheckCircle2 className="h-7 w-7 text-white" />
            </div>
            <h3 className="text-xl font-bold">Payment Collected</h3>
            <p className="text-white/70 text-sm">Order #{selectedOrder?.invoice_number?.slice(-4)}</p>
          </div>

          <div className="p-6 space-y-6 text-center">
            <div className="space-y-2">
              <p className="text-slate-600 font-medium">This order has already been paid or collected.</p>
              <div className="text-center py-4 bg-slate-50 rounded-2xl border-2 border-slate-100">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Total Amount</p>
                <p className="text-3xl font-black text-slate-900">Rs.{Number(selectedOrder?.total_amount || 0).toFixed(2)}</p>
                {selectedOrder?.received_by_waiter_name && (
                  <p className="text-[10px] font-bold text-success mt-2 uppercase tracking-wider">
                    Collected By: {selectedOrder.received_by_waiter_name}
                  </p>
                )}
              </div>
            </div>

            <Button
              className="w-full h-12 bg-slate-900 text-white font-bold rounded-xl"
              onClick={() => setShowAlreadyPaidDialog(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cash Payment Dialog */}
      < Dialog open={showCashDialog} onOpenChange={setShowCashDialog} >
        <DialogContent className="max-w-[calc(100%-2rem)] w-[380px] rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-emerald-600 p-6 text-white text-center">
            <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4 border border-white/30">
              <Banknote className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-bold font-serif italic">Cash Collection</h3>
            <p className="text-white/80 text-sm italic">Table {selectedOrder?.table_no}</p>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <span className="text-muted-foreground font-medium text-sm">Amount Due</span>
                <span className="text-xl font-black text-slate-900 tabular-nums">Rs.{Number(selectedOrder?.due_amount || selectedOrder?.total_amount || 0).toFixed(2)}</span>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Cash Received</Label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-300 text-xl">Rs.</div>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    className="text-center text-3xl h-16 font-black border-2 border-slate-100 focus:border-emerald-500 pl-8 rounded-xl bg-slate-50"
                    autoFocus
                  />
                </div>
              </div>

              {cashReceived && parseFloat(cashReceived) > 0 && (
                parseFloat(cashReceived) >= parseFloat(selectedOrder?.due_amount || selectedOrder?.total_amount || 0) ? (
                  <div className="p-4 rounded-xl bg-emerald-50 border-2 border-emerald-100 text-emerald-700 animate-in zoom-in-95 duration-300">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest font-black opacity-70 mb-0.5">Change to Return</p>
                        <p className="text-3xl font-black">Rs.{(parseFloat(cashReceived) - parseFloat(selectedOrder?.due_amount || selectedOrder?.total_amount || 0)).toFixed(2)}</p>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                        <IndianRupee className="h-6 w-6" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-100 text-amber-700 animate-in zoom-in-95 duration-300">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest font-black opacity-70 mb-0.5">Remaining Due</p>
                        <p className="text-3xl font-black">Rs.{(parseFloat(selectedOrder?.due_amount || selectedOrder?.total_amount || 0) - parseFloat(cashReceived)).toFixed(2)}</p>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                        <Clock className="h-6 w-6" />
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="ghost"
                className="flex-1 h-14 font-bold text-slate-400"
                onClick={() => setShowCashDialog(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                className="flex-[1.5] h-14 text-base font-black bg-emerald-600 hover:bg-emerald-700 shadow-lg rounded-xl"
                onClick={handleCashPaymentSubmit}
                disabled={isProcessing || !cashReceived || isNaN(parseFloat(cashReceived)) || parseFloat(cashReceived) <= 0}
              >
                {isProcessing ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Confirm Payment
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog >

      {/* Online Payment (QR) Dialog */}
      < Dialog open={showOnlineDialog} onOpenChange={setShowOnlineDialog} >
        <DialogContent className="max-w-[calc(100%-2rem)] w-[380px] rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-info p-6 text-white text-center">
            <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4 border border-white/30">
              <CreditCard className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-bold">Online Payment</h3>
            <p className="text-white/80 text-sm italic">Scan QR to pay • Table {selectedOrder?.table_no}</p>
          </div>

          <div className="p-8 space-y-6 flex flex-col items-center">
            <div className="text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Payable Amount</p>
              <p className="text-3xl font-black text-primary mb-6">Rs.{Number(selectedOrder?.due_amount || selectedOrder?.total_amount || 0).toFixed(2)}</p>
            </div>

            {/* QR Code Placeholder/Real */}
            <div className="relative p-4 bg-white rounded-[2rem] border-4 border-slate-50 shadow-inner group">
              <div className="h-64 w-64 bg-slate-100 rounded-xl flex items-center justify-center overflow-hidden border border-slate-200">
                <img
                  src="/qr.png"
                  alt="QR Code"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=AMABAKERY_PAYMENT";
                  }}
                />
              </div>
              <div className="absolute -top-2 -right-2 h-8 w-8 bg-primary text-white rounded-full flex items-center justify-center shadow-lg animate-bounce">
                <div className="h-4 w-4 rounded-full border-2 border-white animate-ping absolute" />
                <IndianRupee className="h-4 w-4 relative" />
              </div>
            </div>

            <div className="text-center max-w-[240px]">
              <p className="text-xs font-semibold text-slate-500">Please ask the customer to scan and pay the exact amount above</p>
            </div>

            <div className="w-full space-y-3 pt-2">
              <Button
                className="w-full h-14 bg-info hover:bg-info/90 text-white font-black rounded-2xl shadow-xl shadow-info/20"
                onClick={() => processPayment('ONLINE', parseFloat(selectedOrder?.due_amount || selectedOrder?.total_amount || 0))}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Confirm & Complete Order
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                className="w-full h-12 text-slate-400 font-bold"
                onClick={() => setShowOnlineDialog(false)}
                disabled={isProcessing}
              >
                Go Back
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog >

      {/* Digital Receipt Modal (Reuse your professional receipt logic here) */}
      < Dialog open={showReceipt} onOpenChange={setShowReceipt} >
        <DialogContent className="max-w-[360px] w-[92vw] p-0 border-none bg-transparent shadow-none overflow-visible max-h-[92vh] flex flex-col items-center">
          <div className="h-[2px] w-24 bg-white/20 rounded-full mb-4 shrink-0" />

          {/* The Actual Receipt */}
          <div className="bg-white w-full rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="h-1.5 bg-primary w-full" />

            <div className="p-6 space-y-4">
              <div className="text-center">
                <h1 className="text-lg text-primary font-black tracking-widest" style={{ fontFamily: "'Rockwell', serif" }}>AMA BAKERY</h1>
                <p className="text-[8px] text-slate-400 uppercase tracking-widest mt-1">Payment Successful</p>
              </div>

              <div className="border-t border-b border-dashed py-3 flex justify-between items-center text-[11px]">
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[8px]">Receipt</p>
                  <p className="font-bold">#{(completedOrder?.id || '0').toString().padStart(4, '0')}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400 font-bold uppercase text-[8px]">Method</p>
                  <p className="font-bold">{completedOrder?.payment_method}</p>
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Order Total</span>
                  <span className="font-bold">Rs.{Number(completedOrder?.total_amount).toFixed(2)}</span>
                </div>
                {completedChange > 0 && (
                  <div className="flex justify-between text-xs text-emerald-600">
                    <span>Change Given</span>
                    <span className="font-black">Rs.{completedChange.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <Button
                className="w-full bg-slate-900 text-white font-bold h-11 rounded-xl"
                onClick={() => setShowReceipt(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog >

      <WaiterBottomNav />
    </div >
  );
}


