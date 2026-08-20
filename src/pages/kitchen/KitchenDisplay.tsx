import { useState, useEffect, useCallback, useRef } from "react";
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
import { fetchInvoices, fetchProducts, fetchCategories, updateInvoiceStatus, updateInvoiceItemStatus, fetchTables, fetchInvoiceDetail } from "../../api/index.js";
import { useOrdersWebSocket } from "@/hooks/useOrdersWebSocket";

// Play the notification bell sound when a new order arrives or an order is updated
const notificationAudioRef: { current: HTMLAudioElement | null } = { current: null };

function playNotificationSound() {
  try {
    // Lazily create the audio element so it works across re-renders
    if (!notificationAudioRef.current) {
      notificationAudioRef.current = new Audio("/noti.mp3");
      notificationAudioRef.current.preload = "auto";
    }

    // Reset to start so rapid notifications still ring
    const audio = notificationAudioRef.current;
    audio.currentTime = 0;
    audio.play().catch((err) => {
      console.warn("[Notification] Failed to play sound:", err);
    });
  } catch (err) {
    console.warn("[Notification] Error playing sound:", err);
  }
}

/** Derive kanban column from this kitchen's item statuses (matches backend item-wise logic). */
function deriveKitchenOrderStatus(items: { status?: string }[]): 'new' | 'ready' | 'completed' {
  if (!items?.length) return 'completed';

  const statuses = items.map((i) => (i.status || 'PENDING').toUpperCase());

  if (statuses.every((s) => s === 'COMPLETED' || s === 'CANCELLED')) return 'completed';
  if (statuses.some((s) => s === 'PENDING')) return 'new';
  if (statuses.some((s) => s === 'READY')) return 'ready';
  return 'new';
}

