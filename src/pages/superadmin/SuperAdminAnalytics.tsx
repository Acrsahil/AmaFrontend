import { useState, useEffect, useCallback } from "react";
import {
    BarChart3,
    TrendingUp,
    Users,
    ShoppingBag,
    Banknote,
    ArrowUpRight,
    Filter,
    Loader2,
    WifiOff,
    ChevronDown,
    Calendar as CalendarIcon,
    LayoutDashboard
} from "lucide-react";
import { useDashboardWebSocket } from "@/hooks/useDashboardWebSocket";
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    Legend
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchDashboardDetails } from "@/api/index.js";
import { toast } from "sonner";
import { format } from "date-fns";
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

// Apple-inspired Warm Palette
const COLORS = ["#d97706", "#b45309", "#92400e", "#78350f", "#451a03"];

export default function SuperAdminAnalytics() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [sseConnected, setSSEConnected] = useState(false);

    // Filter states
    const [timeframe, setTimeframe] = useState("daily");
    const [dateRange, setDateRange] = useState<{ from: Date | undefined, to: Date | undefined }>({
        from: undefined,
        to: undefined
    });

    // WebSocket: Real-time dashboard updates
    const handleWSUpdate = useCallback(() => {
        loadData();
    }, []);

    const { isConnected: wsConnected } = useDashboardWebSocket(null, handleWSUpdate);

    // Sync connection status to local state for UI
    useEffect(() => {
        setSSEConnected(wsConnected);
    }, [wsConnected]);

    useEffect(() => {
        loadData();
    }, [timeframe, dateRange]);

    const getFilters = () => {
        const params: any = { timeframe };
        if (timeframe === "custom" && dateRange.from && dateRange.to) {
            params.start_date = format(dateRange.from, "yyyy-MM-dd");
            params.end_date = format(dateRange.to, "yyyy-MM-dd");
        }
        return params;
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const dashboardData = await fetchDashboardDetails(null, getFilters());
            setData(dashboardData);
        } catch (error: any) {
            toast.error(error.message || "Failed to load analytics data");
        } finally {
            setLoading(false);
        }
    };

    if (loading && !data) {
        return (
            <div className="h-[70vh] w-full flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 animate-pulse">Synchronizing Enterprise Data</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-1000">
            {/* Header Section: Apple-style minimal layout */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase">Global Analytics</h1>
                        <div className={cn(
                            "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border flex items-center gap-1.5",
                            sseConnected ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                        )}>
                            <div className={cn("h-1 w-1 rounded-full", sseConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500 animate-pulse")} />
                            {sseConnected ? "Live Feed" : "Syncing..."}
                        </div>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Enterprise metrics for {timeframe} performance cycle</p>
                </div>

                <div className="flex items-center gap-3">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="h-11 rounded-2xl border-slate-200 bg-white shadow-sm hover:bg-slate-50 hover:text-primary transition-all font-bold px-5 gap-3">
                                <Filter className="h-4 w-4" />
                                <span className="capitalize">{timeframe} Period</span>
                                <ChevronDown className="h-3 w-3 opacity-30" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl border-slate-100 shadow-2xl">
                            {["daily", "weekly", "monthly", "yearly"].map(t => (
                                <DropdownMenuItem key={t} onClick={() => setTimeframe(t)} className="rounded-xl font-bold text-sm cursor-pointer hover:bg-slate-50 py-3 capitalize">{t} Insight</DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setTimeframe("custom")} className="rounded-xl font-bold text-sm cursor-pointer hover:bg-slate-50 py-3 text-primary">Custom Range</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {timeframe === "custom" && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className={cn("h-11 rounded-2xl border-slate-200 bg-white shadow-sm font-bold px-5 gap-3", !dateRange.from && "text-muted-foreground")}>
                                    <CalendarIcon className="h-4 w-4" />
                                    {dateRange.from ? (dateRange.to ? `${format(dateRange.from, "MMM dd")} - ${format(dateRange.to, "MMM dd")}` : format(dateRange.from, "MMM dd")) : "Pick Dates"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-3xl" align="end">
                                <Calendar mode="range" selected={{ from: dateRange.from, to: dateRange.to }} onSelect={(range: any) => setDateRange({ from: range?.from, to: range?.to })} numberOfMonths={2} className="p-4" />
                            </PopoverContent>
                        </Popover>
                    )}
                </div>
            </div>

            {/* Top Cards: Clean, High-Contrast */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Revenue"
                    value={`Rs. ${(data?.total_sum || 0).toLocaleString()}`}
                    subtitle={`Global ${timeframe} yield`}
                    icon={Banknote}
                    color="primary"
                />
                <StatCard
                    title="Total Orders"
                    value={(data?.total_count_order || 0).toLocaleString()}
                    subtitle="Universal volume"
                    icon={ShoppingBag}
                    color="blue"
                />
                <StatCard
                    title="Avg Order Value"
                    value={`Rs. ${data?.average_order_value?.toFixed(0) || 0}`}
                    subtitle="Ticket average"
                    icon={TrendingUp}
                    color="emerald"
                />
                <StatCard
                    title="Network Nodes"
                    value={data?.total_count_branch || 0}
                    subtitle="Active branches"
                    icon={Users}
                    color="violet"
                />
            </div>

            {/* Performance Grids */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Revenue Momentum: Clean Area Chart */}
                <Card className="lg:col-span-2 border-none shadow-[0_8px_40px_rgba(0,0,0,0.04)] rounded-[2.5rem] bg-white overflow-hidden uppercase">
                    <CardHeader className="p-8 pb-4">
                        <CardTitle className="text-xl font-black text-slate-900 tracking-tight">{timeframe} Growth Momentum</CardTitle>
                        <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue trajectory across the enterprise</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 pt-0 h-[380px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data?.trend_chart || []}>
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#d97706" stopOpacity={0.08} />
                                        <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} tickFormatter={(v) => `Rs.${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', padding: '16px' }}
                                    formatter={(v: any) => [`Rs. ${Number(v).toLocaleString()}`, 'Yield']}
                                />
                                <Area type="monotone" dataKey="sales" stroke="#d97706" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Sales Split: Clean Pie Chart with Legend */}
                <Card className="border-none shadow-[0_8px_40px_rgba(0,0,0,0.04)] rounded-[2.5rem] bg-white overflow-hidden uppercase">
                    <CardHeader className="p-8 pb-4 text-center">
                        <CardTitle className="text-xl font-black text-slate-900 tracking-tight">Category Yield</CardTitle>
                        <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue diversity metrics</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 pt-0 flex flex-col items-center">
                        <div className="h-[260px] w-full relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                                    <Pie
                                        data={(data?.total_sales_per_category || []).map((item: any) => ({
                                            name: item.product__category__name,
                                            value: parseFloat(item.category_total_sales)
                                        }))}
                                        innerRadius={65}
                                        outerRadius={85}
                                        paddingAngle={4}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {(data?.total_sales_per_category || []).map((_: any, index: number) => (
                                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(v: any) => [`Rs. ${Number(v).toLocaleString()}`, 'Sales']} />
                                    <Legend
                                        layout="horizontal"
                                        verticalAlign="bottom"
                                        align="center"
                                        content={({ payload }) => (
                                            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
                                                {payload?.map((entry: any, i: number) => (
                                                    <div key={i} className="flex items-center gap-1.5">
                                                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">{entry.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mb-12">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total</p>
                                <p className="text-xl font-black text-slate-900 leading-none mt-1">Rs.{(data?.total_sum || 0).toLocaleString()}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Secondary Intel Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Product Performance Table: Clean list */}
                <Card className="border-none shadow-[0_8px_40px_rgba(0,0,0,0.04)] rounded-[2.5rem] bg-white overflow-hidden uppercase">
                    <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-xl font-black text-slate-900 tracking-tight">Best Sellers</CardTitle>
                            <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global inventory pull</CardDescription>
                        </div>
                        <div className="h-10 w-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400">
                            <LayoutDashboard className="h-5 w-5" />
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 pt-0">
                        <div className="space-y-1">
                            {(data?.top_selling_items || []).map((item: any, i: number) => (
                                <div key={i} className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <span className="text-xs font-black text-slate-300">0{i + 1}</span>
                                        <span className="text-sm font-bold text-slate-800 capitalize">{item.product__name}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-sm font-black text-slate-900">{item.total_sold_units}</span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Units</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Branch Rankings: Clean Progress Matrix */}
                <Card className="border-none shadow-[0_8px_40px_rgba(0,0,0,0.04)] rounded-[2.5rem] bg-white overflow-hidden uppercase">
                    <CardHeader className="p-8 pb-4">
                        <CardTitle className="text-xl font-black text-slate-900 tracking-tight">Branch Matrix</CardTitle>
                        <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Regional performance contribution</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 pt-0 space-y-6">
                        {(data?.top_perfomance_branch || []).map((branch: any, i: number) => {
                            const maxVal = data?.top_perfomance_branch[0]?.total_sales_per_branch || 1;
                            const perc = (branch.total_sales_per_branch / maxVal) * 100;
                            return (
                                <div key={i} className="space-y-2.5">
                                    <div className="flex justify-between items-end">
                                        <span className="text-sm font-bold text-slate-800 capitalize">{branch.name}</span>
                                        <span className="text-xs font-black text-slate-900">Rs.{branch.total_sales_per_branch?.toLocaleString()}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${perc}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function StatCard({ title, value, subtitle, icon: Icon, color }: any) {
    const colorMap: any = {
        primary: "text-amber-600 bg-amber-50",
        blue: "text-blue-600 bg-blue-50",
        emerald: "text-emerald-600 bg-emerald-50",
        violet: "text-violet-600 bg-violet-50"
    };

    return (
        <Card className="border-none shadow-[0_8px_40px_rgba(0,0,0,0.03)] rounded-[2.5rem] bg-white hover:shadow-[0_8px_40px_rgba(0,0,0,0.06)] transition-all p-8 flex flex-col justify-between h-[200px] uppercase">
            <div className="flex justify-between items-start">
                <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center", colorMap[color])}>
                    <Icon className="h-5 w-5" />
                </div>
                <div className="px-3 py-1 rounded-full bg-slate-50 border border-slate-100 text-[9px] font-black text-slate-400 tracking-widest leading-none">
                    Metrics
                </div>
            </div>
            <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase">{title}</p>
                <p className="text-2xl font-black text-slate-900 tracking-tighter">{value}</p>
                <div className="flex items-center gap-1.5">
                    <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{subtitle}</p>
                </div>
            </div>
        </Card>
    );
}
