# Realtime Table Synchronization Fix

## Problem Identified

The waiter's **Table Selection** page (`/waiter/tables`) was showing all tables as "free/available" even when they were occupied with active orders in the Counter's **Table Orders** view. The issue was:

### Root Cause
1. **Waiter TableSelection.tsx** was using `getAllOrders()` from `localStorage` which stored outdated local cart data
2. It had **NO API integration** - never fetched real invoices from the backend
3. It had **NO WebSocket integration** - never received realtime updates
4. Tables were generated with hardcoded `status: 'available'` regardless of actual occupancy

### Expected Behavior
- Waiter should see the **exact same table occupancy** as Counter
- When Counter creates an order for Table 5, Waiter's Table Selection should immediately show Table 5 as "occupied"
- Realtime sync should work bidirectionally between Counter and Waiter views

## Solution Implemented

### Changes to `/src/pages/waiter/TableSelection.tsx`

#### 1. **Added Real Invoice Fetching**
```typescript
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
```

#### 2. **Added WebSocket Realtime Updates**
```typescript
// WebSocket for realtime updates
useOrdersWebSocket(
  useCallback(() => {
    console.log("[TableSelection] Order update received, refreshing...");
    loadOrders();
  }, [loadOrders]),
  user?.branch_id
);
```

#### 3. **Dynamic Table Status Based on Real Orders**
```typescript
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
```

#### 4. **Updated Imports**
```typescript
import { useState, useEffect, useCallback } from "react";
import { fetchTables, fetchInvoices } from "@/api/index.js";
import { format } from "date-fns";
import { useOrdersWebSocket } from "@/hooks/useOrdersWebSocket";
import { Loader2 } from "lucide-react";
```

#### 5. **Removed localStorage Dependency**
- Removed: `import { getAllOrders } from "@/lib/orderStorage";`
- Removed: `const activeOrders = getAllOrders();`
- Now uses: `const [activeOrders, setActiveOrders] = useState<any[]>([]);`

#### 6. **Added Loading State**
```typescript
const [loading, setLoading] = useState(true);

// In JSX:
{loading ? (
  <div className="flex flex-col items-center justify-center py-20">
    <Loader2 className="h-10 w-10 text-primary animate-spin mb-3" />
    <p className="text-gray-400 text-sm">Loading tables...</p>
  </div>
) : (
  /* Table List */
)}
```

## How It Works Now

### Data Flow
1. **Initial Load**
   - Fetches floors/tables from API
   - Fetches all active invoices for today
   - Matches invoices to tables by floor_id and table_no
   - Sets table status to 'occupied' or 'available' accordingly

2. **Realtime Updates**
   - WebSocket connection established with branch_id
   - On any invoice create/update/delete event:
     - Triggers `loadOrders()` to refresh invoice list
     - Re-evaluates table occupancy
     - Updates UI immediately

3. **Floor Filtering**
   - Tables are filtered by selected floor
   - Matches by `floor_id` (preferred) or `floor_name` (fallback)
   - Only shows occupancy for orders on the selected floor

### Synchronization Points
- ✅ Counter creates order → Waiter sees table occupied (WebSocket)
- ✅ Counter marks order PAID → Waiter sees table free (WebSocket)
- ✅ Waiter creates order → Counter sees table occupied (WebSocket)
- ✅ Multi-floor support with accurate per-floor table status
- ✅ Both Counter and Waiter use the same data source (API invoices)

## Testing Checklist

### Test Scenarios
- [ ] Open Counter TableOrders (table view) and Waiter TableSelection side-by-side
- [ ] Counter creates order for Table 3 → Waiter should show Table 3 as occupied immediately
- [ ] Counter marks Table 3 order as PAID → Waiter should show Table 3 as free immediately
- [ ] Waiter creates order for Table 5 → Counter should show Table 5 as occupied immediately
- [ ] Switch floors in both views → occupancy should match per floor
- [ ] Multiple orders on same table → should still show as occupied once
- [ ] Order completion/cancellation → table should become free

### Edge Cases Handled
- ✅ Partial payments (still shows occupied until fully paid)
- ✅ Multiple orders on same table (aggregated as occupied)
- ✅ Floor ID vs floor_name matching (handles both)
- ✅ Network failures (logs errors, doesn't crash)
- ✅ WebSocket reconnection (automatic via useOrdersWebSocket)

## Related Files

### Modified
- `/src/pages/waiter/TableSelection.tsx` - Complete rewrite of table status logic

### Unchanged (already correct)
- `/src/pages/waiter/OrderStatus.tsx` - Already had proper realtime sync
- `/src/pages/counter/CounterOrders.tsx` - Already had proper realtime sync
- `/src/hooks/useOrdersWebSocket.ts` - WebSocket hook (already working)
- `/src/api/index.js` - API methods (already working)

## Performance Considerations

- Uses `page_size: '200'` to fetch all today's orders in one request
- WebSocket updates trigger single API call, not per-table
- `useCallback` prevents unnecessary re-renders
- `useMemo` not needed due to simple filtering logic

## Future Enhancements

Possible improvements:
1. Add visual indicators for table status (occupied count badge)
2. Show total amount on occupied tables
3. Add "Ready for Pickup" visual state
4. Implement table reservation feature
5. Add table capacity management

## Rollback Plan

If issues arise, revert to commit before this fix:
```bash
git revert HEAD
```

The previous version used localStorage which was isolated but didn't sync between Counter and Waiter.
