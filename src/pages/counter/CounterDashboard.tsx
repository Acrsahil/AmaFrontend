import { StatCard } from "@/components/admin/StatCard";
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { fetchDashboardDetails, fetchInvoices, fetchBranch, fetchDailySales } from "@/api/index.js";
import { getCurrentUser, logout } from "../../auth/auth";
import { toast } from "sonner";
import {
    Banknote,
    ShoppingBag,
    TrendingUp,
    Clock,
    Monitor,
    LayoutDashboard,
    User,
    LogOut,
    Key,
    ChevronRight,
    ArrowUpRight,
    Calendar as CalendarIcon,
    Search,
    ChevronDown,
    Loader2,
    Menu,
    Wifi,
    WifiOff,
    Filter,
    CalendarDays
} from "lucide-react";
import { useDashboardWebSocket } from "@/hooks/useDashboardWebSocket";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ChangePasswordModal } from "@/components/auth/ChangePasswordModal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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
    Legend,
    LabelList,
} from "recharts";
import { StatusBadge } from "@/components/ui/status-badge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const COLORS = ['hsl(32, 95%, 44%)', 'hsl(15, 70%, 50%)', 'hsl(142, 71%, 45%)', 'hsl(199, 89%, 48%)'];
const PAYMENT_COLORS = ['hsl(142, 71%, 45%)', 'hsl(217, 91%, 60%)', 'hsl(32, 95%, 44%)', 'hsl(280, 65%, 60%)', 'hsl(0, 84%, 60%)'];

