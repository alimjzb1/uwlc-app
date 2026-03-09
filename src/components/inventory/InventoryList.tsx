import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Product } from "@/types";
import { useNavigate } from "react-router-dom";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface InventoryListProps {
  products: Product[];
  loading: boolean;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
}

export function InventoryList({ products, loading, selectedIds, onToggleSelect, onToggleAll }: InventoryListProps) {
  const navigate = useNavigate();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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
      <div className="p-12 text-center opacity-50 flex items-center justify-center gap-2">
        <div className="h-4 w-4 border-2 border-primary border-t-transparent animate-spin rounded-full" />
        Loading inventory...
      </div>
    );
  }

  if (products.length === 0) {
    return <div className="p-12 text-center text-muted-foreground font-medium bg-muted/20 rounded-lg border-2 border-dashed">No products found in inventory.</div>;
  }

  const groupedProducts = products.reduce((acc, product) => {
    if (!product.parent_id) {
      if (!acc[product.id]) acc[product.id] = { ...product, variants: [] };
      else {
        acc[product.id] = { ...product, variants: acc[product.id].variants };
      }
    } else {
      if (!acc[product.parent_id]) acc[product.parent_id] = { id: product.parent_id, variants: [] } as any; 
      acc[product.parent_id].variants.push(product);
    }
    return acc;
  }, {} as Record<string, Product & { variants: Product[] }>);

  // Only render valid parent products
  const productGroups = Object.values(groupedProducts).filter(g => g.name);

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-[50px] pl-4">
              <Checkbox 
                checked={products.length > 0 && selectedIds.length === products.length}
                onCheckedChange={onToggleAll}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead className="font-bold text-[10px] uppercase tracking-widest">Product Name</TableHead>
            <TableHead className="font-bold text-[10px] uppercase tracking-widest hidden sm:table-cell">SKU</TableHead>
            <TableHead className="text-right font-bold text-[10px] uppercase tracking-widest">Quantity</TableHead>
            <TableHead className="font-bold text-[10px] uppercase tracking-widest">Status</TableHead>
            <TableHead className="w-[40px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {productGroups.map((group) => {
            const hasVariants = group.variants && group.variants.length > 0;
            const isExpanded = expandedGroups.has(group.id);
            
            // Calculate total quantity for the group if it has variants
            const totalQty = hasVariants 
              ? group.variants.reduce((sum, v) => sum + (v.quantity_on_hand || 0), 0)
              : group.quantity_on_hand || 0;

            const threshold = group.low_stock_threshold || 10;

            return (
              <React.Fragment key={group.id}>
                <TableRow 
                  className={cn("group transition-colors", "cursor-pointer hover:bg-muted/10")}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('[role="checkbox"]')) return;
                    navigate(`/inventory/${group.id}`);
                  }}
                >
                  <TableCell className="pl-4">
                    <Checkbox 
                      checked={selectedIds.includes(group.id)}
                      onCheckedChange={() => onToggleSelect(group.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                  <TableCell className="font-semibold text-sm">
                     <div className="flex items-center gap-2">
                       {group.name}
                       {hasVariants && (
                         <Badge variant="secondary" className="text-[9px] h-4 rounded-full px-1.5">{group.variants.length} variants</Badge>
                       )}
                     </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-primary hidden sm:table-cell">
                     {group.sku ? group.sku : (hasVariants ? <span className="text-muted-foreground italic text-[10px]">Multiple</span> : '-')}
                  </TableCell>
                  <TableCell className="text-right font-black text-sm">{totalQty}</TableCell>
                  <TableCell>
                    {totalQty > threshold ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-none text-[10px] font-bold uppercase tracking-tight dark:bg-emerald-900/30 dark:text-emerald-300">In Stock</Badge>
                    ) : totalQty > 0 ? (
                      <Badge className="bg-amber-100 text-amber-800 border-none text-[10px] font-bold uppercase tracking-tight dark:bg-amber-900/30 dark:text-amber-300">Low Stock</Badge>
                    ) : (
                      <Badge variant="destructive" className="border-none text-[10px] font-bold uppercase tracking-tight">Out of Stock</Badge>
                    )}
                  </TableCell>
                  <TableCell className="p-0">
                    {hasVariants ? (
                      <div 
                        className="flex items-center justify-center p-4 hover:bg-muted/20 w-full h-full cursor-pointer transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleGroup(group.id);
                        }}
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center p-4">
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    )}
                  </TableCell>
                </TableRow>
                
                {hasVariants && isExpanded && group.variants.map((variant) => (
                   <TableRow 
                    key={variant.id} 
                    className="cursor-pointer bg-muted/5 border-muted/10 hover:bg-muted/10 transition-colors"
                    onClick={(e) => {
                        if ((e.target as HTMLElement).closest('[role="checkbox"]')) return;
                        navigate(`/inventory/${variant.id}`);
                    }}
                   >
                     <TableCell className="pl-4 relative">
                        {/* Parent connection line visual */}
                        <div className="absolute left-6 top-0 bottom-0 w-px bg-muted-foreground/20" />
                        <div className="absolute left-6 top-1/2 w-3 border-t border-muted-foreground/20" />
                        
                        <div className="pl-6">
                           <Checkbox 
                             checked={selectedIds.includes(variant.id)}
                             onCheckedChange={() => onToggleSelect(variant.id)}
                             onClick={(e) => e.stopPropagation()}
                           />
                        </div>
                     </TableCell>
                     <TableCell className="text-sm font-medium text-foreground/80 pl-6">
                       {variant.name.replace(group.name + ' - ', '')}
                     </TableCell>
                     <TableCell className="font-mono text-xs font-medium text-primary/80 pl-6 hidden sm:table-cell">{variant.sku}</TableCell>
                     <TableCell className="text-right font-bold text-sm text-foreground/80">{variant.quantity_on_hand}</TableCell>
                     <TableCell className="pl-6">
                       {variant.quantity_on_hand > (variant.low_stock_threshold || 10) ? (
                         <Badge className="bg-emerald-100 text-emerald-800 border-none text-[9px] font-bold uppercase tracking-tight opacity-80 dark:bg-emerald-900/30 dark:text-emerald-300">In Stock</Badge>
                       ) : variant.quantity_on_hand > 0 ? (
                         <Badge className="bg-amber-100 text-amber-800 border-none text-[9px] font-bold uppercase tracking-tight opacity-80 dark:bg-amber-900/30 dark:text-amber-300">Low Stock</Badge>
                       ) : (
                         <Badge variant="destructive" className="border-none text-[9px] font-bold uppercase tracking-tight opacity-80">Out of Stock</Badge>
                       )}
                     </TableCell>
                     <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50 opacity-0 hover:opacity-100 transition-opacity" />
                     </TableCell>
                   </TableRow>
                ))}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
