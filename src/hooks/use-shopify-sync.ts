import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface SyncResult {
  created: number;
  updated: number;
  removed: number;
  unchanged: number;
}

interface SyncLogEntry {
  id: string;
  integration: string;
  entity_type: string;
  entity_id: string;
  action: string;
  changes: any;
  synced_at: string;
}

// ──── Paginated Shopify Proxy Call ────
// Shopify's REST API returns max 250 items per page.
// We follow the cursor-based pagination via the Link header returned by the proxy.
async function callShopifyProxy(endpoint: string, params: Record<string, any> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke('shopify-proxy', {
    body: { endpoint, params },
  });

  if (error) {
    const message = (error as any)?.context?.body
      ? await (error as any).context.text?.()
      : error.message;
    console.error('[ShopifyProxy] Error details:', message);
    throw new Error(message || 'Proxy request failed');
  }
  if (data?.error) throw new Error(data.error);
  return data; // { data: {...}, pagination: "Link header string or null" }
}

// Fetch ALL pages of a Shopify resource using cursor-based pagination
async function fetchAllPages(endpoint: string, resourceKey: string, params: Record<string, any> = {}): Promise<any[]> {
  let allItems: any[] = [];
  let pageParams: Record<string, any> = { ...params, limit: 250 };
  let hasMore = true;

  while (hasMore) {
    const result = await callShopifyProxy(endpoint, pageParams);
    const items = result?.data?.[resourceKey] || [];
    allItems = allItems.concat(items);

    // Parse Link header for next page cursor
    const linkHeader = result?.pagination;
    if (linkHeader && linkHeader.includes('rel="next"')) {
      const match = linkHeader.match(/<[^>]*page_info=([^&>]+)[^>]*>;\s*rel="next"/);
      if (match) {
        pageParams = { limit: 250, page_info: match[1] };
      } else {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  return allItems;
}

function computeDiff(oldObj: Record<string, any>, newObj: Record<string, any>, fields: string[]) {
  const changes: Record<string, { old: any; new: any }> = {};
  for (const field of fields) {
    const oldVal = oldObj[field];
    const newVal = newObj[field];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes[field] = { old: oldVal, new: newVal };
    }
  }
  return Object.keys(changes).length > 0 ? changes : null;
}

export function useShopifySync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [lastSyncResult, setLastSyncResult] = useState<Record<string, SyncResult> | null>(null);

  const logSync = async (entry: Omit<SyncLogEntry, 'id' | 'synced_at'>) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('sync_logs').insert([{
      ...entry,
      synced_by: user?.id,
    }]);
  };

  // ──── Sync Orders (ALL pages) ────
  const syncOrders = useCallback(async (): Promise<SyncResult> => {
    const result: SyncResult = { created: 0, updated: 0, removed: 0, unchanged: 0 };

    try {
      setSyncProgress('Fetching orders from Shopify...');

      const shopifyOrders = await fetchAllPages('orders', 'orders', {
        status: 'any',
        fields: 'id,name,email,currency,total_price,subtotal_price,total_tax,fulfillment_status,financial_status,created_at,updated_at,note,shipping_address,billing_address,line_items,customer,tags,fulfillments',
      });

      if (shopifyOrders.length === 0) return result;

      setSyncProgress(`Processing ${shopifyOrders.length} orders...`);

      // Process in batches of 50 to avoid overwhelming Supabase
      const batchSize = 50;
      for (let i = 0; i < shopifyOrders.length; i += batchSize) {
        const batch = shopifyOrders.slice(i, i + batchSize);
        setSyncProgress(`Processing orders ${i + 1}-${Math.min(i + batchSize, shopifyOrders.length)} of ${shopifyOrders.length}...`);

        // Get existing orders from Supabase for this batch
        const shopifyIds = batch.map((o: any) => String(o.id));
        const { data: existingOrders } = await supabase
          .from('orders')
          .select('*, items:order_items(*)')
          .in('shopify_order_id', shopifyIds);

        const existingMap = new Map((existingOrders || []).map((o: any) => [o.shopify_order_id, o]));

        // Process orders within each batch in small concurrent chunks to avoid overwhelming Supabase
        const concurrency = 5;
        for (let j = 0; j < batch.length; j += concurrency) {
          const chunk = batch.slice(j, j + concurrency);
          await Promise.all(chunk.map(async (shopifyOrder: any) => {
          const shopifyId = String(shopifyOrder.id);
          const existing = existingMap.get(shopifyId);

          // Resolve or create customer
          let customerId: string | null = null;
          if (shopifyOrder.customer) {
            customerId = await upsertCustomer(shopifyOrder.customer);
          }

          // Extract tracking from fulfillments
          let trackingNumber = null;
          let trackingUrl = null;
          if (shopifyOrder.fulfillments && shopifyOrder.fulfillments.length > 0) {
            trackingNumber = shopifyOrder.fulfillments[0].tracking_number || null;
            trackingUrl = shopifyOrder.fulfillments[0].tracking_url || null;
          }

          const orderData: any = {
            shopify_order_id: shopifyId,
            shopify_order_number: shopifyOrder.name?.replace('#', '') || String(shopifyOrder.order_number),
            customer_id: customerId,
            email: shopifyOrder.email || '',
            currency: shopifyOrder.currency || 'USD',
            total_price: parseFloat(shopifyOrder.total_price) || 0,
            subtotal_price: parseFloat(shopifyOrder.subtotal_price) || 0,
            total_tax: parseFloat(shopifyOrder.total_tax) || 0,
            fulfillment_status: shopifyOrder.fulfillment_status || null,
            financial_status: shopifyOrder.financial_status || 'pending',
            note: shopifyOrder.note || null,
            shipping_address: shopifyOrder.shipping_address || null,
            billing_address: shopifyOrder.billing_address || null,
            tags: shopifyOrder.tags ? shopifyOrder.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
            tracking_number: trackingNumber,
            tracking_url: trackingUrl,
            // Use Shopify's original timestamps
            created_at: shopifyOrder.created_at,
            updated_at: shopifyOrder.updated_at,
          };
          
          if (shopifyOrder.cancelled_at || shopifyOrder.financial_status === 'voided') {
            orderData.internal_status = 'cancelled';
          }

          if (existing) {
            // Check for changes
            const diff = computeDiff(existing, orderData, [
              'email', 'total_price', 'subtotal_price', 'total_tax',
              'fulfillment_status', 'financial_status', 'note',
              'shipping_address', 'billing_address', 'tags',
              'tracking_number', 'tracking_url', 'internal_status'
            ]);

            if (diff) {
              await supabase.from('orders').update({
                ...orderData,
                updated_at: shopifyOrder.updated_at,
              }).eq('id', existing.id);
              await logSync({
                integration: 'shopify',
                entity_type: 'order',
                entity_id: shopifyId,
                action: 'updated',
                changes: diff,
              });
              result.updated++;
            } else {
              result.unchanged++;
            }

            // Sync line items (backfills shopify_variant_id)
            await syncOrderLineItems(existing.id, shopifyOrder.line_items || [], existing.items || []);

          } else {
            // Create new order
            const internalStatus = (shopifyOrder.cancelled_at || shopifyOrder.financial_status === 'voided') ? 'cancelled' : 'new';
            const { data: newOrder, error } = await supabase
              .from('orders')
              .insert([{
                ...orderData,
                internal_status: internalStatus,
              }])
              .select('id')
              .single();

            if (!error && newOrder) {
              // Insert line items
              await insertLineItems(newOrder.id, shopifyOrder.line_items || []);
              await logSync({
                integration: 'shopify',
                entity_type: 'order',
                entity_id: shopifyId,
                action: 'created',
                changes: null,
              });
              result.created++;
            } else if (error) {
              console.error(`[ShopifySync] Failed to insert order ${shopifyId}:`, error.message, error.details, error.hint);
            }
          }
        }));
        } // end concurrency chunk loop
      }
    } catch (err: any) {
      console.error('[ShopifySync] Orders sync error:', err);
      throw err;
    }

    return result;
  }, []);

  // ──── Sync Recent Orders (single page, last N orders) ────
  const syncRecentOrders = useCallback(async (limit: number = 50): Promise<SyncResult> => {
    const result: SyncResult = { created: 0, updated: 0, removed: 0, unchanged: 0 };

    try {
      setSyncProgress(`Fetching last ${limit} orders from Shopify...`);

      const response = await callShopifyProxy('orders', {
        status: 'any',
        limit: Math.min(limit, 250),
        fields: 'id,name,email,currency,total_price,subtotal_price,total_tax,fulfillment_status,financial_status,created_at,updated_at,note,shipping_address,billing_address,line_items,customer,tags,fulfillments',
      });

      const shopifyOrders = response?.data?.orders || [];
      if (shopifyOrders.length === 0) return result;

      setSyncProgress(`Processing ${shopifyOrders.length} recent orders...`);

      // Get existing orders from Supabase for this batch
      const shopifyIds = shopifyOrders.map((o: any) => String(o.id));
      const { data: existingOrders } = await supabase
        .from('orders')
        .select('*, items:order_items(*)')
        .in('shopify_order_id', shopifyIds);

      const existingMap = new Map((existingOrders || []).map((o: any) => [o.shopify_order_id, o]));

      for (const shopifyOrder of shopifyOrders) {
        const shopifyId = String(shopifyOrder.id);
        const existing = existingMap.get(shopifyId);

        // Resolve or create customer
        let customerId: string | null = null;
        if (shopifyOrder.customer) {
          customerId = await upsertCustomer(shopifyOrder.customer);
        }

        // Extract tracking from fulfillments
        let trackingNumber = null;
        let trackingUrl = null;
        if (shopifyOrder.fulfillments && shopifyOrder.fulfillments.length > 0) {
          trackingNumber = shopifyOrder.fulfillments[0].tracking_number || null;
          trackingUrl = shopifyOrder.fulfillments[0].tracking_url || null;
        }

        const orderData: any = {
          shopify_order_id: shopifyId,
          shopify_order_number: shopifyOrder.name?.replace('#', '') || String(shopifyOrder.order_number),
          customer_id: customerId,
          email: shopifyOrder.email || '',
          currency: shopifyOrder.currency || 'USD',
          total_price: parseFloat(shopifyOrder.total_price) || 0,
          subtotal_price: parseFloat(shopifyOrder.subtotal_price) || 0,
          total_tax: parseFloat(shopifyOrder.total_tax) || 0,
          fulfillment_status: shopifyOrder.fulfillment_status || null,
          financial_status: shopifyOrder.financial_status || 'pending',
          note: shopifyOrder.note || null,
          shipping_address: shopifyOrder.shipping_address || null,
          billing_address: shopifyOrder.billing_address || null,
          tags: shopifyOrder.tags ? shopifyOrder.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
          tracking_number: trackingNumber,
          tracking_url: trackingUrl,
          created_at: shopifyOrder.created_at,
          updated_at: shopifyOrder.updated_at,
        };

        if (shopifyOrder.cancelled_at || shopifyOrder.financial_status === 'voided') {
          orderData.internal_status = 'cancelled';
        }

        if (existing) {
          const diff = computeDiff(existing, orderData, [
            'email', 'total_price', 'subtotal_price', 'total_tax',
            'fulfillment_status', 'financial_status', 'note',
            'shipping_address', 'billing_address', 'tags',
            'tracking_number', 'tracking_url', 'internal_status'
          ]);

          if (diff) {
            await supabase.from('orders').update({
              ...orderData,
              updated_at: shopifyOrder.updated_at,
            }).eq('id', existing.id);
            result.updated++;
          } else {
            result.unchanged++;
          }

          await syncOrderLineItems(existing.id, shopifyOrder.line_items || [], existing.items || []);
        } else {
          const internalStatus = (shopifyOrder.cancelled_at || shopifyOrder.financial_status === 'voided') ? 'cancelled' : 'new';
          const { data: newOrder, error } = await supabase
            .from('orders')
            .insert([{ ...orderData, internal_status: internalStatus }])
            .select('id')
            .single();

          if (!error && newOrder) {
            await insertLineItems(newOrder.id, shopifyOrder.line_items || []);
            result.created++;
          } else if (error) {
            console.error(`[ShopifySync] Failed to insert order ${shopifyId}:`, error.message);
          }
        }
      }

      setSyncProgress('');
    } catch (err: any) {
      console.error('[ShopifySync] Recent orders sync error:', err);
      setSyncProgress('');
      throw err;
    }

    return result;
  }, []);

  // ──── Sync Customers (ALL pages) ────
  const syncCustomers = useCallback(async (): Promise<SyncResult> => {
    const result: SyncResult = { created: 0, updated: 0, removed: 0, unchanged: 0 };

    try {
      setSyncProgress('Fetching customers from Shopify...');

      const shopifyCustomers = await fetchAllPages('customers', 'customers', {
        fields: 'id,first_name,last_name,email,phone,created_at,updated_at',
      });

      if (shopifyCustomers.length === 0) return result;

      setSyncProgress(`Processing ${shopifyCustomers.length} customers...`);

      // Process in batches
      const batchSize = 50;
      for (let i = 0; i < shopifyCustomers.length; i += batchSize) {
        const batch = shopifyCustomers.slice(i, i + batchSize);
        setSyncProgress(`Processing customers ${i + 1}-${Math.min(i + batchSize, shopifyCustomers.length)} of ${shopifyCustomers.length}...`);

        const shopifyIds = batch.map((c: any) => String(c.id));
        const { data: existingCustomers } = await supabase
          .from('customers')
          .select('*')
          .in('shopify_customer_id', shopifyIds);

        const existingMap = new Map((existingCustomers || []).map((c: any) => [c.shopify_customer_id, c]));

        for (const shopifyCust of batch) {
          const shopifyId = String(shopifyCust.id);
          const existing = existingMap.get(shopifyId);

          const custData = {
            shopify_customer_id: shopifyId,
            first_name: shopifyCust.first_name || '',
            last_name: shopifyCust.last_name || '',
            email: shopifyCust.email || '',
            phone: shopifyCust.phone || null,
            // Use Shopify's original timestamps
            created_at: shopifyCust.created_at,
            updated_at: shopifyCust.updated_at,
          };

          if (existing) {
            const diff = computeDiff(existing, custData, ['first_name', 'last_name', 'email', 'phone']);
            if (diff) {
              await supabase.from('customers').update({
                ...custData,
                updated_at: shopifyCust.updated_at,
              }).eq('id', existing.id);
              await logSync({
                integration: 'shopify',
                entity_type: 'customer',
                entity_id: shopifyId,
                action: 'updated',
                changes: diff,
              });
              result.updated++;
            } else {
              result.unchanged++;
            }
          } else {
            await supabase.from('customers').insert([custData]);
            await logSync({
              integration: 'shopify',
              entity_type: 'customer',
              entity_id: shopifyId,
              action: 'created',
              changes: null,
            });
            result.created++;
          }
        }
      }
    } catch (err: any) {
      console.error('[ShopifySync] Customers sync error:', err);
      throw err;
    }

    return result;
  }, []);

  // ──── Sync Recent Customers (single page, last N customers) ────
  const syncRecentCustomers = useCallback(async (limit: number = 50): Promise<SyncResult> => {
    const result: SyncResult = { created: 0, updated: 0, removed: 0, unchanged: 0 };

    try {
      setSyncProgress(`Fetching last ${limit} customers from Shopify...`);

      const response = await callShopifyProxy('customers', {
        limit: Math.min(limit, 250),
        fields: 'id,first_name,last_name,email,phone,created_at,updated_at',
      });

      const shopifyCustomers = response?.data?.customers || [];
      if (shopifyCustomers.length === 0) return result;

      setSyncProgress(`Processing ${shopifyCustomers.length} recent customers...`);

      const shopifyIds = shopifyCustomers.map((c: any) => String(c.id));
      const { data: existingCustomers } = await supabase
        .from('customers')
        .select('*')
        .in('shopify_customer_id', shopifyIds);

      const existingMap = new Map((existingCustomers || []).map((c: any) => [c.shopify_customer_id, c]));

      for (const shopifyCust of shopifyCustomers) {
        const shopifyId = String(shopifyCust.id);
        const existing = existingMap.get(shopifyId);

        const custData = {
          shopify_customer_id: shopifyId,
          first_name: shopifyCust.first_name || '',
          last_name: shopifyCust.last_name || '',
          email: shopifyCust.email || '',
          phone: shopifyCust.phone || null,
          created_at: shopifyCust.created_at,
          updated_at: shopifyCust.updated_at,
        };

        if (existing) {
          const diff = computeDiff(existing, custData, ['first_name', 'last_name', 'email', 'phone']);
          if (diff) {
            await supabase.from('customers').update({
              ...custData,
              updated_at: shopifyCust.updated_at,
            }).eq('id', existing.id);
            await logSync({
              integration: 'shopify',
              entity_type: 'customer',
              entity_id: shopifyId,
              action: 'updated',
              changes: diff,
            });
            result.updated++;
          } else {
            result.unchanged++;
          }
        } else {
          await supabase.from('customers').insert([custData]);
          await logSync({
            integration: 'shopify',
            entity_type: 'customer',
            entity_id: shopifyId,
            action: 'created',
            changes: null,
          });
          result.created++;
        }
      }

      setSyncProgress('');
    } catch (err: any) {
      console.error('[ShopifySync] Recent customers sync error:', err);
      setSyncProgress('');
      throw err;
    }

    return result;
  }, []);

  // ──── Sync Products (ALL pages) ────
  const syncProducts = useCallback(async (): Promise<SyncResult> => {
    const result: SyncResult = { created: 0, updated: 0, removed: 0, unchanged: 0 };

    try {
      setSyncProgress('Fetching products from Shopify...');

      const shopifyProducts = await fetchAllPages('products', 'products', {
        fields: 'id,title,variants,images,created_at,updated_at',
      });

      if (shopifyProducts.length === 0) return result;

      setSyncProgress(`Processing ${shopifyProducts.length} products...`);

      // Flatten products into variants
      const variants: any[] = [];
      for (const product of shopifyProducts) {
        for (const variant of (product.variants || [])) {
          variants.push({
            shopify_product_id: String(product.id),
            shopify_variant_id: String(variant.id),
            title: variant.title === 'Default Title'
              ? product.title
              : `${product.title} - ${variant.title}`,
            sku: variant.sku || '',
            price: parseFloat(variant.price) || 0,
            images: (product.images || []).map((img: any) => img.src),
            inventory_policy: variant.inventory_policy || 'deny',
            // Use Shopify's original timestamps
            created_at: product.created_at,
            updated_at: product.updated_at,
          });
        }
      }

      if (variants.length === 0) return result;

      setSyncProgress(`Processing ${variants.length} product variants...`);

      // Process in batches
      const batchSize = 50;
      for (let i = 0; i < variants.length; i += batchSize) {
        const batch = variants.slice(i, i + batchSize);
        setSyncProgress(`Processing variants ${i + 1}-${Math.min(i + batchSize, variants.length)} of ${variants.length}...`);

        const variantIds = batch.map(v => v.shopify_variant_id);
        const { data: existingProducts } = await supabase
          .from('products_shopify')
          .select('*')
          .in('shopify_variant_id', variantIds);

        const existingMap = new Map((existingProducts || []).map((p: any) => [p.shopify_variant_id, p]));

        for (const variant of batch) {
          const existing = existingMap.get(variant.shopify_variant_id);

          if (existing) {
            const diff = computeDiff(existing, variant, ['title', 'sku', 'price', 'images', 'inventory_policy']);
            if (diff) {
              await supabase.from('products_shopify').update({
                ...variant,
                updated_at: variant.updated_at,
              }).eq('id', existing.id);
              await logSync({
                integration: 'shopify',
                entity_type: 'product',
                entity_id: variant.shopify_variant_id,
                action: 'updated',
                changes: diff,
              });
              result.updated++;
            } else {
              result.unchanged++;
            }
          } else {
            await supabase.from('products_shopify').insert([variant]);
            await logSync({
              integration: 'shopify',
              entity_type: 'product',
              entity_id: variant.shopify_variant_id,
              action: 'created',
              changes: null,
            });
            result.created++;
          }
        }
      }
    } catch (err: any) {
      console.error('[ShopifySync] Products sync error:', err);
      throw err;
    }

    return result;
  }, []);

  // ──── Sync All ────
  const syncAll = useCallback(async () => {
    setIsSyncing(true);
    const results: Record<string, SyncResult> = {};

    try {
      toast.info('Starting Shopify sync...');

      results.orders = await syncOrders();
      results.customers = await syncCustomers();
      results.products = await syncProducts();

      setLastSyncResult(results);
      setSyncProgress('');

      const totalCreated = Object.values(results).reduce((s, r) => s + r.created, 0);
      const totalUpdated = Object.values(results).reduce((s, r) => s + r.updated, 0);

      if (totalCreated === 0 && totalUpdated === 0) {
        toast.success('Sync complete — everything is up to date');
      } else {
        toast.success(`Sync complete — ${totalCreated} created, ${totalUpdated} updated`);
      }
    } catch (err: any) {
      toast.error('Sync failed: ' + err.message);
      setSyncProgress('');
    } finally {
      setIsSyncing(false);
    }

    return results;
  }, [syncOrders, syncCustomers, syncProducts]);

  // ──── Get Sync Logs ────
  const getSyncLogs = useCallback(async (entityType?: string, limit: number = 50) => {
    let query = supabase
      .from('sync_logs')
      .select('*')
      .order('synced_at', { ascending: false })
      .limit(limit);

    if (entityType) query = query.eq('entity_type', entityType);

    const { data, error } = await query;
    if (error) throw error;
    return data as SyncLogEntry[];
  }, []);

  return {
    isSyncing,
    syncProgress,
    lastSyncResult,
    syncOrders,
    syncRecentOrders,
    syncCustomers,
    syncRecentCustomers,
    syncProducts,
    syncAll,
    getSyncLogs,
  };
}

