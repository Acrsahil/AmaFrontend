import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { TableCard } from "@/components/waiter/TableCard";
import { WaiterBottomNav } from "@/components/waiter/WaiterBottomNav";
import { Table } from "@/lib/mockData";
import { fetchTables, fetchInvoices } from "@/api/index.js";
import { getCurrentUser } from "../../auth/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Users, Layers, ChevronDown, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useOrdersWebSocket } from "@/hooks/useOrdersWebSocket";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function TableSelection() {
  const navigate = useNavigate();
  const [allTables, setAllTables] = useState<Table[]>([]);
  const [floors, setFloors] = useState<any[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const user = getCurrentUser();

  // Comprehensive order fetching that matches counter logic exactly
  const loadOrders = useCallback(async () => {
    if (!user?.branch_id) return;
    
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const response = await fetchInvoices({
        date: today,
        page_size: '200'
      });
      
      let allInvoices = [];
      if (Array.isArray(response)) {
        allInvoices = response;
      } else if (response.results) {
        allInvoices = response.results;
      } else {
        allInvoices = [];
      }

      // IMPORTANT: Don't filter here like Counter does - Counter filters later in tableOrdersMap
      // We need ALL invoices first, then filter when building table occupancy
      
      // Only basic filtering for validity (same as Counter's loadInvoices)
      const validInvoices = allInvoices.filter((inv: any) => 
        inv.invoice_type === 'SALE' && !inv.is_deleted
      );

      setActiveOrders(validInvoices);
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      setActiveOrders([]);
    }
  }, [user?.branch_id]);

  // WebSocket for real-time updates
  useOrdersWebSocket(
    useCallback((data) => {
      // Reload on any invoice change
      if (data.type === "invoice_created" || 
          data.type === "invoice_updated" || 
          data.type === "invoice_deleted") {
        loadOrders();
      }
    }, [loadOrders]),
    user?.branch_id
  );

  // Auto-refresh every 30 seconds as backup
  useEffect(() => {
    const interval = setInterval(() => {
      loadOrders();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [loadOrders]);

  // Initial data load
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        // Load floors and orders in parallel
        const [floorData] = await Promise.all([
          fetchTables(),
          loadOrders()
        ]);
        
        setFloors(floorData || []);

        // Restore selected floor
        const storedFloorId = localStorage.getItem('selectedFloorId');
        if (storedFloorId && floorData) {
          const found = floorData.find((f: any) => f.id.toString() === storedFloorId);
          if (found) {
            setSelectedFloor(found);
          } else if (floorData.length > 0) {
            setSelectedFloor(floorData[0]);
          }
        } else if (floorData && floorData.length > 0) {
          setSelectedFloor(floorData[0]);
        }
      } catch (error) {
        console.error("Failed to load initial data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    if (user?.branch_id) {
      loadInitialData();
    }
  }, [user?.branch_id, loadOrders]);

  const handleFloorChange = (floor: any) => {
    setSelectedFloor(floor);
    localStorage.setItem('selectedFloorId', floor.id.toString());
  };

  // Generate tables with real occupancy status
  useEffect(() => {
    if (!selectedFloor) {
      setAllTables([]);
      return;
    }

    const count = selectedFloor.table_count || 0;
    const generatedTables: Table[] = Array.from({ length: count }, (_, i) => {
      const tableNum = i + 1;
      
      // Find orders for this specific table on this floor
      // Apply EXACT same filtering logic as Counter's tableOrdersMap
      const tableOrders = activeOrders.filter((order: any) => {
        // Floor matching - try both ID and name
        const orderFloorId = order.floor ?? order.floor_id;
        const floorMatch = (orderFloorId && String(orderFloorId) === String(selectedFloor.id)) ||
                          (order.floor_name && order.floor_name === selectedFloor.name);
        
        if (!floorMatch) return false;
        
        // Table number matching
        const orderTableNo = order.table_no ? parseInt(String(order.table_no)) : null;
        if (orderTableNo !== tableNum) return false;
        
        // CRITICAL: Apply Counter's tableOrdersMap payment filtering HERE
        // Only include active orders: not fully paid by counter
        const isFullyPaid = order.payment_status === 'PAID' && order.received_by_counter;
        if (isFullyPaid) return false;
        
        // Exclude PAID orders where due_amount is 0 (settled)
        const isPaidNoDue = order.payment_status === 'PAID' && parseFloat(order.due_amount || 0) <= 0;
        if (isPaidNoDue) return false;
        
        // This matches Counter's logic exactly - no invoice_status filtering
        return true;
      });
      
      return {
        id: `table-${selectedFloor.id}-${tableNum}`,
        number: tableNum,
        status: tableOrders.length > 0 ? 'occupied' : 'available',
        capacity: 4
      };
    });
    
    setAllTables(generatedTables);
  }, [selectedFloor, activeOrders]);

  const handleTableClick = (table: Table) => {
    if (selectedFloor) {
      navigate(`/waiter/order/${table.number}?floorId=${selectedFloor.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <MobileHeader title="" />

      <main className="p-4 max-w-2xl mx-auto pt-4 space-y-6">
        {/* Floor Selection */}
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between h-14 rounded-2xl border-slate-200 bg-white shadow-sm hover:bg-slate-50 transition-all font-bold">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Layers className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black mb-0.5">Current Floor</p>
                    <p className="text-slate-700">{selectedFloor?.name || "Loading..."}</p>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[calc(100vw-2rem)] max-w-2xl rounded-2xl p-2">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest font-black text-slate-400 px-3 py-2">Switch Floor</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {floors.map((floor) => (
                <DropdownMenuItem
                  key={floor.id}
                  className="h-12 rounded-xl focus:bg-primary/10 focus:text-primary transition-colors cursor-pointer"
                  onClick={() => handleFloorChange(floor)}
                >
                  <Layers className="h-4 w-4 mr-3 opacity-50" />
                  <span className="font-bold">{floor.name}</span>
                  <span className="ml-auto text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-black uppercase">
                    {floor.table_count} Tables
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 text-primary animate-spin mb-3" />
            <p className="text-gray-400 text-sm">Loading tables...</p>
          </div>
        ) : (
          /* Table List (Row-wise) */
          <div className="space-y-1">
            {allTables.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Layers className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No tables found on this floor</p>
              </div>
            ) : (
              allTables.map((table) => (
                <TableCard
                  key={table.id}
                  table={table}
                  onClick={handleTableClick}
                />
              ))
            )}
          </div>
        )}
      </main>



      {/* Bottom Navigation */}
      <WaiterBottomNav />
    </div>
  );
}
