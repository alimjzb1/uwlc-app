import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Product } from '@/types';
import { useAudit } from './use-audit';

export function useInventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { logAction } = useAudit();

  useEffect(() => {
    fetchInventory();
  }, []);

  async function fetchInventory() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products_inventory')
        .select('*')
        .order('created_at', { ascending: false })
        .range(0, 1000);

      if (error) throw error;
      setProducts(data as Product[]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const addProduct = async (product: Partial<Product>) => {
    const { images, parent, ...sanitizedProduct } = product as any;
    const { data, error } = await supabase
      .from('products_inventory')
      .insert([sanitizedProduct])
      .select()
      .single();
    if (error) throw error;
    await logAction('CREATE_PRODUCT', 'products_inventory', data.id, { product: sanitizedProduct });
    await fetchInventory();
    return data;
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    const { images, parent, ...sanitizedUpdates } = updates as any;
    const { error } = await supabase
      .from('products_inventory')
      .update(sanitizedUpdates)
      .eq('id', id);
    if (error) throw error;
    await logAction('UPDATE_PRODUCT', 'products_inventory', id, { updates: sanitizedUpdates });
    await fetchInventory();
  };

  const deleteProduct = async (id: string) => {
    // Manual Cascade Delete (in case SQL migration isn't run)
    
    // 1. Delete Images
    await supabase.from('product_images').delete().eq('product_id', id);
    
    // 2. Delete Inventory Levels
    await supabase.from('inventory_levels').delete().eq('product_id', id);

    // 3. Delete Product Links
    await supabase.from('product_links').delete().eq('inventory_product_id', id);

    // 4. Delete Variants (if this is a parent)
    await supabase.from('products_inventory').delete().eq('parent_id', id);

    // 5. Delete the Product
    const { error } = await supabase
      .from('products_inventory')
      .delete()
      .eq('id', id);
    if (error) throw error;
    await logAction('DELETE_PRODUCT', 'products_inventory', id);
    await fetchInventory();
  };

  const addProductImage = async (productId: string, url: string) => {
    const { error } = await supabase
      .from('product_images')
      .insert([{ product_id: productId, url }]);
    if (error) throw error;
    await fetchInventory(); // Refresh might be overkill but ensures consistency
  };

  const deleteProductImage = async (imageId: string) => {
    const { error } = await supabase
      .from('product_images')
      .delete()
      .eq('id', imageId);
    if (error) throw error;
    await fetchInventory();
  };

  const deductStockForOrder = async (orderId: string) => {
    try {
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);
      
      if (itemsError) throw itemsError;
      if (!items || items.length === 0) return { success: true };

      const missingItems = [];
      const deductions: { type: 'shopify' | 'internal', id: string, take: number, current: number }[] = [];
      const locationDeductions: { id: string, location_id: string, product_id: string, take: number, current: number }[] = [];

      // 0. Fetch bridges and inventory for SKU fallback
      const [linksRes, inventoryRes, locationLevelsRes] = await Promise.all([
          supabase.from('product_links').select('*'),
          supabase.from('products_inventory').select('id, sku, quantity_on_hand'),
          supabase.from('inventory_levels').select('*').gt('quantity', 0)
      ]);

      const bridgeMap = new Map<string, { id: string, qtyPerUnit: number }[]>();
      linksRes.data?.forEach(l => {
          const variantId = l.shopify_variant_id;
          const comp = { id: l.inventory_product_id, qtyPerUnit: l.quantity_per_unit || 1 };
          if (!bridgeMap.has(variantId)) bridgeMap.set(variantId, []);
          bridgeMap.get(variantId)!.push(comp);
      });

      const internalStockMap = new Map<string, number>();
      const skuToInternalMap: Record<string, string> = {};
      inventoryRes.data?.forEach(p => {
          internalStockMap.set(p.id, p.quantity_on_hand || 0);
          if (p.sku) skuToInternalMap[p.sku] = p.id;
      });

      // Map product_id -> [list of locations with stock]
      const locationStockMap = new Map<string, any[]>();
      locationLevelsRes.data?.forEach(level => {
          if (!locationStockMap.has(level.product_id)) locationStockMap.set(level.product_id, []);
          locationStockMap.get(level.product_id)!.push(level);
      });

      // 1. Calculate required vs available
      for (const item of items) {
          const sku = item.sku;
          const shopifyVariantId = item.shopify_variant_id || null;
          
          let required = item.quantity;
          let remainingRequired = required;
          let foundAvail = 0;

          // 1.1 Resolve internal product(s) via Bridge or SKU Fallback
          const bridges = shopifyVariantId ? (bridgeMap.get(shopifyVariantId) || []) : [];
          const internalProductIds = bridges.length > 0 
              ? bridges 
              : (sku && skuToInternalMap[sku] 
                  ? [{ id: skuToInternalMap[sku], qtyPerUnit: 1 }] 
                  : (item.product_id && item.product_id.length > 20 
                      ? [{ id: item.product_id, qtyPerUnit: 1 }] 
                      : []));

          // Check Shopify Local Inventory
          if (sku) {
              let shopifyMatches: any[] | null = null;
              const filtered = await supabase
                  .from('products_shopify')
                  .select('*')
                  .eq('sku', sku)
                  .eq('local_inventory_enabled', true)
                  .limit(1);
              if (!filtered.error) {
                  shopifyMatches = filtered.data;
              } else {
                  // Fallback: column might not exist
                  const fallback = await supabase
                      .from('products_shopify')
                      .select('*')
                      .eq('sku', sku)
                      .limit(1);
                  shopifyMatches = fallback.data;
              }

              const shopifyVariant = shopifyMatches?.[0];
              if (shopifyVariant) {
                  const available = shopifyVariant.local_quantity || 0;
                  const take = Math.min(remainingRequired, available);
                  if (take > 0) {
                      foundAvail += take;
                      remainingRequired -= take;
                      deductions.push({ type: 'shopify', id: shopifyVariant.shopify_variant_id, take, current: available });
                  }
              }
          }

          // Check Internal Inventory for all components
          if (remainingRequired > 0 && internalProductIds.length > 0) {
              // Bottleneck check for bundles
              let maxPossibleSets = remainingRequired;
              for (const comp of internalProductIds) {
                  const avail = internalStockMap.get(comp.id) || 0;
                  const setsForThisComp = Math.floor(avail / comp.qtyPerUnit);
                  maxPossibleSets = Math.min(maxPossibleSets, setsForThisComp);
              }

              if (maxPossibleSets > 0) {
                  for (const comp of internalProductIds) {
                      const deduction = maxPossibleSets * comp.qtyPerUnit;
                      const current = internalStockMap.get(comp.id) || 0;
                      internalStockMap.set(comp.id, current - deduction);
                      deductions.push({ type: 'internal', id: comp.id, take: deduction, current: current });

                      // Map location deductions
                      let compRemainingToDeduct = deduction;
                      const locations = locationStockMap.get(comp.id) || [];
                      for (const loc of locations) {
                          if (compRemainingToDeduct <= 0) break;
                          const availInLoc = loc.quantity;
                          const takeFromLoc = Math.min(availInLoc, compRemainingToDeduct);
                          if (takeFromLoc > 0) {
                              locationDeductions.push({
                                  id: loc.id,
                                  location_id: loc.location_id,
                                  product_id: loc.product_id,
                                  take: takeFromLoc,
                                  current: availInLoc
                              });
                              loc.quantity -= takeFromLoc;
                              compRemainingToDeduct -= takeFromLoc;
                          }
                      }
                  }
                  foundAvail += maxPossibleSets;
                  remainingRequired -= maxPossibleSets;
              }
          }

          // If it's a physical/tracked product that still has missing items
          if (remainingRequired > 0) {
              // REVERT: Only block if it's explicitly tracked on Shopify or linked to internal
              const isTrackedOnShopify = sku ? !!(await supabase.from('products_shopify').select('id').eq('sku', sku).maybeSingle()).data : false;
              const isLinked = internalProductIds.length > 0;

              if (isTrackedOnShopify || isLinked) {
                  missingItems.push({
                      name: item.name,
                      sku: item.sku || 'N/A',
                      required: item.quantity,
                      available: foundAvail
                  });
              }
          }
      }

      // 2. Block if any item is missing stock
      if (missingItems.length > 0) {
          return { success: false, missingItems };
      }

      // 3. Execute deductions since all items can be fulfilled
      for (const ded of deductions) {
          if (ded.type === 'shopify') {
               await supabase
                  .from('products_shopify')
                  .update({ local_quantity: Math.max(0, ded.current - ded.take) })
                  .eq('shopify_variant_id', ded.id);
               await logAction('DEDUCT_STOCK', 'products_shopify', ded.id, { amount: ded.take, order_id: orderId });
          } else {
               await supabase
                  .from('products_inventory')
                  .update({ quantity_on_hand: Math.max(0, ded.current - ded.take) })
                  .eq('id', ded.id);
               await logAction('DEDUCT_STOCK', 'products_inventory', ded.id, { amount: ded.take, order_id: orderId });
          }
      }

      // 4. Update specific location inventory levels
      for (const locDed of locationDeductions) {
           await supabase
              .from('inventory_levels')
              .update({ quantity: Math.max(0, locDed.current - locDed.take) })
              .eq('id', locDed.id);
           await logAction('DEDUCT_LOCATION_STOCK', 'inventory_levels', locDed.id, { product_id: locDed.product_id, location_id: locDed.location_id, amount: locDed.take, order_id: orderId });
      }

      await fetchInventory();
      return { success: true };
    } catch (err: any) {
      console.error("Stock deduction failed:", err);
      return { success: false, error: err.message };
    }
  };

  const rollbackStockForOrder = async (orderId: string) => {
    try {
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);
      
      if (itemsError) throw itemsError;
      if (!items || items.length === 0) return { success: true };

      const rollbacks: { type: 'shopify' | 'internal', id: string, amount: number }[] = [];
      const locationRollbacks: { id: string, amount: number }[] = [];

      const [linksRes, inventoryRes, auditRes] = await Promise.all([
          supabase.from('product_links').select('*'),
          supabase.from('products_inventory').select('id, sku, quantity_on_hand'),
          // Fetch the exact location deductions made for this order to restore them accurately
          supabase.from('audit_logs')
            .select('record_id, metadata')
            .eq('action', 'DEDUCT_LOCATION_STOCK')
            .eq('table_name', 'inventory_levels')
            .contains('metadata', { order_id: orderId })
      ]);

      const bridgeMap = new Map<string, { id: string, qtyPerUnit: number }[]>();
      linksRes.data?.forEach(l => {
          const variantId = l.shopify_variant_id;
          const comp = { id: l.inventory_product_id, qtyPerUnit: l.quantity_per_unit || 1 };
          if (!bridgeMap.has(variantId)) bridgeMap.set(variantId, []);
          bridgeMap.get(variantId)!.push(comp);
      });

      const skuToInternalMap: Record<string, string> = {};
      inventoryRes.data?.forEach(p => {
          if (p.sku) skuToInternalMap[p.sku] = p.id;
      });

      for (const item of items) {
          const sku = item.sku;
          const shopifyVariantId = item.shopify_variant_id || null;
          
          let required = item.quantity;
          let remainingRequired = required;

          const bridges = shopifyVariantId ? (bridgeMap.get(shopifyVariantId) || []) : [];
          const internalProductIds = bridges.length > 0 
              ? bridges 
              : (sku && skuToInternalMap[sku] 
                  ? [{ id: skuToInternalMap[sku], qtyPerUnit: 1 }] 
                  : (item.product_id && item.product_id.length > 20 
                      ? [{ id: item.product_id, qtyPerUnit: 1 }] 
                      : []));

          // Rollback Shopify Local Inventory First
          if (sku) {
              const filtered = await supabase
                  .from('products_shopify')
                  .select('shopify_variant_id, local_quantity')
                  .eq('sku', sku)
                  .eq('local_inventory_enabled', true)
                  .limit(1);
              
              const shopifyVariant = filtered.data?.[0];
              if (shopifyVariant) {
                  const take = remainingRequired; // Since deduction takes up to remaining, rollback restores what it can
                  // NOTE: In a perfect system we'd log exact deductions per order. Given the current setup, we restore the full required amount to the first valid source found, prioritizing Shopify then Internal, identical to deduction.
                  if (take > 0) {
                      remainingRequired -= take;
                      rollbacks.push({ type: 'shopify', id: shopifyVariant.shopify_variant_id, amount: take });
                  }
              }
          }

          if (remainingRequired > 0 && internalProductIds.length > 0) {
              for (const comp of internalProductIds) {
                  const deduction = remainingRequired * comp.qtyPerUnit;
                  rollbacks.push({ type: 'internal', id: comp.id, amount: deduction });
              }
          }
      }

      // Prepare exact location rollbacks based on audit history
      auditRes.data?.forEach(log => {
          const amount = log.metadata?.amount || 0;
          if (amount > 0 && log.record_id) {
              locationRollbacks.push({ id: log.record_id, amount });
          }
      });

      for (const roll of rollbacks) {
          if (roll.type === 'shopify') {
               const { data: current } = await supabase.from('products_shopify').select('local_quantity').eq('shopify_variant_id', roll.id).single();
               await supabase
                  .from('products_shopify')
                  .update({ local_quantity: Math.max(0, (current?.local_quantity || 0) + roll.amount) })
                  .eq('shopify_variant_id', roll.id);
               await logAction('ROLLBACK_STOCK', 'products_shopify', roll.id, { amount: roll.amount, order_id: orderId });
          } else {
               const { data: current } = await supabase.from('products_inventory').select('quantity_on_hand').eq('id', roll.id).single();
               await supabase
                  .from('products_inventory')
                  .update({ quantity_on_hand: Math.max(0, (current?.quantity_on_hand || 0) + roll.amount) })
                  .eq('id', roll.id);
               await logAction('ROLLBACK_STOCK', 'products_inventory', roll.id, { amount: roll.amount, order_id: orderId });
          }
      }

      // 5. Restore specific location inventory levels
      for (const locRoll of locationRollbacks) {
           const { data: currentLoc } = await supabase.from('inventory_levels').select('quantity, product_id, location_id').eq('id', locRoll.id).single();
           if (currentLoc) {
               await supabase
                  .from('inventory_levels')
                  .update({ quantity: currentLoc.quantity + locRoll.amount })
                  .eq('id', locRoll.id);
               await logAction('ROLLBACK_LOCATION_STOCK', 'inventory_levels', locRoll.id, { 
                   product_id: currentLoc.product_id, 
                   location_id: currentLoc.location_id, 
                   amount: locRoll.amount, 
                   order_id: orderId 
               });
           }
      }

      await fetchInventory();
      return { success: true };
    } catch (err: any) {
      console.error("Stock rollback failed:", err);
      return { success: false, error: err.message };
    }
  };

  return { 
    products, 
    loading, 
    error, 
    refreshInventory: fetchInventory,
    addProduct,
    updateProduct,
    deleteProduct,
    deductStockForOrder,
    rollbackStockForOrder,
    addProductImage,
    deleteProductImage,
  };
};


