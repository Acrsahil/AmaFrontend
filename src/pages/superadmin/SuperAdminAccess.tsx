import { useState, useEffect } from "react";
import {
    Users,
    Key,
    Plus,
    Search,
    Pencil,
    Trash2,
    Loader2,
    Store,
    LayoutGrid,
    Mail,
    User
} from "lucide-react";
import { fetchUsers, createUser, updateUser, deleteUser, fetchBranches } from "../../api/index.js";
import { ResetPasswordModal } from "../../components/auth/ResetPasswordModal";
import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface Branch {
    id: number;
    name: string;
    location: string;
}

interface UserData {
    id: string;
    username: string;
    full_name: string;
    user_type: string;
    email: string;
    phone?: string;
    branch_name?: string;
    branch?: number;
}

export default function SuperAdminAccess() {
    const [usersList, setUsersList] = useState<UserData[]>([]);
    const [branchesList, setBranchesList] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [editUser, setEditUser] = useState<UserData | null>(null);
    const [resetTargetUser, setResetTargetUser] = useState<UserData | null>(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<UserData | null>(null);
    const [submitting, setSubmitting] = useState(false);


    const [form, setForm] = useState({
        full_name: "",
        username: "",
        email: "",
        phone: "",
        password: "amabakery@123",
        user_type: "BRANCH_MANAGER",
        branch: ""
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [usersData, branchesData] = await Promise.all([
                fetchUsers(),
                fetchBranches()
            ]);
            setUsersList(usersData.filter((u: any) => u.user_type === 'BRANCH_MANAGER' || u.user_type === 'ADMIN'));
            setBranchesList(branchesData.data || []);
        } catch (err: any) {
            toast.error("Failed to load data", { description: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAdd = () => {
        setEditUser(null);
        setForm({
            full_name: "",
            username: "",
            email: "",
            phone: "",
            password: "amabakery@123",
            user_type: "BRANCH_MANAGER",
            branch: ""
        });
        setIsDialogOpen(true);
    };

    const handleOpenEdit = (user: UserData) => {
        setEditUser(user);
        setForm({
            full_name: user.full_name || "",
            username: user.username || "",
            email: user.email || "",
            phone: user.phone || "",
            password: "",
            user_type: user.user_type,
            branch: user.branch?.toString() || ""
        });
        setIsDialogOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        const payload: any = {
            full_name: form.full_name,
            username: form.username,
            email: form.email,
            phone: form.phone,
            user_type: form.user_type,
            branch: form.branch ? parseInt(form.branch) : null
        };

        // If it's a new user and no password provided, use the default
        if (!editUser && !form.password) {
            payload.password = "amabakery@123";
        } else if (form.password) {
            payload.password = form.password;
        }

        try {
            if (editUser) {
                await updateUser(editUser.id, payload);
                toast.success("Manager updated successfully");
            } else {
                await createUser(payload);
                toast.success("Manager created successfully");
            }
            setIsDialogOpen(false);
            loadData();
        } catch (err: any) {
            toast.error("Operation failed", { description: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!userToDelete) return;

        try {
            await deleteUser(userToDelete.id);
            toast.success("Manager deleted");
            setIsDeleteOpen(false);
            setUserToDelete(null);
            loadData();
        } catch (err: any) {
            toast.error("Delete failed", { description: err.message });
        }
    };

    const filteredUsers = usersList.filter(u =>
        (u.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.username || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase mb-2">Admin Access & Security</h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Manage privilege levels and secure access for branch managers.</p>
                </div>
                <Button
                    onClick={handleOpenAdd}
                    className="w-full md:w-auto h-12 px-10 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20 transition-all active:scale-95"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    New Manager
                </Button>
            </div>

            <div className="card-elevated border-none shadow-[0_8px_40px_rgba(0,0,0,0.04)] rounded-[2.5rem] bg-white overflow-hidden">
                <div className="p-6 md:p-8 flex flex-col sm:flex-row gap-4 bg-slate-50/30 border-b border-slate-100">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search by name or username..."
                            className="pl-11 h-12 bg-white border-slate-200 rounded-2xl shadow-sm focus-visible:ring-primary/20"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="min-h-[400px]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-32 gap-4">
                            <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Synchronizing access logs</p>
                        </div>
                    ) : (
                        <>
                            {/* Mobile List View */}
                            <div className="md:hidden divide-y divide-slate-100 uppercase">
                                {filteredUsers.map((user) => (
                                    <div
                                        key={user.id}
                                        className="p-6 space-y-5 active:bg-slate-50 transition-colors"
                                        onClick={() => handleOpenEdit(user)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-primary font-black text-lg">
                                                    {(user.full_name || user.username).charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-900 tracking-tight leading-none mb-1.5">{user.full_name || "Manager"}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold tracking-wider lowercase">{user.email || "No email"}</p>
                                                </div>
                                            </div>
                                            <Badge className={cn(
                                                "font-black text-[8px] uppercase tracking-widest px-2.5 py-1 rounded-full border-none shadow-sm",
                                                user.user_type === 'ADMIN' ? "bg-primary text-white" : "bg-orange-50 text-orange-600"
                                            )}>
                                                {user.user_type === 'ADMIN' ? "Admin" : "Manager"}
                                            </Badge>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 pt-1">
                                            <div>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Branch</p>
                                                <div className="flex items-center gap-1.5 font-bold text-slate-600 text-xs">
                                                    <Store className="h-3 w-3 text-slate-400" />
                                                    {user.branch_name || 'Global HQ'}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Username</p>
                                                <p className="text-xs font-mono text-slate-500 lowercase">@{user.username}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-2">
                                            <Button
                                                variant="outline"
                                                className="h-10 rounded-xl border-slate-200 bg-white shadow-sm text-[9px] font-black uppercase tracking-widest px-5 active:scale-95 transition-all text-slate-600"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setResetTargetUser(user);
                                                    setIsResetModalOpen(true);
                                                }}
                                            >
                                                Reset Password
                                            </Button>
                                            {user.user_type !== 'ADMIN' && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-10 w-10 rounded-xl text-slate-300 active:text-red-500 active:bg-red-50 transition-all"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setUserToDelete(user);
                                                        setIsDeleteOpen(true);
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-x-auto uppercase">
                                <table className="w-full">
                                    <thead className="bg-slate-50/50 text-slate-400 border-b border-slate-100">
                                        <tr>
                                            <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest">Administrator</th>
                                            <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest">Role</th>
                                            <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest">Assigned Node</th>
                                            <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest">Global Alias</th>
                                            <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest">Security</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 bg-white">
                                        {filteredUsers.map((user) => (
                                            <tr
                                                key={user.id}
                                                className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                                                onClick={() => handleOpenEdit(user)}
                                            >
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-10 w-10 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-primary font-black group-hover:scale-110 transition-transform">
                                                            {(user.full_name || user.username).charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-slate-900 tracking-tight leading-none mb-1.5">{user.full_name || "Manager"}</p>
                                                            <p className="text-[10px] text-slate-400 font-bold tracking-wider lowercase">{user.email || "No email"}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <Badge className={cn(
                                                        "font-black text-[9px] uppercase tracking-widest px-3 py-1 rounded-full border-none shadow-sm",
                                                        user.user_type === 'ADMIN' ? "bg-primary text-white" : "bg-orange-50 text-orange-600"
                                                    )}>
                                                        {user.user_type === 'ADMIN' ? "Super Admin" : "Branch Manager"}
                                                    </Badge>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-2 text-xs text-slate-600 font-bold">
                                                        <Store className="h-3.5 w-3.5 text-slate-300" />
                                                        {user.branch_name || 'Global HQ'}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <span className="font-mono text-xs text-slate-400 lowercase italic">@{user.username}</span>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <div className="flex items-center justify-end gap-3 transition-all duration-300">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-9 px-4 text-[9px] font-black uppercase tracking-widest border-slate-200 text-slate-600 hover:bg-white hover:text-primary hover:border-primary/20 shadow-sm rounded-xl transition-all"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setResetTargetUser(user);
                                                                setIsResetModalOpen(true);
                                                            }}
                                                        >
                                                            Reset Password
                                                        </Button>
                                                        {user.user_type !== 'ADMIN' && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-9 w-9 rounded-xl hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setUserToDelete(user);
                                                                    setIsDeleteOpen(true);
                                                                }}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <ResetPasswordModal
                isOpen={isResetModalOpen}
                onClose={() => {
                    setIsResetModalOpen(false);
                    setResetTargetUser(null);
                }}
                user={resetTargetUser}
            />


            {/* Manager Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[425px] rounded-[2.5rem] border-none shadow-2xl p-8">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black text-slate-900 tracking-tighter uppercase mb-1">
                            {editUser ? 'Modify Access' : 'New Assignment'}
                        </DialogTitle>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Administrative credential configuration</p>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="grid gap-5 py-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Full Name</Label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    value={form.full_name}
                                    onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                                    placeholder="e.g. Rajdeep Sharma"
                                    className="pl-11 h-12 rounded-2xl border-slate-200 focus-visible:ring-primary/20 shadow-sm"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Username</Label>
                                <Input
                                    value={form.username}
                                    onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                                    placeholder="rajdeep_mgr"
                                    className="h-12 rounded-2xl border-slate-200 focus-visible:ring-primary/20 shadow-sm"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Phone no.</Label>
                                <Input
                                    value={form.phone}
                                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                                    placeholder="98XXXXXXXX"
                                    className="h-12 rounded-2xl border-slate-200 focus-visible:ring-primary/20 shadow-sm"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    type="email"
                                    value={form.email}
                                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                    placeholder="raj@ama.com"
                                    className="pl-11 h-12 rounded-2xl border-slate-200 focus-visible:ring-primary/20 shadow-sm"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Branch</Label>
                            <Select
                                value={form.branch}
                                onValueChange={val => setForm(p => ({ ...p, branch: val }))}
                                required
                            >
                                <SelectTrigger className="h-12 rounded-2xl border-slate-200 focus:ring-primary/20 shadow-sm">
                                    <SelectValue placeholder="Select a location" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                                    {branchesList.map(branch => (
                                        <SelectItem key={branch.id} value={branch.id.toString()} className="rounded-xl py-3 font-bold">
                                            {branch.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {!editUser && (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Password</Label>
                                <div className="relative">
                                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input
                                        type="password"
                                        value={form.password}
                                        onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                        placeholder="amabakery@123"
                                        className="pl-11 h-12 rounded-2xl border-slate-200 focus-visible:ring-primary/20 shadow-sm"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        <DialogFooter className="pt-6 gap-3">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setIsDialogOpen(false)}
                                className="h-12 px-6 rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-400 hover:bg-slate-50 transition-all"
                            >
                                Dismiss
                            </Button>
                            <Button
                                type="submit"
                                disabled={submitting}
                                className="h-12 px-10 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20 active:scale-95 transition-all"
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (editUser ? 'Save Configuration' : 'Confirm Identity')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl max-w-[400px] p-8 uppercase">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-2xl font-black text-slate-900 tracking-tighter">Revoke Access?</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-500 font-bold text-xs pt-2">
                            Are you sure you want to terminate manager <span className="text-primary font-black">"@{userToDelete?.username}"</span>?
                            This will revoke all node privileges immediately.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="pt-6 gap-3 flex flex-col sm:flex-row">
                        <AlertDialogCancel className="h-12 rounded-2xl font-black text-slate-400 border-none hover:bg-slate-50 uppercase tracking-widest text-[10px]">
                            Retain
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDelete();
                            }}
                            className="h-12 px-8 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-red-200"
                        >
                            Revoke
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
