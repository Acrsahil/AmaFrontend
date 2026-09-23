import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
    Search,
    ShoppingCart,
    Trash2,
    Plus,
    Minus,
    User,
    Phone,
    CreditCard,
    Banknote,
    QrCode,
    Receipt,
    LogOut,
    Key,
    Clock,
    Printer,
    X,
    CheckCircle2,
    Percent,
    ChevronRight,
    ChevronLeft,
    Monitor,
    Coffee,
    Cake,
    Cookie,
    Pizza,
    Sandwich,
    Soup,
    Pencil,
    LayoutDashboard,
    IndianRupee,
    Keyboard,
    Menu,
    Layers,
    Hash,
    LayoutGrid
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { logout, getCurrentUser } from "../../auth/auth";
import { ChangePasswordModal } from "@/components/auth/ChangePasswordModal";
import { CustomerSelector } from "@/components/pos/CustomerSelector";
import { fetchProducts, fetchCategories, fetchSuperCategories, createInvoice, fetchInvoices, fetchBranch, fetchTables } from "@/api/index.js";
import { MenuItem, User as UserType } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";


interface CartItemData {
    item: MenuItem;
    quantity: number;
    notes?: string;
}

export default function CounterPOS() {
    const navigate = useNavigate();
    const location = useLocation();
    const [operator, setOperator] = useState<UserType | null>(null);
    const [products, setProducts] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [rawCategories, setRawCategories] = useState<any[]>([]);
    const [superCategories, setSuperCategories] = useState<any[]>([]);
    const [selectedSuperCategory, setSelectedSuperCategory] = useState<number | null>(null);
    const [floors, setFloors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [tabs, setTabs] = useState([{
        id: "1",
        cart: [] as CartItemData[],
        customer: null as any,
        selectedFloor: null as any,
        tableNo: "",
        taxEnabled: false,
        taxRate: 5,
        discountPercent: 0
    }]);
    const [activeTabId, setActiveTabId] = useState("1");



    const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId) || tabs[0], [tabs, activeTabId]);

    // Stable ref so async handlers (checkout, etc.) always target the right tab
    const activeTabIdRef = useRef(activeTabId);
    useEffect(() => {
        activeTabIdRef.current = activeTabId;
    }, [activeTabId]);

    const updateActiveTab = (updates: Partial<typeof activeTab>) => {
        const tid = activeTabIdRef.current;
        setTabs(prev => prev.map(t => t.id === tid ? { ...t, ...updates } : t));
    };

    const cart = activeTab.cart;
    const customer = activeTab.customer;
    const selectedFloor = activeTab.selectedFloor;
    const tableNo = activeTab.tableNo;
    const taxEnabled = activeTab.taxEnabled;
    const taxRate = activeTab.taxRate;
    const discountPercent = activeTab.discountPercent;

    const setCart = (valOrUpdater: any) => {
        const tid = activeTabIdRef.current;
        setTabs(prev => prev.map(t => {
            if (t.id === tid) {
                const newCart = typeof valOrUpdater === 'function' ? valOrUpdater(t.cart) : valOrUpdater;
                return { ...t, cart: newCart };
            }
            return t;
        }));
    };
    const setCustomer = (val: any) => updateActiveTab({ customer: val });
    const setSelectedFloor = (val: any) => updateActiveTab({ selectedFloor: val });
    const setTableNo = (valOrUpdater: any) => {
        const tid = activeTabIdRef.current;
        setTabs(prev => prev.map(t => {
            if (t.id === tid) {
                const newVal = typeof valOrUpdater === 'function' ? valOrUpdater(t.tableNo) : valOrUpdater;
                return { ...t, tableNo: newVal };
            }
            return t;
        }));
    };
    const setTaxEnabled = (val: any) => updateActiveTab({ taxEnabled: val });
    const setTaxRate = (val: any) => updateActiveTab({ taxRate: val });
    const setDiscountPercent = (valOrUpdater: any) => {
        const tid = activeTabIdRef.current;
        setTabs(prev => prev.map(t => {
            if (t.id === tid) {
                const newVal = typeof valOrUpdater === 'function' ? valOrUpdater(t.discountPercent) : valOrUpdater;
                return { ...t, discountPercent: newVal };
            }
            return t;
        }));
    };

    // Billing States
    const [paymentMethod, setPaymentMethod] = useState<"cash" | "qr" | "online" | "card" | "credit" | null>(null);
    // Virtual keyboard disabled - using physical keyboard
    // const [activeKeypadField, setActiveKeypadField] = useState<'cash' | 'discount' | 'customer' | 'productSearch' | 'table' | null>(null);
    // const [showKeypad, setShowKeypad] = useState(false);
    // const keyboardRef = useRef<HTMLDivElement>(null);
    // const backspaceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const backspaceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    const [customerSearch, setCustomerSearch] = useState("");
    const [cashReceived, setCashReceived] = useState("");
    const [receiptData, setReceiptData] = useState<any>(null);
    const [paidAmount, setPaidAmount] = useState(0);
    const [dueAmount, setDueAmount] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [branchInfo, setBranchInfo] = useState<any>(null);

    // Modals
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showReceipt, setShowReceipt] = useState(false);
    const [autoPrint, setAutoPrint] = useState(false);
    const [showQtyDialog, setShowQtyDialog] = useState(false);
    const [qtyEditItem, setQtyEditItem] = useState<CartItemData | null>(null);
    const [qtyInput, setQtyInput] = useState("");
    const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

    useEffect(() => {
        const user = getCurrentUser();
        if (user) {
            setOperator(user as any);
            loadData();
        } else {
            navigate('/login');
        }
    }, [navigate]);

    const loadData = async () => {
        setLoading(true);
        const user = getCurrentUser();
        console.log("🏪 (POS) Starting data fetch for user:", user);

        try {
            const [productsResponse, categoriesResponse, superCategoriesResponse, branchResponse, floorsResponse] = await Promise.all([
                fetchProducts({ page_size: 1000 }).catch(err => {
                    console.error("❌ fetchProducts failed:", err);
                    return null;
                }),
                fetchCategories().catch(err => {
                    console.error("❌ fetchCategories failed:", err);
                    return null;
                }),
                fetchSuperCategories().catch(err => {
                    console.error("⚠️ fetchSuperCategories failed (non-critical):", err);
                    return null;
                }),
                user?.branch_id ? fetchBranch(user.branch_id).catch(err => {
                    console.error("⚠️ fetchBranch failed (non-critical):", err);
                    return null;
                }) : Promise.resolve(null),
                fetchTables().catch(err => {
                    console.error("⚠️ fetchTables failed (non-critical):", err);
                    return null;
                })
            ]);

            // 0. Process Super Categories
            if (Array.isArray(superCategoriesResponse)) {
                setSuperCategories(superCategoriesResponse);
            }

            // 1. Process Branch Info (Non-critical)
            if (branchResponse && branchResponse.success) {
                setBranchInfo(branchResponse.data);
            } else if (branchResponse) {
                // If it's the raw branch data without 'success' wrapper (check API)
                setBranchInfo(branchResponse);
            }

            // Floors
            if (floorsResponse) {
                setFloors(floorsResponse);
            }

            // 2. Process Products
            const results = productsResponse?.results || (Array.isArray(productsResponse) ? productsResponse : []);
            if (results.length > 0) {
                const mappedProducts: any[] = results.map((p: any) => ({
                    id: p.id.toString(),
                    name: p.name,
                    price: parseFloat(p.selling_price) || 0,
                    category: p.category_name,
                    available: p.is_available,
                    image: p.image || undefined
                }));
                setProducts(mappedProducts);
            } else {
                console.warn("⚠️ Products data is missing or invalid format.");
                if (!categoriesResponse) {
                    // Both critical items failed
                    throw new Error("Critical POS data (products/categories) failed to load.");
                }
            }

            // 3. Process Categories (Critical for UI but we can default to All)
            if (Array.isArray(categoriesResponse)) {
                setRawCategories(categoriesResponse);
                const categoryNames = ["All", ...categoriesResponse.map((cat: any) => cat.name).sort()];
                setCategories(categoryNames);
            } else {
                setCategories(["All"]);
                console.warn("⚠️ Categories data is missing, defaulting to 'All'.");
            }

            // Always ensure "All" is selected if it was the previous intent
            setSelectedCategory("All");

        } catch (err: any) {
            console.error("🚨 POS Load critical failure:", err);
            toast.error("POS system failed to initialize properly. Please contact support.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!showQtyDialog) return;

            if (/^[0-9]$/.test(e.key)) {
                setQtyInput(prev => (prev.length < 3 ? prev + e.key : prev));
            } else if (e.key === "Backspace") {
                setQtyInput(prev => prev.slice(0, -1));
            } else if (e.key === "Enter") {
                handleQtySubmit();
            } else if (e.key === "Escape") {
                setShowQtyDialog(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [showQtyDialog, qtyInput, qtyEditItem]);

    useEffect(() => {
        if (showReceipt && autoPrint) {
            const timer = setTimeout(() => {
                // window.print(); // Disabled system print
                setAutoPrint(false);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [showReceipt, autoPrint]);

        // Handle loading specific order if passed via state
    useEffect(() => {
        if (location.state?.orderId && products.length > 0) {
            loadSpecificOrder(location.state.orderId);
        }
    }, [location.state?.orderId, products]);

    // Close virtual keyboard when clicking/tapping outside of it and outside
    // input fields that control it. Because there is no blocking backdrop overlay,
    // Virtual keyboard removed - no outside click handler needed
    /* useEffect(() => {
        if (!showKeypad) return;
        const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
            const target = e.target as HTMLElement;
            if (target?.closest('.global-keyboard')) return;
            if (target?.closest('.keyboard-input')) return;
            setShowKeypad(false);
            setActiveKeypadField(null);
            (document.activeElement as HTMLElement)?.blur();
        };
        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('touchstart', handleOutsideClick);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('touchstart', handleOutsideClick);
        };
    }, [showKeypad]); */

    const loadSpecificOrder = async (orderId: number) => {
        try {
            const res = await fetchInvoices({ date: new Date().toISOString().split('T')[0] });
            const data = res.results || res;
            if (Array.isArray(data)) {
                const order = data.find((inv: any) => inv.id === orderId);
                if (order) {
                    const mappedItems = order.items.map((item: any) => ({
                        item: products.find(p => p.id === item.product) || {
                            id: item.product,
                            name: item.product_name || `Product #${item.product}`,
                            price: parseFloat(item.unit_price),
                            category: "Unknown",
                            available: true
                        },
                        quantity: item.quantity
                    }));
                    setCart(mappedItems);
                    setCustomer(order.customer ? { id: order.customer, name: order.customer_name } : null);
                    setTaxEnabled(parseFloat(order.tax_amount) > 0);
                    // Estimate tax rate if possible
                    const sub = order.items.reduce((sum: number, i: any) => sum + (parseFloat(i.unit_price) * i.quantity), 0);
                    if (sub > 0) {
                        setTaxRate(Math.round((parseFloat(order.tax_amount) / sub) * 100));
                    }
                    setPaidAmount(parseFloat(order.paid_amount || 0));
                    setDueAmount(parseFloat(order.due_amount || 0));
                    setShowReceipt(true);

                    // Auto print if requested
                    if (location.state?.autoPrint) {
                        setTimeout(() => {
                            // window.print(); // Disabled system print
                        }, 500);
                    }

                    // Clear state so it doesn't reload on every render
                    window.history.replaceState({}, document.title);
                }
            }
        } catch (err) {
            console.error("Failed to load specific order", err);
            toast.error("Failed to load order for printing");
        }
    };


    const visibleCategories = useMemo(() => {
        if (!selectedSuperCategory) return categories;
        const sc = superCategories.find(s => s.id === selectedSuperCategory);
        if (!sc) return categories;
        const catNamesInSC = rawCategories
            .filter((c: any) => c.supercategory === selectedSuperCategory)
            .map((c: any) => c.name);
        return ["All", ...catNamesInSC.sort()];
    }, [categories, rawCategories, superCategories, selectedSuperCategory]);

    const filteredItems = useMemo(() => {
        let items = products;
        // Filter by supercategory first
        if (selectedSuperCategory) {
            const catNamesInSC = rawCategories
                .filter((c: any) => c.supercategory === selectedSuperCategory)
                .map((c: any) => c.name);
            items = items.filter(item => catNamesInSC.includes(item.category));
        }
        if (selectedCategory && selectedCategory !== "All") {
            items = items.filter(item => item.category === selectedCategory);
        }
        if (searchQuery.trim()) {
            items = items.filter(item =>
                item.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        return items.sort((a, b) => a.name.localeCompare(b.name));
    }, [products, rawCategories, selectedSuperCategory, selectedCategory, searchQuery]);

    const subtotal = useMemo(() =>
        cart.reduce((sum, c) => sum + (c.item.price * c.quantity), 0),
        [cart]
    );

    const taxAmount = useMemo(() =>
        taxEnabled ? subtotal * (taxRate / 100) : 0,
        [subtotal, taxEnabled, taxRate]
    );

    const discountAmount = useMemo(() =>
        (subtotal * discountPercent) / 100,
        [subtotal, discountPercent]
    );

    const total = subtotal + taxAmount - discountAmount;

    const addToCart = (item: MenuItem) => {
        setCart(prev => {
            const existing = prev.find(c => c.item.id === item.id);
            if (existing) {
                return prev.map(c =>
                    c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
                );
            }
            return [...prev, { item, quantity: 1 }];
        });
    };

    const updateQuantity = (itemId: string, delta: number) => {
        setCart(prev => prev.map(c => {
            if (c.item.id === itemId) {
                const newQty = Math.max(0, c.quantity + delta);
                return { ...c, quantity: newQty };
            }
            return c;
        }).filter(c => c.quantity > 0));
    };

    const setQuantity = (itemId: string, amount: number) => {
        setCart(prev => prev.map(c => {
            if (c.item.id === itemId) {
                return { ...c, quantity: Math.max(0, amount) };
            }
            return c;
        }).filter(c => c.quantity > 0));
    };

    const handleQtyEditOpen = (item: CartItemData) => {
        setQtyEditItem(item);
        setQtyInput("");
        setShowQtyDialog(true);
    };

    const handleQtySubmit = () => {
        if (qtyEditItem && qtyInput) {
            setQuantity(qtyEditItem.item.id, parseInt(qtyInput));
        }
        setShowQtyDialog(false);
        setQtyEditItem(null);
        setQtyInput("");
    };

    const deleteFromCart = (itemId: string) => {
        setCart(prev => prev.filter(c => c.item.id !== itemId));
    };

    const handleCheckout = () => {
        if (cart.length === 0) {
            toast.error("Cart is empty");
            return;
        }
        setCashReceived("");
        setPaymentMethod('cash');
        setShowCheckoutModal(true);
    };

    const processPayment = async () => {
        if (!paymentMethod) {
            toast.error("Please select payment method");
            return;
        }
        if (!cashReceived || parseFloat(cashReceived) <= 0) {
            toast.error("Enter a valid amount");
            return;
        }

        setIsProcessing(true);
        const user = getCurrentUser();
        const branchId = user?.branch_id || branchInfo?.id || (user as any)?.branch;

        try {
            const invoiceData = {
                branch: branchId,
                customer: customer?.id || null,
                floor: null,
                table_no: 0,
                invoice_type: "SALE",
                description: "Takeaway",
                notes: "Takeaway",
                tax_amount: taxAmount,
                discount: discountAmount,
                paid_amount: Math.min(total, parseFloat(cashReceived) || total),
                payment_method: paymentMethod?.toUpperCase(),
                items: cart.map(c => ({
                    item_type: "PRODUCT",
                    product: parseInt(c.item.id),
                    quantity: c.quantity,
                    unit_price: c.item.price,
                    discount_amount: 0,
                    description: c.notes || ""
                }))
            };

            const createdInvoice = await createInvoice(invoiceData);

            setReceiptData({
                cart: [...cart],
                subtotal,
                taxAmount,
                taxRate,
                discountAmount,
                discountPercent,
                total,
                cashReceived,
                paymentMethod,
                customer,
                orderId: createdInvoice?.id || createdInvoice?.invoice_number
            });

            // Clear the completed tab
            removeTab(activeTabId);
            setPaymentMethod(null);
            setCashReceived("");

            setIsProcessing(false);
            setShowCheckoutModal(false);
            setShowSuccessModal(true);
            toast.success("Transaction completed successfully!");
        } catch (err: any) {
            toast.error(err.message || "Failed to process payment");
            setIsProcessing(false);
        }
    };

    const resetOrder = () => {
        removeTab(activeTabId);
        setPaymentMethod(null);
        setCashReceived("");
        setShowSuccessModal(false);
    };

    const handleLogout = () => {
        logout();
    };

    const addTab = () => {
        const newTabId = Date.now().toString();
        setTabs(prev => [...prev, {
            id: newTabId,
            cart: [],
            customer: null,
            selectedFloor: null,
            tableNo: "",
            taxEnabled: false,
            taxRate: 5,
            discountPercent: 0
        }]);
        setActiveTabId(newTabId);
    };

    const removeTab = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();

        if (tabs.length === 1) {
            // Only one tab: reset it in-place instead of replacing the entire array.
            // Replacing the array creates a new id, which breaks stale closures.
            setTabs(prev => prev.map(t => t.id === id ? {
                ...t,
                cart: [],
                customer: null,
                selectedFloor: null,
                tableNo: "",
                taxEnabled: false,
                taxRate: 5,
                discountPercent: 0
            } : t));
            // Keep the same tab id active
            return;
        }

        const filtered = tabs.filter(t => t.id !== id);
        if (activeTabId === id) {
            const idx = tabs.findIndex(t => t.id === id);
            const nextIdx = idx >= filtered.length ? filtered.length - 1 : idx;
            const nextId = filtered[nextIdx].id;
            setActiveTabId(nextId);
            activeTabIdRef.current = nextId;
        }
        setTabs(filtered);
    };

    const handlePrintKOT = () => {
        if (cart.length === 0) {
            toast.error("Cart is empty");
            return;
        }

        const itemRows = cart.map((item: any, index: number) => `
            <div class="receipt-item-grid">
                <div>${index + 1}</div>
                <div>
                    ${item.item.name}
                    ${item.notes ? `<div style="font-size: 8pt; text-transform: none; margin-top: 1mm;">"${item.notes}"</div>` : ""}
                </div>
                <div style="text-align: right;">${item.quantity}</div>
            </div>
        `).join("") || "";

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"/>
    <title>KOT - Ama Bakery</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; color: black !important; background: white !important; font-family: 'Courier New', Courier, monospace !important; }
        body { width: 80mm; padding: 4mm; }
        .thermal-header { text-align: center; margin-bottom: 4mm; }
        .thermal-title { font-size: 20pt; font-weight: bold; margin-bottom: 1mm; letter-spacing: 1px; text-transform: uppercase; border-bottom: 2px solid black; padding-bottom: 2px; }
        .thermal-info-grid { display: grid; grid-template-columns: 1fr 1fr; font-size: 9pt; margin-bottom: 4mm; line-height: 1.4; gap: 2mm; text-align: left; }
        .thermal-divider { border-top: 1px dashed black; margin: 3mm 0; }
        .receipt-item-grid { display: grid; grid-template-columns: 8mm 1fr 12mm; gap: 1mm; font-size: 11pt; margin-bottom: 2mm; text-transform: uppercase; font-weight: bold; }
        .thermal-footer { text-align: center; margin-top: 6mm; font-size: 10pt; font-weight: bold; text-transform: uppercase; border-top: 2px solid black; padding-top: 2px; }
        
        @media print {
            @page { size: 80mm auto; margin: 0; }
            body { width: 80mm; padding: 4mm; }
        }
    </style>
</head>
<body>
    <div class="thermal-header">
        <div class="thermal-title">** KOT **</div>
        <div style="font-size: 12pt; font-weight: bold;">COUNTER TICKET</div>
    </div>
    
    <div class="thermal-info-grid">
        <div>
            <div>DATE: ${new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            <div>CSHR: ${operator?.name || "Counter"}</div>
        </div>
        <div style="text-align: right;">
            <div>CUST: ${customer ? customer.name : "Walk-in"}</div>
            <div>${tabs.find(t => t.id === activeTabId) ? `TAB: ${tabs.findIndex(t => t.id === activeTabId) + 1}` : ""}</div>
        </div>
    </div>

    <div class="thermal-divider"></div>
    
    <div class="receipt-item-grid" style="border-bottom: 1px solid black; padding-bottom: 1mm; margin-bottom: 2mm; font-size: 10pt;">
        <div>SN</div>
        <div>ITEM</div>
        <div style="text-align: right;">QTY</div>
    </div>
    
    ${itemRows}

    <div class="thermal-divider"></div>
    
    <div class="thermal-footer">
        --- NOT A BILL ---
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

    const handlePrint = () => {
        const pCart = receiptData?.cart || cart;
        const pSubtotal = receiptData?.subtotal ?? subtotal;
        const pTaxAmount = receiptData?.taxAmount ?? taxAmount;
        const pTaxRate = receiptData?.taxRate ?? taxRate;
        const pDiscountAmount = receiptData?.discountAmount ?? discountAmount;
        const pTotal = receiptData?.total ?? total;
        const pCashReceived = receiptData?.cashReceived ?? cashReceived;
        const pCustomer = receiptData?.customer ?? customer;

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
        <div class="thermal-title">${branchInfo?.receipt_header || "AMA BAKERY"}</div>
        <div class="thermal-subtitle">Tel: ${branchInfo?.phone || "9816020731"}</div>
        ${branchInfo?.location ? `<div class="thermal-subtitle">${branchInfo.location.toUpperCase()}</div>` : ""}
    </div>
    
    <div class="thermal-divider"></div>
    
    <div class="thermal-info-grid">
        <div class="thermal-info-left">
            <div>INV: #POS-${Date.now().toString().slice(-6)}</div>
            <div>DATE: ${new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <div class="thermal-info-right">
            <div>CSHR: ${operator?.name || "Counter"}</div>
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
            <span>PAID</span>
        </div>
        <div class="thermal-divider"></div>
    </div>

    <div class="thermal-footer">
        ${branchInfo?.receipt_footer || "THANK YOU FOR YOUR VISIT!"}
    </div>
    <div class="thermal-barcode">
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

    const hideHeader = location.pathname.includes('/admin/dashboard');

    return (
        <div className={cn("bg-stone-50 flex flex-col overflow-hidden font-sans", hideHeader ? "h-[calc(100vh-64px)] md:h-[calc(100vh-64px)]" : "h-screen")}>
            {/* Top Header */}
            {!hideHeader && (
                <header className="h-16 bg-white border-b px-4 flex items-center justify-between shrink-0 z-10 gap-4">
                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-xl h-10 w-10 bg-slate-100 hover:bg-slate-200 transition-colors"
                            onClick={() => window.dispatchEvent(new CustomEvent("open-counter-sidebar"))}
                        >
                            <Menu className="h-5 w-5 text-slate-700" />
                        </Button>
                        {(operator?.role === "ADMIN" || operator?.role === "BRANCH_MANAGER" || operator?.role === "SUPER_ADMIN") && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate('/admin/dashboard')}
                                className="mr-2 rounded-xl text-slate-400 hover:text-primary hover:bg-primary/5 h-10 w-10"
                                title="Back to Admin Dashboard"
                            >
                                <LayoutDashboard className="h-5 w-5" />
                            </Button>
                        )}
                        <h1 className="text-lg md:text-xl font-bold text-slate-800 leading-none hidden md:block mr-2">POS</h1>
                    </div>

                    {/* Middle Area: Tabs & Search */}
                    <div className="flex-1 flex items-center gap-4 overflow-hidden">
                        {/* Tabs Row */}
                        <div className="flex items-center gap-1.5 overflow-x-auto shrink-0 custom-scrollbar max-w-[50%]">
                            {tabs.map((tab, idx) => (
                                <div
                                    key={tab.id}
                                    onClick={() => setActiveTabId(tab.id)}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer whitespace-nowrap transition-all",
                                        activeTabId === tab.id
                                            ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                                            : "border-slate-200 bg-white text-slate-500 hover:border-primary/50"
                                    )}
                                >
                                    <span className="text-xs">Order #{idx + 1}</span>
                                    {tab.cart.length > 0 && (
                                        <span className="bg-slate-900 text-white text-[9px] px-1.5 py-0.5 rounded-md font-black flex items-center justify-center">
                                            {tab.cart.reduce((s, c) => s + c.quantity, 0)}
                                        </span>
                                    )}
                                    <button
                                        onClick={(e) => removeTab(tab.id, e)}
                                        className="ml-1 hover:bg-red-100 hover:text-red-600 text-slate-400 rounded-full p-0.5 transition-colors"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                            <Button
                                variant="outline"
                                onClick={addTab}
                                className="h-8 w-8 p-0 rounded-lg border border-dashed border-slate-300 hover:border-primary hover:bg-primary/5 text-slate-400 hover:text-primary transition-all shrink-0 ml-1"
                                title="New Order Section"
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Search Bar */}
                        <div className="relative flex-1 min-w-[150px] max-w-[300px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                        <Input
                                placeholder="Search products..."
                                className="pl-9 pr-9 h-10 text-sm rounded-lg border border-slate-200 focus:border-primary bg-slate-50 transition-all shadow-sm focus:bg-white"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Supercategory Row */}
                        {superCategories.length > 0 && (
                            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0 pr-4 border-r border-slate-200 mr-2">
                                <button
                                    onClick={() => { setSelectedSuperCategory(null); setSelectedCategory("All"); }}
                                    className={cn(
                                        "flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-black whitespace-nowrap transition-all shadow-sm active:scale-95 border",
                                        !selectedSuperCategory
                                            ? "bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/10"
                                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                                    )}
                                >
                                    <Layers className="h-4 w-4" />
                                    All
                                </button>
                                {superCategories.map(sc => (
                                    <button
                                        key={sc.id}
                                        onClick={() => { setSelectedSuperCategory(sc.id); setSelectedCategory("All"); }}
                                        className={cn(
                                            "flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-black whitespace-nowrap transition-all shadow-sm active:scale-95 border",
                                            selectedSuperCategory === sc.id
                                                ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                                                : "bg-white text-slate-600 border-slate-200 hover:border-primary/50 hover:bg-slate-50"
                                        )}
                                    >
                                        <LayoutGrid className="h-4 w-4" />
                                        {sc.name}
                                    </button>
                                ))}
                            </div>
                        )}

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-auto p-2 hover:bg-slate-50 flex items-center gap-3 rounded-2xl transition-all text-left">
                                    <div className="text-right hidden md:block">
                                        <p className="text-sm font-black text-slate-700">{operator?.name || "Counter User"}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{operator?.role}</p>
                                    </div>
                                    <div className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-slate-900 flex items-center justify-center text-white shrink-0 shadow-sm">
                                        <User className="h-4 w-4 md:h-5 md:w-5" />
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
            )}

            <ChangePasswordModal
                isOpen={showChangePassword}
                onClose={() => setShowChangePassword(false)}
            />

            {/* Main Content Area */}
            <main className="flex-1 flex overflow-hidden">
                {/* Left Side: Cart & Billing (Desktop) */}
                <aside className="hidden lg:flex w-[350px] bg-white border-r flex-col shadow-lg z-20">
                    <CartContent
                        cart={cart}
                        setCart={setCart}
                        updateQuantity={updateQuantity}
                        handleQtyEditOpen={handleQtyEditOpen}
                        deleteFromCart={deleteFromCart}
                        subtotal={subtotal}
                        taxEnabled={taxEnabled}
                        setTaxEnabled={setTaxEnabled}
                        taxRate={taxRate}
                        setTaxRate={setTaxRate}
                        taxAmount={taxAmount}
                        discountPercent={discountPercent}
                        setDiscountPercent={setDiscountPercent}
                        discountAmount={discountAmount}
                        total={total}
                        handleCheckout={handleCheckout}
                    />
                </aside>

                {/* Right Side: Menu Selection */}
                <section className="flex-1 flex flex-col overflow-hidden p-2 md:p-3 gap-2 bg-slate-50">
                    {/* Search & Categories */}
                    <div className="flex flex-col gap-2 shrink-0">

                        <div className="flex gap-1.5 p-1 bg-slate-200/50 rounded-lg overflow-x-auto">
                            {visibleCategories.map(cat => (
                                <Button
                                    key={cat}
                                    variant={selectedCategory === cat ? "default" : "ghost"}
                                    size="sm"
                                    className={cn(
                                        "rounded-md px-3 h-8 font-bold whitespace-nowrap transition-all text-xs",
                                        selectedCategory === cat ? "shadow-sm" : "text-slate-500 hover:text-primary"
                                    )}
                                    onClick={() => setSelectedCategory(cat)}
                                >
                                    {cat}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Product Grid */}
                    <div className="flex-1 overflow-y-auto pt-1 pb-4 px-1 custom-scrollbar -ml-1 -mr-1">
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
                            {filteredItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => addToCart(item)}
                                    className="group flex flex-col items-center justify-center bg-primary/20 rounded-md p-1.5 text-center border-2 border-primary/30 hover:border-primary hover:bg-primary/40 active:scale-95 transition-all shadow-sm h-[55px] shadow-primary/5"
                                >
                                    <h3 className="font-bold text-slate-800 text-[10px] sm:text-[11px] leading-tight line-clamp-2 group-hover:text-primary transition-colors tracking-tight uppercase">{item.name}</h3>
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Mobile Cart Sheet */}
                <Sheet open={isMobileCartOpen} onOpenChange={setIsMobileCartOpen}>
                    <SheetContent side="right" className="w-full sm:max-w-md p-0 border-none shadow-2xl">
                        <div className="h-full flex flex-col bg-white">
                            <SheetHeader className="p-6 border-b shrink-0 bg-white/50 backdrop-blur-sm">
                                <SheetTitle className="flex items-center gap-3">
                                    <ShoppingCart className="h-6 w-6 text-primary" />
                                    <span className="font-black text-slate-800 text-lg">Current Order</span>
                                </SheetTitle>
                            </SheetHeader>
                            <div className="flex-1 overflow-hidden">
                                <CartContent
                                    cart={cart}
                                    setCart={setCart}
                                    updateQuantity={updateQuantity}
                                    handleQtyEditOpen={handleQtyEditOpen}
                                    deleteFromCart={deleteFromCart}
                                    subtotal={subtotal}
                                    taxEnabled={taxEnabled}
                                    setTaxEnabled={setTaxEnabled}
                                    taxRate={taxRate}
                                    setTaxRate={setTaxRate}
                                    taxAmount={taxAmount}
                                    discountPercent={discountPercent}
                                    setDiscountPercent={setDiscountPercent}
                                    discountAmount={discountAmount}
                                    total={total}
                                    handleCheckout={() => {
                                        setIsMobileCartOpen(false);
                                        handleCheckout();
                                    }}
                                />
                            </div>
                        </div>
                    </SheetContent>
                </Sheet>

                {/* Mobile Floating Bottom Bar */}
                {cart.length > 0 && (
                    <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-50">
                        <button
                            onClick={() => setIsMobileCartOpen(true)}
                            className="w-full h-14 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center justify-between px-6 animate-in slide-in-from-bottom-4 duration-300 active:scale-95"
                        >
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center font-black text-xs">
                                    {cart.reduce((sum, c) => sum + c.quantity, 0)}
                                </div>
                                <span className="font-bold text-sm">View Cart</span>
                            </div>
                            <span className="font-black text-lg text-primary">Rs.{total.toFixed(2)}</span>
                        </button>
                    </div>
                )}
            </main>

            {/* Checkout Dialog - Non-modal to allow external keyboard interaction */}
            <Dialog open={showCheckoutModal} onOpenChange={setShowCheckoutModal} modal={false}>
                {showCheckoutModal && (
                    <div
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[40] animate-in fade-in duration-300"
                        onClick={() => setShowCheckoutModal(false)}
                    />
                )}
                <DialogContent
                    onInteractOutside={(e) => {
                        // Allow closing on outside click
                    }}
                    className="max-w-[95vw] md:max-w-[750px] p-0 overflow-hidden border-none shadow-3xl rounded-2xl md:rounded-[2.5rem] z-[50] transition-all duration-300"
                >
                    <DialogTitle className="sr-only">Checkout</DialogTitle>
                    <div className="flex flex-col md:flex-row h-auto md:h-[650px] transition-all max-h-[90vh]">
                        {/* Checkout Info */}
                        <div className="flex-1 p-5 md:p-7 space-y-4 overflow-y-auto custom-scrollbar">
                            {/* Header - compact */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-800 leading-none">Checkout</h2>
                                    <p className="text-xs text-slate-400 font-medium mt-0.5">Finalize & take payment</p>
                                </div>
                            </div>

                            {/* Customer */}
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Customer</Label>
                                <CustomerSelector
                                    selectedCustomerId={customer?.id}
                                    onSelect={(c) => setCustomer(c)}
                                    searchTerm={customerSearch}
                                    onSearchChange={(val) => setCustomerSearch(val)}
                                />
                            </div>

                            {/* Payment Method — compact horizontal row */}
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payment Method</Label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[
                                        { id: 'cash', icon: Banknote, label: 'Cash' },
                                        { id: 'qr', icon: QrCode, label: 'QR' },
                                        { id: 'card', icon: CreditCard, label: 'Card' },
                                        { id: 'credit', icon: IndianRupee, label: 'Credit' },
                                    ].map(({ id, icon: Icon, label }) => (
                                        <button
                                            key={id}
                                            onClick={() => setPaymentMethod(id as any)}
                                            className={cn(
                                                "flex flex-col items-center justify-center py-3 rounded-2xl border-2 transition-all gap-1.5",
                                                paymentMethod === id ? "border-primary bg-primary/5 shadow-inner" : "border-slate-100 hover:border-slate-200"
                                            )}
                                        >
                                            <Icon className={cn("h-5 w-5", paymentMethod === id ? "text-primary" : "text-slate-300")} />
                                            <span className={cn("text-[10px] font-black uppercase", paymentMethod === id ? "text-primary" : "text-slate-400")}>{label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Discount — compact single row */}
                            <div className="border-t border-slate-100 pt-3 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Discount (Optional)</Label>
                                    {discountAmount > 0 && (
                                        <span className="text-xs font-bold text-emerald-600">-Rs.{discountAmount.toFixed(2)}</span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <div className="relative w-24 shrink-0">
                                        <Input
                                            type="number"
                                            min="0"
                                            max="100"
                                            placeholder="0"
                                            value={discountPercent || ""}
                                            onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
                                            className="h-9 pl-3 pr-7 font-bold transition-all"
                                        />
                                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">%</span>
                                    </div>
                                    <div className="flex gap-1.5 flex-1">
                                        {[5, 10, 15].map((percent) => (
                                            <Button
                                                key={percent}
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setDiscountPercent(percent)}
                                                className={cn(
                                                    "h-9 flex-1 font-bold rounded-xl text-xs",
                                                    discountPercent === percent && "bg-emerald-50 border-emerald-200 text-emerald-600"
                                                )}
                                            >
                                                {percent}%
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Print KOT — compact */}
                            <Button
                                variant="outline"
                                onClick={handlePrintKOT}
                                className="w-full h-10 border-2 border-slate-200 text-slate-600 hover:border-primary hover:text-primary hover:bg-primary/5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm"
                            >
                                <Printer className="h-4 w-4" />
                                Print Order KOT
                            </Button>

                            {/* QR Code — shown inline on left when QR method selected */}
                            {paymentMethod === 'qr' && (
                                <div className="flex justify-center animate-in fade-in slide-in-from-bottom-2">
                                    <div className="bg-white p-2 rounded-2xl shadow-md border border-slate-100 w-36 h-36 flex items-center justify-center overflow-hidden">
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
                                                    target.src = "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=AMABAKERY_PAYMENT";
                                                }}
                                            />
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Payment Processing */}
                        <div className="w-full md:w-[320px] bg-slate-50 border-t md:border-l p-4 md:p-6 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
                            {paymentMethod ? (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                                    {/* Common Amount Input */}
                                    <div className="space-y-3">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payment Details</Label>
                                        <div className="flex items-center justify-between bg-white p-3 rounded-xl border-2 border-slate-100">
                                            <div>
                                                <p className="text-[9px] text-slate-400 font-bold uppercase">Payable</p>
                                                <p className="text-lg font-black text-slate-800 leading-none">Rs.{total.toFixed(2)}</p>
                                            </div>
                                            <div className="text-right">
                                                <Label className="text-[9px] text-slate-400 font-bold uppercase">
                                                    {paymentMethod === 'cash' ? 'Cash Received' :
                                                        paymentMethod === 'qr' ? 'QR Received' :
                                                            paymentMethod === 'card' ? 'Card Paid' : 'Credit Amount'}
                                                </Label>
                                                <p className="text-lg font-black text-primary leading-none">Rs.{cashReceived || "0"}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-1 relative">
                                            <Input
                                                type="number"
                                                placeholder="0.00"
                                                className="h-11 text-xl font-black text-center border-2 transition-all border-primary/10"
                                                value={cashReceived}
                                                min="0"
                                                max="100000"
                                                onKeyDown={(e) => {
                                                    // Allow control keys
                                                    const allowedKeys = ['Backspace', 'Tab', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', 'Escape'];
                                                    if (allowedKeys.includes(e.key)) return;

                                                    // Allow Ctrl/Cmd combos
                                                    if (e.ctrlKey || e.metaKey) return;

                                                    // Allow decimal point (only one)
                                                    if (e.key === '.') {
                                                        if (cashReceived.includes('.')) e.preventDefault();
                                                        return;
                                                    }

                                                    // Block anything that isn't a digit
                                                    if (!/^[0-9]$/.test(e.key)) {
                                                        e.preventDefault();
                                                    }
                                                }}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const numVal = parseFloat(val);

                                                    // Allow empty string for clearing
                                                    if (val === "") {
                                                        setCashReceived("");
                                                        return;
                                                    }

                                                    // Strictly enforce max 100,000 and non-negative
                                                    if (numVal > 100000) {
                                                        setCashReceived("100000");
                                                        toast.error("Maximum amount is 100,000");
                                                    } else if (numVal < 0) {
                                                        setCashReceived("0");
                                                    } else {
                                                        setCashReceived(val);
                                                    }
                                                }}
                                                autoFocus
                                            />
                                        </div>

                                        {paymentMethod === 'cash' && cashReceived && parseFloat(cashReceived) >= total && (
                                            <div className="bg-success/5 p-2 rounded-xl border border-success/10 animate-in zoom-in-95">
                                                <p className="text-[8px] uppercase font-black text-success/60">Change</p>
                                                <p className="text-lg font-black text-success">Rs.{(parseFloat(cashReceived) - total).toFixed(2)}</p>
                                            </div>
                                        )}

                                        {/* Inline Keypad for Modal (Cash & Discount) */}
                                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, "00", 0, "⌫"].map((key) => (
                                                <Button
                                                    key={key.toString()}
                                                    variant="outline"
                                                    type="button"
                                                    className={cn(
                                                        "h-12 md:h-14 text-lg font-black rounded-xl transition-all active:scale-95 bg-white border-2 shadow-sm p-0",
                                                        key === "⌫" ? "text-destructive border-destructive/20 bg-destructive/5" : "hover:border-primary/40 text-slate-700"
                                                    )}
                                                    onClick={() => {
                                                        const field = activeKeypadField || 'cash';
                                                        if (field === 'cash') {
                                                            if (key === "⌫") setCashReceived(prev => (prev.toString().length > 0 ? prev.toString().slice(0, -1) : ""));
                                                            else if (key === "00") setCashReceived(prev => {
                                                                const newVal = `${prev}00`;
                                                                return parseFloat(newVal) <= 100000 ? newVal : prev;
                                                            });
                                                            else setCashReceived(prev => {
                                                                const current = prev.toString();
                                                                const newVal = current === "0" ? key.toString() : `${current}${key}`;
                                                                return parseFloat(newVal) <= 100000 ? newVal : prev;
                                                            });
                                                        } else if (field === 'discount') {
                                                            if (key === "⌫") setDiscountPercent(prev => {
                                                                const current = prev.toString();
                                                                const newVal = current.length > 1 ? parseInt(current.slice(0, -1)) : 0;
                                                                return isNaN(newVal) ? 0 : newVal;
                                                            });
                                                            else if (key === "00") setDiscountPercent(prev => {
                                                                const newVal = parseInt(`${prev}00`);
                                                                return isNaN(newVal) ? 0 : Math.min(100, newVal);
                                                            });
                                                            else setDiscountPercent(prev => {
                                                                const current = prev.toString();
                                                                const newVal = parseInt(current === "0" ? key.toString() : `${current}${key}`);
                                                                return isNaN(newVal) ? 0 : Math.min(100, newVal);
                                                            });
                                                        }
                                                    }}
                                                >
                                                    {key}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Visual Helpers per Payment Method — QR removed, shown on left side */}

                                    {paymentMethod === 'card' && (
                                        <div className="flex flex-col items-center justify-center gap-2 pt-2 border-t border-slate-100">
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                <CreditCard className="h-5 w-5 text-primary animate-pulse" />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[10px] font-bold text-slate-400 italic">Swipe or Dip Card on Machine</p>
                                            </div>
                                        </div>
                                    )}

                                    {paymentMethod === 'credit' && (
                                        <div className="flex flex-col items-center justify-center gap-2 pt-2 border-t border-slate-100">
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                <IndianRupee className="h-5 w-5 text-primary" />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[10px] font-bold text-slate-400 italic">Customer credit will be updated</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-10">
                                    <CreditCard className="h-12 w-12 mb-4 text-slate-300" />
                                    <p className="text-sm font-bold text-slate-400 px-4">Select a payment method to continue</p>
                                </div>
                            )}

                            <Button
                                className="w-full h-14 rounded-2xl font-black text-lg gradient-warm mt-auto"
                                disabled={!paymentMethod || isProcessing}
                                onClick={processPayment}
                            >
                                {isProcessing ? (
                                    <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-5 w-5 mr-2" />
                                        Finish Order
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Success Dialog */}
            <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
                <DialogContent className="max-w-[90vw] sm:max-w-[400px] p-6 md:p-8 text-center space-y-6 rounded-2xl md:rounded-[2.5rem] border-none shadow-3xl">
                    <DialogTitle className="sr-only">Success</DialogTitle>
                    <div className="h-24 w-24 bg-success/10 rounded-full flex items-center justify-center mx-auto text-success border-4 border-success/5 animate-in zoom-in-75 duration-500">
                        <CheckCircle2 className="h-12 w-12 stroke-[3px]" />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-3xl font-black text-slate-800">Paid & Confirmed</h2>
                        <p className="text-slate-400 font-medium">Order has been successfully processed</p>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-3">
                        <div className="flex justify-between text-sm font-bold">
                            <span className="text-slate-400 uppercase tracking-widest text-[9px]">Total Amount</span>
                            <span className="text-slate-800">Rs.{(receiptData?.total ?? 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold">
                            <span className="text-slate-400 uppercase tracking-widest text-[9px]">Payment Method</span>
                            <span className="text-slate-800 uppercase text-[10px]">{receiptData?.paymentMethod}</span>
                        </div>
                        {receiptData?.paymentMethod === 'cash' && receiptData?.cashReceived && (
                            <div className="pt-3 border-t border-dashed border-slate-200">
                                <div className="flex justify-between text-sm font-black text-success">
                                    <span className="uppercase tracking-widest text-[9px]">Change Returned</span>
                                    <span>Rs.{(parseFloat(receiptData.cashReceived) - receiptData.total).toFixed(2)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Button variant="outline" className="h-12 md:h-14 rounded-xl md:rounded-2xl font-black text-sm md:text-base" onClick={() => { setAutoPrint(true); setShowReceipt(true); setShowSuccessModal(false); }}>
                            <Printer className="h-4 w-4 md:h-5 md:w-5 mr-2" />
                            Bill
                        </Button>
                        <Button className="h-12 md:h-14 rounded-xl md:rounded-2xl font-black gradient-warm text-sm md:text-base" onClick={resetOrder}>
                            New
                            <ChevronRight className="h-4 w-4 md:h-5 md:w-5 ml-2" />
                        </Button>
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
                            <div className="thermal-receipt printable-receipt" id="bill-print-root">
                                <div className="thermal-header">
                                    <h1 className="thermal-title">{branchInfo?.receipt_header || "AMA BAKERY"}</h1>
                                    <div className="thermal-subtitle">Tel: {branchInfo?.phone || "9816020731"}</div>
                                    {branchInfo?.location && <div className="thermal-subtitle">{branchInfo.location.toUpperCase()}</div>}
                                </div>

                                <div className="thermal-divider"></div>

                                <div className="thermal-info-grid">
                                    <div className="thermal-info-left">
                                        <div>INV: #POS-{Date.now().toString().slice(-6)}</div>
                                        <div>DATE: {new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                                    </div>
                                    <div className="thermal-info-right">
                                        <div>CSHR: {operator?.name || "Counter"}</div>
                                        <div>CUST: {receiptData?.customer ? receiptData.customer.name : "Walk-in"}</div>
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

                                {receiptData?.cart?.map((item: any, idx: number) => (
                                    <div key={idx} className="receipt-item-grid">
                                        <div>{idx + 1}</div>
                                        <div>
                                            {item.item.name}
                                            {item.notes && <div style={{ fontSize: '8pt', textTransform: 'none', marginTop: '1mm' }}>"{item.notes}"</div>}
                                        </div>
                                        <div>{item.quantity}</div>
                                        <div style={{ textAlign: 'right' }}>{(item.item.price * item.quantity).toFixed(2)}</div>
                                    </div>
                                ))}

                                <div className="thermal-divider"></div>

                                <div style={{ fontSize: '10pt', lineHeight: '1.5' }}>
                                    <div className="thermal-row">
                                        <span>SUBTOTAL</span>
                                        <span>{(receiptData?.subtotal ?? 0).toFixed(2)}</span>
                                    </div>
                                    {(receiptData?.taxAmount ?? 0) > 0 && (
                                        <div className="thermal-row">
                                            <span>TAX ({receiptData?.taxRate ?? 0}%)</span>
                                            <span>{(receiptData?.taxAmount ?? 0).toFixed(2)}</span>
                                        </div>
                                    )}
                                    {(receiptData?.discountAmount ?? 0) > 0 && (
                                        <div className="thermal-row text-red-600 font-bold">
                                            <span>DISCOUNT ({receiptData?.discountPercent ?? 0}%)</span>
                                            <span>-{(receiptData?.discountAmount ?? 0).toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="thermal-divider"></div>
                                    <div className="thermal-total-row">
                                        <span>TOTAL</span>
                                        <span>{(receiptData?.total ?? 0).toFixed(2)}</span>
                                    </div>
                                    <div className="thermal-divider"></div>
                                    <div className="thermal-row">
                                        <span>STATUS</span>
                                        <span>PAID</span>
                                    </div>
                                    <div className="thermal-divider"></div>

                                    <div className="thermal-row" style={{ fontSize: '9pt', opacity: 0.8 }}>
                                        <span>CASH RECEIVED</span>
                                        <span>{parseFloat(receiptData?.cashReceived || "0").toFixed(2)}</span>
                                    </div>
                                    {parseFloat(receiptData?.cashReceived || "0") > (receiptData?.total ?? 0) && (
                                        <div className="thermal-row" style={{ fontSize: '9pt', fontWeight: 'bold' }}>
                                            <span>CHANGE RETURNED</span>
                                            <span>{(parseFloat(receiptData?.cashReceived || "0") - (receiptData?.total ?? 0)).toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="thermal-footer">
                                    {branchInfo?.receipt_footer || "THANK YOU FOR YOUR VISIT!"}
                                </div>
                                <div className="thermal-barcode">
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Quantity Edit Dialog - Non-modal to avoid focus issues */}
            <Dialog open={showQtyDialog} onOpenChange={setShowQtyDialog} modal={false}>
                {showQtyDialog && (
                    <div
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[40] animate-in fade-in duration-300"
                        onClick={() => setShowQtyDialog(false)}
                    />
                )}
                <DialogContent
                    onInteractOutside={(e) => {
                        const target = e.target as HTMLElement;
                        if (target?.closest('.global-keyboard')) e.preventDefault();
                    }}
                    className="max-w-[320px] p-6 rounded-[2rem] border-none shadow-3xl z-[50]"
                >
                    <DialogTitle className="sr-only">Edit Quantity</DialogTitle>
                    <div className="text-center space-y-4">
                        <div className="space-y-1">
                            <h3 className="text-lg font-black text-slate-800 line-clamp-1">{qtyEditItem?.item.name}</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enter Quantity</p>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-2xl border-2 border-primary/20">
                            <span className="text-4xl font-black text-primary">
                                {qtyInput || cart.find(c => c.item.id === qtyEditItem?.item.id)?.quantity || "0"}
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, "C", 0, "OK"].map((key) => (
                                <Button
                                    key={key.toString()}
                                    variant={key === "OK" ? "default" : "secondary"}
                                    className={cn(
                                        "h-12 text-lg font-black rounded-xl transition-all active:scale-90",
                                        key === "OK" ? "gradient-warm col-span-1" : "bg-white border hover:bg-slate-50 shadow-sm",
                                        key === "C" ? "text-destructive" : ""
                                    )}
                                    onClick={() => {
                                        if (key === "OK") handleQtySubmit();
                                        else if (key === "C") setQtyInput("");
                                        else setQtyInput(prev => (prev.length < 3 ? prev + key : prev));
                                    }}
                                >
                                    {key}
                                </Button>
                            ))}
                        </div>

                        <div className="pt-2 flex items-center justify-center gap-2 opacity-40">
                            <Monitor className="h-3 w-3 text-slate-400" />
                            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">Keyboard Numpad Enabled</span>
                        </div>

                        <Button
                            variant="ghost"
                            className="w-full text-xs font-bold text-slate-400 mt-2"
                            onClick={() => setShowQtyDialog(false)}
                        >
                            Cancel
                        </Button>
                    </div>
            </DialogContent>
            </Dialog>
            {/* Global Floating Virtual Keyboard - DISABLED */}
            {/* Virtual keyboard removed - using physical keyboard only */}
        </div>
    );
}

function CartContent({
    cart,
    setCart,
    updateQuantity,
    handleQtyEditOpen,
    deleteFromCart,
    subtotal,
    taxEnabled,
    setTaxEnabled,
    taxRate,
    setTaxRate,
    taxAmount,
    discountPercent,
    setDiscountPercent,
    discountAmount,
    total,
    handleCheckout
}: any) {
    return (
        <div className="flex flex-col h-full bg-white">
            <div className="p-3 md:p-4 border-b shrink-0 flex items-center justify-between bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                    <h2 className="font-black text-slate-800 text-sm md:text-md">Current Order</h2>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCart([])}
                    className="text-xs font-bold text-destructive hover:bg-destructive/5 rounded-lg"
                    disabled={cart.length === 0}
                >
                    Clear
                </Button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-2 md:p-3 space-y-2 custom-scrollbar">
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60 px-8 text-center min-h-[200px]">
                        <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-slate-50 mb-4 flex items-center justify-center">
                            <ShoppingCart className="h-8 w-8 md:h-10 md:w-10" />
                        </div>
                        <p className="font-bold text-base md:text-lg">Empty cart</p>
                        <p className="text-xs md:text-sm">Add items to start billing</p>
                    </div>
                ) : (
                    cart.map((cartItem: any) => (
                        <div key={cartItem.item.id} className="group bg-slate-50 rounded-xl md:rounded-2xl p-3 border border-slate-100 hover:border-primary/20 transition-all">
                            <div className="flex justify-between items-start mb-2">
                                <div className="max-w-[150px] md:max-w-[180px]">
                                    <h4 className="font-bold text-xs md:text-sm text-slate-800 leading-tight">{cartItem.item.name}</h4>
                                    <p className="text-[9px] md:text-[10px] text-slate-400 mt-1 font-bold">Rs.{cartItem.item.price}</p>
                                </div>
                                <span className="font-black text-slate-900 text-sm md:text-base">Rs.{(cartItem.item.price * cartItem.quantity).toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 md:gap-3">
                                    <div className="flex items-center bg-white rounded-lg border border-slate-200 overflow-hidden h-7 md:h-8">
                                        <button
                                            onClick={() => updateQuantity(cartItem.item.id, -1)}
                                            className="p-1 px-2 hover:bg-slate-50 text-slate-500"
                                        >
                                            <Minus className="h-2.5 w-2.5 md:h-3 md:w-3" />
                                        </button>
                                        <span className="w-6 md:w-8 text-center text-[10px] md:text-xs font-black text-slate-700">
                                            {cartItem.quantity}
                                        </span>
                                        <button
                                            onClick={() => updateQuantity(cartItem.item.id, 1)}
                                            className="p-1 px-2 hover:bg-slate-50 text-slate-500"
                                        >
                                            <Plus className="h-2.5 w-2.5 md:h-3 md:w-3" />
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => handleQtyEditOpen(cartItem)}
                                        className="h-7 w-7 md:h-8 md:w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all active:scale-90"
                                        title="Edit quantity"
                                    >
                                        <Pencil className="h-3 w-3 md:h-3.5 md:w-3.5" />
                                    </button>
                                </div>
                                <button
                                    onClick={() => deleteFromCart(cartItem.item.id)}
                                    className="text-slate-300 hover:text-destructive transition-colors md:opacity-0 md:group-hover:opacity-100"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Totals & Actions */}
            <div className="p-4 md:p-6 bg-slate-50 border-t space-y-4 shrink-0 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
                <div className="space-y-2">
                    <div className="flex justify-between text-xs md:text-sm font-medium text-slate-500">
                        <span>Subtotal</span>
                        <span>Rs.{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col gap-2 py-1">
                        <div className="flex justify-between items-center text-xs md:text-sm font-medium text-slate-500">
                            <div className="flex items-center gap-2">
                                <span>Tax</span>
                                <Switch
                                    checked={taxEnabled}
                                    onCheckedChange={setTaxEnabled}
                                    className="scale-75 data-[state=checked]:bg-primary"
                                />
                            </div>
                            {taxEnabled ? (
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center bg-white rounded-lg px-2 border w-16 md:w-20">
                                        <Input
                                            type="number"
                                            value={taxRate}
                                            onChange={(e) => setTaxRate(Number(e.target.value))}
                                            className="w-10 md:w-12 h-6 md:h-7 p-0 text-center border-none bg-transparent text-[10px] md:text-xs font-bold focus-visible:ring-0"
                                        />
                                        <span className="text-[9px] md:text-[10px] font-bold text-slate-400">%</span>
                                    </div>
                                    <span className="font-bold text-slate-700">Rs.{taxAmount.toFixed(2)}</span>
                                </div>
                            ) : (
                                <span className="text-[10px] md:text-xs font-medium text-slate-300">Disabled</span>
                            )}
                        </div>

                        {taxEnabled && (
                            <div className="flex gap-1 justify-end">
                                {[5, 13].map((rate) => (
                                    <button
                                        key={rate}
                                        onClick={() => setTaxRate(rate)}
                                        className={cn(
                                            "px-2 py-0.5 md:py-1 rounded text-[9px] md:text-[10px] font-bold transition-all",
                                            taxRate === rate
                                                ? "bg-primary text-white"
                                                : "bg-white text-slate-500 border border-slate-100"
                                        )}
                                    >
                                        {rate}%
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2 pb-1">
                        <div className="flex items-center justify-between text-xs md:text-sm font-medium text-slate-500">
                            <div className="flex items-center gap-2">
                                <Percent className="h-3 w-3 md:h-4 md:w-4" />
                                <span>Discount</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center bg-white rounded-lg px-2 border w-20 md:w-24">
                                    <Input
                                        type="number"
                                        value={discountPercent || ""}
                                        onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
                                        className="w-10 md:w-12 h-6 md:h-7 p-0 text-center border-none bg-transparent text-[10px] md:text-xs font-bold focus-visible:ring-0"
                                        placeholder="0"
                                    />
                                    <span className="text-[9px] md:text-[10px] font-bold text-slate-400">%</span>
                                </div>
                                <span className="font-bold text-emerald-600">
                                    {discountAmount > 0 && `-Rs.${discountAmount.toFixed(2)}`}
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-1 justify-end">
                            {[0, 5, 10].map((percent) => (
                                <button
                                    key={percent}
                                    onClick={() => setDiscountPercent(percent)}
                                    className={cn(
                                        "px-2 py-0.5 md:py-1 rounded text-[9px] md:text-[10px] font-bold transition-all",
                                        discountPercent === percent
                                            ? "bg-emerald-500 text-white"
                                            : "bg-white text-slate-500 border border-slate-100"
                                    )}
                                >
                                    {percent}%
                                </button>
                            ))}
                        </div>
                    </div>

                    <Separator />
                    <div className="flex justify-between items-center pt-1 md:pt-2">
                        <span className="text-base md:text-lg font-black text-slate-800">Total</span>
                        <span className="text-2xl md:text-3xl font-black text-primary">Rs.{total.toFixed(2)}</span>
                    </div>
                </div>

                <Button
                    className="w-full h-12 md:h-16 text-lg md:text-xl font-black rounded-xl md:rounded-2xl shadow-xl shadow-primary/20 gradient-warm transition-all active:scale-95"
                    disabled={cart.length === 0}
                    onClick={handleCheckout}
                >
                    <Receipt className="h-5 w-5 md:h-6 md:w-6 mr-2 md:mr-3" />
                    Checkout
                </Button>
            </div>
        </div>
    );
}
