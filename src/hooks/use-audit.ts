import { supabase } from '@/lib/supabase';

export function useAudit() {
  const logAction = async (
    action: string, 
    table_name: string, 
    record_id: string, 
    payloadOverrides: { metadata?: any; old_data?: any; new_data?: any; reason?: string; [key: string]: any } = {}
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { metadata, old_data, new_data, reason, ...rest } = payloadOverrides;
      
      const fullMetadata = {
        ...metadata,
        ...rest,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      };

      // TIER 1: Full Payload
      let payload: any = {
        user_id: user?.id,
        action,
        table_name,
        record_id,
        reason: reason || metadata?.reason,
        old_data,
        new_data,
        metadata: fullMetadata
      };

      let { error } = await supabase.from('audit_logs').insert([payload]);

      // TIER 2: Drop 'reason' column if it fails
      if (error && (error.code === '42703' || error.message?.includes('reason'))) {
          console.warn("Audit log 'reason' column missing, retrying without it...");
          const tier2Payload = { ...payload };
          delete (tier2Payload as any).reason;
          // Merge reason into metadata for preservation
          tier2Payload.metadata = { ...tier2Payload.metadata, reason: payload.reason };
          
          const { error: error2 } = await supabase.from('audit_logs').insert([tier2Payload]);
          error = error2;
          payload = tier2Payload;
      }

      // TIER 3: Drop 'metadata' column if it still fails
      if (error && (error.code === '42703' || error.message?.includes('metadata'))) {
          console.warn("Audit log 'metadata' column missing, retrying with merge into new_data...");
          const tier3Payload = {
              user_id: user?.id,
              action,
              table_name,
              record_id,
              old_data: payload.old_data,
              new_data: { 
                  ...(typeof payload.new_data === 'object' ? payload.new_data : { value: payload.new_data }),
                  _metadata: payload.metadata 
              }
          };
          const { error: error3 } = await supabase.from('audit_logs').insert([tier3Payload]);
          error = error3;
      }

      if (error) throw error;
    } catch (err) {
      console.error("Critical failure in logAction:", err);
    }
  };

  const getLogs = async (table_name?: string, record_id?: string | string[]) => {
    console.log("Fetching logs for:", { table_name, record_id });
    
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (table_name) query = query.eq('table_name', table_name);
    
    if (record_id) {
       if (Array.isArray(record_id)) {
          const validIds = record_id.filter(id => !!id);
          if (validIds.length > 0) {
              query = query.in('record_id', validIds);
          }
       } else {
          query = query.eq('record_id', record_id);
       }
    }

    const { data: logs, error } = await query.limit(100);
    if (error) {
        console.error("Supabase getLogs error:", error);
        throw error;
    }
    
    if (!logs || logs.length === 0) return [];

    // Fetch profiles for these users to ensure we have names and roles
    const userIds = [...new Set(logs.map(l => l.user_id).filter(Boolean))];
    
    if (userIds.length > 0) {
      console.log("[useAudit] Fetching profiles for:", userIds);
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('id', userIds);
        
      if (profileError) {
        console.error("[useAudit] Profile fetch error:", profileError);
      }

      const profileMap = new Map(profiles?.map(p => [p.id, p]));
      
      return logs.map(log => ({
        ...log,
        profiles: profileMap.get(log.user_id) || null
      }));
    }

    return logs.map(log => ({ ...log, profiles: null }));
  };

  return { logAction, getLogs };
}
