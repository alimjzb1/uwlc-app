import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export function useAppSettings() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('app_settings')
        .select('*');

      if (error) {
        // Table might not exist yet — fall back to defaults
        console.warn('[AppSettings] Could not fetch settings:', error.message);
        setSettings({ default_page_size: 50 });
        return;
      }

      const map: Record<string, any> = {};
      for (const row of (data || [])) {
        try {
          map[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        } catch {
          map[row.key] = row.value;
        }
      }
      setSettings(map);
    } catch (err) {
      console.error('[AppSettings] Fatal error:', err);
      setSettings({ default_page_size: 50 });
    } finally {
      setLoading(false);
    }
  }

  const getSetting = useCallback((key: string, defaultValue: any = null) => {
    return settings[key] ?? defaultValue;
  }, [settings]);

  const setSetting = useCallback(async (key: string, value: any) => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key, value: JSON.stringify(value), updated_at: new Date().toISOString() }, { onConflict: 'key' });

      if (error) throw error;

      setSettings(prev => ({ ...prev, [key]: value }));
    } catch (err: any) {
      console.error('[AppSettings] Failed to save setting:', err);
      throw err;
    }
  }, []);

  return { settings, loading, getSetting, setSetting, refresh: fetchSettings };
}
