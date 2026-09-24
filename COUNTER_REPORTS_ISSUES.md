# Counter Reports - Issues Identified & Fixed

**Date:** September 24, 2026  
**Status:** Partially Fixed (Backend issues remain)

---

## Issues Found

### 1. ✅ FIXED: Total Orders Showing 0
**Problem:** Counter Reports was showing 0 for total orders  
**Cause:** Code was looking for `total_orders` but API returns `total_month_orders`  
**Fix:** Updated to use `total_month_orders` field from API response  
**Result:** Now correctly shows 59 orders

### 2. ✅ FIXED: Average Order Value Showing 0
**Problem:** Average order value was displaying 0  
**Cause:** Code was looking for `average_order_value` but API returns `avg_order`  
**Fix:** Updated to use `avg_order` field from API response  
**Result:** Now correctly shows Rs.362

### 3. ✅ FIXED: Staff Performance Showing 0
**Problem:** Staff orders and sales were all showing 0  
**Cause:** Code was looking for `order_count` and `total_sales` but API returns `orders` and `sales`  
**Fix:** Updated field mapping to use correct API field names  
**Result:** Now correctly displays staff data

### 4. ⚠️ BACKEND ISSUE: Payment Method Order Counts
**Problem:** Payment method table shows "-" for order counts  
**Cause:** Backend API does NOT return `order_count` in `sales_by_payment_method` array  
**API Response:**
```json
{
  "sales_by_payment_method": [
    {"payment_method": "QR", "total_amount": 10364},
    {"payment_method": "CASH", "total_amount": 6214}
  ]
}
```
**Frontend Fix:** Display "-" to indicate data not available (better than showing misleading "0")  
**Backend Fix Needed:** Add `order_count` field to each payment method object

### 5. ⚠️ BACKEND ISSUE: Staff Report Ignoring Timeframe Filter
**Problem:** Staff report shows all-time data instead of filtered timeframe  
**Evidence:**
- Report API returns: 59 orders (daily, 2026-09-24)
- Staff API returns: 92 total orders (no date filter applied)
- Staff API response has `timeframe: undefined`, `start_date: undefined`, `end_date: undefined`

**Cause:** Backend `/api/calculate/staff-report/` endpoint ignores the `timeframe`, `start_date`, and `end_date` query parameters  

**Frontend Fix:** Added "⚠️ All-Time Data" warning badge on Staff Performance section  

**Backend Fix Needed:** Update `/api/calculate/staff-report/` to respect timeframe filters

---

## API Endpoints Used

### 1. Report Dashboard (Main Data)
**Endpoint:** `/api/calculate/report-dashboard/`  
**Returns:**
- `total_month_orders`: Total orders for period
- `total_month_sales`: Total sales for period
- `avg_order`: Average order value
- `sales_by_payment_method`: Array of payment methods with totals
- `sales_by_status`: Array of payment statuses
- `top_selling_items_count`: Top selling products
- `Hourly_sales`: Sales by hour
- `trend_chart`: Sales trend data
- ✅ **Respects timeframe filter**

### 2. Staff Report
**Endpoint:** `/api/calculate/staff-report/`  
**Returns:**
- `staff_performance`: Array of staff members with:
  - `id`, `name`, `username`, `role`
  - `orders`: Order count
  - `sales`: Sales amount
  - `cash_in_hand`: Cash collected
- ❌ **IGNORES timeframe filter**

---

## Backend API Fixes Required

### Priority 1: Staff Report Timeframe Filter
The `/api/calculate/staff-report/` endpoint must be updated to:
1. Accept `timeframe`, `start_date`, `end_date` query parameters
2. Filter staff performance data by the specified date range
3. Return matching metadata (`timeframe`, `start_date`, `end_date`) in response

**Current Behavior:**
```
GET /api/calculate/staff-report/1/?timeframe=daily
→ Returns all-time data (ignores timeframe)
```

**Expected Behavior:**
```
GET /api/calculate/staff-report/1/?timeframe=daily
→ Returns today's data only
→ Response includes: {timeframe: "daily", start_date: "2026-09-24", end_date: "2026-09-24", ...}
```

### Priority 2: Payment Method Order Counts
Update `/api/calculate/report-dashboard/` response to include `order_count` for each payment method:

**Current:**
```json
{
  "sales_by_payment_method": [
    {"payment_method": "CASH", "total_amount": 6214}
  ]
}
```

**Needed:**
```json
{
  "sales_by_payment_method": [
    {"payment_method": "CASH", "total_amount": 6214, "order_count": 25}
  ]
}
```

---

## Frontend Changes Made

### Files Modified:
- `/src/pages/counter/CounterReports.tsx`

### Changes:
1. ✅ Fixed total orders display (use `total_month_orders`)
2. ✅ Fixed average order value (use `avg_order`)
3. ✅ Fixed staff table field mapping (`orders`, `sales`, `name`)
4. ✅ Show "-" for unavailable payment method order counts
5. ✅ Added "All-Time Data" warning badge on Staff Performance
6. ✅ Cleaned up debug console logs

---

## Testing Checklist

- [x] Total orders displays correctly (59)
- [x] Average order value displays correctly (Rs.362)
- [x] Total sales displays correctly (Rs.21,142)
- [x] Staff performance shows data (orders, sales)
- [x] Payment method amounts show correctly
- [ ] Payment method order counts (backend fix needed)
- [ ] Staff report respects timeframe filter (backend fix needed)

---

## Next Steps

1. **Contact Backend Team** to implement the two API fixes above
2. **Test** after backend changes are deployed
3. **Remove** the "All-Time Data" warning badge once staff API is fixed
4. **Update** payment method table to show order counts once backend provides them
