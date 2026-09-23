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
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const user = getCurrentUser();

  // Fetch all active orders for today
  const loadOrders = useCallback(async () => {
    try {
      const params = { date: format(new Date(), 'yyyy-MM-dd'), page_size: '200' };
      const response = await fetchInvoices(params);
      const data = Array.isArray(response) ? response : (response.results || []);
      
      // Filter for active (unpaid/partial) orders only
      const activeInvoices = data.filter((inv: any) => {
        const isFullyPaid = inv.payment_status === 'PAID' && parseFloat(inv.due_amount || 0) <= 0;
        return !isFullyPaid && !inv.is_deleted;
      });
      
      setActiveOrders(activeInvoices);
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      setActiveOrders([]);
    }
  }, []);

  // WebSocket for realtime updates
  useOrdersWebSocket(
    useCallback(() => {
      console.log("[TableSelection] Order update received, refreshing...");
      loadOrders();
    }, [loadOrders]),
    user?.branch_id
  );

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const branchFloors = await fetchTables();
        setFloors(branchFloors || []);

        // Load from localStorage
        const storedFloorId = localStorage.getItem('selectedFloorId');
        if (storedFloorId && branchFloors) {
          const found = branchFloors.find((f: any) => f.id.toString() === storedFloorId);
          if (found) {
            setSelectedFloor(found);
          } else if (branchFloors.length > 0) {
            setSelectedFloor(branchFloors[0]);
          }
        } else if (branchFloors && branchFloors.length > 0) {
          setSelectedFloor(branchFloors[0]);
        }

        // Load orders
        await loadOrders();
      } catch (error) {
        console.error("Failed to fetch floors:", error);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, [user?.branch_id, loadOrders]);

  const handleFloorChange = (floor: any) => {
    setSelectedFloor(floor);
    localStorage.setItem('selectedFloorId', floor.id.toString());
  };

  // Generate tables with actual occupancy status from real orders
  useEffect(() => {
    if (selectedFloor) {
      const count = selectedFloor.table_count || 0;
      const generatedTables: Table[] = Array.from({ length: count }, (_, i) => {
        const tableNum = i + 1;
        
        // Check if this table has any active orders on this floor
        const tableOrders = activeOrders.filter((order: any) => {
          // Match by floor
          const floorId = order.floor ?? order.floor_id;
          const matchById = floorId != null && String(floorId) === String(selectedFloor.id);
          const matchByName = !matchById && order.floor_name && order.floor_name === selectedFloor.name;
          if (!matchById && !matchByName) return false;
          
          // Match by table number
          const orderTableNo = order.table_no ? Number(order.table_no) : null;
          if (!orderTableNo) return false;
          
          return orderTableNo === tableNum;
        });
        
        return {
          id: `table-${selectedFloor.id}-${tableNum}`,
          number: tableNum,
          status: tableOrders.length > 0 ? 'occupied' : 'available',
          capacity: 4
        };
      });
      setAllTables(generatedTables);
    }
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
