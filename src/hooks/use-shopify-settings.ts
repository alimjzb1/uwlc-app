import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface ShopifySettings {
  id?: string;
  myshopify_url: string;
  client_id: string;
  client_secret: string;
  access_token?: string;
  is_active: boolean;
}

export function useShopifySettings() {
  const [settings, setSettings] = useState<ShopifySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('shopify_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setSettings(data);
    } catch (err: any) {
      console.error("[ShopifySettings] Fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(newSettings: Omit<ShopifySettings, 'id'>) {
    try {
      setLoading(true);
      if (settings?.id) {
        const { error } = await supabase
          .from('shopify_settings')
          .update(newSettings)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('shopify_settings')
          .insert([newSettings]);
        if (error) throw error;
      }
      toast.success("Shopify settings saved successfully");
      await fetchSettings();
    } catch (err: any) {
      console.error("[ShopifySettings] Save error:", err);
      toast.error("Failed to save settings: " + err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function disconnect() {
    try {
      setLoading(true);
      if (settings?.id) {
        const { error } = await supabase
          .from('shopify_settings')
          .delete()
          .eq('id', settings.id);
        if (error) throw error;
        setSettings(null);
        toast.success("Shopify disconnected");
      }
    } catch (err: any) {
      console.error("[ShopifySettings] Disconnect error:", err);
      toast.error("Failed to disconnect: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return { settings, loading, error, saveSettings, disconnect, refresh: fetchSettings };
}
