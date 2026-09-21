import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WaiterBottomNav } from "@/components/waiter/WaiterBottomNav";
import { 
  CreditCard, 
  Banknote, 
  CheckCircle2, 
  IndianRupee, 
  Printer, 
  Clock, 
  X, 
  Loader2, 
  Wallet, 
  QrCode, 
  ChevronDown, 
  ChevronUp, 
  User, 
  Receipt, 
  Edit, 
  Search, 
  Bell,
  RefreshCw,
  Coins,
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { fetchInvoices, addPayment, fetchInvoiceDetail, fetchBranch, fetchUsers, fetchWaiterPayments, fetchMe } from "@/api/index.js";
import { getCurrentUser } from "@/auth/auth";
import { useOrdersWebSocket } from "@/hooks/useOrdersWebSocket";

export default function PaymentCollection() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const wsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showCashDialog, setShowCashDialog] = useState(false);
  const [cashReceived, setCashReceived] = useState("");
  const [onlineReceived, setOnlineReceived] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [branchInfo, setBranchInfo] = useState<any>(null);
  const [showOnlineDialog, setShowOnlineDialog] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<any | null>(null);
  const [completedChange, setCompletedChange] = useState<number>(0);
  const [showAlreadyPaidDialog, setShowAlreadyPaidDialog] = useState(false);
  const [activeNonCashMethod, setActiveNonCashMethod] = useState<'QR' | 'CARD' | 'ONLINE'>('QR');
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<'pending' | 'collected'>('pending');
  const [waiterCashInHand, setWaiterCashInHand] = useState<number | null>(null);
  const [waiterPaymentsHistory, setWaiterPaymentsHistory] = useState<any[]>([]);

  const loadInvoices = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const [invoiceRes, meRes, usersRes, waiterPaymentsRes] = await Promise.all([
        fetchInvoices({ date: todayStr }).catch(err => {
          console.error("fetchInvoices failed:", err);
          return null;
        }),
        fetchMe().catch(() => null),
        fetchUsers().catch(() => null),
        fetchWaiterPayments().catch(() => null)
      ]);

      const data = invoiceRes?.results || (Array.isArray(invoiceRes) ? invoiceRes : []);

      const enrichedInvoices = await Promise.all(
        (data || []).map(async (inv: any) => {
          try {
            return await fetchInvoiceDetail(inv.id);
          } catch (err) {
            console.error(`Failed to fetch detail for invoice ${inv.id}:`, err);
            return inv;
          }
        })
      );

      // Keep all active sale orders (both pending and collected today)
      const validInvoices = enrichedInvoices.filter(
        (o: any) => !o.is_deleted && o.invoice_status !== "CANCELLED" && o.invoice_type === "SALE"
      );
      setOrders(validInvoices);

      // Extract current waiter cash in hand & handovers from server
      const user = getCurrentUser();
      let resolvedCashInHand: number | null = null;

      // Priority 1: Direct /api/me/ response
      if (meRes && meRes.cash_in_hand !== undefined && meRes.cash_in_hand !== null) {
        resolvedCashInHand = parseFloat(meRes.cash_in_hand) || 0;
      }

      // Priority 2: User list
      if (resolvedCashInHand === null && usersRes) {
        const userList = Array.isArray(usersRes) ? usersRes : (usersRes?.users || usersRes?.results || usersRes?.data || []);
        const myUser = userList.find((u: any) => String(u.id) === String(user?.id));
        if (myUser && myUser.cash_in_hand !== undefined && myUser.cash_in_hand !== null) {
          resolvedCashInHand = parseFloat(myUser.cash_in_hand) || 0;
        }
      }

      if (resolvedCashInHand !== null) {
        setWaiterCashInHand(resolvedCashInHand);
      }

      // Parse waiter payments history (handling both arrays and paginated DRF responses)
      const rawPayments = Array.isArray(waiterPaymentsRes)
        ? waiterPaymentsRes
        : (waiterPaymentsRes?.results || waiterPaymentsRes?.data || []);

      if (Array.isArray(rawPayments)) {
        const myPayments = rawPayments
          .filter((p: any) => String(p.paid_by) === String(user?.id))
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setWaiterPaymentsHistory(myPayments);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load pending payments");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices(true);
  }, [loadInvoices]);

  useEffect(() => {
    const loadBranch = async () => {
      const user = getCurrentUser();
      if (user?.branch_id) {
        try {
          const response = await fetchBranch(user.branch_id);
          // fetchBranch returns {success: true, data: {...}}
          // Extract the actual branch data from the response
          const branchData = response?.data || response;
          console.log("Branch data loaded:", branchData);
          setBranchInfo(branchData);
        } catch (err) {
          console.error("Failed to load branch info", err);
        }
      }
    };
    loadBranch();
  }, []);

  // Play notification sound


  // WebSocket: auto-refresh silently on ANY socket event (no manual reload/sync needed)
  const wsCurrentUser = getCurrentUser();
  useOrdersWebSocket(
    useCallback(
      (data) => {
        if (data.type === "invoice_updated" && data.status === "READY") {
          fetchInvoiceDetail(data.invoice_id)
            .then((order) => {
              if (order && String(order.created_by) === String(wsCurrentUser?.id)) {
                const tableMatch = (order?.description || order?.invoice_description || "").match(/Table (\d+)/);
                const tableNo = order?.table_no || (tableMatch ? tableMatch[1] : "");
                const tableText = tableNo ? `Table ${tableNo}` : "Takeaway";

                // Play the bell sound
                try {
                  const audio = new Audio("/noti.mp3");
                  audio.play().catch((err) => console.log("Audio play deferred:", err));
                } catch (e) {
                  console.warn("Audio play failed:", e);
                }

                // Speak order ready
                setTimeout(() => {
                  try {
                    if ("speechSynthesis" in window) {
                      window.speechSynthesis.cancel();
                      const utterance = new SpeechSynthesisUtterance(`Order for ${tableText} is ready to pickup`);
                      utterance.rate = 0.95;
                      window.speechSynthesis.speak(utterance);
                    }
                  } catch (e) {
                    console.warn("Speech synthesis failed:", e);
                  }
                }, 850);

                toast.success(`Order for ${tableText} is ready for pickup!`, {
                  icon: <Bell className="h-5 w-5 text-emerald-500 animate-bounce" />,
                  duration: 6000,
                });
              }
            })
            .catch((err) => {
              console.error("Failed to fetch order detail on WS notify:", err);
            });
        }

        // Silent debounced auto-refresh on ANY socket event
        if (wsDebounceRef.current) clearTimeout(wsDebounceRef.current);
        wsDebounceRef.current = setTimeout(() => {
          loadInvoices(false);
        }, 350);
      },
      [loadInvoices, wsCurrentUser?.id]
    ),
    wsCurrentUser?.branch_id
  );

  // Immediate cross-tab and cross-component sync listener
  useEffect(() => {
    const handleSync = () => {
      loadInvoices(false);
    };
    window.addEventListener("waiter-payment-updated", handleSync);
    return () => {
      window.removeEventListener("waiter-payment-updated", handleSync);
      if (wsDebounceRef.current) clearTimeout(wsDebounceRef.current);
    };
  }, [loadInvoices]);

  const handlePaymentClick = (order: any) => {
    setSelectedOrder(order);
    const isPaid = (order.payment_status === 'PAID' || order.payment_status === 'WAITER RECEIVED' || (order.payment_status === 'PARTIAL' && order.received_by_waiter)) && Number(order.due_amount || 0) <= 0;
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
      setCashReceived(String(selectedOrder.due_amount || selectedOrder.total_amount || 0));
    } else {
      setActiveNonCashMethod(method);
      setShowPaymentDialog(false);
      setShowOnlineDialog(true);
      setOnlineReceived(""); // Don't pre-fill - allow partial payments
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

      // Refresh list & broadcast to all tabs
      window.dispatchEvent(new CustomEvent("waiter-payment-updated"));
      await loadInvoices(false);

      setShowPaymentDialog(false);
      setShowCashDialog(false);
      setShowOnlineDialog(false);

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

    if (!cashReceived || isNaN(received) || received <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (received >= due) {
      const change = received - due;
      processPayment('CASH', due, change);
    } else {
      processPayment('CASH', received, 0); // Partial Payment
    }
  };

  const handleViewBill = (order: any) => {
    setReceiptData({
      cart: (order.items || []).map((item: any) => ({
        item: {
          name: item?.product_name || item?.product?.name || item?.name || `Product #${item?.product || "?"}`,
          price: parseFloat(item?.unit_price ?? item?.price ?? (item?.product?.selling_price) ?? 0)
        },
        quantity: item?.quantity ?? 1,
        notes: item?.description || item?.notes || ""
      })),
      subtotal: parseFloat(order.subtotal_amount || 0),
      taxAmount: parseFloat(order.tax_amount || 0),
      taxRate: order.tax_rate || 0,
      discountAmount: parseFloat(order.discount_amount || 0),
      total: parseFloat(order.total_amount || 0),
      invoice_no: order.invoice_number || order.id,
      customer: order.customer_name ? { name: order.customer_name } : null,
      paymentMethod: order.payment_status === 'PAID' ? 'PAID' : 'PENDING',
      date: order.created_at
    });
    setShowReceipt(true);
  };

  const handlePrint = () => {
    if (!receiptData) return;

    const pCart = receiptData.cart;
    const pSubtotal = receiptData.subtotal;
    const pTaxAmount = receiptData.taxAmount;
    const pTaxRate = receiptData.taxRate;
    const pDiscountAmount = receiptData.discountAmount;
    const pTotal = receiptData.total;
    const pCustomer = receiptData.customer;
    const user = getCurrentUser();

    const itemRows = pCart.map((item: any, index: number) => `
            <div class="receipt-item-grid">
                <div>${index + 1}</div>
                <div>
                    ${item.item.name}
                    ${item.notes ? `<div style="font-size: 8pt; text-transform: none; margin-top: 1mm;">"${item.notes}"</div>` : ""}
                </div>
                <div>${item.quantity}</div>
                <div style="text-align: right;">${(item.item.price * item.quantity).toFixed(2)}</div>
            </div>
        `).join("") || "";

    const taxRow = pTaxAmount > 0 ? `
            <div class="thermal-row">
                <span>TAX (${pTaxRate}%)</span>
                <span>${pTaxAmount.toFixed(2)}</span>
            </div>` : "";

    const discountRow = pDiscountAmount > 0 ? `
            <div class="thermal-row" style="color: #dc2626 !important;">
                <span>DISCOUNT</span>
                <span>-${pDiscountAmount.toFixed(2)}</span>
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
        
        @media print {
            @page { size: 80mm auto; margin: 0; }
            body { width: 80mm; padding: 4mm; }
        }
    </style>
</head>
<body>
    <div class="thermal-header">
        <div class="thermal-title">${branchInfo?.receipt_header || "AMA BAKERY"}</div>
        <div class="thermal-subtitle">Tel: ${branchInfo?.phone || "9816020731"}</div>
        ${branchInfo?.location ? `<div class="thermal-subtitle">${branchInfo.location.toUpperCase()}</div>` : ""}
    </div>
    
    <div class="thermal-divider"></div>
    
    <div class="thermal-info-grid">
        <div class="thermal-info-left">
            <div>INV: #${receiptData?.invoice_no || Date.now().toString().slice(-6)}</div>
            <div>DATE: ${new Date(receiptData.date).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <div class="thermal-info-right">
            <div>WAIT: ${user?.name || "Waiter"}</div>
            <div>CUST: ${pCustomer ? pCustomer.name : "Walk-in"}</div>
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
            <span>${pSubtotal.toFixed(2)}</span>
        </div>
        ${taxRow}
        ${discountRow}
        <div class="thermal-divider"></div>
        <div class="thermal-total-row">
            <span>TOTAL</span>
            <span>${pTotal.toFixed(2)}</span>
        </div>
        <div class="thermal-divider"></div>
        <div class="thermal-row">
            <span>STATUS</span>
            <span>${receiptData?.paymentMethod === "PAY_LATER" ? "PENDING" : "PAID"}</span>
        </div>
        <div class="thermal-divider"></div>
    </div>

    <div class="thermal-footer">
        ${branchInfo?.receipt_footer || "THANK YOU FOR YOUR VISIT!"}
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

  const currentUser = getCurrentUser();

  // Search functionality
  const filterOrdersBySearch = (ordersList: any[]) => {
    if (!searchQuery.trim()) return ordersList;

    const query = searchQuery.toLowerCase().trim();

    return ordersList.filter(order => {
      // Search by invoice number
      const invoiceMatch = order.invoice_number?.toLowerCase().includes(query);

      // Search by customer name
      const customerMatch = order.customer_name?.toLowerCase().includes(query);

      // Search by customer phone (if available)
      const phoneMatch = order.customer_phone?.toLowerCase().includes(query) ||
        order.customer?.phone?.toLowerCase().includes(query);

      // Search by product names
      const productMatch = order.items?.some((item: any) =>
        item.product_name?.toLowerCase().includes(query) ||
        item.product?.name?.toLowerCase().includes(query)
      );

      // Search by table number
      const tableMatch = order.table_no?.toString().includes(query);

      return invoiceMatch || customerMatch || phoneMatch || productMatch || tableMatch;
    });
  };

  // Orders calculation
  const pendingOrdersList = useMemo(() => {
    return orders.filter(o => {
      const isPaid = ((o.payment_status === 'PAID' || o.payment_status === 'WAITER RECEIVED' || (o.payment_status === 'PARTIAL' && o.received_by_waiter)) && Number(o.due_amount || 0) <= 0);
      return !isPaid;
    });
  }, [orders]);

  const completedOrdersList = useMemo(() => {
    return orders.filter(o => {
      const isPaid = ((o.payment_status === 'PAID' || o.payment_status === 'WAITER RECEIVED' || (o.payment_status === 'PARTIAL' && o.received_by_waiter)) && Number(o.due_amount || 0) <= 0);
      return isPaid;
    });
  }, [orders]);

  // Total payments/handovers made by this waiter today
  const waiterPaymentsTodayTotal = useMemo(() => {
    const todayStr = new Date().toDateString();
    return waiterPaymentsHistory
      .filter(p => {
        try {
          return new Date(p.created_at).toDateString() === todayStr;
        } catch {
          return false;
        }
      })
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  }, [waiterPaymentsHistory]);

  // Set of order IDs that have been handed over to the counter
  const handedOverOrderIds = useMemo(() => {
    const set = new Set<string | number>();

    // 1. Explicitly confirmed in database
    completedOrdersList.forEach(o => {
      if (o.received_by_counter) {
        set.add(o.id);
      }
    });

    // 2. Identify all completed cash orders by this waiter
    const myCashOrders = completedOrdersList
      .filter(o => {
        const pMethods = o.payment_methods_list || o.payment_methods || (o.payment_method ? [o.payment_method] : []);
        const isCash = pMethods.some((m: string) => m?.toUpperCase() === 'CASH') || o.payment_method?.toUpperCase() === 'CASH';
        const isMine = !o.received_by_waiter || String(o.received_by_waiter) === String(currentUser?.id);
        return isCash && isMine;
      })
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // Case A: If current waiter cash in hand is 0 or less (or all cash is settled),
    // then ALL of the waiter's completed cash orders are handed over!
    if (waiterCashInHand !== null && waiterCashInHand <= 0 && myCashOrders.length > 0) {
      myCashOrders.forEach(o => set.add(o.id));
      return set;
    }

    // Case B: Match against waiter payments history (handover transfers made to counter)
    if (waiterPaymentsHistory.length > 0) {
      const latestHandoverTime = new Date(waiterPaymentsHistory[0].created_at).getTime();
      let remainingHandedOver = waiterPaymentsTodayTotal;

      for (const order of myCashOrders) {
        const orderTime = new Date(order.created_at).getTime();
        const orderAmount = parseFloat(order.paid_amount || order.total_amount || 0);

        // If order was created before or around latest handover, or covered by cumulative handed over amount
        if (orderTime <= latestHandoverTime + 60000 || remainingHandedOver >= orderAmount) {
          set.add(order.id);
          remainingHandedOver -= orderAmount;
        }
      }
    }

    return set;
  }, [completedOrdersList, currentUser, waiterCashInHand, waiterPaymentsTodayTotal, waiterPaymentsHistory]);

  // Fallback calculations for cash in hand and handed over today
  const orderCalculatedCashInHand = useMemo(() => {
    return completedOrdersList
      .filter(o => {
        const pMethods = o.payment_methods_list || o.payment_methods || (o.payment_method ? [o.payment_method] : []);
        const isCash = pMethods.some((m: string) => m.toUpperCase() === 'CASH') || o.payment_method?.toUpperCase() === 'CASH';
        const isMine = !o.received_by_waiter || String(o.received_by_waiter) === String(currentUser?.id);
        const isHandedOver = Boolean(o.received_by_counter) || handedOverOrderIds.has(o.id);
        return isCash && isMine && !isHandedOver;
      })
      .reduce((sum, o) => sum + (parseFloat(o.paid_amount || o.total_amount) || 0), 0);
  }, [completedOrdersList, currentUser, handedOverOrderIds]);

  const effectiveCashInHand = waiterCashInHand !== null ? waiterCashInHand : orderCalculatedCashInHand;

  const effectiveHandedOverToday = useMemo(() => {
    if (waiterPaymentsTodayTotal > 0) {
      return waiterPaymentsTodayTotal;
    }
    // Fallback from orders where received_by_counter is true or settled
    return completedOrdersList
      .filter(o => {
        const pMethods = o.payment_methods_list || o.payment_methods || (o.payment_method ? [o.payment_method] : []);
        const isCash = pMethods.some((m: string) => m.toUpperCase() === 'CASH') || o.payment_method?.toUpperCase() === 'CASH';
        const isMine = !o.received_by_waiter || String(o.received_by_waiter) === String(currentUser?.id);
        const isHandedOver = Boolean(o.received_by_counter) || handedOverOrderIds.has(o.id);
        return isCash && isMine && isHandedOver;
      })
      .reduce((sum, o) => sum + (parseFloat(o.paid_amount || o.total_amount) || 0), 0);
  }, [waiterPaymentsTodayTotal, completedOrdersList, currentUser, handedOverOrderIds]);

  // Apply search filter
  const filteredPendingOrders = filterOrdersBySearch(pendingOrdersList);
  const filteredCompletedOrders = filterOrdersBySearch(completedOrdersList);

  const getHandoverStatus = (order: any) => {
    const isPaid = ((order.payment_status === 'PAID' || order.payment_status === 'WAITER RECEIVED' || (order.payment_status === 'PARTIAL' && order.received_by_waiter)) && Number(order.due_amount || 0) <= 0);
    if (!isPaid) return null;

    const pMethods = order.payment_methods_list || order.payment_methods || (order.payment_method ? [order.payment_method] : []);
    const isCash = pMethods.some((m: string) => m?.toUpperCase() === 'CASH') || order.payment_method?.toUpperCase() === 'CASH';

    if (!isCash && pMethods.length > 0) {
      return {
        type: 'online',
        label: 'Digital / QR Payment',
        sublabel: 'Directly in Counter account',
        badgeColor: 'bg-indigo-50/90 text-indigo-700 border-indigo-200/80',
        dotColor: 'bg-indigo-500'
      };
    }

    const isHandedOver = Boolean(order.received_by_counter) || handedOverOrderIds.has(order.id);

    if (isHandedOver) {
      return {
        type: 'confirmed',
        label: 'Handed Over to Counter',
        sublabel: order.received_by_counter_name ? `Confirmed by ${order.received_by_counter_name}` : 'Settled with Counter',
        badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
        dotColor: 'bg-emerald-500'
      };
    }

    return {
      type: 'pending_handover',
      label: 'In Your Hand (Pending Handover)',
      sublabel: 'Cash collected • Awaiting Counter handover confirmation',
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200/80',
      dotColor: 'bg-amber-500 animate-pulse'
    };
  };

  // Extracted Order Card Component for better state management (Apple-Inspired)
  const PaymentOrderCard = ({ order, onPaymentClick }: { order: any; onPaymentClick: (order: any) => void }) => {
    const [showItems, setShowItems] = useState(false);
    const isPaid = ((order.payment_status === 'PAID' || order.payment_status === 'WAITER RECEIVED' || (order.payment_status === 'PARTIAL' && order.received_by_waiter)) && Number(order.due_amount || 0) <= 0);
    const handover = getHandoverStatus(order);
    const itemsCount = (order.items || []).length;
    const dueAmount = Number(isPaid ? (order.paid_amount ?? order.total_amount) : (order.due_amount ?? order.total_amount));

    return (
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-2xs hover:shadow-xs transition-all overflow-hidden mb-3">
        {/* Card Header: Order #, Table chip, Floor chip, Status */}
        <div
          className="bg-slate-50/60 px-3.5 py-2.5 flex items-center justify-between border-b border-slate-100 cursor-pointer"
          onClick={() => !isPaid && onPaymentClick(order)}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 text-xs md:text-sm">
              #{order.invoice_number?.slice(-4) || '??'}
            </span>
            {(order.table_no || !order.floor_name) && (
              <span className="text-[11px] bg-white border border-slate-200/80 px-2 py-0.5 rounded-md font-medium text-slate-700 shadow-2xs">
                {order.table_no ? `Table ${order.table_no}` : "Takeaway"}
              </span>
            )}
            {order.floor_name && (
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                {order.floor_name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <StatusBadge
              status={isPaid ? 'paid' : (order.payment_status?.toLowerCase() || 'pending')}
            />
          </div>
        </div>

        {/* Handover Status Pill (Apple Inspired) */}
        {handover && (
          <div className={cn("mx-3.5 mt-2.5 px-3 py-1.5 rounded-xl border flex items-center justify-between gap-2 shadow-2xs text-xs", handover.badgeColor)}>
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn("h-2 w-2 rounded-full shrink-0", handover.dotColor)} />
              <div className="min-w-0">
                <p className="text-xs font-semibold leading-tight truncate">{handover.label}</p>
                <p className="text-[10px] font-normal opacity-80 leading-tight truncate">{handover.sublabel}</p>
              </div>
            </div>
            {handover.type === 'confirmed' ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            ) : handover.type === 'pending_handover' ? (
              <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0 animate-pulse" />
            ) : (
              <QrCode className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
            )}
          </div>
        )}

        <div className="px-3.5 py-2.5">
          {/* Dropdown Items Header */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowItems(!showItems);
            }}
            className="w-full flex justify-between items-center py-1.5 px-2.5 bg-slate-50/70 hover:bg-slate-100/70 transition-colors rounded-lg mb-2 text-slate-600"
          >
            <span className="text-[11px] font-medium text-slate-500">
              {itemsCount} {itemsCount === 1 ? "Item" : "Items"} in Order
            </span>
            {showItems ? (
              <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            )}
          </button>

          {/* Expandable Items List */}
          {showItems && (
            <div className="space-y-1 mb-2.5 animate-in fade-in duration-150">
              {order.items?.map((item: any, idx: number) => {
                const name = item?.product_name || item?.product?.name || item?.name || `Product #${item?.product || "?"}`;
                const qty = item?.quantity ?? 1;
                const price = item?.unit_price ?? item?.price ?? (item?.product?.selling_price) ?? 0;

                return (
                  <div key={idx} className="flex justify-between items-center text-xs bg-slate-50/50 px-2 py-1 rounded-md">
                    <span className="text-slate-700 font-normal truncate flex items-center gap-1.5">
                      <span className="text-slate-900 font-semibold text-[11px]">{qty}×</span>
                      {name}
                    </span>
                    <span className="text-slate-600 font-medium tabular-nums shrink-0 ml-2">
                      Rs. {(Number(price) * Number(qty)).toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Meta & Amount */}
          <div className="flex justify-between items-baseline pt-0.5">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1 text-slate-500 text-xs">
                <User className="h-3 w-3 text-slate-400" />
                <span className="font-medium text-slate-700 text-xs">{order.customer_name || 'Walk-in Customer'}</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Created by {order.created_by_name || 'Waiter'}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">
                {isPaid ? "Total Paid" : "Amount Due"}
              </span>
              <span className="text-base md:text-lg font-bold text-slate-900 tabular-nums">
                Rs. {dueAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Apple-Style Action Footer */}
        <div className="px-3.5 pb-3 pt-1 flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleViewBill(order);
            }}
            className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95"
          >
            <Receipt className="h-3.5 w-3.5 text-slate-500" />
            <span>View Bill</span>
          </button>

          {!isPaid ? (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/waiter/order/${order.table_no || "takeaway"}?invoiceId=${order.id}&floorId=${order.floor}`);
                }}
                className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <Edit className="h-3.5 w-3.5 text-slate-500" />
                <span>Edit</span>
              </button>

              <button
                onClick={() => onPaymentClick(order)}
                className="flex-1 h-9 px-4 rounded-xl bg-[#1D1D1F] hover:bg-[#2C2C2E] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs"
              >
                <Banknote className="h-3.5 w-3.5" />
                <span>Collect Payment</span>
              </button>
            </>
          ) : (
            <div className="flex-1 h-9 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Collected</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <MobileHeader title="Payments" showBack={false} />

      <main className="p-4 max-w-2xl mx-auto">
        {/* Apple-Inspired Unified Balance & Handover Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/80 p-4 mb-3 shadow-2xs">
          {/* Card Header: Status & Live indicator */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn("h-2 w-2 rounded-full shrink-0", effectiveCashInHand > 0 ? "bg-amber-500 animate-pulse" : "bg-emerald-500")} />
              <span className={cn(
                "text-[11px] font-semibold uppercase tracking-wider truncate",
                effectiveCashInHand > 0 ? "text-amber-800" : "text-emerald-800"
              )}>
                {effectiveCashInHand > 0 ? "Awaiting Counter Handover" : "Cash Settled with Counter"}
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-[10px] font-medium shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span>Live Socket</span>
            </div>
          </div>

          {/* Primary Amount: Cash In Hand */}
          <div className="pt-3 pb-2 flex items-baseline justify-between">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                Cash in Hand
              </span>
              <div className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight mt-0.5 tabular-nums">
                Rs. {effectiveCashInHand.toFixed(2)}
              </div>
            </div>

            {effectiveCashInHand > 0 && (
              <div className="text-right">
                <span className="text-[10px] font-medium text-amber-800 bg-amber-50 border border-amber-200/60 px-2 py-1 rounded-xl inline-block">
                  Hand over to cashier
                </span>
              </div>
            )}
          </div>

          {/* Sub-stats Row */}
          <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-slate-100 text-xs">
            <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                Settled Today
              </span>
              <span className="text-sm font-bold text-emerald-700 tabular-nums">
                Rs. {effectiveHandedOverToday.toFixed(2)}
              </span>
            </div>

            <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                Total Handled
              </span>
              <span className="text-sm font-bold text-slate-800 tabular-nums">
                Rs. {(effectiveCashInHand + effectiveHandedOverToday).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Native Apple Segmented Control */}
        <div className="flex p-1 bg-slate-200/60 backdrop-blur-md rounded-xl mb-3 border border-slate-200/40">
          <button
            onClick={() => setActiveTab('pending')}
            className={cn(
              "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 active:scale-98",
              activeTab === 'pending'
                ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <span>Pending Bills</span>
            <span className={cn(
              "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
              activeTab === 'pending' ? "bg-primary/10 text-primary" : "bg-slate-300/60 text-slate-600"
            )}>
              {filteredPendingOrders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('collected')}
            className={cn(
              "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 active:scale-98",
              activeTab === 'collected'
                ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <span>Collected & Handovers</span>
            <span className={cn(
              "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
              activeTab === 'collected' ? "bg-emerald-100 text-emerald-700" : "bg-slate-300/60 text-slate-600"
            )}>
              {filteredCompletedOrders.length}
            </span>
          </button>
        </div>

        {/* Full-width Apple Search Field (No Reload Button) */}
        <div className="relative mb-3.5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search by invoice, customer, table..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9 h-10 rounded-xl border border-slate-200/80 focus:border-slate-400 focus:ring-0 bg-white text-xs shadow-2xs placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </div>

        {/* Content List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground animate-pulse text-sm font-medium">Fetching orders and handover status...</p>
          </div>
        ) : activeTab === 'pending' ? (
          filteredPendingOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground bg-white rounded-3xl border border-dashed border-slate-200 p-6 text-center">
              <div className="h-16 w-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No Pending Bills</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-[240px]">All dining and takeaway bills are settled or no unpaid orders found today.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPendingOrders.map(order => (
                <PaymentOrderCard key={order.id} order={order} onPaymentClick={handlePaymentClick} />
              ))}
            </div>
          )
        ) : (
          filteredCompletedOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground bg-white rounded-3xl border border-dashed border-slate-200 p-6 text-center">
              <div className="h-16 w-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                <Clock className="h-8 w-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No Collected Bills Today</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-[240px]">Collected cash and digital payments will appear here with live counter handover tracking.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCompletedOrders.map(order => (
                <PaymentOrderCard key={order.id} order={order} onPaymentClick={handlePaymentClick} />
              ))}
            </div>
          )
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
                className="h-24 flex-col gap-2 rounded-2xl border-2 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all group"
                onClick={() => handlePaymentMethod('QR')}
              >
                <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-primary/20">
                  <QrCode className="h-6 w-6 text-slate-400 group-hover:text-primary" />
                </div>
                <span className="font-bold">QR</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex-col gap-2 rounded-2xl border-2 hover:border-blue-600 hover:bg-blue-500/5 hover:text-blue-600 transition-all group"
                onClick={() => handlePaymentMethod('CARD')}
              >
                <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-blue-600/20">
                  <CreditCard className="h-6 w-6 text-slate-400 group-hover:text-blue-600" />
                </div>
                <span className="font-bold">Card</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex-col gap-2 rounded-2xl border-2 hover:border-orange-500 hover:bg-orange-500/5 hover:text-orange-500 transition-all group"
                onClick={() => handlePaymentMethod('ONLINE')}
              >
                <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-orange-500/20">
                  <Wallet className="h-6 w-6 text-slate-400 group-hover:text-orange-500" />
                </div>
                <span className="font-bold">Online</span>
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
            <p className="text-white/80 text-sm italic">
              Table {selectedOrder?.table_no}
              {selectedOrder?.floor_name && ` • ${selectedOrder.floor_name}`}
            </p>
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
        <DialogContent className="max-w-[calc(100%-2.5rem)] w-[320px] rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-primary p-4 text-white text-center">
            <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-2 border border-white/30">
              {activeNonCashMethod === 'QR' && <QrCode className="h-6 w-6 text-white" />}
              {activeNonCashMethod === 'CARD' && <CreditCard className="h-6 w-6 text-white" />}
              {activeNonCashMethod === 'ONLINE' && <Wallet className="h-6 w-6 text-white" />}
            </div>
            <h3 className="text-lg font-bold leading-tight">
              {activeNonCashMethod === 'QR' && "QR Payment"}
              {activeNonCashMethod === 'CARD' && "Card Payment"}
              {activeNonCashMethod === 'ONLINE' && "Online Payment"}
            </h3>
            <p className="text-white/80 text-[10px] italic">
              {activeNonCashMethod === 'QR' && "Scan QR to pay"}
              {activeNonCashMethod === 'CARD' && "Insert/Swipe card to pay"}
              {activeNonCashMethod === 'ONLINE' && "Process online wallet payment"} • Table {selectedOrder?.table_no}
              {selectedOrder?.floor_name && ` • ${selectedOrder.floor_name}`}
            </p>
          </div>

          <div className="p-4 space-y-3 flex flex-col items-center">
            <div className="text-center w-full">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Payable Amount</p>

              <div className="relative max-w-[200px] mx-auto mb-2">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-300 text-xl">Rs.</div>
                <Input
                  type="number"
                  value={onlineReceived}
                  onChange={(e) => setOnlineReceived(e.target.value)}
                  className="text-center text-3xl h-14 font-black border-2 border-slate-100 focus:border-primary pl-10 rounded-xl bg-slate-50"
                  autoFocus
                />
              </div>
            </div>

            {/* QR Code Placeholder/Real */}
            {activeNonCashMethod === 'QR' && (
              <div className="relative p-3 bg-white rounded-[1.5rem] border-4 border-slate-50 shadow-inner group">
                <div className="h-48 w-48 bg-slate-100 rounded-xl flex items-center justify-center overflow-hidden border border-slate-200">
                  {branchInfo?.image_url ? (
                    <img
                      src={branchInfo.image_url}
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
                        target.src = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=AMABAKERY_PAYMENT";
                      }}
                    />
                  )}
                </div>
                <div className="absolute -top-2 -right-2 h-8 w-8 bg-primary text-white rounded-full flex items-center justify-center shadow-lg animate-bounce">
                  <div className="h-4 w-4 rounded-full border-2 border-white animate-ping absolute" />
                  <IndianRupee className="h-4 w-4 relative" />
                </div>
              </div>
            )}

            {activeNonCashMethod === 'ONLINE' && (
              <div className="relative p-3 bg-white rounded-[1.5rem] border-4 border-slate-50 shadow-inner group">
                <div className="h-48 w-48 bg-slate-100 rounded-xl flex items-center justify-center overflow-hidden border border-slate-200">
                  <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                    <Wallet className="h-10 w-10 text-primary mb-2 animate-pulse" />
                    <p className="text-xs font-bold text-slate-700">Digital Wallet</p>
                    <p className="text-[10px] text-slate-400">Process payment online</p>
                  </div>
                </div>
              </div>
            )}

            {activeNonCashMethod === 'CARD' && (
              <div className="relative p-3 bg-white rounded-[1.5rem] border-4 border-slate-50 shadow-inner group">
                <div className="h-48 w-48 bg-slate-100 rounded-xl flex items-center justify-center overflow-hidden border border-slate-200">
                  <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                    <CreditCard className="h-10 w-10 text-primary mb-2 animate-pulse" />
                    <p className="text-xs font-bold text-slate-700">Card Terminal</p>
                    <p className="text-[10px] text-slate-400">Swipe/Insert to Pay</p>
                  </div>
                </div>
              </div>
            )}

            <div className="text-center max-w-[240px]">
              <p className="text-xs font-semibold text-slate-500">
                {activeNonCashMethod === 'QR' && "Please ask the customer to scan and pay the exact amount above"}
                {activeNonCashMethod === 'CARD' && "Please process the card payment for the exact amount above"}
                {activeNonCashMethod === 'ONLINE' && "Please complete the online wallet payment for the exact amount above"}
              </p>
            </div>

            <div className="w-full space-y-2 pt-1">
              <Button
                className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-black rounded-xl shadow-xl shadow-primary/20"
                onClick={() => {
                  const amt = parseFloat(onlineReceived);
                  const due = parseFloat(selectedOrder?.due_amount || selectedOrder?.total_amount || 0);
                  if (isNaN(amt) || amt <= 0) return toast.error("Enter a valid amount");
                  processPayment(activeNonCashMethod, Math.min(amt, due));
                }}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirm & Complete
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                className="w-full h-10 text-slate-400 font-bold"
                onClick={() => setShowOnlineDialog(false)}
                disabled={isProcessing}
              >
                Go Back
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog >


      <WaiterBottomNav />

      {/* Receipt Preview Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-[400px] w-[95vw] p-0 border-none bg-transparent shadow-none overflow-visible max-h-[90vh] flex flex-col">
          <DialogTitle className="sr-only">Bill Preview</DialogTitle>
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setShowReceipt(false)}
              className="h-10 w-10 flex items-center justify-center rounded-full bg-slate-900/80 text-white backdrop-blur-sm shadow-xl z-50 transition-all active:scale-95"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="bg-white rounded-2xl overflow-y-auto shadow-2xl relative custom-scrollbar flex flex-col">
            <div className="p-4 bg-slate-50 border-b flex justify-between items-center sticky top-0 z-10">
              <span className="text-xs font-bold text-slate-500 uppercase">
                Bill Preview
              </span>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handlePrint()} className="h-8 text-xs font-bold px-4">
                  <Printer className="h-3.5 w-3.5 mr-1.5" />
                  Print
                </Button>
              </div>
            </div>

            <div className="thermal-receipt p-6">
              <div className="thermal-header">
                <h1 className="thermal-title font-bold text-center">{branchInfo?.receipt_header || "AMA BAKERY"}</h1>
                <div className="thermal-subtitle text-center">Tel: {branchInfo?.phone || "9816020731"}</div>
                {branchInfo?.location && <div className="thermal-subtitle text-center">{branchInfo.location.toUpperCase()}</div>}
              </div>

              <div className="thermal-divider my-4 border-t border-dashed border-black"></div>

              <div className="thermal-info-grid grid grid-cols-2 text-xs gap-2">
                <div className="thermal-info-left">
                  <div>INV: #{receiptData?.invoice_no}</div>
                  <div>DATE: {receiptData?.date ? new Date(receiptData.date).toLocaleDateString() : new Date().toLocaleDateString()}</div>
                </div>
                <div className="thermal-info-right text-right">
                  <div>WAIT: {getCurrentUser()?.name || "Waiter"}</div>
                  <div>CUST: {receiptData?.customer ? receiptData.customer.name : "Walk-in"}</div>
                </div>
              </div>

              <div className="thermal-divider my-4 border-t border-dashed border-black"></div>

              <div className="receipt-item-grid grid grid-cols-[30px_1fr_40px_60px] font-bold text-xs gap-2">
                <div>SN</div>
                <div>ITEM</div>
                <div>QTY</div>
                <div className="text-right">TOTAL</div>
              </div>

              <div className="thermal-divider my-2 border-t border-dashed border-black"></div>

              {receiptData?.cart?.map((item: any, idx: number) => (
                <div key={idx} className="receipt-item-grid grid grid-cols-[30px_1fr_40px_60px] text-xs gap-2 py-1">
                  <div>{idx + 1}</div>
                  <div>
                    {item.item.name}
                    {item.notes && <div className="text-[10px] italic">"{item.notes}"</div>}
                  </div>
                  <div>{item.quantity}</div>
                  <div className="text-right">{(item.item.price * item.quantity).toFixed(2)}</div>
                </div>
              ))}

              <div className="thermal-divider my-4 border-t border-dashed border-black"></div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>SUBTOTAL</span>
                  <span>{(receiptData?.subtotal ?? 0).toFixed(2)}</span>
                </div>
                {(receiptData?.taxAmount ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span>TAX ({receiptData?.taxRate ?? 0}%)</span>
                    <span>{(receiptData?.taxAmount ?? 0).toFixed(2)}</span>
                  </div>
                )}
                {(receiptData?.discountAmount ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span>DISCOUNT</span>
                    <span>-{(receiptData?.discountAmount ?? 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="thermal-divider my-2 border-t border-dashed border-black"></div>
                <div className="flex justify-between font-bold text-lg">
                  <span>TOTAL</span>
                  <span>Rs.{(receiptData?.total ?? 0).toFixed(2)}</span>
                </div>
                <div className="thermal-divider my-2 border-t border-dashed border-black"></div>
                <div className="flex justify-between">
                  <span>STATUS</span>
                  <span>{receiptData?.paymentMethod === "PAY_LATER" ? "PENDING" : "PAID"}</span>
                </div>
              </div>

              <div className="thermal-footer text-center mt-8 text-xs font-bold uppercase">
                {branchInfo?.receipt_footer || "THANK YOU FOR YOUR VISIT!"}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


