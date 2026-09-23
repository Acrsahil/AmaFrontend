import { useState, useEffect } from "react";
import {
    Users,
    Search,
    Plus,
    Mail,
    Phone,
    ShoppingBag,
    Calendar,
    ChevronRight,
    MoreVertical,
    Download,
    Filter,
    Eye,
    Loader2,
    Trash2
} from "lucide-react";
import { fetchCustomers, createCustomer, updateCustomer, deleteCustomer, fetchInvoicesByCustomer, fetchBranches, fetchCustomerDetail } from "../../api/index.js";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { getCurrentUser } from "@/auth/auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// Define interface matching local needs but populated from API
interface Customer {
    id: number;
    name: string;
    email: string;
    phone: string;
    address: string;
    totalOrders: number;
    totalSpent: number;
    lastOrderDate: string;
    branch: number;
}

export default function AdminCustomers() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [branchFilter, setBranchFilter] = useState<string>("all");
    const [sortBy, setSortBy] = useState<string>("default");
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [nextUrl, setNextUrl] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [editing, setEditing] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [salesHistory, setSalesHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const currentUser = getCurrentUser();
    const branchId = currentUser?.branch_id ?? null;
    // Edit Customer State
    const [editCustomer, setEditCustomer] = useState<{
        name: string;
        email: string;
        phone: string;
        address: string;
    } | null>(null);

    const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<string>("");

    // New Customer State
    const [newCustomer, setNewCustomer] = useState({
        name: "",
        email: "",
        phone: "",
        address: ""
    });

    useEffect(() => {
        loadCustomers();
        if ((currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN') && !branchId) {
            loadBranches();
        }
    }, [branchId]);

    const loadBranches = async () => {
        try {
            const res = await fetchBranches();
            setBranches(res.data || []);
        } catch (err) {
            console.error("Failed to load branches", err);
        }
    };

    const mapCustomerData = (c: any): Customer => {
        const invoices = c.invoice || [];
        const totalSpent = invoices.reduce((sum: number, inv: any) => sum + (parseFloat(inv.total_amount) || 0), 0);

        return {
            id: c.id,
            name: c.name,
            email: c.email || "N/A",
            phone: c.phone || "N/A",
            address: c.address || "",
            totalOrders: invoices.length,
            totalSpent: totalSpent,
            lastOrderDate: c.created_at ? new Date(c.created_at).toLocaleDateString() : "N/A",
            branch: c.branch
        };
    };

    const loadCustomers = async () => {
        setLoading(true);
        try {
            const data = await fetchCustomers();
            const customersData = data.results !== undefined ? data.results : (Array.isArray(data) ? data : []);

            setNextUrl(data.next || null);

            // Map API data to our interface, providing defaults for missing fields
            const mapped: Customer[] = customersData.map(mapCustomerData);

            const scoped =
                branchId != null ? mapped.filter((c) => c.branch === branchId) : mapped;

            setCustomers(scoped);
        } catch (err: any) {
            toast.error(err.message || "Failed to load customers");
        } finally {
            setLoading(false);
        }
    };

    const loadMoreCustomers = async () => {
        if (!nextUrl) return;
        setLoadingMore(true);
        try {
            const data = await fetchCustomers({}, nextUrl);
            const customersData = data.results !== undefined ? data.results : (Array.isArray(data) ? data : []);

            setNextUrl(data.next || null);

            const mapped: Customer[] = customersData.map(mapCustomerData);

            const scoped =
                branchId != null ? mapped.filter((c) => c.branch === branchId) : mapped;

            setCustomers((prev) => [...prev, ...scoped]);
        } catch (err: any) {
            toast.error(err.message || "Failed to load more customers");
        } finally {
            setLoadingMore(false);
        }
    };
    const loadCustomerHistory = async (id: number) => {
        setLoadingHistory(true);
        try {
            // As per the user's requirement, we use the customer detail endpoint which returns the invoice array
            const data = await fetchCustomerDetail(id);
            setSalesHistory(data.invoice || []);
            
            // Optionally update selected customer with latest data if it's different from the list view
            if (selectedCustomer && selectedCustomer.id === id) {
                setSelectedCustomer(prev => prev ? { 
                    ...prev, 
                    email: data.email || prev.email,
                    phone: data.phone || prev.phone,
                    address: data.address || prev.address
                } : null);
            }
        } catch (err: any) {
            console.error("Failed to load customer history:", err);
            toast.error("Failed to load sales history");
        } finally {
            setLoadingHistory(false);
        }
    };

    const validateEmail = (email: string) => {
        if (!email) return true; // Email is optional
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    };

    const handleCustomerClick = (customer: Customer) => {
        setSelectedCustomer(customer);
        loadCustomerHistory(customer.id);
    };

    const handleCreateCustomer = async () => {
        if (!newCustomer.name || !newCustomer.phone) {
            toast.error("Name and Phone are required");
            return;
        }

        // If SuperAdmin/Admin at HQ, branch selection is required
        if ((currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN') && !branchId && !selectedBranchId) {
            toast.error("Please select a branch");
            return;
        }

        if (newCustomer.email && !validateEmail(newCustomer.email)) {
            toast.error("Please enter a valid email address");
            return;
        }

        setCreating(true);
        try {
            const payload: any = { ...newCustomer };
            if (branchId) {
                payload.branch = branchId;
            } else if (selectedBranchId) {
                payload.branch = parseInt(selectedBranchId);
            }

            await createCustomer(payload);
            toast.success("Customer created successfully");
            setIsAddModalOpen(false);
            setNewCustomer({ name: "", email: "", phone: "", address: "" }); // Reset form
            setSelectedBranchId(""); // Reset branch selection
            loadCustomers(); // Refresh list
        } catch (err: any) {
            toast.error(err.message || "Failed to create customer");
        } finally {
            setCreating(false);
        }
    };

    const handleEditCustomer = async () => {
        if (!selectedCustomer || !editCustomer) return;

        if (!editCustomer.name || !editCustomer.phone) {
            toast.error("Name and Phone are required");
            return;
        }

        if (editCustomer.email && !validateEmail(editCustomer.email)) {
            toast.error("Please enter a valid email address");
            return;
        }

        setEditing(true);
        try {
            await updateCustomer(selectedCustomer.id, editCustomer);
            toast.success("Customer updated successfully");
            setIsEditMode(false);
            setEditCustomer(null);
            loadCustomers(); // Refresh list
        } catch (err: any) {
            toast.error(err.message || "Failed to update customer");
        } finally {
            setEditing(false);
        }
    };

    const handleDeleteCustomer = async (id: number) => {
        if (!confirm("Are you sure you want to delete this customer? This action cannot be undone.")) return;

        setDeleting(true);
        try {
            await deleteCustomer(id);
            toast.success("Customer deleted successfully");
            setSelectedCustomer(null); // Close sheet
            loadCustomers(); // Refresh list
        } catch (err: any) {
            toast.error(err.message || "Failed to delete customer");
        } finally {
            setDeleting(false);
        }
    };

    const displayCustomers = [...customers]
        .filter(c => {
            const matchesSearch =
                c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.phone.includes(searchTerm);

            const matchesBranch = branchFilter === 'all' || String(c.branch) === branchFilter;

            return matchesSearch && matchesBranch;
        })
        .sort((a, b) => {
            if (sortBy === 'max_spent') return b.totalSpent - a.totalSpent;
            if (sortBy === 'max_orders') return b.totalOrders - a.totalOrders;
            if (sortBy === 'newest') return b.id - a.id;
            return 0;
        });

    const handleExport = () => {
        try {
            const exportData = displayCustomers.map(customer => ({
                'Customer Name': customer.name,
                'Email': customer.email || 'N/A',
                'Phone': customer.phone || 'N/A',
                'Address': customer.address || 'N/A',
                'Total Orders': customer.totalOrders,
                'Total Spent': `Rs. ${customer.totalSpent}`,
                'Last Order Date': customer.lastOrderDate
            }));

            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");

            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const data = new Blob([excelBuffer], { type: 'application/octet-stream' });
            saveAs(data, `Customers_Report_${new Date().toISOString().split('T')[0]}.xlsx`);

            toast.success("Customer data exported successfully!");
        } catch (error) {
            console.error("Export failed:", error);
            toast.error("Failed to export customers.");
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Customers</h1>
                    <p className="text-xs sm:text-sm text-muted-foreground">Manage your customer database and purchase history.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="hidden sm:flex h-9 sm:h-10" onClick={handleExport} disabled={displayCustomers.length === 0}>
                        <Download className="h-4 w-4 mr-2" />
                        Export
                    </Button>
                    <Button onClick={() => setIsAddModalOpen(true)} className="bg-primary hover:bg-primary/90 h-9 sm:h-10 text-xs sm:text-sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Customer
                    </Button>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border border-border shadow-sm">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name, email or phone..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    {(currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN') && !branchId && (
                        <Select value={branchFilter} onValueChange={setBranchFilter}>
                            <SelectTrigger className="w-full md:w-40">
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="All Branches" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Branches</SelectItem>
                                {branches.map((b) => (
                                    <SelectItem key={b.id} value={b.id.toString()}>
                                        {b.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <div className="h-8 w-[1px] bg-border hidden md:block mx-2" />

                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-full md:w-44 h-10 sm:h-11">
                            <span className="text-muted-foreground mr-2 text-xs sm:text-sm">Sort:</span>
                            <SelectValue placeholder="Default" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="default">Default (Recent)</SelectItem>
                            <SelectItem value="max_spent">Most Spent</SelectItem>
                            <SelectItem value="max_orders">Most Orders</SelectItem>
                            <SelectItem value="newest">Newest First</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="h-8 w-[1px] bg-border hidden md:block mx-2" />
                    <p className="text-sm text-muted-foreground whitespace-nowrap">
                        Showing <span className="font-medium text-foreground">{displayCustomers.length}</span> customers
                    </p>
                </div>
            </div>

            {/* Customer Table */}
            <div className="card-elevated p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/40 text-muted-foreground uppercase text-xs font-semibold">
                            <tr>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4">Contact</th>
                                <th className="px-6 py-4">Total Orders</th>
                                <th className="px-6 py-4">Total Spent</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                                        Loading customers...
                                    </td>
                                </tr>
                            ) : displayCustomers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                                        No customers found.
                                    </td>
                                </tr>
                            ) : (
                                displayCustomers.map((customer) => (
                                    <tr
                                        key={customer.id}
                                        className="hover:bg-muted/30 transition-colors group cursor-pointer"
                                        onClick={() => handleCustomerClick(customer)}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs sm:text-sm">
                                                    {customer.name && customer.name.length > 0 ? customer.name.charAt(0).toUpperCase() : '?'}
                                                </div>
                                                <span className="font-semibold text-foreground text-xs sm:text-sm">{customer.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col text-xs space-y-1">
                                                {customer.email !== "N/A" && (
                                                    <span className="text-foreground flex items-center gap-1">
                                                        <Mail className="h-3 w-3 text-muted-foreground" /> {customer.email}
                                                    </span>
                                                )}
                                                {customer.phone !== "N/A" && (
                                                    <span className="text-muted-foreground flex items-center gap-1">
                                                        <Phone className="h-3 w-3 text-muted-foreground" /> {customer.phone}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                                                {customer.totalOrders}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-foreground">
                                            Rs.{customer.totalSpent.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground truncate">
                                            <StatusBadge status="active" />
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                )))}
                        </tbody>
                    </table>
                </div>
                {nextUrl && (
                    <div className="p-4 border-t border-border flex justify-center">
                        <Button
                            variant="outline"
                            onClick={loadMoreCustomers}
                            disabled={loadingMore}
                            className="bg-card w-full max-w-xs"
                        >
                            {loadingMore ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Loading...
                                </>
                            ) : (
                                "Load More"
                            )}
                        </Button>
                    </div>
                )}
            </div>

            {/* Customer Detail Sheet */}
            <Sheet open={!!selectedCustomer} onOpenChange={() => {
                setSelectedCustomer(null);
                setIsEditMode(false);
                setEditCustomer(null);
            }}>
                <SheetContent className="sm:max-w-xl overflow-y-auto">
                    {selectedCustomer && (
                        <div className="space-y-8 py-6">
                            <SheetHeader>
                                <div className="flex items-center gap-4 mb-2">
                                    <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl sm:text-2xl">
                                        {selectedCustomer.name && selectedCustomer.name.length > 0 ? selectedCustomer.name.charAt(0).toUpperCase() : '?'}
                                    </div>
                                    <div>
                                        <SheetTitle className="text-xl sm:text-2xl">{selectedCustomer.name}</SheetTitle>
                                        <SheetDescription className="text-xs sm:text-sm">{selectedCustomer.email}</SheetDescription>
                                    </div>
                                </div>
                            </SheetHeader>

                            {/* Quick Stats */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-muted/50 p-4 sm:p-6 rounded-xl text-center">
                                    <p className="text-[10px] sm:text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Total Revenue</p>
                                    <p className="font-bold text-xl sm:text-2xl text-foreground">Rs.{selectedCustomer.totalSpent.toLocaleString()}</p>
                                </div>
                                <div className="bg-muted/50 p-4 sm:p-6 rounded-xl text-center">
                                    <p className="text-[10px] sm:text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Orders</p>
                                    <p className="font-bold text-xl sm:text-2xl text-foreground">{selectedCustomer.totalOrders}</p>
                                </div>
                            </div>

                            {/* Contact Info */}
                            <div className="space-y-4">
                                <h4 className="font-semibold flex items-center gap-2 text-foreground">
                                    <Users className="h-4 w-4 text-primary" />
                                    Contact Information
                                </h4>
                                {isEditMode ? (
                                    <div className="grid gap-4 p-4 border border-border rounded-xl bg-card">
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-muted-foreground">Full Name <span className="text-red-500">*</span></label>
                                            <Input
                                                value={editCustomer?.name || ""}
                                                onChange={(e) => setEditCustomer(prev => prev ? { ...prev, name: e.target.value } : null)}
                                                placeholder="Customer name"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-muted-foreground">Email</label>
                                            <Input
                                                type="email"
                                                value={editCustomer?.email || ""}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    const filtered = value.replace(/[^a-zA-Z0-9@._-]/g, "");
                                                    setEditCustomer(prev => prev ? { ...prev, email: filtered } : null);
                                                }}
                                                placeholder="email@example.com"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-muted-foreground">Phone <span className="text-red-500">*</span></label>
                                            <Input
                                                value={editCustomer?.phone || ""}
                                                onChange={(e) => {
                                                    const onlyNumbers = e.target.value.replace(/\D/g, "");
                                                    setEditCustomer(prev => prev ? { ...prev, phone: onlyNumbers } : null);
                                                }}
                                                placeholder="Phone number"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-muted-foreground">Address</label>
                                            <Input
                                                value={editCustomer?.address || ""}
                                                onChange={(e) => setEditCustomer(prev => prev ? { ...prev, address: e.target.value } : null)}
                                                placeholder="Customer address"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid gap-3 p-4 border border-border rounded-xl bg-card">
                                        <div className="flex items-center gap-3 text-sm">
                                            <Mail className="h-4 w-4 text-primary/70" />
                                            <span>{selectedCustomer.email}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                            <Phone className="h-4 w-4 text-primary/70" />
                                            <span>{selectedCustomer.phone}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                            <Users className="h-4 w-4 text-primary/70" />
                                            <span>Active Customer</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {/* Sales History */}
                            <div className="space-y-4">
                                <h4 className="font-semibold flex items-center gap-2 text-foreground">
                                    <ShoppingBag className="h-4 w-4 text-primary" />
                                    Sales History
                                </h4>
                                <div className="border border-border rounded-xl bg-card overflow-hidden">
                                    {loadingHistory ? (
                                        <div className="p-8 text-center">
                                            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-muted-foreground" />
                                            <p className="text-xs text-muted-foreground">Fetching history...</p>
                                        </div>
                                    ) : salesHistory.length === 0 ? (
                                        <div className="p-8 text-center">
                                            <p className="text-sm text-muted-foreground">No purchase history found.</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-border">
                                            {salesHistory.map((invoice) => (
                                                <div key={invoice.id} className="p-4 hover:bg-muted/30 transition-colors">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="font-bold text-sm text-foreground">
                                                            {invoice.invoice_number || `#INV-${invoice.id}`}
                                                        </span>
                                                        <span className="font-black text-sm text-primary">
                                                            Rs.{parseFloat(invoice.total_amount || "0").toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-[11px]">
                                                        <div className="flex items-center gap-2 text-muted-foreground">
                                                            <Calendar className="h-3 w-3" />
                                                            {invoice.created_at ? new Date(invoice.created_at).toLocaleDateString() : "Date N/A"}
                                                        </div>
                                                        <StatusBadge
                                                            status={invoice.payment_status?.toLowerCase() || "pending"}
                                                            className="h-5 px-1.5 text-[9px]"
                                                            label={
                                                                (invoice.payment_status?.toLowerCase() || '') === 'creadit'
                                                                    ? `Credited by ${invoice.received_by_counter_name || invoice.received_by_waiter_name || invoice.created_by_name || 'User'}`
                                                                    : (invoice.payment_status?.toLowerCase() || '') === 'waiter received'
                                                                    ? `Received by ${invoice.received_by_waiter_name || 'Waiter'}`
                                                                    : undefined
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                {isEditMode ? (
                                    <>
                                        <Button
                                            variant="outline"
                                            className="flex-1"
                                            onClick={() => {
                                                setIsEditMode(false);
                                                setEditCustomer(null);
                                            }}
                                            disabled={editing}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            className="flex-1 shadow-md"
                                            onClick={handleEditCustomer}
                                            disabled={editing}
                                        >
                                            {editing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                            {editing ? "Saving..." : "Save Changes"}
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button
                                            className="flex-1 shadow-md"
                                            onClick={() => {
                                                setIsEditMode(true);
                                                setEditCustomer({
                                                    name: selectedCustomer.name,
                                                    email: selectedCustomer.email,
                                                    phone: selectedCustomer.phone,
                                                    address: selectedCustomer.address
                                                });
                                            }}
                                        >
                                            Edit Profile
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                                            onClick={() => selectedCustomer && handleDeleteCustomer(selectedCustomer.id)}
                                            disabled={deleting}
                                        >
                                            {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                            {deleting ? "Deleting..." : "Delete Customer"}
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            {/* Add Customer Modal (Static UI) */}
            <Sheet open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <SheetContent side="right" className="sm:max-w-md">
                    <SheetHeader>
                        <SheetTitle>Add New Customer</SheetTitle>
                        <SheetDescription>Create a new profile to track customer orders and history.</SheetDescription>
                    </SheetHeader>
                    <div className="space-y-6 py-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Full Name <span className="text-red-500">*</span></label>
                                <Input
                                    placeholder="John Doe"
                                    value={newCustomer.name}
                                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Email Address</label>
                                <Input
                                    type="email"
                                    placeholder="john@example.com"
                                    value={newCustomer.email}
                                    onChange={(e) => {
                                        const value = e.target.value;

                                        // allow only valid email pattern characters
                                        const filtered = value.replace(/[^a-zA-Z0-9@._-]/g, "");

                                        setNewCustomer({ ...newCustomer, email: filtered });
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Phone Number <span className="text-red-500">*</span></label>
                                <Input
                                    placeholder="+977 98XXXXXXX"
                                    value={newCustomer.phone}
                                    onChange={(e) => {
                                        const onlyNumbers = e.target.value.replace(/\D/g, "");
                                        setNewCustomer({ ...newCustomer, phone: onlyNumbers });
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Address (Optional)</label>
                                <Input
                                    placeholder="Enter street address"
                                    value={newCustomer.address}
                                    onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                                />
                            </div>

                            {/* Branch Selection for Admins at HQ */}
                            {(currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN') && !branchId && (
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Assign to Branch <span className="text-red-500">*</span></Label>
                                    <Select
                                        value={selectedBranchId}
                                        onValueChange={setSelectedBranchId}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select a branch" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {branches.map((b) => (
                                                <SelectItem key={b.id} value={b.id.toString()}>
                                                    {b.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3 pt-4">
                            <Button variant="outline" className="flex-1" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                            <Button className="flex-1" onClick={handleCreateCustomer} disabled={creating}>
                                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                {creating ? "Saving..." : "Save Customer"}
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
