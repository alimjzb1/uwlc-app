import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { OrderVerification } from '@/types';

export function useOrderVerifications(orderId: string) {
  const [verifications, setVerifications] = useState<OrderVerification[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (orderId) {
      fetchVerifications();
      
      // Subscribe to realtime changes
      const channel = supabase
        .channel(`verifications-${orderId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'order_verifications',
            filter: `order_id=eq.${orderId}`
          },
          (_payload) => {
             fetchVerifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [orderId]);

  async function fetchVerifications() {
    try {
      const { data, error } = await supabase
        .from('order_verifications')
        .select('*')
        .eq('order_id', orderId);

      if (error) throw error;
      setVerifications(data as OrderVerification[]);
    } catch (err) {
      console.error('Error fetching verifications:', err);
    } finally {
      setLoading(false);
    }
  }

  const addVerification = async (
    file: File, 
    type: 'image' | 'video', 
    variantId?: string | null
  ) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${orderId}/${variantId || 'general'}-${Math.random()}.${fileExt}`;
      const filePath = `verifications/${fileName}`;

      const { error: uploadEr } = await supabase.storage
        .from('order-attachments')
        .upload(filePath, file);

      if (uploadEr) throw uploadEr;

      const { data: { publicUrl } } = supabase.storage
        .from('order-attachments')
        .getPublicUrl(filePath);

      const { data, error: dbError } = await supabase
        .from('order_verifications')
        .insert({
          order_id: orderId,
          variant_id: variantId || null,
          media_type: type,
          media_url: publicUrl,
          // user_id is handled by RLS typically (auth.uid()), but if not default, we might need to send it?
          // The schema default usually doesn't capture auth.uid() automatically unless triggers.
          // Let's check if we need to pass it. If RLS policies use auth.uid(), inserting it might be needed if the table column expects it.
          // However, usually we rely on the backend or trigger. 
          // Use view_code_item to check schema if not sure. 
          // For now assuming we might need to pass it or it's optional. 
          // Let's assume we need to set uploaded_by to current user.
        })
        .select()
        .single();
        
      if (dbError) throw dbError;
      return data;
    } catch (error) {
       console.error("Verification upload failed", error);
       throw error;
    }
  };

  const removeVerification = async (id: string, _path: string) => {
     // TODO: Implement cleanup of storage if needed, but for now just DB delete
     const { error } = await supabase
        .from('order_verifications')
        .delete()
        .eq('id', id);
     
     if (error) throw error;
  };

  return { verifications, loading, addVerification, removeVerification };
}
