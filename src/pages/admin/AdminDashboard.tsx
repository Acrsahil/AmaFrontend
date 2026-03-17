import { StatCard } from "@/components/admin/StatCard";
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { fetchDashboardDetails, fetchInvoices, fetchTables } from "@/api/index.js";
import { getCurrentUser } from "../../auth/auth";
import { toast } from "sonner";
import { useDashboardPolling } from "@/hooks/useDashboardPolling";
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Clock,
  UtensilsCrossed,
  Coffee,
  MapPin,
  Loader2,
  ExternalLink,
  Layers,
  Wifi,
  WifiOff,
  Filter,
  CalendarDays,
  ChevronDown,
  Calendar as CalendarIcon
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
  Area,
  Line,
  ComposedChart,
  LabelList,
  Legend
} from "recharts";
import { StatusBadge } from "@/components/ui/status-badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COLORS = ['hsl(32, 95%, 44%)', 'hsl(15, 70%, 50%)', 'hsl(142, 71%, 45%)', 'hsl(199, 89%, 48%)'];
const PAYMENT_COLORS = ['hsl(142, 71%, 45%)', 'hsl(217, 91%, 60%)', 'hsl(32, 95%, 44%)', 'hsl(280, 65%, 60%)', 'hsl(0, 84%, 60%)'];

