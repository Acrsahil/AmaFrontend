import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WaiterBottomNav } from "@/components/waiter/WaiterBottomNav";
import { ChefHat, Bell, Loader2, User, Users, Clock, Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { fetchInvoices, fetchNotifications, markNotificationRead, fetchProducts, fetchCategories, updateInvoiceStatus, fetchInvoiceDetail } from "@/api/index.js";
import { getCurrentUser } from "@/auth/auth";
import { useOrdersWebSocket } from "@/hooks/useOrdersWebSocket";
import { format, formatDistanceToNow } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fetchTables, patchInvoice } from "@/api/index.js";
import { Edit, MoveRight } from "lucide-react";

type MainTab = "mine" | "all";


export default function OrderStatus() {
  const navigate = useNavigate();
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<MainTab>("mine");

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const currentUser = getCurrentUser();
  const [floors, setFloors] = useState<any[]>([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedTransferOrder, setSelectedTransferOrder] = useState<any>(null);
  const [transferring, setTransferring] = useState(false);
  const [showTransferTableModal, setShowTransferTableModal] = useState(false);
  const [newTableNo, setNewTableNo] = useState("");
  const [isTransferringTable, setIsTransferringTable] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dataRes, notifs, prodData, catData, floorsData] = await Promise.all([
        fetchInvoices({ date: format(new Date(), 'yyyy-MM-dd') }),
        fetchNotifications(),
        fetchProducts(),
        fetchCategories(),
        fetchTables()
      ]);
      const data = dataRes.results || dataRes;

      const enrichedOrders = await Promise.all(
        (data || []).map(async (inv: any) => {
          try {
            return await fetchInvoiceDetail(inv.id);
          } catch (err) {
            console.error(`Failed to fetch detail for waiter order ${inv.id}:`, err);
            return inv;
          }
        })
      );

      const notificationsData = notifs.results || notifs;
      const productsData = prodData.results || prodData;
      const categoriesData = catData.results || catData;

      setAllOrders(enrichedOrders);
      setNotifications((notificationsData || []).filter((n: any) => !n.is_read));
      setProducts(productsData || []);
      setCategories(categoriesData || []);
      setFloors(floorsData || []);
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
          fetchInvoiceDetail(data.invoice_id)
            .then((order) => {
              if (order && String(order.created_by) === String(currentUser?.id)) {
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
                  icon: <Bell className="h-5 w-5 text-success animate-bounce" />,
                  duration: 6000,
                });
              }
            })
            .catch((err) => {
              console.error("Failed to fetch order detail on WS notify:", err);
            })
            .finally(() => {
              loadData();
            });
        } else if (data.type === "invoice_created" || data.type === "invoice_updated") {
          loadData();
        }
      },
      [loadData, currentUser?.id]
    ),
    currentUser?.branch_id
  );

  // Filtering logic
  const displayOrders = allOrders.filter((o) => {
    const isMine = String(o.created_by) === String(currentUser?.id);
    return activeTab === "mine" ? isMine : true;
  });

  const readyOrders = displayOrders.filter(o => o?.invoice_status === "READY");
  const otherActiveOrders = displayOrders.filter(o => o?.invoice_status !== "READY" && o?.invoice_status !== "COMPLETED" && o?.invoice_status !== "CANCELLED");
  const doneOrders = displayOrders.filter(o => o?.invoice_status === "COMPLETED" || o?.invoice_status === "CANCELLED");

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

  const handleEditOrder = (order: any) => {
    const tableNo = order.table_no || "takeaway";
    navigate(`/waiter/order/${tableNo}?invoiceId=${order.id}&floorId=${order.floor}`);
  };

  const submitTransfer = async (floorId: number) => {
    if (!selectedTransferOrder) return;
    setTransferring(true);
    try {
      await patchInvoice(selectedTransferOrder.id, { transfer_to_floor: floorId });
      toast.success("Order transferred successfully!");
      setShowTransferModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to transfer");
    } finally {
      setTransferring(false);
    }
  };

  const submitTransferTable = async () => {
    if (!selectedTransferOrder || !newTableNo) return;
    const tableNum = parseInt(newTableNo);
    if (isNaN(tableNum) || tableNum <= 0) {
      toast.error("Please enter a valid table number");
      return;
    }
    setIsTransferringTable(true);
    try {
      const res = await patchInvoice(selectedTransferOrder.id, { transfer_to_table: tableNum });
      toast.success(res.message || `Transferred to Table ${tableNum}`);
      setShowTransferTableModal(false);
      setNewTableNo("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to transfer table");
    } finally {
      setIsTransferringTable(false);
    }
  };

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



        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-10 w-10 text-primary animate-spin mb-2" />
            <p className="text-muted-foreground animate-pulse text-sm">Loading orders...</p>
          </div>
        ) : (
          <div className="space-y-4">

            {/* Active Orders Section */}
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
                        onEdit={() => handleEditOrder(order)}
                        onTransfer={() => {
                          setSelectedTransferOrder(order);
                          setShowTransferModal(true);
                        }}
                        onTransferTable={() => {
                          setSelectedTransferOrder(order);
                          const tableMatch = (order?.description || order?.invoice_description || "").match(/Table (\d+)/);
                          const tableNo = order?.table_no || (tableMatch ? tableMatch[1] : "");
                          setNewTableNo(tableNo ? String(tableNo) : "");
                          setShowTransferTableModal(true);
                        }}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>


            {/* Completed / Paid Orders */}
            {doneOrders.length > 0 && (
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

      <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
        <DialogContent className="max-w-[400px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle>Transfer to Floor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {floors.map(floor => (
              <Button
                key={floor.id}
                variant="outline"
                className="w-full justify-between h-14"
                onClick={() => submitTransfer(floor.id)}
                disabled={transferring}
              >
                <span className="font-bold">{floor.name}</span>
                <span className="text-xs text-muted-foreground">{floor.table_count} tables</span>
              </Button>
            ))}
            {floors.length === 0 && <p className="text-center text-muted-foreground">No floors configured.</p>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer Table Dialog */}
      <Dialog open={showTransferTableModal} onOpenChange={setShowTransferTableModal}>
        <DialogContent className="max-w-[320px] rounded-2xl p-6 z-[110]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Transfer Table</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-3">
            <Input
              type="number"
              placeholder="Enter table number"
              value={newTableNo}
              onChange={(e) => setNewTableNo(e.target.value)}
              className="text-center font-bold text-xl h-12"
            />
            <Button
              className="w-full h-12 rounded-xl font-bold bg-primary text-white"
              onClick={submitTransferTable}
              disabled={isTransferringTable}
            >
              {isTransferringTable ? <Loader2 className="h-5 w-5 animate-spin" /> : "Transfer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
  onEdit,
  onTransfer,
  onTransferTable,
}: {
  order: any;
  showWaiter?: boolean;
  notification?: any;
  activeTab?: string;
  products?: any[];
  categories?: any[];
  onUndo?: () => void;
  onEdit?: () => void;
  onTransfer?: () => void;
  onTransferTable?: () => void;
}) {
  const currentUser = getCurrentUser();
  const isReady = order.invoice_status === "READY";
  const isCompleted = order.invoice_status === "COMPLETED";
  const isPaid = order.payment_status === "PAID" || order.payment_status === "WAITER RECEIVED" || isCompleted;
  const [showItems, setShowItems] = useState(false);

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
        isReady && "border-2 border-emerald-500 bg-emerald-50/80 shadow-lg shadow-emerald-100/80 ring-2 ring-emerald-400/20",
        isPaid && "opacity-75"
      )}
    >
      {/* Header */}
      <div className={cn(
        "px-4 py-2.5 flex items-center justify-between border-b border-slate-100",
        isReady && "bg-emerald-100/90 text-emerald-950 border-emerald-250",
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

        {/* Dropdown Items Header */}
        <button
          onClick={() => setShowItems(!showItems)}
          className="w-full flex justify-between items-center py-2 px-1 border-t border-slate-100 hover:bg-slate-50/80 transition-all group rounded-md mb-1"
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-slate-400 group-hover:text-primary transition-colors">
              Items ({(order?.items || []).length})
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
          <div className="space-y-1 mb-3 animate-in fade-in slide-in-from-top-1 duration-200">
            {(order?.items || []).length === 0 && (
              <p className="text-xs text-muted-foreground italic px-1">No items</p>
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
                  <div key={idx} className="flex justify-between items-center text-sm bg-slate-50/50 p-1.5 rounded-lg border border-slate-100/50">
                    <span className="text-slate-700 font-medium leading-tight inline-flex gap-1.5 items-center">
                      <span className="text-primary font-bold bg-primary/10 px-1.5 py-0.5 rounded text-[11px]">{qty}×</span>
                      {name}
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

        {!isPaid && !isCompleted && !notification && activeTab === 'mine' && (
          <div className="flex flex-col gap-2 pt-3 pb-1 mt-2 border-t border-slate-100">
            <div className="flex gap-2">
              {onTransfer && (
                <Button onClick={onTransfer} variant="outline" className="flex-1 h-9 rounded-xl text-xs gap-1.5 text-slate-500">
                  <MoveRight className="h-3.5 w-3.5" />
                  Floor Transfer
                </Button>
              )}
              {onTransferTable && (
                <Button onClick={onTransferTable} variant="outline" className="flex-1 h-9 rounded-xl text-xs gap-1.5 text-slate-500">
                  <MoveRight className="h-3.5 w-3.5" />
                  Table Transfer
                </Button>
              )}
            </div>
            {onEdit && (
              <Button onClick={onEdit} variant="outline" className="w-full h-9 rounded-xl text-xs gap-1.5 text-primary border-primary/20 hover:bg-primary/5">
                <Edit className="h-3.5 w-3.5" />
                Edit Items
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
