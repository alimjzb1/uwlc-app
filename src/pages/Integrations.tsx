import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, ChevronRight, Globe, Lock, Key, AlertCircle, Power, RefreshCw, Clock, ArrowUpDown, ExternalLink, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useShopifySettings, ShopifySettings } from '@/hooks/use-shopify-settings';
import { useShopifySync } from '@/hooks/use-shopify-sync';
import { useAppSettings } from '@/hooks/use-app-settings';
import { Skeleton } from "@/components/ui/skeleton";
import { PageSizeSelector } from "@/components/ui/PageSizeSelector";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";

interface SyncLogEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  changes: any;
  synced_at: string;
}

export default function Integrations() {
  const { settings, loading, saveSettings, disconnect, refresh } = useShopifySettings();
  const { syncAll, isSyncing, syncProgress, lastSyncResult, getSyncLogs } = useShopifySync();
  const { getSetting, setSetting } = useAppSettings();

  const [formData, setFormData] = useState<Omit<ShopifySettings, 'id'>>({
    myshopify_url: '',
    client_id: '',
    client_secret: '',
    is_active: true
  });

  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
  const [defaultPageSize, setDefaultPageSize] = useState<string>(String(getSetting('default_page_size', 50)));
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  // Handle OAuth callback - check for ?code= parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const shop = urlParams.get('shop');
    if (code) {
      // Remove the code from the URL
      window.history.replaceState({}, '', window.location.pathname);
      handleOAuthCallback(code, shop || '');
    }
  }, []);

  async function handleOAuthCallback(code: string, shop: string) {
    try {
      setIsAuthorizing(true);
      toast.info('Exchanging authorization code for access token...');
      const { data, error } = await supabase.functions.invoke('shopify-proxy', {
        body: { action: 'exchange_token', code, shop },
      });
      if (error) throw new Error(error.message || 'Token exchange failed');
      if (data?.error) throw new Error(data.error);
      toast.success('Shopify app authorized successfully! You can now sync data.');
      await refresh();
    } catch (err: any) {
      console.error('[OAuth] Token exchange error:', err);
      toast.error('Authorization failed: ' + err.message);
    } finally {
      setIsAuthorizing(false);
    }
  }

  async function handleAuthorize() {
    try {
      setIsAuthorizing(true);
      // Use the current page URL as the OAuth redirect
      const redirectUri = window.location.origin + '/integrations';
      const { data, error } = await supabase.functions.invoke('shopify-proxy', {
        body: { action: 'get_oauth_url', redirect_uri: redirectUri },
      });
      if (error) throw new Error(error.message || 'Failed to get OAuth URL');
      if (data?.error) throw new Error(data.error);
      if (data?.oauth_url) {
        // Open Shopify OAuth page
        window.location.href = data.oauth_url;
      }
    } catch (err: any) {
      console.error('[OAuth] Error:', err);
      toast.error('Failed to start authorization: ' + err.message);
      setIsAuthorizing(false);
    }
  }

  useEffect(() => {
    if (settings) {
      setFormData({
        myshopify_url: settings.myshopify_url,
        client_id: settings.client_id,
        client_secret: settings.client_secret,
        is_active: settings.is_active
      });
    }
  }, [settings]);

  useEffect(() => {
    const val = getSetting('default_page_size', 50);
    setDefaultPageSize(String(val));
  }, [getSetting]);

  useEffect(() => {
    loadSyncLogs();
  }, []);

  async function loadSyncLogs() {
    try {
      const logs = await getSyncLogs(undefined, 20);
      setSyncLogs(logs);
    } catch {
      // Sync logs table may not exist yet
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveSettings(formData);
  };

  const handleSync = async () => {
    try {
      await syncAll();
      await loadSyncLogs();
    } catch (err: any) {
      // Errors are handled inside syncAll with toasts
    }
  };

  const handlePageSizeChange = async (value: string) => {
    setDefaultPageSize(value);
    try {
      await setSetting('default_page_size', parseInt(value) || value);
      toast.success(`Default page size set to ${value}`);
    } catch {
      toast.error('Failed to save setting');
    }
  };

  if (loading && !settings) {
    return (
      <div className="p-8 space-y-6">
        <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-[400px] w-full rounded-[2.5rem]" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-12">
      {/* Header Section */}
      <div className="relative">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="flex flex-col gap-1 relative z-10">
          <h1 className="text-5xl font-black italic uppercase tracking-tighter text-foreground">
            Integrations
          </h1>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-60">
            Connect your external platforms to synchronize commerce data
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Connection List Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="p-1.5 bg-muted/30 rounded-3xl border border-primary/5">
             <Button variant="ghost" className="w-full justify-start gap-4 h-16 rounded-2xl bg-background/50 shadow-sm">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <ShoppingBag className="h-5 w-5" />
                </div>
                <div className="flex flex-col items-start">
                    <span className="text-sm font-black uppercase tracking-tight">Shopify</span>
                    <span className="text-[10px] font-bold opacity-50 uppercase tracking-widest leading-none">Commerce Engine</span>
                </div>
                <ChevronRight className="h-4 w-4 ml-auto opacity-30" />
             </Button>
          </div>
          
          <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 italic">
            * More integrations coming soon
          </p>

          {/* Settings Section */}
          <div className="mt-8">
            <Card className="bg-background/95 backdrop-blur-2xl border-primary/5 shadow-xl rounded-2xl overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <ArrowUpDown className="h-3.5 w-3.5 text-primary" />
                  Sync Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">
                    Default Page Size
                  </Label>
                  <PageSizeSelector
                    value={defaultPageSize}
                    onChange={handlePageSizeChange}
                  />
                  <p className="text-[10px] text-muted-foreground/50 italic">
                    Applied to Orders, Customers, and Products pages
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Main Configuration Card */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-background/95 backdrop-blur-2xl border-primary/5 shadow-2xl rounded-[2.5rem] overflow-hidden">
            <CardHeader className="pt-8 px-10">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-2xl font-black uppercase tracking-tighter">Shopify Connection</CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                    Configuration for your primary sales channel
                  </CardDescription>
                </div>
                {settings?.is_active && (
                   <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-black h-8 px-4 rounded-xl items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      CONNECTED
                   </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-10 pb-10 pt-6">
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Store URL */}
                <div className="space-y-3">
                    <Label className="text-[11px] font-black uppercase tracking-widest opacity-70 ml-1 flex items-center gap-2">
                        <Globe className="h-3 w-3" /> Store Domain
                    </Label>
                    <div className="relative group">
                        <Input 
                            value={formData.myshopify_url}
                            onChange={(e) => setFormData(prev => ({ ...prev, myshopify_url: e.target.value }))}
                            placeholder="your-store.myshopify.com" 
                            className="h-14 rounded-2xl bg-muted/40 border-none text-xl tracking-tighter focus-visible:ring-primary/20 transition-all px-6"
                            disabled={loading}
                        />
                    </div>
                </div>

                {/* API Credentials */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <Label className="text-[11px] font-black uppercase tracking-widest opacity-70 ml-1 flex items-center gap-2">
                            <Key className="h-3 w-3" /> Client ID
                        </Label>
                        <Input 
                            value={formData.client_id}
                            onChange={(e) => setFormData(prev => ({ ...prev, client_id: e.target.value }))}
                            placeholder="shpca_..." 
                            className="h-14 rounded-2xl bg-muted/40 border-none text-xl tracking-tighter focus-visible:ring-primary/20 transition-all px-6 font-mono"
                            disabled={loading}
                        />
                    </div>
                    <div className="space-y-3">
                        <Label className="text-[11px] font-black uppercase tracking-widest opacity-70 ml-1 flex items-center gap-2">
                            <Lock className="h-3 w-3" /> Client Secret
                        </Label>
                        <Input 
                            type="password"
                            value={formData.client_secret}
                            onChange={(e) => setFormData(prev => ({ ...prev, client_secret: e.target.value }))}
                            placeholder="••••••••••••••••" 
                            className="h-14 rounded-2xl bg-muted/40 border-none text-xl tracking-tighter focus-visible:ring-primary/20 transition-all px-6 font-mono"
                            disabled={loading}
                        />
                    </div>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row items-center gap-4 border-t border-primary/5 mt-8">
                    <Button 
                        type="submit" 
                        className="w-full sm:w-auto h-14 rounded-2xl px-12 font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95 text-xs"
                        disabled={loading}
                    >
                        {loading ? 'Processing...' : settings ? 'Update Connection' : 'Register Integration'}
                    </Button>
                    
                    {settings && (
                        <Button 
                            type="button" 
                            variant="outline"
                            onClick={disconnect}
                            className="w-full sm:w-auto h-14 rounded-2xl px-8 font-black uppercase tracking-widest border-rose-500/20 text-rose-500 hover:bg-rose-500/5 transition-all text-[10px]"
                            disabled={loading}
                        >
                            <Power className="h-4 w-4 mr-2" /> Disconnect Store
                        </Button>
                    )}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* OAuth Authorization Card */}
          {settings?.is_active && (
            <Card className="bg-background/95 backdrop-blur-2xl border-primary/5 shadow-xl rounded-[2.5rem] overflow-hidden">
              <CardHeader className="px-10 pt-8 pb-0">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                      {settings.access_token ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <ShieldAlert className="h-5 w-5 text-amber-500" />
                      )}
                      API Authorization
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                      {settings.access_token
                        ? 'Your Shopify app is authorized and ready to sync'
                        : 'Authorize your app to enable data syncing'
                      }
                    </CardDescription>
                  </div>
                  {settings.access_token && (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-black h-8 px-4 rounded-xl items-center gap-2">
                      <CheckCircle2 className="h-3 w-3" />
                      AUTHORIZED
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-10 pb-8 pt-6">
                <div className="space-y-4">
                  {!settings.access_token && (
                    <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10">
                      <p className="text-xs text-amber-600/80 leading-relaxed">
                        Click below to open Shopify and authorize the app. After you approve, you'll be redirected back here and the access token will be saved automatically.
                      </p>
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <Button
                      onClick={handleAuthorize}
                      disabled={isAuthorizing}
                      variant={settings.access_token ? 'outline' : 'default'}
                      className={cn(
                        "h-14 rounded-2xl px-12 font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 text-xs gap-3",
                        !settings.access_token && "shadow-xl shadow-primary/20"
                      )}
                    >
                      <ExternalLink className="h-4 w-4" />
                      {isAuthorizing ? 'Redirecting...' : settings.access_token ? 'Re-authorize App' : 'Authorize App'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sync Button Card */}
          {settings?.is_active && (
            <Card className="bg-background/95 backdrop-blur-2xl border-primary/5 shadow-xl rounded-[2.5rem] overflow-hidden">
              <CardHeader className="px-10 pt-8 pb-0">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                      <RefreshCw className="h-5 w-5 text-primary" />
                      Data Sync
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                      Fetch and synchronize data from Shopify
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-10 pb-8 pt-6">
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <Button
                      onClick={handleSync}
                      disabled={isSyncing}
                      className="h-14 rounded-2xl px-12 font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95 text-xs gap-3"
                    >
                      <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
                      {isSyncing ? 'Syncing...' : 'Sync All Data'}
                    </Button>
                    {syncProgress && (
                      <span className="text-xs font-bold text-muted-foreground animate-pulse">{syncProgress}</span>
                    )}
                  </div>

                  {/* Last Sync Results */}
                  {lastSyncResult && (
                    <div className="grid grid-cols-3 gap-4">
                      {Object.entries(lastSyncResult).map(([entity, result]) => (
                        <div key={entity} className="p-4 bg-muted/20 rounded-2xl border border-primary/5">
                          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">{entity}</div>
                          <div className="space-y-1">
                            {result.created > 0 && (
                              <div className="text-xs font-bold text-emerald-500">+{result.created} created</div>
                            )}
                            {result.updated > 0 && (
                              <div className="text-xs font-bold text-amber-500">{result.updated} updated</div>
                            )}
                            {result.removed > 0 && (
                              <div className="text-xs font-bold text-rose-500">-{result.removed} removed</div>
                            )}
                            {result.unchanged > 0 && (
                              <div className="text-xs font-bold text-muted-foreground/50">{result.unchanged} unchanged</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Recent Sync Logs */}
                  {syncLogs.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Recent Changes</div>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {syncLogs.slice(0, 10).map((log) => (
                          <div key={log.id} className="flex items-center gap-3 p-3 bg-muted/10 rounded-xl border border-primary/5">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] h-5 rounded-md px-2 font-black uppercase tracking-wider border-none shadow-sm shrink-0",
                                log.action === 'created' && "bg-emerald-500/10 text-emerald-500",
                                log.action === 'updated' && "bg-amber-500/10 text-amber-500",
                                log.action === 'removed' && "bg-rose-500/10 text-rose-500"
                              )}
                            >
                              {log.action}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold truncate">
                                {log.entity_type} #{log.entity_id}
                              </div>
                              {log.changes && (
                                <div className="text-[10px] text-muted-foreground/50 truncate">
                                  Changed: {Object.keys(log.changes).join(', ')}
                                </div>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground/40 font-mono shrink-0 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(log.synced_at), 'HH:mm')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tips Card */}
          <div className="p-8 bg-amber-500/5 rounded-[2.5rem] border border-amber-500/10 space-y-4">
            <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                <h3 className="text-xs font-black uppercase tracking-widest text-amber-600">Configuration Guide</h3>
            </div>
            <p className="text-[11px] font-medium text-amber-600/70 leading-relaxed italic">
                Ensure your Shopify Custom App has `read_products`, `write_products`, `read_orders`, and `read_customers` scopes enabled.
                You can find your credentials in the Shopify Admin under Settings {" > "} Apps and sales channels {" > "} Develop apps.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
