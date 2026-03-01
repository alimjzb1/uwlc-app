import { useState } from "react";
import { useInventory } from "@/hooks/use-inventory";
import { Search, RefreshCcw, Package } from "lucide-react";
import { useShopifyProducts } from "@/hooks/use-shopify-products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InventoryList } from "@/components/inventory/InventoryList";
import { ShopifyProductList } from "@/components/inventory/ShopifyProductList";
import { AddProductDialog } from "@/components/inventory/AddProductDialog";
import { cn } from "@/lib/utils";

export default function Inventory() {
  const { products, loading, refreshInventory } = useInventory();
  const { products: shopifyProducts, loading: shopifyLoading, refreshProducts } = useShopifyProducts();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);


  const matchingProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const parentIdsToInclude = new Set(matchingProducts.map(p => p.parent_id).filter(Boolean));
  const matchingParentIds = new Set(matchingProducts.filter(p => !p.parent_id).map(p => p.id));

  const filteredProducts = products.filter(p => 
    matchingProducts.includes(p) || 
    parentIdsToInclude.has(p.id) ||
    (p.parent_id && matchingParentIds.has(p.parent_id))
  );

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === filteredProducts.length) {
        setSelectedIds([]);
    } else {
        setSelectedIds(filteredProducts.map(p => p.id));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Package className="h-8 w-8 text-primary" /> Inventory
            <span className="text-sm font-bold bg-muted px-2 py-1 rounded-full text-muted-foreground self-start mt-1">
                {products.length} Items
            </span>
          </h1>
          <p className="text-muted-foreground font-medium">
            Manage your internal stock and sync with Shopify products.
          </p>
        </div>
        <AddProductDialog onProductAdded={refreshInventory} />
      </div>

      <Tabs defaultValue="warehouse" className="space-y-6">
        <div className="flex items-center justify-between border-b pb-1">
          <TabsList className="bg-transparent h-12 gap-6 p-0">
            <TabsTrigger value="warehouse" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 text-sm font-bold uppercase tracking-widest transition-all">
              Warehouse Stock
            </TabsTrigger>
            <TabsTrigger value="shopify" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 text-sm font-bold uppercase tracking-widest transition-all">
              Shopify Products
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="warehouse" className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter by name or SKU..."
                className="pl-8 bg-card"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button variant="outline" size="sm" onClick={refreshInventory} disabled={loading} className="gap-2 font-bold uppercase text-[10px] h-9 shrink-0">
                    <RefreshCcw className={cn("h-3 w-3", loading && "animate-spin")} />
                    Reload
                </Button>
            </div>
          </div>
          <InventoryList 
            products={filteredProducts} 
            loading={loading} 
            selectedIds={selectedIds}
            onToggleSelect={toggleSelection}
            onToggleAll={toggleAll}
          />
        </TabsContent>

        <TabsContent value="shopify" className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
                <div className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Connected Products: <span className="text-foreground">{shopifyProducts.length}</span>
                </div>
                <Button variant="outline" size="sm" onClick={refreshProducts} disabled={shopifyLoading} className="gap-2 font-bold uppercase text-[10px] h-9">
                    <RefreshCcw className={cn("h-3 w-3", shopifyLoading && "animate-spin")} />
                    Sync with Shopify
                </Button>
            </div>
          <ShopifyProductList products={shopifyProducts} loading={shopifyLoading} />
        </TabsContent>
      </Tabs>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8 duration-500 transition-all flex justify-center w-full max-w-fit">
          <div className="flex items-center gap-4 px-6 py-3 bg-card/90 backdrop-blur-xl border border-primary/30 shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-full mx-4">
            <div className="flex items-center gap-3 pr-5 border-r border-muted-foreground/20">
              <div className="flex items-center justify-center bg-primary text-primary-foreground h-7 w-7 rounded-full text-xs font-black shadow-lg shadow-primary/30 ring-2 ring-background">
                {selectedIds.length}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black leading-none uppercase tracking-tight">Selected</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
                 <Button size="sm" variant="destructive" className="h-8 font-bold text-[10px] uppercase tracking-wider" onClick={() => alert("Bulk Delete Coming Soon")}>
                    Delete
                </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

