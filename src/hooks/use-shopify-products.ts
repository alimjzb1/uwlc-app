import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ShopifyProduct } from '@/types';

export function useShopifyProducts() {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products_shopify')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data as ShopifyProduct[]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return { products, loading, error, refreshProducts: fetchProducts };
}
