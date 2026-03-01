import { useState, useEffect, useMemo } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";

import { Search, Filter, Loader2, CheckCircle2, X, ArrowUp, ArrowDown, RefreshCw, Package, AlertCircle, Truck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AnalyticsPopup } from "@/components/AnalyticsPopup";


import { useOrders, useOrderAnalytics } from "@/hooks/use-orders";
import { useShopifySync } from "@/hooks/use-shopify-sync";
import { useFleetrunnr } from "@/hooks/use-fleetrunnr";
import { useInventory } from "@/hooks/use-inventory";
import { useAppSettings } from "@/hooks/use-app-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { PageSizeSelector } from "@/components/ui/PageSizeSelector";
import { CopyButton } from "@/components/ui/CopyButton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

export default function Orders() {
  const navigate = useNavigate();
  const { getSetting } = useAppSettings();
  const { syncRecentOrders, isSyncing } = useShopifySync();
  const { syncDeliveryStatuses, isSyncing: isSyncingDelivery } = useFleetrunnr();

  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status');

  const defaultPageSize = getSetting('default_page_size', 50);
  const [pageSize, setPageSize] = useState<string>(String(defaultPageSize));
  const [activeTab, setActiveTab] = useState<'all' | 'unfulfilled' | 'fulfilled'>('all');
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(initialStatus ? [initialStatus] : []);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [packagability, setPackagability] = useState<'all' | 'packagable' | 'blocked'>('all');

  // Update page size when setting loads
  useEffect(() => {
    if (defaultPageSize) setPageSize(String(defaultPageSize));
  }, [defaultPageSize]);

  const filters = useMemo(() => ({
    status: selectedStatuses,
    dateRange: dateRange ? { from: dateRange.from!, to: dateRange.to! } : undefined,
    search: searchTerm,
    tab: activeTab,
    sortOrder: sortOrder,
    pageSize: pageSize,
    showCancelled: showCancelled
  }), [selectedStatuses, dateRange, searchTerm, activeTab, sortOrder, pageSize, showCancelled]);

  const { orders, loading, error, refreshOrders, bulkUpdateOrders } = useOrders(filters);
  const { deductStockForOrder } = useInventory();

  const { packagableCount, blockedCount, missingSummary, blockedOrders, packagableOrders, inventoryImpact, loading: analyticsLoading } = useOrderAnalytics();

  const displayedOrders = useMemo(() => {
    let result = orders;
    if (packagability === 'packagable') {
      result = result.filter(o => o.isPackagable && o.internal_status === 'new');
    } else if (packagability === 'blocked') {
      result = result.filter(o => !o.isPackagable && o.internal_status === 'new' && o.fulfillment_status !== 'fulfilled');
    }
    return result;
  }, [orders, packagability]);

  // Handle outside status updates (e.g. from Dashboard)
  useEffect(() => {
    const status = searchParams.get('status');
    if (status && !selectedStatuses.includes(status)) {
      setSelectedStatuses([status]);
    }
  }, [searchParams]);

  const toggleOrderSelection = (id: string) => {
    setSelectedOrders(prev => 
      prev.includes(id) ? prev.filter(oid => oid !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedOrders.length === orders.length && orders.length > 0) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(orders.map(o => o.id));
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    setIsProcessingBulk(true);
    try {
      if (status === 'packaging') {
          // Verify all selected orders are new and packagable
          const invalidOrders = selectedOrders.filter(id => {
              const order = orders.find(o => o.id === id);
              return !order || !order.isPackagable || order.internal_status !== 'new';
          });
          
          if (invalidOrders.length > 0) {
              toast.error(`Cannot package ${invalidOrders.length} order(s). They must be "new" and have sufficient stock.`);
              setIsProcessingBulk(false);
              return;
          }

          const successfulIds = [];
          for (const id of selectedOrders) {
             const deduction = await deductStockForOrder(id);
             if (deduction?.success) {
                 successfulIds.push(id);
             } else {
                 toast.error(`Skipped order (Insufficient Stock): ${id.slice(-6)}`);
             }
          }
          if (successfulIds.length > 0) {
              await bulkUpdateOrders(successfulIds, { internal_status: 'packaging' });
              toast.success(`Advanced ${successfulIds.length} orders to packaging.`);
          }
      } else {
          await bulkUpdateOrders(selectedOrders, { internal_status: status as any });
      }
      setSelectedOrders([]);
    } catch (error) {
       console.error("Bulk update error:", error);
       toast.error("Failed to update orders. Please try again.");
    } finally {
      setIsProcessingBulk(false);
    }
  };



  const handleSync = async () => {
    try {
      await syncRecentOrders(Number(pageSize));
      refreshOrders();
      toast.success('Orders synced successfully');
    } catch (err: any) {
      toast.error('Sync failed: ' + err.message);
    }
  };

  const handleDeliverySync = async () => {
    try {
      const result = await syncDeliveryStatuses();
      refreshOrders();
      if (result.failed > 0) {
          toast.warning(`Delivery sync finished. Updated ${result.updated}, failed ${result.failed}`);
      } else {
          toast.success(`Delivery sync finished. Updated ${result.updated} orders.`);
      }
    } catch (err: any) {
      toast.error('Delivery sync failed: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 relative pb-24 min-h-[800px] animate-in fade-in duration-500">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-black tracking-tighter text-foreground uppercase italic ring-offset-4">Orders</h1>
          <p className="text-muted-foreground font-medium text-lg">
            Track and manage your Shopify fulfillment workflow.
            {displayedOrders.length > 0 && <span className="ml-2 text-sm font-bold text-muted-foreground/60">({displayedOrders.length} shown)</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PageSizeSelector value={pageSize} onChange={setPageSize} />
          
          <div className="flex bg-muted/50 p-1 rounded-md">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeliverySync}
                disabled={isSyncingDelivery || isSyncing}
                className="h-8 gap-2 font-black uppercase text-[10px] tracking-widest text-muted-foreground hover:text-foreground hover:bg-background shadow-none"
              >
                <Truck className={cn("h-3.5 w-3.5", isSyncingDelivery && "animate-pulse text-primary")} />
                {isSyncingDelivery ? 'Checking...' : 'Delivery'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSync}
                disabled={isSyncing || isSyncingDelivery}
                className="h-8 gap-2 font-black uppercase text-[10px] tracking-widest text-muted-foreground hover:text-foreground hover:bg-background shadow-none"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin text-primary")} />
                {isSyncing ? 'Syncing...' : 'Shopify'}
              </Button>
          </div>
        </div>
      </div>

      {/* Analytics Summary */}
      {(activeTab === 'all' || activeTab === 'unfulfilled') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 mb-2">
            <AnalyticsPopup type="packagable" packagableOrders={packagableOrders} inventoryImpact={inventoryImpact} loading={analyticsLoading}>
              <Card className="bg-card/50 border-muted/20 shadow-sm hover:shadow-md transition-all cursor-pointer">
               <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                     <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Packagable Orders</p>
                     <div className="text-2xl font-black">{analyticsLoading ? <Skeleton className="h-6 w-8" /> : packagableCount}</div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500/60 leading-[10px] underline decoration-dotted underline-offset-2 w-fit">
                        View Details
                     </p>
                  </div>
                  <div className="h-10 w-10 bg-emerald-500/10 text-emerald-500 flex items-center justify-center rounded-xl"><Package className="h-5 w-5" /></div>
               </CardContent>
              </Card>
            </AnalyticsPopup>
            <AnalyticsPopup type="blocked" missingSummary={missingSummary} blockedOrders={blockedOrders} loading={analyticsLoading} color="amber">
              <Card className="bg-card/50 border-muted/20 shadow-sm transition-all cursor-pointer">
               <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                     <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">Blocked Orders</p>
                     <div className="text-2xl font-black">{analyticsLoading ? <Skeleton className="h-6 w-8" /> : blockedCount}</div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-amber-500/60 leading-[10px] underline decoration-dotted underline-offset-2 w-fit">
                        {analyticsLoading ? '...' : missingSummary.length} Missing Items
                     </p>
                  </div>
                  <div className="h-10 w-10 bg-amber-500/10 text-amber-500 flex items-center justify-center rounded-xl"><AlertCircle className="h-5 w-5" /></div>
               </CardContent>
              </Card>
            </AnalyticsPopup>
        </div>
      )}

      <div className="flex flex-col gap-4 py-4 border-y border-muted/20">
        {/* ROW 1: Search and Tabs */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 w-full">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              type="search"
              placeholder="Search by order #, customer, or email..."
              className="pl-10 h-12 bg-card/50 border-muted-foreground/10 focus-visible:ring-primary/50 text-base font-medium rounded-xl w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="shrink-0 w-full md:w-auto">
            <TabsList className="h-12 bg-card/30 p-1 border border-muted/20 rounded-xl w-full flex">
              <TabsTrigger value="all" className="flex-1 text-[10px] font-black uppercase tracking-widest px-2 sm:px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">All</TabsTrigger>
              <TabsTrigger value="unfulfilled" className="flex-1 text-[10px] font-black uppercase tracking-widest px-2 sm:px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Unfulfilled</TabsTrigger>
              <TabsTrigger value="fulfilled" className="flex-1 text-[10px] font-black uppercase tracking-widest px-2 sm:px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Fulfilled</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        {/* ROW 2: Filters and Statuses */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 w-full bg-muted/5 p-2 rounded-2xl border border-muted/20">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                {(activeTab === 'all' || activeTab === 'unfulfilled') && (
                  <div className="flex items-center space-x-4 shrink-0 bg-background px-4 h-11 rounded-xl border border-muted/20 shadow-sm">
                    <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setPackagability(packagability === 'packagable' ? 'all' : 'packagable')}>
                      <Checkbox 
                        id="filter-packagable" 
                        checked={packagability === 'packagable'}
                        onCheckedChange={(checked) => setPackagability(checked ? 'packagable' : 'all')}
                      />
                      <label htmlFor="filter-packagable" className="text-[10px] font-black uppercase tracking-widest text-emerald-500 cursor-pointer">Packagable</label>
                    </div>
                    <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setPackagability(packagability === 'blocked' ? 'all' : 'blocked')}>
                      <Checkbox 
                        id="filter-blocked" 
                        checked={packagability === 'blocked'}
                        onCheckedChange={(checked) => setPackagability(checked ? 'blocked' : 'all')}
                      />
                      <label htmlFor="filter-blocked" className="text-[10px] font-black uppercase tracking-widest text-amber-500 cursor-pointer">Blocked</label>
                    </div>
                  </div>
                )}

                {activeTab !== 'all' && (
                  <div className="flex items-center space-x-2 shrink-0 bg-background px-4 h-11 rounded-xl border border-muted/20 shadow-sm">
                    <Checkbox 
                      id="show-cancelled" 
                      checked={showCancelled}
                      onCheckedChange={(checked) => setShowCancelled(checked as boolean)}
                    />
                    <label
                      htmlFor="show-cancelled"
                      className="text-[10px] font-black uppercase tracking-widest text-muted-foreground cursor-pointer"
                    >
                      Show Cancelled
                    </label>
                  </div>
                )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 w-full md:w-auto">
                <DatePickerWithRange date={dateRange} setDate={setDateRange} />
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-11 gap-2 shrink-0 bg-background font-black uppercase text-[10px] tracking-widest border border-muted/20 shadow-sm hover:border-primary/50 hover:bg-primary/5">
                  <Filter className="h-4 w-4" />
                  <span className="hidden sm:inline">Status</span>
                  {selectedStatuses.length > 0 && (
                    <Badge variant="secondary" className="ml-1 rounded flex h-5 w-5 items-center justify-center p-0 font-black bg-primary text-primary-foreground border-none">
                      {selectedStatuses.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[220px] rounded-xl border-muted/20 shadow-2xl p-2 bg-popover/95 backdrop-blur-lg">
                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 px-2 py-1.5 lowercase">Filter by Status</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-muted/10 my-1" />
                {["new", "packaging", "needs_approval", "ready_to_ship", "shipped", "delivered", "cancelled"].map((status) => (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={selectedStatuses.includes(status)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedStatuses(prev => [...prev, status]);
                      } else {
                        setSelectedStatuses(prev => prev.filter(s => s !== status));
                      }
                    }}
                    className="capitalize font-bold text-sm tracking-tight rounded-lg my-0.5 focus:bg-primary/10 focus:text-primary transition-colors"
                  >
                    {status.replace(/_/g, ' ')}
                  </DropdownMenuCheckboxItem>
                ))}
                {selectedStatuses.length > 0 && (
                  <>
                    <DropdownMenuSeparator className="bg-muted/10 my-1" />
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start text-[10px] font-black uppercase tracking-widest h-9 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
                      onClick={() => setSelectedStatuses([])}
                    >
                      Clear Filters
                    </Button>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-11 gap-2 shrink-0 bg-card/80 font-black uppercase text-[10px] tracking-widest border-muted-foreground/10 hover:border-primary/50 hover:bg-primary/5">
                  {sortOrder === 'desc' ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
                  <span className="hidden sm:inline">Sort: {sortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
                </Button>

              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[180px] rounded-xl border-muted/20 shadow-2xl p-2 bg-popover/95 backdrop-blur-lg">
                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 px-2 py-1.5">Creation Date</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-muted/10 my-1" />
                <DropdownMenuItem 
                  onClick={() => setSortOrder('desc')}
                  className={cn(
                    "font-bold text-sm tracking-tight rounded-lg my-0.5 focus:bg-primary/10 focus:text-primary transition-colors",
                    sortOrder === 'desc' && "bg-primary/5 text-primary"
                  )}
                >
                  Newest First
                  {sortOrder === 'desc' && <CheckCircle2 className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setSortOrder('asc')}
                  className={cn(
                    "font-bold text-sm tracking-tight rounded-lg my-0.5 focus:bg-primary/10 focus:text-primary transition-colors",
                    sortOrder === 'asc' && "bg-primary/5 text-primary"
                  )}
                >
                  Oldest First
                  {sortOrder === 'asc' && <CheckCircle2 className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>
      </div>

      <div className="rounded-2xl border-none bg-card shadow-[0_8px_40px_rgba(0,0,0,0.12)] overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/10 h-14 border-b border-muted/20">
            <TableRow className="hover:bg-transparent border-none">
              <TableHead className="w-[60px] px-6 text-center">
                <Checkbox 
                  checked={selectedOrders.length === orders.length && orders.length > 0}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                  className="border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
              </TableHead>
              <TableHead className="w-[140px] font-black text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">Order ID</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">Date</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">Customer</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">Total</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">Payment</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">Fulfillment</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">Status</TableHead>
              <TableHead className="text-right font-black text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70 pr-6">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i} className="border-b border-muted/5">
                  <TableCell className="px-6"><Skeleton className="h-4 w-4 rounded mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
                  <TableCell className="pr-6"><Skeleton className="h-8 w-20 ml-auto rounded-xl" /></TableCell>
                </TableRow>
              ))
            ) : error ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-destructive py-20 bg-destructive/5">
                  <div className="flex flex-col items-center gap-4">
                    <X className="h-10 w-10 opacity-50" />
                    <span className="font-black uppercase tracking-widest text-lg">Failed to load orders</span>
                    <p className="text-sm font-medium opacity-80 max-w-md mx-auto">{error}</p>
                    <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="mt-2 font-black uppercase text-[10px] tracking-widest px-8">Try Again</Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : displayedOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-96 text-center text-muted-foreground bg-muted/5">
                  <div className="flex flex-col items-center gap-4 opacity-40">
                    <Search className="h-12 w-12 mb-4" />
                    <p className="font-black uppercase tracking-widest text-lg">No orders found</p>
                    <p className="text-sm font-medium max-w-xs mx-auto">Adjust your search or filters to see more results in your inventory.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              displayedOrders.map((order) => (
                <TableRow 
                  key={order.id} 
                  className={cn(
                    "group border-b border-muted/5 transition-all duration-300 cursor-pointer",
                    selectedOrders.includes(order.id) ? "bg-primary/[0.03] hover:bg-primary/[0.08]" : "hover:bg-muted/[0.15]"
                  )}
                  onClick={(e) => {
                    // Prevent navigation if clicking checkbox or action buttons
                    if ((e.target as HTMLElement).closest('[data-no-click="true"]')) return;
                    // Navigate to order detail
                    navigate(`/orders/${order.id}`);
                  }}
                >
                  <TableCell className="px-6 text-center" data-no-click="true">
                    <Checkbox 
                      checked={selectedOrders.includes(order.id)}
                      onCheckedChange={() => toggleOrderSelection(order.id)}
                      aria-label={`Select order ${order.shopify_order_number}`}
                      className="border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                  </TableCell>
                  <TableCell className="py-5">
                    <div className="flex items-center gap-1">
                      <div className="font-black text-sm text-primary tracking-tighter drop-shadow-sm">
                        #{order.shopify_order_number}
                      </div>
                      <CopyButton value={order.shopify_order_number} label="Order #" />
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {/* Removed ID as requested */}
                    </div>
                    {order.internal_status === 'new' && order.fulfillment_status !== 'fulfilled' && (
                        order.isPackagable ? (
                            <Badge className="mt-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 shadow-none border hover:border-emerald-500/30 border-emerald-500/20 text-[9px] font-black uppercase tracking-widest">
                                100% Packagable
                            </Badge>
                        ) : (order.missingItems?.length ?? 0) > 0 ? (
                            <div className="mt-2 text-[8px] font-black uppercase tracking-widest text-amber-600 p-1.5 px-2 bg-amber-500/10 border border-amber-500/20 rounded-md w-fit max-w-[200px] leading-tight">
                                <span className="opacity-60 block mb-0.5">BLOCKED BY:</span>
                                {order.missingItems.slice(0,2).map(m => `${m.name} (${m.available}/${m.required})`).join(', ')}
                                {order.missingItems.length > 2 && ' + more'}
                            </div>
                        ) : null
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-black text-foreground uppercase tracking-tight">
                      {format(new Date(order.created_at), 'MMM dd, yyyy')}
                    </div>
                    <div className="text-[9px] font-bold text-muted-foreground opacity-60 uppercase mt-1">
                      {format(new Date(order.created_at), 'hh:mm a')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-black text-foreground tracking-tight">
                      {order.customer ? (
                        <Link to={`/customers/${order.customer.id}`} className="hover:text-primary hover:underline transition-all">
                          {order.customer.first_name} {order.customer.last_name}
                        </Link>
                      ) : 'No Customer'}
                    </div>
                    <div className="text-[10px] font-medium text-muted-foreground truncate max-w-[160px] opacity-70 mt-0.5">
                      {order.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-black text-foreground flex items-baseline gap-1">
                      <span className="text-[10px] font-bold opacity-40">{order.currency}</span>
                      {order.total_price.toFixed(2)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      "text-[9px] h-5 rounded-md px-2 font-black uppercase tracking-wider border-none shadow-sm",
                      order.financial_status === 'paid' ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                    )}>
                      {order.financial_status || 'Pending'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      "text-[9px] h-5 rounded-md px-2 font-black uppercase tracking-wider border-none shadow-sm",
                      order.fulfillment_status === 'fulfilled' ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                    )}>
                      {order.fulfillment_status || 'Unfulfilled'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="secondary"
                      className={cn(
                        "h-7 px-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest border-none ring-1 ring-inset transition-all",
                        order.internal_status === 'new' && "bg-blue-500/10 text-blue-500 ring-blue-500/20",
                        order.internal_status === 'packaging' && "bg-amber-500/10 text-amber-500 ring-amber-500/20",
                        order.internal_status === 'needs_approval' && "bg-purple-500/10 text-purple-500 ring-purple-500/20",
                        order.internal_status === 'ready_to_ship' && "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20",
                        order.internal_status === 'shipped' && "bg-slate-500/10 text-slate-500 ring-slate-500/20",
                        order.internal_status === 'cancelled' && "bg-rose-500/10 text-rose-500 ring-rose-500/20",
                        order.internal_status === 'delivered' && "bg-green-500/10 text-green-500 ring-green-500/20"
                      )}
                    >
                      {order.internal_status.replace(/_/g, ' ')}
                    </Badge>

                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <Button variant="ghost" size="sm" asChild className="h-9 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-primary hover:text-primary-foreground transition-all shadow-sm hover:shadow-primary/30">
                      <Link to={`/orders/${order.id}`}>
                        View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Floating Bulk Actions Bar */}
      {selectedOrders.length > 0 && (

        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8 duration-500 transition-all flex justify-center w-full max-w-fit pointer-events-none">
          <div className="flex items-center gap-4 px-6 py-3 bg-card/90 backdrop-blur-xl border border-primary/30 shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-full mx-4 pointer-events-auto">
            <div className="flex items-center gap-3 pr-5 border-r border-muted-foreground/20">
              <div className="flex items-center justify-center bg-primary text-primary-foreground h-7 w-7 rounded-full text-xs font-black shadow-lg shadow-primary/30 ring-2 ring-background">
                {selectedOrders.length}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black leading-none uppercase tracking-tight">Active Selection</span>
                <span className="text-[10px] text-muted-foreground font-medium">Orders will be updated batch</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {[
                { label: 'Start Packing', val: 'packaging', color: 'bg-amber-500 hover:bg-amber-600' },
                { label: 'Set Ready', val: 'ready_to_ship', color: 'bg-emerald-500 hover:bg-emerald-600' },
                { label: 'Mark Shipped', val: 'shipped', color: 'bg-primary hover:bg-primary/90' }
              ].map(action => (
                <Button 
                  key={action.val}
                  size="sm" 
                  disabled={isProcessingBulk}
                  onClick={() => handleBulkStatusChange(action.val)}
                  className={cn(
                    "h-9 px-4 text-[10px] font-black uppercase tracking-wider text-primary-foreground border-none shadow-md transition-all active:scale-95",
                    action.color,
                    isProcessingBulk && "opacity-50 pointer-events-none"
                  )}
                >
                  {isProcessingBulk ? (
                    <Loader2 className="h-4 w-4 animate-spin -ml-1 mr-1.5" />
                  ) : (
                    <>
                      {action.label === 'Set Ready' && <CheckCircle2 className="h-4 w-4 mr-1.5 hidden sm:inline" />}
                      {action.label === 'Start Packing' && <Package className="h-4 w-4 mr-1.5 hidden sm:inline" />}
                      {action.label === 'Mark Shipped' && <Truck className="h-4 w-4 mr-1.5 hidden sm:inline" />}
                    </>
                  )}
                  <span>{isProcessingBulk && action.val === 'packaging' ? 'Processing...' : action.label}</span>
                </Button>
              ))}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-9 px-4 text-[10px] font-black uppercase tracking-wider ml-2">
                    More...
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {["new", "packaging", "needs_approval", "ready_to_ship", "shipped", "delivered", "cancelled"].map((status) => (
                    <DropdownMenuItem key={status} onClick={() => handleBulkStatusChange(status)} className="uppercase text-xs font-bold">
                       Set as {status.replace(/_/g, ' ')}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

            </div>

            <div className="pl-2 ml-1">
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-8 w-8 p-0 rounded-full hover:bg-muted transition-colors group"
                onClick={() => setSelectedOrders([])}
                title="Deselect all"
              >
                <X className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:rotate-90 transition-all" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