// ──── Helper: Upsert Customer ────
async function upsertCustomer(shopifyCustomer: any): Promise<string | null> {
  if (!shopifyCustomer?.id) return null;

  const shopifyId = String(shopifyCustomer.id);

  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('shopify_customer_id', shopifyId)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('customers')
    .insert([{
      shopify_customer_id: shopifyId,
      first_name: shopifyCustomer.first_name || '',
      last_name: shopifyCustomer.last_name || '',
      email: shopifyCustomer.email || '',
      phone: shopifyCustomer.phone || null,
      created_at: shopifyCustomer.created_at,
      updated_at: shopifyCustomer.updated_at,
    }])
    .select('id')
    .single();

  if (error) {
    console.error('[ShopifySync] Failed to create customer:', error);
    return null;
  }

  return created?.id || null;
}

// ──── Helper: Insert Line Items ────
async function insertLineItems(orderId: string, lineItems: any[]) {
  if (!lineItems || lineItems.length === 0) return;

  const items = lineItems.map((li: any) => ({
    order_id: orderId,
    shopify_line_item_id: String(li.id),
    shopify_variant_id: li.variant_id ? String(li.variant_id) : null,
    product_id: li.product_id ? String(li.product_id) : null,
    name: li.name || li.title || 'Unknown',
    sku: li.sku || '',
    quantity: li.quantity || 1,
    price: parseFloat(li.price) || 0,
  }));

  await supabase.from('order_items').insert(items);
}