function mapInvoiceStatusToKitchenStatus(invoiceStatus?: string): 'new' | 'ready' | 'completed' {
  if (invoiceStatus === 'READY') return 'ready';
  if (invoiceStatus === 'COMPLETED') return 'completed';
  return 'new';
}

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

  // Refs to store latest function versions for WebSocket callback
  const loadDataRef = useRef<(() => void) | null>(null);
  const handleInvoiceUpdateRef = useRef<((id: string) => void) | null>(null);
  const isManualReloadRef = useRef(false);

  const handleFloorChange = (id: number | 'all') => {
    setSelectedFloorId(id);
    localStorage.setItem('kitchenFloorFilter', id.toString());
  };

  // WebSocket message handler
  const wsRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleWebSocketMessage = useCallback((data: any) => {
    if (wsRefreshTimerRef.current) clearTimeout(wsRefreshTimerRef.current);
    wsRefreshTimerRef.current = setTimeout(() => {
      console.log("[WS] Message received:", data.type, data.invoice_id);

      // Skip WebSocket merge if we're in the middle of a manual reload
      // This prevents the race condition where WebSocket overwrites our updates
      if (isManualReloadRef.current) {
        console.log("[WS] Skipping merge - manual reload in progress");
        return;
      }

      if (data.type === "invoice_created") {
        // Ring the bell for a new order
        playNotificationSound();
        toast.success("New Order Received!", {
          description: "A new order has been placed",
          icon: <Bell className="h-5 w-5 text-primary" />,
        });
        console.log("[WS] Calling loadData for invoice_created");
        loadDataRef.current?.();
      } else if (data.type === "invoice_updated") {
        // Ring the bell when an order is updated in the kitchen
        playNotificationSound();
        // If invoice_id is provided, update that specific invoice
        if (data.invoice_id) {
          console.log("[WS] Updating specific invoice:", data.invoice_id);
          console.log("[WS] handleInvoiceUpdateRef exists:", !!handleInvoiceUpdateRef.current);
          // Intelligently merge updates instead of full reload
          if (handleInvoiceUpdateRef.current) {
            console.log("[WS] Calling handleInvoiceUpdate");
            handleInvoiceUpdateRef.current(data.invoice_id);
          } else {
            console.log("[WS] handleInvoiceUpdateRef is null, falling back to loadData");
            loadDataRef.current?.();
          }
        } else {
          // No specific invoice_id means a general update (e.g., product stock changed)
          // Reload all data to reflect product name/availability changes
          console.log("[WS] General update detected (possibly product change), reloading data");
          loadDataRef.current?.();
        }
      }
    }, 500);
  }, []);

  // Get current user and branch
  const user = getCurrentUser();
  const userName = user?.username || "Chef";
  const branchName = user?.branch_name || "Ama Bakery";

  // Initialize WebSocket connection with branch_id
  const { isConnected: kitchenWsConnected, disconnect: disconnectWebSocket } = useOrdersWebSocket(
    handleWebSocketMessage,
    user?.branch_id
  );

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setSocketConnected(kitchenWsConnected);
  }, [kitchenWsConnected]);

  useEffect(() => {
    return () => {
      if (wsRefreshTimerRef.current) clearTimeout(wsRefreshTimerRef.current);
      // Cleanup WebSocket on unmount
      disconnectWebSocket();
    };
  }, [disconnectWebSocket]);

  const loadData = async () => {
    console.log("[loadData] Starting data load...");
    setLoading(true);
    try {
      const currentUser = getCurrentUser();
      const kitchenTypeId = currentUser?.kitchentype_id;

      const [invoiceRes, productsResponse, categoryData, floorData] = await Promise.all([
        fetchInvoices({ date: new Date().toLocaleDateString('en-CA') }),
        fetchProducts({ page_size: 1000 }),
        fetchCategories(),
        fetchTables()
      ]);

      console.log("[loadData] Fetched invoices:", invoiceRes);
      console.log("[loadData] Fetched products:", productsResponse?.length || 0);

      const productData = productsResponse?.results || (Array.isArray(productsResponse) ? productsResponse : []);

      setProducts(productData);
      setCategories(categoryData || []);
      setFloors(floorData || []);

      const basicInvoices = invoiceRes.results || invoiceRes;
      console.log("[loadData] Basic invoices:", basicInvoices?.length || 0);

      // Fetch full details for all invoices returned for today
      // Filtering will happen after we have full status info
      const detailedInvoices = await Promise.all(
        (basicInvoices || []).map(async (inv: any) => {
          try {
            return await fetchInvoiceDetail(inv.id);
          } catch (err) {
            console.error(`Failed to fetch detail for invoice ${inv.id}:`, err);
            return inv;
          }
        })
      );
      console.log("[loadData] Detailed invoices:", detailedInvoices?.length || 0);

      const productsMap = (productData || []).reduce((acc: any, p: any) => {
        if (p && p.id) {
          acc[String(p.id)] = p;
        }
        return acc;
      }, {});

      // Group items by status and create separate order cards for each status
      console.log("[loadData] Filtering invoices...");
      const filteredInvoices = detailedInvoices.filter((inv: any) => {
        const isActive = inv && inv.is_active;
        const hasValidStatus = inv && (inv.invoice_status === 'PENDING' || inv.invoice_status === 'READY' || inv.invoice_status === 'COMPLETED');
        console.log(`[loadData] Invoice ${inv?.id}: active=${isActive}, status=${inv?.invoice_status}, valid=${hasValidStatus}`);
        return isActive && hasValidStatus;
      });
      console.log("[loadData] Filtered invoices:", filteredInvoices?.length || 0);

      const mappedInvoices = filteredInvoices
        .flatMap((inv: any) => {
          console.log(`[loadData] Processing invoice ${inv.id}, items count: ${inv.items?.length || 0}`);

          const tableMatch = (inv.description || inv.invoice_description || "").match(/Table (\d+)/);
          const tableNumber = inv.table_no || (tableMatch ? parseInt(tableMatch[1]) : 0);

          const allItems = (inv.items || [])
            .filter(Boolean)
            .map((item: any) => {
              const product = productsMap[String(item.product)];
              console.log(`[loadData] Item ${item.id}: product=${item.product}, status=${item.status}, productName=${product?.name}`);
              return {
                id: item.id, // Store the actual database ID
                quantity: item.quantity || 0,
                status: item.status || 'PENDING',
                menuItem: {
                  name: product?.name || `Product #${item.product}`,
                  category: product?.category_name || 'Uncategorized',
                  categoryId: product?.category,
                  kitchenTypeId: product?.kitchentype_id || product?.kitchenType
                },
                notes: item.description || ""
              };
            });

          // Group items by status
          const itemsByStatus = allItems.reduce((acc: any, item: any) => {
            const status = (item.status || 'PENDING').toUpperCase();
            if (!acc[status]) {
              acc[status] = [];
            }
            acc[status].push(item);
            return acc;
          }, {});

          console.log(`[loadData] Invoice ${inv.id} status groups:`, Object.keys(itemsByStatus));

          // Create separate order cards for each status group
          return Object.entries(itemsByStatus).map(([status, items]: [string, any[]]) => {
            const kitchenStatus = status === 'PENDING' ? 'new' : status === 'READY' ? 'ready' : 'completed';

            return {
              id: `${inv.id}-${status}`, // Unique ID for each status group
              invoiceNumber: inv.invoice_number || "N/A",
              invoiceId: inv.id,
              tableNumber,
              waiter: inv.created_by_name || "Unknown",
              floor: inv.floor,
              floorName: inv.floor_name,
              status: kitchenStatus,
              total: parseFloat(inv.total_amount || "0"),
              notes: inv.notes || (inv.description?.includes('| NOTE:') ? inv.description.split('| NOTE:')[1].trim() : ""),
              items: items as any[],
              createdAt: inv.created_at,
              itemStatus: status // Store the actual item status
            };
          });
        });

      console.log("[loadData] Mapped invoices:", mappedInvoices?.length || 0);
      console.log("[loadData] Sample order:", mappedInvoices?.[0]);

      // Sort orders by creation time (FIFO - oldest first)
      mappedInvoices.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateA - dateB; // Ascending order (oldest first)
      });

      console.log("[loadData] Setting orders, count:", mappedInvoices.length);
      setOrders(mappedInvoices);
      console.log("[loadData] Orders set successfully");
    } catch (err: any) {
      console.error("[loadData] Error:", err);
      toast.error(err.message || "Failed to load kitchen data");
    } finally {
      setLoading(false);
      console.log("[loadData] Loading complete");
    }
  };

  // Update refs after loadData is defined
  loadDataRef.current = loadData;

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
        return {
          ...order,
          items: relevantItems,
          status: userKitchenId
            ? deriveKitchenOrderStatus(relevantItems)
            : order.status,
        };
      }
      return null;
    })
    .filter(Boolean);

  const handleInvoiceUpdate = async (invoiceId?: string) => {
    if (!invoiceId) {
      loadData();
      return;
    }

    // If a manual reload just happened, do a full reload instead of merge
    // This ensures we don't merge stale WebSocket data with fresh server data
    if (isManualReloadRef.current) {
      console.log("[handleInvoiceUpdate] Doing full reload instead of merge - manual reload just completed");
      loadData();
      return;
    }

    try {
      // Fetch only the updated invoice
      const updatedInvoice = await fetchInvoiceDetail(invoiceId);
      if (!updatedInvoice) {
        loadData();
        return;
      }

      const isActive = updatedInvoice.is_active;
      const hasValidStatus = updatedInvoice.invoice_status === 'PENDING' || updatedInvoice.invoice_status === 'READY' || updatedInvoice.invoice_status === 'COMPLETED';

      const currentUser = getCurrentUser();
      const kitchenTypeId = currentUser?.kitchentype_id;

      // Defensive checks: fetch fallback products/categories if empty to avoid websocket load race conditions
      let productData = products;
      if (productData.length === 0) {
        console.log("[handleInvoiceUpdate] Products list was empty! Fetching products...");
        try {
          const fetched = await fetchProducts({ page_size: 1000 });
          productData = fetched?.results || (Array.isArray(fetched) ? fetched : []);
          setProducts(productData);
        } catch (err) {
          console.error("[handleInvoiceUpdate] Failed to fetch fallback products list:", err);
        }
      }

      let categoriesData = categories;
      if (categoriesData.length === 0) {
        console.log("[handleInvoiceUpdate] Categories list was empty! Fetching categories...");
        try {
          const fetched = await fetchCategories();
          categoriesData = fetched || [];
          setCategories(categoriesData);
        } catch (err) {
          console.error("[handleInvoiceUpdate] Failed to fetch fallback categories:", err);
        }
      }

      const productsMap = productData.reduce((acc: any, p: any) => {
        if (p && p.id) acc[String(p.id)] = p;
        return acc;
      }, {});

      // Map the updated invoice
      const tableMatch = (updatedInvoice.description || updatedInvoice.invoice_description || "").match(/Table (\d+)/);
      const tableNumber = updatedInvoice.table_no || (tableMatch ? parseInt(tableMatch[1]) : 0);

      const items = (updatedInvoice.items || [])
        .filter(Boolean)
        .map((item: any) => {
          const product = productsMap[String(item.product)];
          return {
            id: item.id, // Preserve the database ID
            quantity: item.quantity || 0,
            status: item.status || 'PENDING',
            menuItem: {
              name: product?.name || `Product #${item.product}`,
              category: product?.category_name || 'Uncategorized',
              categoryId: product?.category,
              kitchenTypeId: product?.kitchentype_id || product?.kitchenType
            },
            notes: item.description || ""
          };
        });

      // Group items by status and create separate order cards for each status
      const itemsByStatus = items.reduce((acc: any, item: any) => {
        const status = (item.status || 'PENDING').toUpperCase();
        if (!acc[status]) {
          acc[status] = [];
        }
        acc[status].push(item);
        return acc;
      }, {});

      // Create new order cards for each status group only if active and status is eligible
      const newOrderCards = (isActive && hasValidStatus)
        ? Object.entries(itemsByStatus).map(([status, statusItems]: [string, any[]]) => {
          const kitchenStatus = status === 'PENDING' ? 'new' : status === 'READY' ? 'ready' : 'completed';

          return {
            id: `${updatedInvoice.id}-${status}`,
            invoiceNumber: updatedInvoice.invoice_number || "N/A",
            invoiceId: updatedInvoice.id,
            tableNumber,
            waiter: updatedInvoice.created_by_name || "Unknown",
            floor: updatedInvoice.floor,
            floorName: updatedInvoice.floor_name,
            status: kitchenStatus,
            total: parseFloat(updatedInvoice.total_amount || "0"),
            notes: updatedInvoice.notes || (updatedInvoice.description?.includes('| NOTE:') ? updatedInvoice.description.split('| NOTE:')[1].trim() : ""),
            items: statusItems,
            createdAt: updatedInvoice.created_at,
            itemStatus: status
          };
        })
        : [];

      setOrders((prevOrders) => {
        // Remove ALL existing cards for this invoice (all status groups)
        const filteredOrders = prevOrders.filter(order => !order.id.startsWith(`${invoiceId}-`));

        // Add the new order cards
        return [...filteredOrders, ...newOrderCards];
      });
    } catch (err: any) {
      console.error("Failed to handle invoice update:", err);
      // Fallback to full reload on error
      loadData();
    }
  };

  // Update refs after handleInvoiceUpdate is defined
  handleInvoiceUpdateRef.current = handleInvoiceUpdate;

  const handleItemStatusChange = async (orderId: string, itemId: string, newStatus: string) => {
    // Extract the actual invoice ID from the order ID (format: "invoiceId-status")
    const invoiceId = orderId.split('-').slice(0, -1).join('-');

    console.log(`Updating item ${itemId} in invoice ${invoiceId} to ${newStatus}`);

    try {
      // itemId is now the actual database ID (passed directly from OrderCard)
      const actualItemId = parseInt(itemId);

      if (!actualItemId) {
        toast.error("Invalid item ID");
        return;
      }

      // Update the specific item
      await updateInvoiceItemStatus(invoiceId, [
        { item_id: actualItemId, status: newStatus }
      ]);

      toast.success(`Item marked as ${newStatus.toLowerCase()}`);

      // Disable WebSocket merge temporarily to prevent stale data from overwriting our update
      // The WebSocket will fire with old data, but we'll ignore it and do a clean reload
      isManualReloadRef.current = true;

      // Wait a bit to ensure the API call completes and WebSocket event arrives
      await new Promise(resolve => setTimeout(resolve, 300));

      // Force a complete reload to get the true state from the server
      await loadData();

      // Keep flag true for a bit longer to ensure WebSocket doesn't merge stale data
      // WebSocket has 500ms delay, so we need to keep it disabled for at least that long
      setTimeout(() => {
        isManualReloadRef.current = false;
      }, 1500);
    } catch (err: any) {
      console.error("Item status update error:", err);
      toast.error(err.message || "Failed to update item status");
      isManualReloadRef.current = false;
    }
  };

  const handleStatusChange = async (orderId: string, newFrontendStatus: string) => {
    // Extract the actual invoice ID from the order ID (format: "invoiceId-status")
    const invoiceId = orderId.split('-').slice(0, -1).join('-');

    // Map frontend status to backend status
    const backendStatusMap: Record<string, string> = {
      'new': 'PENDING',
      'ready': 'READY',
      'completed': 'COMPLETED'
    };

    const backendStatus = backendStatusMap[newFrontendStatus];
    console.log(`Updating invoice ${invoiceId} items to ${backendStatus}`);

    try {
      // Find the order to get the items that need to be updated
      const order = orders.find(o => o.id === orderId);
      if (!order || !order.items || order.items.length === 0) {
        toast.error("Order not found or has no items");
        return;
      }

      // Only update the items currently displayed in this card
      // This prevents resetting items from other status groups
      const itemUpdates = order.items.map((item: any) => ({
        item_id: item.id,
        status: backendStatus
      }));

      // Use item-level update instead of bulk invoice update
      const updatedInvoice = await updateInvoiceItemStatus(invoiceId, itemUpdates);
      toast.success(`Order updated to ${newFrontendStatus}`);

      // Apply the PATCH response immediately so the card moves columns without waiting for a full reload
      if (updatedInvoice) {
        // Create products map for item name lookup
        const productsMap = (products || []).reduce((acc: any, p: any) => {
          if (p && p.id) {
            acc[String(p.id)] = p;
          }
          return acc;
        }, {});

        setOrders((prev) => {
          // Remove all cards for this invoice (all status groups)
          const filteredOrders = prev.filter(order => !order.id.startsWith(`${invoiceId}-`));

          // Process updated items
          const updatedItems = (updatedInvoice.items || [])
            .filter(Boolean)
            .map((item: any) => {
              const product = productsMap[String(item.product)];
              return {
                id: item.id, // Preserve database ID
                quantity: item.quantity || 0,
                status: item.status || backendStatus,
                menuItem: {
                  name: product?.name || `Product #${item.product}`,
                  category: product?.category_name || 'Uncategorized',
                  categoryId: product?.category,
                  kitchenTypeId: product?.kitchentype_id || product?.kitchenType
                },
                notes: item.description || ""
              };
            });

          // Group updated items by status
          const itemsByStatus = updatedItems.reduce((acc: any, item: any) => {
            const status = (item.status || 'PENDING').toUpperCase();
            if (!acc[status]) {
              acc[status] = [];
            }
            acc[status].push(item);
            return acc;
          }, {});

          // Create new order cards for each status group
          const newOrderCards = Object.entries(itemsByStatus).map(([status, items]: [string, any[]]) => {
            const kitchenStatus = status === 'PENDING' ? 'new' : status === 'READY' ? 'ready' : 'completed';

            return {
              id: `${updatedInvoice.id}-${status}`,
              invoiceNumber: updatedInvoice.invoice_number || "N/A",
              invoiceId: updatedInvoice.id,
              tableNumber: updatedInvoice.table_no,
              waiter: updatedInvoice.created_by_name || "Unknown",
              floor: updatedInvoice.floor,
              floorName: updatedInvoice.floor_name,
              status: kitchenStatus,
              total: parseFloat(updatedInvoice.total_amount || "0"),
              notes: updatedInvoice.notes || (updatedInvoice.description?.includes('| NOTE:') ? updatedInvoice.description.split('| NOTE:')[1].trim() : ""),
              items: items as any[],
              createdAt: updatedInvoice.created_at,
              itemStatus: status
            };
          });

          return [...filteredOrders, ...newOrderCards];
        });
      }

      // Disable WebSocket merge temporarily to prevent stale data from overwriting our update
      // The WebSocket will fire with old data, but we'll ignore it and do a clean reload
      isManualReloadRef.current = true;

      // Wait a bit to ensure the API call completes and WebSocket event arrives
      await new Promise(resolve => setTimeout(resolve, 300));

      // Force a complete reload to get the true state from the server
      await loadData();

      // Keep flag true for a bit longer to ensure WebSocket doesn't merge stale data
      // WebSocket has 500ms delay, so we need to keep it disabled for at least that long
      setTimeout(() => {
        isManualReloadRef.current = false;
      }, 1500);
    } catch (err: any) {
      console.error("Status update error:", err);
      toast.error(err.message || "Failed to update order status");
      isManualReloadRef.current = false;
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
                    // Close WebSocket before logout
                    disconnectWebSocket();
                    // Dispatch logout event
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
                        onItemStatusChange={handleItemStatusChange}
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
                        onItemStatusChange={handleItemStatusChange}
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
