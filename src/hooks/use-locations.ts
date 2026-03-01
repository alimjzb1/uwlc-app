import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { InventoryLocation, InventoryLevel } from '@/types';
import { useAudit } from './use-audit';

export function useLocations() {
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { logAction } = useAudit();

  useEffect(() => {
    fetchLocations();
  }, []);

  async function fetchLocations() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('inventory_locations')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setLocations(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const addLocation = async (location: Partial<InventoryLocation>) => {
    const { data, error } = await supabase
      .from('inventory_locations')
      .insert([location])
      .select()
      .single();
    if (error) throw error;
    await fetchLocations();
    return data;
  };

  const updateLocation = async (id: string, updates: Partial<InventoryLocation>) => {
    const { error } = await supabase
      .from('inventory_locations')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
    await fetchLocations();
  };

  const deleteLocation = async (id: string) => {
    const { error } = await supabase
      .from('inventory_locations')
      .delete()
      .eq('id', id);
    if (error) throw error;
    await fetchLocations();
  };

  const getStockByLocation = async (productId: string | string[]) => {
    const query = supabase
      .from('inventory_levels')
      .select(`
        *,
        location:inventory_locations(*)
      `);

    if (Array.isArray(productId)) {
      query.in('product_id', productId);
    } else {
      query.eq('product_id', productId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as (InventoryLevel & { location: InventoryLocation })[];
  };

  const transferStock = async (params: {
    productId: string;
    fromLocationId: string | null; // null means unallocated
    toLocationId: string | null;   // null means unallocated
    quantity: number;
    reason: string;
    notes?: string;
  }) => {
    console.log("[use-locations] Initiating transfer:", params);
    
    if (params.quantity <= 0) throw new Error("Quantity must be greater than 0");
    if (params.fromLocationId === params.toLocationId) throw new Error("Source and destination must be different");

    try {
        // 1. Validate Availability
        if (params.fromLocationId) {
            const { data: fromLevel } = await supabase
                .from('inventory_levels')
                .select('quantity')
                .match({ product_id: params.productId, location_id: params.fromLocationId })
                .maybeSingle();
            
            if (!fromLevel || fromLevel.quantity < params.quantity) {
                throw new Error(`Insufficient stock in source location. Available: ${fromLevel?.quantity || 0}`);
            }
        } else {
            // Check Unallocated
            const { data: product } = await supabase.from('products_inventory').select('quantity_on_hand').eq('id', params.productId).single();
            const { data: levels } = await supabase.from('inventory_levels').select('quantity').eq('product_id', params.productId);
            const totalAllocated = levels?.reduce((sum, l) => sum + l.quantity, 0) || 0;
            const unallocated = (product?.quantity_on_hand || 0) - totalAllocated;
            
            if (unallocated < params.quantity) {
                throw new Error(`Insufficient unallocated stock. Available: ${unallocated}`);
            }
        }

        // 2. Perform Transfer
        // Deduct from source
        if (params.fromLocationId) {
            const { data: current } = await supabase
                .from('inventory_levels')
                .select('quantity')
                .match({ product_id: params.productId, location_id: params.fromLocationId })
                .single();
            
            if (!current) throw new Error("Could not find source stock record");

            await supabase
                .from('inventory_levels')
                .update({ quantity: current.quantity - params.quantity })
                .match({ product_id: params.productId, location_id: params.fromLocationId });
        }

        // Add to destination
        if (params.toLocationId) {
            const { data: existing } = await supabase
                .from('inventory_levels')
                .select('*')
                .match({ product_id: params.productId, location_id: params.toLocationId })
                .maybeSingle();
            
            if (existing) {
                await supabase
                    .from('inventory_levels')
                    .update({ quantity: existing.quantity + params.quantity })
                    .match({ product_id: params.productId, location_id: params.toLocationId });
            } else {
                await supabase
                    .from('inventory_levels')
                    .insert({
                        product_id: params.productId,
                        location_id: params.toLocationId,
                        quantity: params.quantity
                    });
            }
        }

        // 3. Log Audit
        await logAction('TRANSFER_STOCK', 'products_inventory', params.productId, {
            from_location_id: params.fromLocationId,
            to_location_id: params.toLocationId,
            quantity: params.quantity,
            reason: params.reason,
            notes: params.notes,
            type: 'transfer'
        });

        await fetchLocations();
        return { success: true };
    } catch (err: any) {
        console.error("[use-locations] Transfer failed:", err);
        throw err;
    }
  };

  return {
    locations,
    loading,
    error,
    refresh: fetchLocations,
    addLocation,
    updateLocation,
    deleteLocation,
    getStockByLocation,
    transferStock,
    adjustStockAtLocation: async (params: {
        locationId: string;
        productId: string;
        amount: number; // Positive for add, negative for deduct
        reason: string;
        notes?: string;
    }) => {
        const { locationId, productId, amount, reason, notes } = params;
        
        // 1. Fetch current product and level
        const { data: product, error: pError } = await supabase
            .from('products_inventory')
            .select('quantity_on_hand, name, sku, low_stock_threshold')
            .eq('id', productId)
            .single();
        
        if (pError) throw pError;

        const { data: level } = await supabase
            .from('inventory_levels')
            .select('*')
            .match({ location_id: locationId, product_id: productId })
            .maybeSingle();

        const currentLevelQty = level?.quantity || 0;
        const newLevelQty = currentLevelQty + amount;

        if (newLevelQty < 0) {
            throw new Error(`Insufficient stock at this location. Current: ${currentLevelQty}, requested deduct: ${Math.abs(amount)}`);
        }

        // 2. Update Location Level
        if (level) {
            const { error: luError } = await supabase
                .from('inventory_levels')
                .update({ quantity: newLevelQty, updated_at: new Date().toISOString() })
                .eq('id', level.id);
            if (luError) throw luError;
        } else {
            const { error: liError } = await supabase
                .from('inventory_levels')
                .insert({
                    location_id: locationId,
                    product_id: productId,
                    quantity: newLevelQty,
                    updated_at: new Date().toISOString()
                });
            if (liError) throw liError;
        }

        // 3. Update Product Aggregate
        const newTotalQty = (product.quantity_on_hand || 0) + amount;
        const { error: puError } = await supabase
            .from('products_inventory')
            .update({ quantity_on_hand: newTotalQty, updated_at: new Date().toISOString() })
            .eq('id', productId);
        
        if (puError) throw puError;

        // 4. Log Action
        await logAction('adjust_stock', 'products_inventory', productId, {
            reason,
            old_data: { quantity: currentLevelQty, total_quantity: product.quantity_on_hand },
            new_data: { quantity: newLevelQty, total_quantity: newTotalQty },
            metadata: {
                locationId,
                amount,
                type: amount > 0 ? 'add' : 'deduct',
                variantSku: product.sku,
                notes
            }
        });

        return { success: true, newTotal: newTotalQty, newLevel: newLevelQty };
    },

    distributeStockToLocation: async (locationId: string, productId: string, quantity: number, _notes?: string) => {
      // 1. Check Availability (Unallocated Logic)
      const { data: product, error: pError } = await supabase
        .from('products_inventory')
        .select('quantity_on_hand, name')
        .eq('id', productId)
        .single();
      
      if (pError) throw pError;
      
      const { data: levels, error: lError } = await supabase
        .from('inventory_levels')
        .select('quantity')
        .eq('product_id', productId);
      
      if (lError) throw lError;

      const totalAllocated = levels?.reduce((sum, level) => sum + level.quantity, 0) || 0;
      const availableUnallocated = (product.quantity_on_hand || 0) - totalAllocated;

      if (quantity > availableUnallocated) {
        throw new Error(`Cannot assign ${quantity} units. Only ${availableUnallocated} unallocated units available for ${product.name}.`);
      }

      const { data: existing } = await supabase
        .from('inventory_levels')
        .select('*')
        .match({ location_id: locationId, product_id: productId })
        .maybeSingle();
      
      if (existing) {
        const { error } = await supabase
          .from('inventory_levels')
          .update({ quantity: existing.quantity + quantity, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('inventory_levels')
          .insert({
            location_id: locationId,
            product_id: productId,
            quantity: quantity,
            updated_at: new Date().toISOString()
          });
        if (error) throw error;
      }
      
      await logAction('distribute_stock', 'products_inventory', productId, {
        locationId,
        quantity,
        notes: _notes,
        productName: product.name
      });
    },

    updateStockInLocation: async (locationId: string, productId: string, newQuantity: number) => {
       // Optional: Add Cap Check here too? 
       // If increasing, check if we have enough unallocated.
       // For now, allow edit but maybe warn? Or strict check?
       // Let's implement strict check if increasing.
       
       const { data: product } = await supabase.from('products_inventory').select('quantity_on_hand').eq('id', productId).single();
       const { data: levels } = await supabase.from('inventory_levels').select('quantity, location_id').eq('product_id', productId);
       
       const otherAllocated = levels?.filter(l => l.location_id !== locationId).reduce((sum, l) => sum + l.quantity, 0) || 0;
       
       const totalAvailable = product?.quantity_on_hand || 0;
       const maxAllowed = totalAvailable - otherAllocated;

       if (newQuantity > maxAllowed) {
         throw new Error(`Cannot set to ${newQuantity}. Max allowed for this location is ${maxAllowed} (based on unallocated stock).`);
       }

       const { error } = await supabase
        .from('inventory_levels')
        .update({ quantity: newQuantity })
        .match({ location_id: locationId, product_id: productId });

       if (error) throw error;
       await fetchLocations();
    },

    removeStockFromLocation: async (locationId: string, productId: string) => {
       const { error } = await supabase
        .from('inventory_levels')
        .delete()
        .match({ location_id: locationId, product_id: productId });
       
       if (error) throw error;
       await fetchLocations();
    }
  };
}


