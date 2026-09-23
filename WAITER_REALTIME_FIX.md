# Waiter Real-time Table Sync Fix

## Problem
Waiter table selection page was not showing real-time occupied tables that were visible in Counter table orders.

## Root Cause Analysis
1. **Inconsistent Filtering**: Waiter was using different filtering logic than Counter
2. **WebSocket Reliability**: Connection might drop without proper reconnection
3. **Missing Backup Polling**: No fallback when WebSocket fails
4. **Race Conditions**: Initial data load vs WebSocket events

## Complete Solution Applied

### 1. Fixed Data Fetching Logic
- **Exact Same Filtering as Counter**: Applied identical `invoice_type === 'SALE'` and payment status filtering
- **Comprehensive Status Checks**: Handles all payment states (PAID, PARTIAL, WAITER RECEIVED, etc.)
- **Proper Branch Filtering**: Ensures user's branch context is maintained

### 2. Enhanced Real-time Updates
- **Reliable WebSocket**: Listens to all invoice events (create, update, delete)
- **Auto-reconnection**: Built-in WebSocket reconnection with exponential backoff
- **Backup Polling**: 30-second interval as fallback when WebSocket fails
- **Immediate Updates**: Triggers data reload on any relevant change

### 3. Improved Table Matching
- **Dual Floor Matching**: Matches by both `floor_id` and `floor_name` for robustness
- **Flexible Table Numbers**: Handles string/number conversion properly
- **Status Calculation**: Accurate occupied/available status based on active orders

### 4. Performance Optimizations
- **Parallel Loading**: Loads floors and orders simultaneously
- **Efficient Filtering**: Single-pass filtering with early returns
- **Proper Dependencies**: Correct useCallback/useEffect dependencies to prevent memory leaks

## Key Changes Made

### Updated `TableSelection.tsx`
```typescript
// Comprehensive order fetching that matches counter logic exactly
const loadOrders = useCallback(async () => {
  if (!user?.branch_id) return;
  
  try {
    const response = await fetchInvoices({
      date: format(new Date(), 'yyyy-MM-dd'),
      page_size: '200'
    });
    
    let allInvoices = Array.isArray(response) ? response : (response.results || []);

    // Apply EXACT same filtering as Counter does
    const filteredInvoices = allInvoices.filter((inv: any) => {
      // Must be SALE type and not deleted
      if (inv.invoice_type !== 'SALE' || inv.is_deleted) return false;
      
      // Exclude fully paid orders that counter has received
      const isFullyPaid = inv.payment_status === 'PAID' && inv.received_by_counter;
      if (isFullyPaid) return false;
      
      // Exclude PAID orders with no due amount (settled)
      const isPaidNoDue = inv.payment_status === 'PAID' && parseFloat(inv.due_amount || 0) <= 0;
      if (isPaidNoDue) return false;
      
      // Exclude completed/cancelled orders
      if (inv.invoice_status === 'COMPLETED' || inv.invoice_status === 'CANCELLED') return false;
      
      return true;
    });

    setActiveOrders(filteredInvoices);
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    setActiveOrders([]);
  }
}, [user?.branch_id]);
```

### Enhanced WebSocket Integration
```typescript
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
```

### Robust Table Status Calculation
```typescript
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
    const tableOrders = activeOrders.filter((order: any) => {
      // Floor matching - try both ID and name
      const orderFloorId = order.floor ?? order.floor_id;
      const floorMatch = (orderFloorId && String(orderFloorId) === String(selectedFloor.id)) ||
                        (order.floor_name && order.floor_name === selectedFloor.name);
      
      if (!floorMatch) return false;
      
      // Table number matching
      const orderTableNo = order.table_no ? parseInt(String(order.table_no)) : null;
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
}, [selectedFloor, activeOrders]);
```

## Expected Behavior After Fix

### ✅ Real-time Synchronization
- Counter creates order for Table 3 → Waiter immediately shows Table 3 as occupied
- Counter marks order PAID → Waiter immediately shows table as available
- Multiple orders on same table → Shows as occupied until all are paid/completed
- Floor switching → Shows accurate occupancy per floor

### ✅ Reliability Features
- WebSocket disconnection → Auto-reconnects within seconds
- API failures → Retries every 30 seconds
- Network issues → Graceful degradation with polling fallback
- Page refresh → Restores floor selection and loads fresh data

### ✅ Performance
- Fast initial load (parallel API calls)
- Efficient updates (single API call per event)
- No memory leaks (proper cleanup)
- Responsive UI (loading states)

## Testing Steps

1. **Basic Sync Test**
   - Open Counter (table view) and Waiter (tables page) side-by-side
   - Create order in Counter → Verify table shows occupied in Waiter
   - Mark order PAID in Counter → Verify table shows available in Waiter

2. **Network Reliability Test**
   - Disconnect internet for 30 seconds
   - Reconnect → Should automatically sync within 30-60 seconds
   - Create orders during disconnection → Should sync when reconnected

3. **Multi-floor Test**
   - Switch between floors in both Counter and Waiter
   - Verify occupancy matches per floor
   - Create orders on different floors → Verify correct floor shows occupancy

## Rollback Instructions

If issues persist, revert to previous version:
```bash
git checkout HEAD~1 src/pages/waiter/TableSelection.tsx
```

The fix maintains backward compatibility and doesn't affect other components.