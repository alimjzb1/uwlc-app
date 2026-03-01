import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Vite SUPABASE connection string in environment");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("--- Starting Sync and Deduction ---");

  try {
    // 1. Get primary location ID
    const { data: locations, error: locErr } = await supabase.from('inventory_locations').select('id').limit(1);
    if (locErr || !locations || locations.length === 0) {
      console.error("Could not find a location!", locErr);
      return;
    }
    const locId = locations[0].id;
    console.log("Using primary location ID:", locId);

    // 2. Sync Location Stock (inventory_levels) with Inventory Stock (products_inventory.quantity_on_hand)
    console.log("Step 1: Syncing Location Stock to match Inventory Stock...");
    const { data: products, error: prodErr } = await supabase.from('products_inventory').select('id, quantity_on_hand');
    if (prodErr || !products) throw prodErr;

    const upserts = products.map(p => ({
        product_id: p.id,
        location_id: locId,
        quantity: p.quantity_on_hand || 0
    }));

    // Batch upsert inventory_levels
    for (let i = 0; i < upserts.length; i += 100) {
        const batch = upserts.slice(i, i + 100);
        const { error: upsertErr } = await supabase
            .from('inventory_levels')
            .upsert(batch, { onConflict: 'product_id,location_id' });
        if (upsertErr) {
            console.error("Error upserting inventory levels:", upsertErr);
        }
    }
    console.log(`Synced ${products.length} products into inventory_levels for location ${locId}.`);

    // 3. Deduct Stock for `ready_to_ship` orders
    console.log("\nStep 2: Processing deductions for 'ready_to_ship' orders...");
    const { data: orders, error: ordersErr } = await supabase
        .from('orders')
        .select('id')
        .eq('internal_status', 'ready_to_ship');

    if (ordersErr || !orders) throw ordersErr;
    console.log(`Found ${orders.length} orders in 'ready_to_ship' status to deduct.`);

    for (const order of orders) {
        await deductStockForOrder(order.id, locId);
        console.log(`Deducted stock for order: ${order.id}`);
    }

    console.log("\n--- All operations completed successfully ---");
  } catch (err) {
    console.error("Script failed:", err);
  }
}

// Emulated logic of deductStockForOrder adapted for script
async function deductStockForOrder(orderId: string, primaryLocationId: string) {
    const { data: items } = await supabase.from('order_items').select('*').eq('order_id', orderId);
    if (!items || items.length === 0) return;

    const deductions: { type: 'shopify' | 'internal', id: string, take: number, current: number }[] = [];
    const locationDeductions: { id?: string, location_id: string, product_id: string, take: number, current: number }[] = [];

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

    const locationStockMap = new Map<string, any[]>();
    locationLevelsRes.data?.forEach(level => {
        if (!locationStockMap.has(level.product_id)) locationStockMap.set(level.product_id, []);
        locationStockMap.get(level.product_id)!.push(level);
    });

    for (const item of items) {
        const sku = item.sku;
        const shopifyVariantId = item.shopify_variant_id || null;
        
        let remainingRequired = item.quantity;

        const bridges = shopifyVariantId ? (bridgeMap.get(shopifyVariantId) || []) : [];
        const internalProductIds = bridges.length > 0 
            ? bridges 
            : (sku && skuToInternalMap[sku] 
                ? [{ id: skuToInternalMap[sku], qtyPerUnit: 1 }] 
                : (item.product_id && item.product_id.length > 20 
                    ? [{ id: item.product_id, qtyPerUnit: 1 }] 
                    : []));

        // Shopify Deduc
        if (sku) {
            const filtered = await supabase.from('products_shopify').select('*').eq('sku', sku).eq('local_inventory_enabled', true).limit(1);
            const shopifyVariant = filtered.data?.[0];
            if (shopifyVariant) {
                const available = shopifyVariant.local_quantity || 0;
                const take = Math.min(remainingRequired, available);
                if (take > 0) {
                    remainingRequired -= take;
                    deductions.push({ type: 'shopify', id: shopifyVariant.shopify_variant_id, take, current: available });
                }
            }
        }

        // Internal Deduc
        if (remainingRequired > 0 && internalProductIds.length > 0) {
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

                    // Location Deduc
                    let compRemainingToDeduct = deduction;
                    const locations = locationStockMap.get(comp.id) || [{ location_id: primaryLocationId, product_id: comp.id, quantity: current }];
                    for (const loc of locations) {
                        if (compRemainingToDeduct <= 0) break;
                        const availInLoc = loc.quantity;
                        // Avoid taking 0 if we can, but if it's the only one just negative it
                        const takeFromLoc = availInLoc > 0 ? Math.min(availInLoc, compRemainingToDeduct) : compRemainingToDeduct;
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
                remainingRequired -= maxPossibleSets;
            }
        }
    }

    // Execute Deductions
    for (const ded of deductions) {
        if (ded.type === 'shopify') {
             await supabase.from('products_shopify').update({ local_quantity: Math.max(0, ded.current - ded.take) }).eq('shopify_variant_id', ded.id);
        } else {
             await supabase.from('products_inventory').update({ quantity_on_hand: Math.max(0, ded.current - ded.take) }).eq('id', ded.id);
        }
    }

    for (const locDed of locationDeductions) {
         if (locDed.id) {
             await supabase.from('inventory_levels').update({ quantity: Math.max(0, locDed.current - locDed.take) }).eq('id', locDed.id);
         } else {
             await supabase.from('inventory_levels').upsert({ location_id: locDed.location_id, product_id: locDed.product_id, quantity: Math.max(0, locDed.current - locDed.take) });
         }
    }
}

main();
