import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Store,
    Users,
    DollarSign,
    TrendingUp,
    Search,
    Plus,
    MapPin,
    ArrowUpRight,
    MoreVertical,
    ExternalLink,
    Globe,
    Loader2,
    BarChart3,
    WifiOff,
    ShoppingBag,
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
import { useDashboardPolling } from "@/hooks/useDashboardPolling";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie,
    AreaChart,
    Area,
    LabelList,
    Legend
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { fetchBranches, createBranch, createUser, fetchDashboardDetails } from "../../api/index.js";

interface Branch {
    id: number;
    name: string;
    location: string;
    status?: string;
    branch_manager?: {
        id: number;
        username: string;
        email: string;
        total_user: number;
    } | null;
    revenue?: number;
}

const COLORS = ['hsl(32, 95%, 44%)', 'hsl(15, 70%, 50%)', 'hsl(142, 71%, 45%)', 'hsl(199, 89%, 48%)'];
const PAYMENT_COLORS = ['hsl(142, 71%, 45%)', 'hsl(217, 91%, 60%)', 'hsl(32, 95%, 44%)', 'hsl(280, 65%, 60%)', 'hsl(0, 84%, 60%)'];

const StatCard = ({ title, value, icon: Icon, subtitle, trend }: any) => (
    <div className="card-elevated p-6 space-y-2 border-2 border-slate-50">
        <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">{title}</h3>
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Icon className="h-4 w-4" />
            </div>
        </div>
        <div className="space-y-1">
            <p className="text-2xl font-black text-slate-900">{value}</p>
            {trend ? (
                <p className={cn("text-[10px] font-bold flex items-center gap-1", trend.isPositive ? "text-green-600" : "text-red-600")}>
                    {trend.isPositive ? "↑" : "↓"} {trend.value}% {subtitle || "growth"}
                </p>
            ) : subtitle ? (
                <p className="text-[10px] text-slate-400 font-bold">{subtitle}</p>
            ) : null}
        </div>
    </div>
);

