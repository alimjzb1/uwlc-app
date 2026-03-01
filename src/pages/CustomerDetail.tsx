import { useCustomer } from "@/hooks/use-customers";
import { Link, useParams } from "react-router-dom";
import { useShopifySettings } from "@/hooks/use-shopify-settings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Mail, Phone, ShoppingBag, Loader2, MapPin, ChevronDown, Copy } from "lucide-react";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { CopyButton } from "@/components/ui/CopyButton";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const { customer, orders, loading, error } = useCustomer(id!);
  const { settings } = useShopifySettings();

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <p className="text-red-500">Error loading customer: {error || 'Customer not found'}</p>
        <Button asChild variant="outline">
          <Link to="/customers">Back to Customers</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link to="/customers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {customer.first_name} {customer.last_name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Customer ID: {customer.shopify_customer_id || customer.id}
          </p>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="font-bold text-[10px] uppercase tracking-wider gap-2 h-9 border-muted-foreground/20 bg-card/50">
               <Copy className="h-3.5 w-3.5" /> Copy URL <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[180px]">
            <DropdownMenuItem 
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success("App URL copied to clipboard");
              }}
              className="text-xs font-semibold cursor-pointer"
            >
              App URL
            </DropdownMenuItem>
            {customer.shopify_customer_id && (
                <DropdownMenuItem 
                  onClick={() => {
                        let storeName = "your-store";
                        if (settings?.myshopify_url) {
                            try {
                                const urlObj = new URL(settings.myshopify_url.startsWith('http') ? settings.myshopify_url : `https://${settings.myshopify_url}`);
                                storeName = urlObj.hostname.split('.')[0];
                            } catch (e) {
                                storeName = settings.myshopify_url.replace('.myshopify.com', '');
                            }
                        }
                      const url = `https://admin.shopify.com/store/${storeName}/customers/${customer.shopify_customer_id}`;
                      navigator.clipboard.writeText(url);
                      toast.success("Shopify Admin URL copied");
                  }}
                  className="text-xs font-semibold cursor-pointer"
                >
                  Shopify Admin URL
                </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Stats Cards */}
        <Card className="bg-primary/5 border-none shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-primary">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(customer.total_spent || 0)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/5 border-none shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Avg. Order Value</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="text-2xl font-black text-emerald-600 dark:text-emerald-500">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(customer.average_order_value || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{customer.orders_count} orders total</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/5 border-none shadow-none">
          <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Last Activity</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="text-2xl font-black text-blue-600 dark:text-blue-500">
              {customer.last_order_date ? format(new Date(customer.last_order_date), 'MMM d, yyyy') : 'Never'}
             </div>
             <p className="text-xs text-muted-foreground mt-1">Most recent purchase</p>
          </CardContent>
        </Card>

        {/* Customer Info Card */}
        <Card className="md:col-span-1 h-fit">
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-1">
               <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Email</span>
               <div className="flex items-center gap-2">
                 <Mail className="h-4 w-4 text-muted-foreground" />
                 <a href={`mailto:${customer.email}`} className="hover:underline text-sm">{customer.email}</a>
               </div>
            </div>
            <Separator />
            <div className="flex flex-col gap-1">
               <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Phone</span>
               <div className="flex items-center gap-2">
                 <Phone className="h-4 w-4 text-muted-foreground" />
                 <span className="text-sm">{customer.phone || 'No phone provided'}</span>
               </div>
            </div>
            <Separator />
            <div className="flex flex-col gap-1">
               <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Joined</span>
               <span className="text-sm">{customer.created_at ? format(new Date(customer.created_at), 'PPP') : 'N/A'}</span>
            </div>
            
            {(() => {
              const latestOrderWithAddress = orders.find(o => o.shipping_address);
              if (!latestOrderWithAddress) return null;
              const addr = latestOrderWithAddress.shipping_address;
              return (
                <>
                  <Separator />
                  <div className="flex flex-col gap-1 relative">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Primary Address</span>
                    <div className="flex items-start gap-2 mt-1">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="text-sm">
                        <div className="font-medium">{addr.name}</div>
                        <div>{addr.address1}</div>
                        {addr.address2 && <div>{addr.address2}</div>}
                        <div>{addr.city}, {addr.province} {addr.zip}</div>
                        <div>{addr.country}</div>
                      </div>
                    </div>
                    <div className="absolute top-0 right-0">
                      <CopyButton 
                        value={[
                          addr.name,
                          addr.address1,
                          addr.address2,
                          `${addr.city}, ${addr.province} ${addr.zip}`,
                          addr.country
                        ].filter(Boolean).join('\n')} 
                        label="Address" 
                      />
                    </div>
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>

        {/* Orders History Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Order History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No orders found for this customer.</p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Order</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.map((order) => (
                            <TableRow key={order.id}>
                                <TableCell className="font-medium">
                                    {order.shopify_order_number}
                                </TableCell>
                                <TableCell>
                                    {format(new Date(order.created_at), 'MMM d, yyyy')}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="capitalize">
                                        {order.fulfillment_status || 'Unfulfilled'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency }).format(order.total_price)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button size="sm" variant="ghost" asChild>
                                        <Link to={`/orders/${order.id}`}>View</Link>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
