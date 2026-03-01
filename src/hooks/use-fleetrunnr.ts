import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAudit } from '@/hooks/use-audit';

export interface FleetrunnrSyncResult {
  updated: number;
  unchanged: number;
  failed: number;
  total: number;
}

const FLEETRUNNR_API_KEY = import.meta.env.VITE_FLEETRUNNR_API_KEY;

export function useFleetrunnr() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [lastSyncResult, setLastSyncResult] = useState<FleetrunnrSyncResult | null>(null);
  const { logAction } = useAudit();

  const syncDeliveryStatuses = useCallback(async (): Promise<FleetrunnrSyncResult> => {
    const result: FleetrunnrSyncResult = { updated: 0, unchanged: 0, failed: 0, total: 0 };
    
    if (!FLEETRUNNR_API_KEY) {
       console.warn("Fleetrunnr API key is missing. Sync skipped.");
       throw new Error("Fleetrunnr API key is not configured in .env. Please see .env.example.");
    }

    try {
      setIsSyncing(true);
      setSyncProgress('Fetching active orders...');

      // 1. Fetch Orders that are active (not delivered, cancelled, returned) and have tracking numbers
      const { data: activeOrders, error: fetchError } = await supabase
        .from('orders')
        .select('id, tracking_number, internal_status, shopify_order_number')
        .not('internal_status', 'in', '("delivered","cancelled","returned")')
        .not('tracking_number', 'is', 'null');

      if (fetchError) throw fetchError;
      
      const ordersToSync = activeOrders || [];
      result.total = ordersToSync.length;

      if (ordersToSync.length === 0) {
          setSyncProgress('');
          return result;
      }

      setSyncProgress(`Checking status for ${ordersToSync.length} orders...`);

      // 2. Map Fleetrunnr status
      // We process sequentially or in small parallel batches to avoid rate limits
      for (let i = 0; i < ordersToSync.length; i++) {
        const order = ordersToSync[i];
        
        try {
           setSyncProgress(`Checking order ${i+1}/${ordersToSync.length} (${order.shopify_order_number})...`);
           
           // Replace with actual Fleetrunnr API call using fetch
           const { data: payload, error: proxyError } = await supabase.functions.invoke('fleetrunnr-proxy', {
               body: {
                   endpoint: `orders?order_number=${order.tracking_number}`,
                   apiKey: FLEETRUNNR_API_KEY
               }
           });

           if (proxyError || payload?.error) {
               console.error(`Failed to fetch Fleetrunnr status for ${order.tracking_number}:`, proxyError || payload?.error);
               result.failed++;
               continue;
           }
           // Expecting { message: "success", data: { order: { status: "NEW" } } }
           const fleetrunnrStatus = payload.data?.order?.status?.toLowerCase();
           
           if (!fleetrunnrStatus) {
               result.failed++;
               continue;
           }

           let newInternalStatus = order.internal_status;

           // Strict Mapping Rule set by user:
           // "if it is delivered to be delivered"
           // "if it was in transit or out for delivery or shipped then the status is shipped."
           // "if it was ready then its status is new. if it was ready, but we already went through packaging and confirmed by admin and reached ready to ship status then it stays ready to ship."
           // "for cancelled orders we get then only from shopify."
           
           if (fleetrunnrStatus === 'delivered') {
               newInternalStatus = 'delivered';
           } else if (['in transit', 'out for delivery', 'shipped'].includes(fleetrunnrStatus)) {
               newInternalStatus = 'shipped';
           } else if (fleetrunnrStatus === 'ready') {
               // Check if it's already past 'new'
               const advancedStatuses = ['packaging', 'ready to ship', 'shipped', 'delivered', 'returned'];
               if (!advancedStatuses.includes(order.internal_status)) {
                    newInternalStatus = 'new';
               }
           }
           
           // Check if changed
           if (newInternalStatus !== order.internal_status) {
                const { error: updateError } = await supabase
                    .from('orders')
                    .update({ internal_status: newInternalStatus })
                    .eq('id', order.id);
                    
                if (updateError) throw updateError;

                await logAction('updated', 'orders', order.id, {
                   reason: 'Fleetrunnr sync status update',
                   old_data: { internal_status: order.internal_status },
                   new_data: { internal_status: newInternalStatus }
                });

                result.updated++;
           } else {
               result.unchanged++;
           }

        } catch (err) {
            console.error(`Error processing order ${order.tracking_number}:`, err);
            result.failed++;
        }
      }

      setLastSyncResult(result);
      setSyncProgress('');

    } catch (err: any) {
      console.error("Fleetrunnr sync error:", err);
      setSyncProgress('');
      throw err;
    } finally {
      setIsSyncing(false);
    }

    return result;
  }, [logAction]);

  return { syncDeliveryStatuses, isSyncing, syncProgress, lastSyncResult };
}
