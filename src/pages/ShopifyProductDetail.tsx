import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Package, Save, RefreshCcw, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LinkProductDialog } from "@/components/inventory/LinkProductDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { ShopifyProduct } from "@/types";

export default function ShopifyProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [variants, setVariants] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Track modified fields
  const [editData, setEditData] = useState<Record<string, Partial<ShopifyProduct>>>({});

  // Bridging State
  const [linkingVariant, setLinkingVariant] = useState<ShopifyProduct | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  const handleOpenLink = (variant: ShopifyProduct) => {
    setLinkingVariant(variant);
    setLinkDialogOpen(true);
  };


  const fetchProduct = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products_shopify')
        .select('*')
        .eq('shopify_product_id', id)
        .order('title');

      if (error) throw error;
      setVariants(data as ShopifyProduct[]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch Shopify product details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchProduct();
    }
  }, [id]);

  const handleFieldChange = (variantId: string, field: string, value: any) => {
    setEditData(prev => ({
      ...prev,
      [variantId]: {
        ...prev[variantId],
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    const keysToUpdate = Object.keys(editData);
    if (keysToUpdate.length === 0) return;

    try {
      setSaving(true);
      
      const promises = keysToUpdate.map(async (variantId) => {
        const updates = editData[variantId];
        const { error } = await supabase
          .from('products_shopify')
          .update(updates)
          .eq('shopify_variant_id', variantId);
          
        if (error) throw error;
      });

      await Promise.all(promises);
      toast.success("Local tracking updated successfully");
      setEditData({});
      fetchProduct();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update local tracking');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (variants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <Package className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-bold">Product not found</h2>
        <Button asChild variant="outline">
          <Link to="/inventory">Back to Inventory</Link>
        </Button>
      </div>
    );
  }

  // Derive top-level title and images from the first variant
  const titleParts = variants[0].title.split(' - ');
  const parentTitle = titleParts.length > 1 ? titleParts.slice(0, -1).join(' - ') : variants[0].title;
  const images = variants[0].images || [];
  const isDirty = Object.keys(editData).length > 0;

  return (
    <div className="container py-8 max-w-7xl space-y-8 animate-in fade-in duration-500 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-4 text-left">
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 text-muted-foreground hover:text-foreground">
            <Link to="/inventory">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Inventory
            </Link>
          </Button>
          <div className="flex items-center gap-3">
             <h1 className="text-4xl font-black tracking-tighter text-foreground">
                {parentTitle}
             </h1>
             <Badge className="bg-[#95bf47] text-white hover:bg-[#85ab3f] uppercase text-[10px] font-black tracking-widest px-3 py-1">Shopify Connected</Badge>
          </div>
          <p className="text-sm font-mono text-muted-foreground uppercase opacity-80">
            Product ID: {id}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchProduct} className="gap-2 font-bold uppercase text-xs h-10 w-10 p-0">
             <RefreshCcw className="h-4 w-4" />
          </Button>
          <Button onClick={handleSave} disabled={!isDirty || saving} className="gap-2 font-bold uppercase text-xs h-10 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
             {saving ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <Save className="h-4 w-4" />}
             Save Local Changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Local Inventory Config */}
        <div className="lg:col-span-2 space-y-6">
           <Card className="bg-card shadow-sm border-muted/20">
              <CardHeader className="border-b bg-muted/50 py-4 px-6 flex flex-row items-center justify-between">
                 <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Variants & Local Tracking</CardTitle>
                 <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                    {variants.length} Variants
                 </div>
              </CardHeader>
              <CardContent className="p-0">
                 <div className="divide-y divide-border/40">
                    {variants.map(variant => {
                        const variantTitle = variant.title.split(' - ').pop() || variant.title;
                        
                        // Pull live overrides from editData, or fallback to database state
                        const edited = editData[variant.shopify_variant_id] || {};
                        const localEnabled = edited.local_inventory_enabled !== undefined ? edited.local_inventory_enabled : variant.local_inventory_enabled;
                        const localQuantity = edited.local_quantity !== undefined ? edited.local_quantity : (variant.local_quantity || 0);
                        const cost = edited.cost !== undefined ? edited.cost : (variant.cost || 0);
                        const sellingPrice = edited.selling_price !== undefined ? edited.selling_price : (variant.selling_price || 0);

                        return (
                           <div key={variant.shopify_variant_id} className="p-6 space-y-4 hover:bg-muted/5 transition-colors">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
                                  <div className="flex gap-4">
                                     <div className="space-y-1">
                                         <h4 className="font-bold text-lg">{variantTitle === parentTitle ? 'Default Title' : variantTitle}</h4>
                                         <div className="flex gap-2 text-xs font-mono text-muted-foreground uppercase opacity-70">
                                            <span>SKU: {variant.sku || 'N/A'}</span>
                                            <span>•</span>
                                            <span>Variant ID: {variant.shopify_variant_id.slice(-8)}</span>
                                         </div>
                                     </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => handleOpenLink(variant)}
                                        className="h-8 px-3 mr-2 font-bold uppercase text-[9px] tracking-widest rounded-lg hover:bg-primary hover:text-primary-foreground border-muted/30 hover:border-primary transition-all shadow-sm"
                                      >
                                        <LinkIcon className="h-3 w-3 mr-1.5" /> Bridge Variant
                                      </Button>
                                      <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-xl border border-muted/40">
                                      <Label htmlFor={`track-${variant.shopify_variant_id}`} className="text-[10px] font-black uppercase tracking-widest cursor-pointer">
                                          Local Tracking
                                      </Label>
                                      <Switch 
                                          id={`track-${variant.shopify_variant_id}`}
                                          checked={localEnabled}
                                          onCheckedChange={(val) => handleFieldChange(variant.shopify_variant_id, 'local_inventory_enabled', val)}
                                      />
                                  </div>
                                  </div>
                              </div>
                              
                              <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 transition-all duration-300 ${localEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none filter grayscale-[50%]'}`}>
                                   <div className="space-y-1.5 focus-within:text-primary transition-colors">
                                       <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Local Quantity</Label>
                                       <Input 
                                          type="number"
                                          className="font-black text-xl bg-card border-none ring-1 ring-muted focus-visible:ring-primary shadow-sm"
                                          value={localQuantity}
                                          onChange={(e) => handleFieldChange(variant.shopify_variant_id, 'local_quantity', parseInt(e.target.value) || 0)}
                                       />
                                   </div>
                                   <div className="space-y-1.5 focus-within:text-primary transition-colors">
                                       <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Unit Cost</Label>
                                       <div className="relative">
                                          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</div>
                                          <Input 
                                             type="number"
                                             step="0.01"
                                             className="pl-7 font-bold text-md bg-card border-none ring-1 ring-muted focus-visible:ring-primary shadow-sm"
                                             value={cost}
                                             onChange={(e) => handleFieldChange(variant.shopify_variant_id, 'cost', parseFloat(e.target.value) || 0)}
                                          />
                                       </div>
                                   </div>
                                    <div className="space-y-1.5 focus-within:text-primary transition-colors">
                                       <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Selling Price</Label>
                                       <div className="relative">
                                          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</div>
                                          <Input 
                                             type="number"
                                             step="0.01"
                                             className="pl-7 font-bold text-md bg-card border-none ring-1 ring-muted focus-visible:ring-primary shadow-sm"
                                             value={sellingPrice}
                                             onChange={(e) => handleFieldChange(variant.shopify_variant_id, 'selling_price', parseFloat(e.target.value) || 0)}
                                          />
                                       </div>
                                   </div>
                              </div>
                           </div>
                        );
                    })}
                 </div>
              </CardContent>
           </Card>
        </div>

        {/* Right Column: Read-only Data */}
        <div className="space-y-6">
           <Card className="bg-card border-none shadow-sm rounded-3xl overflow-hidden p-1">
              {images[0] ? (
                 <div className="aspect-square relative rounded-2xl overflow-hidden bg-muted/20">
                     <img src={images[0]} alt="Main product" className="object-cover w-full h-full hover:scale-105 transition-transform duration-500" />
                 </div>
              ) : (
                 <div className="aspect-square relative rounded-[2rem] overflow-hidden bg-muted/20 flex flex-col items-center justify-center gap-4 text-muted-foreground/50">
                    <Package className="h-16 w-16" />
                    <span className="text-xs font-black uppercase tracking-widest">No Media Found</span>
                 </div>
              )}
           </Card>
        </div>
      </div>

      <LinkProductDialog 
        shopifyProduct={linkingVariant} 
        open={linkDialogOpen} 
        onOpenChange={setLinkDialogOpen}
        onLinked={fetchProduct}
      />
    </div>
  );
}
