import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import {
    Plus,
    Search,
    Pencil,
    Trash2,
    Loader2,
    Package,
    Eye,
    Info,
    CheckCircle2,
    XCircle,
    Tag,
    Store,
    Check,
    ChevronsUpDown,
    Utensils,
    CookingPot,
    Layers,
    ChevronDown,
    Download,
    Upload,
    FileSpreadsheet
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
    fetchProducts, createProduct, updateProduct, deleteProduct,
    fetchCategories, createCategory, deleteCategory, updateCategory,
    fetchKitchenTypes, createKitchenType, deleteKitchenType, updateKitchenType
} from "../../api/index.js";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "../../auth/auth";

interface Product {
    id: number;
    name: string;
    cost_price: string;
    selling_price: string;
    product_quantity: number;
    low_stock_bar: number;
    category: number; // This is the ID
    category_name: string;
    branch_id: number;
    branch_name: string;
    date_added: string;
    is_available: boolean;
}

interface KitchenType {
    id: number;
    name: string;
    branch: number;
    branch_name: string;
}

interface BackendCategory {
    id: number;
    name: string;
    branch: number;
    branch_name: string;
    kitchentype: number;
    kitchentype_name: string;
    is_kitchen_item: boolean;
}


export default function AdminMenu() {
    const user = getCurrentUser();
    const branchId = user?.branch_id ?? null;
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<BackendCategory[]>([]);
    const [kitchenTypes, setKitchenTypes] = useState<KitchenType[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [editItem, setEditItem] = useState<Product | null>(null);
    const [viewItem, setViewItem] = useState<Product | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [newCategoryInput, setNewCategoryInput] = useState("");
    const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
    const [editingCategoryName, setEditingCategoryName] = useState("");
    const [newCategoryIsKitchenItem, setNewCategoryIsKitchenItem] = useState(true);
    const [editingCategoryIsKitchenItem, setEditingCategoryIsKitchenItem] = useState(true);
    const [formAvailable, setFormAvailable] = useState(true);
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [isCatDropdownOpen, setIsCatDropdownOpen] = useState(false);
    const [catSearchValue, setCatSearchValue] = useState("");
    const [isKitchenDialogOpen, setIsKitchenDialogOpen] = useState(false);
    const [selectedKitchenId, setSelectedKitchenId] = useState<number | null>(null);
    const [newKitchenInput, setNewKitchenInput] = useState("");
    const [editingKitchenId, setEditingKitchenId] = useState<number | null>(null);
    const [editingKitchenName, setEditingKitchenName] = useState("");
    const [kitchenSearchValue, setKitchenSearchValue] = useState("");
    const [isKitchenDropdownOpen, setIsKitchenDropdownOpen] = useState(false);
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importLoading, setImportLoading] = useState(false);

    const importInputRef = useRef<HTMLInputElement>(null);

    // Pagination state
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [totalCount, setTotalCount] = useState(0);
    const [loadingMore, setLoadingMore] = useState(false);

    // Initial metadata load (categories, kitchens)
    useEffect(() => {
        loadMetadata();
    }, [branchId]);

    // Product loading and filter updates
    useEffect(() => {
        // Debounce search term changes, trigger others immediately
        const delay = searchTerm ? 500 : 0;
        const timer = setTimeout(() => {
            loadProducts(1, true);
        }, delay);
        return () => clearTimeout(timer);
    }, [branchId, categoryFilter, searchTerm]);

    const loadMetadata = async () => {
        try {
            const [categoriesData, kitchensData] = await Promise.all([
                fetchCategories(),
                fetchKitchenTypes()
            ]);

            const scopedCategories = branchId != null
                ? (categoriesData || []).filter((c: BackendCategory) => c.branch === branchId)
                : categoriesData || [];

            const scopedKitchens = (branchId != null
                ? (kitchensData || []).filter((k: KitchenType) => k.branch === branchId)
                : kitchensData || []).sort((a: any, b: any) => b.id - a.id);

            setCategories(scopedCategories);
            setKitchenTypes(scopedKitchens);
        } catch (err: any) {
            console.error("Failed to load metadata", err);
        }
    };

    const loadProducts = async (pageNumber: number = 1, isReset: boolean = false) => {
        if (isReset) {
            setLoading(true);
            setPage(1);
        } else {
            setLoadingMore(true);
        }

        try {
            const params: any = { page: pageNumber };
            if (searchTerm) params.search = searchTerm;
            if (categoryFilter !== "all") params.category_name = categoryFilter;
            if (branchId) params.branch = branchId;

            const data = await fetchProducts(params);

            let results = [];
            let nextUrl = null;
            let count = 0;

            if (data && typeof data === 'object' && 'results' in data) {
                results = data.results;
                nextUrl = data.next;
                count = data.count || 0;
            } else if (Array.isArray(data)) {
                results = data;
                count = data.length;
            }

            const scoped = branchId != null
                ? results.filter((p: Product) => p.branch_id === branchId)
                : results;

            if (isReset) {
                setProducts(scoped);
            } else {
                setProducts(prev => [...prev, ...scoped]);
            }

            setHasMore(!!nextUrl);
            setTotalCount(count);
            if (!isReset) setPage(pageNumber);

        } catch (err: any) {
            toast.error(err.message || "Failed to load products");
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const filteredItems = products.filter(item => {
        if (!item) return false;
        const itemName = item.name || "";
        const matchesSearch = itemName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || item.category_name === categoryFilter;
        return matchesSearch && matchesCategory;
    }).sort((a, b) => (a?.name || "").localeCompare(b?.name || ""));

    const handleToggleAvailability = async (productId: number, currentStatus: boolean) => {
        try {
            // Optimistic update
            setProducts(prev => prev.map(p =>
                p.id === productId ? { ...p, is_available: !currentStatus } : p
            ));

            const p = products.find(item => item.id === productId);
            if (p) {
                const payload = {
                    name: p.name,
                    selling_price: p.selling_price,
                    category: p.category,
                    is_available: !currentStatus
                };
                await updateProduct(productId, payload);
                toast.success("Availability updated");
            }
        } catch (err: any) {
            // Revert on error
            setProducts(prev => prev.map(p =>
                p.id === productId ? { ...p, is_available: currentStatus } : p
            ));
            toast.error(err.message || "Failed to update availability");
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSubmitting(true);
        const formData = new FormData(e.currentTarget);

        const payload: any = {
            name: formData.get("name"),
            cost_price: "0.00",
            selling_price: formData.get("selling_price"),
            product_quantity: 0,
            low_stock_bar: 0,
            category: selectedCategoryId,
            is_available: formAvailable
        };

        if (branchId) {
            payload.branch = branchId;
        }

        if (!selectedCategoryId) {
            toast.error("Please select a category");
            setSubmitting(false);
            return;
        }

        try {
            if (editItem) {
                const updated = await updateProduct(editItem.id, payload);
                setProducts(prev => prev.map(p => p.id === editItem.id ? updated : p));
                toast.success("Item updated");
            } else {
                const newProduct = await createProduct(payload);
                setProducts(prev => [...prev, newProduct]);
                toast.success("Item added");
            }
            setIsDialogOpen(false);
            setEditItem(null);
        } catch (err: any) {
            console.error("Product operation error:", err);
            toast.error(err.message || "Operation failed");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (productId: number) => {
        if (!confirm("Are you sure you want to delete this item?")) return;

        try {
            await deleteProduct(productId);
            setProducts(prev => prev.filter(p => p.id !== productId));
            toast.success("Item deleted");
        } catch (err: any) {
            if (err.message?.includes("404") || err.message?.toLowerCase().includes("not found")) {
                setProducts(prev => prev.filter(p => p.id !== productId));
                toast.success("Item removed from list");
            } else {
                toast.error(err.message || "Delete failed");
            }
        }
    };

    const handleLoadMore = () => {
        if (!loadingMore && hasMore) {
            loadProducts(page + 1);
        }
    };

    const handleAddCategory = async () => {
        if (newCategoryInput.trim()) {
            try {
                const categoryPayload: any = {
                    name: newCategoryInput.trim(),
                    is_kitchen_item: newCategoryIsKitchenItem
                };
                if (selectedKitchenId) {
                    categoryPayload.kitchentype = selectedKitchenId;
                }
                if (branchId) {
                    categoryPayload.branch = branchId;
                }
                const response = await createCategory(categoryPayload);
                setCategories(prev => [...prev, response.data].sort((a, b) => a.name.localeCompare(b.name)));
                setNewCategoryInput("");
                setNewCategoryIsKitchenItem(true);
                setSelectedKitchenId(null);
                setKitchenSearchValue("");
                toast.success(response.message || "Category added");
            } catch (err: any) {
                toast.error(err.message || "Failed to add category");
            }
        }
    };

    const handleUpdateCategory = async (id: number) => {
        if (!editingCategoryName.trim()) return;
        try {
            const payload: any = {
                name: editingCategoryName.trim(),
                kitchentype: selectedKitchenId || null,
                is_kitchen_item: editingCategoryIsKitchenItem
            };

            const response = await updateCategory(id, payload);
            setCategories(prev => prev.map(c => c.id === id ? response.data : c));
            setEditingCategoryId(null);
            setSelectedKitchenId(null);
            setEditingCategoryIsKitchenItem(true);
            toast.success(response.message || "Category updated");
        } catch (err: any) {
            toast.error(err.message || "Failed to update category");
        }
    };

    const handleDeleteCategory = async (catId: number, catName: string) => {
        const isInUse = products.some(item => item.category === catId);
        if (isInUse) {
            toast.error("Cannot delete category attached to existing items");
            return;
        }

        if (!confirm(`Are you sure you want to delete category "${catName}"?`)) return;

        try {
            await deleteCategory(catId);
            setCategories(prev => prev.filter(c => c.id !== catId));
            toast.success("Category deleted");
        } catch (err: any) {
            toast.error(err.message || "Failed to delete category");
        }
    };

    const handleAddKitchen = async (overrideName?: string) => {
        const nameToUse = overrideName || newKitchenInput.trim();
        if (!nameToUse) {
            toast.error("Please enter a kitchen name");
            return;
        }
        try {
            const payload: any = { name: nameToUse };
            if (branchId) payload.branch = branchId;

            const response = await createKitchenType(payload);
            const newKitchen = response.data;
            setKitchenTypes(prev => [newKitchen, ...prev].sort((a, b) => b.id - a.id));
            setNewKitchenInput("");
            toast.success(`Kitchen "${newKitchen.name}" added`);
            return newKitchen;
        } catch (err: any) {
            console.error("Add Kitchen Error:", err);
            toast.error(err.message || "Failed to add kitchen");
            return null;
        }
    };

    const handleUpdateKitchen = async (id: number) => {
        if (!editingKitchenName.trim()) return;
        try {
            const response = await updateKitchenType(id, { name: editingKitchenName.trim() });
            setKitchenTypes(prev => prev.map(k => k.id === id ? response.data : k));
            setEditingKitchenId(null);
            toast.success("Kitchen updated");
        } catch (err: any) {
            toast.error(err.message || "Failed to update kitchen");
        }
    };

    const handleDeleteKitchen = async (id: number, name: string) => {
        const isInUse = categories.some(cat => cat.kitchentype === id);
        if (isInUse) {
            toast.error("Cannot delete kitchen with attached categories");
            return;
        }
        if (!confirm(`Delete kitchen "${name}"?`)) return;
        try {
            await deleteKitchenType(id);
            setKitchenTypes(prev => prev.filter(k => k.id !== id));
            toast.success("Kitchen deleted");
        } catch (err: any) {
            toast.error(err.message || "Failed to delete kitchen");
        }
    };

    // --- XLSX EXPORT LOGIC ---
    const handleExportXLSX = () => {
        try {
            const kitsData = kitchenTypes.map(k => ({ Name: k.name }));
            const catsData = categories.map(c => ({ Name: c.name, Kitchen: c.kitchentype_name }));
            const prodsData = products.map(p => ({
                Name: p.name,
                "Selling Price": p.selling_price,
                Category: p.category_name,
                Kitchen: categories.find(c => c.id === p.category)?.kitchentype_name || "N/A",
                Available: p.is_available ? "Yes" : "No"
            }));

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prodsData), "Products");
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catsData), "Categories");
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kitsData), "Kitchens");

            XLSX.writeFile(wb, `Bakery_Menu_${new Date().toISOString().split('T')[0]}.xlsx`);
            toast.success("Menu exported successfully!");
            setIsExportDialogOpen(false);
        } catch (err) {
            console.error("Export Error:", err);
            toast.error("Failed to export items.");
        }
    };

    // --- XLSX IMPORT LOGIC ---
    const handleImportXLSX = async () => {
        if (!importFile) {
            toast.error("Please select a file first");
            return;
        }

        const reader = new FileReader();
        reader.onload = async (evt) => {
            setImportLoading(true);
            try {
                const data = evt.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });

                // 1. Kitchens
                if (workbook.Sheets["Kitchens"]) {
                    const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets["Kitchens"]);
                    for (const row of rows) {
                        const name = row.Name || row.name;
                        if (name && !kitchenTypes.some(k => k.name.toLowerCase() === name.toLowerCase())) {
                            await handleAddKitchen(name);
                        }
                    }
                }

                // Get latest kitchens for mapping
                const kits = await fetchKitchenTypes();
                const latestKits = branchId ? kits.filter((k: any) => k.branch === branchId) : kits;
                console.log("Importing: Refreshed Kitchens:", latestKits);

                // 2. Categories
                if (workbook.Sheets["Categories"]) {
                    const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets["Categories"]);
                    for (const row of rows) {
                        const name = row.Name || row.name;
                        const kitchenName = row.Kitchen || row.kitchen;
                        if (name && !categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
                            const kitchen = latestKits.find((k: any) => k.name.toLowerCase() === (kitchenName || "").toLowerCase());
                            if (kitchen) {
                                const payload: any = { name, kitchentype: kitchen.id };
                                if (branchId) payload.branch = branchId;
                                await createCategory(payload);
                            }
                        }
                    }
                }

                // Get latest categories
                const cats = await fetchCategories();
                const latestCats = branchId ? cats.filter((c: any) => c.branch === branchId) : cats;

                // 3. Products
                if (workbook.Sheets["Products"]) {
                    const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets["Products"]);
                    for (const row of rows) {
                        const name = row.Name || row.name;
                        if (name && !products.some(p => p.name.toLowerCase() === name.toLowerCase())) {
                            const price = row["Selling Price"] || row.selling_price || "0.00";
                            const catName = row.Category || row.category;
                            const available = row.Available === "Yes" || row.available === true;

                            const category = latestCats.find((c: any) => c.name.toLowerCase() === (catName || "").toLowerCase());
                            if (category) {
                                const payload: any = {
                                    name,
                                    cost_price: "0.00",
                                    selling_price: price.toString(),
                                    product_quantity: 0,
                                    low_stock_bar: 0,
                                    category: category.id,
                                    is_available: available
                                };
                                if (branchId) payload.branch = branchId;
                                await createProduct(payload);
                            }
                        }
                    }
                }

                toast.success("Import completed successfully!");
                await loadMetadata();
                await loadProducts(1, true);
                setIsImportDialogOpen(false);
                setImportFile(null);
            } catch (err) {
                console.error("Import Error:", err);
                toast.error("Failed to parse or import XLSX file.");
            } finally {
                setImportLoading(false);
            }
        };
        reader.readAsBinaryString(importFile);
    };

    return (
        <div className="p-4 md:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Menu Management</h1>
                    <p className="text-xs sm:text-sm text-muted-foreground">Manage your bakery items and categories</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {/* Proper Export Dialog */}
                    <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
                        <DialogTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="font-bold rounded-xl border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
                            >
                                <Download className="h-4 w-4 mr-2 text-primary" />
                                Export
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
                            <div className="p-4 sm:p-6 md:p-8 bg-gradient-to-br from-primary/10 to-transparent">
                                <DialogHeader>
                                    <DialogTitle className="text-2xl sm:text-3xl font-black uppercase tracking-tight flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                                            <FileSpreadsheet className="h-6 w-6" />
                                        </div>
                                        Export Menu
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="mt-6 space-y-4">
                                    <p className="text-slate-600 font-medium">Download your entire bakery menu as an Excel file. This includes:</p>
                                    <ul className="space-y-2">
                                        <li className="flex items-center gap-3 text-sm font-bold text-slate-700 bg-white/50 p-3 rounded-xl border border-slate-100">
                                            <Package className="h-4 w-4 text-primary" /> {products.length} Products
                                        </li>
                                        <li className="flex items-center gap-3 text-sm font-bold text-slate-700 bg-white/50 p-3 rounded-xl border border-slate-100">
                                            <Layers className="h-4 w-4 text-primary" /> {categories.length} Categories
                                        </li>
                                        <li className="flex items-center gap-3 text-sm font-bold text-slate-700 bg-white/50 p-3 rounded-xl border border-slate-100">
                                            <Utensils className="h-4 w-4 text-primary" /> {kitchenTypes.length} Kitchen Stations
                                        </li>
                                    </ul>
                                </div>
                                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                                    <Button variant="ghost" className="flex-1 rounded-xl h-10 sm:h-12 font-bold uppercase tracking-widest text-[10px] sm:text-xs" onClick={() => setIsExportDialogOpen(false)}>Cancel</Button>
                                    <Button className="flex-1 rounded-xl h-10 sm:h-12 font-black uppercase tracking-widest text-[10px] sm:text-xs shadow-lg shadow-primary/20" onClick={handleExportXLSX}>Download XLSX</Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Proper Import Dialog */}
                    <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                        <DialogTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="font-bold rounded-xl border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
                            >
                                <Upload className="h-4 w-4 mr-2 text-primary" />
                                Import
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
                            <div className="p-8 bg-gradient-to-br from-primary/10 to-transparent">
                                <DialogHeader>
                                    <DialogTitle className="text-2xl sm:text-3xl font-black uppercase tracking-tight flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                                            <Upload className="h-6 w-6" />
                                        </div>
                                        Import Menu
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="mt-6 space-y-4">
                                    <p className="text-slate-600 font-medium">Upload an XLSX file to bulk add Kitchens, Categories, and Products.</p>

                                    <div className={cn(
                                        "relative border-2 border-dashed rounded-2xl p-8 transition-all flex flex-col items-center justify-center gap-3",
                                        importFile ? "border-primary bg-primary/5" : "border-slate-200 hover:border-primary/50 hover:bg-slate-50"
                                    )}>
                                        <input
                                            type="file"
                                            accept=".xlsx, .xls"
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                                        />
                                        {importFile ? (
                                            <>
                                                <FileSpreadsheet className="h-12 w-12 text-primary animate-bounce" />
                                                <div className="text-center">
                                                    <p className="font-bold text-slate-800 text-sm truncate max-w-[200px]">{importFile.name}</p>
                                                    <p className="text-[10px] uppercase font-black tracking-widest text-primary">File selected</p>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                                    <Upload className="h-6 w-6" />
                                                </div>
                                                <p className="font-bold text-slate-400 text-sm">Drop file or click to browse</p>
                                            </>
                                        )}
                                    </div>

                                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 flex gap-3 items-start">
                                        <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                                        <div className="text-[11px] font-bold text-amber-700 leading-relaxed uppercase tracking-tighter">
                                            Required Sheets: Products, Categories, Kitchens. Items will be created if they don't already exist.
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                                    <Button variant="ghost" className="flex-1 rounded-xl h-10 sm:h-12 font-bold uppercase tracking-widest text-[10px] sm:text-xs" onClick={() => { setIsImportDialogOpen(false); setImportFile(null); }}>Cancel</Button>
                                    <Button
                                        className="flex-1 rounded-xl h-10 sm:h-12 font-black uppercase tracking-widest text-[10px] sm:text-xs shadow-lg shadow-primary/20"
                                        onClick={handleImportXLSX}
                                        disabled={!importFile || importLoading}
                                    >
                                        {importLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Start Import"}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="font-bold rounded-xl shadow-md active:scale-95 transition-all" onClick={() => {
                                setEditItem(null);
                                setSelectedCategoryId(null);
                                setFormAvailable(true);
                                setCatSearchValue("");
                                setIsCatDropdownOpen(false);
                            }}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Item
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-xl rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
                            <div className="bg-gradient-to-br from-primary/10 via-transparent to-primary/5 p-8">
                                <DialogHeader>
                                    <DialogTitle className="text-2xl sm:text-3xl font-black uppercase tracking-tight flex items-center gap-3">
                                        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                                            <Package className="h-5 w-5 sm:h-6 sm:w-6" />
                                        </div>
                                        {editItem ? 'Edit Item' : 'New Product'}
                                    </DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handleSubmit} className="space-y-6 mt-8 p-1">
                                    <div className="space-y-2">
                                        <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Name & Label</Label>
                                        <Input id="name" name="name" className="h-14 text-xl font-bold rounded-2xl bg-white/50 backdrop-blur-sm border-2 border-slate-100 focus:border-primary transition-all shadow-inner" placeholder="E.g. Strawberry Muffin" defaultValue={editItem?.name} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="selling_price" className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Selling Value (Rs.)</Label>
                                        <Input
                                            id="selling_price"
                                            name="selling_price"
                                            className="h-11 sm:h-14 text-xl sm:text-2xl font-black rounded-2xl bg-white/50 backdrop-blur-sm border-2 border-slate-100 focus:border-primary transition-all text-primary shadow-inner"
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="0.00"
                                            defaultValue={editItem?.selling_price}
                                            onInput={(e: any) => {
                                                e.target.value = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                                            }}
                                            required
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-6 items-end">
                                        <div className="space-y-2 relative">
                                            <Label htmlFor="category" className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Sort into Category</Label>
                                            <div className="relative group">
                                                <Input
                                                    id="category"
                                                    autoComplete="off"
                                                    placeholder="Search..."
                                                    value={catSearchValue}
                                                    onChange={(e) => {
                                                        setCatSearchValue(e.target.value);
                                                        setIsCatDropdownOpen(true);
                                                        const match = categories.find(c => c.name.toLowerCase() === e.target.value.toLowerCase());
                                                        if (match) setSelectedCategoryId(match.id);
                                                        else setSelectedCategoryId(null);
                                                    }}
                                                    onFocus={() => setIsCatDropdownOpen(true)}
                                                    className="h-11 sm:h-14 rounded-2xl bg-white/50 backdrop-blur-sm border-2 border-slate-100 focus:border-primary transition-all pr-12 font-bold shadow-inner"
                                                />
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-primary transition-colors">
                                                    <Search className="h-5 w-5" />
                                                </div>
                                            </div>

                                            {isCatDropdownOpen && (
                                                <>
                                                    <div className="fixed inset-0 z-[100]" onClick={() => setIsCatDropdownOpen(false)} />
                                                    <Card className="absolute top-full left-0 right-0 mt-3 z-[110] rounded-3xl border border-slate-100 shadow-2xl overflow-hidden max-h-[320px] overflow-y-auto custom-scrollbar p-2 animate-in fade-in slide-in-from-top-4 duration-300">
                                                        {categories
                                                            .filter(cat => cat.name.toLowerCase().includes(catSearchValue.toLowerCase()))
                                                            .map(cat => (
                                                                <button
                                                                    key={cat.id}
                                                                    type="button"
                                                                    className="w-full text-left px-5 py-4 text-base font-bold hover:bg-primary/5 hover:text-primary transition-all flex items-center justify-between rounded-2xl"
                                                                    onClick={() => {
                                                                        setSelectedCategoryId(cat.id);
                                                                        setCatSearchValue(cat.name);
                                                                        setIsCatDropdownOpen(false);
                                                                    }}
                                                                >
                                                                    <div className="flex flex-col">
                                                                        <span>{cat.name}</span>
                                                                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-tight flex items-center gap-1.5 mt-0.5">
                                                                            <CookingPot className="h-3 w-3" />
                                                                            {cat.kitchentype_name || "No Kitchen"}
                                                                        </span>
                                                                    </div>
                                                                    {selectedCategoryId === cat.id && <CheckCircle2 className="h-5 w-5 text-primary" />}
                                                                </button>
                                                            ))}

                                                        {catSearchValue.trim() && !categories.some(c => c.name.toLowerCase() === catSearchValue.toLowerCase()) && (
                                                            <div className="p-5 bg-primary/[0.02] border-2 border-dashed border-primary/20 rounded-2xl m-1 space-y-4">
                                                                <div className="space-y-3">
                                                                    <p className="text-[10px] font-black uppercase text-primary tracking-widest pl-1">Setup New Station Mapping</p>
                                                                    <div className="relative">
                                                                        <Input
                                                                            placeholder="Target Kitchen..."
                                                                            value={kitchenSearchValue}
                                                                            onChange={(e) => {
                                                                                setKitchenSearchValue(e.target.value);
                                                                                setIsKitchenDropdownOpen(true);
                                                                                const match = kitchenTypes.find(k => k.name.toLowerCase() === e.target.value.toLowerCase());
                                                                                if (match) setSelectedKitchenId(match.id);
                                                                                else setSelectedKitchenId(null);
                                                                            }}
                                                                            onFocus={() => setIsKitchenDropdownOpen(true)}
                                                                            className="h-12 rounded-xl bg-white border-2 border-slate-100 pr-12 focus:border-primary transition-all font-bold"
                                                                        />
                                                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/40">
                                                                            <CookingPot className="h-5 w-5" />
                                                                        </div>

                                                                        {isKitchenDropdownOpen && (
                                                                            <>
                                                                                <div className="fixed inset-0 z-[120]" onClick={() => setIsKitchenDropdownOpen(false)} />
                                                                                <Card className="absolute bottom-full left-0 right-0 mb-2 z-[130] rounded-2xl border border-slate-100 shadow-2xl overflow-hidden max-h-[160px] overflow-y-auto p-1.5 animate-in fade-in slide-in-from-bottom-2">
                                                                                    {kitchenTypes
                                                                                        .filter(k => k.name.toLowerCase().includes(kitchenSearchValue.toLowerCase()))
                                                                                        .map(k => (
                                                                                            <button
                                                                                                key={k.id}
                                                                                                type="button"
                                                                                                className="w-full text-left px-4 py-3 text-sm font-bold hover:bg-primary/5 hover:text-primary transition-colors flex items-center justify-between rounded-lg"
                                                                                                onClick={() => {
                                                                                                    setSelectedKitchenId(k.id);
                                                                                                    setKitchenSearchValue(k.name);
                                                                                                    setIsKitchenDropdownOpen(false);
                                                                                                }}
                                                                                            >
                                                                                                {k.name}
                                                                                                {selectedKitchenId === k.id && <Check className="h-4 w-4 text-primary" />}
                                                                                            </button>
                                                                                        ))}

                                                                                    {kitchenSearchValue.trim() && !kitchenTypes.some(k => k.name.toLowerCase() === kitchenSearchValue.toLowerCase()) && (
                                                                                        <button
                                                                                            type="button"
                                                                                            className="w-full text-left px-4 py-3 text-xs font-black text-white bg-primary hover:bg-primary/90 transition-all flex items-center gap-2 rounded-lg mt-1 shadow-md"
                                                                                            onClick={async () => {
                                                                                                const newK = await handleAddKitchen(kitchenSearchValue.trim());
                                                                                                if (newK) {
                                                                                                    setSelectedKitchenId(newK.id);
                                                                                                    setKitchenSearchValue(newK.name);
                                                                                                    setIsKitchenDropdownOpen(false);
                                                                                                }
                                                                                            }}
                                                                                        >
                                                                                            <Plus className="h-3 w-3" />
                                                                                            Add Kitchen "{kitchenSearchValue}"
                                                                                        </button>
                                                                                    )}
                                                                                </Card>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    className="w-full h-11 rounded-xl font-black text-[10px] uppercase shadow-lg shadow-primary/10 active:scale-95 transition-all"
                                                                    onClick={async () => {
                                                                        try {
                                                                            const catPayload: any = {
                                                                                name: catSearchValue.trim()
                                                                            };
                                                                            if (selectedKitchenId) {
                                                                                catPayload.kitchentype = selectedKitchenId;
                                                                            }
                                                                            if (branchId) {
                                                                                catPayload.branch = branchId;
                                                                            }
                                                                            const response = await createCategory(catPayload);
                                                                            const newCat = response.data;
                                                                            setCategories(prev => [...prev, newCat].sort((a, b) => a.name.localeCompare(b.name)));
                                                                            setSelectedCategoryId(newCat.id);
                                                                            setCatSearchValue(newCat.name);
                                                                            setIsCatDropdownOpen(false);
                                                                            if (newCat.kitchentype_name) {
                                                                                toast.success(`Category "${newCat.name}" added to ${newCat.kitchentype_name}`);
                                                                            } else {
                                                                                toast.success(`Category "${newCat.name}" created`);
                                                                            }
                                                                        } catch (err: any) {
                                                                            toast.error(err.message || "Failed to add category");
                                                                        }
                                                                    }}
                                                                >
                                                                    <Tag className="h-3.5 w-3.5 mr-2" />
                                                                    Initialize Category
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </Card>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex items-center space-x-4 mb-3 group cursor-pointer justify-center" onClick={() => setFormAvailable(!formAvailable)}>
                                            <div className={cn(
                                                "h-14 w-full px-6 flex items-center gap-3 rounded-2xl border-2 transition-all shadow-inner",
                                                formAvailable ? "bg-emerald-50 border-emerald-100 text-emerald-600 ring-2 ring-emerald-50" : "bg-slate-50 border-slate-100 text-slate-400"
                                            )}>
                                                <Switch
                                                    id="is_available"
                                                    checked={formAvailable}
                                                    onCheckedChange={setFormAvailable}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <span className="text-sm font-black uppercase tracking-widest">{formAvailable ? 'Available' : 'Hidden'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                                        <Button type="button" variant="ghost" className="flex-1 h-12 sm:h-16 rounded-[1.5rem] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 hover:bg-slate-100/50 text-xs sm:text-base" onClick={() => setIsDialogOpen(false)}>
                                            Cancel
                                        </Button>
                                        <Button type="submit" className="flex-1 h-12 sm:h-16 rounded-[1.5rem] font-black uppercase tracking-widest bg-primary text-white shadow-xl shadow-primary/20 active:scale-95 transition-all text-sm sm:text-lg" disabled={submitting}>
                                            {submitting ? <Loader2 className="h-4 w-4 sm:h-6 sm:w-6 animate-spin mx-auto" /> : (editItem ? 'Confirm Changes' : 'Quick Create')}
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Tabs defaultValue="items" className="w-full">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-4">
                    <TabsList className="grid w-full grid-cols-3 max-w-full sm:max-w-[450px] p-1.5 bg-slate-200/50 rounded-2xl h-auto">
                        <TabsTrigger value="items" className="rounded-xl font-bold py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">Menu Items</TabsTrigger>
                        <TabsTrigger value="categories" className="rounded-xl font-bold py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">Categories</TabsTrigger>
                        <TabsTrigger value="kitchens" className="rounded-xl font-bold py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">Kitchens</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="items" className="space-y-4 mt-0">
                    <div className="space-y-4">
                        <div className="card-elevated p-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search menu items..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 h-11"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            <Button
                                variant={categoryFilter === 'all' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setCategoryFilter('all')}
                                className="whitespace-nowrap rounded-full font-medium"
                            >
                                All
                            </Button>
                            {categories.map(cat => (
                                <Button
                                    key={cat.id}
                                    variant={categoryFilter === cat.name ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setCategoryFilter(cat.name)}
                                    className="whitespace-nowrap rounded-full font-medium"
                                >
                                    {cat.name}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {loading && products.length === 0 ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredItems.map((item) => (
                                    <div
                                        key={item.id}
                                        onClick={() => {
                                            setViewItem(item);
                                            setIsViewDialogOpen(true);
                                        }}
                                        className={`card-elevated p-4 transition-all hover:shadow-lg cursor-pointer active:scale-[0.98] group ${!item.is_available && 'opacity-60 grayscale-[0.5]'}`}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1 mr-4">
                                                <h3 className="font-bold text-slate-900 text-lg leading-snug group-hover:text-primary transition-colors">{item.name}</h3>
                                                <p className="text-[11px] uppercase font-black tracking-widest text-slate-400 underline decoration-slate-200 decoration-2 underline-offset-2 mt-1">{item.category_name}</p>
                                            </div>
                                            <div className="text-right flex flex-col items-end gap-1.5">
                                                <span className="text-lg sm:text-xl font-black text-primary">Rs.{item.selling_price}</span>
                                                <p className="text-[10px] uppercase font-black tracking-widest text-primary/60 flex items-center gap-1 bg-primary/5 px-2 py-0.5 rounded-lg border border-primary/10">
                                                    <CookingPot className="h-3 w-3" />
                                                    {categories.find(c => c.id === item.category)?.kitchentype_name || 'No Kitchen'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-2" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={item.is_available}
                                                    onCheckedChange={() => handleToggleAvailability(item.id, item.is_available)}
                                                />
                                                <span className={`text-[11px] font-black uppercase ${item.is_available ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                    {item.is_available ? 'Available' : 'Hidden'}
                                                </span>
                                            </div>
                                            <div className="flex gap-0.5">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-9 w-9 text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors"
                                                    onClick={() => {
                                                        setEditItem(item);
                                                        setSelectedCategoryId(item.category);
                                                        setFormAvailable(item.is_available);
                                                        setCatSearchValue(item.category_name || "");
                                                        setIsDialogOpen(true);
                                                    }}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-9 w-9 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                    onClick={() => handleDelete(item.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {hasMore && (
                                <div className="flex justify-center p-8">
                                    <Button
                                        variant="outline"
                                        onClick={handleLoadMore}
                                        disabled={loadingMore}
                                        className="rounded-xl h-12 px-8 font-bold uppercase tracking-widest text-[11px] hover:bg-primary hover:text-white transition-all shadow-sm border-2 border-primary/20"
                                    >
                                        {loadingMore ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Loading...
                                            </>
                                        ) : (
                                            <>
                                                Load More Items
                                                <ChevronDown className="h-4 w-4 ml-2" />
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}

                            {!loading && filteredItems.length === 0 && (
                                <div className="card-elevated py-20 text-center flex flex-col items-center justify-center bg-slate-50/50 border-dashed border-2">
                                    <Package className="h-16 w-16 text-slate-200 mb-4" />
                                    <p className="text-xl font-bold text-slate-900">No items found</p>
                                    <p className="text-slate-500 mt-1">Try a different search or filter!</p>
                                </div>
                            )}
                        </>
                    )}
                </TabsContent>

                <TabsContent value="categories" className="space-y-6 mt-6 px-0 sm:px-2">
                    <div className="card-elevated p-4 sm:p-6 md:p-8 max-w-4xl mx-auto shadow-2xl rounded-[2.5rem] border-4 border-white">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                            <div>
                                <h2 className="text-xl sm:text-2xl md:text-3xl font-black flex items-center gap-3 uppercase tracking-tighter text-slate-800">
                                    <Layers className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                                    Manage Categories
                                </h2>
                                <p className="text-slate-400 font-bold text-[10px] sm:text-xs uppercase tracking-widest mt-1 ml-1">Organize your menu stations</p>
                            </div>
                            <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none px-4 py-1.5 rounded-full font-black text-[10px] sm:text-xs uppercase tracking-widest w-fit">
                                {categories.length} Categories
                            </Badge>
                        </div>

                        <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 mb-10 shadow-inner">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 ml-1 block">Create New Category</Label>
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                <div className="md:col-span-5 space-y-1.5">
                                    <Input
                                        placeholder="Category Name (e.g. Burgers, Drinks)"
                                        value={newCategoryInput}
                                        onChange={(e) => setNewCategoryInput(e.target.value)}
                                        className="h-11 sm:h-14 text-base sm:text-lg shadow-sm border-slate-200 focus:border-primary focus:ring-primary rounded-2xl bg-white px-5 font-bold"
                                    />
                                </div>
                                <div className="md:col-span-4 space-y-1.5 relative">
                                    <div className="relative">
                                        <Input
                                            placeholder="Select Kitchen..."
                                            value={kitchenSearchValue}
                                            onChange={(e) => {
                                                setKitchenSearchValue(e.target.value);
                                                setIsKitchenDropdownOpen(true);
                                                const match = kitchenTypes.find(k => k.name.toLowerCase() === e.target.value.toLowerCase());
                                                if (match) setSelectedKitchenId(match.id);
                                                else setSelectedKitchenId(null);
                                            }}
                                            onFocus={() => setIsKitchenDropdownOpen(true)}
                                            className="h-11 sm:h-14 rounded-2xl bg-white border border-slate-200 focus:ring-2 focus:ring-primary/20 pr-12 font-bold text-slate-700"
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/40 pointer-events-none">
                                            <CookingPot className="h-6 w-6" />
                                        </div>

                                        {isKitchenDropdownOpen && (
                                            <>
                                                <div className="fixed inset-0 z-[50]" onClick={() => setIsKitchenDropdownOpen(false)} />
                                                <Card className="absolute top-full left-0 right-0 mt-2 z-[60] rounded-2xl border border-slate-100 shadow-xl overflow-hidden max-h-[220px] overflow-y-auto p-2 animate-in fade-in slide-in-from-top-2">
                                                    {kitchenTypes
                                                        .filter(k => k.name.toLowerCase().includes(kitchenSearchValue.toLowerCase()))
                                                        .map(k => (
                                                            <button
                                                                key={k.id}
                                                                type="button"
                                                                className="w-full text-left px-4 py-3 text-sm font-bold hover:bg-primary/5 hover:text-primary transition-all flex items-center justify-between rounded-xl"
                                                                onClick={() => {
                                                                    setSelectedKitchenId(k.id);
                                                                    setKitchenSearchValue(k.name);
                                                                    setIsKitchenDropdownOpen(false);
                                                                }}
                                                            >
                                                                {k.name}
                                                                {selectedKitchenId === k.id && <Check className="h-4 w-4 text-primary" />}
                                                            </button>
                                                        ))}

                                                    {kitchenSearchValue.trim() && !kitchenTypes.some(k => k.name.toLowerCase() === kitchenSearchValue.toLowerCase()) && (
                                                        <button
                                                            type="button"
                                                            className="w-full text-left px-4 py-3 text-sm font-black text-primary bg-primary/5 hover:bg-primary/10 transition-all flex items-center gap-2 border-t border-slate-50"
                                                            onClick={async () => {
                                                                await handleAddKitchen(kitchenSearchValue.trim());
                                                                setIsKitchenDropdownOpen(false);
                                                            }}
                                                        >
                                                            <Plus className="h-3 w-3" />
                                                            Add Kitchen "{kitchenSearchValue}"
                                                        </button>
                                                    )}
                                                </Card>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="md:col-span-3">
                                    <Button
                                        onClick={handleAddCategory}
                                        className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 active:scale-95 transition-all"
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Category
                                    </Button>
                                </div>
                                <div className="md:col-span-12 flex items-center gap-4 mt-2">
                                    <Checkbox
                                        id="newCategoryIsKitchenItem"
                                        checked={newCategoryIsKitchenItem}
                                        onCheckedChange={(checked) => setNewCategoryIsKitchenItem(checked === true)}
                                        className="h-6 w-6 border-2 border-slate-300 data-[state=checked]:border-primary data-[state=checked]:bg-primary rounded-md"
                                    />
                                    <Label htmlFor="newCategoryIsKitchenItem" className="text-base font-black text-slate-700 cursor-pointer flex items-center gap-2">
                                        <span>Mark as Kitchen Item</span>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                            {newCategoryIsKitchenItem ? "ON" : "OFF"}
                                        </span>
                                    </Label>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 ml-1 block">Total Categories</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {categories.map((cat) => (
                                    <div key={cat.id} className="group transition-all hover:scale-[1.02]">
                                        <Card className={cn(
                                            "p-4 border-2 border-slate-100 hover:border-primary/20 transition-all bg-white rounded-[1.5rem] shadow-sm hover:shadow-md flex items-center justify-between",
                                            cat.is_kitchen_item && "border-primary/40 bg-primary/[0.04] shadow-md shadow-primary/10"
                                        )}>
                                            <div className="flex items-center gap-4">
                                                <div className={cn(
                                                    "h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-all",
                                                    cat.is_kitchen_item && "bg-primary/20 ring-2 ring-primary/30 text-primary"
                                                )}>
                                                    <Tag className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    {editingCategoryId === cat.id ? (
                                                        <div className="flex items-center gap-2">
                                                            <Input
                                                                value={editingCategoryName}
                                                                onChange={(e) => setEditingCategoryName(e.target.value)}
                                                                className="h-8 w-40 text-sm font-bold"
                                                                autoFocus
                                                            />
                                                            <Checkbox
                                                                checked={editingCategoryIsKitchenItem}
                                                                onCheckedChange={(checked) => setEditingCategoryIsKitchenItem(checked === true)}
                                                                className="h-5 w-5 border-2 border-slate-300 data-[state=checked]:border-primary data-[state=checked]:bg-primary rounded-md"
                                                                title="Kitchen Item"
                                                            />
                                                            <Button size="sm" onClick={() => handleUpdateCategory(cat.id)} className="h-8 w-8 p-0">
                                                                <Check className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <h4 className="font-bold text-slate-800 text-lg">{cat.name}</h4>
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                                                                <CookingPot className="h-2.5 w-2.5" />
                                                                {cat.kitchentype_name || "No Kitchen"}
                                                            </p>
                                                            {cat.is_kitchen_item && (
                                                                <Badge className="mt-1 bg-primary/25 text-primary border-2 border-primary/40 px-3 py-1.5 rounded-full font-black text-[10px] uppercase tracking-widest flex items-center gap-1 shadow-sm">
                                                                    <CookingPot className="h-3 w-3" />
                                                                    Kitchen Item
                                                                </Badge>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg"
                                                    onClick={() => {
                                                        setEditingCategoryId(cat.id);
                                                        setEditingCategoryName(cat.name);
                                                        setSelectedKitchenId(cat.kitchentype);
                                                        setEditingCategoryIsKitchenItem(cat.is_kitchen_item ?? true);
                                                    }}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                                    onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </Card>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="kitchens" className="space-y-6 mt-6">
                    <div className="card-elevated p-8 max-w-2xl mx-auto shadow-2xl rounded-[2.5rem] border-4 border-white">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-3xl font-black flex items-center gap-3 uppercase tracking-tighter text-slate-800">
                                    <Utensils className="h-8 w-8 text-primary" />
                                    Kitchen Stations
                                </h2>
                                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1 ml-1">Manage kitchen printer routing</p>
                            </div>
                        </div>

                        <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 mb-8 shadow-inner">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 ml-1 block">Add New Station</Label>
                            <div className="flex gap-4">
                                <Input
                                    placeholder="Kitchen Name (e.g. Main Kitchen, Bakery)"
                                    value={newKitchenInput}
                                    onChange={(e) => setNewKitchenInput(e.target.value)}
                                    className="h-14 text-lg shadow-sm border-slate-200 focus:border-primary focus:ring-primary rounded-2xl bg-white px-5 font-bold"
                                />
                                <Button
                                    onClick={() => handleAddKitchen()}
                                    className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 active:scale-95 transition-all"
                                >
                                    <Plus className="h-5 w-5 mr-2" />
                                    Create
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 ml-1 block">Active Stations</Label>
                            {kitchenTypes.map((kitchen) => (
                                <div key={kitchen.id} className="group">
                                    <div className="p-4 bg-white border-2 border-slate-100 hover:border-primary/20 rounded-2xl flex items-center justify-between transition-all hover:scale-[1.01] shadow-sm">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                                                <CookingPot className="h-6 w-6" />
                                            </div>
                                            {editingKitchenId === kitchen.id ? (
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        value={editingKitchenName}
                                                        onChange={(e) => setEditingKitchenName(e.target.value)}
                                                        className="h-10 w-48 text-base font-bold"
                                                        autoFocus
                                                    />
                                                    <Button onClick={() => handleUpdateKitchen(kitchen.id)} size="sm">
                                                        <Check className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div>
                                                    <h4 className="font-bold text-slate-800 text-lg uppercase tracking-tight">{kitchen.name}</h4>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Production Unit</p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-slate-300 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                                                onClick={() => {
                                                    setEditingKitchenId(kitchen.id);
                                                    setEditingKitchenName(kitchen.name);
                                                }}
                                            >
                                                <Pencil className="h-5 w-5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                                onClick={() => handleDeleteKitchen(kitchen.id, kitchen.name)}
                                            >
                                                <Trash2 className="h-5 w-5" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {kitchenTypes.length === 0 && (
                                <div className="py-12 text-center text-slate-400 font-medium bg-slate-50/50 rounded-2xl border-2 border-dashed">
                                    No kitchen stations configured yet.
                                </div>
                            )}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* View Details Dialog */}
            <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
                <DialogContent className="max-w-xl rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
                    <div className="p-8">
                        <DialogHeader>
                            <DialogTitle className="text-3xl font-black uppercase tracking-tight flex items-center gap-3 text-slate-900">
                                <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-lg shadow-primary/5">
                                    <Info className="h-6 w-6" />
                                </div>
                                Item Details
                            </DialogTitle>
                        </DialogHeader>
                        {viewItem && (
                            <div className="space-y-6 mt-8">
                                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2 block">Product Name</Label>
                                    <div className="text-2xl font-bold text-slate-900">{viewItem.name}</div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2 block">Price Tag</Label>
                                        <div className="text-2xl font-black text-slate-900">Rs {viewItem.selling_price}</div>
                                    </div>
                                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2 block">Status</Label>
                                        <div className={cn(
                                            "flex items-center gap-2 text-base font-black uppercase tracking-widest",
                                            viewItem.is_available ? "text-emerald-500" : "text-amber-500"
                                        )}>
                                            {viewItem.is_available ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                                            {viewItem.is_available ? "Live" : "Inactive"}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2 block">Mapped Category</Label>
                                    <div className="text-lg font-bold flex items-center gap-2 text-slate-700">
                                        <Tag className="h-5 w-5 text-primary" />
                                        {viewItem.category_name}
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <Button
                                        variant="ghost"
                                        className="flex-1 h-16 rounded-2xl font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                                        onClick={() => setIsViewDialogOpen(false)}
                                    >
                                        Dismiss
                                    </Button>
                                    <Button
                                        className="flex-1 h-16 rounded-2xl font-black uppercase tracking-widest bg-primary text-white shadow-xl shadow-primary/20 active:scale-95 transition-all text-lg"
                                        onClick={() => {
                                            setEditItem(viewItem);
                                            setIsViewDialogOpen(false);
                                            setIsDialogOpen(true);
                                        }}
                                    >
                                        <Pencil className="h-5 w-5 mr-3" />
                                        Edit Item
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
