import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  ArrowLeft, 
  MapPin,
  Package,
  Search,
  History,
  ArrowRightLeft,
  MoreHorizontal,
  Pencil,
  Trash2
} from "lucide-react";

import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocations } from "@/hooks/use-locations";

import { supabase } from "@/lib/supabase";
import { InventoryLocation, InventoryLevel, Product } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { InputDialog } from "@/components/ui/input-dialog";
import { StockTransferDialog } from "@/components/inventory/StockTransferDialog";

export default function LocationDetail() {
  const { id } = useParams<{ id: string }>();
  const { updateStockInLocation, removeStockFromLocation } = useLocations();
  const [location, setLocation] = useState<InventoryLocation | null>(null);
  const [inventory, setInventory] = useState<(InventoryLevel & { product: Product })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Dialog States
  const [editItem, setEditItem] = useState<{ id: string; quantity: number } | null>(null);
  const [deleteItem, setDeleteItem] = useState<{ id: string; name: string } | null>(null);
  const [transferItem, setTransferItem] = useState<Product | null>(null);

  useEffect(() => {
    if (id) fetchLocationData();
  }, [id]);

  async function fetchLocationData() {
    try {
      setLoading(true);
      // 1. Fetch Location Info
      const { data: locData, error: locError } = await supabase
        .from('inventory_locations')
        .select('*')
        .eq('id', id)
        .single();
      
      if (locError) throw locError;
      setLocation(locData);

      // 2. Fetch Inventory at this location
      const { data: invData, error: invError } = await supabase
        .from('inventory_levels')
        .select(`
          *,
          product:products_inventory(*)
        `)
        .eq('location_id', id);

      if (invError) throw invError;
      setInventory(invData as any || []);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filteredInventory = inventory.filter(item => 
    item.product?.name.toLowerCase().includes(search.toLowerCase()) ||
    item.product?.sku.toLowerCase().includes(search.toLowerCase())
  );

  const handleUpdateStock = async (quantityStr: string) => {
    if (!editItem) return;
    const qty = parseInt(quantityStr);
    if (isNaN(qty)) {
        alert("Please enter a valid number.");
        return;
    }

    try {
        await updateStockInLocation(id!, editItem.id, qty);
        setEditItem(null);
        fetchLocationData();
    } catch (error: any) {
        alert(error.message);
    }
  };

  const handleRemoveStock = async () => {
      if (!deleteItem) return;
      try {
          await removeStockFromLocation(id!, deleteItem.id);
          setDeleteItem(null);
          fetchLocationData();
      } catch (error: any) {
          alert(error.message);
      }
  };

  if (loading) return <div className="p-8"><Skeleton className="h-12 w-64 mb-8" /><Skeleton className="h-64 w-full" /></div>;
  if (!location) return <div>Location not found</div>;

  return (
    <div className="container py-8 max-w-7xl space-y-8 animate-in fade-in">
       {/* Header */}
       <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 text-muted-foreground hover:text-foreground w-fit">
          <Link to="/locations">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Locations
          </Link>
        </Button>
        
        <div className="flex items-start justify-between">
           <div>
             <div className="flex items-center gap-3">
               <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                 <MapPin className="h-6 w-6 text-primary" />
               </div>
               <div>
                  <h1 className="text-3xl font-black tracking-tighter uppercase italic">{location.name}</h1>
                  <p className="text-muted-foreground font-medium">{location.details || "No details provided"}</p>
               </div>
             </div>
           </div>
           {/* Add actions here if needed */}
        </div>
       </div>

       {/* Stats Cards */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-card border-none shadow-sm">
             <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total Items</CardTitle>
             </CardHeader>
             <CardContent>
                <div className="text-3xl font-black">{inventory.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Unique SKUs stored here</p>
             </CardContent>
          </Card>
          <Card className="bg-card border-none shadow-sm">
             <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total Units</CardTitle>
             </CardHeader>
             <CardContent>
                <div className="text-3xl font-black">{inventory.reduce((sum, item) => sum + item.quantity, 0)}</div>
                <p className="text-xs text-muted-foreground mt-1">Total physical count</p>
             </CardContent>
          </Card>
           {/* Stock History could go here */}
           <Card className="bg-card border-none shadow-sm opacity-50">
             <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Recent Activity</CardTitle>
             </CardHeader>
             <CardContent>
                <div className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    <span className="text-sm font-bold">Coming Soon</span>
                </div>
             </CardContent>
          </Card>
       </div>

       {/* Inventory Table */}
       <div className="space-y-4">
          <div className="flex items-center justify-between">
             <h2 className="text-xl font-black uppercase italic flex items-center gap-2">
                <Package className="h-5 w-5 opacity-50" />
                Current Stock
             </h2>
             <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                   placeholder="Search products..." 
                   value={search} 
                   onChange={(e) => setSearch(e.target.value)}
                   className="pl-9 h-10 rounded-xl"
                />
             </div>
          </div>

          <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
             <Table>
                <TableHeader className="bg-muted/30">
                   <TableRow>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest pl-6">Product / SKU</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest">Category</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest">Bin</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest text-right pr-6">Quantity</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                   {filteredInventory.length === 0 ? (
                      <TableRow>
                         <TableCell colSpan={5} className="h-32 text-center text-muted-foreground font-medium">
                            No items found in this location.
                         </TableCell>
                      </TableRow>
                   ) : (
                      filteredInventory.map(item => (
                         <TableRow key={item.id} className="hover:bg-muted/5 group">
                            <TableCell className="pl-6 py-4">
                               <div className="flex flex-col">
                                  <Link to={`/inventory/${item.product_id}`} className="font-bold text-sm hover:underline hover:text-primary transition-colors">
                                     {item.product?.name || "Unknown Product"}
                                  </Link>
                                  <span className="text-[10px] font-mono text-muted-foreground uppercase">{item.product?.sku}</span>
                               </div>
                            </TableCell>
                            <TableCell>
                               <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-wider opacity-70">
                                  {item.product?.category || "Uncategorized"}
                               </Badge>
                            </TableCell>
                            <TableCell>
                               <span className="font-mono text-xs font-bold opacity-60">
                                  {item.product?.bin_location || "-"}
                               </span>
                            </TableCell>
                            <TableCell className="text-right pr-6">
                               <div className={`text-lg font-black tracking-tight ${item.quantity <= (item.product?.low_stock_threshold || 10) ? "text-rose-500" : "text-foreground"}`}>
                                  {item.quantity}
                               </div>
                            </TableCell>
                            <TableCell className="text-right pr-6">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setEditItem({ id: item.product_id, quantity: item.quantity })}>
                                      <Pencil className="mr-2 h-4 w-4" /> Edit Quantity
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setTransferItem(item.product)}>
                                      <ArrowRightLeft className="mr-2 h-4 w-4" /> Transfer Out
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteItem({ id: item.product_id, name: item.product?.name || "Unknown Item" })}>
                                      <Trash2 className="mr-2 h-4 w-4" /> Remove
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                         </TableRow>
                      ))
                   )}
                </TableBody>
             </Table>
          </div>
       </div>

       {/* Dialogs */}
       <InputDialog 
         open={!!editItem} 
         onOpenChange={(open) => !open && setEditItem(null)}
         title="Edit Stock Quantity"
         description="Enter the new physical count for this item in this location."
         label="Quantity"
         inputType="number"
         defaultValue={editItem?.quantity.toString() || "0"}
         onConfirm={handleUpdateStock}
       />

       <ConfirmationDialog 
         open={!!deleteItem} 
         onOpenChange={(open) => !open && setDeleteItem(null)}
         title="Remove Item"
         description={`Are you sure you want to remove ${deleteItem?.name} from this location? This action cannot be undone.`}
         onConfirm={handleRemoveStock}
         confirmText="Remove"
         variant="destructive"
       />

        {transferItem && (
            <StockTransferDialog 
                open={!!transferItem}
                onOpenChange={(open) => !open && setTransferItem(null)}
                product={transferItem}
                initialSourceLocationId={id}
                onSuccess={fetchLocationData}
            />
        )}
    </div>
  );
}
