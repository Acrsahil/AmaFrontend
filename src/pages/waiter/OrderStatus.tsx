import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WaiterBottomNav } from "@/components/waiter/WaiterBottomNav";
import {
  ChefHat, Bell, Loader2, User, Users, ChevronDown, ChevronUp,
  Edit, MoveRight, LayoutGrid, List, Layers, CheckCircle2,
  Clock, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  fetchInvoices, fetchNotifications, fetchProducts, fetchCategories,
  updateInvoiceStatus, fetchInvoiceDetail, fetchTables, patchInvoice
} from "@/api/index.js";
import { getCurrentUser } from "@/auth/auth";
import { useOrdersWebSocket } from "@/hooks/useOrdersWebSocket";
import { format, formatDistanceToNow } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

type MainTab = "mine" | "all";
type ViewMode = "grid" | "list";

export default function OrderStatus() {
  const navigate = useNavigate();
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<MainTab>("mine");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const currentUser = getCurrentUser();

  // Floor / table state
  const [floors, setFloors] = useState<any[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<any>(null);
  const [allTableDefs, setAllTableDefs] = useState<any[]>([]);

  // Transfer modals
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedTransferOrder, setSelectedTransferOrder] = useState<any>(null);
  const [transferring, setTransferring] = useState(false);
  const [showTransferTableModal, setShowTransferTableModal] = useState(false);
  const [newTableNo, setNewTableNo] = useState("");
  const [isTransferringTable, setIsTransferringTable] = useState(false);

  // Order detail modal (for grid tap)
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [modalOrder, setModalOrder] = useState<any>(null);

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
          try { return await fetchInvoiceDetail(inv.id); }
          catch { return inv; }
        })
      );

      setAllOrders(enrichedOrders);
      setNotifications((notifs.results || notifs || []).filter((n: any) => !n.is_read));
      setProducts(prodData.results || prodData || []);
      setCategories(catData.results || catData || []);

      const fl = floorsData || [];
      setFloors(fl);

      // Keep existing selection or default to first
      setSelectedFloor((prev: any) => {
        if (prev) {
          const still = fl.find((f: any) => f.id === prev.id);
          return still || (fl[0] ?? null);
        }
        return fl[0] ?? null;
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Restore saved floor selection
  useEffect(() => {
    if (floors.length === 0) return;
    const saved = localStorage.getItem('selectedFloorId');
    if (saved) {
      const found = floors.find((f: any) => String(f.id) === saved);
      if (found) setSelectedFloor(found);
    }
  }, [floors]);

  // Regenerate table list when floor changes
  useEffect(() => {
    if (!selectedFloor) return;
    const count = selectedFloor.table_count || 0;
    setAllTableDefs(Array.from({ length: count }, (_, i) => ({
      id: `t-${selectedFloor.id}-${i + 1}`,
      number: i + 1,
    })));
  }, [selectedFloor]);

  // WebSocket live refresh
  useOrdersWebSocket(
    useCallback((data) => {
      if (data.type === "invoice_updated" && data.status === "READY") {
        fetchInvoiceDetail(data.invoice_id)
          .then((order) => {
            if (order && String(order.created_by) === String(currentUser?.id)) {
              const tableMatch = (order?.description || order?.invoice_description || "").match(/Table (\d+)/);
              const tableNo = order?.table_no || (tableMatch ? tableMatch[1] : "");
              const tableText = tableNo ? `Table ${tableNo}` : "Takeaway";
              try {
                const audio = new Audio("/noti.mp3");
                audio.play().catch(() => { });
              } catch { }
              setTimeout(() => {
                try {
                  if ("speechSynthesis" in window) {
                    window.speechSynthesis.cancel();
                    const u = new SpeechSynthesisUtterance(`Order for ${tableText} is ready to pickup`);
                    u.rate = 0.95;
                    window.speechSynthesis.speak(u);
                  }
                } catch { }
              }, 850);
              toast.success(`Order for ${tableText} is ready for pickup!`, {
                icon: <Bell className="h-5 w-5 text-success animate-bounce" />, duration: 6000,
              });
            }
          })
          .catch(() => { })
          .finally(() => loadData());
      } else if (data.type === "invoice_created" || data.type === "invoice_updated") {
        loadData();
      }
    }, [loadData, currentUser?.id]),
    currentUser?.branch_id
  );

  // ── Helpers ──────────────────────────────────────────────────────────────
  const displayOrders = allOrders.filter((o) => {
    const isMine = String(o.created_by) === String(currentUser?.id);
    return activeTab === "mine" ? isMine : true;
  });

  const activeOrders = displayOrders.filter(
    o => o?.invoice_status !== "COMPLETED" && o?.invoice_status !== "CANCELLED"
  );
  const doneOrders = displayOrders.filter(
    o => o?.invoice_status === "COMPLETED" || o?.invoice_status === "CANCELLED"
  );

  const readyOrders = activeOrders.filter(o => o?.invoice_status === "READY");

  const filteredNotifs = notifications.reduce((acc: any[], cur: any) => {
    const order = allOrders.find(o => String(o.id) === String(cur.invoice));
    if (!order || order.invoice_status !== "READY") return acc;
    const isMine = String(order.created_by) === String(currentUser?.id);
    if (activeTab === "mine" && !isMine) return acc;
    const idx = acc.findIndex(n => String(n.invoice) === String(cur.invoice));
    if (idx > -1) { if (cur.id > acc[idx].id) acc[idx] = cur; }
    else acc.push(cur);
    return acc;
  }, []);

  // Build per-table order map (table_no → order) for the current floor
  const tableOrderMap: Record<number, any> = {};
  activeOrders.forEach(o => {
    const floorId = o.floor || o.floor_id;
    if (selectedFloor && String(floorId) !== String(selectedFloor.id)) return;
    const tableMatch = (o?.description || o?.invoice_description || "").match(/Table (\d+)/);
    const tableNo = o?.table_no ? Number(o.table_no) : (tableMatch ? parseInt(tableMatch[1]) : null);
    if (tableNo) {
      // Prefer READY orders over PENDING if same table
      if (!tableOrderMap[tableNo] || o.invoice_status === "READY") {
        tableOrderMap[tableNo] = o;
      }
    }
  });

  const handleEditOrder = (order: any) => {
    const tableNo = order.table_no || "takeaway";
    navigate(`/waiter/order/${tableNo}?invoiceId=${order.id}&floorId=${order.floor}`);
  };

  const handleTableTap = (tableNum: number) => {
    const order = tableOrderMap[tableNum];
    if (order) {
      setModalOrder(order);
      setShowOrderModal(true);
    } else {
      // Start fresh order on this table
      if (selectedFloor) navigate(`/waiter/order/${tableNum}?floorId=${selectedFloor.id}`);
    }
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
    } finally { setTransferring(false); }
  };

  const submitTransferTable = async () => {
    if (!selectedTransferOrder || !newTableNo) return;
    const tableNum = parseInt(newTableNo);
    if (isNaN(tableNum) || tableNum <= 0) { toast.error("Please enter a valid table number"); return; }
    setIsTransferringTable(true);
    try {
      const res = await patchInvoice(selectedTransferOrder.id, { transfer_to_table: tableNum });
      toast.success(res.message || `Transferred to Table ${tableNum}`);
      setShowTransferTableModal(false);
      setNewTableNo("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to transfer table");
    } finally { setIsTransferringTable(false); }
  };

  const handleFloorChange = (floor: any) => {
    setSelectedFloor(floor);
    localStorage.setItem('selectedFloorId', floor.id.toString());
  };

  // ── Ready badge count ─────────────────────────────────────────────────────
  const readyCount = readyOrders.length;

  return (
    <div className="min-h-screen bg-[#F2F2F7] pb-24">
      <MobileHeader title="Orders" showBack={false} />

      <main className="max-w-2xl mx-auto">

        {/* ── Top Control Bar ── */}
        <div className="px-3 pt-3 pb-2 space-y-3">

          {/* My / All toggle + Grid / List toggle */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex gap-[3px] p-[3px] bg-[#E5E5EA] rounded-[14px]">
              {(["mine", "all"] as MainTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[11px] text-[13px] font-semibold transition-all",
                    activeTab === tab
                      ? "bg-white text-[#1D1D1F] shadow-sm"
                      : "text-[#8E8E93] hover:text-[#1D1D1F]"
                  )}
                >
                  {tab === "mine" ? <User className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                  {tab === "mine" ? "My Orders" : "All Orders"}
                </button>
              ))}
            </div>

            {/* View toggle */}
            <div className="flex gap-[3px] p-[3px] bg-[#E5E5EA] rounded-[14px]">
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "h-9 w-9 flex items-center justify-center rounded-[11px] transition-all",
                  viewMode === "grid" ? "bg-white text-[#1D1D1F] shadow-sm" : "text-[#8E8E93]"
                )}
              ><LayoutGrid className="h-4 w-4" /></button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "h-9 w-9 flex items-center justify-center rounded-[11px] transition-all",
                  viewMode === "list" ? "bg-white text-[#1D1D1F] shadow-sm" : "text-[#8E8E93]"
                )}
              ><List className="h-4 w-4" /></button>
            </div>
          </div>

          {/* Ready banner */}
          {readyCount > 0 && (
            <div className="flex items-center gap-3 bg-[#1D1D1F] rounded-2xl px-4 py-3">
              <div className="h-8 w-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <Bell className="h-4 w-4 text-white animate-bounce" />
              </div>
              <div className="flex-1">
                <p className="text-white text-[13px] font-semibold leading-none mb-0.5">
                  {readyCount} order{readyCount > 1 ? "s" : ""} ready for pickup
                </p>
                <p className="text-white/50 text-[11px]">Tap the highlighted table</p>
              </div>
              <span className="h-2 w-2 rounded-full bg-[#30D158] animate-pulse shrink-0" />
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 text-primary animate-spin mb-3" />
            <p className="text-gray-400 text-sm">Loading orders...</p>
          </div>
        ) : viewMode === "grid" ? (

          /* ══ GRID VIEW ══════════════════════════════════════════════════════════ */
          <div className="px-3 space-y-3">

            {/* Floor selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-3 bg-white rounded-2xl border border-[#D1D1D6] px-4 py-3.5 hover:bg-[#F9F9F9] active:bg-[#F2F2F7] transition-all">
                  <div className="h-8 w-8 rounded-xl bg-[#F2F2F7] flex items-center justify-center shrink-0">
                    <Layers className="h-4 w-4 text-[#1D1D1F]" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-[10px] text-[#8E8E93] font-semibold uppercase tracking-wider leading-none mb-0.5">Floor</p>
                    <p className="text-[15px] font-semibold text-[#1D1D1F] leading-none">{selectedFloor?.name || "Select Floor"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#8E8E93] font-medium">
                      {selectedFloor?.table_count || 0} tables
                    </span>
                    <ChevronDown className="h-4 w-4 text-[#8E8E93]" />
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[calc(100vw-1.5rem)] max-w-2xl rounded-2xl p-2 shadow-xl border border-[#D1D1D6]">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-widest font-semibold text-[#8E8E93] px-3 py-2">Select Floor</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {floors.map(floor => (
                  <DropdownMenuItem
                    key={floor.id}
                    className="h-12 rounded-xl focus:bg-[#F2F2F7] focus:text-[#1D1D1F] cursor-pointer"
                    onClick={() => handleFloorChange(floor)}
                  >
                    <Layers className="h-4 w-4 mr-3 text-[#8E8E93]" />
                    <span className="font-semibold text-[#1D1D1F]">{floor.name}</span>
                    <span className="ml-auto text-[11px] bg-[#F2F2F7] text-[#8E8E93] px-2 py-0.5 rounded-full font-medium">
                      {floor.table_count} tables
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Table grid */}
            {allTableDefs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Layers className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm">No tables on this floor</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {allTableDefs.map(table => {
                  const order = tableOrderMap[table.number];
                  const isReady = order?.invoice_status === "READY";
                  const hasOrder = !!order;

                  return (
                    <button
                      key={table.id}
                      onClick={() => handleTableTap(table.number)}
                      className={cn(
                        "relative flex flex-col items-center justify-center rounded-2xl border transition-all active:scale-[0.96] py-4 px-2 min-h-[96px]",
                        isReady
                          ? "bg-[#1D1D1F] border-[#1D1D1F] shadow-lg"
                          : hasOrder
                            ? "bg-[#FFF9C4] border-[#F0C000]"
                            : "bg-white border-[#D1D1D6] hover:border-[#8E8E93]"
                      )}
                    >
                      {/* Ready pulse dot */}
                      {isReady && (
                        <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-[#30D158] animate-pulse" />
                      )}

                      <span className={cn(
                        "text-[24px] font-bold leading-none mb-1 tabular-nums",
                        isReady ? "text-white" : "text-[#78570A]"
                      )}>{table.number}</span>

                      <span className={cn(
                        "text-[9px] font-semibold uppercase tracking-widest",
                        isReady ? "text-[#30D158]" : hasOrder ? "text-[#78570A]/70" : "text-[#C7C7CC]"
                      )}>
                        {isReady ? "READY" : hasOrder ? "OCCUPIED" : "FREE"}
                      </span>

                      {hasOrder && (
                        <span className={cn(
                          "mt-1.5 text-[11px] font-semibold tabular-nums",
                          isReady ? "text-white/70" : "text-[#78570A]/80"
                        )}>
                          Rs.{Number(order?.total_amount || 0).toFixed(0)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center justify-center gap-5 py-1">
              {[
                { color: "bg-[#D1D1D6]", label: "Free" },
                { color: "bg-[#F0C000]", label: "Occupied" },
                { color: "bg-[#30D158]", label: "Ready" },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", l.color)} />
                  <span className="text-[11px] text-[#8E8E93] font-medium">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

        ) : (

          /* ══ LIST VIEW ══════════════════════════════════════════════════════════ */
          <div className="px-3 space-y-4">

            {/* Ready orders */}
            {readyOrders.length > 0 && (
              <section>
                <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-widest mb-2.5 ml-1">
                  Ready for Pickup ({readyOrders.length})
                </p>
                <div className="space-y-2.5">
                  {readyOrders.map(order => (
                    <OrderCard key={order.id} order={order} showWaiter={activeTab === "all"}
                      activeTab={activeTab} products={products} categories={categories}
                      notification={filteredNotifs.find(n => String(n.invoice) === String(order.id))}
                      onEdit={() => handleEditOrder(order)}
                      onTransfer={() => { setSelectedTransferOrder(order); setShowTransferModal(true); }}
                      onTransferTable={() => {
                        setSelectedTransferOrder(order);
                        const m = (order?.description || order?.invoice_description || "").match(/Table (\d+)/);
                        setNewTableNo(order?.table_no ? String(order.table_no) : (m ? m[1] : ""));
                        setShowTransferTableModal(true);
                      }}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Other active orders */}
            {activeOrders.filter(o => o.invoice_status !== "READY").length > 0 && (
              <section>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5 ml-1">
                  Active ({activeOrders.filter(o => o.invoice_status !== "READY").length})
                </p>
                <div className="space-y-2.5">
                  {activeOrders.filter(o => o.invoice_status !== "READY").map(order => (
                    <OrderCard key={order.id} order={order} showWaiter={activeTab === "all"}
                      activeTab={activeTab} products={products} categories={categories}
                      onEdit={() => handleEditOrder(order)}
                      onTransfer={() => { setSelectedTransferOrder(order); setShowTransferModal(true); }}
                      onTransferTable={() => {
                        setSelectedTransferOrder(order);
                        const m = (order?.description || order?.invoice_description || "").match(/Table (\d+)/);
                        setNewTableNo(order?.table_no ? String(order.table_no) : (m ? m[1] : ""));
                        setShowTransferTableModal(true);
                      }}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Completed orders */}
            {doneOrders.length > 0 && (
              <section>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5 ml-1">
                  Completed
                </p>
                <div className="space-y-2.5">
                  {doneOrders.map(order => (
                    <OrderCard key={order.id} order={order} showWaiter={activeTab === "all"}
                      activeTab={activeTab} products={products} categories={categories}
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

            {!loading && displayOrders.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <ChefHat className="h-14 w-14 mb-4 opacity-20" />
                <h3 className="text-base font-semibold text-gray-600">No orders yet</h3>
                <p className="text-sm mb-5 text-center">
                  {activeTab === "mine" ? "Orders you place will appear here" : "No orders in the branch today"}
                </p>
                {activeTab === "mine" && (
                  <Button onClick={() => navigate("/waiter/tables")} size="sm" className="rounded-xl">Take New Order</Button>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Order Quick-View Modal (from grid tap) ── */}
      <Dialog open={showOrderModal} onOpenChange={setShowOrderModal}>
        <DialogContent className="max-w-[calc(100%-2rem)] w-[420px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          {modalOrder && (() => {
            const isReady = modalOrder.invoice_status === "READY";
            const isPaid = (modalOrder.payment_status === "PAID" || modalOrder.payment_status === "WAITER RECEIVED") && Number(modalOrder.due_amount || 0) <= 0;
            const tableMatch = (modalOrder?.description || modalOrder?.invoice_description || "").match(/Table (\d+)/);
            const tableNo = modalOrder?.table_no || (tableMatch ? tableMatch[1] : "?");
            return (
              <>
                <div className="px-5 py-4 flex items-center justify-between border-b border-[#D1D1D6] bg-white">
                  <div>
                    <p className="text-[#8E8E93] text-[11px] font-medium uppercase tracking-wider leading-none mb-1">Table {tableNo}</p>
                    <p className="text-[#1D1D1F] text-[17px] font-bold leading-none">
                      Order #{String(modalOrder.invoice_number || "").slice(-4)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isReady && (
                      <span className="bg-[#1D1D1F] text-white text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#30D158] animate-pulse" />
                        READY
                      </span>
                    )}
                    <span className="text-[#1D1D1F] text-[15px] font-bold">
                      Rs.{Number(modalOrder.total_amount || 0).toFixed(0)}
                    </span>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* Items */}
                  <div className="space-y-1.5">
                    {(modalOrder.items || []).map((item: any, idx: number) => {
                      const name = item?.product_name || item?.name || `Item ${idx + 1}`;
                      const qty = item?.quantity ?? 1;
                      const price = item?.unit_price ?? item?.price ?? null;
                      return (
                        <div key={idx} className="flex items-center justify-between text-[13px] bg-gray-50 rounded-xl px-3 py-2.5">
                          <span className="text-gray-700 font-medium flex items-center gap-2">
                            <span className="text-primary font-bold text-[11px] bg-primary/10 px-1.5 py-0.5 rounded-lg">{qty}×</span>
                            {name}
                          </span>
                          {price != null && (
                            <span className="text-gray-500 font-semibold tabular-nums">Rs.{(Number(price) * qty).toFixed(0)}</span>
                          )}
                        </div>
                      );
                    })}
                    {(modalOrder.items || []).length === 0 && (
                      <p className="text-sm text-gray-400 italic text-center py-3">No items</p>
                    )}
                  </div>

                  {/* Actions */}
                  {!isPaid && (
                    <div className="flex flex-col gap-2 pt-2 border-t border-[#F2F2F7]">
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setShowOrderModal(false); setSelectedTransferOrder(modalOrder); setShowTransferModal(true); }}
                          className="flex-1 h-11 rounded-2xl border border-[#D1D1D6] bg-[#F9F9F9] text-[#1D1D1F] text-[13px] font-medium flex items-center justify-center gap-1.5 hover:bg-[#F2F2F7] active:bg-[#E5E5EA] transition-all"
                        >
                          <MoveRight className="h-3.5 w-3.5" />Floor Transfer
                        </button>
                        <button
                          onClick={() => {
                            setShowOrderModal(false);
                            setSelectedTransferOrder(modalOrder);
                            const m = (modalOrder?.description || modalOrder?.invoice_description || "").match(/Table (\d+)/);
                            setNewTableNo(modalOrder?.table_no ? String(modalOrder.table_no) : (m ? m[1] : ""));
                            setShowTransferTableModal(true);
                          }}
                          className="flex-1 h-11 rounded-2xl border border-[#D1D1D6] bg-[#F9F9F9] text-[#1D1D1F] text-[13px] font-medium flex items-center justify-center gap-1.5 hover:bg-[#F2F2F7] active:bg-[#E5E5EA] transition-all"
                        >
                          <MoveRight className="h-3.5 w-3.5" />Table Transfer
                        </button>
                      </div>
                      <button
                        onClick={() => { setShowOrderModal(false); handleEditOrder(modalOrder); }}
                        className="w-full h-12 rounded-2xl bg-[#1D1D1F] text-white text-[15px] font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all"
                      >
                        <Edit className="h-4 w-4" /> Edit Items
                      </button>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Floor Transfer Dialog */}
      <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
        <DialogContent className="max-w-[400px] rounded-3xl p-6">
          <DialogHeader><DialogTitle>Transfer to Floor</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-4">
            {floors.map(floor => (
              <Button key={floor.id} variant="outline" className="w-full justify-between h-14"
                onClick={() => submitTransfer(floor.id)} disabled={transferring}>
                <span className="font-bold">{floor.name}</span>
                <span className="text-xs text-muted-foreground">{floor.table_count} tables</span>
              </Button>
            ))}
            {floors.length === 0 && <p className="text-center text-muted-foreground">No floors configured.</p>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Table Transfer Dialog */}
      <Dialog open={showTransferTableModal} onOpenChange={setShowTransferTableModal}>
        <DialogContent className="max-w-[320px] rounded-2xl p-6 z-[110]">
          <DialogHeader><DialogTitle className="text-lg font-bold">Transfer Table</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-3">
            <Input type="number" placeholder="Enter table number" value={newTableNo}
              onChange={(e) => setNewTableNo(e.target.value)}
              className="text-center font-bold text-xl h-12" />
            <Button className="w-full h-12 rounded-xl font-bold bg-primary text-white"
              onClick={submitTransferTable} disabled={isTransferringTable}>
              {isTransferringTable ? <Loader2 className="h-5 w-5 animate-spin" /> : "Transfer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <WaiterBottomNav />
    </div>
  );
}


/* ── OrderCard (list view) ────────────────────────────────────────────────── */
function OrderCard({
  order, showWaiter = false, notification = null, activeTab,
  products = [], categories = [], onUndo, onEdit, onTransfer, onTransferTable,
}: {
  order: any; showWaiter?: boolean; notification?: any; activeTab?: string;
  products?: any[]; categories?: any[];
  onUndo?: () => void; onEdit?: () => void; onTransfer?: () => void; onTransferTable?: () => void;
}) {
  const currentUser = getCurrentUser();
  const isReady = order.invoice_status === "READY";
  const isCompleted = order.invoice_status === "COMPLETED";
  const isPaid = (order.payment_status === "PAID" || order.payment_status === "WAITER RECEIVED" || isCompleted) && Number(order.due_amount || 0) <= 0;
  const [showItems, setShowItems] = useState(false);
  const isMyPickUp = String(order.received_by_waiter) === String(currentUser?.id);
  const tableMatch = (order?.description || order?.invoice_description || "").match(/Table (\d+)/);
  const parsedTableNo = order?.table_no || (tableMatch ? parseInt(tableMatch[1]) : null);
  const floorName = notification?.floor_name || order?.floor_name;

  return (
    <div className={cn(
      "bg-white rounded-2xl border overflow-hidden transition-all",
      isReady ? "border-[#1D1D1F]" : "border-[#D1D1D6]",
      isPaid && "opacity-60"
    )}>
      {/* Header */}
      <div className={cn(
        "px-4 py-3 flex items-center justify-between border-b border-[#F2F2F7]",
        isReady && "bg-[#1D1D1F]"
      )}>
        <div className="flex items-center gap-2">
          <span className={cn("font-semibold text-[15px]", isReady ? "text-white" : "text-[#1D1D1F]")}>
            Order #{String(order?.invoice_number || "").slice(-4)}
          </span>
          {floorName && (
            <span className={cn(
              "text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase",
              isReady ? "bg-white/15 text-white/80" : "bg-[#F2F2F7] text-[#8E8E93]"
            )}>
              {floorName}
            </span>
          )}
        </div>
        <StatusBadge status={(order?.invoice_status || "PENDING").toLowerCase()} />
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        <p className="text-[13px] text-[#8E8E93] mb-3">
          {parsedTableNo ? <>Table <span className="font-bold text-[#1D1D1F]">{parsedTableNo}</span></> : <span className="font-bold text-[#1D1D1F]">Takeaway</span>}
        </p>

        {/* Items toggle */}
        <button onClick={() => setShowItems(!showItems)}
          className="w-full flex justify-between items-center py-2 border-t border-[#F2F2F7] hover:bg-[#F9F9F9] transition-all rounded-lg px-1 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[#8E8E93]">
            Items ({(order?.items || []).length})
          </span>
          {showItems ? <ChevronUp className="h-4 w-4 text-[#8E8E93]" /> : <ChevronDown className="h-4 w-4 text-[#8E8E93]" />}
        </button>

        {showItems && (
          <div className="space-y-1.5 mb-3 animate-in fade-in slide-in-from-top-1 duration-200">
            {(order?.items || []).map((item: any, idx: number) => {
              const name = item?.product_name || item?.name || `Product #${item?.product || "?"}`;
              const qty = item?.quantity ?? 1;
              const price = item?.unit_price ?? item?.price ?? null;
              return (
                <div key={idx} className="flex justify-between items-center text-[13px] bg-[#F9F9F9] p-2.5 rounded-xl border border-[#F2F2F7]">
                  <span className="text-[#1D1D1F] font-medium flex items-center gap-2">
                    <span className="text-[#1D1D1F] font-bold bg-[#E5E5EA] px-1.5 py-0.5 rounded-lg text-[11px]">{qty}×</span>
                    {name}
                  </span>
                  {price != null && (
                    <span className="text-[#8E8E93] text-[11px] font-semibold tabular-nums">
                      Rs.{(Number(price) * qty).toFixed(0)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-dashed border-[#E5E5EA]">
          <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-widest">
            {notification ? `FROM ${(notification.kitchen_type_name || "KITCHEN").toUpperCase()}` : "Active Order"}
          </span>
          <span className={cn("font-bold text-[14px] tabular-nums", isPaid ? "text-[#30D158]" : "text-[#1D1D1F]")}>
            Rs.{Number(order?.total_amount || 0).toFixed(0)}
          </span>
        </div>

        {/* Undo */}
        {isCompleted && onUndo && isMyPickUp && (
          <div className="pt-3 pb-1">
            <button onClick={onUndo}
              className="w-full h-10 rounded-xl border border-[#D1D1D6] text-[#FF3B30] text-[13px] font-semibold hover:bg-[#FFF5F5] transition-all">
              Undo Pick Up
            </button>
          </div>
        )}

        {/* Edit / Transfer */}
        {!isPaid && !isCompleted && !notification && activeTab === 'mine' && (
          <div className="flex flex-col gap-2 pt-3 mt-2 border-t border-[#F2F2F7]">
            <div className="flex gap-2">
              {onTransfer && (
                <button onClick={onTransfer}
                  className="flex-1 h-9 rounded-xl border border-[#D1D1D6] bg-[#F9F9F9] text-[#1D1D1F] text-[12px] font-medium flex items-center justify-center gap-1.5 hover:bg-[#F2F2F7] transition-all">
                  <MoveRight className="h-3.5 w-3.5" />Floor
                </button>
              )}
              {onTransferTable && (
                <button onClick={onTransferTable}
                  className="flex-1 h-9 rounded-xl border border-[#D1D1D6] bg-[#F9F9F9] text-[#1D1D1F] text-[12px] font-medium flex items-center justify-center gap-1.5 hover:bg-[#F2F2F7] transition-all">
                  <MoveRight className="h-3.5 w-3.5" />Table
                </button>
              )}
            </div>
            {onEdit && (
              <button onClick={onEdit}
                className="w-full h-9 rounded-xl bg-[#1D1D1F] text-white text-[12px] font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all">
                <Edit className="h-3.5 w-3.5" />Edit Items
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