export function useProduct(id: string) {
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchProductData();
  }, [id]);

  async function fetchProductData() {
    process.env.NODE_ENV === 'development' && console.log(`[useProduct] Fetching product data: ${id}`);
    setLoading(true);
    
    const timeout = setTimeout(() => {
        if (loading) {
            console.error("[useProduct] Fetch timed out");
            setError("Request timed out. Please refresh.");
            setLoading(false);
        }
    }, 10000);

    try {
      const [productRes, variantsRes, imagesRes] = await Promise.all([
        supabase
          .from('products_inventory')
          .select('*')
          .eq('id', id)
          .single(),
        supabase
          .from('products_inventory')
          .select('*')
          .eq('parent_id', id)
          .order('name', { ascending: true })
          .range(0, 1000),
        supabase
          .from('product_images')
          .select('*')
          .eq('product_id', id)
          .order('position', { ascending: true })
      ]);

      if (productRes.error) throw productRes.error;
      
      const productData = productRes.data as Product;
      setProduct({ ...productData, images: imagesRes.data || [] } as any); 
      setVariants(variantsRes.data as Product[]);
      process.env.NODE_ENV === 'development' && console.log("[useProduct] Data loaded successfully");
    } catch (err: any) {
      console.error("[useProduct] Error:", err);
      setError(err.message);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }

  return { product, variants, loading, error, refresh: fetchProductData };
}
