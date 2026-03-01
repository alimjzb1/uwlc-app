import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Customer, Order } from '@/types';

export interface CustomerWithStats extends Customer {
  orders_count: number;
  total_spent: number;
  average_order_value: number;
  last_order_date: string | null;
}

export function useCustomers(pageSize: string = '50', sortOrder: 'desc' | 'asc' = 'desc') {
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, [pageSize, sortOrder]);

  async function fetchCustomers() {
    try {
      setLoading(true);
      // Select orders to calculate stats
      let query = supabase
        .from('customers')
        .select(`
          *,
          orders (
            id,
            total_price,
            created_at
          )
        `)
        .order('created_at', { ascending: sortOrder === 'asc' });

      if (pageSize !== 'all') {
        query = query.limit(parseInt(pageSize, 10));
      }

      const { data, error } = await query;
      if (error) throw error;

      const customersWithStats = (data || []).map((customer: any) => {
        const orders = customer.orders || [];
        const total_spent = orders.reduce((sum: number, order: any) => sum + (order.total_price || 0), 0);
        const orders_count = orders.length;
        const average_order_value = orders_count > 0 ? total_spent / orders_count : 0;
        
        // Find last order date
        const last_order_date = orders.length > 0 
          ? orders.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at 
          : null;

        return {
          ...customer,
          orders_count,
          total_spent,
          average_order_value,
          last_order_date
        };
      });

      setCustomers(customersWithStats);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return { customers, loading, error, refreshCustomers: fetchCustomers };
}

export function useCustomer(id: string) {
  const [customer, setCustomer] = useState<CustomerWithStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchCustomerData();
  }, [id]);

  async function fetchCustomerData() {
    try {
      setLoading(true);
      
      // Fetch Customer Details with Orders to calculate stats
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select(`
          *,
          orders (
            id,
            total_price,
            created_at
          )
        `)
        .eq('id', id)
        .single();

      if (customerError) throw customerError;

      // Calculate stats
      const customerOrders = customerData.orders || [];
      const total_spent = customerOrders.reduce((sum: number, order: any) => sum + (order.total_price || 0), 0);
      const orders_count = customerOrders.length;
      const average_order_value = orders_count > 0 ? total_spent / orders_count : 0;
      
      const last_order_date = customerOrders.length > 0 
          ? customerOrders.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at 
          : null;

      setCustomer({
        ...customerData,
        orders_count,
        total_spent,
        average_order_value,
        last_order_date
      } as CustomerWithStats);

      // Fetch full Order details for the list
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
      setOrders(ordersData as Order[]);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return { customer, orders, loading, error, refreshCustomer: fetchCustomerData };
}
