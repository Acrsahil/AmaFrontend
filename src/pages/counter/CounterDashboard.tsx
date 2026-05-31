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
    Calendar,
    Search,
    ChevronDown,
    Loader2,
    Menu,
    Wifi,
    WifiOff
} from "lucide-react";
import { useDashboardWebSocket } from "@/hooks/useDashboardWebSocket";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ChangePasswordModal } from "@/components/auth/ChangePasswordModal";
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
} from "recharts";
import { StatusBadge } from "@/components/ui/status-badge";
import { format } from "date-fns";

const COLORS = ['hsl(32, 95%, 44%)', 'hsl(15, 70%, 50%)', 'hsl(142, 71%, 45%)', 'hsl(199, 89%, 48%)'];

export default function CounterDashboard() {
    const navigate = useNavigate();
    const user = getCurrentUser();
    const [dashboardData, setDashboardData] = useState<any>(null);
    const [recentOrders, setRecentOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [branchInfo, setBranchInfo] = useState<any>(null);
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [sseConnected, setSSEConnected] = useState(false);

    const [salesFilter, setSalesFilter] = useState<'product' | 'category' | 'kitchentype'>('product');
    const [salesData, setSalesData] = useState<any[]>([]);
    const [salesLoading, setSalesLoading] = useState(false);

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
                fetchDashboardDetails(user?.branch_id, { timeframe: 'daily' }),
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
    }, [user?.branch_id]);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        loadData();
    }, [user?.id, user?.branch_id, navigate, loadData]);

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
                <div className="max-w-7xl mx-auto space-y-8">

                    {/* Welcome Banner */}
                    <div className="relative overflow-hidden bg-gradient-to-br from-primary to-amber-700 rounded-[2rem] p-8 md:p-12 text-white shadow-xl shadow-primary/10">
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-8 w-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                                    <TrendingUp className="h-4 w-4 text-white" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/90">Operational Overview</span>
                            </div>
                            <h2 className="text-3xl md:text-5xl font-black mb-2 tracking-tight">Today's Summary</h2>
                            <p className="text-white/80 font-medium max-w-xl text-sm md:text-base">
                                Welcome back, <span className="text-white font-bold">{user?.username || 'Counter'}</span>.
                                Here's how {branchInfo?.name || 'the branch'} is performing today.
                            </p>
                        </div>
                        {/* Decorative background elements */}
                        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 h-[400px] w-[400px] bg-white/10 rounded-full blur-[100px]" />
                        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 h-[300px] w-[300px] bg-white/5 rounded-full blur-[80px]" />
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard
                            title="Today's Sales"
                            value={`Rs.${(dashboardData?.today_sales || dashboardData?.total_sum || 0).toLocaleString()}`}
                            icon={Banknote}
                            trend={{ value: Number(Math.abs(dashboardData?.sales_percent || 0).toFixed(1)), isPositive: (dashboardData?.sales_percent || 0) >= 0 }}
                            className="bg-white border-2 border-slate-100 hover:border-primary/20 transition-all hover:shadow-xl rounded-3xl"
                        />
                        <StatCard
                            title="Total Orders"
                            value={dashboardData?.total_orders || dashboardData?.total_count_order || 0}
                            icon={ShoppingBag}
                            trend={{ value: Number(Math.abs(dashboardData?.order_percent || 0).toFixed(1)), isPositive: (dashboardData?.order_percent || 0) >= 0 }}
                            className="bg-white border-2 border-slate-100 hover:border-primary/20 transition-all hover:shadow-xl rounded-3xl"
                        />
                        <StatCard
                            title="Avg. Ticket"
                            value={`Rs.${dashboardData?.avg_orders || dashboardData?.average_order_value ? Number(dashboardData.avg_orders || dashboardData.average_order_value).toFixed(0) : 0}`}
                            icon={TrendingUp}
                            trend={{ value: Number(Math.abs(dashboardData?.avg_order_percent || 0).toFixed(1)), isPositive: (dashboardData?.avg_order_percent || 0) >= 0 }}
                            className="bg-white border-2 border-slate-100 hover:border-primary/20 transition-all hover:shadow-xl rounded-3xl"
                        />
                        <StatCard
                            title="Busiest Hour"
                            value={Array.isArray(dashboardData?.peak_hours) && dashboardData.peak_hours.length > 0 ? dashboardData.peak_hours.join(", ") : "—"}
                            icon={Clock}
                            subtitle="Peak performance time"
                            className="bg-white border-2 border-slate-100 hover:border-primary/20 transition-all hover:shadow-xl rounded-3xl"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Sales Trend Chart */}
                        <div className="lg:col-span-2 bg-white rounded-[2rem] border-2 border-slate-100 p-8 shadow-sm">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Sales Trend</h3>
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Revenue over time today</p>
                                </div>
                                <div className="h-10 w-10 rounded-2xl bg-slate-50 flex items-center justify-center">
                                    <TrendingUp className="h-5 w-5 text-slate-400" />
                                </div>
                            </div>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={dashboardData?.trend_chart || []}>
                                        <defs>
                                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="label" fontSize={10} fontWeight={800} axisLine={false} tickLine={false} dy={10} />
                                        <YAxis fontSize={10} fontWeight={800} axisLine={false} tickLine={false} tickFormatter={(v) => `Rs.${v}`} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', padding: '1rem' }}
                                            formatter={(v: any) => [`Rs.${Number(v).toLocaleString()}`, 'Sales']}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="sales"
                                            stroke="hsl(var(--primary))"
                                            strokeWidth={4}
                                            fill="url(#colorSales)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>                        {/* Today's Sales Breakdown */}
                        <div className="bg-white rounded-[2rem] border-2 border-slate-100 p-8 shadow-sm flex flex-col h-full min-h-[480px]">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Today's Sales</h3>
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                        {salesFilter === 'product' ? 'Performance by product' : salesFilter === 'category' ? 'Performance by category' : 'Performance by kitchen type'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" className="rounded-xl border-2 font-bold px-3 py-1.5 text-xs gap-1.5 flex items-center bg-stone-50 border-slate-200 hover:bg-slate-100 transition-all active:scale-95">
                                                {salesFilter === 'product' ? 'Products' : salesFilter === 'category' ? 'Categories' : 'Kitchen Types'}
                                                <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="rounded-xl p-1.5 min-w-[140px] font-bold z-[100]">
                                            <DropdownMenuItem onClick={() => setSalesFilter('product')} className="rounded-lg text-xs py-2 cursor-pointer">
                                                Products
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setSalesFilter('category')} className="rounded-lg text-xs py-2 cursor-pointer">
                                                Categories
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setSalesFilter('kitchentype')} className="rounded-lg text-xs py-2 cursor-pointer">
                                                Kitchen Types
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                                {salesLoading ? (
                                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400 h-full">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        <p className="text-xs font-bold uppercase tracking-widest">Loading sales...</p>
                                    </div>
                                ) : salesData.length > 0 ? (
                                    salesData.slice(0, 5).map((item: any, idx: number) => {
                                        let name = "Unknown";
                                        const qty = item.qty_sold || 0;
                                        const revenue = item.total_revenue || 0;

                                        if (salesFilter === 'product') {
                                            name = item.product__name || "Unknown Product";
                                        } else if (salesFilter === 'category') {
                                            name = item.product__category__name || "Unknown Category";
                                        } else if (salesFilter === 'kitchentype') {
                                            name = item.product__category__kitchentype__name || item.productcategorykitchentypename || "Unknown Kitchen Type";
                                        }

                                        return (
                                            <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-xl bg-white shadow-sm flex items-center justify-center font-black text-xs text-slate-400">
                                                        {idx + 1}
                                                    </div>
                                                    <span className="font-bold text-slate-700 group-hover:text-primary transition-colors line-clamp-1">{name}</span>
                                                </div>
                                                <div className="text-right flex flex-col items-end shrink-0">
                                                    <span className="text-[11px] font-black bg-white px-3 py-0.5 rounded-full text-slate-500 shadow-sm border border-slate-100">{qty} Sold</span>
                                                    <span className="text-xs font-black text-slate-900 mt-1">Rs. {Number(revenue).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center h-full">
                                        <p className="text-xs font-bold uppercase tracking-widest">No data available</p>
                                    </div>
                                )}
                            </div>
                            <Button variant="ghost" className="w-full mt-6 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-primary" onClick={() => navigate('/counter/pos')}>
                                View Menu
                            </Button>
                        </div>
                    </div>

                    {/* Recent Orders Section */}
                    <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 overflow-hidden shadow-sm">
                        <div className="p-8 border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Recent Activity</h3>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-1">Live transaction feed</p>
                            </div>
                            <Button
                                variant="outline"
                                className="rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 hover:bg-slate-50"
                                onClick={() => navigate('/counter/orders')}
                            >
                                View All Transactions
                                <ChevronRight className="ml-2 h-3 w-3" />
                            </Button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50">
                                    <tr>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Order ID</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Customer</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Time</th>
                                        <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Status</th>
                                        <th className="px-8 py-5 text-right text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {recentOrders.map((order) => (
                                        <tr
                                            key={order.id}
                                            className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                                            onClick={() => navigate('/counter/orders', { state: { orderId: order.id } })}
                                        >
                                            <td className="px-8 py-6">
                                                <span className="font-mono text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">#{order.invoice_number}</span>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center">
                                                        <User className="h-3.5 w-3.5 text-slate-400" />
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-700">{order.customer_name || 'Walk-in'}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className="text-xs font-bold text-slate-400">
                                                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6">
                                                <StatusBadge status={(order.payment_status || "PENDING").toLowerCase()} className="h-7 px-3 text-[10px] font-black" />
                                            </td>
                                            <td className="px-8 py-6 text-right font-black text-slate-900 text-lg">
                                                Rs.{parseFloat(order.total_amount).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                    {recentOrders.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-8 py-20 text-center">
                                                <div className="flex flex-col items-center gap-3 opacity-20">
                                                    <ShoppingBag className="h-12 w-12" />
                                                    <p className="text-sm font-black uppercase tracking-widest">No recent activity</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>

            {/* Mobile Footer Nav removed to use mobile sidebar layout instead */}
        </div>
    );
}
