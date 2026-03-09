import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAudit } from '@/hooks/use-audit';

export interface FleetrunnrSyncResult {
  updated: number;
  unchanged: number;
  failed: number;
  total: number;
}

export interface FleetrunnrInvoiceSyncResult {
  invoicesCreated: number;
  invoicesUpdated: number;
  settlementsCreated: number;
  settlementsUpdated: number;
  ordersUpdated: number;
  failed: number;
  total: number;
}

const FLEETRUNNR_API_KEY = import.meta.env.VITE_FLEETRUNNR_API_KEY;

export function useFleetrunnr() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingInvoices, setIsSyncingInvoices] = useState(false);
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
      for (let i = 0; i < ordersToSync.length; i++) {
        const order = ordersToSync[i];
        
        try {
           setSyncProgress(`Checking order ${i+1}/${ordersToSync.length} (${order.shopify_order_number})...`);
           
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
           const fleetrunnrStatus = payload.data?.order?.status?.toLowerCase();
           
           if (!fleetrunnrStatus) {
               result.failed++;
               continue;
           }

           let newInternalStatus = order.internal_status;

           if (fleetrunnrStatus === 'delivered') {
               newInternalStatus = 'delivered';
           } else if (['in transit', 'out for delivery', 'shipped'].includes(fleetrunnrStatus)) {
               newInternalStatus = 'shipped';
           } else if (fleetrunnrStatus === 'ready') {
               const advancedStatuses = ['packaging', 'ready to ship', 'shipped', 'delivered', 'returned'];
               if (!advancedStatuses.includes(order.internal_status)) {
                    newInternalStatus = 'new';
               }
           }
           
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

  /**
   * Sync carrier billing invoices from Fleetrunnr.
   * Fetches invoices via GET /invoices (paginated),
   * upserts them as 'received' type in our invoices table.
   */
  const syncFleetrunnrInvoices = useCallback(async (): Promise<FleetrunnrInvoiceSyncResult> => {
    const result: FleetrunnrInvoiceSyncResult = { 
      invoicesCreated: 0, 
      invoicesUpdated: 0, 
      settlementsCreated: 0,
      settlementsUpdated: 0,
      ordersUpdated: 0, 
      failed: 0, 
      total: 0 
    };

    if (!FLEETRUNNR_API_KEY) {
      throw new Error("Fleetrunnr API key is not configured.");
    }

    try {
      setIsSyncingInvoices(true);
      setSyncProgress('Fetching invoices from Fleetrunnr...');

      // Look up the delivery company for Fleetrunnr in our DB
      const { data: fleetrunnrCompany } = await supabase
        .from('delivery_companies')
        .select('id')
        .or('name.ilike.%fleetrunnr%,name.ilike.%fleet%')
        .limit(1)
        .single();
      const deliveryCompanyId = fleetrunnrCompany?.id || null;

      // Try to fetch invoices from Fleetrunnr API
      // Try multiple possible endpoint paths since the exact one isn't documented
      let allInvoices: any[] = [];
      const endpointCandidates = [
        'invoices',
        'accounting/invoices',
        'merchant-billing/invoices',
        'accounting/merchant-billing/invoices',
      ];

      let foundEndpoint = false;

      for (const candidateEndpoint of endpointCandidates) {
        setSyncProgress(`Trying ${candidateEndpoint}...`);
        
        try {
          const { data: payload, error: proxyError } = await supabase.functions.invoke('fleetrunnr-proxy', {
            body: { endpoint: `${candidateEndpoint}?limit=100`, apiKey: FLEETRUNNR_API_KEY }
          });

          // If the edge function itself errors (non-2xx from Fleetrunnr), proxyError will be set
          if (proxyError) {
            console.log(`Endpoint ${candidateEndpoint} failed:`, proxyError.message);
            continue;
          }
          
          // If the payload contains an error from Fleetrunnr
          if (payload?.error || payload?.status >= 400) {
            console.log(`Endpoint ${candidateEndpoint} returned error:`, payload?.error || payload?.details);
            continue;
          }

          // Parse response - Fleetrunnr uses various response shapes
          const invoicesData = payload?.data?.invoices || payload?.data || payload?.invoices || payload || [];
          const invoicesList = Array.isArray(invoicesData) ? invoicesData : [];

          if (invoicesList.length > 0) {
            allInvoices = invoicesList;
            foundEndpoint = true;
            console.log(`Found invoices via ${candidateEndpoint}: ${invoicesList.length} invoices`);

            // Paginate if we got a full page
            if (invoicesList.length >= 100) {
              let hasMore = true;
              let startingAfter = invoicesList[invoicesList.length - 1]?.invoice_number || invoicesList[invoicesList.length - 1]?.id;
              let page = 2;
              
              while (hasMore && startingAfter && page <= 20) {
                setSyncProgress(`Fetching invoices page ${page}...`);
                const { data: nextPayload, error: nextError } = await supabase.functions.invoke('fleetrunnr-proxy', {
                  body: { endpoint: `${candidateEndpoint}?limit=100&starting_after=${startingAfter}`, apiKey: FLEETRUNNR_API_KEY }
                });
                if (nextError || !nextPayload) break;
                const nextList = nextPayload?.data?.invoices || nextPayload?.data || nextPayload?.invoices || [];
                const nextInvoices = Array.isArray(nextList) ? nextList : [];
                allInvoices = [...allInvoices, ...nextInvoices];
                if (nextInvoices.length < 100) hasMore = false;
                else {
                  startingAfter = nextInvoices[nextInvoices.length - 1]?.invoice_number || nextInvoices[nextInvoices.length - 1]?.id;
                  if (!startingAfter) hasMore = false;
                }
                page++;
              }
            }
            break;
          }
          
          // Endpoint returned success but empty — might be valid but no invoices
          // Check if the response looks like a valid API response (not a 404 page)
          if (payload?.message === 'success' || payload?.data !== undefined) {
            foundEndpoint = true;
            console.log(`Endpoint ${candidateEndpoint} returned empty but valid response`);
            break;
          }
        } catch (err) {
          console.log(`Endpoint ${candidateEndpoint} threw:`, err);
          continue;
        }
      }

      // If no invoice endpoint worked, fall back to extracting from orders
      if (!foundEndpoint) {
        setSyncProgress('Invoice endpoints unavailable. Extracting from orders...');
        console.log('No invoice listing endpoint found, falling back to orders-based invoice extraction');

        // Fetch all orders with tracking numbers to extract financial data
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select('id, tracking_number, shopify_order_number, internal_status, total_price')
          .not('tracking_number', 'is', 'null')
          .limit(500);

        if (ordersError) throw ordersError;

        const ordersToProcess = orders || [];
        result.total = ordersToProcess.length;

        for (let i = 0; i < ordersToProcess.length; i++) {
          const order = ordersToProcess[i];
          try {
            setSyncProgress(`Fetching order ${i + 1}/${ordersToProcess.length} (#${order.shopify_order_number})...`);

            const { data: payload, error: proxyError } = await supabase.functions.invoke('fleetrunnr-proxy', {
              body: { endpoint: `orders?order_number=${order.tracking_number}`, apiKey: FLEETRUNNR_API_KEY }
            });

            if (proxyError || !payload?.data?.order) {
              result.failed++;
              continue;
            }

            const flOrder = payload.data.order;
            const carrierFees = flOrder.carrier?.fees || [];
            let deliveryFee = 0;
            carrierFees.forEach((f: any) => { deliveryFee += Number(f.amount) || 0; });

            if (deliveryFee > 0) {
              const invoiceNumber = `FR-${order.tracking_number}`;
              const flStatus = flOrder.status?.toLowerCase() || '';
              const carrierName = flOrder.carrier?.name || '';
              const mappedStatus = flStatus === 'delivered' ? 'paid' as const : 'pending' as const;

              // 1. Handle Invoice
              let invoiceId: string | null = null;
              const { data: existingInv } = await supabase
                .from('invoices')
                .select('id, amount, status, merchant_name')
                .eq('fleetrunnr_invoice_number', invoiceNumber)
                .single();

              if (existingInv) {
                invoiceId = existingInv.id;
                const hasChanges = existingInv.amount !== deliveryFee || 
                  existingInv.status !== mappedStatus ||
                  existingInv.merchant_name !== (carrierName || null);
                if (hasChanges) {
                  await supabase.from('invoices').update({
                    amount: deliveryFee, subtotal: deliveryFee,
                    status: mappedStatus,
                    merchant_name: carrierName || null,
                    updated_at: new Date().toISOString(),
                  }).eq('id', existingInv.id);
                  result.invoicesUpdated++;
                }
              } else {
                const { data: newInv } = await supabase.from('invoices').insert({
                  invoice_number: invoiceNumber,
                  fleetrunnr_invoice_number: invoiceNumber,
                  type: 'received' as const,
                  source: 'fleetrunnr' as const,
                  status: mappedStatus,
                  delivery_company_id: deliveryCompanyId,
                  merchant_name: carrierName || null,
                  amount: deliveryFee, subtotal: deliveryFee,
                  currency: 'USD',
                  order_count: 1,
                  notes: `Delivery fee from order #${order.shopify_order_number}`,
                }).select('id').single();
                if (newInv) {
                    invoiceId = newInv.id;
                    result.invoicesCreated++;
                }
              }

              // 2. Handle Settlement (Payout from carrier to us)
              let settlementId: string | null = null;
              const cashCollection = Number(flOrder.cash_collection?.amount || 0);
              const isSettled = flOrder.payment_status?.toLowerCase() === 'paid' || flOrder.payout_status?.toLowerCase() === 'paid';
              
              if (cashCollection > 0) {
                const settlementNumber = `ST-${order.tracking_number}`;
                const { data: existingSettlement } = await supabase
                  .from('settlements')
                  .select('id, amount, status')
                  .eq('fleetrunnr_payout_id', settlementNumber) // Using tracking as fallback payout ID
                  .single();

                const settlementStatus = isSettled ? 'paid' : 'pending';

                if (existingSettlement) {
                  settlementId = existingSettlement.id;
                  if (existingSettlement.amount !== cashCollection || existingSettlement.status !== settlementStatus) {
                    await supabase.from('settlements').update({
                      amount: cashCollection,
                      status: settlementStatus,
                      updated_at: new Date().toISOString(),
                    }).eq('id', existingSettlement.id);
                    result.settlementsUpdated++;
                  }
                } else {
                  const { data: newSettlement } = await supabase.from('settlements').insert({
                    settlement_number: settlementNumber,
                    fleetrunnr_payout_id: settlementNumber,
                    delivery_company_id: deliveryCompanyId,
                    amount: cashCollection,
                    status: settlementStatus,
                    currency: 'USD',
                    notes: `Payout for order #${order.shopify_order_number}`,
                  }).select('id').single();
                  if (newSettlement) {
                    settlementId = newSettlement.id;
                    result.settlementsCreated++;
                  }
                }
              }

              // 3. Link Order to Invoice and Settlement
              const { error: orderUpdateError } = await supabase
                .from('orders')
                .update({ 
                  delivery_invoice_id: invoiceId,
                  settlement_id: settlementId,
                  is_settled: isSettled,
                  delivery_fee: deliveryFee,
                  cash_collection_amount: cashCollection,
                  settlement_date: isSettled ? new Date().toISOString() : null
                })
                .eq('id', order.id);
              
              if (!orderUpdateError) {
                  result.ordersUpdated++;
              }
            }
          } catch (err) {
            console.error(`Error processing order ${order.tracking_number}:`, err);
            result.failed++;
          }
        }

        setSyncProgress('');
        return result;
      }

      result.total = allInvoices.length;

      if (allInvoices.length === 0) {
        setSyncProgress('');
        return result;
      }

      // Upsert each invoice
      for (let i = 0; i < allInvoices.length; i++) {
        const inv = allInvoices[i];
        
        try {
          setSyncProgress(`Processing invoice ${i + 1}/${allInvoices.length}...`);

          const invoiceNumber = String(inv.invoice_number || inv.id || `FR-${i}`);
          const carrierName = inv.carrier?.name || inv.carrier_name || inv.merchant || '';
          const subtotal = Number(inv.subtotal) || 0;
          const total = Number(inv.total) || Number(inv.amount) || subtotal;
          const orderCount = Number(inv.orders) || Number(inv.order_count) || 0;
          const invoiceDate = inv.created_at || inv.date || inv.invoice_date || null;
          const statusRaw = (inv.status || 'pending').toLowerCase();
          
          let mappedStatus: 'draft' | 'pending' | 'paid' | 'voided' | 'overdue' = 'pending';
          if (statusRaw === 'paid' || statusRaw === 'settled') mappedStatus = 'paid';
          else if (statusRaw === 'voided' || statusRaw === 'cancelled') mappedStatus = 'voided';
          else if (statusRaw === 'overdue') mappedStatus = 'overdue';
          else if (statusRaw === 'draft') mappedStatus = 'draft';

          // Check if exists by fleetrunnr_invoice_number
          const { data: existing } = await supabase
            .from('invoices')
            .select('id, amount, status, subtotal, merchant_name, order_count')
            .eq('fleetrunnr_invoice_number', invoiceNumber)
            .single();

          if (existing) {
            // Only update if data actually changed
            const hasChanges = existing.amount !== total || 
              existing.status !== mappedStatus ||
              existing.subtotal !== subtotal ||
              existing.merchant_name !== (carrierName || null) ||
              existing.order_count !== orderCount;
            if (hasChanges) {
              await supabase
                .from('invoices')
                .update({
                  amount: total,
                  subtotal,
                  status: mappedStatus,
                  merchant_name: carrierName || null,
                  order_count: orderCount,
                  invoice_date: invoiceDate,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);
              result.invoicesUpdated++;
            }
            // else: no changes, skip silently
          } else {
            // New invoice — insert
            await supabase
              .from('invoices')
              .insert({
                invoice_number: invoiceNumber.startsWith('#') ? invoiceNumber : `#${invoiceNumber}`,
                fleetrunnr_invoice_number: invoiceNumber,
                type: 'received' as const,
                source: 'fleetrunnr' as const,
                status: mappedStatus,
                delivery_company_id: deliveryCompanyId,
                merchant_name: carrierName || null,
                amount: total,
                subtotal,
                currency: 'USD',
                order_count: orderCount,
                invoice_date: invoiceDate,
                notes: null,
              });
            result.invoicesCreated++;
          }
        } catch (err) {
          console.error('Error upserting invoice:', err);
          result.failed++;
        }
      }

      setSyncProgress('');
    } catch (err: any) {
      console.error("Fleetrunnr invoice sync error:", err);
      setSyncProgress('');
      throw err;
    } finally {
      setIsSyncingInvoices(false);
    }

    return result;
  }, []);

  return { syncDeliveryStatuses, syncFleetrunnrInvoices, isSyncing, isSyncingInvoices, syncProgress, lastSyncResult };
}

