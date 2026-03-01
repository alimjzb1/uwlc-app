import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { DeliveryCompany, DeliveryTagMapping } from '@/types';

export function useDeliveryCompanies() {
  const [companies, setCompanies] = useState<DeliveryCompany[]>([]);
  const [mappings, setMappings] = useState<DeliveryTagMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      
      const [companiesRes, mappingsRes] = await Promise.all([
        supabase
          .from('delivery_companies')
          .select('*')
          .order('name', { ascending: true }),
        supabase
          .from('delivery_tag_mappings')
          .select('*')
          .order('priority', { ascending: false })
      ]);

      if (companiesRes.error) throw companiesRes.error;
      if (mappingsRes.error) throw mappingsRes.error;

      setCompanies(companiesRes.data as DeliveryCompany[]);
      setMappings(mappingsRes.data as DeliveryTagMapping[]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const addCompany = async (company: Partial<DeliveryCompany>) => {
    const { data, error } = await supabase
      .from('delivery_companies')
      .insert([company])
      .select()
      .single();
    if (error) throw error;
    await fetchData();
    return data;
  };

  const updateCompany = async (id: string, updates: Partial<DeliveryCompany>) => {
    const { error } = await supabase
      .from('delivery_companies')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
    await fetchData();
  };

  const deleteCompany = async (id: string) => {
    // 1. Delete dependent mappings first
    const { error: mappingError } = await supabase
      .from('delivery_tag_mappings')
      .delete()
      .eq('delivery_company_id', id);
    
    if (mappingError) throw mappingError;

    // 2. Now delete the company
    const { error } = await supabase
      .from('delivery_companies')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    await fetchData();
  };

  const addMapping = async (mapping: Partial<DeliveryTagMapping>) => {
    const { data, error } = await supabase
      .from('delivery_tag_mappings')
      .insert([mapping])
      .select()
      .single();
    if (error) throw error;
    await fetchData();
    return data;
  };

  const deleteMapping = async (id: string) => {
    const { error } = await supabase
      .from('delivery_tag_mappings')
      .delete()
      .eq('id', id);
    if (error) throw error;
    await fetchData();
  };

  /**
   * Automatically assigns the best delivery company based on tags
   */
  const suggestDeliveryCompany = (tags: string[]): string | null => {
    if (!tags || tags.length === 0) {
        return companies.find(c => c.is_default)?.id || null;
    }

    // Filter mappings that match any of the order tags
    const matchingMappings = mappings.filter(m => 
      tags.some(tag => tag.toLowerCase().trim() === m.tag.toLowerCase().trim())
    );

    if (matchingMappings.length > 0) {
        // Priority sorted in fetchData (descending), so first item is highest priority
        return matchingMappings[0].delivery_company_id;
    }

    return companies.find(c => c.is_default)?.id || null;
  };

  return { 
    companies, 
    mappings,
    loading, 
    error, 
    refresh: fetchData,
    addCompany,
    updateCompany,
    deleteCompany,
    addMapping,
    deleteMapping,
    suggestDeliveryCompany
  };
}
