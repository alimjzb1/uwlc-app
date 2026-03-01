import { useState } from "react";
import { Check, Link as LinkIcon, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Product } from "@/types";
import { useInventory } from "@/hooks/use-inventory";

interface ProductLinkerProps {
  orderItemId: string;
  currentProductId?: string;
  onLinkComplete: () => void;
}

export function ProductLinker({ orderItemId, currentProductId, onLinkComplete }: ProductLinkerProps) {
  const [open, setOpen] = useState(false);
  const { products, loading } = useInventory();
  const [searchQuery, setSearchQuery] = useState("");
  const [updating, setUpdating] = useState(false);

  // Find currently linked product object
  const linkedProduct = products.find((p: Product) => p.id === currentProductId);

  // Filter products based on search and selectability
  const filteredProducts = products.filter((product: Product) => {
      // Must be a variant OR a product without variants
      const isSelectable = product.parent_id !== null || !products.some((p: Product) => p.parent_id === product.id);
      if (!isSelectable) return false;

      const parent = product.parent_id ? products.find((p: Product) => p.id === product.parent_id) : null;
      let displayName = product.name;
      if (parent && product.name.startsWith(parent.name)) {
         displayName = product.name;
      } else if (parent) {
         displayName = `${parent.name} - ${product.name}`;
      }
      
      const searchTerm = searchQuery.toLowerCase();
      return product.sku.toLowerCase().includes(searchTerm) || displayName.toLowerCase().includes(searchTerm);
  });

  const handleLink = async (productId: string) => {
    try {
      setUpdating(true);
      const { error } = await supabase
        .from('order_items')
        .update({ product_id: productId })
        .eq('id', orderItemId);

      if (error) throw error;

      onLinkComplete();
      setOpen(false);
    } catch (error) {
      console.error("Failed to link product:", error);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs justify-start w-full"
        >
          {linkedProduct ? (
            <span className="flex items-center gap-2 text-primary font-medium">
              <LinkIcon className="h-3 w-3" />
              {linkedProduct.sku}
            </span>
          ) : (
            <span className="text-muted-foreground hover:text-foreground flex items-center gap-1">
              <LinkIcon className="h-3 w-3" />
              Link Product
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="p-0 gap-0 max-w-sm">
         <DialogHeader className="px-4 py-3 border-b">
            <DialogTitle>Link to Inventory Item</DialogTitle>
         </DialogHeader>
        <div className="p-2 space-y-2">
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search SKU or Name..." 
                    className="pl-8" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            
            <div className="max-h-[300px] overflow-y-auto space-y-1">
                {loading ? (
                    <div className="text-sm text-center py-4 text-muted-foreground">Loading inventory...</div>
                ) : filteredProducts.length === 0 ? (
                    <div className="text-sm text-center py-4 text-muted-foreground">No products found.</div>
                ) : (
                    filteredProducts.map((product: Product) => {
                        const parent = product.parent_id ? products.find((p: Product) => p.id === product.parent_id) : null;
                        let displayName = product.name;
                        if (parent && product.name.startsWith(parent.name)) {
                           displayName = product.name;
                        } else if (parent) {
                           displayName = `${parent.name} - ${product.name}`;
                        }

                        return (
                        <div
                            key={product.id}
                            className={cn(
                                "flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer text-sm transition-colors",
                                currentProductId === product.id && "bg-muted font-medium"
                            )}
                            onClick={() => !updating && handleLink(product.id)}
                        >
                            <div className="flex-1 overflow-hidden">
                                <div className="font-medium truncate">{displayName}</div>
                                <div className="text-xs text-muted-foreground truncate font-mono">{product.sku}</div>
                            </div>
                            {currentProductId === product.id && (
                                <Check className="h-4 w-4 text-primary ml-2 flex-shrink-0" />
                            )}
                        </div>
                        );
                    })
                )}
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
