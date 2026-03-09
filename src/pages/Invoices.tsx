import { useState, useEffect, useRef } from "react";
import { useInvoices, useSettlements, Invoice, InvoiceFilters } from "@/hooks/use-invoices";
import { useDeliveryCompanies } from "@/hooks/use-delivery-companies";
import { useFleetrunnr } from "@/hooks/use-fleetrunnr";
import {
  FileText,
  Plus,
  Trash2,
  Edit,
  ArrowDownLeft,
  ArrowUpRight,
  Zap,
  Search,
  MoreHorizontal,
  RefreshCw,
  Loader2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-yellow-500/20 text-yellow-700",
  paid: "bg-emerald-500/20 text-emerald-700",
  voided: "bg-red-500/20 text-red-700",
  overdue: "bg-orange-500/20 text-orange-700",
};

function InvoiceFormDialog({
  invoice,
  companies,
  onSave,
  trigger,
}: {
  invoice?: Invoice;
  companies: { id: string; name: string }[];
  onSave: (data: Partial<Invoice>) => Promise<void>;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    invoice_number: string;
    type: 'received' | 'sent';
    status: Invoice['status'];
    amount: string;
    currency: string;
    due_date: string;
    notes: string;
    delivery_company_id: string;
  }>({
    invoice_number: invoice?.invoice_number || "",
    type: invoice?.type || "sent",
    status: invoice?.status || "draft",
    amount: invoice?.amount?.toString() || "",
    currency: invoice?.currency || "USD",
    due_date: invoice?.due_date || "",
    notes: invoice?.notes || "",
    delivery_company_id: invoice?.delivery_company_id || "",
  });

  const handleSave = async () => {
    if (!form.invoice_number || !form.amount) {
      toast.error("Invoice number and amount are required");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        invoice_number: form.invoice_number,
        type: form.type as 'received' | 'sent',
        status: form.status as Invoice['status'],
        amount: parseFloat(form.amount),
        currency: form.currency,
        due_date: form.due_date || null,
        notes: form.notes || null,
        delivery_company_id: form.delivery_company_id || null,
      });
      toast.success(invoice ? "Invoice updated" : "Invoice created");
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save invoice");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-black tracking-tight">
            {invoice ? "Edit Invoice" : "Create Invoice"}
          </DialogTitle>
          <DialogDescription>
            {invoice
              ? "Update invoice details."
              : "Create a new invoice manually."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Invoice Number *
              </label>
              <Input
                placeholder="INV-001"
                value={form.invoice_number}
                onChange={(e) =>
                  setForm({ ...form, invoice_number: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Type
              </label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-medium"
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as 'received' | 'sent' })
                }
              >
                <option value="sent">Sent (Client Pays)</option>
                <option value="received">Received (We Pay)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Amount *
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Currency
              </label>
              <Input
                placeholder="USD"
                value={form.currency}
                onChange={(e) =>
                  setForm({ ...form, currency: e.target.value })
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Status
              </label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-medium"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Invoice['status'] })}
              >
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="voided">Voided</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Due Date
              </label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) =>
                  setForm({ ...form, due_date: e.target.value })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Delivery Company
            </label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-medium"
              value={form.delivery_company_id}
              onChange={(e) =>
                setForm({ ...form, delivery_company_id: e.target.value })
              }
            >
              <option value="">None</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Notes
            </label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Optional notes..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="font-black uppercase tracking-widest text-[11px]"
          >
            {saving ? "Saving..." : invoice ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Invoices() {
  const [activeTab, setActiveTab] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const typeFilter =
    activeTab === "received"
      ? "received"
      : activeTab === "sent"
      ? "sent"
      : undefined;

  const filters: InvoiceFilters = {
    type: typeFilter as any,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    dateRange,
  };

  const { invoices, loading: invoicesLoading, refresh: refreshInvoices, createInvoice, updateInvoice, deleteInvoice } =
    useInvoices(filters);
  const { settlements, loading: settlementsLoading, refresh: refreshSettlements, updateSettlement } = useSettlements({
    status: statusFilter,
    dateRange,
  });
  const { companies } = useDeliveryCompanies();
  const loading = invoicesLoading || settlementsLoading;

  // Fleetrunnr sync
  const { syncFleetrunnrInvoices, isSyncingInvoices, syncProgress } = useFleetrunnr();
  const hasSyncedRef = useRef(false);

  const handleInvoiceSync = async () => {
    try {
      const result = await syncFleetrunnrInvoices();
      await Promise.all([refreshInvoices(), refreshSettlements()]);
      
      let msg = `Sync complete: ${result.invoicesCreated} invoices created, ${result.ordersUpdated} orders updated`;
      if (result.settlementsCreated > 0) msg += `, ${result.settlementsCreated} settlements created`;
      
      if (result.invoicesCreated > 0 || result.invoicesUpdated > 0 || result.settlementsCreated > 0 || result.ordersUpdated > 0) {
        toast.success(msg + (result.failed > 0 ? `, ${result.failed} failed` : ''));
      } else if (result.total === 0) {
        toast.info('No orders with tracking numbers found.');
      } else {
        toast.success(`Sync complete. ${result.total} orders checked, no changes needed.`);
      }
    } catch (err: any) {
      toast.error('Sync failed: ' + (err.message || 'Unknown error'));
    }
  };

  // Auto-sync on mount
  useEffect(() => {
    if (!hasSyncedRef.current) {
      hasSyncedRef.current = true;
      handleInvoiceSync();
    }
  }, []);

  const filteredInvoices = invoices.filter((inv) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      inv.invoice_number.toLowerCase().includes(q) ||
      inv.id.toLowerCase().includes(q) ||
      (inv.merchant_name || '').toLowerCase().includes(q) ||
      (inv.notes || "").toLowerCase().includes(q) ||
      (inv.delivery_company as any)?.name?.toLowerCase().includes(q)
    );
  });

  const handleDeleteConfirm = async () => {
    if (!invoiceToDelete) return;
    try {
      await deleteInvoice(invoiceToDelete);
      toast.success("Invoice deleted");
    } catch (err) {
      toast.error("Failed to delete invoice");
    } finally {
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
    }
  };

  const totals = {
    all: invoices.length,
    received: invoices.filter((i) => i.type === "received").length,
    sent: invoices.filter((i) => i.type === "sent").length,
    settlements: settlements.length,
    settlementAmount: settlements.reduce((acc, s) => acc + s.amount, 0),
    unpaidSettlements: settlements.filter(s => s.status === 'pending').length,
    unpaidSettlementAmount: settlements.filter(s => s.status === 'pending').reduce((acc, s) => acc + s.amount, 0),
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-foreground flex items-center gap-3">
              <FileText className="h-8 w-8 sm:h-10 sm:w-10 text-primary" /> Invoices
            </h1>
            <p className="text-muted-foreground font-medium text-base sm:text-lg">
              Manage sent and received invoices for your business.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DatePickerWithRange date={dateRange} setDate={setDateRange} />
            <Button
              variant="outline"
              className="h-9 gap-2 font-black uppercase tracking-widest text-[10px]"
              onClick={handleInvoiceSync}
              disabled={isSyncingInvoices}
            >
              {isSyncingInvoices ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {isSyncingInvoices ? 'Syncing...' : 'Sync Fleetrunnr'}
            </Button>
            <InvoiceFormDialog
              companies={companies}
              onSave={createInvoice}
              trigger={
                <Button className="h-9 gap-2 font-black uppercase tracking-widest text-[10px]">
                  <Plus className="h-3.5 w-3.5" /> New Invoice
                </Button>
              }
            />
          </div>
        </div>
        {/* Sync Progress */}
        {isSyncingInvoices && syncProgress && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 border border-muted/20 rounded-xl px-4 py-2 animate-in fade-in duration-300">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="font-medium">{syncProgress}</span>
          </div>
        )}
      </div>

          {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          className={cn(
            "cursor-pointer hover:border-orange-500/30 transition-all",
            activeTab === "received" && "border-orange-500 ring-1 ring-orange-500/20"
          )}
          onClick={() => setActiveTab("received")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-orange-600">
              Delivery Invoices
            </CardTitle>
            <ArrowDownLeft className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-orange-700">
              {totals.received}
            </div>
            <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-tighter">
              Fees we owe carriers
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            "cursor-pointer hover:border-blue-500/30 transition-all",
            activeTab === "sent" && "border-blue-500 ring-1 ring-blue-500/20"
          )}
          onClick={() => setActiveTab("sent")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-blue-600">
              Sent Invoices
            </CardTitle>
            <ArrowUpRight className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-blue-700">
              {totals.sent}
            </div>
            <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-tighter">
              Billed to customers
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            "cursor-pointer hover:border-emerald-500/30 transition-all",
            activeTab === "settlements" && "border-emerald-500 ring-1 ring-emerald-500/20"
          )}
          onClick={() => setActiveTab("settlements")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
              Settlements
            </CardTitle>
            <Wallet className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-700">
              ${totals.settlementAmount.toFixed(2)}
            </div>
            <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-tighter">
              Total cash from COD
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            "cursor-pointer hover:border-yellow-600/30 transition-all"
          )}
          onClick={() => {
              setActiveTab("settlements");
              setStatusFilter("pending");
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-yellow-600">
              Awaiting Payout
            </CardTitle>
            <Zap className="h-4 w-4 text-yellow-600 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-yellow-700">
              ${totals.unpaidSettlementAmount.toFixed(2)}
            </div>
            <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-tighter">
              {totals.unpaidSettlements} pending payouts
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <TabsList className="bg-transparent border-b rounded-none h-auto w-full sm:w-auto justify-start gap-4 md:gap-10 px-0 flex-wrap pb-2">
            <TabsTrigger
              value="all"
              className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-0 text-sm font-black uppercase tracking-widest transition-all"
            >
              All ({totals.all})
            </TabsTrigger>
            <TabsTrigger
              value="received"
              className="border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-black uppercase tracking-widest transition-all"
            >
              Received ({totals.received})
            </TabsTrigger>
            <TabsTrigger
              value="sent"
              className="border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-black uppercase tracking-widest transition-all"
            >
              Sent ({totals.sent})
            </TabsTrigger>
            <TabsTrigger
              value="settlements"
              className="border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent rounded-none px-0 text-sm font-black uppercase tracking-widest transition-all"
            >
              Settlements ({totals.settlements})
            </TabsTrigger>
          </TabsList>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by ID, number, or merchant..."
                className="pl-9 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40 h-9 font-bold text-[10px] uppercase tracking-widest">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Unpaid</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="voided">Voided</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {["all", "received", "sent"].map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-4">
            {/* Mobile Card View */}
            <div className="block md:hidden space-y-3">
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-28 rounded-2xl" />
                  ))
                : filteredInvoices.length === 0
                ? (
                    <div className="py-20 bg-muted/20 border-2 border-dashed rounded-3xl flex flex-col items-center gap-4 text-muted-foreground">
                      <FileText className="h-12 w-12 opacity-20" />
                      <p className="font-bold">No invoices found</p>
                    </div>
                  )
                : filteredInvoices.map((inv) => (
                    <Card
                      key={inv.id}
                      className="rounded-2xl border hover:border-primary/30 transition-all"
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-black text-base">
                              {inv.invoice_number}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {inv.merchant_name || (inv.delivery_company as any)?.name || "—"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              className={cn(
                                "text-[9px] font-black uppercase tracking-widest border-none px-2 py-0.5",
                                inv.type === "received"
                                  ? "bg-orange-500/20 text-orange-700"
                                  : "bg-blue-500/20 text-blue-700"
                              )}
                            >
                              {inv.type === "received" ? (
                                <ArrowDownLeft className="h-3 w-3 mr-1" />
                              ) : (
                                <ArrowUpRight className="h-3 w-3 mr-1" />
                              )}
                              {inv.type}
                            </Badge>
                            <Badge
                              className={cn(
                                "text-[9px] font-black uppercase tracking-widest border-none px-2 py-0.5",
                                statusColors[inv.status]
                              )}
                            >
                              {inv.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div>
                            <div className="flex items-baseline gap-2">
                              <p className="text-lg font-black">
                                {inv.currency} {inv.amount.toFixed(2)}
                              </p>
                              {inv.subtotal > 0 && inv.subtotal !== inv.amount && (
                                <span className="text-xs text-muted-foreground">sub: {inv.currency} {inv.subtotal.toFixed(2)}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {inv.order_count > 0 && (
                                <span className="text-[10px] text-muted-foreground font-bold">{inv.order_count} orders</span>
                              )}
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(inv.invoice_date || inv.created_at), "MMM d, yyyy")}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <InvoiceFormDialog
                              invoice={inv}
                              companies={companies}
                              onSave={(data) => updateInvoice(inv.id, data)}
                              trigger={
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              }
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                setInvoiceToDelete(inv.id);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {inv.source === "fleetrunnr" && (
                          <Badge
                            variant="outline"
                            className="text-[8px] font-bold uppercase gap-1"
                          >
                            <Zap className="h-2.5 w-2.5" /> Fleetrunnr
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block rounded-2xl border-2 border-muted overflow-hidden bg-card">
              <Table>
                <TableHeader className="bg-muted/50 h-14">
                  <TableRow>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest pl-6">
                      Invoice
                    </TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest">
                      Type
                    </TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest">
                      Carrier / Merchant
                    </TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest">
                      Subtotal
                    </TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest">
                      Total
                    </TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest">
                      Orders
                    </TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest">
                      Date
                    </TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest">
                      Status
                    </TableHead>
                    <TableHead className="text-right font-bold text-[10px] uppercase tracking-widest pr-6">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell className="pl-6"><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    : filteredInvoices.length === 0
                    ? (
                        <TableRow>
                          <TableCell
                            colSpan={9}
                            className="h-64 text-center text-muted-foreground italic text-sm"
                          >
                            No invoices found.
                          </TableCell>
                        </TableRow>
                      )
                    : filteredInvoices.map((inv) => (
                        <TableRow
                          key={inv.id}
                          className="hover:bg-muted/30 group"
                        >
                          <TableCell className="pl-6 font-black text-sm">
                            {inv.invoice_number}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={cn(
                                "text-[9px] font-black uppercase tracking-widest border-none px-2 py-0.5",
                                inv.type === "received"
                                  ? "bg-orange-500/20 text-orange-700"
                                  : "bg-blue-500/20 text-blue-700"
                              )}
                            >
                              {inv.type === "received" ? (
                                <ArrowDownLeft className="h-3 w-3 mr-1 inline" />
                              ) : (
                                <ArrowUpRight className="h-3 w-3 mr-1 inline" />
                              )}
                              {inv.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {inv.merchant_name || (inv.delivery_company as any)?.name || "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            ${inv.subtotal?.toFixed(2) || '0.00'}
                          </TableCell>
                          <TableCell className="font-black text-sm">
                            ${inv.amount.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-sm text-center">
                            {inv.order_count > 0 ? inv.order_count : '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(inv.invoice_date || inv.created_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={cn(
                                "text-[9px] font-black uppercase tracking-widest border-none px-2 py-0.5",
                                statusColors[inv.status]
                              )}
                            >
                              {inv.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <InvoiceFormDialog
                                  invoice={inv}
                                  companies={companies}
                                  onSave={(data) =>
                                    updateInvoice(inv.id, data)
                                  }
                                  trigger={
                                    <DropdownMenuItem
                                      onSelect={(e) => e.preventDefault()}
                                    >
                                      <Edit className="h-4 w-4 mr-2" /> Edit
                                    </DropdownMenuItem>
                                  }
                                />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => {
                                    setInvoiceToDelete(inv.id);
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        ))}

        <TabsContent value="settlements" className="space-y-4">
          <div className="hidden md:block rounded-2xl border-2 border-muted overflow-hidden bg-card">
            <Table>
              <TableHeader className="bg-muted/50 h-14">
                <TableRow>
                  <TableHead className="font-bold text-[10px] uppercase tracking-widest pl-6">Settlement</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase tracking-widest">Carrier</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase tracking-widest">Amount</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase tracking-widest">Payout ID</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase tracking-widest">Date</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase tracking-widest">Status</TableHead>
                  <TableHead className="text-right font-bold text-[10px] uppercase tracking-widest pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="pl-6"><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : settlements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-64 text-center text-muted-foreground italic text-sm">No settlements found.</TableCell>
                  </TableRow>
                ) : settlements.map((s) => (
                  <TableRow key={s.id} className="hover:bg-muted/30 group">
                    <TableCell className="pl-6 font-black text-sm">{s.settlement_number}</TableCell>
                    <TableCell className="text-sm font-medium">{s.delivery_company?.name || '—'}</TableCell>
                    <TableCell className="font-black text-sm">${s.amount.toFixed(2)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.fleetrunnr_payout_id || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.settlement_date ? format(new Date(s.settlement_date), "MMM d, yyyy") : format(new Date(s.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "text-[9px] font-black uppercase tracking-widest border-none px-2 py-0.5",
                        s.status === 'paid' ? "bg-emerald-500/20 text-emerald-700" : "bg-yellow-500/20 text-yellow-700"
                      )}>
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button variant="ghost" size="sm" className="h-8 gap-2 font-bold text-[9px] uppercase tracking-widest"
                        onClick={() => updateSettlement(s.id, { status: s.status === 'paid' ? 'pending' : 'paid' })}>
                        Mark as {s.status === 'paid' ? 'Pending' : 'Paid'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden space-y-3">
             {settlements.map((s) => (
               <Card key={s.id} className="rounded-2xl border">
                 <CardContent className="p-4 space-y-3">
                   <div className="flex items-start justify-between">
                     <div>
                       <p className="font-black text-base">{s.settlement_number}</p>
                       <p className="text-xs text-muted-foreground">{s.delivery_company?.name || '—'}</p>
                     </div>
                     <Badge className={cn(
                        "text-[9px] font-black uppercase tracking-widest border-none px-2 py-0.5",
                        s.status === 'paid' ? "bg-emerald-500/20 text-emerald-700" : "bg-yellow-500/20 text-yellow-700"
                      )}>
                        {s.status}
                     </Badge>
                   </div>
                   <div className="flex items-center justify-between pt-2 border-t">
                     <p className="text-lg font-black">${s.amount.toFixed(2)}</p>
                     <Button variant="outline" size="sm" className="h-8 text-[9px] font-black uppercase tracking-widest"
                       onClick={() => updateSettlement(s.id, { status: s.status === 'paid' ? 'pending' : 'paid' })}>
                       Mark {s.status === 'paid' ? 'Pending' : 'Paid'}
                     </Button>
                   </div>
                 </CardContent>
               </Card>
             ))}
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Invoice"
        description="Are you sure you want to delete this invoice? This action cannot be undone."
        onConfirm={handleDeleteConfirm}
        variant="destructive"
        confirmText="Delete Invoice"
      />
    </div>
  );
}
