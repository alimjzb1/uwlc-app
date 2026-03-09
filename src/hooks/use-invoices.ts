import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAudit } from '@/hooks/use-audit';
import { DateRange } from 'react-day-picker';
import { startOfDay, endOfDay } from 'date-fns';

export interface Invoice {
  id: string;
  invoice_number: string;
  type: 'received' | 'sent';
  source: 'manual' | 'fleetrunnr';
  status: 'draft' | 'pending' | 'paid' | 'voided' | 'overdue';
  delivery_company_id: string | null;
  delivery_company?: { id: string; name: string } | null;
  merchant_name: string | null;
  amount: number;
  subtotal: number;
  currency: string;
  due_date: string | null;
  invoice_date: string | null;
  notes: string | null;
  related_order_ids: string[] | null;
  order_count: number;
  fleetrunnr_invoice_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface Settlement {
  id: string;
  settlement_number: string;
  delivery_company_id: string | null;
  delivery_company?: { id: string; name: string } | null;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'voided';
  settlement_date: string | null;
  fleetrunnr_payout_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceFilters {
  type?: 'received' | 'sent';
  status?: string;
  dateRange?: DateRange;
  delivery_company_id?: string;
}

export function useInvoices(filters?: InvoiceFilters) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const { logAction } = useAudit();

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('invoices')
        .select('*, delivery_company:delivery_company_id(id, name)')
        .order('created_at', { ascending: false });

      if (filters?.type) {
        query = query.eq('type', filters.type);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.delivery_company_id) {
        query = query.eq('delivery_company_id', filters.delivery_company_id);
      }
      if (filters?.dateRange?.from) {
        query = query.gte('created_at', startOfDay(filters.dateRange.from).toISOString());
        if (filters.dateRange.to) {
          query = query.lte('created_at', endOfDay(filters.dateRange.to).toISOString());
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setInvoices((data as Invoice[]) || []);
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  }, [filters?.type, filters?.status, filters?.delivery_company_id, filters?.dateRange?.from?.getTime(), filters?.dateRange?.to?.getTime()]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const createInvoice = async (invoice: Partial<Invoice>) => {
    const { data, error } = await supabase
      .from('invoices')
      .insert({
        invoice_number: invoice.invoice_number,
        type: invoice.type || 'sent',
        source: invoice.source || 'manual',
        status: invoice.status || 'draft',
        delivery_company_id: invoice.delivery_company_id || null,
        amount: invoice.amount || 0,
        currency: invoice.currency || 'USD',
        due_date: invoice.due_date || null,
        notes: invoice.notes || null,
        related_order_ids: invoice.related_order_ids || null,
        fleetrunnr_invoice_number: invoice.fleetrunnr_invoice_number || null,
      })
      .select()
      .single();

    if (error) throw error;

    await logAction('created', 'invoices', data.id, {
      new_data: data,
    });

    await fetchInvoices();
    return data;
  };

  const updateInvoice = async (id: string, updates: Partial<Invoice>) => {
    const { data, error } = await supabase
      .from('invoices')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await logAction('updated', 'invoices', id, {
      new_data: updates,
    });

    await fetchInvoices();
    return data;
  };

  const deleteInvoice = async (id: string) => {
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await logAction('deleted', 'invoices', id, {});
    await fetchInvoices();
  };

  return {
    invoices,
    loading,
    refresh: fetchInvoices,
    createInvoice,
    updateInvoice,
    deleteInvoice,
  };
}

export function useSettlements(filters?: { status?: string; dateRange?: DateRange; delivery_company_id?: string }) {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const { logAction } = useAudit();

  const fetchSettlements = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('settlements')
        .select('*, delivery_company:delivery_company_id(id, name)')
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.delivery_company_id) {
        query = query.eq('delivery_company_id', filters.delivery_company_id);
      }
      if (filters?.dateRange?.from) {
        query = query.gte('created_at', startOfDay(filters.dateRange.from).toISOString());
        if (filters.dateRange.to) {
          query = query.lte('created_at', endOfDay(filters.dateRange.to).toISOString());
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setSettlements((data as Settlement[]) || []);
    } catch (err) {
      console.error('Error fetching settlements:', err);
    } finally {
      setLoading(false);
    }
  }, [filters?.status, filters?.delivery_company_id, filters?.dateRange?.from?.getTime(), filters?.dateRange?.to?.getTime()]);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  const updateSettlement = async (id: string, updates: Partial<Settlement>) => {
    const { data, error } = await supabase
      .from('settlements')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await logAction('updated', 'settlements', id, {
      new_data: updates,
    });

    await fetchSettlements();
    return data;
  };

  return {
    settlements,
    loading,
    refresh: fetchSettlements,
    updateSettlement,
  };
}
