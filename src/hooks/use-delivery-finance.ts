import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { DateRange } from 'react-day-picker';
import { startOfDay, endOfDay } from 'date-fns';

export interface DeliveryFinanceMetrics {
  cashCollected: number;
  cashCollectedCount: number;
  cashPendingCollection: number;
  cashPendingCollectionCount: number;
  cashPendingDelivery: number;
  cashPendingDeliveryCount: number;
  totalDeliveryFees: number;
  totalPaidInvoices: number;
  totalPaidInvoicesCount: number;
  totalUnpaidInvoices: number;
  totalUnpaidInvoicesCount: number;
  netCashAfterFees: number;
}

export function useDeliveryFinance(dateRange?: DateRange, deliveryTag?: string) {
  const [metrics, setMetrics] = useState<DeliveryFinanceMetrics>({
    cashCollected: 0,
    cashCollectedCount: 0,
    cashPendingCollection: 0,
    cashPendingCollectionCount: 0,
    cashPendingDelivery: 0,
    cashPendingDeliveryCount: 0,
    totalDeliveryFees: 0,
    totalPaidInvoices: 0,
    totalPaidInvoicesCount: 0,
    totalUnpaidInvoices: 0,
    totalUnpaidInvoicesCount: 0,
    netCashAfterFees: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch orders that have tracking numbers (assigned to delivery companies)
      let query = supabase
        .from('orders')
        .select(`
          id, internal_status, total_price, cash_collection_amount, 
          delivery_fee, cash_collected, is_settled, settlement_date, 
          shopify_order_number, tags, tracking_number,
          delivery_invoice:delivery_invoice_id(id, status, amount)
        `)
        .not('tracking_number', 'is', 'null');

      if (dateRange?.from) {
        query = query.gte('created_at', startOfDay(dateRange.from).toISOString());
        if (dateRange.to) {
          query = query.lte('created_at', endOfDay(dateRange.to).toISOString());
        }
      }

      const { data: orders, error } = await query;
      if (error) throw error;

      const allOrders = orders || [];

      // Filter by delivery tag if specified
      let filteredOrders = allOrders;
      if (deliveryTag) {
        filteredOrders = allOrders.filter((o: any) => {
          const orderTags: string[] = Array.isArray(o.tags) ? o.tags : (typeof o.tags === 'string' ? o.tags.split(',').map((t: string) => t.trim()) : []);
          return orderTags.some((t: string) => t.toLowerCase() === deliveryTag.toLowerCase());
        });
      }

      let cashCollected = 0;
      let cashCollectedCount = 0;
      let cashPendingCollection = 0;
      let cashPendingCollectionCount = 0;
      let cashPendingDelivery = 0;
      let cashPendingDeliveryCount = 0;
      let totalDeliveryFees = 0;
      let totalPaidInvoices = 0;
      let totalPaidInvoicesCount = 0;
      let totalUnpaidInvoices = 0;
      let totalUnpaidInvoicesCount = 0;

      filteredOrders.forEach((order: any) => {
        const cashAmount = Number(order.cash_collection_amount) || Number(order.total_price) || 0;
        const fee = Number(order.delivery_fee) || 0;
        totalDeliveryFees += fee;

        // Invoice Tracking (Fees WE pay)
        const invoice = order.delivery_invoice;
        if (invoice) {
          if (invoice.status === 'paid') {
            totalPaidInvoices += Number(invoice.amount) || fee;
            totalPaidInvoicesCount++;
          } else if (['pending', 'overdue'].includes(invoice.status)) {
            totalUnpaidInvoices += Number(invoice.amount) || fee;
            totalUnpaidInvoicesCount++;
          }
        }

        // Settlement Tracking (Cash THEY pay us)
        if (order.internal_status === 'delivered') {
          if (order.is_settled || order.cash_collected) {
            // Delivered AND cash collected from delivery company
            cashCollected += cashAmount;
            cashCollectedCount++;
          } else {
            // Delivered but cash NOT yet collected
            cashPendingCollection += cashAmount;
            cashPendingCollectionCount++;
          }
        } else if (['shipped', 'ready to ship', 'packaging', 'new'].includes(order.internal_status)) {
          // Not delivered yet — cash is pending delivery
          cashPendingDelivery += cashAmount;
          cashPendingDeliveryCount++;
        }
      });

      setMetrics({
        cashCollected,
        cashCollectedCount,
        cashPendingCollection,
        cashPendingCollectionCount,
        cashPendingDelivery,
        cashPendingDeliveryCount,
        totalDeliveryFees,
        totalPaidInvoices,
        totalPaidInvoicesCount,
        totalUnpaidInvoices,
        totalUnpaidInvoicesCount,
        netCashAfterFees: cashCollected - totalPaidInvoices, // Using actual paid invoices for net
      });
    } catch (err) {
      console.error('Error fetching delivery finance metrics:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange?.from?.getTime(), dateRange?.to?.getTime(), deliveryTag]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return { metrics, loading, refresh: fetchMetrics };
}
