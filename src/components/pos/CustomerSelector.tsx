import { useState, useEffect, useMemo, useRef } from "react";
import { Search, UserPlus, Check, Loader2, User, Phone, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { fetchCustomers, createCustomer } from "@/api/index.js";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/auth/auth";

interface Customer {
    id: number;
    name: string;
    phone: string;
    email?: string;
    address?: string;
}

interface CustomerSelectorProps {
    onSelect: (customer: Customer | null) => void;
    selectedCustomerId?: number;
    searchTerm?: string;
    onSearchChange?: (val: string) => void;
    onFocus?: () => void;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function CustomerSelector({
    onSelect,
    selectedCustomerId,
    searchTerm = "",
    onSearchChange,
    onFocus,
    open: externalOpen,
    onOpenChange: setExternalOpen
}: CustomerSelectorProps) {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [internalOpen, setInternalOpen] = useState(false);

    const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
    const setIsOpen = setExternalOpen !== undefined ? setExternalOpen : setInternalOpen;
    // New customer form state
    const [newName, setNewName] = useState("");
    const [newPhone, setNewPhone] = useState("");

    useEffect(() => {
        loadCustomers();
    }, []);

    const loadCustomers = async () => {
        setLoading(true);
        try {
            const data = await fetchCustomers();
            const customersList = Array.isArray(data) ? data : (data?.results || []);
            setCustomers(customersList);
        } catch (err: any) {
            toast.error(err.message || "Failed to load customers");
        } finally {
            setLoading(false);
        }
    };

    const filteredCustomers = useMemo(() => {
        if (!searchTerm.trim()) return []; // Changed to empty array by default
        return customers.filter(c =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.phone.includes(searchTerm)
        ).slice(0, 10);
    }, [customers, searchTerm]);

    const handleCreateCustomer = async () => {
        if (!newName.trim() || !newPhone.trim()) {
            toast.error("Name and phone are required");
            return;
        }

        setSubmitting(true);
        try {
            const user = getCurrentUser();
            const payload: any = {
                name: newName,
                phone: newPhone
            };

            if (user?.branch_id) {
                payload.branch = user.branch_id;
            }

            const result = await createCustomer(payload);
            toast.success("Customer created and selected");

            // Add to local list and select
            const newCust = result;
            setCustomers(prev => [newCust, ...prev]);
            onSelect(newCust);

            // Reset and close creation mode
            setIsCreating(false);
            setIsOpen(false);
            setNewName("");
            setNewPhone("");
            if (onSearchChange) onSearchChange("");
        } catch (err: any) {
            toast.error(err.message || "Failed to create customer");
        } finally {
            setSubmitting(false);
        }
    };

    const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

    return (
        <div className="space-y-4">
            {selectedCustomer ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/20 animate-in zoom-in-95 duration-200">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                            {selectedCustomer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="font-bold text-sm leading-none">{selectedCustomer.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">{selectedCustomer.phone}</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => onSelect(null)} className="h-8 px-2 text-xs font-bold text-muted-foreground hover:text-destructive">
                        Clear
                    </Button>
                </div>
            ) : (
                <>
                    <Button
                        variant="outline"
                        className="w-full h-12 justify-between rounded-xl border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 transition-all text-muted-foreground"
                        onClick={() => {
                            setIsOpen(true);
                        }}
                    >
                        <span className="flex items-center">
                            <Search className="h-4 w-4 mr-2" />
                            Select Customer
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>

                    <Dialog open={isOpen} onOpenChange={(open) => {
                        setIsOpen(open);
                        // Make sure we un-set creation mode when closing the dialog
                        if (!open) setIsCreating(false);
                    }}>
                        <DialogContent
                            className="max-w-[400px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl md:rounded-[2rem] z-[60]"
                            onInteractOutside={(e) => {
                                const target = e.target as HTMLElement;
                                if (target?.closest('.global-keyboard')) e.preventDefault();
                            }}
                        >
                            <DialogHeader className="p-4 bg-slate-50 border-b flex flex-row items-center justify-between shrink-0">
                                <DialogTitle className="text-sm font-black text-slate-800">
                                    {isCreating ? 'Create Customer' : 'Select Customer'}
                                </DialogTitle>
                            </DialogHeader>

                            <div className="p-4 bg-white flex flex-col gap-4">
                                {isCreating ? (
                                    <div className="space-y-4 animate-in slide-in-from-right-2 duration-200">
                                        <div className="grid gap-3">
                                            <Input
                                                placeholder="Full Name"
                                                value={newName}
                                                onChange={(e) => setNewName(e.target.value)}
                                                className="h-10"
                                                autoFocus={!newName}
                                            />
                                            <Input
                                                type="tel"
                                                placeholder="Phone Number"
                                                value={newPhone}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/\D/g, '');
                                                    setNewPhone(val);
                                                }}
                                                className="h-10"
                                                autoFocus={!!newName && !newPhone}
                                            />
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="ghost"
                                                    className="flex-1 h-11 font-bold"
                                                    onClick={() => setIsCreating(false)}
                                                >
                                                    Back
                                                </Button>
                                                <Button
                                                    className="flex-1 h-11 font-bold gradient-warm"
                                                    onClick={handleCreateCustomer}
                                                    disabled={submitting}
                                                >
                                                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                                                    Create & Select
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search by name or phone..."
                                                value={searchTerm}
                                                onFocus={onFocus}
                                                onChange={(e) => onSearchChange ? onSearchChange(e.target.value) : null}
                                                className="pl-9 h-11 rounded-xl shadow-sm focus:shadow-md transition-shadow keyboard-input"
                                            />
                                        </div>

                                        <div className="max-h-[300px] overflow-y-auto pr-1 space-y-1 custom-scrollbar">
                                            {loading ? (
                                                <div className="flex items-center justify-center py-4">
                                                    <Loader2 className="h-5 w-5 animate-spin text-primary/30" />
                                                </div>
                                            ) : filteredCustomers.length > 0 ? (
                                                <>
                                                    {filteredCustomers.map(customer => (
                                                        <button
                                                            key={customer.id}
                                                            onClick={() => {
                                                                onSelect(customer);
                                                                setIsOpen(false);
                                                            }}
                                                            className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-100 transition-colors text-left group border border-transparent hover:border-slate-200"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                                                    <User className="h-4 w-4" />
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-xs">{customer.name}</p>
                                                                    <p className="text-[10px] text-muted-foreground">{customer.phone}</p>
                                                                </div>
                                                            </div>
                                                            <Phone className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </button>
                                                    ))}
                                                    {!searchTerm.trim() && customers.length > 5 && (
                                                        <p className="text-[10px] text-center text-muted-foreground py-2 italic font-medium">Type to search more customers</p>
                                                    )}
                                                </>
                                            ) : searchTerm.trim() ? (
                                                <div className="text-center py-6 space-y-3">
                                                    <p className="text-sm text-muted-foreground">No customer found with "{searchTerm}"</p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="rounded-full font-bold text-xs"
                                                        onClick={() => {
                                                            const term = searchTerm.trim();
                                                            setIsCreating(true);
                                                            if (/^\+?\d+$/.test(term)) {
                                                                setNewName("");
                                                                setNewPhone(term);
                                                            } else {
                                                                setNewName(term);
                                                                setNewPhone("");
                                                            }
                                                        }}
                                                    >
                                                        <UserPlus className="h-3.5 w-3.5 mr-2" />
                                                        Add New Customer
                                                    </Button>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>
                </>
            )}
        </div>
    );
}
