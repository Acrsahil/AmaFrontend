import { useState, useEffect } from "react";
import { fetchDashboardDetails, fetchStaffReport, fetchReportDashboard } from "@/api/index.js";
import { getCurrentUser } from "../../auth/auth";
import { toast } from "sonner";
import {
  BarChart3,
  Loader2,
  Filter,
  CalendarDays,
  ChevronDown,
  Calendar as CalendarIcon,
  Calculator
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from "recharts";

const PAYMENT_COLORS = ['hsl(142, 71%, 45%)', 'hsl(217, 91%, 60%)', 'hsl(32, 95%, 44%)', 'hsl(280, 65%, 60%)', 'hsl(0, 84%, 60%)'];

export default function CounterReports() {
  const user = getCurrentUser();
  const [reportData, setReportData] = useState<any>(null);
  const [staffData, setStaffData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffLoading, setStaffLoading] = useState(true);
  const [missingBranch, setMissingBranch] = useState(false);

  // Filter states
  const [timeframe, setTimeframe] = useState("daily");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined, to: Date | undefined }>({
    from: undefined,
    to: undefined
  });

  // Cash Calculator states
  const [showCashCalculator, setShowCashCalculator] = useState(false);
  const [denominations, setDenominations] = useState({
    1000: 0,
    500: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    2: 0,
    1: 0
  });

  useEffect(() => {
    loadReportData();
    loadStaffData();
  }, [user?.branch_id, timeframe, dateRange]);

  const getFilters = () => {
    const params: any = { timeframe };
    if (timeframe === "custom" && dateRange.from && dateRange.to) {
      params.start_date = format(dateRange.from, "yyyy-MM-dd");
      params.end_date = format(dateRange.to, "yyyy-MM-dd");
    }
    return params;
  };

  // Cash calculator functions
  const updateDenomination = (value: number, count: string) => {
    setDenominations(prev => ({
      ...prev,
      [value]: parseInt(count) || 0
    }));
  };

  const calculateTotalCash = () => {
    return Object.entries(denominations).reduce((total, [value, count]) => {
      return total + (parseInt(value) * count);
    }, 0);
  };

  const clearCalculator = () => {
    setDenominations({
      1000: 0,
      500: 0,
      100: 0,
      50: 0,
      20: 0,
      10: 0,
      5: 0,
      2: 0,
      1: 0
    });
  };

  // Get system cash amount from reports
  const getSystemCashAmount = () => {
    // Try sales_by_payment_method first (this is what the API actually returns)
    const salesByPayment = reportData?.sales_by_payment_method || [];
    
    const cashPayment = salesByPayment.find((pm: any) => 
      pm.payment_method?.toUpperCase() === 'CASH' || 
      pm.method?.toUpperCase() === 'CASH' ||
      pm.type?.toUpperCase() === 'CASH'
    );
    
    // Try different possible field names for amount
    const amount = parseFloat(
      cashPayment?.total_amount || 
      cashPayment?.amount || 
      cashPayment?.total || 
      cashPayment?.value ||
      0
    );
    return amount;
  };

  // Calculate total orders and avg order value if not provided by API
  const getTotalOrders = () => {
    // Check various possible field names for total orders
    if (reportData?.total_orders) return reportData.total_orders;
    if (reportData?.total_month_orders) return reportData.total_month_orders; // API returns this
    if (reportData?.orders_count) return reportData.orders_count;
    
    // Calculate from sales_by_payment_method if order counts are available
    const salesByPayment = reportData?.sales_by_payment_method || [];
    const totalFromPayments = salesByPayment.reduce((sum: number, pm: any) => {
      const orderCount = pm.order_count || pm.orders_count || pm.count || 0;
      return sum + orderCount;
    }, 0);
    
    return totalFromPayments;
  };

  const getAverageOrderValue = () => {
    // Check various possible field names for average order value
    if (reportData?.average_order_value) return parseFloat(reportData.average_order_value);
    if (reportData?.avg_order) return parseFloat(reportData.avg_order); // API returns this
    if (reportData?.avg_order_value) return parseFloat(reportData.avg_order_value);
    
    // Calculate manually if needed
    const totalSales = reportData?.total_sales || 
                      reportData?.total_month_sales ||
                      reportData?.sales_by_payment_method?.reduce((sum: number, pm: any) => 
                        sum + (parseFloat(pm.total_amount || pm.amount || pm.total || 0)), 0) || 0;
    const totalOrders = getTotalOrders();
    
    const avgValue = totalOrders > 0 ? totalSales / totalOrders : 0;
    return avgValue;
  };

  const loadReportData = async () => {
    setLoading(true);
    setMissingBranch(false);
    try {
      const branchId = user?.branch_id || null;
      if (!branchId) {
        setMissingBranch(true);
        setLoading(false);
        return;
      }
      
      const data = await fetchReportDashboard(branchId, getFilters());
      setReportData(data);
    } catch (error) {
      console.error("Failed to fetch report dashboard:", error);
      toast.error("Failed to load report data");
    } finally {
      setLoading(false);
    }
  };

  const loadStaffData = async () => {
    setStaffLoading(true);
    try {
      const branchId = user?.branch_id || null;
      if (!branchId) {
        setStaffLoading(false);
        return;
      }
      
      const data = await fetchStaffReport(branchId, getFilters());
      setStaffData(data?.staff_performance || []);
    } catch (error) {
      console.error("Failed to fetch staff report:", error);
      toast.error("Failed to load staff data");
    } finally {
      setStaffLoading(false);
    }
  };

  const trendChartData = reportData?.trend_chart || [];
  const topItems: any[] = reportData?.top_selling_items_count || [];
  const hourlyChartData = reportData?.Hourly_sales || [];

  return (
    <div className="p-6 space-y-6">
      {missingBranch && (
        <div className="card-elevated p-6 border border-amber-200 bg-amber-50 rounded-xl">
          <p className="text-amber-800 font-semibold">Your account is not assigned to a branch. Contact admin to view reports.</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground">Analytics and performance insights</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowCashCalculator(true)}
            className="h-11 rounded-xl font-bold px-4 gap-2 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg"
          >
            <Calculator className="h-4 w-4" />
            Cash Calculator
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-11 rounded-xl border-2 font-bold px-4 hover:bg-slate-50 transition-all border-slate-100 shadow-sm gap-2 hover:text-primary">
                <Filter className="h-4 w-4 text-primary" />
                <span className="capitalize">{timeframe} View</span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 p-2 rounded-2xl border-none shadow-2xl bg-white/95 backdrop-blur-xl">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 py-1.5 font-black">Select Period</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setTimeframe("daily")} className="rounded-lg font-bold text-sm cursor-pointer hover:bg-slate-50">Daily Breakdown</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTimeframe("weekly")} className="rounded-lg font-bold text-sm cursor-pointer hover:bg-slate-50">Weekly Analysis</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTimeframe("monthly")} className="rounded-lg font-bold text-sm cursor-pointer hover:bg-slate-50">Monthly Overview</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTimeframe("yearly")} className="rounded-lg font-bold text-sm cursor-pointer hover:bg-slate-50">Yearly Report</DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-100 my-1" />
              <DropdownMenuItem onClick={() => setTimeframe("custom")} className="rounded-lg font-bold text-sm cursor-pointer hover:bg-slate-50 text-primary">Custom Range</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {timeframe === "custom" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("h-11 rounded-xl border-2 font-bold px-4 border-slate-100 shadow-sm gap-2", !dateRange.from && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    "Select Dates"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-3xl overflow-hidden" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range: any) => setDateRange({ from: range?.from, to: range?.to })}
                  numberOfMonths={2}
                  className="p-4"
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 rounded-2xl border-none shadow-lg">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Sales</p>
          <p className="text-2xl font-black text-slate-900 mt-2">Rs.{Number(reportData?.total_month_sales || 0).toLocaleString()}</p>
        </Card>
        <Card className="p-6 rounded-2xl border-none shadow-lg">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Orders</p>
          <p className="text-2xl font-black text-slate-900 mt-2">{getTotalOrders()}</p>
        </Card>
        <Card className="p-6 rounded-2xl border-none shadow-lg">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Avg. Order Value</p>
          <p className="text-2xl font-black text-slate-900 mt-2">Rs.{Number(getAverageOrderValue() || 0).toLocaleString()}</p>
        </Card>
      </div>

      {/* Payment Method Breakdown */}
      <Card className="rounded-2xl border-none shadow-lg overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black uppercase tracking-tight">Payment Method Performance</h3>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Sales breakdown by payment mode</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Payment Method</th>
                <th className="px-6 py-4 text-right text-xs font-black text-slate-500 uppercase tracking-widest">Orders</th>
                <th className="px-6 py-4 text-right text-xs font-black text-slate-500 uppercase tracking-widest">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(reportData?.sales_by_payment_method || []).map((pm: any, idx: number) => {
                const orderCount = pm.order_count || pm.orders_count || pm.count || pm.orders || 0;
                const totalAmount = pm.total_amount || pm.amount || pm.total || 0;
                
                return (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-[11px] font-black px-2.5 py-1 rounded uppercase tracking-tight",
                        pm.payment_method === "CASH" ? "bg-green-100 text-green-700" :
                        pm.payment_method === "QR" ? "bg-blue-100 text-blue-700" :
                        pm.payment_method === "CREDIT" ? "bg-purple-100 text-purple-700" :
                        pm.payment_method === "CARD" ? "bg-amber-100 text-amber-700" :
                        "bg-slate-100 text-slate-700"
                      )}>
                        {pm.payment_method}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-sm text-slate-500">
                      {orderCount > 0 ? orderCount : '-'}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-sm text-slate-900">Rs.{Number(totalAmount).toLocaleString()}</td>
                  </tr>
                );
              })}
              {(reportData?.sales_by_payment_method || []).length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-muted-foreground">
                    No payment data available for this period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detailed Reports */}
      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="sales">Sales & Item Analytics</TabsTrigger>
          <TabsTrigger value="staff">Staff Report</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-6">
          {/* Payment Method Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 rounded-2xl border-none shadow-lg">
              <div className="mb-4 text-center">
                <h3 className="text-base font-black uppercase tracking-tight">Sales by Payment Method</h3>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Transaction spread</p>
              </div>
              <div className="h-[250px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={(reportData?.sales_by_payment_method || []).map((p: any) => ({
                        ...p,
                        total_amount: parseFloat(String(p.total_amount || 0)) || 0
                      }))}
                      dataKey="total_amount"
                      nameKey="payment_method"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      stroke="none"
                      isAnimationActive={false}
                    >
                      {(reportData?.sales_by_payment_method || []).map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} className="hover:opacity-80 transition-opacity cursor-pointer" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '12px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value: any) => [`Rs.${Number(value).toLocaleString()}`, 'Total']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Top Selling Items */}
            <Card className="p-6 rounded-2xl border-none shadow-lg">
              <div className="mb-4">
                <h3 className="text-base font-black uppercase tracking-tight">Top Selling Items</h3>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">By quantity sold</p>
              </div>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topItems.slice(0, 5)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="product_name" tick={{ fontSize: 11, fontWeight: 600 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '12px'
                      }}
                      formatter={(value: any) => [`${value} units`, 'Sold']}
                    />
                    <Bar dataKey="total_quantity" fill="hsl(142, 71%, 45%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Hourly Sales Trend */}
          {hourlyChartData.length > 0 && (
            <Card className="p-6 rounded-2xl border-none shadow-lg">
              <div className="mb-4">
                <h3 className="text-base font-black uppercase tracking-tight">Hourly Sales Trend</h3>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Sales distribution throughout the day</p>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="hour" tick={{ fontSize: 11, fontWeight: 600 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '12px'
                      }}
                      formatter={(value: any) => [`Rs.${Number(value).toLocaleString()}`, 'Sales']}
                    />
                    <Area type="monotone" dataKey="sales" stroke="hsl(217, 91%, 60%)" fill="hsl(217, 91%, 60%, 0.2)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="staff" className="space-y-4">
          <Card className="rounded-2xl border-none shadow-lg overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight">Staff Performance</h3>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Orders and sales by staff member</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                  <p className="text-[10px] font-black text-amber-700 uppercase tracking-wide">⚠️ All-Time Data</p>
                </div>
              </div>
            </div>
            {staffLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50/80">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Staff</th>
                      <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Role</th>
                      <th className="px-6 py-4 text-right text-xs font-black text-slate-500 uppercase tracking-widest">Orders</th>
                      <th className="px-6 py-4 text-right text-xs font-black text-slate-500 uppercase tracking-widest">Sales</th>
                      <th className="px-6 py-4 text-right text-xs font-black text-slate-500 uppercase tracking-widest">Cash In Hand</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {staffData.map((staff: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-sm text-slate-800">{staff.user_name || staff.username || staff.name || 'Unknown'}</td>
                        <td className="px-6 py-4 text-sm text-slate-600 capitalize">{staff.role || 'N/A'}</td>
                        <td className="px-6 py-4 text-right font-bold text-sm text-slate-900">{staff.orders || staff.order_count || 0}</td>
                        <td className="px-6 py-4 text-right font-bold text-sm text-slate-900">Rs.{Number(staff.sales || staff.total_sales || 0).toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-bold text-sm text-emerald-600">Rs.{Number(staff.cash_in_hand || staff.cash || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                    {staffData.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                          No staff data available for this period
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Cash Calculator Modal - Professional Monochrome Design */}
      <Dialog open={showCashCalculator} onOpenChange={setShowCashCalculator}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden p-0 bg-white rounded-2xl shadow-2xl">
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b border-slate-200">
            <DialogTitle className="flex items-center gap-3 text-xl font-black text-slate-900">
              <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center">
                <Calculator className="h-5 w-5 text-white" />
              </div>
              Cash Drawer Calculator
            </DialogTitle>
            <p className="text-xs text-slate-500 ml-13">Count physical cash and verify against system</p>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[calc(85vh-80px)] p-6 space-y-5">
            {/* Summary Cards Row */}
            <div className="grid grid-cols-3 gap-4">
              {/* Your Count */}
              <div className="bg-slate-50 border-2 border-slate-200 p-4 rounded-xl">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wide">Your Count</p>
                <p className="text-2xl font-black text-slate-900 mt-1">₹{calculateTotalCash().toLocaleString()}</p>
              </div>

              {/* System */}
              <div className="bg-slate-50 border-2 border-slate-200 p-4 rounded-xl">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wide">System Cash</p>
                <p className="text-2xl font-black text-slate-900 mt-1">₹{getSystemCashAmount().toLocaleString()}</p>
              </div>

              {/* Difference */}
              <div className={cn(
                "p-4 rounded-xl border-2",
                calculateTotalCash() === getSystemCashAmount() 
                  ? "bg-slate-900 border-slate-900" 
                  : "bg-amber-50 border-amber-300"
              )}>
                <p className={cn(
                  "text-[10px] font-black uppercase tracking-wide",
                  calculateTotalCash() === getSystemCashAmount() ? "text-white/80" : "text-amber-700"
                )}>
                  {calculateTotalCash() === getSystemCashAmount() ? "Status" : "Difference"}
                </p>
                <p className={cn(
                  "text-2xl font-black mt-1",
                  calculateTotalCash() === getSystemCashAmount() ? "text-white" : "text-amber-900"
                )}>
                  {calculateTotalCash() === getSystemCashAmount() 
                    ? "✓ Match" 
                    : `${calculateTotalCash() > getSystemCashAmount() ? '+' : ''}₹${Math.abs(calculateTotalCash() - getSystemCashAmount()).toLocaleString()}`
                  }
                </p>
              </div>
            </div>

            {/* Denomination Grid */}
            <div className="space-y-3">
              <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider">Count Notes & Coins</h3>
              
              {/* Large Notes (1000, 500) */}
              <div className="grid grid-cols-2 gap-3">
                {['1000', '500'].map((value) => (
                  <div key={value} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border-2 border-slate-200">
                    <div className="w-16 h-10 rounded-lg bg-slate-900 flex items-center justify-center">
                      <span className="text-white font-black text-sm">₹{value}</span>
                    </div>
                    <span className="text-slate-400 font-bold">×</span>
                    <Input
                      type="number"
                      min="0"
                      value={denominations[value] || ''}
                      onChange={(e) => updateDenomination(parseInt(value), e.target.value)}
                      className="w-20 h-10 text-center font-bold text-base border-2 border-slate-300 focus:border-slate-900 rounded-lg"
                      placeholder="0"
                    />
                    <span className="text-sm font-black text-slate-900 ml-auto">₹{(parseInt(value) * (denominations[value] || 0)).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {/* Medium Notes (100, 50) */}
              <div className="grid grid-cols-2 gap-3">
                {['100', '50'].map((value) => (
                  <div key={value} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border-2 border-slate-200">
                    <div className="w-16 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
                      <span className="text-white font-black text-sm">₹{value}</span>
                    </div>
                    <span className="text-slate-400 font-bold">×</span>
                    <Input
                      type="number"
                      min="0"
                      value={denominations[value] || ''}
                      onChange={(e) => updateDenomination(parseInt(value), e.target.value)}
                      className="w-20 h-10 text-center font-bold text-base border-2 border-slate-300 focus:border-slate-700 rounded-lg"
                      placeholder="0"
                    />
                    <span className="text-sm font-black text-slate-900 ml-auto">₹{(parseInt(value) * (denominations[value] || 0)).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {/* Small Notes (20, 10) */}
              <div className="grid grid-cols-2 gap-3">
                {['20', '10'].map((value) => (
                  <div key={value} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border-2 border-slate-200">
                    <div className="w-16 h-10 rounded-lg bg-slate-600 flex items-center justify-center">
                      <span className="text-white font-black text-sm">₹{value}</span>
                    </div>
                    <span className="text-slate-400 font-bold">×</span>
                    <Input
                      type="number"
                      min="0"
                      value={denominations[value] || ''}
                      onChange={(e) => updateDenomination(parseInt(value), e.target.value)}
                      className="w-20 h-10 text-center font-bold text-base border-2 border-slate-300 focus:border-slate-600 rounded-lg"
                      placeholder="0"
                    />
                    <span className="text-sm font-black text-slate-900 ml-auto">₹{(parseInt(value) * (denominations[value] || 0)).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {/* Coins (5, 2, 1) */}
              <div className="grid grid-cols-3 gap-3">
                {['5', '2', '1'].map((value) => (
                  <div key={value} className="flex flex-col items-center gap-2 bg-slate-50 p-3 rounded-xl border-2 border-slate-200">
                    <div className="w-12 h-12 rounded-full bg-slate-500 flex items-center justify-center">
                      <span className="text-white font-black text-xs">₹{value}</span>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      value={denominations[value] || ''}
                      onChange={(e) => updateDenomination(parseInt(value), e.target.value)}
                      className="w-16 h-9 text-center font-bold text-sm border-2 border-slate-300 focus:border-slate-500 rounded-lg"
                      placeholder="0"
                    />
                    <span className="text-xs font-black text-slate-700">₹{(parseInt(value) * (denominations[value] || 0)).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            {Object.entries(denominations).some(([_, count]) => count > 0) && (
              <div className="bg-slate-100 p-4 rounded-xl border-2 border-slate-200">
                <p className="text-xs font-black text-slate-600 uppercase tracking-wide mb-3">Breakdown</p>
                <div className="space-y-2">
                  {Object.entries(denominations)
                    .filter(([_, count]) => count > 0)
                    .sort(([a], [b]) => parseInt(b) - parseInt(a))
                    .map(([value, count]) => (
                      <div key={value} className="flex justify-between items-center text-sm">
                        <span className="text-slate-600 font-medium">₹{value} × {count}</span>
                        <span className="font-bold text-slate-900">₹{(parseInt(value) * count).toLocaleString()}</span>
                      </div>
                    ))}
                  <div className="border-t-2 border-slate-300 pt-2 mt-2 flex justify-between items-center">
                    <span className="text-slate-900 font-black text-base">Total Count</span>
                    <span className="font-black text-xl text-slate-900">₹{calculateTotalCash().toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Clear Button */}
            <Button
              variant="outline"
              onClick={clearCalculator}
              className="w-full h-11 rounded-xl text-sm font-bold border-2 border-slate-300 hover:bg-slate-100 hover:border-slate-400 text-slate-700"
            >
              Clear All
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}