export default function AdminDashboard() {
  const user = getCurrentUser();
  const branchLabel =
    user?.branch_name || (user?.branch_id ? `Branch #${user.branch_id}` : "Global");

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [floors, setFloors] = useState<any[]>([]);
  const [pollingActive, setPollingActive] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // Filter states
  const [timeframe, setTimeframe] = useState("daily");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined, to: Date | undefined }>({
    from: undefined,
    to: undefined
  });

  // Poll dashboard data — runs immediately on mount, then every 30s.
  // Re-runs when user/timeframe/dateRange changes.
  useDashboardPolling(
    async () => {
      setPollingActive(true);
      await Promise.all([
        loadDashboardData(),
        loadRecentOrders(),
        loadTableData(),
      ]);
      setTimeout(() => setPollingActive(false), 1000);
    },
    30000,
    [user?.branch_id, timeframe, dateRange]
  );

  const getFilters = () => {
    const params: any = { timeframe };
    if (timeframe === "custom" && dateRange.from && dateRange.to) {
      params.start_date = format(dateRange.from, "yyyy-MM-dd");
      params.end_date = format(dateRange.to, "yyyy-MM-dd");
    }
    return params;
  };

  const loadDashboardData = async () => {
    try {
      const isSuperOrAdmin = user?.is_superuser || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
      const branchId = isSuperOrAdmin ? (user?.branch_id || null) : null;
      const data = await fetchDashboardDetails(branchId, getFilters());
      setDashboardData(data);
    } catch (error) {
      console.error("Failed to fetch dashboard details:", error);
      toast.error("Failed to load dashboard statistics");
    }
  };

  const loadTableData = async () => {
    try {
      const tablesData = await fetchTables();
      const branchId = user?.branch_id;
      const branchFloors =
        branchId != null
          ? (tablesData || []).filter((f: any) => f.branch === branchId)
          : tablesData || [];
      setFloors(branchFloors);
    } catch (error) {
      console.error("Failed to fetch tables:", error);
    }
  };

  const loadRecentOrders = async () => {
    setLoading(true);
    try {
      const data = await fetchInvoices();
      const sorted = Array.isArray(data)
        ? [...data].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        : [];

      const isSuperOrAdmin =
        user?.is_superuser || user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
      const hasBranchScope = isSuperOrAdmin && user?.branch_id;

      const filtered = hasBranchScope
        ? sorted.filter(
          (order: any) =>
            order.branch === user.branch_id || order.branch_id === user.branch_id
        )
        : sorted;

      setRecentOrders(filtered.slice(0, 5));
    } catch (err: any) {
      console.error("Dashboard recent orders failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const isSuperOrAdminView = user?.is_superuser || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isGlobalView = isSuperOrAdminView && !user?.branch_id;

  const peakHourDisplay = (() => {
    const peakHours = dashboardData?.peak_hours;
    if (Array.isArray(peakHours) && peakHours.length > 0) {
      return peakHours.join(", ");
    }
    return "—";
  })();

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Top Navigation & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Greetings, {user?.name?.split(' ')[0] || 'Admin'}
          </h1>
          <div className="flex items-center gap-2 text-slate-500 font-medium">
            <MapPin className="h-4 w-4 text-primary" />
            <span>{branchLabel}</span>
            <span className="text-slate-200">|</span>
            <span className="text-xs uppercase tracking-widest font-bold text-slate-400">
              {timeframe} view
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
            "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
          )}>
            <div className={cn("h-1.5 w-1.5 rounded-full bg-emerald-500", pollingActive && "animate-pulse")} />
            Polling
          </div>

          {/* Timeframe Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-11 rounded-xl border-2 font-bold px-4 hover:bg-slate-50 transition-all border-slate-100 shadow-sm gap-2 hover:text-slate-900">
                <Filter className="h-4 w-4 text-primary" />
                <span className="capitalize">{timeframe}</span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl border-none shadow-2xl bg-white/95 backdrop-blur-xl">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 py-1.5 font-black">Select Period</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setTimeframe("daily")} className="rounded-xl font-bold text-sm cursor-pointer hover:bg-slate-50 py-3">Today</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTimeframe("weekly")} className="rounded-xl font-bold text-sm cursor-pointer hover:bg-slate-50 py-3">Weekly</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTimeframe("monthly")} className="rounded-xl font-bold text-sm cursor-pointer hover:bg-slate-50 py-3">Monthly</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTimeframe("yearly")} className="rounded-xl font-bold text-sm cursor-pointer hover:bg-slate-50 py-3">Yearly</DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-100 my-1" />
              <DropdownMenuItem onClick={() => setTimeframe("custom")} className="rounded-xl font-bold text-sm cursor-pointer hover:bg-slate-50 py-3 text-primary">Custom Range</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Custom Date Range Popover */}
          {timeframe === "custom" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("h-11 rounded-xl border-2 font-bold px-4 border-slate-100 shadow-sm gap-2", !dateRange.from && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>{format(dateRange.from, "MMM dd")} - {format(dateRange.to, "MMM dd")}</>
                    ) : (
                      format(dateRange.from, "MMM dd")
                    )
                  ) : (
                    "Pick Dates"
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isGlobalView ? (
          <>
            <StatCard
              title="Global Sales"
              value={`Rs.${dashboardData?.total_sum?.toLocaleString() || 0}`}
              icon={DollarSign}
            />
            <StatCard
              title="Branches"
              value={dashboardData?.total_count_branch || 0}
              icon={ShoppingBag}
            />
            <StatCard
              title="Total Users"
              value={dashboardData?.total_user_count || 0}
              icon={TrendingUp}
            />
            <StatCard
              title={`${timeframe} Orders`}
              value={dashboardData?.total_count_order || 0}
              icon={ShoppingBag}
              subtitle={`Avg Order (${timeframe}): Rs.${dashboardData?.average_order_value?.toFixed(0) || 0}`}
            />
          </>
        ) : (
          <>
            <StatCard
              title={`${timeframe} Sales`}
              value={`Rs.${dashboardData?.today_sales?.toLocaleString() || 0}`}
              icon={DollarSign}
              trend={{ value: Number(Math.abs(dashboardData?.sales_percent || 0).toFixed(1)), isPositive: (dashboardData?.sales_percent || 0) >= 0 }}
            />
            <StatCard
              title={`${timeframe} Orders`}
              value={dashboardData?.total_orders || 0}
              icon={ShoppingBag}
              trend={{ value: Number(Math.abs(dashboardData?.order_percent || 0).toFixed(1)), isPositive: (dashboardData?.order_percent || 0) >= 0 }}
            />
            <StatCard
              title={`Avg Order (${timeframe})`}
              value={`Rs.${dashboardData?.avg_orders ? Number(dashboardData.avg_orders).toFixed(0) : 0}`}
              icon={TrendingUp}
              trend={{ value: Number(Math.abs(dashboardData?.avg_order_percent || 0).toFixed(1)), isPositive: (dashboardData?.avg_order_percent || 0) >= 0 }}
            />
            <StatCard
              title="Peak Hour"
              value={peakHourDisplay}
              icon={Clock}
              subtitle="Busiest time"
            />
          </>
        )}
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category breakdown bar chart */}
        <div className="card-elevated p-8">
          <div className="mb-6 text-center">
            <h3 className="text-lg font-black uppercase tracking-tight capitalize">{timeframe} Sales by Category</h3>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{timeframe} Revenue split</p>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={(dashboardData?.total_sales_per_category || []).map((item: any) => ({
                  name: item.product__category__name || 'Other',
                  value: parseFloat(String(item.category_total_sales || 0)) || 0
                }))}
                layout="vertical"
                margin={{ left: -30, right: 80, top: 0, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fontWeight: 800, fill: '#64748b' }}
                  width={90}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}
                  formatter={(value: any) => [`Rs.${Number(value).toLocaleString()}`, 'Sales']}
                />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={20}>
                  {(dashboardData?.total_sales_per_category || []).map((_: any, index: number) => (
                    <Cell key={`cell-cat-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="right"
                    offset={12}
                    formatter={(val: any) => `Rs.${Number(val).toLocaleString()}`}
                    style={{ fontSize: '10px', fontWeight: 'bold', fill: '#64748b' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Status distribution pie chart */}
        <div className="card-elevated p-8 text-center">
          <h3 className="text-lg font-black uppercase tracking-tight mb-6 capitalize">{timeframe} Payment Status</h3>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={(dashboardData?.sales_by_status || []).map((item: any) => ({
                    name: (item.payment_status || 'Other').toLowerCase(),
                    value: parseFloat(String(item.total_amount || 0)) || 0
                  }))}
                  dataKey="value"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  stroke="none"
                >
                  {(dashboardData?.sales_by_status || []).map((_: any, index: number) => (
                    <Cell key={`cell-status-${index}`} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => [`Rs.${Number(value).toLocaleString()}`, 'Total']} />
                <Legend
                  layout="horizontal"
                  align="center"
                  verticalAlign="bottom"
                  iconType="circle"
                  wrapperStyle={{ paddingTop: '20px' }}
                  formatter={(value, entry: any) => (
                    <span className="text-[10px] font-black uppercase text-slate-500 ml-1">
                      {value}: <span className="text-slate-900 font-black">Rs.{Number(entry.payload.value).toLocaleString()}</span>
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods pie chart */}
        <div className="card-elevated p-8 text-center">
          <h3 className="text-lg font-black uppercase tracking-tight mb-6 capitalize">{timeframe} Payments</h3>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={(dashboardData?.sales_by_payment_method || []).map((p: any) => ({
                    name: (p.payment_method || 'other').toLowerCase(),
                    value: parseFloat(String(p.total_amount || 0)) || 0
                  }))}
                  dataKey="value"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  stroke="none"
                >
                  {(dashboardData?.sales_by_payment_method || []).map((_: any, index: number) => (
                    <Cell key={`cell-pay-${index}`} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => [`Rs.${Number(value).toLocaleString()}`, 'Total']} />
                <Legend
                  layout="horizontal"
                  align="center"
                  verticalAlign="bottom"
                  iconType="circle"
                  wrapperStyle={{ paddingTop: '20px' }}
                  formatter={(value, entry: any) => (
                    <span className="text-[10px] font-black uppercase text-slate-500 ml-1">
                      {value}: <span className="text-slate-900 font-black">Rs.{Number(entry.payload.value).toLocaleString()}</span>
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Main trend chart */}
      <div className="card-elevated p-8">
        <h3 className="text-xl font-bold tracking-tight mb-8 capitalize">{timeframe} Sales Trend</h3>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dashboardData?.trend_chart || []}>
              <defs>
                <linearGradient id="colorSalesTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" fontSize={11} fontWeight={700} axisLine={false} tickLine={false} dy={10} />
              <YAxis fontSize={11} fontWeight={700} axisLine={false} tickLine={false} tickFormatter={(v) => `Rs.${v}`} />
              <Tooltip formatter={(v: any) => [`Rs.${Number(v).toLocaleString()}`, 'Sales']} />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="hsl(var(--primary))"
                strokeWidth={4}
                fill="url(#colorSalesTrend)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity Table */}
        <div className="card-elevated overflow-hidden border-2 border-slate-50">
          <div className="p-6 border-b flex items-center justify-between">
            <h3 className="font-black text-slate-900 uppercase tracking-tighter text-sm">Recent Activity</h3>
            <NavLink to="/admin/dashboard/invoices" className="text-[10px] font-black uppercase text-primary">View All</NavLink>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-left font-black text-[10px] uppercase text-slate-400">Order</th>
                <th className="px-6 py-4 text-left font-black text-[10px] uppercase text-slate-400">Time</th>
                <th className="px-6 py-4 text-left font-black text-[10px] uppercase text-slate-400">Status</th>
                <th className="px-6 py-4 text-right font-black text-[10px] uppercase text-slate-400">Total</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr
                  key={order.id}
                  className="border-t border-slate-50 hover:bg-slate-50/50 cursor-pointer"
                  onClick={() => setSelectedOrder(order)}
                >
                  <td className="px-6 py-4 font-bold text-slate-900">{order.invoice_number}</td>
                  <td className="px-6 py-4 text-slate-500 text-xs">
                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={(order.payment_status || "PENDING").toLowerCase()} className="h-6 px-2 text-[9px]" />
                  </td>
                  <td className="px-6 py-4 text-right font-black text-primary">Rs.{order.total_amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top Products / Branches */}
        <div className="card-elevated p-6">
          <h3 className="font-black text-slate-900 uppercase tracking-tighter text-sm mb-6">
            {isGlobalView ? "Top Branches" : "Top Products"}
          </h3>
          <div className="space-y-4">
            {isGlobalView ? (
              (dashboardData?.top_perfomance_branch || []).map((branch: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/30 border border-slate-100">
                  <span className="font-black text-slate-900">{branch.name}</span>
                  <span className="font-black text-primary text-sm">Rs.{Number(branch.total_sales_per_branch).toLocaleString()}</span>
                </div>
              ))
            ) : (
              (dashboardData?.top_selling_items || []).slice(0, 5).map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">{item.product__name}</span>
                  <span className="text-xs font-black bg-slate-50 px-3 py-1 rounded-full text-slate-500">{item.total_sold_units || item.total_orders || 0} Sold</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Invoice Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          {selectedOrder && (
            <div className="flex flex-col">
              <div className="bg-primary/5 p-8 text-center border-b font-black">
                <h2 className="text-2xl text-slate-900">Order {selectedOrder.invoice_number}</h2>
              </div>
              <div className="p-8 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                  <div>
                    <p>Status</p>
                    <StatusBadge status={selectedOrder.payment_status.toLowerCase()} />
                  </div>
                  <div className="text-right">
                    <p>Time</p>
                    <p className="text-slate-900">{new Date(selectedOrder.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4">
                  <div className="border-t border-slate-200 mt-2 pt-2 flex justify-between">
                    <span className="font-black text-slate-900 uppercase text-xs">Total</span>
                    <span className="text-xl font-black text-primary">Rs.{selectedOrder.total_amount?.toLocaleString()}</span>
                  </div>
                </div>
                <Button className="w-full h-12 rounded-2xl font-bold" onClick={() => setSelectedOrder(null)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
