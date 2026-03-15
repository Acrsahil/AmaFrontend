import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { WaiterBottomNav } from "@/components/waiter/WaiterBottomNav";
import { ChefHat, Bell, Loader2, User, Users, Clock, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { fetchInvoices, fetchNotifications, markNotificationRead, fetchProducts, fetchCategories, updateInvoiceStatus } from "@/api/index.js";
import { getCurrentUser } from "@/auth/auth";
import { useOrdersWebSocket } from "@/hooks/useOrdersWebSocket";
import { formatDistanceToNow } from "date-fns";

type MainTab = "mine" | "all";
type SubTab = "pending" | "completed";

export default function OrderStatus() {
  const navigate = useNavigate();
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<MainTab>("mine");
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("pending");
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const currentUser = getCurrentUser();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [data, notifs, prodData, catData] = await Promise.all([
        fetchInvoices(),
        fetchNotifications(),
        fetchProducts(),
        fetchCategories()
      ]);
      setAllOrders(data || []);
      setNotifications((notifs || []).filter((n: any) => !n.is_read));
      setProducts(prodData || []);
      setCategories(catData || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);


  // WebSocket: auto-refresh when invoice created or status updated (e.g. kitchen marks ready)
  useOrdersWebSocket(
    useCallback(
      (data) => {
        if (data.type === "invoice_updated" && data.status === "READY") {
          // Order is ready
          toast.success("A kitchen order is ready for pickup!", {
            icon: <ChefHat className="h-5 w-5 text-success" />
          });
          loadData();
        } else if (data.type === "invoice_created" || data.type === "invoice_updated") {
          loadData();
        }
      },
      [loadData]
    )
  );

  // Filtering logic
  const displayOrders = allOrders.filter((o) => {
    const isMine = String(o.created_by) === String(currentUser?.id);
    const isCompleted = o?.invoice_status === "COMPLETED" || o?.invoice_status === "CANCELLED";
    const isPending = !isCompleted;

    const matchesMain = activeTab === "mine" ? isMine : true;
    const matchesSub = activeSubTab === "pending" ? isPending : isCompleted;

    return matchesMain && matchesSub;
  });

  const readyOrders = displayOrders.filter(o => o?.invoice_status === "READY");
  const otherActiveOrders = displayOrders.filter(o => o?.invoice_status !== "READY" && o?.invoice_status !== "COMPLETED" && o?.invoice_status !== "CANCELLED");
  const doneOrders = displayOrders.filter(o => o?.invoice_status === "COMPLETED" || o?.invoice_status === "CANCELLED");
  const isCompletedTab = activeSubTab === "completed";
  const isOrderTab = activeSubTab === "pending";
  const isAllTab = activeTab === "all";

  // Deduplicate notifications per order ID and filter by tab/status
  const filteredDeduplicatedNotifications = notifications.reduce((acc: any[], current: any) => {
    const order = allOrders.find(o => String(o.id) === String(current.invoice));

    // Only keep if the order exists and is currently READY
    if (!order || order.invoice_status !== "READY") return acc;

    // Filter by waiter if in "my" tab
    const isMine = String(order.created_by) === String(currentUser?.id);
    if (activeTab === "mine" && !isMine) return acc;

    const existingIdx = acc.findIndex(n => String(n.invoice) === String(current.invoice));
    if (existingIdx > -1) {
      if (current.id > acc[existingIdx].id) {
        acc[existingIdx] = current;
      }
    } else {
      acc.push(current);
    }
    return acc;
  }, []);

  // Group notifications by floor for better organization
  const notificationsByFloor = filteredDeduplicatedNotifications.reduce((acc: any, notif: any) => {
    const order = allOrders.find(o => String(o.id) === String(notif.invoice));
    const floorName = notif.floor_name || order?.floor_name || "Unassigned";
    if (!acc[floorName]) {
      acc[floorName] = [];
    }
    acc[floorName].push(notif);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background pb-20">
      <MobileHeader title="Orders" showBack={false} />

      <main className="p-4 space-y-4">
        {/* Main Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-xl">
          <button
            onClick={() => setActiveTab("mine")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all",
              activeTab === "mine"
                ? "bg-white text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <User className="h-4 w-4" />
            My Order
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all",
              activeTab === "all"
                ? "bg-white text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="h-4 w-4" />
            All Order
          </button>
        </div>

        {/* Sub Tabs */}
        <div className="flex gap-2 mb-2 overflow-x-auto pb-2 hide-scrollbar -mx-1 px-1">
          <Button
            onClick={() => setActiveSubTab("pending")}
            variant={activeSubTab === "pending" ? "default" : "outline"}
            size="sm"
            className={cn(
              "rounded-xl font-bold whitespace-nowrap px-4",
              activeSubTab === "pending" ? "bg-success hover:bg-success/90 text-white" : "bg-white text-slate-600"
            )}
          >
            Pending {allOrders.filter(o => (activeTab === "mine" ? String(o.created_by) === String(currentUser?.id) : true) && o.invoice_status !== "COMPLETED" && o.invoice_status !== "CANCELLED").length > 0 && `(${allOrders.filter(o => (activeTab === "mine" ? String(o.created_by) === String(currentUser?.id) : true) && o.invoice_status !== "COMPLETED" && o.invoice_status !== "CANCELLED").length})`}
          </Button>
          <Button
            onClick={() => setActiveSubTab("completed")}
            variant={activeSubTab === "completed" ? "default" : "outline"}
            size="sm"
            className={cn(
              "rounded-xl font-bold whitespace-nowrap px-4",
              activeSubTab === "completed" ? "bg-slate-800 hover:bg-slate-900 text-white" : "bg-white text-slate-600"
            )}
          >
            Completed {allOrders.filter(o => (activeTab === "mine" ? String(o.created_by) === String(currentUser?.id) : true) && (o.invoice_status === "COMPLETED" || o.invoice_status === "CANCELLED")).length > 0 && `(${allOrders.filter(o => (activeTab === "mine" ? String(o.created_by) === String(currentUser?.id) : true) && (o.invoice_status === "COMPLETED" || o.invoice_status === "CANCELLED")).length})`}
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-10 w-10 text-primary animate-spin mb-2" />
            <p className="text-muted-foreground animate-pulse text-sm">Loading orders...</p>
          </div>
        ) : (
          <div className="space-y-4">

            {/* Active Orders Section */}
            {isOrderTab && (
              <div className="space-y-4">
                {/* 1. Ready Orders via Notifications (Grouped by Floor) */}
                {filteredDeduplicatedNotifications.length > 0 && (
                  <div className="space-y-4">
                    {Object.entries(notificationsByFloor).map(([floorName, floorNotifications]: [string, any[]]) => (
                      <section key={floorName}>
                        <h2 className="text-xs font-bold mb-2 text-success uppercase tracking-widest flex items-center gap-1.5">
                          <span className="h-4 w-4 rounded-full bg-success inline-flex items-center justify-center text-white text-[9px] font-black">
                            {floorNotifications.length}
                          </span>
                          Floor {floorName} • Ready for Pickup
                        </h2>
                        <div className="space-y-3">
                          {floorNotifications.map((notif: any) => {
                            const order = allOrders.find(o => String(o.id) === String(notif.invoice));
                            if (!order) return null;
                            return (
                              <OrderCard
                                key={`notif-${notif.id}`}
                                order={order}
                                notification={notif}
                                showWaiter={isAllTab}
                                activeTab={activeTab}
                                products={products}
                                categories={categories}
                              />
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                )}

                {/* 2. All Other Active Orders (Pending, Processing, or Ready without notification) */}
                {(otherActiveOrders.length > 0 || readyOrders.filter(o => !filteredDeduplicatedNotifications.some(n => String(n.invoice) === String(o.id))).length > 0) && (
                  <section>
                    <h2 className="text-xs font-bold mb-2 text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="h-4 w-4 rounded-full bg-slate-400 inline-flex items-center justify-center text-white text-[9px] font-black">
                        {otherActiveOrders.length + readyOrders.filter(o => !filteredDeduplicatedNotifications.some(n => String(n.invoice) === String(o.id))).length}
                      </span>
                      Active Orders
                    </h2>
                    <div className="space-y-3">
                      {[...otherActiveOrders, ...readyOrders.filter(o => !filteredDeduplicatedNotifications.some(n => String(n.invoice) === String(o.id)))].map((order) => (
                        <OrderCard
                          key={`order-${order.id}`}
                          order={order}
                          showWaiter={isAllTab}
                          activeTab={activeTab}
                          products={products}
                          categories={categories}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* 3. Empty State for Order Tabs */}
                {filteredDeduplicatedNotifications.length === 0 && otherActiveOrders.length === 0 && readyOrders.filter(o => !filteredDeduplicatedNotifications.some(n => String(n.invoice) === String(o.id))).length === 0 && (
                  <div className="py-8 text-center text-muted-foreground text-sm">No active orders to show</div>
                )}
              </div>
            )}


            {/* Completed / Paid Orders */}
            {isCompletedTab && (
              <>
                {doneOrders.length > 0 ? (
                  <section>
                    <h2 className="text-xs font-bold mb-2 text-muted-foreground uppercase tracking-widest">
                      Completed
                    </h2>
                    <div className="space-y-3">
                      {doneOrders.map((order) => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          showWaiter={isAllTab}
                          activeTab={activeTab}
                          products={products}
                          categories={categories}
                          onUndo={async () => {
                            try {
                              await updateInvoiceStatus(order.id, "READY", { received_by_waiter: null });
                              toast.success("Pick up undone!");
                              loadData();
                            } catch (err: any) {
                              toast.error(err.message || "Failed to undo pick up");
                            }
                          }}
                        />
                      ))}
                    </div>
                  </section>
                ) : (
                  <div className="py-8 text-center text-muted-foreground text-sm">No completed orders to show</div>
                )}
              </>
            )}

            {/* Global Empty State overrides if literally 0 orders exist across the board */}
            {!loading && displayOrders.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <ChefHat className="h-14 w-14 mb-4 opacity-30" />
                <h3 className="text-base font-semibold">No orders yet</h3>
                <p className="text-sm mb-4">
                  {activeTab === "mine" ? "Orders you place will appear here" : "No orders in the branch today"}
                </p>
                {activeTab === "mine" && (
                  <Button onClick={() => navigate("/waiter/tables")} size="sm">
                    Take New Order
                  </Button>
                )}
              </div>
            )}

          </div>
        )}
      </main>

      <WaiterBottomNav />
    </div>
  );
}


function OrderCard({
  order,
  showWaiter = false,
  notification = null,
  activeTab,
  products = [],
  categories = [],
  onUndo,
}: {
  order: any;
  showWaiter?: boolean;
  notification?: any;
  activeTab?: string;
  products?: any[];
  categories?: any[];
  onUndo?: () => void;
}) {
  const currentUser = getCurrentUser();
  const isReady = order.invoice_status === "READY";
  const isCompleted = order.invoice_status === "COMPLETED";
  const isPaid = order.payment_status === "PAID" || order.payment_status === "WAITER RECEIVED" || isCompleted;
  const [showItems, setShowItems] = useState(true);

  // Check if current user is the one who picked it up
  const isMyPickUp = String(order.received_by_waiter) === String(currentUser?.id);

  // Fallback for older orders without table_no
  const tableMatch = (order?.description || order?.invoice_description || "").match(/Table (\d+)/);
  const parsedTableNo = order?.table_no || (tableMatch ? parseInt(tableMatch[1]) : null);

  // Get floor name from notification or order
  const floorName = notification?.floor_name || order?.floor_name;

  return (
    <div
      className={cn(
        "card-elevated overflow-hidden transition-all",
        isReady && "ring-2 ring-success/50 shadow-lg shadow-success/10",
        isPaid && "opacity-75"
      )}
    >
      {/* Header */}
      <div className={cn(
        "px-4 py-2.5 flex items-center justify-between border-b border-slate-100",
        isReady && "bg-success/5",
        isPaid && "bg-slate-50"
      )}>
        <div className="flex items-center gap-2">
          <span className="font-bold text-[15px]">
            Order #{order?.invoice_number ? String(order.invoice_number).slice(-4) : "????"}
          </span>

          {/* Floor badge - always show if floor name exists */}
          {floorName && (
            <span className="text-[10px] bg-success/20 text-success px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              Floor: {floorName.toUpperCase()}
            </span>
          )}
        </div>
        <StatusBadge status={(order?.invoice_status || "PENDING").toLowerCase()} />
      </div>

      {/* Body */}
      <div className="px-4 py-2.5">
        {/* Order Metadata summary */}
        <div className="flex items-center gap-3 mb-3 pl-1">
          <div className="flex flex-col">
            <p className="text-sm font-medium text-slate-600">
              {parsedTableNo ? (
                <>
                  Table <span className="font-bold text-slate-800">{parsedTableNo}</span>

                </>
              ) : (
                <span className="font-bold text-slate-800">Takeaway</span>
              )}
            </p>
          </div>
        </div>

        {/* Expandable Items Section */}
        {showItems ? (
          <div className="space-y-1 mb-3 pt-2 border-t border-slate-100 transition-all">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-black uppercase text-slate-400">Items</span>
              <button
                onClick={() => setShowItems(false)}
                className="text-[10px] font-bold text-primary hover:underline"
              >
                Hide
              </button>
            </div>

            {(order?.items || []).length === 0 && (
              <p className="text-xs text-muted-foreground italic">No items</p>
            )}

            {/* Show all items if expanded */}
            {(order?.items || [])
              .filter((item: any) => {
                const targetKitchenTypeId = notification?.kitchen_type_id;

                // If not filtered by notification, show everything in "all" or standard cards
                if (!targetKitchenTypeId) return true;

                // Filter by targetKitchenTypeId exactly matching the kitchen
                const product = products.find((p: any) => p.id === item.product);
                if (!product) return true; // Keep it if we can't find product just in case

                const category = categories.find((c: any) => c.id === product.category);
                if (!category) return true;

                return category.kitchentype === targetKitchenTypeId;
              })
              .map((item: any, idx: number) => {
                const name = item?.product_name || item?.product?.name || item?.name || `Product #${item?.product || "?"}`;
                const qty = item?.quantity ?? 1;
                const price = item?.unit_price ?? item?.price ?? (item?.product?.selling_price) ?? null;
                return (
                  <div key={idx} className="flex justify-between items-center text-sm bg-slate-50/50 p-1 rounded">
                    <span className="text-slate-700 font-medium leading-tight inline-flex gap-1.5">
                      <span className="text-primary font-bold bg-primary/10 px-1 rounded">{qty}×</span>{name}
                    </span>
                    {price != null && (
                      <span className="text-slate-500 text-[11px] tabular-nums font-bold">
                        Rs.{(Number(price) * qty).toFixed(0)}
                      </span>
                    )}
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="mb-2">
            <button
              onClick={() => setShowItems(true)}
              className="text-[11px] font-bold text-slate-400 flex items-center gap-1 hover:text-primary transition-colors bg-slate-50 px-2 py-0.5 rounded-md"
            >
              View {(order?.items || []).length} Items
            </button>
          </div>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between pt-2 border-t border-dashed border-slate-100">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {notification ? (
              <span className="font-extrabold text-success uppercase tracking-widest text-[10px] flex items-center gap-1">
                <span>FROM {notification.kitchen_type_name ? notification.kitchen_type_name.toUpperCase() : "KITCHEN"}</span>
                <span className="text-success/50">•</span>
                <span>{notification.kitchen_user_name}</span>
                {(notification.floor_name || order?.floor_name) && (
                  <>

                  </>
                )}
              </span>
            ) : (
              <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px] flex items-center gap-1">
                <span>Active Order</span>
                {order?.received_by_waiter_name && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="text-success font-black">PICKED BY {order.received_by_waiter_name.toUpperCase()}</span>
                  </>
                )}
              </span>
            )}

            {showWaiter && order?.created_by_name && !notification && (
              <>
                <span className="text-slate-300">•</span>
                <span className="font-medium text-slate-500">{order.created_by_name}</span>
              </>
            )}
          </div>
          <span className={cn(
            "font-bold text-sm tabular-nums",
            isPaid ? "text-success" : "text-primary"
          )}>
            Rs.{Number(order?.total_amount || 0).toFixed(2)}
          </span>
        </div>


        {isCompleted && onUndo && isMyPickUp && (
          <div className="pt-3 pb-1">
            <Button
              onClick={onUndo}
              variant="outline"
              className="w-full border-red-200 text-red-500 hover:bg-red-50 font-bold h-10 rounded-xl transition-all"
            >
              Undo Pick Up
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
