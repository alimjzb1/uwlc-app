import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useDashboard } from "@/hooks/use-dashboard";
import { useOrderAnalytics } from "@/hooks/use-orders";
import { useShopifySync } from "@/hooks/use-shopify-sync";
import { useAppSettings } from "@/hooks/use-app-settings";
import { Users, AlertCircle, Truck, ShoppingBag, ChevronRight, Package, XOctagon, DollarSign, RefreshCw } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { AnalyticsPopup } from "@/components/AnalyticsPopup";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  // Set default date to today
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date()
  });
  const { metrics, loading, error, refresh: refreshMetrics } = useDashboard(dateRange);
  const { packagableCount, blockedCount, missingSummary, blockedOrders, packagableOrders, inventoryImpact, loading: analyticsLoading, refresh: refreshAnalytics } = useOrderAnalytics();
  
  const { syncRecentOrders, isSyncing } = useShopifySync();
  const { getSetting } = useAppSettings();
  const defaultPageSize = getSetting('default_page_size', 50);

  // Auto-sync on load
  useEffect(() => {
    syncRecentOrders(Number(defaultPageSize))
      .then(() => {
        refreshMetrics();
        refreshAnalytics();
      })
      .catch(err => console.error("Auto-sync failed:", err));
  }, []); // Only on initial mount

  const handleSync = async () => {
    try {
      await syncRecentOrders(Number(defaultPageSize));
      refreshMetrics();
      refreshAnalytics();
    } catch (err) {
      console.error("Manual sync failed:", err);
    }
  };

  if (error) {
    return <div className="p-8 text-red-500">Error loading dashboard: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <div className="flex items-center gap-2">
           <DatePickerWithRange date={dateRange} setDate={setDateRange} />
           <Button
             variant="outline"
             size="sm"
             onClick={handleSync}
             disabled={isSyncing}
             className="h-9 gap-2 font-black uppercase text-[10px] tracking-widest hidden sm:flex"
           >
             <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
             {isSyncing ? 'Syncing...' : 'Sync'}
           </Button>
        </div>
      </div>

      
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
        
        {/* Total Sales */}
        <div className="md:col-span-3 lg:col-span-4 xl:col-span-1">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer bg-primary text-primary-foreground">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-primary-foreground/80">Total Sales</CardTitle>
                <DollarSign className="h-4 w-4 text-primary-foreground/80" />
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-8 w-16 bg-primary-foreground/20" /> : <div className="text-2xl font-bold">${metrics.totalSales.toFixed(2)}</div>}
                <p className="text-xs text-primary-foreground/60 mt-1">Shopify revenue</p>
            </CardContent>
          </Card>
        </div>

        {/* Cancelled Sales */}
        <div className="md:col-span-3 lg:col-span-4 xl:col-span-1">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer bg-destructive/10 border-destructive/20 text-destructive">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Lost Revenue</CardTitle>
                <DollarSign className="h-4 w-4" />
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-8 w-16 bg-destructive/20" /> : <div className="text-2xl font-bold">${metrics.cancelledValue.toFixed(2)}</div>}
                <p className="text-xs text-destructive/70 mt-1">{metrics.cancelledCount} cancelled orders</p>
            </CardContent>
          </Card>
        </div>

        {/* Total Orders */}
        <Link to="/orders">
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{metrics.totalOrders}</div>}
                <p className="text-xs text-muted-foreground mt-1">For selected period</p>
            </CardContent>
            </Card>
        </Link>

        {/* Pending Approval */}
        <Link to="/orders?status=needs_approval">
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer border-yellow-200 bg-yellow-50/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-yellow-600">Pending Approval</CardTitle>
                <AlertCircle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
                 {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold text-yellow-700">{metrics.pendingApprovals}</div>}
                <p className="text-xs text-muted-foreground mt-1">Orders waiting for review</p>
            </CardContent>
            </Card>
        </Link>
        
        {/* Ready to Ship */}
        <Link to="/orders?status=ready_to_ship">
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-green-600">Ready to Ship</CardTitle>
                <Truck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
                 {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold text-green-700">{metrics.readyToShip}</div>}
                <p className="text-xs text-muted-foreground mt-1">Packaged & verified</p>
            </CardContent>
            </Card>
        </Link>

        {/* Total Customers */}
        <Link to="/customers">
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                 {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{metrics.totalCustomers}</div>}
                <p className="text-xs text-muted-foreground mt-1">New customers</p>
            </CardContent>
            </Card>
        </Link>

        {/* Packagable */}
        <div>
            <AnalyticsPopup type="packagable" packagableOrders={packagableOrders} inventoryImpact={inventoryImpact} loading={analyticsLoading}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer border-emerald-200 bg-emerald-50/10 h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-emerald-600">Packagable</CardTitle>
                <Package className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
                 {analyticsLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold text-emerald-700">{packagableCount}</div>}
                <p className="text-xs text-emerald-600/70 mt-1 underline decoration-dotted underline-offset-2 cursor-pointer">View Details</p>
            </CardContent>
            </Card>
            </AnalyticsPopup>
        </div>
        
        {/* Blocked Needs Stock */}
        <div>
            <AnalyticsPopup type="blocked" missingSummary={missingSummary} blockedOrders={blockedOrders} loading={analyticsLoading} color="rose">
            <Card className="hover:bg-muted/50 transition-colors border-rose-200 bg-rose-50/10 h-full cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-rose-600">Blocked Orders</CardTitle>
                <XOctagon className="h-4 w-4 text-rose-600" />
            </CardHeader>
            <CardContent>
                 {analyticsLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold text-rose-700">{blockedCount}</div>}
                 <p className="text-xs text-rose-600/70 mt-1 underline decoration-dotted underline-offset-2 cursor-pointer">
                    {missingSummary.length} Missing Items
                 </p>
            </CardContent>
            </Card>
            </AnalyticsPopup>
        </div>
      </div>

       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
                <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>
                        Latest updates from across the system. (Placeholder)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-8">
                         {metrics.recentActivity && metrics.recentActivity.length > 0 ? (
                             metrics.recentActivity.map((log) => (
                                 <div className="flex items-center" key={log.id}>
                                    <div className="space-y-1 w-full">
                                        <p className="text-sm font-medium leading-none capitalize">{log.action.replace(/_/g, ' ')}</p>
                                        <p className="text-xs text-muted-foreground truncate max-w-[280px]">
                                            By {log.user?.full_name || 'System'} on <span className="font-mono text-[10px] uppercase">{log.table_name}</span>
                                        </p>
                                    </div>
                                    <div className="ml-auto font-medium text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                                        {new Date(log.created_at).toLocaleDateString()}
                                    </div>
                                 </div>
                             ))
                         ) : (
                             <div className="flex items-center">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium italic text-muted-foreground">No recent activity detected.</p>
                                </div>
                             </div>
                         )}
                    </div>
                </CardContent>
            </Card>
            
            <Card className="col-span-3">
                <CardHeader>
                    <CardTitle>Inventory Status</CardTitle>
                    <CardDescription>
                        Items requiring attention.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <AlertCircle className="h-4 w-4 text-red-500" />
                                <span className="text-sm font-medium">Low Stock Items</span>
                            </div>
                            <span className="font-bold text-red-500">{loading ? '...' : metrics.lowStockItems}</span>
                        </div>
                        
                        <div className="pt-2 space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                            {metrics.lowStockProductsList.map((product) => (
                                <Link 
                                    key={product.id} 
                                    to={`/inventory/${product.id}`}
                                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 border border-transparent hover:border-muted/20 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                                            <Package className="h-4 w-4 text-red-500" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold truncate max-w-[120px]">{product.name}</span>
                                            <span className="text-[10px] font-mono text-muted-foreground uppercase">{product.sku}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-right flex flex-col items-end">
                                            <span className="text-xs font-black text-red-500">{product.quantity_on_hand}</span>
                                            <span className="text-[8px] font-black uppercase tracking-tighter opacity-40">Stock</span>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </Link>
                            ))}
                            {!loading && metrics.lowStockProductsList.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground text-xs font-medium italic opacity-50">
                                    All stock levels healthy.
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
       </div>
    </div>
  );
}
