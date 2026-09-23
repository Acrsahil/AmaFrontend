import { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { WaiterBottomNav } from "@/components/waiter/WaiterBottomNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
    Receipt,
    CheckCircle2,
    Percent,
    IndianRupee,
    User,
    Phone,
    MessageSquare,
    Banknote,
    QrCode,
    CreditCard,
    Wallet,
    Printer,
    X,
    ChevronRight,
    Loader2
} from "lucide-react";
import { toast } from "sonner";
import { MenuItem } from "@/lib/mockData";
import { clearTableOrder } from "@/lib/orderStorage";
import { cn } from "@/lib/utils";
import { CustomerSelector } from "@/components/pos/CustomerSelector";
import { createInvoice, fetchBranch } from "@/api/index.js";
import { getCurrentUser } from "@/auth/auth";
import { useEffect } from "react";

interface CartItemData {
    item: MenuItem;
    quantity: number;
    notes?: string;
}

interface CheckoutState {
    cart: CartItemData[];
    tableNumber: string;
    groupName?: string;
    floorId?: string;
}

type PaymentTiming = "now" | "later" | null;
type PaymentMethod = "cod" | "qr" | "card" | "credit" | null;

export default function Checkout() {
    const navigate = useNavigate();
    const location = useLocation();
    const state = location.state as CheckoutState;

    const [customer, setCustomer] = useState<any>(null);
    const [specialInstructions, setSpecialInstructions] = useState("");
    const [discountPercent, setDiscountPercent] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentTiming, setPaymentTiming] = useState<PaymentTiming>("later");
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
    const [taxEnabled, setTaxEnabled] = useState(false);
    const [taxRate, setTaxRate] = useState(5);
    const [showPaymentConfirmation, setShowPaymentConfirmation] = useState(false);
    const [showCashModal, setShowCashModal] = useState(false);
    const [cashReceived, setCashReceived] = useState("");
    const [changeAmount, setChangeAmount] = useState<number | null>(null);
    const [orderId, setOrderId] = useState<string | null>(null);
    const [customerSearchTerm, setCustomerSearchTerm] = useState("");
    const [isCustomerSelectorOpen, setIsCustomerSelectorOpen] = useState(false);
    const [branchInfo, setBranchInfo] = useState<any>(null);
    const [receiptData, setReceiptData] = useState<any>(null);
    const [showReceipt, setShowReceipt] = useState(false);
    const [autoPrint, setAutoPrint] = useState(false);
    const [showCardModal, setShowCardModal] = useState(false);
    const [showCreditModal, setShowCreditModal] = useState(false);

    useEffect(() => {
        const loadBranch = async () => {
            const user = getCurrentUser();
            if (user?.branch_id) {
                try {
                    const data = await fetchBranch(user.branch_id);
                    console.log("🏪 Branch API Response:", data);
                    if (data?.success) {
                        console.log("✅ Branch data:", data.data);
                        console.log("🖼️ QR Code URL:", data.data?.image_url);
                        setBranchInfo(data.data);
                    } else {
                        console.warn("❌ Branch fetch returned unsuccessful response:", data);
                    }
                } catch (err) {
                    console.error("❌ Failed to load branch info:", err);
                }
            }
        };
        loadBranch();
    }, []);

    const subtotal = useMemo(() =>
        state?.cart.reduce((sum, c) => sum + (c.item.price * c.quantity), 0) || 0,
        [state?.cart]
    );

    const taxAmount = useMemo(() =>
        taxEnabled ? subtotal * (taxRate / 100) : 0,
        [subtotal, taxEnabled, taxRate]
    );

    const discountAmount = useMemo(() =>
        (subtotal * discountPercent) / 100,
        [subtotal, discountPercent]
    );

    const total = useMemo(() =>
        subtotal + taxAmount - discountAmount,
        [subtotal, taxAmount, discountAmount]
    );



    const submitInvoice = async (isPaid: boolean = false, paidAmount: number = 0, method: string | null = null) => {
        setIsProcessing(true);
        const user = getCurrentUser();

        try {
            const invoiceData = {
                branch: user?.branch_id,
                customer: customer?.id || null,
                invoice_type: "SALE",
                notes: specialInstructions,
                description: `Table ${state?.tableNumber}${specialInstructions ? ` | NOTE: ${specialInstructions}` : ""}`,
                table_no: state?.tableNumber ? parseInt(state.tableNumber) : null,
                floor: state?.floorId ? parseInt(state.floorId) : null,
                tax_amount: taxAmount,
                discount: discountAmount,
                paid_amount: paidAmount,
                payment_method: method,
                items: state.cart.map(c => ({
                    item_type: "PRODUCT",
                    product: parseInt(c.item.id),
                    quantity: c.quantity,
                    unit_price: c.item.price,
                    discount_amount: 0, // Could distribute global discount here if needed
                    description: c.notes || ""
                }))
            };

            const result = await createInvoice(invoiceData);
            setOrderId(String(result.id)); // Ensure ID is a string

            // Clear the order from storage
            clearTableOrder(state?.tableNumber || "");

            return result;
        } catch (err: any) {
            toast.error(err.message || "Failed to create invoice");
            throw err;
        } finally {
            setIsProcessing(false);
        }
    };

    const showOrderPreview = async () => {
        if (!paymentTiming) {
            toast.error("Please select payment option", {
                description: "Choose Pay Now or Pay Later",
            });
            return;
        }

        if (paymentTiming === "now" && !paymentMethod) {
            toast.error("Please select payment method", {
                description: "Choose Cash or QR payment",
            });
            return;
        }


        // Prepare preview data
        setReceiptData({
            cart: [...state.cart],
            subtotal,
            taxAmount,
            taxRate,
            discountAmount,
            discountPercent,
            total,
            cashReceived: cashReceived || 0,
            paymentMethod: paymentTiming === 'later' ? "PAY_LATER" : (paymentMethod || "PENDING"),
            customer,
            invoice_no: "PREVIEW"
        });
        setShowReceipt(true);
    };

    const finalizeOrder = async () => {
        if (paymentTiming === "later") {
            try {
                const result = await submitInvoice(false, 0);
                setReceiptData(prev => ({
                    ...prev,
                    invoice_no: result?.id || Date.now().toString().slice(-6)
                }));
                toast.success("Order Confirmed!", {
                    description: `Table ${state?.tableNumber} - Payment Pending`,
                    icon: <CheckCircle2 className="h-5 w-5 text-warning" />,
                });
                setShowReceipt(false);
                navigate('/waiter/tables');
            } catch (err) { }
        } else {
            // Prefill the payment amount with total amount before showing modals
            setCashReceived(total.toFixed(2));
            
            // Pay Now flow - show appropriate modal
            if (paymentMethod === "cod") {
                setShowCashModal(true);
            } else if (paymentMethod === "card") {
                setShowCardModal(true);
            } else if (paymentMethod === "credit") {
                setShowCreditModal(true);
            } else {
                // QR Code payment
                setShowPaymentConfirmation(true);
            }
            setShowReceipt(false);
        }
    };

    const handleCardPayment = async () => {
        const receivedAmount = parseFloat(cashReceived);
        if (!cashReceived || isNaN(receivedAmount) || receivedAmount <= 0) {
            toast.error("Please enter a valid card amount");
            return;
        }
        try {
            const result = await submitInvoice(true, Math.min(total, receivedAmount), "CARD");
            setReceiptData({
                cart: [...state.cart],
                subtotal,
                taxAmount,
                taxRate,
                discountAmount,
                discountPercent,
                total,
                cashReceived: receivedAmount,
                paymentMethod: "CARD",
                customer,
                invoice_no: result?.id || Date.now().toString().slice(-6)
            });

            toast.success("Payment Confirmed!", {
                description: `Table ${state?.tableNumber} - Rs.${receivedAmount.toFixed(2)} paid via Card`,
                icon: <CheckCircle2 className="h-5 w-5 text-success" />,
            });

            setShowCardModal(false);
            navigate('/waiter/tables');
        } catch (err) { }
    };

    const handleCreditPayment = async () => {
        const receivedAmount = parseFloat(cashReceived);
        if (!cashReceived || isNaN(receivedAmount) || receivedAmount <= 0) {
            toast.error("Please enter a valid credit amount");
            return;
        }
        try {
            const result = await submitInvoice(true, Math.min(total, receivedAmount), "CREDIT");
            setReceiptData({
                cart: [...state.cart],
                subtotal,
                taxAmount,
                taxRate,
                discountAmount,
                discountPercent,
                total,
                cashReceived: receivedAmount,
                paymentMethod: "CREDIT",
                customer,
                invoice_no: result?.id || Date.now().toString().slice(-6)
            });

            toast.success("Credit Added!", {
                description: `Table ${state?.tableNumber} - Rs.${receivedAmount.toFixed(2)} added to credit`,
                icon: <CheckCircle2 className="h-5 w-5 text-indigo-500" />,
            });

            setShowCreditModal(false);
            navigate('/waiter/tables');
        } catch (err) { }
    };

    const handleCashPayment = async () => {
        const receivedAmount = parseFloat(cashReceived);

        if (!cashReceived || isNaN(receivedAmount)) {
            toast.error("Please enter amount received");
            return;
        }

        try {
            const result = await submitInvoice(true, Math.min(total, receivedAmount), "CASH");
            const change = receivedAmount > total ? receivedAmount - total : 0;

            setReceiptData({
                cart: [...state.cart],
                subtotal,
                taxAmount,
                taxRate,
                discountAmount,
                discountPercent,
                total,
                cashReceived: receivedAmount,
                paymentMethod: "CASH",
                customer,
                invoice_no: result?.id || Date.now().toString().slice(-6)
            });

            toast.success("Payment Confirmed!", {
                description: change > 0
                    ? `Change to return: Rs.${change.toFixed(2)}`
                    : "Exact amount received",
                icon: <CheckCircle2 className="h-5 w-5 text-success" />,
            });

            setChangeAmount(change);
            setShowCashModal(false);
            navigate('/waiter/tables');
        } catch (err) { }
    };

    const handleQRPayment = async () => {
        const receivedAmount = parseFloat(cashReceived);
        if (!cashReceived || isNaN(receivedAmount) || receivedAmount <= 0) {
            toast.error("Please enter a valid QR amount");
            return;
        }
        try {
            const result = await submitInvoice(true, Math.min(total, receivedAmount), "QR");
            setReceiptData({
                cart: [...state.cart],
                subtotal,
                taxAmount,
                taxRate,
                discountAmount,
                discountPercent,
                total,
                cashReceived: receivedAmount,
                paymentMethod: "QR",
                customer,
                invoice_no: result?.id || Date.now().toString().slice(-6)
            });

            toast.success("Payment Confirmed!", {
                description: `Table ${state?.tableNumber} - Rs.${receivedAmount.toFixed(2)} paid via QR Code`,
                icon: <CheckCircle2 className="h-5 w-5 text-success" />,
            });

            setShowPaymentConfirmation(false);
            navigate('/waiter/tables');
        } catch (err) { }
    };

    const handlePrint = () => {
        const pCart = receiptData?.cart || state.cart;
        const pSubtotal = receiptData?.subtotal ?? subtotal;
        const pTaxAmount = receiptData?.taxAmount ?? taxAmount;
        const pTaxRate = receiptData?.taxRate ?? taxRate;
        const pDiscountAmount = receiptData?.discountAmount ?? discountAmount;
        const pTotal = receiptData?.total ?? total;
        const pCashReceived = receiptData?.cashReceived ?? cashReceived;
        const pCustomer = receiptData?.customer ?? customer;
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
            <div>DATE: ${new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
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



    if (!state || !state.cart || state.cart.length === 0) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <Card className="p-6 text-center">
                    <Receipt className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                    <h2 className="text-xl font-semibold mb-2">No items in cart</h2>
                    <p className="text-muted-foreground mb-4">Please add items before checkout</p>
                    <Button onClick={() => navigate(-1)}>Go Back</Button>
                </Card>
            </div>
        );
    }


    return (
        <div className="min-h-screen bg-[#F5F5F7] text-left">
            <MobileHeader title="Checkout" showBack />

            <div className="p-3 pb-36 space-y-3 max-w-2xl mx-auto">

                {/* ── SECTION 1: Order Summary ── */}
                <div className="bg-white rounded-[24px] border border-black/[0.04] shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.04]">
                        <div className="flex items-center gap-2">
                            <Receipt className="h-5 w-5 text-gray-400" />
                            <span className="text-[15px] font-semibold text-gray-900 tracking-tight">Table {state.tableNumber}</span>
                        </div>
                        <span className="text-[13px] font-medium text-gray-500">{state.cart.length} item{state.cart.length !== 1 ? 's' : ''}</span>
                    </div>

                    <div className="divide-y divide-black/[0.02]">
                        {state.cart.map((cartItem) => (
                            <div key={cartItem.item.id} className="flex items-center justify-between px-5 py-3 gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="text-[14px] font-medium text-gray-900 truncate">{cartItem.item.name}</p>
                                    {cartItem.notes && (
                                        <p className="text-[11px] text-gray-500 flex items-center gap-0.5 mt-0.5">
                                            <MessageSquare className="h-3 w-3 opacity-60" />{cartItem.notes}
                                        </p>
                                    )}
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="text-[11px] text-gray-400 font-medium mr-1.5">×{cartItem.quantity}</span>
                                    <span className="text-[14px] font-semibold text-gray-900">Rs.{(cartItem.item.price * cartItem.quantity).toFixed(0)}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="px-5 py-3.5 bg-gray-50/50 border-t border-black/[0.04] space-y-2">
                        <div className="flex justify-between text-[13px] text-gray-500 font-medium">
                            <span>Subtotal</span>
                            <span>Rs.{subtotal.toFixed(2)}</span>
                        </div>
                        {discountPercent > 0 && (
                            <div className="flex justify-between text-[13px] text-emerald-600 font-medium">
                                <span>Discount ({discountPercent}%)</span>
                                <span>-Rs.{discountAmount.toFixed(2)}</span>
                            </div>
                        )}
                        {taxEnabled && (
                            <div className="flex justify-between text-[13px] text-gray-500 font-medium">
                                <span>Tax ({taxRate}%)</span>
                                <span>Rs.{taxAmount.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center pt-1.5 border-t border-black/[0.04]">
                            <span className="text-[15px] font-semibold text-gray-900">Total</span>
                            <span className="text-[17px] font-bold text-gray-900">Rs.{total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* ── SECTION 2: Payment Option ── */}
                <div className="bg-white rounded-[24px] border border-black/[0.04] shadow-sm p-4 md:p-5">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3.5 ml-1">Payment</p>
                    <div className="grid grid-cols-2 gap-2.5">
                        <button
                            onClick={() => { setPaymentTiming("later"); setPaymentMethod(null); }}
                            className={cn(
                                "flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all active:scale-[0.98]",
                                paymentTiming === "later"
                                    ? "border-primary bg-primary/[0.02]"
                                    : "border-black/[0.04] bg-white hover:bg-gray-50 text-gray-400"
                            )}
                        >
                            <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
                                paymentTiming === "later" ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-400")}>
                                <CheckCircle2 className="h-4 w-4" />
                            </div>
                            <div className="text-left">
                                <p className={cn("text-[14px] font-medium leading-none mb-1", paymentTiming === "later" ? "text-primary" : "text-gray-700")}>Pay Later</p>
                                <p className="text-[11px] text-gray-400 font-medium">Bill on exit</p>
                            </div>
                        </button>

                        <button
                            onClick={() => { setPaymentTiming("now"); setShowPaymentConfirmation(false); }}
                            className={cn(
                                "flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all active:scale-[0.98]",
                                paymentTiming === "now"
                                    ? "border-primary bg-primary/[0.02]"
                                    : "border-black/[0.04] bg-white hover:bg-gray-50 text-gray-400"
                            )}
                        >
                            <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
                                paymentTiming === "now" ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-400")}>
                                <Banknote className="h-4 w-4" />
                            </div>
                            <div className="text-left">
                                <p className={cn("text-[14px] font-medium leading-none mb-1", paymentTiming === "now" ? "text-primary" : "text-gray-700")}>Pay Now</p>
                                <p className="text-[11px] text-gray-400 font-medium">Collect now</p>
                            </div>
                        </button>
                    </div>

                    {/* Payment Method sub-row — only if Pay Now */}
                    {paymentTiming === "now" && (
                        <div className="mt-3.5 grid grid-cols-4 gap-2">
                            {[{ id: "cod", icon: <Banknote className="h-4 w-4" />, label: "Cash" },
                            { id: "qr", icon: <QrCode className="h-4 w-4" />, label: "QR" },
                            { id: "card", icon: <CreditCard className="h-4 w-4" />, label: "Card" },
                            { id: "credit", icon: <IndianRupee className="h-4 w-4" />, label: "Credit" }].map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                                    className={cn(
                                        "flex flex-col items-center gap-1.5 py-3 rounded-2xl border transition-all active:scale-95 text-[11px] font-medium",
                                        paymentMethod === m.id
                                            ? "border-transparent bg-primary text-white shadow-md shadow-primary/20"
                                            : "border-black/[0.04] bg-gray-50 text-gray-500 hover:bg-gray-100"
                                    )}
                                >
                                    {m.icon}{m.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── SECTION 3: Discount (compact) ── */}
                <div className="bg-white rounded-[24px] border border-black/[0.04] shadow-sm p-4 md:p-5">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3.5 ml-1">Discount <span className="text-gray-300 font-medium normal-case">— optional</span></p>
                    <div className="flex items-center gap-2.5">
                        <div className="relative w-24 shrink-0">
                            <input
                                type="text" inputMode="numeric"
                                placeholder="0"
                                value={discountPercent || ""}
                                onChange={(e) => {
                                    const v = e.target.value.replace(/\D/g, "");
                                    setDiscountPercent(Math.min(100, Number(v || 0)));
                                }}
                                className="w-full h-11 rounded-2xl border border-black/[0.08] bg-gray-50 text-center text-[15px] font-semibold text-gray-900 focus:outline-none focus:border-primary pr-6 transition-colors shadow-inner"
                            />
                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-gray-400 font-medium">%</span>
                        </div>
                        <div className="flex gap-2 flex-1">
                            {[5, 10, 15, 20].map(p => (
                                <button
                                    key={p}
                                    onClick={() => setDiscountPercent(discountPercent === p ? 0 : p)}
                                    className={cn(
                                        "flex-1 h-11 rounded-2xl text-[13px] font-medium transition-all active:scale-95",
                                        discountPercent === p
                                            ? "bg-primary text-white shadow-md shadow-primary/20"
                                            : "bg-white text-gray-600 border border-black/[0.08] hover:bg-gray-50"
                                    )}
                                >{p}%</button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── SECTION 4: Customer (collapsed by default) ── */}
                <div className="bg-white rounded-[24px] border border-black/[0.04] shadow-sm p-4 md:p-5">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3.5 ml-1">Customer <span className="text-gray-300 font-medium normal-case">— optional</span></p>
                    <CustomerSelector
                        selectedCustomerId={customer?.id}
                        onSelect={(c) => setCustomer(c)}
                        searchTerm={customerSearchTerm}
                        onSearchChange={setCustomerSearchTerm}
                        open={isCustomerSelectorOpen}
                        onOpenChange={setIsCustomerSelectorOpen}
                    />
                    <input
                        type="text"
                        placeholder="Special instructions..."
                        value={specialInstructions}
                        onChange={(e) => setSpecialInstructions(e.target.value)}
                        className="mt-3 w-full h-11 rounded-2xl border border-black/[0.08] bg-gray-50 text-[14px] text-gray-700 px-4 placeholder:text-gray-400 focus:outline-none focus:border-primary transition-colors shadow-inner"
                    />
                </div>
            </div>


            {/* Dialogs — untouched */}
            {/* Cash Payment Modal - Now as a true Dialog */}
            <Dialog open={showCashModal} onOpenChange={setShowCashModal}>
                <DialogContent className="max-w-[calc(100%-2rem)] w-[380px] rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
                    <div className="bg-primary p-6 text-white text-center">
                        <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4 border border-white/30">
                            <Banknote className="h-8 w-8 text-white" />
                        </div>
                        <h3 className="text-xl font-bold">Cash Payment</h3>
                        <p className="text-white/80 text-sm">Collect cash from customer</p>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center px-1">
                                <span className="text-muted-foreground font-medium">Total Amount</span>
                                <span className="text-xl font-black text-primary">Rs.{total.toFixed(2)}</span>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Amount Received</Label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-xl">Rs.</div>
                                    <Input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="0.00"
                                        value={cashReceived}
                                        onChange={(e) => {
                                            let value = e.target.value;
                                            value = value.replace(/[^0-9.]/g, "");
                                            const parts = value.split(".");
                                            if (parts.length > 2) {
                                                value = parts[0] + "." + parts.slice(1).join("");
                                            }
                                            setCashReceived(value);
                                        }}
                                        className="text-center text-3xl h-16 font-black border-2 border-primary/20 focus:border-primary pl-8 rounded-xl shadow-inner bg-slate-50"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {cashReceived && parseFloat(cashReceived) >= total && (
                                <div className="p-4 rounded-xl bg-success/10 border-2 border-success/20 text-success animate-in zoom-in-95 duration-300 shadow-sm">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest font-black opacity-70 mb-0.5">Change to Return</p>
                                            <p className="text-3xl font-black">Rs.{(parseFloat(cashReceived) - total).toFixed(2)}</p>
                                        </div>
                                        <div className="h-12 w-12 rounded-full bg-success/20 flex items-center justify-center">
                                            <IndianRupee className="h-6 w-6" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="ghost"
                                className="flex-1 h-14 font-bold text-muted-foreground hover:bg-slate-100"
                                onClick={() => setShowCashModal(false)}
                                disabled={isProcessing}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-[1.5] h-14 text-lg font-bold gradient-warm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                onClick={handleCashPayment}
                                disabled={isProcessing || !cashReceived || parseFloat(cashReceived) <= 0}
                            >
                                {isProcessing ? (
                                    <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-5 w-5 mr-2" />
                                        Complete Order
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* QR Payment Modal - Now as a true Dialog */}
            <Dialog open={showPaymentConfirmation} onOpenChange={setShowPaymentConfirmation}>
                <DialogContent className="max-w-[calc(100%-2.5rem)] w-[320px] rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
                    <div className="bg-primary p-4 text-white text-center">
                        <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-2 border border-white/30">
                            <QrCode className="h-6 w-6 text-white" />
                        </div>
                        <h3 className="text-lg font-bold">Scan to Pay</h3>
                        <p className="text-white/80 text-[10px]">Ready to receive payment</p>
                    </div>

                    <div className="p-4 text-center space-y-3">
                        <div className="flex justify-between items-center px-1 text-left">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase">Payable Total:</span>
                            <span className="text-sm font-black text-primary">Rs.{total.toFixed(2)}</span>
                        </div>

                        <div className="space-y-1.5 text-left">
                            <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">QR Payment Amount</Label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-sm">Rs.</div>
                                <Input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0.00"
                                    value={cashReceived}
                                    onChange={(e) => {
                                        let value = e.target.value;
                                        value = value.replace(/[^0-9.]/g, "");
                                        const parts = value.split(".");
                                        if (parts.length > 2) {
                                            value = parts[0] + "." + parts.slice(1).join("");
                                        }
                                        setCashReceived(value);
                                    }}
                                    className="text-center text-xl h-10 font-black border-2 border-primary/20 focus:border-primary pl-6 rounded-xl bg-slate-50"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-primary/20 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                            <div className="relative bg-white p-2 rounded-xl mx-auto border border-primary/10 shadow-md flex flex-col items-center justify-center overflow-hidden min-h-[140px]">
                                {!branchInfo ? (
                                    <div className="flex flex-col items-center justify-center py-8">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                                        <p className="text-[10px] text-muted-foreground font-bold">Loading QR Code...</p>
                                    </div>
                                ) : (
                                    <img
                                        src={branchInfo?.image_url || "/qr.png"}
                                        alt="QR Code"
                                        className="h-28 w-28 object-cover"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            console.log("❌ QR Code failed to load, using fallback");
                                            target.src = "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=AMABAKERY_PAYMENT";
                                        }}
                                        onLoad={() => {
                                            console.log("✅ QR Code loaded successfully:", branchInfo?.image_url);
                                        }}
                                    />
                                )}
                            </div>
                        </div>

                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-60">Wait for confirmation</p>
                        <div className="flex gap-3 pt-1">
                            <Button
                                variant="outline"
                                className="flex-1 h-10 text-xs"
                                onClick={() => setShowPaymentConfirmation(false)}
                                disabled={isProcessing}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-[1.5] h-10 text-xs font-bold bg-primary hover:bg-primary/95 text-white shadow-lg shadow-primary/20 transition-all active:scale-95"
                                onClick={handleQRPayment}
                                disabled={isProcessing || !cashReceived || parseFloat(cashReceived) <= 0}
                            >
                                {isProcessing ? (
                                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        Confirm Paid
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Card Payment Modal */}
            <Dialog open={showCardModal} onOpenChange={setShowCardModal}>
                <DialogContent className="max-w-[calc(100%-2rem)] w-[350px] rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
                    <div className="bg-primary p-6 text-white text-center">
                        <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4 border border-white/30">
                            <CreditCard className="h-8 w-8 text-white" />
                        </div>
                        <h3 className="text-xl font-bold">Card Payment</h3>
                        <p className="text-white/80 text-sm">Swipe or Dip Card on Machine</p>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center px-1">
                                <span className="text-muted-foreground font-medium">Total Amount</span>
                                <span className="text-xl font-black text-primary">Rs.{total.toFixed(2)}</span>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Card Payment Amount</Label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-xl">Rs.</div>
                                    <Input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="0.00"
                                        value={cashReceived}
                                        onChange={(e) => {
                                            let value = e.target.value;
                                            value = value.replace(/[^0-9.]/g, "");
                                            const parts = value.split(".");
                                            if (parts.length > 2) {
                                                value = parts[0] + "." + parts.slice(1).join("");
                                            }
                                            setCashReceived(value);
                                        }}
                                        className="text-center text-3xl h-16 font-black border-2 border-primary/20 focus:border-primary pl-8 rounded-xl shadow-inner bg-slate-50"
                                        autoFocus
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="ghost"
                                className="flex-1 h-14 font-bold text-muted-foreground hover:bg-slate-100"
                                onClick={() => setShowCardModal(false)}
                                disabled={isProcessing}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-[1.5] h-14 text-lg font-bold gradient-warm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                onClick={handleCardPayment}
                                disabled={isProcessing || !cashReceived || parseFloat(cashReceived) <= 0}
                            >
                                {isProcessing ? (
                                    <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-5 w-5 mr-2" />
                                        Complete Paid
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Credit Payment Modal */}
            <Dialog open={showCreditModal} onOpenChange={setShowCreditModal}>
                <DialogContent className="max-w-[calc(100%-2rem)] w-[350px] rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
                    <div className="bg-primary p-6 text-white text-center">
                        <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4 border border-white/30">
                            <IndianRupee className="h-8 w-8 text-white" />
                        </div>
                        <h3 className="text-xl font-bold">Credit Payment</h3>
                        <p className="text-white/80 text-sm">Add to customer balance</p>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center px-1">
                                <span className="text-muted-foreground font-medium">Total Amount</span>
                                <span className="text-xl font-black text-primary">Rs.{total.toFixed(2)}</span>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Amount to Credit</Label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-xl">Rs.</div>
                                    <Input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="0.00"
                                        value={cashReceived}
                                        onChange={(e) => {
                                            let value = e.target.value;
                                            value = value.replace(/[^0-9.]/g, "");
                                            const parts = value.split(".");
                                            if (parts.length > 2) {
                                                value = parts[0] + "." + parts.slice(1).join("");
                                            }
                                            setCashReceived(value);
                                        }}
                                        className="text-center text-3xl h-16 font-black border-2 border-primary/20 focus:border-primary pl-8 rounded-xl shadow-inner bg-slate-50"
                                        autoFocus
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="ghost"
                                className="flex-1 h-14 font-bold text-muted-foreground hover:bg-slate-100"
                                onClick={() => setShowCreditModal(false)}
                                disabled={isProcessing}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-[1.5] h-14 text-lg font-bold gradient-warm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                onClick={handleCreditPayment}
                                disabled={isProcessing || !cashReceived || parseFloat(cashReceived) <= 0}
                            >
                                {isProcessing ? (
                                    <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-5 w-5 mr-2" />
                                        Complete Paid
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

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
                                {receiptData?.invoice_no === "PREVIEW" ? "Confirm Order Details" : "Receipt Preview"}
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
                                    <div>INV: {receiptData?.invoice_no === "PREVIEW" ? <span className="font-black text-primary">#DRAFT</span> : `#${receiptData?.invoice_no}`}</div>
                                    <div>DATE: {new Date().toLocaleDateString()}</div>
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

                        {/* Finalize Button for Draft Mode */}
                        {receiptData?.invoice_no === "PREVIEW" && (
                            <div className="p-6 bg-slate-50 border-t sticky bottom-0">
                                <Button
                                    className="w-full h-14 text-lg font-black gradient-warm shadow-lg shadow-primary/20 active:scale-95 transition-all"
                                    onClick={finalizeOrder}
                                    disabled={isProcessing}
                                >
                                    {isProcessing ? (
                                        <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <CheckCircle2 className="h-5 w-5 mr-2" />
                                            Finalize Order
                                        </>
                                    )}
                                </Button>
                                <p className="text-[10px] text-center text-muted-foreground mt-3 font-bold uppercase tracking-widest opacity-60">Please verify all items before finalizing</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Fixed Bottom Bar */}
            <div className="fixed bottom-16 left-0 right-0 px-4 py-4 bg-white/80 backdrop-blur-xl border-t border-black/[0.04] z-50">
                <div className="max-w-2xl mx-auto">
                    <button
                        className="w-full h-[54px] rounded-2xl bg-amber-500 hover:bg-amber-550 text-white font-semibold text-[17px] flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50"
                        onClick={showOrderPreview}
                        disabled={isProcessing}
                    >
                        {isProcessing ? (
                            <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <><Receipt className="h-5 w-5 opacity-90" /> Confirm &amp; Submit Bill</>
                        )}
                    </button>
                </div>
            </div>

            <WaiterBottomNav />
        </div>
    );
}
