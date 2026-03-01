import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  MapPin, 
  Loader2, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  ExternalLink 
} from "lucide-react";
import { toast } from "sonner";

import { format } from "date-fns";
import { OrderWorkflow } from "@/components/orders/OrderWorkflow";
import { supabase } from "@/lib/supabase";
import { CopyButton } from "@/components/ui/CopyButton";
import { useShopifySettings } from "@/hooks/use-shopify-settings";
import type { Order } from "@/types";


export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { settings } = useShopifySettings();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prevOrderId, setPrevOrderId] = useState<string | null>(null);
  const [nextOrderId, setNextOrderId] = useState<string | null>(null);
   const [productLinks, setProductLinks] = useState<Record<string, { id: string, qtyPerUnit: number }[]>>({}); 
   const [internalInventory, setInternalInventory] = useState<Record<string, { id: string, quantity: number, sku?: string }>>({}); 
   const [skuToId, setSkuToId] = useState<Record<string, string>>({});

  useEffect(() => {
    if (id) {
      fetchOrder(id);
    }
  }, [id]);

  async function fetchOrder(orderId: string) {
    setLoading(true);
    setError(null);
    console.log(`[OrderDetail] Fetching order: ${orderId}`);
    
    // Safety timeout for the fetch
    const timeout = setTimeout(() => {
        if (loading) {
            console.error("[OrderDetail] Fetch timed out");
            setError("Request timed out. Please try refreshing.");
            setLoading(false);
        }
    }, 10000);

    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          items:order_items(*),
          customer:customers(*),
          delivery_company:delivery_companies(*)
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      setOrder(data);

      // Fetch bridges and internal inventory to identify linked products accurately
      const [linksRes, inventoryRes] = await Promise.all([
          supabase.from('product_links').select('*'),
          supabase.from('products_inventory').select('id, sku, quantity_on_hand')
      ]);

      const bridgeMap: Record<string, { id: string, qtyPerUnit: number }[]> = {};
      linksRes.data?.forEach(l => {
          const vId = l.shopify_variant_id;
          const comp = { id: l.inventory_product_id, qtyPerUnit: l.quantity_per_unit || 1 };
          if (!bridgeMap[vId]) bridgeMap[vId] = [];
          bridgeMap[vId].push(comp);
      });
      setProductLinks(bridgeMap);

      const invMap: Record<string, { id: string, quantity: number, sku?: string }> = {};
      const skuMap: Record<string, string> = {};
      inventoryRes.data?.forEach(p => {
          invMap[p.id] = { id: p.id, quantity: p.quantity_on_hand || 0, sku: p.sku };
          if (p.sku) skuMap[p.sku] = p.id;
      });
      setInternalInventory(invMap);
      setSkuToId(skuMap);

      console.log("[OrderDetail] Order data loaded successfully");

      // Fetch navigation relative to this order's creation time
      if (data) {
        try {
            // Prev: created before current
            const { data: prev } = await supabase
              .from('orders')
              .select('id')
              .lt('created_at', data.created_at)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            // Next: created after current
            const { data: next } = await supabase
              .from('orders')
              .select('id')
              .gt('created_at', data.created_at)
              .order('created_at', { ascending: true })
              .limit(1)
              .maybeSingle();

            setPrevOrderId(prev?.id || null);
            setNextOrderId(next?.id || null);
        } catch (navErr) {
            console.warn("[OrderDetail] Failed to fetch nav IDs:", navErr);
        }
      }

    } catch (err: any) {
      console.error("[OrderDetail] Error fetching order:", err);
      setError(err.message);
      setOrder(null);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
      console.log("[OrderDetail] Loading set to false");
    }
  }

  const refreshOrder = () => {
    if (id) fetchOrder(id);
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <p className="text-red-500">Error loading order: {error || 'Order not found'}</p>
        <Button asChild variant="outline">
          <Link to="/orders">Back to Orders</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
            <Link to="/orders">
                <ArrowLeft className="h-4 w-4" />
            </Link>
            </Button>
            <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              Order #{order.shopify_order_number}
              <CopyButton value={order.shopify_order_number} label="Order #" />
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-muted-foreground mr-2">
                {format(new Date(order.created_at), "PPP p")}
            </p>
            <span className="text-[10px] font-mono font-black uppercase tracking-wider text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-md">ID: {order.shopify_order_id}</span>
            <CopyButton value={order.shopify_order_id} label="Shopify ID" />
          </div>
          </div>
          <div className="flex items-center gap-2">
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
                        const url = `https://admin.shopify.com/store/${storeName}/orders/${order.shopify_order_id}`;
                        navigator.clipboard.writeText(url);
                        toast.success("Shopify Admin URL copied");
                    }}
                    className="text-xs font-semibold cursor-pointer"
                  >
                    Shopify Admin URL
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                       Edit Status <ChevronDown className="ml-2 h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {["new", "packaging", "needs_approval", "ready_to_ship", "shipped", "delivered", "cancelled"].map((s) => (
                        <DropdownMenuItem 
                        key={s} 
                        onClick={async () => {
                            try {
                                const { error } = await supabase.from('orders').update({ internal_status: s }).eq('id', order.id);
                                if (error) throw error;
                                refreshOrder();
                            } catch (err: any) {
                                toast.error("Failed to update status: " + err.message);
                            }
                        }}
                        className="uppercase text-xs font-bold"
                        >
                        {s.replace(/_/g, ' ')}
                        </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Badge variant="outline" className="text-base text-foreground bg-background">
                    {order.financial_status.toUpperCase()}
                </Badge>
                <Badge className="text-base">
                    {order.internal_status?.replace('_', ' ').toUpperCase()}
                </Badge>
            </div>

        </div>
        
        <div className="flex flex-col gap-1">
            <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={!nextOrderId}
                onClick={() => nextOrderId && navigate(`/orders/${nextOrderId}`)}
                title="Next Order"
            >
                <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={!prevOrderId}
                onClick={() => prevOrderId && navigate(`/orders/${prevOrderId}`)}
                title="Previous Order"
            >
                <ChevronDown className="h-4 w-4" />
            </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Order Items</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="font-black text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">Product</TableHead>
                                <TableHead className="text-right font-black text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">Qty</TableHead>
                                <TableHead className="text-right font-black text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">Price</TableHead>
                                <TableHead className="text-right font-black text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {order.items?.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-2 group">
                                            {(() => {
                                                const shopifyVariantId = item.shopify_variant_id || null;
                                                const sku = item.sku;
                                                
                                                const bridges = shopifyVariantId ? (productLinks[shopifyVariantId] || []) : [];
                                                const internalProductIds = bridges.length > 0 
                                                    ? bridges 
                                                    : (sku && skuToId[sku] 
                                                        ? [{ id: skuToId[sku], qtyPerUnit: 1 }] 
                                                        : (item.product_id && item.product_id.length > 20 
                                                            ? [{ id: item.product_id, qtyPerUnit: 1 }] 
                                                            : []));
                                                
                                                if (internalProductIds.length > 0) {
                                                    return (
                                                        <div className="flex flex-col gap-2 w-full">
                                                            <div className="font-bold text-sm text-foreground">{item.name}</div>
                                                            <div className="space-y-1.5 ml-2 border-l-2 border-muted pl-3 py-0.5">
                                                                {internalProductIds.map((comp, idx) => {
                                                                    const inv = internalInventory[comp.id];
                                                                    const stock = inv?.quantity || 0;
                                                                    const availSets = Math.floor(stock / comp.qtyPerUnit);
                                                                    const isThisCompShort = availSets < item.quantity;
                                                                    
                                                                    return (
                                                                        <div key={`${comp.id}-${idx}`} className="flex flex-col">
                                                                            <div className="flex items-center justify-between gap-4">
                                                                                <Link to={`/inventory/${comp.id}`} className="text-[11px] font-bold text-muted-foreground hover:text-primary hover:underline flex items-center gap-1 group/link">
                                                                                    {inv?.sku || '??'} | {comp.qtyPerUnit}u 
                                                                                    <ExternalLink className="h-2 w-2 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                                                                                </Link>
                                                                                <span className={`text-[10px] font-mono font-black ${isThisCompShort ? 'text-destructive' : 'text-emerald-500'}`}>
                                                                                    {Math.min(availSets, item.quantity)}/{item.quantity}
                                                                                </span>
                                                                            </div>
                                                                            {isThisCompShort && (
                                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                                    <Badge variant="destructive" className="text-[8px] h-3 px-1 font-black uppercase tracking-tighter rounded-sm">Short {item.quantity - availSets}</Badge>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                
                                                return (
                                                    <div className="flex flex-col gap-1">
                                                        <span className="font-bold text-sm text-muted-foreground">{item.name}</span>
                                                        <Badge variant="outline" className="text-[9px] h-4 font-bold bg-amber-500/5 text-amber-500 border-amber-500/20 w-fit">Not Linked</Badge>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        <div className="text-[10px] font-mono text-muted-foreground mb-1 uppercase tracking-wide">{item.sku}</div>
                                    </TableCell>

                                    <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                                    <TableCell className="text-right font-medium">
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency }).format(item.price)}
                                    </TableCell>
                                    <TableCell className="text-right font-bold">
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency }).format(item.price * item.quantity)}
                                    </TableCell>
                                </TableRow>
                            ))}
                            <TableRow>
                                <TableCell colSpan={3} className="font-black text-[10px] uppercase tracking-widest text-muted-foreground/70 text-right">Subtotal</TableCell>
                                <TableCell className="text-right font-bold">
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency }).format(order.subtotal_price)}
                                </TableCell>
                            </TableRow>
                             <TableRow>
                                <TableCell colSpan={3} className="font-black text-[10px] uppercase tracking-widest text-muted-foreground/70 text-right">Tax</TableCell>
                                <TableCell className="text-right font-bold">
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency }).format(order.total_tax)}
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell colSpan={3} className="font-black text-[10px] uppercase tracking-widest text-primary text-right">Total</TableCell>
                                <TableCell className="text-right font-black text-lg text-primary">
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency }).format(order.total_price)}
                                </TableCell>
                            </TableRow>
                        </TableBody>

                    </Table>
                </CardContent>
            </Card>

            {(() => {
                let isPackagable = true;
                if (order.items) {
                    for (const item of order.items) {
                        const shopifyVariantId = item.shopify_variant_id || null;
                        const sku = item.sku;
                        const bridges = shopifyVariantId ? (productLinks[shopifyVariantId] || []) : [];
                        const internalProductIds = bridges.length > 0 
                            ? bridges 
                            : (sku && skuToId[sku] 
                                ? [{ id: skuToId[sku], qtyPerUnit: 1 }] 
                                : (item.product_id && item.product_id.length > 20 
                                    ? [{ id: item.product_id, qtyPerUnit: 1 }] 
                                    : []));
                        
                        const isShort = internalProductIds.some(comp => {
                            const stock = internalInventory[comp.id]?.quantity || 0;
                            return Math.floor(stock / comp.qtyPerUnit) < item.quantity;
                        });

                        if (internalProductIds.length > 0 && isShort) {
                            isPackagable = false;
                            break;
                        }
                    }
                }
                return <OrderWorkflow order={order} onOrderUpdated={refreshOrder} isPackagable={isPackagable} />;
            })()}
            {/* OrderApproval is now integrated into OrderWorkflow, we can remove this or keep it if separate? 
                The user asked to add approval logic. I added it to OrderWorkflow.
                I will remove OrderApproval component usage if it conflicts or is redundant.
                Actually, let's keep it commented out or remove it if I am sure OrderWorkflow handles it.
                I'll leave it for now but I suspect it might be redundant. 
                Wait, I see `OrderApproval` imported. Let's assume OrderWorkflow covers 'packaging -> needs_approval -> ready_to_ship'.
                If `OrderApproval` covers 'needs_approval -> ready_to_ship', then I duplicated it.
                I implemented Approval in OrderWorkflow. So I will remove OrderApproval here.
            */}
            {/* <OrderApproval order={order} onOrderUpdated={refreshOrder} /> */}
        </div>

        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Customer Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center font-bold text-lg">
                            {order.customer?.first_name?.[0]}{order.customer?.last_name?.[0]}
                        </div>
                        <div>
                        {order.customer ? (
                            <div className="flex items-center gap-1">
                              <Link to={`/customers/${order.customer.id}`} className="font-medium hover:text-primary hover:underline transition-all">
                                  {order.customer.first_name} {order.customer.last_name}
                              </Link>
                              {order.customer.shopify_customer_id && (
                                <CopyButton value={order.customer.shopify_customer_id} label="Customer ID" />
                              )}
                            </div>
                        ) : (
                            <div className="font-medium">Unknown Customer</div>
                        )}
                        <div className="text-sm text-muted-foreground">Customer since {order.customer?.created_at ? format(new Date(order.customer.created_at), 'MMM yyyy') : 'N/A'}</div>
                    </div>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <a href={`mailto:${order.email}`} className="hover:underline">{order.email}</a>
                        </div>
                        {order.customer?.phone && (
                            <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <a href={`tel:${order.customer.phone}`} className="hover:underline">{order.customer.phone}</a>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle>Shipping Address</CardTitle>
                    {order.shipping_address && (
                        <CopyButton 
                            value={[
                                order.shipping_address.name,
                                order.shipping_address.address1,
                                order.shipping_address.address2,
                                `${order.shipping_address.city}, ${order.shipping_address.province} ${order.shipping_address.zip}`,
                                order.shipping_address.country
                            ].filter(Boolean).join('\n')} 
                            label="Address" 
                        />
                    )}
                </CardHeader>
                <CardContent className="flex items-start gap-2 pt-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="text-sm border-l-2 border-muted/30 pl-3">
                        {order.shipping_address ? (
                            <>
                                <div className="font-bold text-foreground">{order.shipping_address.name}</div>
                                <div className="text-muted-foreground mt-1 leading-relaxed">
                                    {order.shipping_address.address1}<br/>
                                    {order.shipping_address.address2 && <>{order.shipping_address.address2}<br/></>}
                                    {order.shipping_address.city}, {order.shipping_address.province} {order.shipping_address.zip}
                                </div>
                                <div className="font-medium text-foreground mt-1">{order.shipping_address.country}</div>
                            </>
                        ) : (
                            <span className="text-muted-foreground italic">No shipping address provided</span>
                        )}
                    </div>
                </CardContent>
            </Card>
            
            {(order.note || order.tags || order.tracking_number) && (
                <Card>
                    <CardHeader>
                        <CardTitle>Shopify Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {order.note && (
                            <div>
                                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Note</div>
                                <p className="text-sm border-l-2 border-muted pl-2 italic text-muted-foreground">{order.note}</p>
                            </div>
                        )}
                        
                        {order.tags && order.tags.length > 0 && (
                            <div>
                                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Tags</div>
                                <div className="flex flex-wrap gap-1">
                                    {(Array.isArray(order.tags) ? order.tags : (order.tags as string).split(',')).map((tag: string, i: number) => (
                                        <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0.5">{tag.trim()}</Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {(order.tracking_number || order.tracking_url) && (
                            <div>
                                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Tracking</div>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-sm">{order.tracking_number || "No Number"}</span>
                                    {order.tracking_number && (
                                      <CopyButton value={order.tracking_number} label="Tracking #" />
                                    )}
                                    {order.tracking_url && (
                                      <>
                                        <CopyButton value={order.tracking_url} label="Tracking URL" />
                                        <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                                            <a href={order.tracking_url} target="_blank" rel="noopener noreferrer">
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                        </Button>
                                      </>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
            
            {/* Kept separate if needed, but merged above for cleaner UI as per request "place to show notes, tags..." */ }

        </div>
      </div>
    </div>
  );
}
