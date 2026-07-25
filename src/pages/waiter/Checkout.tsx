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
    ChevronRight
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
    const [paymentTiming, setPaymentTiming] = useState<PaymentTiming>(null);
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
                    setBranchInfo(data?.data || data);
                } catch (err) {
                    console.error("Failed to load branch info", err);
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

        if (paymentTiming === "later" && !customer) {
            toast.error("Customer required for Pay Later", {
                description: "Please select a customer first",
            });
            setIsCustomerSelectorOpen(true);
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
        setCashReceived(total.toFixed(2));
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
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 pb-40">
            <MobileHeader
                title="Checkout"
                showBack
            />

            <div className="p-4 space-y-4 max-w-2xl mx-auto">
                <Card className="card-elevated p-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <User className="h-5 w-5 text-primary" />
                            Customer Information
                        </h3>
                    </div>

                    <div className="space-y-4">
                        <CustomerSelector
                            selectedCustomerId={customer?.id}
                            onSelect={(c) => setCustomer(c)}
                            searchTerm={customerSearchTerm}
                            onSearchChange={setCustomerSearchTerm}
                            open={isCustomerSelectorOpen}
                            onOpenChange={setIsCustomerSelectorOpen}
                        />

                        <Separator className="my-2" />

                        <div>
                            <Label htmlFor="specialInstructions" className="text-sm font-medium">Special Instructions</Label>
                            <Input
                                id="specialInstructions"
                                type="text"
                                placeholder="Any special requests?"
                                value={specialInstructions}
                                onChange={(e) => setSpecialInstructions(e.target.value)}
                                className="mt-1"
                            />
                        </div>
                    </div>
                </Card>

                {/* Order Summary Card */}
                <Card className="card-elevated p-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-12 w-12 rounded-xl bg-white p-1 shadow-sm border border-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                            <img src="/logos/logo1white.jfif" alt="Logo" className="h-full w-full object-cover" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight text-primary">Ama Bakery</h2>
                            <p className="text-sm text-muted-foreground font-medium">
                                Table {state.tableNumber}
                            </p>
                        </div>
                    </div>

                    <Separator className="my-4" />

                    {/* Items List */}
                    <div className="space-y-3 mb-4">
                        {state.cart.map((cartItem, index) => (
                            <div
                                key={cartItem.item.id}
                                className="flex justify-between items-start p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                <div className="flex-1">
                                    <h3 className="font-medium">{cartItem.item.name}</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Rs.{cartItem.item.price} × {cartItem.quantity}
                                    </p>
                                    {cartItem.notes && (
                                        <p className="text-xs text-primary mt-1 flex items-center gap-1">
                                            <MessageSquare className="h-3 w-3" />
                                            {cartItem.notes}
                                        </p>
                                    )}
                                </div>
                                <span className="font-semibold text-lg">
                                    Rs.{(cartItem.item.price * cartItem.quantity).toFixed(2)}
                                </span>
                            </div>
                        ))}
                    </div>

                    <Separator className="my-4" />

                    {/* Billing Details */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-muted-foreground">
                            <span>Subtotal</span>
                            <span>Rs.{subtotal.toFixed(2)}</span>
                        </div>

                        <div className="flex flex-col gap-2 py-2 animate-in fade-in slide-in-from-top-1">
                            {taxEnabled && (
                                <div className="flex justify-between items-center text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <span>Tax</span>
                                        <Switch
                                            checked={taxEnabled}
                                            onCheckedChange={setTaxEnabled}
                                            className="scale-75 data-[state=checked]:bg-primary"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center bg-white rounded-lg px-2 border w-20">
                                            <Input
                                                type="number"
                                                value={taxRate}
                                                onChange={(e) => setTaxRate(Number(e.target.value))}
                                                className="w-12 h-7 p-0 text-center border-none bg-transparent text-xs font-bold focus-visible:ring-0"
                                            />
                                            <span className="text-[10px] font-bold text-slate-400">%</span>
                                        </div>
                                        <span className="font-bold text-foreground">Rs.{taxAmount.toFixed(2)}</span>
                                    </div>
                                </div>
                            )}

                            {!taxEnabled && (
                                <div className="flex justify-between items-center text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <span>Tax</span>
                                        <Switch
                                            checked={taxEnabled}
                                            onCheckedChange={setTaxEnabled}
                                            className="scale-75"
                                        />
                                    </div>
                                    <span className="text-xs font-medium text-slate-300">Disabled</span>
                                </div>
                            )}
                            {taxEnabled && (
                                <div className="flex gap-1 justify-end">
                                    {[5, 10, 15].map((rate) => (
                                        <button
                                            key={rate}
                                            onClick={() => setTaxRate(rate)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm border",
                                                taxRate === rate
                                                    ? "bg-primary text-white border-primary"
                                                    : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
                                            )}
                                        >
                                            {rate}%
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {discountPercent > 0 && (
                            <div className="flex justify-between text-success">
                                <span className="flex items-center gap-1">
                                    <Percent className="h-4 w-4" />
                                    Discount ({discountPercent}%)
                                </span>
                                <span>-Rs.{discountAmount.toFixed(2)}</span>
                            </div>
                        )}

                        <Separator className="my-3" />

                        <div className="flex justify-between items-center text-xl font-bold">
                            <span>Total</span>
                            <span className="text-primary flex items-center gap-1">
                                <IndianRupee className="h-5 w-5" />
                                {total.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </Card>


                {/* Discount Card */}
                <Card className="card-elevated p-6 animate-slide-up" style={{ animationDelay: '300ms' }}>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Percent className="h-5 w-5 text-primary" />
                        Apply Discount (Optional)
                    </h3>

                    <div className="flex gap-3">
                        <div className="flex-1">
                            <Input
                                type="text"
                                inputMode="numeric"
                                placeholder="Discount %"
                                value={discountPercent ?? ""}
                                onChange={(e) => {
                                    let value = e.target.value.replace(/\D/g, ""); // only digits

                                    if (value === "") {
                                        setDiscountPercent(0);
                                        return;
                                    }

                                    let num = Number(value);

                                    if (num > 100) num = 100;

                                    setDiscountPercent(num);
                                }}
                            />
                        </div>
                        <div className="flex gap-2">
                            {[5, 10, 15].map((percent) => (
                                <Button
                                    key={percent}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setDiscountPercent(percent)}
                                    className="min-w-[60px]"
                                >
                                    {percent}%
                                </Button>
                            ))}
                        </div>
                    </div>
                </Card>

                {/* Payment Timing Card */}
                <Card className="card-elevated p-6 animate-slide-up" style={{ animationDelay: '400ms' }}>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-primary" />
                        Payment Option
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => {
                                setPaymentTiming("now");
                                setShowPaymentConfirmation(false);
                            }}
                            className={cn(
                                "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 hover:scale-105",
                                paymentTiming === "now"
                                    ? "border-primary bg-primary/10 shadow-lg"
                                    : "border-border hover:border-primary/50"
                            )}
                        >
                            <Banknote className={cn(
                                "h-8 w-8",
                                paymentTiming === "now" ? "text-primary" : "text-muted-foreground"
                            )} />
                            <span className={cn(
                                "font-semibold",
                                paymentTiming === "now" ? "text-primary" : "text-foreground"
                            )}>
                                Pay Now
                            </span>
                        </button>

                        <button
                            onClick={() => {
                                setPaymentTiming("later");
                                setPaymentMethod(null);
                                setShowPaymentConfirmation(false);
                                if (!customer) {
                                    setIsCustomerSelectorOpen(true);
                                    toast.info("Please select a customer for Pay Later");
                                }
                            }}
                            className={cn(
                                "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 hover:scale-105",
                                paymentTiming === "later"
                                    ? "border-warning bg-warning/10 shadow-lg"
                                    : "border-border hover:border-warning/50"
                            )}
                        >
                            <CheckCircle2 className={cn(
                                "h-8 w-8",
                                paymentTiming === "later" ? "text-warning" : "text-muted-foreground"
                            )} />
                            <span className={cn(
                                "font-semibold",
                                paymentTiming === "later" ? "text-warning" : "text-foreground"
                            )}>
                                Pay Later
                            </span>
                        </button>
                    </div>
                </Card>

                {/* Payment Method Card - Only show if Pay Now is selected */}
                {paymentTiming === "now" && !showPaymentConfirmation && (
                    <Card className="card-elevated p-6 animate-slide-up" style={{ animationDelay: '500ms' }}>
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-primary" />
                            Select Payment Method
                        </h3>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setPaymentMethod("cod")}
                                className={cn(
                                    "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 hover:scale-105",
                                    paymentMethod === "cod"
                                        ? "border-success bg-success/10 shadow-lg"
                                        : "border-border hover:border-success/50"
                                )}
                            >
                                <Banknote className={cn(
                                    "h-8 w-8",
                                    paymentMethod === "cod" ? "text-success" : "text-muted-foreground"
                                )} />
                                <span className={cn(
                                    "font-semibold",
                                    paymentMethod === "cod" ? "text-success" : "text-foreground"
                                )}>
                                    Cash (COD)
                                </span>
                            </button>

                            <button
                                onClick={() => setPaymentMethod("qr")}
                                className={cn(
                                    "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 hover:scale-105",
                                    paymentMethod === "qr"
                                        ? "border-primary bg-primary/10 shadow-lg"
                                        : "border-border hover:border-primary/50"
                                )}
                            >
                                <QrCode className={cn(
                                    "h-8 w-8",
                                    paymentMethod === "qr" ? "text-primary" : "text-muted-foreground"
                                )} />
                                <span className={cn(
                                    "font-semibold",
                                    paymentMethod === "qr" ? "text-primary" : "text-foreground"
                                )}>
                                    QR Code
                                </span>
                            </button>

                            <button
                                onClick={() => setPaymentMethod("card")}
                                className={cn(
                                    "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 hover:scale-105",
                                    paymentMethod === "card"
                                        ? "border-primary bg-primary/10 shadow-lg"
                                        : "border-border hover:border-primary/50"
                                )}
                            >
                                <CreditCard className={cn(
                                    "h-8 w-8",
                                    paymentMethod === "card" ? "text-primary" : "text-muted-foreground"
                                )} />
                                <span className={cn(
                                    "font-semibold",
                                    paymentMethod === "card" ? "text-primary" : "text-foreground"
                                )}>
                                    Card
                                </span>
                            </button>

                            <button
                                onClick={() => setPaymentMethod("credit")}
                                className={cn(
                                    "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 hover:scale-105",
                                    paymentMethod === "credit"
                                        ? "border-primary bg-primary/10 shadow-lg"
                                        : "border-border hover:border-primary/50"
                                )}
                            >
                                <IndianRupee className={cn(
                                    "h-8 w-8",
                                    paymentMethod === "credit" ? "text-primary" : "text-muted-foreground"
                                )} />
                                <span className={cn(
                                    "font-semibold",
                                    paymentMethod === "credit" ? "text-primary" : "text-foreground"
                                )}>
                                    Credit
                                </span>
                            </button>
                        </div>
                    </Card>
                )}

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

                                                // allow only numbers + one dot
                                                value = value.replace(/[^0-9.]/g, "");

                                                // prevent multiple dots
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
                                <div className="relative bg-white p-2 rounded-xl mx-auto border border-primary/10 shadow-md flex flex-col items-center overflow-hidden">
                                    <img
                                        src="/qr.png"
                                        alt="QR Code"
                                        className="h-28 w-28 object-cover"
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.src = "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=AMABAKERY_PAYMENT";
                                        }}
                                    />
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
            </div>

            {/* Fixed Bottom Actions */}
            <div className="fixed bottom-16 left-0 right-0 p-4 bg-card border-t shadow-lg z-50">
                <div className="max-w-2xl mx-auto space-y-3">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Total Amount</span>
                        <span className="text-2xl font-bold text-primary">Rs.{total.toFixed(2)}</span>
                    </div>

                    <div className="flex gap-3">
                        <Button
                            className="w-full btn-touch gradient-warm shadow-warm-lg h-14 text-xl font-black rounded-2xl"
                            onClick={showOrderPreview}
                            disabled={isProcessing}
                        >
                            {isProcessing ? (
                                <>
                                    <div className="h-5 w-5 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Receipt className="h-6 w-6 mr-3" />
                                    Confirm & View Bill
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>



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

            {/* Bottom Navigation */}
            <WaiterBottomNav />
        </div>
    );
}
