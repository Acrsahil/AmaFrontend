import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Store,
    Users,
    Banknote,
    TrendingUp,
    Search,
    Plus,
    MapPin,
    ArrowUpRight,
    Clock,
    MoreVertical,
    ExternalLink,
    Globe,
    Menu
} from "lucide-react";
import { branches, Branch, User, users } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SuperAdminSidebar } from "@/components/layout/SuperAdminSidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function SuperAdminDashboard() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState("");
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const filteredBranches = branches.filter(b =>
        b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.location.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalRevenue = branches.reduce((sum, b) => sum + b.revenue, 0);
    const totalStaff = branches.reduce((sum, b) => sum + b.staffCount, 0);
    const activeBranches = branches.filter(b => b.status === 'active').length;

    const handleAccessBranch = (branch: Branch) => {
        const branchAdmin = users.find(u => u.branchId === branch.id && u.role === 'admin');

        if (branchAdmin) {
            localStorage.setItem('currentUser', JSON.stringify(branchAdmin));
            toast.success(`Accessing ${branch.name} Admin Portal`, {
                description: `Logged in as ${branchAdmin.name}`,
            });
            navigate('/admin/dashboard');
        } else {
            toast.error("Access Denied", {
                description: "No admin account found for this branch.",
            });
        }
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Desktop Sidebar */}
            <aside className="fixed left-0 top-0 z-40 h-screen w-64 hidden md:block">
                <SuperAdminSidebar />
            </aside>

            {/* Mobile Header */}
            <div className="md:hidden sticky top-0 z-30 flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex items-center gap-3">
                    <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="mr-2">
                                <Menu className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="p-0 w-64 border-r-0">
                            <SuperAdminSidebar onNavigate={() => setSidebarOpen(false)} />
                        </SheetContent>
                    </Sheet>
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg overflow-hidden border border-primary/20 bg-white">
                            <img src="/logos/logo2brown.jpeg" alt="Ama Bakery" className="h-full w-full object-cover" />
                        </div>
                        <h1 className="font-bold text-base">Ama HQ</h1>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <main className="md:ml-64 p-4 md:p-6 lg:p-8 space-y-6 text-slate-900">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight">Enterprise Overview</h1>
                        <p className="text-sm md:text-base text-muted-foreground font-medium">Monitoring {branches.length} branches across the network.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-lg border text-sm">
                            <Clock className="h-4 w-4 text-primary" />
                            <span className="font-bold">Real-time Feed</span>
                        </div>
                        <Button className="gradient-warm text-white hover:opacity-90 h-11 px-6 rounded-xl font-black uppercase tracking-widest text-xs flex-1 sm:flex-none">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Branch
                        </Button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="card-elevated p-6 space-y-2 border-2 border-slate-50">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Network Revenue</h3>
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                <Banknote className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-2xl font-black">Rs. {(totalRevenue / 100000).toFixed(1)}L</p>
                            <p className="text-xs text-green-600 font-bold flex items-center gap-1">
                                <TrendingUp className="h-3 w-3" /> +12% from last month
                            </p>
                        </div>
                    </div>

                    <div className="card-elevated p-6 space-y-2 border-2 border-slate-50">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Active Branches</h3>
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                <Store className="h-4 w-4" />
                            </div>
                        </div>
                        <p className="text-2xl font-black text-slate-900">{activeBranches} / {branches.length}</p>
                    </div>

                    <div className="card-elevated p-6 space-y-2 border-2 border-slate-50">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total Workforce</h3>
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                <Users className="h-4 w-4" />
                            </div>
                        </div>
                        <p className="text-2xl font-black text-slate-900">{totalStaff} Staff</p>
                    </div>

                    <div className="card-elevated p-6 space-y-2 gradient-warm text-white border-none shadow-lg shadow-primary/20">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black uppercase tracking-widest opacity-80">Top Performer</h3>
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <p className="text-xl font-black truncate">Kathmandu Main</p>
                    </div>
                </div>

                {/* Branch Management */}
                <div className="card-elevated border-2 border-slate-50 overflow-hidden rounded-[2rem]">
                    <div className="px-6 py-5 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
                        <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Branch Management</h2>
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search branches..."
                                className="pl-9 h-11 bg-white border-slate-200 rounded-xl font-medium"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50/80 text-slate-400">
                                <tr>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest min-w-[200px]">Branch</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest">Status</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest">Manager</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest">Staff</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest">Revenue</th>
                                    <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredBranches.map((branch) => (
                                    <tr key={branch.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-5 cursor-pointer min-w-[200px]" onClick={() => handleAccessBranch(branch)}>
                                            <div className="flex items-center gap-3">
                                                <div className="h-11 w-11 rounded-xl bg-primary/5 flex items-center justify-center text-primary border border-primary/10 group-hover:bg-primary group-hover:text-white transition-all shrink-0">
                                                    <Store className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 group-hover:text-primary transition-colors truncate">{branch.name}</p>
                                                    <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                                                        <MapPin className="h-3 w-3" /> {branch.location}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <Badge className={cn(
                                                "font-black text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-full",
                                                branch.status === 'active'
                                                    ? 'bg-green-50 text-green-700 border border-green-100'
                                                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                                            )}>
                                                {branch.status}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-5 text-sm font-bold text-slate-600 whitespace-nowrap">{branch.manager}</td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className="flex -space-x-1.5 font-bold">
                                                    {[1, 2, 3].map(i => (
                                                        <div key={i} className="h-7 w-7 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] text-slate-400">
                                                            <Users className="h-3 w-3" />
                                                        </div>
                                                    ))}
                                                </div>
                                                <span className="text-[10px] font-black text-slate-400">+{branch.staffCount - 3}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right whitespace-nowrap">
                                            <p className="font-black text-slate-900">Rs. {branch.revenue.toLocaleString()}</p>
                                            <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest">Good Standing</p>
                                        </td>
                                        <td className="px-6 py-5 text-right whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleAccessBranch(branch)}
                                                    className="gradient-warm text-white hover:shadow-lg hover:shadow-primary/20 h-9 px-4 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all hover:scale-105 active:scale-95"
                                                >
                                                    Access
                                                    <ExternalLink className="h-3 w-3 ml-1.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-slate-100 text-slate-400">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Activity Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 card-elevated p-6 md:p-8 border-2 border-slate-50 rounded-[2.5rem]">
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-6">Recent Orders</h3>
                        <div className="space-y-6">
                            {[
                                { user: 'Rajdeep Sharma', action: 'Requested stock transfer for Kathmandu Main', time: '12 mins ago', icon: ArrowUpRight, color: 'text-blue-500', bg: 'bg-blue-50' },
                                { user: 'System', action: 'Daily revenue reports generated for 3 branches', time: '1 hour ago', icon: Globe, color: 'text-green-500', bg: 'bg-green-50' },
                                { user: 'Admin', action: 'New staff user added to Pokhara branch', time: '3 hours ago', icon: Users, color: 'text-orange-500', bg: 'bg-orange-50' },
                            ].map((log, i) => (
                                <div key={i} className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100">
                                    <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0", log.bg, log.color)}>
                                        <log.icon className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black text-slate-900">{log.user}</p>
                                        <p className="text-sm text-slate-500 font-medium leading-relaxed">{log.action}</p>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 mt-2">{log.time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="card-elevated gradient-warm p-8 text-white flex flex-col justify-between rounded-[2.5rem] shadow-xl shadow-primary/20 border-none min-h-[300px]">
                        <div className="space-y-4">
                            <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm border border-white/20">
                                <Plus className="h-7 w-7" />
                            </div>
                            <h3 className="text-2xl font-black leading-tight">Scale Your Business</h3>
                            <p className="text-sm font-medium opacity-90 leading-relaxed">Ready to expand? Set up a new enterprise branch node in seconds and monitor everything globally.</p>
                        </div>
                        <Button
                            className="w-full mt-10 bg-white text-primary hover:bg-white/90 h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            Add New Branch
                        </Button>
                    </div>
                </div>
            </main>
        </div>
    );
}
