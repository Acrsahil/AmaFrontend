import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { CartItem } from "@/components/waiter/CartItem";
import { WaiterBottomNav } from "@/components/waiter/WaiterBottomNav";
import { MenuItem } from "@/lib/mockData";
import { saveTableOrder, getTableOrder } from "@/lib/orderStorage";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { ShoppingCart, Search, X, Receipt, Loader2, Check, Layers, LayoutGrid, Plus, Minus, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fetchProducts, fetchCategories, fetchSuperCategories, patchInvoice, fetchInvoiceDetail } from "../../api/index.js";
import { getCurrentUser } from "@/auth/auth";
import { cn } from "@/lib/utils";

interface CartItemData {
  item: MenuItem;
  quantity: number;
  notes?: string;
  isExisting?: boolean;
  originalQuantity?: number;
  invoiceItemId?: number;
  status?: string;
}

export default function OrderEntry() {
  const navigate = useNavigate();
  const { tableNumber } = useParams();
  const [searchParams] = useSearchParams();

  const [products, setProducts] = useState<MenuItem[]>([]);
  const [rawCategories, setRawCategories] = useState<any[]>([]);
  const [superCategories, setSuperCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSuperCategory, setSelectedSuperCategory] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItemData[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderSent, setOrderSent] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const invoiceId = searchParams.get("invoiceId");
  const [removedItemIds, setRemovedItemIds] = useState<number[]>([]);

  useEffect(() => {
    loadData();
    if (invoiceId) {
      loadInvoiceData();
    } else if (tableNumber) {
      const savedOrder = getTableOrder(tableNumber);
      if (savedOrder && savedOrder.cart.length > 0) {
        setCart(savedOrder.cart);
      }
    }
  }, [invoiceId, tableNumber]);

  const loadInvoiceData = async () => {
    try {
      const inv = await fetchInvoiceDetail(invoiceId);
      if (inv && inv.items) {
        const mappedExisting = inv.items.map((it: any) => ({
          item: {
            id: String(it.product),
            name: it.product_name || `Product #${it.product}`,
            price: parseFloat(it.unit_price),
            category: "",
          },
          quantity: it.quantity,
          originalQuantity: it.quantity,
          notes: it.description,
          isExisting: true,
          status: it.status,
          invoiceItemId: it.id
        }));
        setCart(mappedExisting);
      }
    } catch (err: any) {
      toast.error("Failed to load invoice items");
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [productsResponse, categoriesData, superCatsData] = await Promise.all([
        fetchProducts({ page_size: 1000 }),
        fetchCategories(),
        fetchSuperCategories()
      ]);

      const productsData = productsResponse?.results || (Array.isArray(productsResponse) ? productsResponse : []);

      const mappedProducts: MenuItem[] = productsData.map((p: any) => ({
        id: p.id.toString(),
        name: p.name,
        price: parseFloat(p.selling_price),
        category: p.category_name,
        categoryId: p.category,
        available: p.is_available,
        image: p.image || undefined
      }));

      setProducts(mappedProducts);
      setRawCategories(Array.isArray(categoriesData) ? categoriesData : []);
      setSuperCategories(Array.isArray(superCatsData) ? superCatsData : []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load menu data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tableNumber && cart.length > 0) {
      saveTableOrder(tableNumber, cart);
    }
  }, [cart, tableNumber]);

  const filteredItems = useMemo(() => {
    let items = products.filter(p => p.available !== false);

    if (selectedSuperCategory) {
      // Match products whose categoryId is in the list of categories that belong to this supercategory
      const catIdsInSuperCat = rawCategories
        .filter((c: any) => Number(c.supercategory) === Number(selectedSuperCategory))
        .map((c: any) => Number(c.id));
      items = items.filter(item => catIdsInSuperCat.includes(Number((item as any).categoryId)));
    }

    if (selectedCategory) {
      items = items.filter(item => item.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      items = items.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort items alphabetically by name
    items.sort((a, b) => a.name.localeCompare(b.name));

    return items;
  }, [products, rawCategories, selectedSuperCategory, selectedCategory, searchQuery]);

  // Categories visible under selected supercategory (filter by supercategory id on the raw category objects)
  const visibleCategories = useMemo(() => {
    if (!selectedSuperCategory) {
      return rawCategories.map((c: any) => c.name);
    }
    return rawCategories
      .filter((c: any) => Number(c.supercategory) === Number(selectedSuperCategory))
      .map((c: any) => c.name);
  }, [rawCategories, selectedSuperCategory]);

  const cartTotal = useMemo(() =>
    cart.reduce((sum, c) => sum + (c.item.price * c.quantity), 0),
    [cart]
  );

  const cartCount = useMemo(() =>
    cart.reduce((sum, c) => sum + c.quantity, 0),
    [cart]
  );

  const getItemQuantity = (itemId: string) => {
    return cart.find(c => c.item.id === itemId)?.quantity || 0;
  };

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id);
      if (existing) {
        return prev.map(c => c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const removeFromCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id);
      if (!existing) return prev;
      const isPrepared = existing.status === "READY" || existing.status === "COMPLETED";
      const user = getCurrentUser();
      const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.is_superuser;
      if (isPrepared && !isAdmin && existing.quantity <= (existing.originalQuantity || 0)) {
        toast.error("This item is already prepared and can't be reduced");
        return prev;
      }
      if (existing.quantity > 1) {
        return prev.map(c => c.item.id === item.id ? { ...c, quantity: c.quantity - 1 } : c);
      }
      // quantity hits 0 — just remove, no confirm
      if (existing.isExisting && existing.invoiceItemId) {
        setRemovedItemIds(r => [...r, existing.invoiceItemId!]);
      }
      return prev.filter(c => c.item.id !== item.id);
    });
  };

  const setQuantity = (item: MenuItem, quantity: number) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id);
      if (existing?.isExisting) {
        const isPrepared = existing.status === "READY" || existing.status === "COMPLETED";
        const user = getCurrentUser();
        const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.is_superuser;
        if (isPrepared && !isAdmin && quantity < (existing.originalQuantity || 0)) {
          toast.error("This item is already prepared and can't be reduced");
          return prev;
        }
      }
      if (quantity <= 0) {
        // just remove, no confirm
        if (existing?.isExisting && existing.invoiceItemId) {
          setRemovedItemIds(r => [...r, existing.invoiceItemId!]);
        }
        return prev.filter(c => c.item.id !== item.id);
      }
      if (existing) {
        return prev.map(c => c.item.id === item.id ? { ...c, quantity } : c);
      }
      return [...prev, { item, quantity }];
    });
  };

  const deleteFromCart = (itemId: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === itemId);
      if (existing?.isExisting) {
        const isPrepared = existing.status === "READY" || existing.status === "COMPLETED";
        const user = getCurrentUser();
        const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" || user?.is_superuser;
        if (isPrepared && !isAdmin) {
          toast.error("This item is already prepared and can't be reduced");
          return prev;
        }
      }
      // no confirm — just remove directly
      if (existing?.isExisting && existing.invoiceItemId) {
        setRemovedItemIds(r => [...r, existing.invoiceItemId!]);
      }
      return prev.filter(c => c.item.id !== itemId);
    });
  };

  const clearCart = () => {
    // track all existing invoice items as removed
    cart.forEach(c => {
      if (c.isExisting && c.invoiceItemId) {
        setRemovedItemIds(r => [...r, c.invoiceItemId!]);
      }
    });
    setCart([]);
    if (tableNumber) saveTableOrder(tableNumber, []);
    toast.success("Cart cleared");
  };

  const updateNotes = (itemId: string, notes: string) => {
    setCart(prev => prev.map(c => c.item.id === itemId ? { ...c, notes } : c));
  };

  const handleSendOrder = async () => {
    if (invoiceId) {
      const addItems: any[] = [];
      const updateItems: any[] = [];

      cart.forEach(c => {
        if (c.isExisting) {
          const diff = c.quantity - (c.originalQuantity || 0);
          if (diff !== 0) {
            updateItems.push({ invoice_item_id: c.invoiceItemId, quantity: c.quantity });
          }
        } else {
          addItems.push({ product: parseInt(c.item.id), quantity: c.quantity, description: c.notes || "" });
        }
      });

      if (addItems.length === 0 && removedItemIds.length === 0 && updateItems.length === 0) {
        toast.info("No changes made.");
        setIsCartOpen(false);
        return;
      }

      setOrderSent(true);
      try {
        await patchInvoice(invoiceId, { add_items: addItems, remove_items: removedItemIds, update_items: updateItems });
        toast.success("Order updated successfully!");
        setIsCartOpen(false);
        setTimeout(() => navigate("/waiter/tables"), 1000);
      } catch (err: any) {
        toast.error(err.message || "Failed to update order");
        setOrderSent(false);
      }
    } else {
      setIsCartOpen(false);
      proceedToCheckout();
    }
  };

  const proceedToCheckout = () => {
    navigate('/waiter/checkout', {
      state: { cart, tableNumber, floorId: searchParams.get('floorId') }
    });
  };

  const filterRef = useRef<HTMLDivElement>(null);
  const [filterHeight, setFilterHeight] = useState(0);

  useEffect(() => {
    const measure = () => {
      if (filterRef.current) setFilterHeight(filterRef.current.offsetHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (filterRef.current) observer.observe(filterRef.current);
    return () => observer.disconnect();
  }, [superCategories.length]);

  return (
    <div className="min-h-screen bg-[#f5f3ef] text-left">
      <MobileHeader title={`Table ${tableNumber}`} showBack />

      {/* Sticky filter bar — fixed so it never overlaps content */}
      <div ref={filterRef} className="sticky top-[60px] z-40 bg-[#f5f3ef] border-b border-stone-200 shadow-sm">
        {/* Search */}
        <div className="px-3 pt-2.5 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 h-9 rounded-xl bg-white border border-stone-200 text-sm font-medium text-stone-700 placeholder:text-stone-400 focus:outline-none focus:border-primary transition-colors"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Supercategory pills */}
        {superCategories.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide px-3 pb-1.5">
            <button
              onClick={() => { setSelectedSuperCategory(null); setSelectedCategory(""); }}
              className={cn(
                "flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-black whitespace-nowrap border transition-all shrink-0",
                !selectedSuperCategory
                  ? "bg-stone-900 text-white border-stone-900"
                  : "bg-white text-stone-500 border-stone-200"
              )}
            >
              <Layers className="h-3 w-3" />
              All
            </button>
            {superCategories.map(sc => (
              <button
                key={sc.id}
                onClick={() => { setSelectedSuperCategory(sc.id); setSelectedCategory(""); }}
                className={cn(
                  "flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-black whitespace-nowrap border transition-all shrink-0",
                  selectedSuperCategory === sc.id
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-stone-500 border-stone-200"
                )}
              >
                <LayoutGrid className="h-3 w-3" />
                {sc.name}
              </button>
            ))}
          </div>
        )}

        {/* Category pills */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide px-3 pb-2.5">
          <button
            onClick={() => setSelectedCategory("")}
            className={cn(
              "px-3 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap border transition-all shrink-0",
              selectedCategory === ""
                ? "bg-primary text-white border-primary"
                : "bg-white text-stone-500 border-stone-200"
            )}
          >
            All
          </button>
          {visibleCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-3 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap border transition-all shrink-0",
                selectedCategory === cat
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-stone-500 border-stone-200"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Menu Items — padded top to clear sticky header */}
      <main className="p-3 pb-32">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
            <p className="text-stone-400 mt-4 text-sm font-medium">Loading menu...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-stone-400">
            <ShoppingBag className="h-12 w-12 mb-3 opacity-40" />
            <p className="font-semibold">No products found</p>
            <p className="text-sm mt-1">Try a different filter or search</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredItems.map(item => {
              const qty = getItemQuantity(item.id);
              return (
                <div
                  key={item.id}
                  className={cn(
                    "bg-white rounded-xl border transition-all flex items-center justify-between px-3 py-2.5 gap-2",
                    qty > 0 ? "border-primary shadow-sm shadow-primary/10" : "border-stone-200"
                  )}
                >
                  {/* Name */}
                  <p className="text-[12px] font-bold text-stone-800 leading-snug flex-1 min-w-0 line-clamp-2">{item.name}</p>

                  {/* Controls */}
                  {qty === 0 ? (
                    <button
                      onClick={() => addToCart(item)}
                      className="h-7 w-7 rounded-lg bg-primary text-white flex items-center justify-center shrink-0 active:scale-90 transition-transform"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => removeFromCart(item)}
                        className="h-7 w-7 rounded-lg border border-primary/30 bg-primary/5 flex items-center justify-center text-primary active:scale-90 transition-transform"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="font-black text-stone-800 text-xs w-5 text-center">{qty}</span>
                      <button
                        onClick={() => addToCart(item)}
                        className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center text-white active:scale-90 transition-transform"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Cart Sheet */}
      <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Your Order
              </div>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="flex items-center gap-1.5 text-xs font-bold text-rose-500 hover:text-rose-600 active:scale-95 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear All
                </button>
              )}
            </SheetTitle>
          </SheetHeader>

          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-stone-400">
              <ShoppingCart className="h-12 w-12 mb-3 opacity-40" />
              <p>Your cart is empty</p>
              <p className="text-sm mt-1">Add items from the menu</p>
            </div>
          ) : (
            <>
              <div className="mt-4 space-y-3 max-h-[calc(80vh-200px)] overflow-y-auto">
                {cart.map(cartItem => (
                  <CartItem
                    key={cartItem.item.id}
                    item={cartItem.item}
                    quantity={cartItem.quantity}
                    notes={cartItem.notes}
                    onAdd={() => addToCart(cartItem.item)}
                    onRemove={() => removeFromCart(cartItem.item)}
                    onDelete={() => deleteFromCart(cartItem.item.id)}
                    onNotesChange={(notes) => updateNotes(cartItem.item.id, notes)}
                  />
                ))}
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-stone-500 font-medium">{cartCount} item{cartCount !== 1 ? 's' : ''}</span>
                  <span className="text-xl font-black text-primary">Rs.{cartTotal.toFixed(2)}</span>
                </div>
                <Button
                  className="w-full h-13 rounded-xl gradient-warm font-black text-base"
                  onClick={handleSendOrder}
                  disabled={orderSent}
                >
                  {orderSent ? (
                    <><Check className="h-5 w-5 mr-2" />{invoiceId ? "Order Updated!" : "Order Sent!"}</>
                  ) : (
                    <><Receipt className="h-5 w-5 mr-2" />{invoiceId ? "Update Order" : "Proceed to Checkout"}</>
                  )}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Floating View Order Button */}
      {cart.length > 0 && (
        <div className="fixed bottom-20 left-4 right-4 z-50">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full h-14 rounded-2xl bg-primary shadow-xl shadow-primary/30 flex items-center justify-between px-5 transition-all active:scale-95"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <ShoppingCart className="h-5 w-5 text-white" />
                </div>
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-primary text-[10px] flex items-center justify-center font-black">
                  {cartCount}
                </span>
              </div>
              <span className="font-black uppercase tracking-wide text-sm text-white">View Order</span>
            </div>
            <span className="font-black text-base text-white">Rs.{cartTotal.toFixed(2)}</span>
          </button>
        </div>
      )}

      <WaiterBottomNav />
    </div>
  );
}
