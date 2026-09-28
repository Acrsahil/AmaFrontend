import { useState, useEffect, useCallback } from "react";
import { fetchReportDashboard, fetchStaffReport, fetchPaymentMethodInvoices, fetchCategories, fetchKitchenTypes } from "@/api/index.js";
import { getCurrentUser } from "../../auth/auth";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  Download,
  Loader2,
  Filter,
  ChevronDown,
  Calendar as CalendarIcon,
  X,
  ArrowLeft,
  CreditCard,
  Banknote,
  Smartphone,
  Wifi,
  Receipt,
  TrendingUp,
  FileSpreadsheet,
  ChevronRight
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
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Cell
} from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────
const PAYMENT_COLORS = [
  "hsl(142, 71%, 45%)",
  "hsl(217, 91%, 60%)",
  "hsl(32, 95%, 44%)",
  "hsl(280, 65%, 60%)",
  "hsl(0, 84%, 60%)"
];

const PAYMENT_METHOD_META: Record<string, { icon: any; label: string; color: string; bg: string }> = {
  CASH: { icon: Banknote, label: "Cash", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  QR: { icon: Smartphone, label: "QR", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  CARD: { icon: CreditCard, label: "Card", color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  ONLINE: { icon: Wifi, label: "Online", color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  CREDIT: { icon: Receipt, label: "Credit", color: "text-rose-700", bg: "bg-rose-50 border-rose-200" },
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface Invoice {
  id: number;
  invoice_number: string;
  created_at: string;
  customer_name?: string;
  created_by_name?: string;
  branch_name?: string;
  total_amount: number;
  paid_amount: number;
  payment_status: string;
  payment_methods: string[];
  payment_details: { payment_method: string; amount: number; created_at: string }[];
  items: { product_name: string; quantity: number; unit_price: number }[];
  table_no?: number;
  floor_name?: string;
}

// ─── Excel Export Helper ───────────────────────────────────────────────────────
function exportInvoicesToExcel(invoices: Invoice[], filename: string, paymentMethod: string) {
  const rows = invoices.map((inv) => ({
    "Invoice No": inv.invoice_number,
    "Date": inv.created_at,
    "Customer": inv.customer_name || "Walk-in",
    "Served By": inv.created_by_name || "-",
    "Branch": inv.branch_name || "-",
    "Floor / Table": inv.floor_name ? `${inv.floor_name} / T${inv.table_no}` : "-",
    "Items": (inv.items || []).map(i => `${i.product_name} x${i.quantity}`).join(", "),
    "Total (Rs)": Number(inv.total_amount),
    "Paid (Rs)": Number(inv.paid_amount),
    "Payment Status": inv.payment_status,
    "Payment Method(s)": inv.payment_methods?.join(", ") || paymentMethod,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    { wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 16 }, { wch: 14 },
    { wch: 18 }, { wch: 40 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 22 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Invoices");
  XLSX.writeFile(wb, filename);
}

function exportItemsToExcel(items: any[], filename: string) {
  const rows = items.map((item, index) => ({
    "Rank": index + 1,
    "Item": item.product__name,
    "Sold Units": Number(item.total_sold_units || 0),
    "Revenue (Rs)": Number(item.total_sales || 0),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 8 }, { wch: 35 }, { wch: 15 }, { wch: 15 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Item Analytics");
  XLSX.writeFile(wb, filename);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminReports() {
  const user = getCurrentUser();

  // Report data
  const [reportData, setReportData] = useState<any>(null);
  const [staffData, setStaffData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffLoading, setStaffLoading] = useState(true);
  const [missingBranch, setMissingBranch] = useState(false);

  // Filter states
  const [timeframe, setTimeframe] = useState("daily");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  // Category / Kitchen filter for analytics view
  const [categories, setCategories] = useState<any[]>([]);
  const [kitchenTypes, setKitchenTypes] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedKitchen, setSelectedKitchen] = useState("");

  // Payment drill-down panel
  const [drillMethod, setDrillMethod] = useState<string | null>(null);
  const [drillInvoices, setDrillInvoices] = useState<Invoice[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const isSuperOrAdmin = user?.is_superuser || user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const getFilters = useCallback(() => {
    const params: any = { timeframe };
    if (timeframe === "custom" && dateRange.from && dateRange.to) {
      params.start_date = format(dateRange.from, "yyyy-MM-dd");
      params.end_date = format(dateRange.to, "yyyy-MM-dd");
    }
    if (selectedCategory) params.category_name = selectedCategory;
    if (selectedKitchen) params.kitchen_name = selectedKitchen;
    return params;
  }, [timeframe, dateRange, selectedCategory, selectedKitchen]);

  const getBranchId = () => {
    if (isSuperOrAdmin) return user?.branch_id ?? null;
    return null;
  };

  // ─── Data loaders ────────────────────────────────────────────────────────────
  const loadReportData = useCallback(async () => {
    setLoading(true);
    setMissingBranch(false);
    try {
      if (isSuperOrAdmin && !user?.branch_id) {
        setMissingBranch(true);
        setLoading(false);
        return;
      }
      const data = await fetchReportDashboard(getBranchId(), getFilters());
      setReportData(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load report data");
    } finally {
      setLoading(false);
    }
  }, [user?.branch_id, getFilters]);

  const loadStaffData = useCallback(async () => {
    setStaffLoading(true);
    try {
      if (isSuperOrAdmin && !user?.branch_id) { setStaffLoading(false); return; }
      const data = await fetchStaffReport(getBranchId(), { timeframe, ...(timeframe === "custom" && dateRange.from && dateRange.to ? { start_date: format(dateRange.from, "yyyy-MM-dd"), end_date: format(dateRange.to, "yyyy-MM-dd") } : {}) });
      setStaffData(data?.staff_performance || []);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load staff data");
    } finally {
      setStaffLoading(false);
    }
  }, [user?.branch_id, timeframe, dateRange]);

  const loadMeta = useCallback(async () => {
    try {
      const [cats, kitchens] = await Promise.all([fetchCategories(), fetchKitchenTypes()]);
      setCategories(cats || []);
      setKitchenTypes(kitchens || []);
    } catch (_) { }
  }, []);

  useEffect(() => {
    loadReportData();
    loadStaffData();
  }, [user?.branch_id, timeframe, dateRange, selectedCategory, selectedKitchen]);

  useEffect(() => { loadMeta(); }, []);

  // ─── Payment method drill-down ────────────────────────────────────────────
  const openDrill = async (method: string) => {
    setDrillMethod(method);
    setDrillLoading(true);
    setDrillInvoices([]);
    try {
      const filters: any = { timeframe, payment_method: method };
      if (timeframe === "custom" && dateRange.from && dateRange.to) {
        filters.start_date = format(dateRange.from, "yyyy-MM-dd");
        filters.end_date = format(dateRange.to, "yyyy-MM-dd");
      }
      const data = await fetchPaymentMethodInvoices(getBranchId(), filters);
      setDrillInvoices(data?.invoices || []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load invoices");
    } finally {
      setDrillLoading(false);
    }
  };

  const closeDrill = () => { setDrillMethod(null); setDrillInvoices([]); };

  // ─── Excel export for drill-down ──────────────────────────────────────────
  const handleExportDrill = () => {
    if (!drillInvoices.length) return;
    const label = drillMethod || "ALL";
    const tf = timeframe === "custom" && dateRange.from && dateRange.to
      ? `${format(dateRange.from, "yyyy-MM-dd")}_to_${format(dateRange.to, "yyyy-MM-dd")}`
      : timeframe;
    exportInvoicesToExcel(drillInvoices, `invoices_${label}_${tf}.xlsx`, label);
    toast.success(`Exported ${drillInvoices.length} invoices`);
  };

  // ─── Payment method row – renders a clickable card ───────────────────────
  const PaymentMethodCard = ({ item, index }: { item: any; index: number }) => {
    const meta = PAYMENT_METHOD_META[item.payment_method?.toUpperCase()] || { icon: CreditCard, label: item.payment_method, color: "text-slate-700", bg: "bg-slate-50 border-slate-200" };
    const Icon = meta.icon;
    const pct = Number(reportData?.total_month_sales || 0) > 0 ? ((Number(item.total_amount) / Number(reportData.total_month_sales)) * 100).toFixed(1) : "0.0";

    return (
      <button
        key={item.payment_method}
        onClick={() => openDrill(item.payment_method?.toUpperCase())}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200",
          "hover:shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-pointer text-left",
          meta.bg
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center bg-white/70 shadow-sm")}>
            <Icon className={cn("h-4 w-4", meta.color)} />
          </div>
          <div>
            <p className={cn("text-xs font-black uppercase tracking-wider", meta.color)}>{meta.label}</p>
            <p className="text-[10px] text-slate-500 font-semibold">{pct}% of total</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-slate-900">Rs.{Number(item.total_amount).toLocaleString()}</span>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </div>
      </button>
    );
  };

  // ─── Drill-down panel ─────────────────────────────────────────────────────
  if (drillMethod !== null) {
    const meta = PAYMENT_METHOD_META[drillMethod] || { icon: CreditCard, label: drillMethod, color: "text-slate-700", bg: "bg-slate-50" };
    const Icon = meta.icon;
    const total = drillInvoices.reduce((s, inv) => s + Number(inv.total_amount), 0);

    return (
      <div className="p-6 space-y-5">
        {/* Drill header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={closeDrill} className="rounded-xl hover:bg-slate-100">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm", meta.bg)}>
              <Icon className={cn("h-5 w-5", meta.color)} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 capitalize">{meta.label} Invoices</h2>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">
                {timeframe} · {drillInvoices.length} invoices · Rs.{total.toLocaleString()}
              </p>
            </div>
          </div>
          <Button
            onClick={handleExportDrill}
            disabled={drillInvoices.length === 0}
            className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export Excel
          </Button>
        </div>

        {/* Summary chips */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Invoices", value: drillInvoices.length },
            { label: "Total Sales", value: `Rs.${total.toLocaleString()}` },
            { label: "Avg per Invoice", value: drillInvoices.length > 0 ? `Rs.${(total / drillInvoices.length).toFixed(0)}` : "—" }
          ].map(chip => (
            <div key={chip.label} className="card-elevated p-4 rounded-2xl text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{chip.label}</p>
              <p className="text-xl font-black text-slate-900 mt-1">{chip.value}</p>
            </div>
          ))}
        </div>

        {/* Invoice table */}
        <div className="card-elevated overflow-hidden rounded-2xl">
          {drillLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : drillInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
              <Receipt className="h-10 w-10 opacity-30" />
              <p className="font-semibold">No invoices found for {meta.label} in this period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-widest text-muted-foreground">#</th>
                    <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-widest text-muted-foreground">Invoice No</th>
                    <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-widest text-muted-foreground">Date & Time</th>
                    <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-widest text-muted-foreground">Customer</th>
                    <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-widest text-muted-foreground">Served By</th>
                    <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-widest text-muted-foreground">Table</th>
                    <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-widest text-muted-foreground min-w-[200px]">Items</th>
                    <th className="px-5 py-3 text-right text-xs font-black uppercase tracking-widest text-muted-foreground">Total</th>
                    <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-widest text-muted-foreground">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-widest text-muted-foreground">Methods</th>
                  </tr>
                </thead>
                <tbody>
                  {drillInvoices.map((inv, idx) => (
                    <tr key={inv.id} className="border-t hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 text-xs font-bold text-slate-400">{idx + 1}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-black text-primary font-mono">{inv.invoice_number}</span>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-600 whitespace-nowrap">{inv.created_at}</td>
                      <td className="px-5 py-3 text-xs font-semibold">{inv.customer_name || "Walk-in"}</td>
                      <td className="px-5 py-3 text-xs text-slate-500">{inv.created_by_name || "-"}</td>
                      <td className="px-5 py-3 text-xs text-slate-500">
                        {inv.floor_name ? `${inv.floor_name} / T${inv.table_no}` : "-"}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-600 truncate max-w-[250px]" title={(inv.items || []).map(i => `${i.product_name} x${i.quantity}`).join(", ")}>
                        {(inv.items || []).map(i => `${i.product_name} x${i.quantity}`).join(", ")}
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-black text-slate-900">
                        Rs.{Number(inv.total_amount).toLocaleString()}
                      </td>
                      <td className="px-5 py-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-black uppercase tracking-wider",
                            inv.payment_status === "PAID" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                            inv.payment_status === "PENDING" && "bg-amber-50 text-amber-700 border-amber-200",
                            inv.payment_status === "PARTIAL" && "bg-orange-50 text-orange-700 border-orange-200",
                            inv.payment_status === "CREDIT" && "bg-rose-50 text-rose-700 border-rose-200",
                          )}
                        >
                          {inv.payment_status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(inv.payment_methods || []).map((pm: string) => {
                            const pmMeta = PAYMENT_METHOD_META[pm?.toUpperCase()];
                            return (
                              <span
                                key={pm}
                                className={cn(
                                  "text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border",
                                  pmMeta?.bg || "bg-slate-50 border-slate-200",
                                  pmMeta?.color || "text-slate-700"
                                )}
                              >
                                {pm}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/30 border-t">
                  <tr>
                    <td colSpan={7} className="px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-500">
                      Total — {drillInvoices.length} Invoice(s)
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-black text-primary">
                      Rs.{total.toLocaleString()}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Main Report View ─────────────────────────────────────────────────────
  const topItems: any[] = reportData?.top_selling_items_count || [];

  return (
    <div className="p-6 space-y-6">
      {/* Missing branch banner */}
      {missingBranch && (
        <div className="card-elevated p-6 border border-amber-200 bg-amber-50 rounded-xl">
          <p className="text-amber-800 font-semibold">Select a specific branch to view its reports. Your global admin account is not assigned to a branch.</p>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground">Reports</h1>
          <p className="text-muted-foreground text-sm">Analytics, payment breakdown & export</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 rounded-xl border-2 font-bold px-3 text-xs gap-1.5 border-slate-100 shadow-sm hover:text-primary">
                <Filter className="h-3.5 w-3.5 text-primary" />
                {selectedCategory || "All Categories"}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 p-2 rounded-2xl border-none shadow-2xl bg-white/95 backdrop-blur-xl">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 py-1.5 font-black">Filter by Category</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setSelectedCategory("")} className="rounded-lg font-bold text-sm cursor-pointer">All Categories</DropdownMenuItem>
              <DropdownMenuSeparator />
              {categories.map((c: any) => (
                <DropdownMenuItem key={c.id} onClick={() => setSelectedCategory(c.name)} className="rounded-lg font-semibold text-sm cursor-pointer">
                  {c.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Kitchen filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 rounded-xl border-2 font-bold px-3 text-xs gap-1.5 border-slate-100 shadow-sm hover:text-primary">
                <Filter className="h-3.5 w-3.5 text-orange-500" />
                {selectedKitchen || "All Kitchens"}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 p-2 rounded-2xl border-none shadow-2xl bg-white/95 backdrop-blur-xl">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 py-1.5 font-black">Filter by Kitchen</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setSelectedKitchen("")} className="rounded-lg font-bold text-sm cursor-pointer">All Kitchens</DropdownMenuItem>
              <DropdownMenuSeparator />
              {kitchenTypes.map((k: any) => (
                <DropdownMenuItem key={k.id} onClick={() => setSelectedKitchen(k.name)} className="rounded-lg font-semibold text-sm cursor-pointer">
                  {k.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Timeframe selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 rounded-xl border-2 font-bold px-3 text-xs gap-1.5 border-slate-100 shadow-sm hover:text-primary">
                <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                <span className="capitalize">{timeframe}</span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 p-2 rounded-2xl border-none shadow-2xl bg-white/95 backdrop-blur-xl">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 py-1.5 font-black">Select Period</DropdownMenuLabel>
              {["daily", "weekly", "monthly", "yearly"].map(tf => (
                <DropdownMenuItem key={tf} onClick={() => setTimeframe(tf)} className={cn("rounded-lg font-bold text-sm cursor-pointer capitalize", timeframe === tf && "bg-primary/10 text-primary")}>
                  {tf.charAt(0).toUpperCase() + tf.slice(1)}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="bg-slate-100 my-1" />
              <DropdownMenuItem onClick={() => setTimeframe("custom")} className={cn("rounded-lg font-bold text-sm cursor-pointer text-primary", timeframe === "custom" && "bg-primary/10")}>
                Custom Range
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Custom date picker */}
          {timeframe === "custom" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("h-10 rounded-xl border-2 font-bold px-3 text-xs border-slate-100 shadow-sm gap-1.5", !dateRange.from && "text-muted-foreground")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateRange.from ? (dateRange.to ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d, y")}` : format(dateRange.from, "MMM d, y")) : "Pick Dates"}
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

          {/* Active filter chips */}
          {(selectedCategory || selectedKitchen) && (
            <Button variant="ghost" size="sm" onClick={() => { setSelectedCategory(""); setSelectedKitchen(""); }} className="h-10 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 gap-1">
              <X className="h-3.5 w-3.5" />Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Active filter pills */}
      {(selectedCategory || selectedKitchen) && (
        <div className="flex flex-wrap gap-2">
          {selectedCategory && (
            <div className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-black">
              Category: {selectedCategory}
              <button onClick={() => setSelectedCategory("")} className="hover:text-rose-600"><X className="h-3 w-3" /></button>
            </div>
          )}
          {selectedKitchen && (
            <div className="flex items-center gap-1.5 bg-orange-100 text-orange-700 rounded-full px-3 py-1 text-xs font-black">
              Kitchen: {selectedKitchen}
              <button onClick={() => setSelectedKitchen("")} className="hover:text-rose-600"><X className="h-3 w-3" /></button>
            </div>
          )}
        </div>
      )}

      {/* ── Top KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-elevated p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center gap-2 mb-2 relative z-10">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg shadow-sm"><Banknote className="h-4 w-4" /></div>
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Sales</p>
          </div>
          <h2 className="text-3xl font-black text-slate-900 relative z-10">Rs.{Number(reportData?.total_month_sales || 0).toLocaleString()}</h2>
          <Banknote className="absolute -bottom-4 -right-4 h-24 w-24 text-emerald-50 opacity-50 group-hover:scale-110 transition-transform" />
        </div>

        <div className="card-elevated p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center gap-2 mb-2 relative z-10">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg shadow-sm"><Receipt className="h-4 w-4" /></div>
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Orders</p>
          </div>
          <h2 className="text-3xl font-black text-slate-900 relative z-10">{Number(reportData?.total_month_orders || 0).toLocaleString()}</h2>
          <Receipt className="absolute -bottom-4 -right-4 h-24 w-24 text-blue-50 opacity-50 group-hover:scale-110 transition-transform" />
        </div>

        <div className="card-elevated p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center gap-2 mb-2 relative z-10">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg shadow-sm"><TrendingUp className="h-4 w-4" /></div>
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Avg Order</p>
          </div>
          <h2 className="text-3xl font-black text-slate-900 relative z-10">Rs.{Number(reportData?.avg_order || 0).toLocaleString()}</h2>
          <TrendingUp className="absolute -bottom-4 -right-4 h-24 w-24 text-purple-50 opacity-50 group-hover:scale-110 transition-transform" />
        </div>

        <div className="card-elevated p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center gap-2 mb-2 relative z-10">
            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg shadow-sm"><TrendingUp className="h-4 w-4" /></div>
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Sales Growth</p>
          </div>
          <div className="flex items-baseline gap-2 relative z-10">
            <h2 className={cn("text-3xl font-black", Number(reportData?.sales_percent) >= 0 ? "text-emerald-600" : "text-rose-600")}>
              {Number(reportData?.sales_percent) >= 0 ? "+" : ""}{reportData?.sales_percent || "0"}%
            </h2>
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">vs prev</span>
          </div>
          <TrendingUp className="absolute -bottom-4 -right-4 h-24 w-24 text-orange-50 opacity-50 group-hover:scale-110 transition-transform" />
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="payment" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="payment">💳 Payment Breakdown</TabsTrigger>
          <TabsTrigger value="sales">📊 Item Analytics</TabsTrigger>
          <TabsTrigger value="staff">👥 Staff Report</TabsTrigger>
        </TabsList>

        {/* ────────────────── PAYMENT BREAKDOWN TAB ────────────────── */}
        <TabsContent value="payment" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Pie chart */}
            <div className="card-elevated p-8 relative">
              <div className="mb-6 text-center">
                <h3 className="text-lg font-black uppercase tracking-tight">Sales by Payment Method</h3>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest capitalize">{timeframe} · Click a method to see invoices</p>
              </div>
              {loading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="h-[300px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={(reportData?.sales_by_payment_method || []).map((p: any) => ({
                          ...p,
                          total_amount: parseFloat(String(p.total_amount || 0)) || 0
                        }))}
                        dataKey="total_amount"
                        nameKey="payment_method"
                        cx="50%" cy="50%"
                        innerRadius={80} outerRadius={110}
                        paddingAngle={5} stroke="none"
                        isAnimationActive={false}
                        onClick={(entry) => openDrill(entry?.payment_method?.toUpperCase())}
                        style={{ cursor: "pointer" }}
                      >
                        {(reportData?.sales_by_payment_method || []).map((_: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} className="hover:opacity-80 transition-opacity" />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}
                        formatter={(value: any) => [`Rs.${Number(value).toLocaleString()}`, "Total"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-slate-800">Rs.{Number(reportData?.total_month_sales || 0).toLocaleString()}</span>
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest capitalize">{timeframe} Total</span>
                  </div>
                </div>
              )}

              {/* Clickable method rows */}
              {!loading && (
                <div className="mt-6 space-y-2">
                  {(reportData?.sales_by_payment_method || []).length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-4">No payment data for this period</p>
                  ) : (reportData?.sales_by_payment_method || []).map((item: any, index: number) => (
                    <PaymentMethodCard key={item.payment_method} item={item} index={index} />
                  ))}
                </div>
              )}
            </div>

            {/* Payment Status pie */}
            <div className="card-elevated p-8 relative">
              <div className="mb-6 text-center">
                <h3 className="text-lg font-black uppercase tracking-tight">Sales by Payment Status</h3>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest capitalize">{timeframe} · Status-wise distribution</p>
              </div>
              {loading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="h-[300px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={(reportData?.sales_by_status || []).map((p: any) => ({
                          ...p,
                          total_amount: parseFloat(String(p.total_amount || 0)) || 0
                        }))}
                        dataKey="total_amount"
                        nameKey="payment_status"
                        cx="50%" cy="50%"
                        innerRadius={80} outerRadius={110}
                        paddingAngle={5} stroke="none"
                        isAnimationActive={false}
                      >
                        {(reportData?.sales_by_status || []).map((_: any, index: number) => (
                          <Cell key={`cell-status-${index}`} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} className="hover:opacity-80 transition-opacity" />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}
                        formatter={(value: any) => [`Rs.${Number(value).toLocaleString()}`, "Total"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-slate-800">Rs.{Number(reportData?.total_month_sales || 0).toLocaleString()}</span>
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest capitalize">{timeframe} Total</span>
                  </div>
                </div>
              )}
              {!loading && (
                <div className="mt-6 space-y-2">
                  {(reportData?.sales_by_status || []).map((item: any, index: number) => (
                    <div key={item.payment_status} className="flex items-center justify-between px-4 py-2 rounded-xl bg-slate-50/50 border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PAYMENT_COLORS[index % PAYMENT_COLORS.length] }} />
                        <span className="text-[10px] font-black uppercase text-slate-500">{item.payment_status?.toLowerCase()}</span>
                      </div>
                      <span className="text-xs font-black text-slate-900">Rs.{Number(item.total_amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Pro-tip */}
          <div className="flex items-center gap-3 bg-primary/5 border border-primary/10 rounded-2xl px-5 py-3">
            <TrendingUp className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs font-semibold text-primary">
              Click any payment method row above to see all invoices paid via that method, then export them to Excel.
            </p>
          </div>
        </TabsContent>

        {/* ────────────────── ITEM ANALYTICS TAB ────────────────── */}
        <TabsContent value="sales" className="space-y-6">
          <div className="pt-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-black uppercase tracking-tight mb-1 relative ml-3 before:absolute before:-left-3 before:top-1 before:bottom-1 before:w-1 before:bg-primary before:rounded-full">Product Analytics</h3>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-2 ml-3 capitalize">{timeframe} item-wise performance{selectedCategory ? ` · ${selectedCategory}` : ""}{selectedKitchen ? ` · ${selectedKitchen}` : ""}</p>
            </div>

            <Button
              onClick={() => {
                const tf = timeframe === "custom" && dateRange.from && dateRange.to
                  ? `${format(dateRange.from, "yyyy-MM-dd")}_to_${format(dateRange.to, "yyyy-MM-dd")}`
                  : timeframe;
                exportItemsToExcel(topItems, `item_analytics_${tf}.xlsx`);
                toast.success(`Exported ${topItems.length} items to Excel`);
              }}
              disabled={topItems.length === 0}
              className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export Items Excel
            </Button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="card-elevated p-6">
              <div className="mb-6">
                <h3 className="text-sm font-black uppercase tracking-tight capitalize">{timeframe} Top Selling Items</h3>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">By Order Volume</p>
              </div>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={topItems} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                  <YAxis dataKey="product__name" type="category" stroke="hsl(var(--muted-foreground))" width={120} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Bar dataKey="total_sold_units" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card-elevated overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-4 text-left font-medium text-muted-foreground">Rank</th>
                    <th className="px-6 py-4 text-left font-medium text-muted-foreground">Item</th>
                    <th className="px-6 py-4 text-left font-medium text-muted-foreground">Sold Units</th>
                    <th className="px-6 py-4 text-right font-medium text-muted-foreground">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                        {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "No data available"}
                      </td>
                    </tr>
                  ) : topItems.map((item, index) => (
                    <tr key={item.product__name} className="border-t">
                      <td className="px-6 py-4">
                        <span className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">{index + 1}</span>
                      </td>
                      <td className="px-6 py-4 font-medium">{item.product__name}</td>
                      <td className="px-6 py-4">{item.total_sold_units}</td>
                      <td className="px-6 py-4 text-right font-semibold text-primary">Rs.{Number(item.total_sales || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ────────────────── STAFF REPORT TAB ────────────────── */}
        <TabsContent value="staff" className="space-y-4">
          <div className="card-elevated p-6">
            <h3 className="text-lg font-semibold mb-6 capitalize">Staff Performance ({timeframe})</h3>
            {staffLoading ? (
              <div className="flex justify-center items-center h-[300px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : staffData.length === 0 ? (
              <div className="flex justify-center items-center h-[300px] text-muted-foreground">No staff data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={staffData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                    formatter={(value: number, name: string) => name === "sales" || name === "cash_in_hand" ? `Rs.${value.toLocaleString()}` : value}
                  />
                  <Bar dataKey="orders" name="Orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card-elevated overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-6 py-4 text-left font-medium text-muted-foreground">Staff</th>
                  <th className="px-6 py-4 text-left font-medium text-muted-foreground">Role</th>
                  <th className="px-6 py-4 text-left font-medium text-muted-foreground">Orders</th>
                  <th className="px-6 py-4 text-left font-medium text-muted-foreground">Sales</th>
                  <th className="px-6 py-4 text-left font-medium text-muted-foreground">Cash In Hand</th>
                </tr>
              </thead>
              <tbody>
                {staffLoading ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></td></tr>
                ) : staffData.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No staff data available</td></tr>
                ) : staffData.map((staff) => (
                  <tr key={staff.id} className="border-t">
                    <td className="px-6 py-4 font-medium">{staff.name}</td>
                    <td className="px-6 py-4 text-muted-foreground text-sm capitalize">{staff.role?.toLowerCase().replace("_", " ")}</td>
                    <td className="px-6 py-4 font-bold">{staff.orders}</td>
                    <td className="px-6 py-4 font-semibold text-slate-900">Rs.{Number(staff.sales).toLocaleString()}</td>
                    <td className="px-6 py-4 font-black text-primary">Rs.{Number(staff.cash_in_hand || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
