import { Copy, Check, ExternalLink, Package, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import type { BlockedOrderDetail, PackagableOrderDetail, InventoryImpactItem } from '@/hooks/use-orders';

interface BlockedPopupProps {
    type: 'blocked';
    missingSummary: { name: string; sku: string; needed: number; source: 'inventory' | 'shopify'; current: number; used: number; remaining: number; demand: number }[];
    blockedOrders: BlockedOrderDetail[];
    loading?: boolean;
    color?: string;
    children: React.ReactNode;
}

interface PackagablePopupProps {
    type: 'packagable';
    packagableOrders: PackagableOrderDetail[];
    inventoryImpact: InventoryImpactItem[];
    loading?: boolean;
    children: React.ReactNode;
}

type AnalyticsPopupProps = BlockedPopupProps | PackagablePopupProps;

function OrderNumbersSection({ orders, colorClass }: { orders: { orderNumber: string; orderId: string }[]; colorClass: string }) {
    return (
        <div className="px-3 pt-2 pb-3 border-t border-muted/20 mt-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Order Numbers ({orders.length})</p>
            {orders.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">None</p>
            ) : (
                <div className="flex flex-wrap gap-1.5">
                    {orders.map((o, i) => (
                        <Link 
                            key={i}
                            to={`/orders/${o.orderId}`}
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold ${colorClass} hover:underline bg-muted/20 px-2 py-0.5 rounded`}
                        >
                            #{o.orderNumber}
                            <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

export function AnalyticsPopup(props: AnalyticsPopupProps) {
    const [copied, setCopied] = useState<'detailed' | 'simple' | boolean>(false);

    const handleCopy = (text: string, type: 'detailed' | 'simple' | boolean = true) => {
        navigator.clipboard.writeText(text);
        setCopied(type);
        setTimeout(() => setCopied(false), 2000);
    };

    if (props.type === 'blocked') {
        const { missingSummary, blockedOrders, loading, color = 'amber' } = props;
        const colorClasses = color === 'rose' 
            ? { header: 'bg-rose-500', text: 'text-rose-600', border: 'border-rose-500/30' }
            : { header: 'bg-amber-500', text: 'text-amber-600', border: 'border-amber-500/30' };

        const shopifyItems = missingSummary.filter(m => m.source === 'shopify');
        const inventoryItems = missingSummary.filter(m => m.source === 'inventory');

        const copyTextDetailed = [
            `BLOCKED ORDERS (${blockedOrders.length})`,
            `━━━━━━━━━━━━━━━━━━━━`,
            ...(shopifyItems.length > 0 ? [
                '',
                'SHOPIFY PRODUCTS:',
                ...shopifyItems.map(m => `  ${m.name}${m.sku ? ` (${m.sku})` : ''}: ${m.remaining} left → -${m.demand} needed → ${m.needed} to order`),
            ] : []),
            ...(inventoryItems.length > 0 ? [
                '',
                'INVENTORY PRODUCTS:',
                ...inventoryItems.map(m => `  ${m.name}${m.sku ? ` (${m.sku})` : ''}: ${m.remaining} left → -${m.demand} needed → ${m.needed} to order`),
            ] : []),
            '',
            'ORDER NUMBERS:',
            `  ${blockedOrders.map(o => `#${o.orderNumber}`).join(', ')}`,
        ].join('\n');

        const copyTextSimple = [
            `BLOCKED ORDERS (${blockedOrders.length})`,
            `━━━━━━━━━━━━━━━━━━━━`,
            ...(shopifyItems.length > 0 ? [
                '',
                'SHOPIFY PRODUCTS:',
                ...shopifyItems.map(m => `  ${m.name}${m.sku ? ` (${m.sku})` : ''}: ${m.needed} to order`),
            ] : []),
            ...(inventoryItems.length > 0 ? [
                '',
                'INVENTORY PRODUCTS:',
                ...inventoryItems.map(m => `  ${m.name}${m.sku ? ` (${m.sku})` : ''}: ${m.needed} to order`),
            ] : []),
            '',
            'ORDER NUMBERS:',
            `  ${blockedOrders.map(o => `#${o.orderNumber}`).join(', ')}`,
        ].join('\n');

        return (
            <Popover>
                <PopoverTrigger asChild>{props.children}</PopoverTrigger>
                <PopoverContent className={`w-[calc(100vw-2rem)] sm:w-[450px] p-0 ${colorClasses.border} shadow-xl z-50`} align="start" onClick={e => e.stopPropagation()}>
                    <div className={`${colorClasses.header} text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 flex justify-between items-center rounded-t-lg`}>
                        <span>Blocked Orders Detail</span>
                        <div className="flex items-center gap-1 bg-black/10 p-0.5 rounded-md">
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-[9px] font-bold uppercase tracking-widest text-white hover:bg-white/20" onClick={() => handleCopy(copyTextDetailed, 'detailed')}>
                                {copied === 'detailed' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />} Detailed
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-[9px] font-bold uppercase tracking-widest text-white hover:bg-white/20" onClick={() => handleCopy(copyTextSimple, 'simple')}>
                                {copied === 'simple' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />} Simple
                            </Button>
                        </div>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                        {loading && <p className="text-xs text-muted-foreground italic p-4">Loading...</p>}

                        {/* Shopify Products */}
                        {shopifyItems.length > 0 && (
                            <div className="px-3 pt-3 pb-1">
                                <div className="flex items-center gap-1.5 mb-2">
                                    <ShoppingBag className="h-3 w-3 text-muted-foreground" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Shopify Products ({shopifyItems.length})</p>
                                </div>
                                <div className="space-y-1">
                                    {shopifyItems.map((m, i) => (
                                        <div key={i} className="bg-muted/30 p-2 rounded-md text-xs">
                                            <div className="font-semibold truncate" title={m.name}>
                                                {m.name}{m.sku ? <span className="text-muted-foreground font-normal ml-1">({m.sku})</span> : ''}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1 text-[11px] flex-wrap">
                                                <span className="text-muted-foreground">{m.remaining} left</span>
                                                <span className="text-amber-600">→ -{m.demand} needed</span>
                                                <span className={`font-bold ${m.needed > 0 ? 'text-red-500' : 'text-emerald-600'} ml-auto`}>{m.needed} to order</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Inventory Products */}
                        {inventoryItems.length > 0 && (
                            <div className={`px-3 pt-2 pb-1 ${shopifyItems.length > 0 ? 'border-t border-muted/20 mt-2' : 'pt-3'}`}>
                                <div className="flex items-center gap-1.5 mb-2">
                                    <Package className="h-3 w-3 text-muted-foreground" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Inventory Products ({inventoryItems.length})</p>
                                </div>
                                <div className="space-y-1">
                                    {inventoryItems.map((m, i) => (
                                        <div key={i} className="bg-muted/30 p-2 rounded-md text-xs">
                                            <div className="font-semibold truncate" title={m.name}>
                                                {m.name}{m.sku ? <span className="text-muted-foreground font-normal ml-1">({m.sku})</span> : ''}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1 text-[11px] flex-wrap">
                                                <span className="text-muted-foreground">{m.remaining} left</span>
                                                <span className="text-amber-600">→ -{m.demand} needed</span>
                                                <span className={`font-bold ${m.needed > 0 ? 'text-red-500' : 'text-emerald-600'} ml-auto`}>{m.needed} to order</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!loading && missingSummary.length === 0 && (
                            <p className="text-xs text-muted-foreground italic p-4 text-center">No missing items</p>
                        )}

                        <OrderNumbersSection orders={blockedOrders} colorClass={colorClasses.text} />
                    </div>
                </PopoverContent>
            </Popover>
        );
    }

    // ── Packagable popup ──
    const { packagableOrders, inventoryImpact, loading } = props;

    const shopifyImpact = inventoryImpact.filter(i => i.source === 'shopify');
    const inventoryImpactItems = inventoryImpact.filter(i => i.source === 'inventory');

    const copyTextDetailed = [
        `PACKAGABLE ORDERS (${packagableOrders.length})`,
        `━━━━━━━━━━━━━━━━━━━━`,
        ...(shopifyImpact.length > 0 ? [
            '',
            'SHOPIFY PRODUCTS:',
            ...shopifyImpact.map(item => `  ${item.name}${item.sku ? ` (${item.sku})` : ''}: ${item.current} in stock → -${item.used} → ${item.remaining} left`),
        ] : []),
        ...(inventoryImpactItems.length > 0 ? [
            '',
            'INVENTORY PRODUCTS:',
            ...inventoryImpactItems.map(item => `  ${item.name}${item.sku ? ` (${item.sku})` : ''}: ${item.current} in stock → -${item.used} → ${item.remaining} left`),
        ] : []),
        '',
        'ORDER NUMBERS:',
        `  ${packagableOrders.map(o => `#${o.orderNumber}`).join(', ')}`,
    ].join('\n');

    const copyTextSimple = packagableOrders.map(o => `#${o.orderNumber}`).join(', ');

    const renderImpactItem = (item: InventoryImpactItem, i: number) => (
        <div key={i} className="bg-muted/30 p-2 rounded-md text-xs">
            <div className="font-semibold truncate" title={item.name}>
                {item.name}{item.sku ? <span className="text-muted-foreground font-normal ml-1">({item.sku})</span> : ''}
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px]">
                <span className="text-muted-foreground">{item.current} in stock</span>
                <span className="text-amber-600">→ -{item.used}</span>
                <span className={`font-bold ${item.remaining <= 0 ? 'text-red-500' : 'text-emerald-600'}`}>{item.remaining} left</span>
            </div>
        </div>
    );

    return (
        <Popover>
            <PopoverTrigger asChild>{props.children}</PopoverTrigger>
            <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[420px] p-0 border-emerald-500/30 shadow-xl z-50" align="start" onClick={e => e.stopPropagation()}>
                <div className="bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 flex justify-between items-center rounded-t-lg">
                    <span>Packagable Orders Detail</span>
                    <div className="flex items-center gap-1 bg-black/10 p-0.5 rounded-md">
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[9px] font-bold uppercase tracking-widest text-white hover:bg-white/20" onClick={() => handleCopy(copyTextDetailed, 'detailed')}>
                            {copied === 'detailed' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />} Detailed
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[9px] font-bold uppercase tracking-widest text-white hover:bg-white/20" onClick={() => handleCopy(copyTextSimple, 'simple')}>
                            {copied === 'simple' ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />} Simple
                        </Button>
                    </div>
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                    {loading && <p className="text-xs text-muted-foreground italic p-4">Loading...</p>}

                    {/* Shopify Products */}
                    {shopifyImpact.length > 0 && (
                        <div className="px-3 pt-3 pb-1">
                            <div className="flex items-center gap-1.5 mb-2">
                                <ShoppingBag className="h-3 w-3 text-muted-foreground" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Shopify Products ({shopifyImpact.length})</p>
                            </div>
                            <div className="space-y-1">{shopifyImpact.map(renderImpactItem)}</div>
                        </div>
                    )}

                    {/* Inventory Products */}
                    {inventoryImpactItems.length > 0 && (
                        <div className={`px-3 pt-2 pb-1 ${shopifyImpact.length > 0 ? 'border-t border-muted/20 mt-2' : 'pt-3'}`}>
                            <div className="flex items-center gap-1.5 mb-2">
                                <Package className="h-3 w-3 text-muted-foreground" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Inventory Products ({inventoryImpactItems.length})</p>
                            </div>
                            <div className="space-y-1">{inventoryImpactItems.map(renderImpactItem)}</div>
                        </div>
                    )}

                    {!loading && inventoryImpact.length === 0 && (
                        <p className="text-xs text-muted-foreground italic p-4 text-center">No inventory impact</p>
                    )}

                    <OrderNumbersSection orders={packagableOrders} colorClass="text-emerald-600" />
                </div>
            </PopoverContent>
        </Popover>
    );
}
