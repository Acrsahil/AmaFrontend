import re

with open('src/pages/waiter/Checkout.tsx', 'r') as f:
    text = f.read()

# Find where the Dialogs — untouched comment is
idx = text.find("{/* Dialogs — untouched */}")
if idx == -1:
    print("Comment not found!")
    exit(1)

# we slice up to the untouched array, then add the correct remaining UI
new_text = text[:idx] + """
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
            <div className="fixed bottom-16 left-0 right-0 px-4 py-3 bg-white border-t border-stone-200 shadow-[0_-4px_10px_rgba(0,0,0,0.03)] z-50">
                <div className="max-w-2xl mx-auto flex items-center gap-4">
                    <div className="text-right shrink-0">
                        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest leading-none mb-1">Payable Total</p>
                        <p className="text-xl font-black text-primary leading-none">Rs.{total.toFixed(2)}</p>
                    </div>
                    <button
                        className="flex-1 h-[52px] rounded-[16px] bg-amber-500 hover:bg-amber-600 text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                        onClick={showOrderPreview}
                        disabled={isProcessing}
                    >
                        {isProcessing ? (
                            <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <><Receipt className="h-4 w-4" /> Confirm &amp; Submit Bill</>
                        )}
                    </button>
                </div>
            </div>

            <WaiterBottomNav />
        </div>
    );
}
"""

with open('src/pages/waiter/Checkout.tsx', 'w') as f:
    f.write(new_text)

