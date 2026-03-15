import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { OrderCard } from "@/components/kitchen/OrderCard";
import { branches } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import {
  ChefHat,
  LogOut,
  Bell,
  CheckCircle2,
  RotateCcw,
  Key,
  MapPin,
  Utensils,
  Coffee,
  Loader2,
  Layers,
  ChevronDown,
  Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { getCurrentUser, logout } from "../../auth/auth";
import { ChangePasswordModal } from "@/components/auth/ChangePasswordModal";
import { fetchInvoices, fetchProducts, fetchCategories, updateInvoiceStatus, fetchTables } from "../../api/index.js";
import { WS_BASE_URL } from "../../api/config";

export default function KitchenDisplay() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [floors, setFloors] = useState<any[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<number | 'all'>(() => {
    const stored = localStorage.getItem('kitchenFloorFilter');
    if (stored === 'all' || !stored) return 'all';
    return Number(stored);
  });
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);

  const handleFloorChange = (id: number | 'all') => {
    setSelectedFloorId(id);
    localStorage.setItem('kitchenFloorFilter', id.toString());
  };

  useEffect(() => {
    loadData();
  }, []);


  // WebSocket: listen for new invoices and refresh kitchen data
  useEffect(() => {
    const socket = new WebSocket(WS_BASE_URL + "/ws/kitchen/");

    socket.onopen = () => {
      setSocketConnected(true);
      console.log("[Kitchen WS] Connected");
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[Kitchen WS] Message:", data);
        if (data.type === "invoice_created") {
          // New order placed - show toast and refresh
          toast.success("New Order Received!", {
            description: "A new order has been placed",
            icon: <Bell className="h-5 w-5 text-primary" />,
          });
          loadData();
        } else if (data.type === "invoice_updated") {
          // Order updated - just refresh (no sound for updates in kitchen)
          loadData();
        }
      } catch {
        // Ignore malformed messages
      }
    };

    socket.onclose = () => {
      setSocketConnected(false);
      console.log("[Kitchen WS] Disconnected");
    };

    socket.onerror = (err) => {
      setSocketConnected(false);
      console.error("[Kitchen WS] Error:", err);
    };

    return () => {
      socket.close();
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invoiceData, productData, categoryData, floorData] = await Promise.all([
        fetchInvoices(),
        fetchProducts(),
        fetchCategories(),
        fetchTables()
      ]);

      setProducts(productData || []);
      setCategories(categoryData || []);
      setFloors(floorData || []);

      const productsMap = (productData || []).reduce((acc: any, p: any) => {
        if (p && p.id) {
          acc[String(p.id)] = p;
        }
        return acc;
      }, {});

      const mappedInvoices = (invoiceData || [])
        .filter((inv: any) => inv && inv.is_active && (inv.invoice_status === 'PENDING' || inv.invoice_status === 'READY' || inv.invoice_status === 'COMPLETED'))
        .map((inv: any) => {
          const tableMatch = (inv.description || inv.invoice_description || "").match(/Table (\d+)/);
          const tableNumber = inv.table_no || (tableMatch ? parseInt(tableMatch[1]) : 0);

          return {
            id: (inv.id || "").toString(),
            invoiceNumber: inv.invoice_number || "N/A",
            tableNumber,
            waiter: inv.created_by_name || "Unknown",
            floor: inv.floor,
            floorName: inv.floor_name,
            status: inv.invoice_status === 'PENDING' ? 'new' :
              inv.invoice_status === 'READY' ? 'ready' : 'completed',
            total: parseFloat(inv.total_amount || "0"),
            notes: inv.notes || (inv.description?.includes('| NOTE:') ? inv.description.split('| NOTE:')[1].trim() : ""),
            items: (inv.items || []).map((item: any) => {
              const product = productsMap[String(item.product)];
              return {
                quantity: item.quantity || 0,
                menuItem: {
                  name: product?.name || `Product #${item.product}`,
                  category: product?.category_name || 'Uncategorized',
                  categoryId: product?.category,
                  // Use the kitchen type ID directly from the product data
                  kitchenTypeId: product?.kitchentype_id || product?.kitchenType
                },
                notes: item.description || ""
              };
            }),
            createdAt: inv.created_at
          };
        });

      setOrders(mappedInvoices);
    } catch (err: any) {
      toast.error(err.message || "Failed to load kitchen data");
    } finally {
      setLoading(false);
    }
  };

  // Get current user and branch
  const user = getCurrentUser();
  const userName = user?.username || "Chef";
  const branchName = user?.branch_name || "Ama Bakery";

  // Determine User's Kitchen assignment
  const userKitchenId = user?.kitchentype_id;
  const userKitchenName = user?.kitchentype_name;

  // Filter Orders Logic
  const filteredOrders = (orders || [])
    .filter(order => {
      if (selectedFloorId === 'all') return true;
      return order.floor === selectedFloorId;
    })
    .map(order => {
      if (!order || !order.items) return null;

      // Filter items based on kitchen type
      const relevantItems = order.items.filter((item: any) => {
        if (!item || !item.menuItem) return false;

        // If user has no specific kitchen assigned (e.g. Admin), show all
        if (!userKitchenId) return true;

        // Get the kitchen type for this item
        // Primary source: kitchenTypeId we attached in loadData
        // Secondary/Fallback: Look up via categories if it's not on the item
        let itemKitchenId = item.menuItem.kitchenTypeId;

        if (itemKitchenId === undefined || itemKitchenId === null) {
          const itemCat = (categories || []).find(c => c && c.id === item.menuItem.categoryId);
          itemKitchenId = itemCat?.kitchentype;
        }

        // Match with the user's assigned kitchen
        // Use loose equality (==) in case one is a string and other is a number
        return String(itemKitchenId) === String(userKitchenId);
      });

      // Return order with ONLY relevant items, or null if no items match
      if (relevantItems.length > 0) {
        return { ...order, items: relevantItems };
      }
      return null;
    })
    .filter(Boolean);

  const handleStatusChange = async (orderId: string, newFrontendStatus: string) => {
    // Map frontend status to backend status
    const backendStatusMap: Record<string, string> = {
      'new': 'PENDING',
      'ready': 'READY',
      'completed': 'COMPLETED'
    };

    const backendStatus = backendStatusMap[newFrontendStatus];
    console.log(`Updating order ${orderId} to ${backendStatus}`);

    try {
      await updateInvoiceStatus(orderId, backendStatus);
      toast.success(`Order updated to ${newFrontendStatus}`);

      // Re-fetch data to be sure
      await loadData();
    } catch (err: any) {
      console.error("Status update error:", err);
      toast.error(err.message || "Failed to update order status");
    }
  };

  const selectedFloorName = selectedFloorId === 'all' ? 'All Floors' : floors.find(f => f.id === selectedFloorId)?.name || 'Unknown Floor';

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {/* Header */}
      <header className="flex-none bg-white border-b px-6 pr-14 py-4 shadow-sm z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-auto p-2 hover:bg-slate-50 flex items-center gap-4 rounded-2xl transition-all -ml-2 text-left">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0 shadow-sm">
                    <ChefHat className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h1 className="text-xl font-bold text-foreground">
                        {userKitchenName || 'General Kitchen'}
                      </h1>
                      <div className="bg-primary/5 text-primary text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border border-primary/10 flex items-center gap-1">
                        <MapPin className="h-2 w-2" />
                        {branchName}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                      <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        Live Feed • {userName}
                      </div>
                    </div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 rounded-2xl p-2 font-bold">
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

            <div className="h-10 w-px bg-slate-200" />

            {/* Floor Filter Dropdown */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filter:</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 px-4 rounded-xl border-slate-200 bg-slate-50/50 hover:bg-white transition-all gap-3 font-bold text-slate-700 min-w-[140px] justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5 text-primary opacity-60" />
                      {selectedFloorName}
                    </div>
                    <ChevronDown className="h-4 w-4 opacity-40" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[200px] rounded-xl p-2">
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-widest font-black text-slate-400 px-3 py-2">Select Floor</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="h-10 rounded-lg cursor-pointer font-bold" onClick={() => handleFloorChange('all')}>
                    All Floors
                  </DropdownMenuItem>
                  {floors.map((floor) => (
                    <DropdownMenuItem
                      key={floor.id}
                      className="h-10 rounded-lg cursor-pointer font-bold flex items-center justify-between"
                      onClick={() => handleFloorChange(floor.id)}
                    >
                      <div className="flex items-center gap-2">
                        <Layers className="h-3.5 w-3.5 opacity-40" />
                        {floor.name}
                      </div>
                      {orders.filter(o => o.floor === floor.id).length > 0 && (
                        <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full">
                          {orders.filter(o => o.floor === floor.id).length}
                        </span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
              {/* Completed Orders Sheet */}
              <Sheet>
                <SheetTrigger asChild>
                  <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-full cursor-pointer hover:bg-slate-200 transition-colors">
                    <span className="text-xs font-medium text-slate-500">Completed today:</span>
                    <span className="text-xs font-bold text-slate-700">{filteredOrders.filter(o => o.status === 'completed').length}</span>
                  </div>
                </SheetTrigger>
                <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                  <SheetHeader className="mb-6">
                    <SheetTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      Completed Orders History
                    </SheetTitle>
                  </SheetHeader>

                  <div className="space-y-4">
                    {filteredOrders.filter(o => o.status === 'completed').length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>No completed orders yet today</p>
                      </div>
                    ) : (
                      filteredOrders
                        .filter(o => o.status === 'completed')
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map(order => (
                          <div key={order.id} className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h3 className="font-bold text-slate-800">Order #{order.id.slice(-3)}</h3>
                                <p className="text-sm text-slate-500">Table {order.tableNumber}</p>
                                <div className="flex items-center gap-4">
                                  {order.floorName && <span className="text-[10px] font-black text-primary uppercase">{order.floorName}</span>}
                                  {order.createdAt && (
                                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                      <Clock className="h-2.5 w-2.5" />
                                      {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black uppercase tracking-widest text-slate-400 bg-white px-2 py-1 rounded border border-slate-100">
                                  COMPLETED
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-400 hover:text-amber-600"
                                  onClick={() => handleStatusChange(order.id, 'ready')}
                                  title="Undo Completion"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-1">
                              {order.items.map((item, idx) => (
                                <div key={idx} className="flex gap-2 text-sm">
                                  <span className="font-bold text-slate-600 w-4">{item.quantity}x</span>
                                  <span className="text-slate-700 flex-1">{item.menuItem.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header >

      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />

      {/* Kanban Board */}
      <main className="flex-1 p-4 overflow-hidden relative">
        <div className="grid grid-cols-2 gap-6 h-full">
          {/* New Orders Column */}
          <div className="flex flex-col h-full bg-slate-100/50 rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-blue-500" />
                <h2 className="font-bold text-slate-800">New Orders</h2>
              </div>
              <span className="bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-md text-xs">
                {filteredOrders.filter(o => o.status === 'new').length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 scrollbar-thin scrollbar-thumb-slate-200">
              {filteredOrders.filter(o => o.status === 'new').length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mb-2">
                    <Bell className="h-6 w-6 opacity-20" />
                  </div>
                  <p className="text-sm font-medium">No new orders</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 content-start">
                  {filteredOrders
                    .filter(o => o.status === 'new')
                    .map(order => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onStatusChange={handleStatusChange}
                      />
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Ready Column */}
          <div className="flex flex-col h-full bg-slate-100/50 rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-emerald-500" />
                <h2 className="font-bold text-slate-800">Ready to Serve</h2>
              </div>
              <span className="bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-md text-xs">
                {filteredOrders.filter(o => o.status === 'ready').length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 scrollbar-thin scrollbar-thumb-slate-200">
              {filteredOrders.filter(o => o.status === 'ready').length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <div className="w-12 h-1 border-2 border-slate-200 rounded-full opacity-50" />
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 content-start">
                  {filteredOrders
                    .filter(o => o.status === 'ready')
                    .map(order => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onStatusChange={handleStatusChange}
                      />
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div >
  );
}