export default function CounterDashboard() {
    const navigate = useNavigate();
    const user = getCurrentUser();
    const [dashboardData, setDashboardData] = useState<any>(null);
    const [recentOrders, setRecentOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [branchInfo, setBranchInfo] = useState<any>(null);
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [sseConnected, setSSEConnected] = useState(false);

    // Timeframe filters identical to Branch Manager
    const [timeframe, setTimeframe] = useState("daily");
    const [dateRange, setDateRange] = useState<{ from: Date | undefined, to: Date | undefined }>({
        from: undefined,
        to: undefined
    });

    const [salesFilter, setSalesFilter] = useState<'product' | 'category' | 'kitchentype'>('product');
    const [salesData, setSalesData] = useState<any[]>([]);
    const [salesLoading, setSalesLoading] = useState(false);

    const getFilters = () => {
        const params: any = { timeframe };
        if (timeframe === "custom" && dateRange.from && dateRange.to) {
            params.start_date = format(dateRange.from, "yyyy-MM-dd");
            params.end_date = format(dateRange.to, "yyyy-MM-dd");
        }
        return params;
    };

    const loadSalesData = useCallback(async (filter: 'product' | 'category' | 'kitchentype') => {
        if (!user?.branch_id) return;
        setSalesLoading(true);
        try {
            const dateStr = format(new Date(), 'yyyy-MM-dd');
            const apiFilter = filter === 'product' ? '' : filter;
            const res = await fetchDailySales(user.branch_id, dateStr, apiFilter);
            setSalesData(res?.sales || []);
        } catch (error) {
            console.error("Failed to load daily sales:", error);
            toast.error("Failed to load daily sales data");
        } finally {
            setSalesLoading(false);
        }
    }, [user?.branch_id]);

    useEffect(() => {
        if (user?.branch_id) {
            loadSalesData(salesFilter);
        }
    }, [salesFilter, user?.branch_id, loadSalesData]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [dashData, invoicesRes, branchRes] = await Promise.all([
                fetchDashboardDetails(user?.branch_id, getFilters()),
                fetchInvoices({ date: format(new Date(), 'yyyy-MM-dd'), page_size: 10 }),
                fetchBranch(user?.branch_id).catch(() => null)
            ]);

            setDashboardData(dashData);
            setRecentOrders(invoicesRes?.results || invoicesRes || []);
            setBranchInfo(branchRes?.data || branchRes);
        } catch (error) {
            console.error("Failed to load counter dashboard data:", error);
        } finally {
            setLoading(false);
        }
    }, [user?.branch_id, timeframe, dateRange]);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        loadData();
    }, [user?.id, user?.branch_id, navigate, loadData, timeframe, dateRange]);

    const wsRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleWSUpdate = useCallback(() => {
        if (wsRefreshTimerRef.current) clearTimeout(wsRefreshTimerRef.current);
        wsRefreshTimerRef.current = setTimeout(() => {
            loadData();
            loadSalesData(salesFilter);
        }, 500);
    }, [loadData, loadSalesData, salesFilter]);

    const { isConnected: wsConnected } = useDashboardWebSocket(user?.branch_id, handleWSUpdate);

    useEffect(() => {
        setSSEConnected(wsConnected);
    }, [wsConnected]);

    useEffect(() => {
        return () => {
            if (wsRefreshTimerRef.current) clearTimeout(wsRefreshTimerRef.current);
        };
    }, []);

    const handleLogout = () => {
        window.dispatchEvent(new CustomEvent("show-logout-confirm"));
    };

    return (
        <div className="h-screen bg-stone-50 flex flex-col overflow-hidden font-sans">
            {/* Top Header */}
            <header className="h-16 bg-white border-b px-6 pr-14 flex items-center justify-between shrink-0 z-10">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden rounded-xl h-10 w-10"
                        onClick={() => window.dispatchEvent(new CustomEvent("open-counter-sidebar"))}
                    >
                        <Menu className="h-6 w-6 text-slate-600" />
                    </Button>
                    <div>
                        <h1 className="text-lg md:text-xl font-bold text-slate-800 leading-none">Dashboard</h1>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${sseConnected ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border border-amber-500/20"}`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${sseConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500 animate-pulse"}`} />
                        {sseConnected ? "Live" : "Connecting"}
                    </div>

                    {/* Timeframe Selector identical to Branch Manager */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="h-9 rounded-xl border font-bold px-3 hover:bg-slate-50 transition-all border-slate-200 shadow-sm gap-1.5 text-xs">
                                <Filter className="h-3.5 w-3.5 text-primary" />
                                <span className="capitalize">{timeframe}</span>
                                <ChevronDown className="h-3 w-3 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl border bg-white shadow-2xl z-[110]">
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 py-1.5 font-black">Select Period</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => setTimeframe("daily")} className="rounded-xl font-bold text-sm cursor-pointer hover:bg-slate-50 py-2.5">Today</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTimeframe("weekly")} className="rounded-xl font-bold text-sm cursor-pointer hover:bg-slate-50 py-2.5">Weekly</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTimeframe("monthly")} className="rounded-xl font-bold text-sm cursor-pointer hover:bg-slate-50 py-2.5">Monthly</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTimeframe("yearly")} className="rounded-xl font-bold text-sm cursor-pointer hover:bg-slate-50 py-2.5">Yearly</DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-slate-100 my-1" />
                            <DropdownMenuItem onClick={() => setTimeframe("custom")} className="rounded-xl font-bold text-sm cursor-pointer hover:bg-slate-50 py-2.5 text-primary">Custom Range</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Custom Date Range Popover identical to Branch Manager */}
                    {timeframe === "custom" && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className={cn("h-9 rounded-xl border font-bold px-3 border-slate-200 shadow-sm gap-1.5 text-xs", !dateRange.from && "text-muted-foreground")}>
                                    <CalendarIcon className="h-3.5 w-3.5" />
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
                            <PopoverContent className="w-auto p-0 border shadow-2xl rounded-3xl overflow-hidden z-[110]" align="end">
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

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-auto p-2 hover:bg-slate-50 flex items-center gap-3 rounded-2xl transition-all text-left">
                                <div className="text-right hidden md:block">
                                    <p className="text-sm font-black text-slate-700">{user?.username || "Counter User"}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{user?.role}</p>
                                </div>
                                <div className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-slate-900 flex items-center justify-center text-white shrink-0 shadow-sm">
                                    <User className="h-4 w-4 md:h-5 md:w-5" />
                                </div>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 font-bold z-[100]">
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
                                onClick={handleLogout}
                            >
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Logout</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            <ChangePasswordModal
                isOpen={showChangePassword}
                onClose={() => setShowChangePassword(false)}
            />

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="max-w-[1600px] mx-auto space-y-10">

                    {/* Welcome Banner */}
                    <div className="relative overflow-hidden bg-gradient-to-br from-primary to-amber-700 rounded-[2rem] p-8 md:p-12 text-white shadow-xl shadow-primary/10">
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-8 w-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                                    <TrendingUp className="h-4 w-4 text-white" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/90">Operational Overview</span>
                            </div>
                            <h2 className="text-3xl md:text-5xl font-black mb-2 tracking-tight">{timeframe === 'daily' ? "Today's Summary" : `${timeframe} Summary`}</h2>
                            <p className="text-white/80 font-medium max-w-xl text-sm md:text-base">
                                Welcome back, <span className="text-white font-bold">{user?.username || 'Counter'}</span>.
                                Here's how {branchInfo?.name || 'the branch'} is performing.
                            </p>
                        </div>
                        {/* Decorative background elements */}
                        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 h-[400px] w-[400px] bg-white/10 rounded-full blur-[100px]" />
                        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 h-[300px] w-[300px] bg-white/5 rounded-full blur-[80px]" />
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        <StatCard
                            title={`${timeframe} Sales`}
                            value={`Rs.${(dashboardData?.today_sales || dashboardData?.total_sum || 0).toLocaleString()}`}
                            icon={Banknote}
                            trend={{ value: Number(Math.abs(dashboardData?.sales_percent || 0).toFixed(1)), isPositive: (dashboardData?.sales_percent || 0) >= 0 }}
                            className="bg-white border-2 border-slate-100 hover:border-primary/20 transition-all hover:shadow-xl rounded-3xl"
                        />
                        <StatCard
                            title={`${timeframe} Orders`}
                            value={dashboardData?.total_orders || dashboardData?.total_count_order || 0}
                            icon={ShoppingBag}
                            trend={{ value: Number(Math.abs(dashboardData?.order_percent || 0).toFixed(1)), isPositive: (dashboardData?.order_percent || 0) >= 0 }}
                            className="bg-white border-2 border-slate-100 hover:border-primary/20 transition-all hover:shadow-xl rounded-3xl"
                        />
                        <StatCard
                            title={`Avg Order (${timeframe})`}
                            value={`Rs.${dashboardData?.avg_orders || dashboardData?.average_order_value ? Number(dashboardData.avg_orders || dashboardData.average_order_value).toFixed(0) : 0}`}
                            icon={TrendingUp}
                            trend={{ value: Number(Math.abs(dashboardData?.avg_order_percent || 0).toFixed(1)), isPositive: (dashboardData?.avg_order_percent || 0) >= 0 }}
                            className="bg-white border-2 border-slate-100 hover:border-primary/20 transition-all hover:shadow-xl rounded-3xl"
                        />
                        <StatCard
                            title="Peak Hour"
                            value={Array.isArray(dashboardData?.peak_hours) && dashboardData.peak_hours.length > 0 ? dashboardData.peak_hours.join(", ") : "—"}
                            icon={Clock}
                            subtitle="Busiest time"
                            className="bg-white border-2 border-slate-100 hover:border-primary/20 transition-all hover:shadow-xl rounded-3xl"
                        />
                    </div>

                    {/* Main Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Category breakdown bar chart */}
                        <div className="bg-white rounded-[2rem] border-2 border-slate-100 p-8 shadow-sm">
                            <div className="mb-6 text-center">
                                <h3 className="text-lg font-black uppercase tracking-tight capitalize">{timeframe} Sales by Category</h3>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{timeframe} Revenue split</p>
                            </div>
                            <div className="h-[320px] w-full">
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
                        <div className="bg-white rounded-[2rem] border-2 border-slate-100 p-8 shadow-sm text-center">
                            <h3 className="text-lg font-black uppercase tracking-tight mb-6 capitalize">{timeframe} Payment Status</h3>
                            <div className="h-[320px] w-full">
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
                        <div className="bg-white rounded-[2rem] border-2 border-slate-100 p-8 shadow-sm text-center">
                            <h3 className="text-lg font-black uppercase tracking-tight mb-6 capitalize">{timeframe} Payments</h3>
                            <div className="h-[320px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={(() => {
                                                const methods = (dashboardData?.sales_by_payment_method || [])
                                                    .filter((p: any) => ['CASH', 'QR'].includes(p.payment_method?.toUpperCase()))
                                                    .map((p: any) => ({
                                                        name: (p.payment_method || 'other').toLowerCase(),
                                                        value: parseFloat(String(p.total_amount || 0)) || 0
                                                    }));

                                                const pending = (dashboardData?.sales_by_status || [])
                                                    .find((s: any) => s.payment_status?.toUpperCase() === 'PENDING');

                                                if (pending && parseFloat(String(pending.total_amount)) > 0) {
                                                    methods.push({
                                                        name: 'pending',
                                                        value: parseFloat(String(pending.total_amount))
                                                    });
                                                }
                                                return methods;
                                            })()}
                                            dataKey="value"
                                            innerRadius={50}
                                            outerRadius={70}
                                            paddingAngle={5}
                                            stroke="none"
                                        >
                                            {[
                                                'hsl(142, 71%, 45%)', // Cash - Green
                                                'hsl(217, 91%, 60%)', // QR - Blue
                                                'hsl(0, 84%, 60%)',   // Pending - Red
                                                'hsl(32, 95%, 44%)'   // Other - Amber
                                            ].map((color, index) => (
                                                <Cell key={`cell-pay-${index}`} fill={color} />
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
                    <div className="bg-white rounded-[2rem] border-2 border-slate-100 p-8 shadow-sm">
                        <h3 className="text-xl font-black text-slate-800 tracking-tight mb-8 capitalize">{timeframe} Sales Trend</h3>
                        <div className="h-[420px] w-full">
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
                        <div className="bg-white rounded-[2rem] border-2 border-slate-100 overflow-hidden shadow-sm">
                            <div className="p-8 border-b flex items-center justify-between">
                                <h3 className="font-black text-slate-900 uppercase tracking-tighter text-sm">Recent Activity</h3>
                                <Button
                                    variant="outline"
                                    className="rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 hover:bg-slate-50"
                                    onClick={() => navigate('/counter/orders')}
                                >
                                    View All
                                </Button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50/50">
                                        <tr>
                                            <th className="px-6 py-4 text-left font-black text-[10px] uppercase text-slate-400">Order ID</th>
                                            <th className="px-6 py-4 text-left font-black text-[10px] uppercase text-slate-400">Customer</th>
                                            <th className="px-6 py-4 text-left font-black text-[10px] uppercase text-slate-400">Time</th>
                                            <th className="px-6 py-4 text-left font-black text-[10px] uppercase text-slate-400">Status</th>
                                            <th className="px-6 py-4 text-right font-black text-[10px] uppercase text-slate-400">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {recentOrders.map((order) => (
                                            <tr
                                                key={order.id}
                                                className="hover:bg-slate-50 transition-colors cursor-pointer group"
                                                onClick={() => navigate('/counter/orders', { state: { orderId: order.id } })}
                                            >
                                                <td className="px-6 py-4">
                                                    <span className="font-mono text-xs font-bold text-slate-900 group-hover:text-primary transition-colors">#{order.invoice_number}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-sm font-bold text-slate-700">{order.customer_name || 'Walk-in'}</span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-500 text-xs">
                                                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <StatusBadge status={(order.payment_status || "PENDING").toLowerCase()} className="h-6 px-2 text-[9px]" />
                                                </td>
                                                <td className="px-6 py-4 text-right font-black text-slate-900">Rs.{parseFloat(order.total_amount).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                        {recentOrders.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-10 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                                                    No recent activity
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Top Products */}
                        <div className="bg-white rounded-[2rem] border-2 border-slate-100 p-8 shadow-sm">
                            <h3 className="font-black text-slate-900 uppercase tracking-tighter text-sm mb-6">Top Products</h3>
                            <div className="space-y-4">
                                {(dashboardData?.top_selling_items || []).slice(0, 5).map((item: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/50 hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-xl bg-white shadow-sm flex items-center justify-center font-black text-xs text-slate-400">
                                                {idx + 1}
                                            </div>
                                            <span className="font-bold text-slate-700 group-hover:text-primary transition-colors">{item.product__name}</span>
                                        </div>
                                        <span className="text-xs font-black bg-white px-3 py-1 rounded-full text-slate-500 border border-slate-100 shadow-sm">{item.total_sold_units || item.total_orders || 0} Sold</span>
                                    </div>
                                ))}
                                {(!dashboardData?.top_selling_items || dashboardData.top_selling_items.length === 0) && (
                                    <div className="py-10 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                                        No top products data yet
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