// ──── Helper: Sync Line Items (BATCHED) ────
async function syncOrderLineItems(orderId: string, shopifyItems: any[], existingItems: any[]) {
  const existingMap = new Map(existingItems.map((i: any) => [i.shopify_line_item_id, i]));

  const toInsert: any[] = [];
  const toUpdate: { id: string; data: any }[] = [];

  for (const li of shopifyItems) {
    const shopifyLineId = String(li.id);
    const existing = existingMap.get(shopifyLineId);

    const itemData = {
      order_id: orderId,
      shopify_line_item_id: shopifyLineId,
      shopify_variant_id: li.variant_id ? String(li.variant_id) : null,
      product_id: li.product_id ? String(li.product_id) : null,
      name: li.name || li.title || 'Unknown',
      sku: li.sku || '',
      quantity: li.quantity || 1,
      price: parseFloat(li.price) || 0,
    };

    if (existing) {
      // Only update if something actually changed
      if (existing.quantity !== itemData.quantity || parseFloat(existing.price) !== itemData.price || existing.name !== itemData.name || existing.shopify_variant_id !== itemData.shopify_variant_id) {
        toUpdate.push({ id: existing.id, data: itemData });
      }
    } else {
      toInsert.push(itemData);
    }
  }

  // Batch insert new items
  if (toInsert.length > 0) {
    await supabase.from('order_items').insert(toInsert);
  }

  // Batch update changed items (use Promise.all since Supabase doesn't support bulk update by different IDs)
  if (toUpdate.length > 0) {
    await Promise.all(toUpdate.map(u => 
      supabase.from('order_items').update(u.data).eq('id', u.id)
    ));
  }

  // Batch delete removed items
  const shopifyLineIds = shopifyItems.map((li: any) => String(li.id));
  const toDelete = existingItems
    .filter((e: any) => e.shopify_line_item_id && !shopifyLineIds.includes(e.shopify_line_item_id))
    .map((e: any) => e.id);
  
  if (toDelete.length > 0) {
    await supabase.from('order_items').delete().in('id', toDelete);
  }
}
