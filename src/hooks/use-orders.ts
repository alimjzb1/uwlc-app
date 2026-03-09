import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Order } from "@/types";
import { useAudit } from "./use-audit";
import { useInventory } from "./use-inventory";

export interface UseOrdersProps {
    status?: string[];
    dateRange?: { from: Date; to: Date };
    fulfillmentStatus?: string | null;
    search?: string;
    tab?: 'all' | 'unfulfilled' | 'fulfilled';
    sortOrder?: 'asc' | 'desc';
    pageSize?: string; // '20' | '50' | '100' | '200' | '500' | '1000' | 'all'
    showCancelled?: boolean;
}

export type OrderWithPackagability = Order & {
    isPackagable: boolean;
    missingItems: { name: string; sku: string; required: number; available: number }[];
};

/** Resilient fetch for products_shopify - falls back to unfiltered if column doesn't exist */
async function fetchShopifyProducts() {
    const filtered = await supabase.from('products_shopify').select('*').eq('local_inventory_enabled', true);
    if (!filtered.error) return filtered.data;
    // Fallback: column might not exist yet
    const all = await supabase.from('products_shopify').select('*');
    return all.data;
}

export function useOrders(filters: UseOrdersProps = {}) {
  const [rawOrdersState, setRawOrdersState] = useState<Order[]>([]);
  const [orders, setOrders] = useState<OrderWithPackagability[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { logAction } = useAudit();
  // Using an inline instance of Inventory so we don't cause hook circle
  const inventoryControls = useInventory();
  // Fetch global analytic state to attach to the visible set
  const { packagableOrders, blockedOrders } = useOrderAnalytics();

  useEffect(() => {
    fetchOrders();
  }, [
    JSON.stringify(filters.status), 
    filters.dateRange?.from?.getTime(), 
    filters.dateRange?.to?.getTime(), 
    filters.fulfillmentStatus, 
    filters.search, 
    filters.tab, 
    filters.sortOrder,
    filters.pageSize,
    filters.showCancelled
  ]);

  async function fetchOrders() {
    try {
      setLoading(true);
      let query = supabase
        .from('orders')
        .select('*, customer:customers(*), items:order_items(*)');

      if (filters.status && filters.status.length > 0) {
        query = query.in('internal_status', filters.status);
      }

      if (filters.dateRange) {
        const from = new Date(filters.dateRange.from);
        from.setHours(0, 0, 0, 0);
        
        const to = new Date(filters.dateRange.to);
        to.setHours(23, 59, 59, 999);

        query = query
          .gte('created_at', from.toISOString())
          .lte('created_at', to.toISOString());
      }

      if (filters.search) {
        query = query.or(`shopify_order_number.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
      }

      if (filters.tab === 'unfulfilled') {
        query = query.or('fulfillment_status.eq.unfulfilled,fulfillment_status.is.null');
        if (!filters.showCancelled) query = query.neq('internal_status', 'cancelled');
      } else if (filters.tab === 'fulfilled') {
        query = query.eq('fulfillment_status', 'fulfilled');
        if (!filters.showCancelled) query = query.neq('internal_status', 'cancelled');
      }

      // Apply page size limit
      const pageSize = filters.pageSize || '50';
      if (pageSize !== 'all') {
        query = query.limit(parseInt(pageSize, 10));
      }

      const { data, error } = await query.order('created_at', { ascending: filters.sortOrder === 'asc' });

      if (error) throw error;
      
      const rawOrders = (data as Order[]) || [];
      // Deduplicate by shopify_order_id (keep the first occurrence)
      const seen = new Set<string>();
      const fetchedOrders = rawOrders.filter(o => {
        if (o.shopify_order_id && seen.has(o.shopify_order_id)) return false;
        if (o.shopify_order_id) seen.add(o.shopify_order_id);
        return true;
      });
      const ordersAscending = filters.sortOrder === 'desc' ? [...fetchedOrders].reverse() : fetchedOrders;

      setRawOrdersState(ordersAscending);
      setTotalCount(ordersAscending.length);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Derive enriched orders whenever raw orders or analytics data changes
  useEffect(() => {
      const enrichedOrders = rawOrdersState.map(order => {
          const isPostPackaging = ['packaging', 'needs_approval', 'ready_to_ship', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'].includes(order.internal_status);
          if (isPostPackaging || order.fulfillment_status === 'fulfilled') {
              return { ...order, isPackagable: false, missingItems: [] } as OrderWithPackagability;
          }

          const isPackagable = packagableOrders.some(p => p.orderId === order.id);
          const blockedDetail = blockedOrders.find(b => b.orderId === order.id);
          const missingItems = blockedDetail 
              ? blockedDetail.missing.map(m => ({ 
                  name: m.name, 
                  sku: m.sku, 
                  required: m.qty, 
                  available: 0 // Simplification
                })) 
              : [];

          return { ...order, isPackagable, missingItems } as OrderWithPackagability;
      });

      // If user requested descending sort, flip it back for UI
      const finalOrders = filters.sortOrder === 'desc' ? enrichedOrders.reverse() : enrichedOrders;
      setOrders(finalOrders);
  }, [rawOrdersState, packagableOrders, blockedOrders, filters.sortOrder]);

  async function updateOrderInternalStatus(id: string, status: string) {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ internal_status: status })
        .eq('id', id);

      if (error) throw error;
      
      if (status === 'cancelled') {
          await inventoryControls.rollbackStockForOrder(id);
      }

      await fetchOrders();
    } catch (err: any) {
      throw err;
    }
  }

  async function bulkUpdateOrders(ids: string[], updates: Partial<Order>) {
    try {
      const { error } = await supabase
        .from('orders')
        .update(updates)
        .in('id', ids);

      if (error) throw error;
      
      if (updates.internal_status === 'cancelled') {
         for (const id of ids) {
             await inventoryControls.rollbackStockForOrder(id);
         }
      }

      await logAction('BULK_UPDATE', 'orders', ids.join(','), { updates });
      await fetchOrders();
    } catch (err: any) {
       console.error("Bulk update failed", err);
       throw err;
    }
  }

  return { orders, totalCount, loading, error, refreshOrders: fetchOrders, updateOrderInternalStatus, bulkUpdateOrders };
}

// ──── Analytics Types ────
export interface BlockedOrderDetail {
    orderNumber: string;
    orderId: string;
    missing: { name: string; sku: string; qty: number; source: 'inventory' | 'shopify' }[];
}
export interface PackagableOrderDetail {
    orderNumber: string;
    orderId: string;
}
export interface InventoryImpactItem {
    name: string;
    sku: string;
    current: number;
    used: number;
    remaining: number;
    source: 'inventory' | 'shopify';
}

export function useOrderAnalytics() {
  const [metrics, setMetrics] = useState({
    packagableCount: 0,
    blockedCount: 0,
    missingSummary: [] as { name: string; sku: string; needed: number; source: 'inventory' | 'shopify'; current: number; used: number; remaining: number; demand: number }[],
    blockedOrders: [] as BlockedOrderDetail[],
    packagableOrders: [] as PackagableOrderDetail[],
    inventoryImpact: [] as InventoryImpactItem[],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGlobalAnalytics();
  }, []);

  async function fetchGlobalAnalytics() {
    try {
      setLoading(true);
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('*, customer:customers(*), items:order_items(*)')
        .or('fulfillment_status.eq.unfulfilled,fulfillment_status.is.null')
        .in('internal_status', ['new'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      // Deduplicate by shopify_order_id (keep the first occurrence)
      const rawAnalyticsOrders = (ordersData as Order[]) || [];
      const seenAnalytics = new Set<string>();
      const orders = rawAnalyticsOrders.filter(o => {
        if (o.shopify_order_id && seenAnalytics.has(o.shopify_order_id)) return false;
        if (o.shopify_order_id) seenAnalytics.add(o.shopify_order_id);
        return true;
      });

      const [
          { data: internalProducts },
          shopifyProducts,
          { data: productLinks }
      ] = await Promise.all([
          supabase.from('products_inventory').select('*'),
          fetchShopifyProducts(),
          supabase.from('product_links').select('*')
      ]);

      const internalStockMap = new Map<string, number>();
      const skuToInternalMap = new Map<string, string>();
      const shopifyStockMap = new Map<string, number>();
      const bridgeMap = new Map<string, { id: string, qtyPerUnit: number }[]>();

      // Store initial stock levels for impact calculation
      const initialInternalStock = new Map<string, number>();
      const initialShopifyStock = new Map<string, number>();
      const productNameMap = new Map<string, string>();

      internalProducts?.forEach(p => {
          internalStockMap.set(p.id, p.quantity_on_hand || 0);
          initialInternalStock.set(p.id, p.quantity_on_hand || 0);
          if (p.sku) {
              skuToInternalMap.set(p.sku, p.id);
          }
      });
      // Build product name map with "Parent - Variant" format
      internalProducts?.forEach(p => {
          let fullName = p.name || p.sku || '';
          if (p.parent_id) {
              const parent = internalProducts?.find(pp => pp.id === p.parent_id);
              if (parent) fullName = `${parent.name || parent.sku || 'Product'} - ${fullName}`;
          }
          productNameMap.set(p.id, fullName);
          if (p.sku) productNameMap.set(p.sku, fullName);
      });
      shopifyProducts?.forEach(p => {
          if (p.sku) {
              shopifyStockMap.set(p.sku, p.local_quantity || 0);
              initialShopifyStock.set(p.sku, p.local_quantity || 0);
              if (!productNameMap.has(p.sku)) productNameMap.set(p.sku, p.title || p.sku);
          }
      });
      productLinks?.forEach(link => {
          const variantId = link.shopify_variant_id;
          const component = { id: link.inventory_product_id, qtyPerUnit: link.quantity_per_unit || 1 };
          if (!bridgeMap.has(variantId)) bridgeMap.set(variantId, []);
          bridgeMap.get(variantId)!.push(component);
      });

      let packagableCount = 0;
      let blockedCount = 0;
      const blockedOrders: BlockedOrderDetail[] = [];
      const packagableOrders: PackagableOrderDetail[] = [];
      const totalShopifyUsed = new Map<string, number>();
      const totalInternalUsed = new Map<string, number>();
      // Track FULL demand from blocked orders (not just the shortfall)
      const blockedDemandTotals = new Map<string, { name: string; demand: number; source: 'inventory' | 'shopify' }>();

      orders.forEach(order => {

          let isPackagable = true;
          const tempShopifyDeductions = new Map<string, number>();
          const tempInternalDeductions = new Map<string, number>();
          const orderMissing: { key: string; sku: string; name: string; required: number; source: 'inventory' | 'shopify' }[] = [];
          // Track the full demand of each item in this order (before stock deductions)
          const orderDemand: { key: string; name: string; fullQty: number; source: 'inventory' | 'shopify' }[] = [];

          if (order.items) {
              for (const item of order.items) {
                  const sku = item.sku;
                  const shopifyVariantId = item.shopify_variant_id || null;
                  
                  let required = item.quantity;
                  let shopifyAvail = sku ? (shopifyStockMap.get(sku) || 0) : 0;
                  
                  if (shopifyAvail > 0) {
                      const take = Math.min(required, shopifyAvail);
                      shopifyAvail -= take;
                      required -= take;
                      tempShopifyDeductions.set(sku!, (tempShopifyDeductions.get(sku!) || 0) + take);
                  }

                  const bridges = shopifyVariantId ? (bridgeMap.get(shopifyVariantId) || []) : [];
                  const internalProductIds = bridges.length > 0 
                      ? bridges 
                      : (sku && skuToInternalMap.has(sku) 
                          ? [{ id: skuToInternalMap.get(sku)!, qtyPerUnit: 1 }] 
                          : (item.product_id && item.product_id.length > 20 
                              ? [{ id: item.product_id, qtyPerUnit: 1 }] 
                              : []));

                  if (required > 0 && internalProductIds.length > 0) {
                      let maxPossibleSets = required;
                      for (const comp of internalProductIds) {
                          const avail = internalStockMap.get(comp.id) || 0;
                          maxPossibleSets = Math.min(maxPossibleSets, Math.floor(avail / comp.qtyPerUnit));
                      }
                      if (maxPossibleSets > 0) {
                          for (const comp of internalProductIds) {
                              const deduction = maxPossibleSets * comp.qtyPerUnit;
                              internalStockMap.set(comp.id, (internalStockMap.get(comp.id) || 0) - deduction);
                              tempInternalDeductions.set(comp.id, (tempInternalDeductions.get(comp.id) || 0) + deduction);
                          }
                          required -= maxPossibleSets;
                      }
                  }

                  if (required > 0) {
                      const isTrackedOnShopify = sku ? shopifyStockMap.has(sku) : false;
                      const isLinked = internalProductIds.length > 0;
                      if (isTrackedOnShopify || isLinked) {
                          isPackagable = false;
                          // Track missing at component level
                          if (internalProductIds.length > 0) {
                              for (const comp of internalProductIds) {
                                  const compName = productNameMap.get(comp.id) || comp.id;
                                  const compSku = internalProducts?.find(p => p.id === comp.id)?.sku || '';
                                  orderMissing.push({ 
                                      key: `inv:${comp.id}`, 
                                      sku: compSku, 
                                      name: compName, 
                                      required: required * comp.qtyPerUnit, 
                                      source: 'inventory' 
                                  });
                              }
                          } else if (isTrackedOnShopify) {
                              orderMissing.push({ 
                                  key: `shopify:${sku}`, 
                                  sku: sku || 'N/A', 
                                  name: productNameMap.get(sku!) || item.name, 
                                  required, 
                                  source: 'shopify' 
                              });
                          }
                      }
                  }

                  // Record the FULL demand for this item (entire item.quantity) for blocked demand tracking
                  const isTrackedOnShopify = sku ? shopifyStockMap.has(sku) : false;
                  const isLinked = internalProductIds.length > 0;
                  if (isTrackedOnShopify || isLinked) {
                      if (internalProductIds.length > 0) {
                          for (const comp of internalProductIds) {
                              const compName = productNameMap.get(comp.id) || comp.id;
                              orderDemand.push({ key: `inv:${comp.id}`, name: compName, fullQty: item.quantity * comp.qtyPerUnit, source: 'inventory' });
                          }
                      } else if (isTrackedOnShopify) {
                          orderDemand.push({ key: `shopify:${sku}`, name: productNameMap.get(sku!) || item.name, fullQty: item.quantity, source: 'shopify' });
                      }
                  }
              }
          }

          const orderNum = order.shopify_order_number || order.id.slice(0, 8);

          if (isPackagable) {
              packagableCount++;
              packagableOrders.push({ orderNumber: orderNum, orderId: order.id });
              tempShopifyDeductions.forEach((take, sku) => {
                  shopifyStockMap.set(sku, (shopifyStockMap.get(sku) || 0) - take);
                  totalShopifyUsed.set(sku, (totalShopifyUsed.get(sku) || 0) + take);
              });
              tempInternalDeductions.forEach((amount, id) => {
                  totalInternalUsed.set(id, (totalInternalUsed.get(id) || 0) + amount);
              });
          } else {
              blockedCount++;
              blockedOrders.push({
                  orderNumber: orderNum,
                  orderId: order.id,
                  missing: orderMissing.map(m => ({ name: m.name, sku: m.sku, qty: m.required, source: m.source }))
              });
              tempInternalDeductions.forEach((amount, id) => {
                  internalStockMap.set(id, (internalStockMap.get(id) || 0) + amount);
              });
              // Accumulate the FULL demand from this blocked order
              orderDemand.forEach(d => {
                  const existing = blockedDemandTotals.get(d.key) || { name: d.name, demand: 0, source: d.source };
                  existing.demand += d.fullQty;
                  blockedDemandTotals.set(d.key, existing);
              });
          }
      });

      // Compute "to order": total demand from ALL blocked orders minus remaining stock
      // Remaining stock = stock after packagable deductions (blocked rollbacks already applied)
      const missingSummary = Array.from(blockedDemandTotals.entries()).map(([key, data]) => {
          const rawKey = key.replace(/^(inv|shopify):/, '');
          let currentStock = 0;
          let remainingStock = 0;
          let usedStock = 0;
          
          if (data.source === 'inventory') {
              currentStock = initialInternalStock.get(rawKey) || 0;
              usedStock = totalInternalUsed.get(rawKey) || 0;
              remainingStock = Math.max(0, internalStockMap.get(rawKey) || 0);
          } else {
              currentStock = initialShopifyStock.get(rawKey) || 0;
              usedStock = totalShopifyUsed.get(rawKey) || 0;
              remainingStock = Math.max(0, shopifyStockMap.get(rawKey) || 0);
          }
          const toOrder = Math.max(0, data.demand - remainingStock);
          const sku = data.source === 'inventory'
              ? (internalProducts?.find(p => p.id === rawKey)?.sku || rawKey)
              : rawKey;
          return { sku, name: data.name, needed: toOrder, source: data.source, current: currentStock, used: usedStock, remaining: remainingStock, demand: data.demand };
      }).filter(m => m.needed > 0).sort((a,b) => b.needed - a.needed);

      // Build inventory impact
      const inventoryImpact: InventoryImpactItem[] = [];
      totalInternalUsed.forEach((used, id) => {
          const actualSku = internalProducts?.find(p => p.id === id)?.sku || '';
          inventoryImpact.push({
              name: productNameMap.get(id) || id,
              sku: actualSku,
              current: initialInternalStock.get(id) || 0,
              used,
              remaining: (initialInternalStock.get(id) || 0) - used,
              source: 'inventory',
          });
      });
      totalShopifyUsed.forEach((used, sku) => {
          inventoryImpact.push({
              name: productNameMap.get(sku) || sku,
              sku,
              current: initialShopifyStock.get(sku) || 0,
              used,
              remaining: (initialShopifyStock.get(sku) || 0) - used,
              source: 'shopify',
          });
      });
      inventoryImpact.sort((a, b) => b.used - a.used);

      setMetrics({ packagableCount, blockedCount, missingSummary, blockedOrders, packagableOrders, inventoryImpact });

    } catch (err: any) {
      console.error("Order analytics failed", err);
    } finally {
      setLoading(false);
    }
  }

  return { ...metrics, loading, refresh: fetchGlobalAnalytics };
}
