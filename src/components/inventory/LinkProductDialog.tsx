import { useState, useEffect } from "react";
import { Search, Loader2, Plus, Trash2, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ShopifyProduct, Product, ProductLink } from "@/types";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";


interface LinkProductDialogProps {
  shopifyProduct: ShopifyProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked: () => void;
}

export function LinkProductDialog({ shopifyProduct, open, onOpenChange, onLinked }: LinkProductDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [existingLinks, setExistingLinks] = useState<ProductLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);

  useEffect(() => {
    if (open && shopifyProduct) {
      fetchExistingLinks();
    }
  }, [open, shopifyProduct]);

  const fetchExistingLinks = async () => {
    if (!shopifyProduct) return;
    setLoadingLinks(true);
    try {
      const { data, error } = await supabase
        .from('product_links')
        .select('*, inventory_product:products_inventory(*)')
        .eq('shopify_variant_id', shopifyProduct.shopify_variant_id);
      
      if (!error && data) {
        setExistingLinks(data as ProductLink[]);
      }
    } finally {
      setLoadingLinks(false);
    }
  };

  const handleSearch = async (term: string) => {
    setSearchTerm(term);
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('products_inventory')
        .select('*')
        .or(`sku.ilike.%${term}%,name.ilike.%${term}%`)
        .limit(5);
      
      if (!error && data) {
        setSearchResults(data as Product[]);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const addItemToBundle = async (productId: string) => {
    if (!shopifyProduct) return;

    setIsLinking(true);
    try {
      const { error } = await supabase
        .from('product_links')
        .insert({
          shopify_product_id: shopifyProduct.shopify_product_id,
          shopify_variant_id: shopifyProduct.shopify_variant_id,
          inventory_product_id: productId,
          quantity_per_unit: 1,
          priority: existingLinks.length + 1
        });

      if (error) throw error;
      
      setSearchTerm("");
      setSearchResults([]);
      fetchExistingLinks();
    } catch (err) {
      console.error("Failed to link:", err);
    } finally {
      setIsLinking(false);
    }
  };

  const handleUpdateQuantity = async (linkId: string, qty: number) => {
    try {
      const { error } = await supabase
        .from('product_links')
        .update({ quantity_per_unit: qty })
        .eq('id', linkId);
      
      if (error) throw error;
      setExistingLinks(prev => prev.map(l => l.id === linkId ? { ...l, quantity_per_unit: qty } : l));
    } catch (err) {
      console.error("Failed to update quantity:", err);
    }
  };

  const handleRemoveLink = async (linkId: string) => {
    try {
      const { error } = await supabase
        .from('product_links')
        .delete()
        .eq('id', linkId);
      
      if (error) throw error;
      setExistingLinks(prev => prev.filter(l => l.id !== linkId));
    } catch (err) {
      console.error("Failed to remove link:", err);
    }
  };

  if (!shopifyProduct) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-card border-none shadow-2xl">
        <DialogHeader className="p-6 bg-primary text-primary-foreground">
          <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">
            Configure Bridge: {shopifyProduct.title}
          </DialogTitle>
          <DialogDescription className="text-primary-foreground/70 font-medium">
            Link one or more inventory items to this Shopify variant for automated stock deduction.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-8">
          {/* Linked Items Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <LinkIcon className="h-3 w-3" /> Currently Linked Items
              </Label>
              <Badge variant="outline" className="font-mono text-[10px]">{existingLinks.length} Items in Set</Badge>
            </div>

            {loadingLinks ? (
              <div className="h-20 flex items-center justify-center border rounded-xl bg-muted/20">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : existingLinks.length > 0 ? (
              <div className="space-y-2">
                {existingLinks.map((link) => (
                  <div key={link.id} className="flex items-center gap-3 p-3 border border-muted/20 bg-background rounded-xl shadow-sm animate-in slide-in-from-left duration-300">
                    <div className="h-10 w-10 bg-primary/5 rounded-lg flex items-center justify-center font-black text-primary text-xs shrink-0">
                      {link.inventory_product?.sku.slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{link.inventory_product?.name}</div>
                      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{link.inventory_product?.sku}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-center">
                        <Label className="text-[8px] font-black uppercase opacity-50 mb-1">Qty</Label>
                        <Input 
                          type="number" 
                          min="1" 
                          value={link.quantity_per_unit} 
                          onChange={(e) => handleUpdateQuantity(link.id, parseInt(e.target.value) || 1)}
                          className="h-8 w-16 text-center font-black p-0 rounded-lg bg-muted/30 border-none"
                        />
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleRemoveLink(link.id)}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 mt-4"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center border-2 border-dashed rounded-2xl border-muted/20 text-muted-foreground">
                <p className="text-sm font-medium">No inventory items linked yet.</p>
                <p className="text-[10px] uppercase tracking-widest opacity-60">Add items below to create a set/bundle</p>
              </div>
            )}
          </div>

          <Separator className="bg-muted/10" />

          {/* Search Section */}
          <div className="space-y-4">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Add New Item to Set</Label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search internal SKU or Name..."
                className="pl-10 h-12 rounded-xl bg-muted/30 border-none focus-visible:ring-primary shadow-inner"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>

            {/* Results */}
            <div className="grid grid-cols-1 gap-2">
              {isSearching ? (
                <div className="p-4 text-center text-sm text-muted-foreground font-medium animate-pulse">Searching inventory...</div>
              ) : searchResults.length > 0 ? (
                searchResults.map((prod: Product) => (
                  <div 
                    key={prod.id}
                    className="p-3 bg-muted/20 border border-transparent hover:border-primary/50 hover:bg-muted/40 rounded-xl flex justify-between items-center group transition-all cursor-pointer"
                    onClick={() => addItemToBundle(prod.id)}
                  >
                    <div>
                      <div className="font-bold text-sm italic group-hover:text-primary transition-colors">{prod.sku}</div>
                      <div className="text-[10px] font-medium text-muted-foreground uppercase">{prod.name}</div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              ) : searchTerm.length > 1 && (
                <div className="p-4 text-center text-sm text-muted-foreground font-medium">No matches found for "{searchTerm}"</div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 bg-muted/10 border-t border-muted/10">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="font-black uppercase text-xs tracking-widest h-12 px-8">Close Bridge Config</Button>
          <Button onClick={() => { onLinked(); onOpenChange(false); }} className="font-black uppercase text-xs tracking-widest h-12 px-8 shadow-xl shadow-primary/20">
            {isLinking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Finish Setup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

