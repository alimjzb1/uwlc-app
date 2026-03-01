import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

import { Product } from '@/types';

export interface DashboardMetrics {
    totalOrders: number;
    pendingApprovals: number;
    readyToShip: number;
    totalCustomers: number;
    totalSales: number;
    cancelledCount: number;
    cancelledValue: number;
    lowStockItems: number;
    lowStockProductsList: Product[];
    recentActivity: any[];
}

import { DateRange } from "react-day-picker";
import { startOfDay, endOfDay } from "date-fns";

export function useDashboard(dateRange?: DateRange) {
    const [metrics, setMetrics] = useState<DashboardMetrics>({
        totalOrders: 0,
        pendingApprovals: 0,
        readyToShip: 0,
        totalCustomers: 0,
        totalSales: 0,
        cancelledCount: 0,
        cancelledValue: 0,
        lowStockItems: 0,
        lowStockProductsList: [],
        recentActivity: [],
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchMetrics();
    }, [dateRange]);

    async function fetchMetrics() {
        setLoading(true);
        try {
            let ordersQuery = supabase.from('orders').select('shopify_order_id, total_price, internal_status, financial_status').limit(10000);
            let customersQuery = supabase.from('customers').select('*', { count: 'exact', head: true });
            let activityQuery = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(6);
            
            // Apply Date Filters (ONLY to Orders and Customers)
            if (dateRange?.from) {
                const from = startOfDay(dateRange.from).toISOString();
                ordersQuery = ordersQuery.gte('created_at', from);
                customersQuery = customersQuery.gte('created_at', from);
                activityQuery = activityQuery.gte('created_at', from);
                
                if (dateRange.to) {
                    const to = endOfDay(dateRange.to).toISOString();
                    ordersQuery = ordersQuery.lte('created_at', to);
                    customersQuery = customersQuery.lte('created_at', to);
                    activityQuery = activityQuery.lte('created_at', to);
                }
            }

            // Parallel requests for speed
            const [
                { data: ordersDataRaw },
                { count: totalCustomers },
                { data: productsForStock },
                { data: recentActivityRaw }
            ] = await Promise.all([
                ordersQuery,
                customersQuery,
                supabase.from('products_inventory')
                  .select('id, name, sku, quantity_on_hand, low_stock_threshold, parent_id, parent:parent_id(name)'),
                activityQuery
            ]);

            // Fetch missing profiles for recent activity manual join
            let recentActivity = recentActivityRaw || [];
            const userIds = [...new Set(recentActivity.map((l: any) => l.user_id).filter(Boolean))];
            if (userIds.length > 0) {
                const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
                const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
                recentActivity = recentActivity.map((log: any) => ({
                    ...log,
                    user: profileMap.get(log.user_id) || null
                }));
            }

            // Deduplicate orders by shopify_order_id
            const seenOrderIds = new Set<string>();
            const ordersData = (ordersDataRaw || []).filter((o: any) => {
                if (o.shopify_order_id && seenOrderIds.has(o.shopify_order_id)) return false;
                if (o.shopify_order_id) seenOrderIds.add(o.shopify_order_id);
                return true;
            });

            const allProducts = productsForStock || [];
            
            // Only show items that are actually low stock. 
            // If it's a parent with children, we only show its low stock children, 
            // unless it's a standalone product.
            const hasChildrenIds = new Set(allProducts.filter(p => p.parent_id).map(p => p.parent_id));
            
            const lowStockProducts = allProducts.filter(p => {
                const isParentWithChildren = hasChildrenIds.has(p.id);
                // If it has children, don't show the parent in low stock list (the children will show up if they are low)
                if (isParentWithChildren) return false;
                
                return p.quantity_on_hand <= (p.low_stock_threshold || 10);
            });

            // Compute metrics from deduplicated orders
            let totalSales = 0;
            let cancelledCount = 0;
            let cancelledValue = 0;
            let pendingApprovals = 0;
            let readyToShip = 0;

            ordersData.forEach((o: any) => {
                const val = Number(o.total_price) || 0;
                if (o.internal_status === 'cancelled' || o.financial_status === 'refunded' || o.financial_status === 'voided') {
                    cancelledCount++;
                    cancelledValue += val;
                } else {
                    totalSales += val;
                }
                if (o.internal_status === 'needs_approval') pendingApprovals++;
                if (o.internal_status === 'ready_to_ship') readyToShip++;
            });

            setMetrics({
                totalOrders: ordersData.length,
                pendingApprovals,
                readyToShip,
                totalCustomers: totalCustomers || 0,
                totalSales,
                cancelledCount,
                cancelledValue,
                lowStockItems: lowStockProducts.length,
                lowStockProductsList: lowStockProducts.map((p: any) => ({
                    ...p,
                    // More descriptive name for variants
                    name: p.parent ? `${p.parent.name} (${p.name})` : p.name
                })) as any,
                recentActivity: recentActivity || [],
            });

        } catch (e: any) {
            console.error("Error fetching dashboard metrics:", e);
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    return { metrics, loading, error, refresh: fetchMetrics };
}