export default function SuperAdminOverview() {
    const navigate = useNavigate();
    const [branches, setBranches] = useState<Branch[]>([]);
    const [dashboardData, setDashboardData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [pollingActive, setPollingActive] = useState(false);

    // Filter states
    const [timeframe, setTimeframe] = useState("monthly");
    const [dateRange, setDateRange] = useState<{ from: Date | undefined, to: Date | undefined }>({
        from: undefined,
        to: undefined
    });

    // Enhanced Form State
    const [form, setForm] = useState({
        name: "",
        location: "",
        showManager: false,
        manager_username: "",
        manager_full_name: "",
        manager_email: "",
        manager_phone: "",
    });

    // Poll dashboard data — runs immediately on mount, then every 30s.
    // Re-runs when timeframe or dateRange changes.
    useDashboardPolling(
        async () => {
            setPollingActive(true);
            await loadData();
            setTimeout(() => setPollingActive(false), 1000);
        },
        30000,
        [timeframe, dateRange]
    );

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
            const filters = getFilters();
            const [branchRes, dashboardRes] = await Promise.all([
                fetchBranches(),
                fetchDashboardDetails(null, filters)
            ]);

            const branchList = branchRes.data || [];
            const performanceData = dashboardRes.top_perfomance_branch || [];

            // Sync branch revenue with timeframe-aware data from dashboard summary
            const syncedBranches = branchList.map((branch: Branch) => {
                const performance = performanceData.find((p: any) => p.id === branch.id);
                return performance
                    ? { ...branch, revenue: performance.total_sales_per_branch }
                    : branch;
            });

            setBranches(syncedBranches);
            setDashboardData(dashboardRes);
        } catch (err: any) {
            toast.error(err.message || "Failed to load dashboard data");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateBranch = async () => {
        if (!form.name || !form.location) {
            toast.error("Please fill Name and Location");
            return;
        }
        if (form.showManager && (!form.manager_username || !form.manager_full_name || !form.manager_email)) {
            toast.error("Please provide all manager details");
            return;
        }

        setIsSubmitting(true);
        try {
            const branchRes = await createBranch({ name: form.name, location: form.location });
            const newBranchId = branchRes.data.id;

            if (form.showManager) {
                await createUser({
                    username: form.manager_username,
                    full_name: form.manager_full_name,
                    email: form.manager_email,
                    phone: form.manager_phone,
                    user_type: "BRANCH_MANAGER",
                    branch: newBranchId,
                    password: "amabakery@123"
                });
                toast.success("Branch and manager created successfully");
            } else {
                toast.success("Branch created successfully");
            }

            setIsAddOpen(false);
            setForm({ name: "", location: "", showManager: false, manager_username: "", manager_full_name: "", manager_email: "", manager_phone: "" });
            loadData();
        } catch (err: any) {
            toast.error(err.message || "Failed to create branch");
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredBranches = branches.filter(b =>
        b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.location.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAccessBranch = (branch: Branch) => {
        localStorage.setItem('selectedBranch', JSON.stringify({ id: branch.id, name: branch.name }));
        toast.success(`Accessing ${branch.name}`);
        navigate('/admin/dashboard');
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter text-slate-900">ENTERPRISE OVERVIEW</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <div className={cn("h-1.5 w-1.5 rounded-full bg-emerald-500", pollingActive && "animate-pulse")} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Enterprise Polling Active
                        </span>
                        <span className="text-slate-200 mx-2">|</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary capitaize">{timeframe} Snapshot</span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="h-11 rounded-xl border-2 font-bold px-4 border-slate-100 shadow-sm gap-2 bg-white">
                                <Filter className="h-4 w-4 text-primary" />
                                <span className="capitalize">{timeframe}</span>
                                <ChevronDown className="h-3 w-3 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl border-none shadow-2xl bg-white/95 backdrop-blur-xl">
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 py-1.5 font-black">Select Range</DropdownMenuLabel>
                            {["daily", "weekly", "monthly", "yearly"].map(t => (
                                <DropdownMenuItem key={t} onClick={() => setTimeframe(t)} className="rounded-xl font-bold text-sm cursor-pointer hover:bg-slate-50 py-3 capitalize">{t}</DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator className="bg-slate-100 my-1" />
                            <DropdownMenuItem onClick={() => setTimeframe("custom")} className="rounded-xl font-bold text-sm cursor-pointer hover:bg-slate-50 py-3 text-primary">Custom Range</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {timeframe === "custom" && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className={cn("h-11 rounded-xl border-2 font-bold px-4 border-slate-100 shadow-sm gap-2 bg-white", !dateRange.from && "text-muted-foreground")}>
                                    <CalendarIcon className="h-4 w-4" />
                                    {dateRange.from ? (dateRange.to ? `${format(dateRange.from, "MMM dd")} - ${format(dateRange.to, "MMM dd")}` : format(dateRange.from, "MMM dd")) : "Pick Dates"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-3xl overflow-hidden" align="end">
                                <Calendar mode="range" selected={{ from: dateRange.from, to: dateRange.to }} onSelect={(range: any) => setDateRange({ from: range?.from, to: range?.to })} numberOfMonths={2} className="p-4" />
                            </PopoverContent>
                        </Popover>
                    )}

                    <Button onClick={() => setIsAddOpen(true)} className="h-11 rounded-xl shadow-lg shadow-primary/20 px-6 font-bold gap-2">
                        <Plus className="h-4 w-4" /> NEW BRANCH
                    </Button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title={`${timeframe} Revenue`} value={`Rs.${(dashboardData?.total_sum || 0).toLocaleString()}`} icon={DollarSign} subtitle={`Global sales (${timeframe})`} />
                <StatCard title="Active Branches" value={dashboardData?.total_count_branch || branches.length} icon={Store} subtitle="Enterprise nodes" />
                <StatCard title="Total Staff" value={dashboardData?.total_user_count || 0} icon={Users} subtitle="Combined workforce" />
                <StatCard title={`${timeframe} Orders`} value={dashboardData?.total_count_order || 0} icon={ShoppingBag} subtitle={`Avg Order (${timeframe}): Rs.${dashboardData?.average_order_value?.toFixed(0) || 0}`} />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="card-elevated p-8">
                    <h3 className="text-lg font-black uppercase tracking-tight mb-6 text-center capitalize">{timeframe} Category Split</h3>
                    <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={(dashboardData?.total_sales_per_category || []).map((item: any) => ({ name: item.product__category__name, value: parseFloat(item.category_total_sales) }))}
                                layout="vertical"
                                margin={{ left: -30, right: 100, top: 0, bottom: 0 }}
                            >
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }}
                                    width={90}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}
                                    formatter={(v: any) => [`Rs.${Number(v).toLocaleString()}`, 'Sales']}
                                />
                                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={20}>
                                    {(dashboardData?.total_sales_per_category || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
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

                <div className="card-elevated p-8">
                    <h3 className="text-lg font-black uppercase tracking-tight mb-6 text-center capitalize">{timeframe} Payment Status</h3>
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={(dashboardData?.sales_by_status || []).map((p: any) => ({ name: (p.payment_status || 'Other').toLowerCase(), value: parseFloat(p.total_amount) }))}
                                    dataKey="value"
                                    innerRadius={50}
                                    outerRadius={70}
                                    paddingAngle={5}
                                    stroke="none"
                                >
                                    {(dashboardData?.sales_by_status || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <Tooltip formatter={(v: any) => [`Rs.${Number(v).toLocaleString()}`, 'Total']} />
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

                <div className="card-elevated p-8">
                    <h3 className="text-lg font-black uppercase tracking-tight mb-6 text-center capitalize">{timeframe} Payments</h3>
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={(dashboardData?.sales_by_payment_method || []).map((p: any) => ({ name: (p.payment_method || 'Other').toLowerCase(), value: parseFloat(p.total_amount) }))}
                                    dataKey="value"
                                    innerRadius={50}
                                    outerRadius={70}
                                    paddingAngle={5}
                                    stroke="none"
                                >
                                    {(dashboardData?.sales_by_payment_method || []).map((_: any, i: number) => <Cell key={i} fill={PAYMENT_COLORS[i % PAYMENT_COLORS.length]} />)}
                                </Pie>
                                <Tooltip formatter={(v: any) => [`Rs.${Number(v).toLocaleString()}`, 'Total']} />
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

            {/* Sales Trend */}
            <div className="card-elevated p-8">
                <h3 className="text-xl font-bold mb-8 capitalize">{timeframe} Sales Momentum</h3>
                <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dashboardData?.trend_chart || []}>
                            <defs>
                                <linearGradient id="colorSalesTrend" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700 }} tickFormatter={(v) => `Rs.${v}`} />
                            <Tooltip />
                            <Area type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={4} fill="url(#colorSalesTrend)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Branch Management Section */}
            <div className="card-elevated border-2 border-slate-50 overflow-hidden rounded-[2rem]">
                <div className="px-6 py-5 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
                    <h3 className="text-lg font-black uppercase tracking-tight">Active Branches</h3>
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input placeholder="Search locations..." className="pl-9 h-11 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                </div>

                {/* Mobile List View */}
                <div className="md:hidden divide-y divide-slate-100 bg-white">
                    {filteredBranches.map(branch => (
                        <div key={branch.id} className="p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                        <Store className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900">{branch.name}</p>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{branch.location}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Revenue</p>
                                    <p className="font-black text-primary">Rs.{(parseFloat(branch.revenue as any) || 0).toLocaleString()}</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Manager</p>
                                    <p className="text-xs font-bold text-slate-600 truncate max-w-[120px]">
                                        {branch.branch_manager?.username || "Not Assigned"}
                                    </p>
                                </div>
                                <Button
                                    size="sm"
                                    onClick={() => handleAccessBranch(branch)}
                                    className="h-9 px-5 rounded-xl font-black uppercase text-[10px] shadow-sm active:scale-95 transition-all"
                                >
                                    Access Branch <ExternalLink className="h-3 w-3 ml-2" />
                                </Button>
                            </div>
                        </div>
                    ))}
                    {filteredBranches.length === 0 && (
                        <div className="p-12 text-center">
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No branches found</p>
                        </div>
                    )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <tr>
                                <th className="px-6 py-4 text-left">Branch</th>
                                <th className="px-6 py-4 text-left">Manager</th>
                                <th className="px-6 py-4 text-right">Revenue</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {filteredBranches.map(branch => (
                                <tr key={branch.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><Store className="h-5 w-5" /></div>
                                            <div>
                                                <p className="font-bold text-slate-900">{branch.name}</p>
                                                <p className="text-xs text-slate-500">{branch.location}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 font-medium text-slate-600">{branch.branch_manager?.username || "Not Assigned"}</td>
                                    <td className="px-6 py-5 text-right font-black">Rs.{(parseFloat(branch.revenue as any) || 0).toLocaleString()}</td>
                                    <td className="px-6 py-5 text-right">
                                        <Button size="sm" onClick={() => handleAccessBranch(branch)} className="h-9 px-4 rounded-xl font-black uppercase text-[10px]">Access <ExternalLink className="h-3 w-3 ml-2" /></Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Branch Creation Dialog */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent className="sm:max-w-[500px] rounded-[2rem]">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black">Register New Branch</DialogTitle>
                        <DialogDescription>Initialize a new enterprise node and assign leadership.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Branch Name</Label>
                                <Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Bakery - KTM" className="h-12 rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Location</Label>
                                <Input value={form.location} onChange={(e) => setForm(p => ({ ...p, location: e.target.value }))} placeholder="City Center" className="h-12 rounded-xl" />
                            </div>
                        </div>

                        {!form.showManager ? (
                            <Button variant="outline" onClick={() => setForm(p => ({ ...p, showManager: true }))} className="w-full h-12 rounded-xl border-dashed border-2 font-bold text-slate-500"><Plus className="h-4 w-4 mr-2" /> Add Branch Manager</Button>
                        ) : (
                            <div className="space-y-4 p-4 rounded-2xl bg-primary/5 border-2 border-primary/10">
                                <div className="grid grid-cols-2 gap-4">
                                    <Input value={form.manager_username} onChange={(e) => setForm(p => ({ ...p, manager_username: e.target.value }))} placeholder="Username" className="h-11 rounded-lg bg-white" />
                                    <Input value={form.manager_full_name} onChange={(e) => setForm(p => ({ ...p, manager_full_name: e.target.value }))} placeholder="Full Name" className="h-11 rounded-lg bg-white" />
                                </div>
                                <Input value={form.manager_email} onChange={(e) => setForm(p => ({ ...p, manager_email: e.target.value }))} placeholder="Email Address" className="h-11 rounded-lg bg-white" />
                                <p className="text-[10px] text-center font-bold text-primary uppercase">Default Pass: amabakery@123</p>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsAddOpen(false)} className="h-12 font-bold">Cancel</Button>
                        <Button onClick={handleCreateBranch} disabled={isSubmitting} className="h-12 px-8 rounded-xl font-black uppercase text-[10px] shadow-lg shadow-primary/20">{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Authorize & Create"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Order Detail Dialog */}
            <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
                <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
                    {selectedOrder && (
                        <div className="flex flex-col">
                            <div className="bg-primary/5 p-8 text-center border-b font-black"><h2 className="text-2xl text-slate-900">Order {selectedOrder.invoice_number}</h2></div>
                            <div className="p-8 space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                                    <div><p>Status</p><StatusBadge status={selectedOrder.payment_status.toLowerCase()} /></div>
                                    <div className="text-right"><p>Time</p><p className="text-slate-900">{new Date(selectedOrder.created_at).toLocaleString()}</p></div>
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-4">
                                    <div className="border-t border-slate-200 mt-2 pt-2 flex justify-between"><span className="font-black text-slate-900 uppercase text-xs">Total</span><span className="text-xl font-black text-primary">Rs.{selectedOrder.total_amount?.toLocaleString()}</span></div>
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
