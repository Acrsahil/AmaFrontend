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
    Wallet
} from "lucide-react";
import { toast } from "sonner";
import { MenuItem } from "@/lib/mockData";
import { clearTableOrder } from "@/lib/orderStorage";
import { cn } from "@/lib/utils";
import { CustomerSelector } from "@/components/pos/CustomerSelector";
import { createInvoice } from "@/api/index.js";
import { getCurrentUser } from "@/auth/auth";

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
type PaymentMethod = "cod" | "qr" | null;

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
    const [showSuccess, setShowSuccess] = useState(false);
    const [changeAmount, setChangeAmount] = useState<number | null>(null);
    const [orderId, setOrderId] = useState<string | null>(null);

    // Calculate totals
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

    const handleConfirmOrder = async () => {
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

        if (paymentTiming === "later") {
            try {
                await submitInvoice(false, 0);
                toast.success("Order Confirmed!", {
                    description: `Table ${state?.tableNumber} - Payment Pending`,
                    icon: <CheckCircle2 className="h-5 w-5 text-warning" />,
                });
                navigate('/waiter/tables');
            } catch (err) { }
        } else {
            // Pay Now flow - show appropriate modal
            if (paymentMethod === "cod") {
                setShowCashModal(true);
            } else {
                // QR Code payment
                setShowPaymentConfirmation(true);
            }
        }
    };

    const handleCashPayment = async () => {
        const receivedAmount = parseFloat(cashReceived);

        if (!cashReceived || isNaN(receivedAmount)) {
            toast.error("Please enter amount received");
            return;
        }

        // if (receivedAmount < total) {
        //     toast.error("Insufficient amount", {
        //         description: `Need Rs.${(total - receivedAmount).toFixed(2)} more`,
        //     });
        //     return;
        // }

        try {
            await submitInvoice(true, Math.min(total, receivedAmount), "CASH");
            const change = receivedAmount > total ? receivedAmount - total : 0;

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
        try {
            await submitInvoice(true, total, "QR");
            toast.success("Payment Confirmed!", {
                description: `Table ${state?.tableNumber} - Rs.${total.toFixed(2)} paid via QR Code`,
                icon: <CheckCircle2 className="h-5 w-5 text-success" />,
            });

            setShowPaymentConfirmation(false);
            navigate('/waiter/tables');
        } catch (err) { }
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
                                type="number"
                                min="0"
                                max="100"
                                placeholder="Discount %"
                                value={discountPercent || ""}
                                onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
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
                                            type="number"
                                            placeholder="0.00"
                                            value={cashReceived}
                                            onChange={(e) => setCashReceived(e.target.value)}
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
                                    disabled={isProcessing || !cashReceived || parseFloat(cashReceived) < total}
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
                            <div className="space-y-0.5">
                                <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">Customer Payment Amount</p>
                                <p className="text-3xl font-black text-primary">Rs.{total.toFixed(2)}</p>
                            </div>

                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-primary/20 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                                <div className="relative bg-white p-3 rounded-xl mx-auto border border-primary/10 shadow-xl flex flex-col items-center overflow-hidden">
                                    <img 
                                        src="/qr.png" 
                                        alt="QR Code" 
                                        className="h-48 w-48 object-cover" 
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.src = "https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=AMABAKERY_PAYMENT";
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
                                    className="flex-[1.5] h-10 text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all active:scale-95"
                                    onClick={handleQRPayment}
                                    disabled={isProcessing}
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
                            className="w-full btn-touch gradient-warm shadow-warm-lg"
                            onClick={handleConfirmOrder}
                            disabled={isProcessing}
                        >
                            {isProcessing ? (
                                <>
                                    <div className="h-5 w-5 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="h-5 w-5 mr-2" />
                                    {paymentTiming === 'later' ? 'Confirm Order' : 'Proceed to Payment'}
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Bottom Navigation */}
            <WaiterBottomNav />
        </div>
    );
}
