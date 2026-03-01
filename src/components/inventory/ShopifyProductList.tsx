import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShopifyProduct } from "@/types";
import { ExternalLink, Link as LinkIcon, Loader2, Package, ChevronDown, ChevronRight } from "lucide-react";
import { LinkProductDialog } from "@/components/inventory/LinkProductDialog";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface ShopifyProductListProps {
  products: ShopifyProduct[];
  loading: boolean;
}

export function ShopifyProductList({ products, loading }: ShopifyProductListProps) {
  const navigate = useNavigate();
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const handleOpenLink = (product: ShopifyProduct) => {
    setSelectedProduct(product);
    setLinkDialogOpen(true);
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="p-12 text-center bg-card rounded-2xl border border-muted/20 animate-pulse">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-4" />
        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Loading Shopify Catalog...</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="p-16 text-center border-2 border-dashed rounded-3xl border-muted/20 bg-card/50">
        <div className="h-16 w-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <LinkIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-black uppercase italic tracking-tighter mb-2">No Shopify Products Found</h3>
        <p className="text-muted-foreground font-medium mb-8 max-w-sm mx-auto">
          Sync your products from Shopify to see them here and bridge them to your warehouse inventory.
        </p>
        <Button variant="default" className="font-black uppercase tracking-widest px-8 h-12 shadow-xl shadow-primary/20">
          Sync Products Now
        </Button>
      </div>
    );
  }

  const groupedProducts = products.reduce((acc, product) => {
    const parentId = product.shopify_product_id;
    if (!acc[parentId]) {
      const titleParts = product.title.split(' - ');
      const parentTitle = titleParts.length > 1 ? titleParts.slice(0, -1).join(' - ') : product.title;
      
      acc[parentId] = {
        id: parentId,
        title: parentTitle,
        images: product.images || [],
        variants: []
      };
    }
    acc[parentId].variants.push(product);
    return acc;
  }, {} as Record<string, { id: string, title: string, images: string[], variants: ShopifyProduct[] }>);

  const productGroups = Object.values(groupedProducts);

  return (
    <div className="rounded-2xl border border-muted/20 bg-card overflow-hidden shadow-sm">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent border-muted/10">
            <TableHead className="w-[80px] text-[10px] font-black uppercase tracking-widest py-4">Image</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Title & ID</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">SKU</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Price</TableHead>
            <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Status</TableHead>
            <TableHead className="text-right text-[10px] font-black uppercase tracking-widest py-4 px-6">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {productGroups.map((group) => {
            const hasVariants = group.variants.length > 1;
            const isExpanded = expandedGroups.has(group.id);
            const firstVariant = group.variants[0];

            return (
              <React.Fragment key={group.id}>
                <TableRow 
                  className={cn("group border-muted/10 transition-colors", "cursor-pointer hover:bg-muted/10")}
                  onClick={() => navigate(`/inventory/shopify/${group.id}`)}
                >
                  <TableCell className="py-4">
                    <div className="relative h-12 w-12 rounded-xl overflow-hidden bg-muted/20 border border-muted/20 group-hover:scale-105 transition-transform duration-300">
                      {group.images?.[0] ? (
                        <img 
                          src={group.images[0]} 
                          alt={group.title} 
                          className="object-cover w-full h-full" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-sm tracking-tight group-hover:text-primary transition-colors">{group.title}</div>
                      {hasVariants && (
                         <Badge variant="secondary" className="text-[10px] h-5 rounded-full px-2">{group.variants.length} variants</Badge>
                      )}
                    </div>
                    {!hasVariants && (
                      <div className="text-[10px] font-mono text-muted-foreground uppercase mt-1">Ref: {firstVariant.shopify_variant_id.slice(-8)}</div>
                    )}
                  </TableCell>
                  <TableCell className="py-4">
                    {!hasVariants ? (
                      <Badge variant="outline" className="font-mono text-[10px] rounded-md border-muted/20">{firstVariant.sku || 'NO SKU'}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs italic">Multiple SKUs</span>
                    )}
                  </TableCell>
                  <TableCell className="py-4 font-black text-sm italic">
                    {!hasVariants ? `$${firstVariant.price}` : (
                      (() => {
                        const prices = group.variants.map(v => v.price);
                        const min = Math.min(...prices);
                        const max = Math.max(...prices);
                        return min === max ? `$${min}` : `$${min} - $${max}`;
                      })()
                    )}
                  </TableCell>
                  <TableCell className="py-4">
                    {!hasVariants ? (
                      <Badge 
                        className={cn(
                          "text-[9px] font-black uppercase tracking-widest rounded-full px-2 py-0.5 border-none",
                          firstVariant.inventory_policy === 'deny' 
                            ? "bg-destructive/10 text-destructive shadow-sm shadow-destructive/10" 
                            : "bg-primary/10 text-primary shadow-sm shadow-primary/10"
                        )}
                      >
                        {firstVariant.inventory_policy}
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right py-4 px-6">
                    {hasVariants ? (
                      <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full pointer-events-auto" onClick={() => toggleGroup(group.id)}>
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleOpenLink(firstVariant)}
                          className="h-9 px-4 font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-primary hover:text-primary-foreground border-muted/30 hover:border-primary transition-all shadow-sm"
                        >
                          <LinkIcon className="h-3 w-3 mr-2" /> Bridge
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-muted/30">
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
                
                {hasVariants && isExpanded && group.variants.map(variant => {
                  const variantTitle = variant.title.split(' - ').pop() || variant.title;
                  return (
                    <TableRow key={variant.id} className="bg-muted/5 border-muted/10 hover:bg-muted/10 transition-colors cursor-pointer" onClick={() => navigate(`/inventory/shopify/${group.id}`)}>
                      <TableCell className="py-3 pl-10 border-l-2 border-l-primary/20">
                        <div className="flex justify-end pr-4 text-muted-foreground/30"><ChevronRight className="h-4 w-4"/></div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="font-medium text-sm text-foreground/80">{variantTitle === group.title ? 'Default Title' : variantTitle}</div>
                        <div className="text-[10px] font-mono text-muted-foreground uppercase mt-0.5">Ref: {variant.shopify_variant_id.slice(-8)}</div>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant="outline" className="font-mono text-[10px] rounded-md border-muted/20 bg-background/50">{variant.sku || 'NO SKU'}</Badge>
                      </TableCell>
                      <TableCell className="py-3 font-bold text-sm text-foreground/80 italic">${variant.price}</TableCell>
                      <TableCell className="py-3">
                        <Badge 
                          className={cn(
                            "text-[9px] font-black uppercase tracking-widest rounded-full px-2 py-0.5 border-none opacity-80",
                            variant.inventory_policy === 'deny' 
                              ? "bg-destructive/10 text-destructive shadow-sm shadow-destructive/10" 
                              : "bg-primary/10 text-primary shadow-sm shadow-primary/10"
                          )}
                        >
                          {variant.inventory_policy}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right py-3 px-6">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={(e) => { e.stopPropagation(); handleOpenLink(variant); }}
                            className="h-8 px-3 font-bold uppercase text-[9px] tracking-widest rounded-lg hover:bg-primary hover:text-primary-foreground border-muted/30 hover:border-primary transition-all shadow-sm"
                          >
                            <LinkIcon className="h-3 w-3 mr-1.5" /> Bridge
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted/30">
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>

      <LinkProductDialog 
        shopifyProduct={selectedProduct} 
        open={linkDialogOpen} 
        onOpenChange={setLinkDialogOpen}
        onLinked={() => {
            setLinkDialogOpen(false);
        }}
      />
    </div>
  );
}

