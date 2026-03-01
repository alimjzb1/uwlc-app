import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Package, 
  AlertTriangle, 
  Edit3, 
  Trash2,
  Save,
  X,
  TrendingUp,
  Banknote,
  Image as ImageIcon,
  Loader2,
  Upload,
  MapPin,
  CheckSquare,
  History,
  Plus,
  Minus,
  Link as LinkIcon,
  ArrowRightLeft,
  ExternalLink
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useProduct, useInventory } from "@/hooks/use-inventory";
import { useLocations } from "@/hooks/use-locations";
import { useAudit } from "@/hooks/use-audit";
import { Button } from "@/components/ui/button";
import { StockTransferDialog } from "@/components/inventory/StockTransferDialog";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea"; 
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { 
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { 
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Product, AuditLog, InventoryLevel, InventoryLocation } from "@/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useShopifySettings } from "@/hooks/use-shopify-settings";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";


import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";

import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { product, variants, loading, error, refresh } = useProduct(id!);
  const { updateProduct, deleteProduct, addProductImage, deleteProductImage } = useInventory();
  const { locations: allLocations, adjustStockAtLocation, distributeStockToLocation, getStockByLocation: getLevels } = useLocations();
  const { getLogs, logAction } = useAudit();
  const { settings } = useShopifySettings();
  
  // Main Product Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  
  // Variant Sheet State
  const [isVariantSheetOpen, setIsVariantSheetOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<Product | null>(null);
  const [variantEditData, setVariantEditData] = useState<any>(null);

  // Image Helper State
  const [uploading, setUploading] = useState(false);
  const [mainImage, setMainImage] = useState<string | null>(null);

  // Dialog States
  const [deleteProductDialogOpen, setDeleteProductDialogOpen] = useState(false);
  const [deleteVariantDialogOpen, setDeleteVariantDialogOpen] = useState(false);
  const [deleteImageDialogOpen, setDeleteImageDialogOpen] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<string | null>(null);
  
  // Stock Adjustment State
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [stockActionType, setStockActionType] = useState<'add' | 'deduct'>('add');
  const [stockVariantId, setStockVariantId] = useState<string>("main");
  const [stockQuantity, setStockQuantity] = useState<string>("");
  const [stockReason, setStockReason] = useState<string>("");
  const [stockLocationId, setStockLocationId] = useState<string>("");


  // Bulk Edit & History State
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditError, setAuditError] = useState<string | null>(null);
  
  // Assign Location State
  const [assignLocationDialogOpen, setAssignLocationDialogOpen] = useState(false);
  const [targetLocationId, setTargetLocationId] = useState<string>("");
  const [assignQuantity, setAssignQuantity] = useState<number>(1);
  const [assignNotes, setAssignNotes] = useState<string>("");

  // Location Stock Breakdown State
  const [locationLevels, setLocationLevels] = useState<(InventoryLevel & { location: InventoryLocation })[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferInitialSource, setTransferInitialSource] = useState<string | null>(null);


  useEffect(() => {
    if (product?.image_url) setMainImage(product.image_url);
    if (product?.id) {
        fetchHistory();
    }
  }, [product, variants]); // Trigger when variants load too

  useEffect(() => {
    if (isVariantSheetOpen && selectedVariant && variants.length > 0) {
        const updated = variants.find(v => v.id === selectedVariant.id);
        if (updated && variantEditData) {
            // Only update the reactive parts if they changed, preserving other unsaved edits
            if (variantEditData.quantity_on_hand !== updated.quantity_on_hand) {
                setVariantEditData((prev: any) => prev ? ({ ...prev, quantity_on_hand: updated.quantity_on_hand }) : null);
            }
        }
    }
  }, [variants, isVariantSheetOpen, selectedVariant]);

   const loadLevels = async () => {
       if (!product?.id) return;
       try {
           setLoadingLocations(true);
           // Fetch for BOTH the product AND its variants to see all stock distribution
           const allIds = [product.id, ...variants.map(v => v.id)].filter(Boolean);
           const data = await getLevels(allIds as string[]);
           setLocationLevels(data);
       } catch (err) {
           console.error("Error loading location levels:", err);
       } finally {
           setLoadingLocations(false);
       }
   };

   // Aggregated levels for the main Locations tab
   const aggregatedLevels = useMemo(() => {
       const map = new Map<string, any>();
       locationLevels.forEach((level: InventoryLevel & { location: InventoryLocation }) => {
           if (!map.has(level.location_id)) {
               map.set(level.location_id, {
                   ...level,
                   quantity: 0
               });
           }
           const existing = map.get(level.location_id);
           existing.quantity += level.quantity;
       });
       return Array.from(map.values());
   }, [locationLevels]);

   const unallocatedStock = useMemo(() => {
      const target = isVariantSheetOpen && selectedVariant ? variants.find(v => v.id === selectedVariant.id) || selectedVariant : product;
      if (!target) return 0;
      
      const allocated = locationLevels
          .filter(l => l.product_id === target.id)
          .reduce((sum, l) => sum + (l.quantity || 0), 0);
          
      return Math.max(0, (target.quantity_on_hand || 0) - allocated);
   }, [product, variants, selectedVariant, isVariantSheetOpen, locationLevels]);

  useEffect(() => {
      if (product?.id) loadLevels();
  }, [product?.id, variants]);

  const fetchHistory = async () => {
      if (!product) return;
      try {
          setAuditError(null);
          // Fetch for BOTH the product AND its variants to see the full timeline
          const allIds = [product.id, ...variants.map(v => v.id)].filter(Boolean);
          
          console.log("[ProductHistory] Fetching logs for IDs:", allIds);
          
          // Try fetching without table filter if it fails, but products_inventory is the main one
          const logs = await getLogs('products_inventory', allIds as string[]);
          
          console.log("[ProductHistory] Result logs:", logs?.length || 0);
          setAuditLogs(logs || []);
      } catch (err: any) {
          console.error("Failed to fetch history:", err);
          setAuditError(err.message);
          toast.error("History fetch failed: " + err.message);
      }
  };

  const handleEdit = () => {
    setEditData({ ...product });
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      await updateProduct(id!, editData);
      setIsEditing(false);
      refresh();
      fetchHistory();
      toast.success("Product updated successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to save changes");
    }
  };


  const handleDelete = async () => {
      try {
          await deleteProduct(id!);
          toast.success("Product deleted");
          navigate("/inventory");
      } catch (err: any) {
          toast.error(err.message || "Failed to delete product");
      }
      setDeleteProductDialogOpen(false);
  };

  const handleSelectAll = (checked: boolean) => {
      if (checked) {
          setSelectedVariantIds(variants.map(v => v.id));
      } else {
          setSelectedVariantIds([]);
      }
  };

  const handleSelectVariant = (variantId: string, checked: boolean) => {
      if (checked) {
          setSelectedVariantIds(prev => [...prev, variantId]);
      } else {
          setSelectedVariantIds(prev => prev.filter(id => id !== variantId));
      }
  };

  const handleBulkAssignParams = () => {
      setAssignLocationDialogOpen(true);
      setAssignQuantity(1);
      setTargetLocationId("");
      setAssignNotes("");
  };
  
  const handleSingleAssignParams = (variant: Product) => {
      setSelectedVariantIds([variant.id]);
      setAssignLocationDialogOpen(true);
      setAssignQuantity(1);
      setTargetLocationId("");
      setAssignNotes("");
  }


  const executeAssignLocation = async () => {
      const targets = selectedVariantIds.length > 0 ? selectedVariantIds : (selectedVariant ? [selectedVariant.id] : []);
      
      if (hasVariants && targets.length === 0) {
          toast.error("Products with variants must be assigned at the variant level.");
          return;
      }

      const targetProduct = selectedVariant || product;
      if (!targetProduct) return;

      if (assignQuantity > (targetProduct.quantity_on_hand || 0)) {
          toast.error("Cannot assign more than available stock (" + targetProduct.quantity_on_hand + " units)");
          return;
      }
      if (!targetLocationId) {
          toast.error("Please select a location");
          return;
      }
      
      try {
          let successCount = 0;
          let failCount = 0;

          for (const variantId of targets) {
              try {
                 await distributeStockToLocation(targetLocationId, variantId, assignQuantity, assignNotes);
                 
                 // Log Audit
                 await logAction(
                     'transfer_stock', 
                     'products_inventory', 
                     product!.id, // Log to parent!
                     { 
                         metadata: {
                             variantId: variantId,
                             locationId: targetLocationId, 
                             quantity: assignQuantity, 
                             notes: assignNotes,
                             type: 'assign_unallocated'
                         }
                     }
                 );
                 
                 successCount++;
              } catch (e) {
                 console.error(e);
                 failCount++;
              }
          }
          
          if (successCount > 0) toast.success(`Assigned stock for ${successCount} items.`);
          if (failCount > 0) toast.error(`Failed to assign ${failCount} items.`);
          
          setAssignLocationDialogOpen(false);
          refresh();
          fetchHistory();
      } catch (err: any) {
          toast.error("Assignment failed: " + err.message);
      }
  };


  const openVariantSheet = (variant: Product) => {
      setSelectedVariant(variant);
      setVariantEditData({...variant});
      setIsVariantSheetOpen(true);
  };

  const handleAddVariant = () => {
      setSelectedVariant(null); // Null implies new variant
      setVariantEditData({
          name: "",
          sku: "",
          cost: 0,
          selling_price: 0,
          quantity_on_hand: 0,
          low_stock_threshold: 10
      });
      setIsVariantSheetOpen(true);
  };

  const handleSaveVariant = async () => {
      if (!variantEditData) return;
      
      if (!variantEditData.name?.trim()) {
          toast.error("Please enter a variant name");
          return;
      }
      if (!variantEditData.sku?.trim()) {
          toast.error("Please enter a SKU for this variant");
          return;
      }

      try {
          if (selectedVariant) {
              await updateProduct(selectedVariant.id, variantEditData);
              
              // Audit Logging for Stock
              if (variantEditData.quantity_on_hand !== selectedVariant.quantity_on_hand) {
                  const diff = variantEditData.quantity_on_hand - selectedVariant.quantity_on_hand;
                  await logAction(
                      diff > 0 ? "stock_added_variant" : "stock_removed_variant",
                      "products_inventory", 
                      product!.id, 
                      {
                        reason: "Manual Edit",
                        metadata: {
                            variantId: selectedVariant.id,
                            variantSku: selectedVariant.sku,
                            amount: Math.abs(diff),
                            type: diff > 0 ? 'add' : 'remove'
                        }
                      }
                  );
              }
              
              // Audit Logging for Price
              if (variantEditData.selling_price !== selectedVariant.selling_price) {
                   await logAction(
                      "price_update_variant",
                      "products_inventory",
                      product!.id,
                      {
                          reason: "Manual Edit",
                          metadata: {
                              variantId: selectedVariant.id,
                              variantSku: selectedVariant.sku,
                              oldPrice: selectedVariant.selling_price,
                              newPrice: variantEditData.selling_price
                          }
                      }
                   );
              }

              toast.success("Variant updated");
          } else {
              // Create new variant
             const { error } = await supabase
                .from('products_inventory')
                .insert({
                    ...variantEditData,
                    parent_id: product!.id,
                    category: product!.category, // Inherit category
                    updated_at: new Date().toISOString()
                });
             if (error) throw error;
             toast.success("Variant created");
          }
          setIsVariantSheetOpen(false);
          refresh();
          fetchHistory();
      } catch (err: any) {
          toast.error(err.message || "Failed to save variant");
      }
  };

  const handleDeleteVariant = async () => {
      if (!selectedVariant) return;
      try {
          await deleteProduct(selectedVariant.id);
          setIsVariantSheetOpen(false);
          setDeleteVariantDialogOpen(false);
          refresh();
          toast.success("Variant deleted");
      } catch (err: any) {
          toast.error("Failed to delete variant: " + err.message);
      }
  };

  // --- Image Logic ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !product) return;
    const file = e.target.files[0];
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${product.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('inventory')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('inventory')
        .getPublicUrl(filePath);

      await addProductImage(product.id, publicUrl);
      
      if (!product.image_url) {
          await updateProduct(product.id, { image_url: publicUrl });
      }

      refresh();
      toast.success("Image uploaded");
    } catch (error: any) {
      toast.error('Error uploading image: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSetMainImage = async (url: string) => {
      setMainImage(url);
  };

  const handleDeleteImage = async () => {
      if (!imageToDelete) return;
      try {
          await deleteProductImage(imageToDelete);
          refresh();
          toast.success("Image removed");
      } catch (err: any) {
          toast.error(err.message);
      }
      setDeleteImageDialogOpen(false);
      setImageToDelete(null);
  };

  const openStockDialog = (type: 'add' | 'deduct', defaultId: string = "main") => {
      setStockActionType(type);
      setStockVariantId(defaultId);
      setStockQuantity("");
      setStockReason("");
      setStockLocationId(""); // Reset location
      setStockDialogOpen(true);
  };

  const handleStockAdjustment = async () => {
    const amount = parseInt(stockQuantity);
    if (!amount || amount <= 0) {
        toast.error("Please enter a valid quantity");
        return;
    }
    if (!stockReason.trim()) {
        toast.error("Please enter a reason for this adjustment");
        return;
    }
    if (!stockLocationId) {
        toast.error("Please select a location for this adjustment");
        return;
    }

    const targetId = stockVariantId === 'main' ? product!.id : stockVariantId;

    try {
        const finalAmount = stockActionType === 'add' ? amount : -amount;
        
        await adjustStockAtLocation({
            productId: targetId,
            locationId: stockLocationId,
            amount: finalAmount,
            reason: stockReason
        });

        toast.success(`Stock updated: ${stockActionType === 'add' ? '+' : '-'}${amount}`);
        setStockDialogOpen(false);
        refresh();
        loadLevels();
        fetchHistory();
    } catch (err: any) {
        console.error("Stock update failed:", err);
        toast.error(err.message || "Failed to update stock");
    }
  };

  if (loading) return (
    <div className="space-y-6 container py-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Skeleton className="h-[400px] md:col-span-2" />
        <Skeleton className="h-[400px]" />
      </div>
    </div>
  );

  if (error || !product) return (
    <div className="flex flex-col items-center justify-center h-[600px] gap-4">
      <Package className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-xl font-bold">Product not found</h2>
      <Button asChild variant="outline">
        <Link to="/inventory">Back to Inventory</Link>
      </Button>
    </div>
  );

  const hasVariants = variants.length > 0;
  const lowStockVariants = variants.filter(v => v.quantity_on_hand <= (v.low_stock_threshold || 10));
  const isMasterLowStock = !hasVariants && product.quantity_on_hand <= (product.low_stock_threshold || 10);
  const anyLowStock = isMasterLowStock || lowStockVariants.length > 0;
  
  const costRange = hasVariants
    ? { min: Math.min(...variants.map(v => v.cost || 0)), max: Math.max(...variants.map(v => v.cost || 0)) }
    : { min: product.cost || 0, max: product.cost || 0 };

  const priceRange = hasVariants
    ? { min: Math.min(...variants.map(v => v.selling_price || 0)), max: Math.max(...variants.map(v => v.selling_price || 0)) }
    : { min: product.selling_price || 0, max: product.selling_price || 0 };

  const displayCost = costRange.min === costRange.max 
    ? `$${costRange.min.toFixed(2)}` 
    : `$${costRange.min.toFixed(2)} - $${costRange.max.toFixed(2)}`;

  const displayPrice = priceRange.min === priceRange.max 
    ? `$${priceRange.min.toFixed(2)}` 
    : `$${priceRange.min.toFixed(2)} - $${priceRange.max.toFixed(2)}`;


  

  
  
  const isDirty = editData && (
      editData.name.trim() !== "" && editData.sku.trim() !== "" &&
      (
          editData.name !== product.name ||
          editData.sku !== product.sku ||
          editData.low_stock_threshold !== product.low_stock_threshold
      )
  );
  const isVariantDirty = variantEditData && (
      (!selectedVariant ? (variantEditData.name.trim() !== "" && variantEditData.sku.trim() !== "") : (
          variantEditData.name !== selectedVariant.name ||
          variantEditData.sku !== selectedVariant.sku ||
          variantEditData.cost !== (selectedVariant.cost || 0) ||
          variantEditData.selling_price !== (selectedVariant.selling_price || 0) ||
          variantEditData.low_stock_threshold !== (selectedVariant.low_stock_threshold || 0) ||
          variantEditData.image_url !== (selectedVariant.image_url || null)
      ))
  );

  const totalCost = hasVariants 
    ? variants.reduce((sum, v) => sum + ((v.quantity_on_hand || 0) * (v.cost || 0)), 0)
    : product.quantity_on_hand * (product.cost || 0);

  const totalRevenue = hasVariants
    ? variants.reduce((sum, v) => sum + ((v.quantity_on_hand || 0) * (v.selling_price || 0)), 0)
    : product.quantity_on_hand * (product.selling_price || 0);


  const allImages = (product as any).images || []; 

  return (
    <div className="container py-8 max-w-7xl space-y-8 animate-in fade-in duration-500 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 text-muted-foreground hover:text-foreground">
            <Link to="/inventory">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Inventory
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            {isEditing ? (
                <div className="flex flex-col gap-2 w-full max-w-md">
                    <Input 
                        value={editData.name} 
                        onChange={e => setEditData({...editData, name: e.target.value})}
                        className="text-2xl font-black bg-muted/20 border-primary/20"
                        placeholder="Product Name"
                    />
                    <Input 
                        value={editData.sku} 
                        onChange={e => setEditData({...editData, sku: e.target.value})}
                        className="font-mono text-sm bg-muted/10 border-primary/10 uppercase"
                        placeholder="SKU"
                    />
                    {!hasVariants && (
                        <div className="flex items-center gap-2 mt-1">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">Stock Threshold</Label>
                            <Input 
                                type="number"
                                value={editData.low_stock_threshold} 
                                onChange={e => setEditData({...editData, low_stock_threshold: parseInt(e.target.value)})}
                                className="h-7 w-20 text-xs font-bold"
                            />
                        </div>
                    )}
                    {hasVariants && (
                        <p className="text-[10px] text-muted-foreground font-black uppercase italic opacity-60">
                           Threshold managed per variant
                        </p>
                    )}
                </div>
            ) : (
                <>
                    <h1 className="text-4xl font-black tracking-tighter text-foreground">
                        {product.name}
                    </h1>
                    <Badge variant={anyLowStock ? "destructive" : "secondary"} className="h-6 font-bold uppercase tracking-wider text-[10px]">
                        {anyLowStock ? "Low Stock" : "In Stock"}
                    </Badge>
                </>
            )}
          </div>
          {!isEditing && <p className="text-lg text-muted-foreground font-mono">SKU: {product.sku}</p>}
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)} className="gap-2 font-bold uppercase text-xs h-10">
                <X className="h-4 w-4" /> Cancel
              </Button>
              <Button onClick={handleSave} disabled={!isDirty} className="gap-2 font-bold uppercase text-xs h-10 shadow-lg shadow-primary/20">
                <Save className="h-4 w-4" /> Save Changes
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleEdit} className="gap-2 font-bold uppercase text-xs h-10 bg-card">
                <Edit3 className="h-4 w-4" /> Edit Product
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-10 w-10 border-primary/20 hover:bg-primary/5 text-primary"
                    title="Copy Product Link"
                  >
                    <LinkIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[180px]">
                  <DropdownMenuItem 
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      toast.success("App URL copied to clipboard");
                    }}
                    className="text-xs font-semibold cursor-pointer"
                  >
                    App URL
                  </DropdownMenuItem>
                  {product.sku && (
                      <DropdownMenuItem 
                        onClick={() => {
                            let storeName = "your-store";
                            if (settings?.myshopify_url) {
                                try {
                                    const urlObj = new URL(settings.myshopify_url.startsWith('http') ? settings.myshopify_url : `https://${settings.myshopify_url}`);
                                    storeName = urlObj.hostname.split('.')[0];
                                } catch (e) {
                                    storeName = settings.myshopify_url.replace('.myshopify.com', '');
                                }
                            }
                            const url = `https://admin.shopify.com/store/${storeName}/products?query=${product.sku}`;
                            navigator.clipboard.writeText(url);
                            toast.success("Shopify Admin URL copied");
                        }}
                        className="text-xs font-semibold cursor-pointer"
                      >
                        Shopify Admin URL
                      </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="destructive" onClick={() => setDeleteProductDialogOpen(true)} className="gap-2 font-bold uppercase text-xs h-10 opacity-80 hover:opacity-100">
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </>
          )}
        </div>
      </div>
      
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
           {/* Summary Stats & Adjustments */}
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="bg-primary/5 border-none shadow-none text-primary flex flex-col justify-between">
                <CardContent className="pt-6">
                   <div className="flex items-center justify-between mb-2">
                      <Package className="h-5 w-5" />
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-60 text-foreground">Stock Level</span>
                   </div>
                   <div className="text-3xl font-black">
                     {variants.length > 0 
                        ? variants.reduce((sum, v) => sum + (v.quantity_on_hand || 0), 0) 
                        : product.quantity_on_hand}
                   </div>
                   <p className="text-xs font-semibold opacity-70 mt-1">
                     {variants.length > 0 ? "Total across variants" : "Units on hand"}
                   </p>
                </CardContent>
                  <div className="px-4 pb-4 flex gap-2">
                   <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-8 w-full bg-background/50 border-primary/20 hover:bg-primary/10 font-bold"
                      onClick={() => openStockDialog('deduct')}
                   >
                     - Deduct
                   </Button>
                   <Button 
                      size="sm" 
                      className="h-8 w-full font-bold"
                      onClick={() => openStockDialog('add')}
                   >
                     + Add
                   </Button>
                </div>
              </Card>

              <Card className="bg-emerald-500/5 border-none shadow-none text-emerald-600 dark:text-emerald-400">
                <CardContent className="pt-6">
                   <div className="flex items-center justify-between mb-2">
                      <Banknote className="h-5 w-5" />
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-60 text-foreground">Unit Cost</span>
                   </div>
                   <div className="text-3xl font-black">{displayCost}</div>
                   <p className="text-xs font-semibold opacity-70 mt-1">Cost range across variants</p>
                </CardContent>
              </Card>

              <Card className="bg-blue-500/5 border-none shadow-none text-blue-600 dark:text-blue-400">
                <CardContent className="pt-6">
                   <div className="flex items-center justify-between mb-2">
                      <TrendingUp className="h-5 w-5" />
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-60 text-foreground">Selling Price</span>
                   </div>
                   <div className="text-3xl font-black">{displayPrice}</div>
                   <p className="text-xs font-semibold opacity-70 mt-1">Price range across variants</p>
                </CardContent>
              </Card>
           
            </div>

            {/* Total Value Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="bg-emerald-500/10 border-emerald-500/20 shadow-none text-emerald-600 dark:text-emerald-400">
                <CardContent className="pt-6">
                   <div className="flex items-center justify-between mb-2">
                      <Banknote className="h-5 w-5" />
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-60 text-foreground">Total Stock Cost</span>
                   </div>
                   <div className="text-3xl font-black">${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                   <p className="text-xs font-semibold opacity-70 mt-1">Total investment across stock</p>
                </CardContent>
              </Card>

              <Card className="bg-blue-500/10 border-blue-500/20 shadow-none text-blue-600 dark:text-blue-400">
                <CardContent className="pt-6">
                   <div className="flex items-center justify-between mb-2">
                      <TrendingUp className="h-5 w-5" />
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-60 text-foreground">Total Potential Revenue</span>
                   </div>
                   <div className="text-3xl font-black">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                   <p className="text-xs font-semibold opacity-70 mt-1">Total revenue at full liquidation</p>
                </CardContent>
              </Card>
            </div>

           
           <Tabs defaultValue={product.parent_id ? "history" : "variants"} className="w-full">
               <TabsList className="bg-muted/20 p-1 rounded-xl">
                  {!product.parent_id && (
                     <TabsTrigger value="variants" className="rounded-lg font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">Variants</TabsTrigger>
                  )}
                  <TabsTrigger value="locations" className="rounded-lg font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">Locations</TabsTrigger>
                  <TabsTrigger value="history" className="rounded-lg font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">History</TabsTrigger>
               </TabsList>

              {!product.parent_id && (
                  <TabsContent value="variants" className="pt-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-black tracking-tight">Product Variants</h3>
                            <p className="text-sm text-muted-foreground">Manage size, color, and other variations.</p>
                        </div>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 gap-2 font-bold uppercase tracking-wider text-xs"
                            onClick={handleAddVariant}
                        >
                            <Plus className="h-3.5 w-3.5" /> New Variant
                        </Button>
                    </div>

                    {/* Bulk Action Bar */}
                    {selectedVariantIds.length > 0 && (
                        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center justify-between animate-in slide-in-from-top-2">
                            <div className="flex items-center gap-3">
                                <CheckSquare className="h-5 w-5 text-primary" />
                                <span className="font-bold text-sm text-primary">
                                    {selectedVariantIds.length} variation{selectedVariantIds.length !== 1 ? 's' : ''} selected
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-8 bg-background border-primary/20 hover:border-primary/50 text-xs font-bold uppercase tracking-wider"
                                    onClick={handleBulkAssignParams}
                                >
                                    <MapPin className="h-3.5 w-3.5 mr-2" />
                                    Assign to Location
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="rounded-2xl border-none bg-card shadow-[0_4px_30px_rgba(0,0,0,0.05)] overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted/10 h-12 border-b border-muted/10">
                          <TableRow className="hover:bg-transparent border-none">
                              <TableHead className="w-[50px] pl-6">
                                 <Checkbox 
                                    checked={variants.length > 0 && selectedVariantIds.length === variants.length}
                                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                 />
                              </TableHead>
                              <TableHead className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">SKU</TableHead>
                              <TableHead className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Name</TableHead>
                              <TableHead className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Stock</TableHead>
                              <TableHead className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Price</TableHead>
                              <TableHead className="text-right font-black text-[10px] uppercase tracking-widest text-muted-foreground pr-6">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {variants.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-16 text-muted-foreground font-black uppercase text-[10px] tracking-widest opacity-30">No variations defined .</TableCell>
                            </TableRow>
                          ) : (
                            variants.map((v: Product) => (
                              <TableRow key={v.id} className="hover:bg-muted/[0.08] cursor-pointer group transition-colors" onClick={() => openVariantSheet(v)}>
                                 <TableCell className="pl-6" onClick={(e) => e.stopPropagation()}>
                                    <Checkbox 
                                        checked={selectedVariantIds.includes(v.id)}
                                        onCheckedChange={(checked) => handleSelectVariant(v.id, !!checked)}
                                    />
                                 </TableCell>
                                 <TableCell className="px-6 py-4 font-mono text-xs font-black text-primary opacity-80 group-hover:opacity-100 transition-opacity uppercase">{v.sku}</TableCell>
                                 <TableCell className="font-black text-sm tracking-tight">{v.name}</TableCell>
                                 <TableCell>
                                   <Badge variant={v.quantity_on_hand <= (v.low_stock_threshold || 10) ? "destructive" : "outline"} className="font-black h-6 border-none bg-muted/50 text-foreground">
                                     {v.quantity_on_hand}
                                   </Badge>
                                 </TableCell>
                                 <TableCell className="font-black tracking-tighter text-sm opacity-80">${v.selling_price?.toFixed(2)}</TableCell>
                                 <TableCell className="text-right pr-6">
                                   <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                                     <Edit3 className="h-4 w-4" />
                                   </Button>
                                   <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-8 w-8 p-0 rounded-full text-destructive hover:bg-destructive hover:text-white transition-all ml-1"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedVariant(v);
                                        setDeleteVariantDialogOpen(true);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                   </Button>
                                 </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
              )}

              <TabsContent value="locations" className="pt-6 space-y-6">
                  <div className="flex items-center justify-between">
                      <div>
                          <h3 className="text-xl font-black tracking-tight">Stock Locations</h3>
                          <p className="text-sm text-muted-foreground">Distribution of this item across your network.</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={hasVariants}
                        className="gap-2 font-bold uppercase tracking-wider text-xs h-8"
                        onClick={() => { setTransferInitialSource("unallocated"); setIsTransferOpen(true); }}
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" /> {hasVariants ? "Managed via Variants" : "Transfer Stock"}
                      </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {/* Unallocated Card */}
                      <Card className="rounded-[2rem] border-none bg-primary/5 shadow-sm ring-1 ring-primary/10 overflow-hidden">
                          <CardHeader className="pb-2 flex flex-row items-center justify-between">
                              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Unallocated</CardTitle>
                              <Package className="h-4 w-4 text-primary opacity-40" />
                          </CardHeader>
                          <CardContent>
                              <div className="text-3xl font-black tracking-tighter">
                                  {Math.max(0, (product.quantity_on_hand || 0) - locationLevels.reduce((sum, l) => sum + l.quantity, 0))}
                              </div>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">
                                {hasVariants ? "Total across variations" : "Available to assign"}
                              </p>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                disabled={hasVariants}
                                className="w-full mt-4 h-9 rounded-xl font-black uppercase text-[9px] tracking-widest gap-2 bg-background hover:bg-primary hover:text-primary-foreground"
                                onClick={() => { setTransferInitialSource("unallocated"); setIsTransferOpen(true); }}
                              >
                                {hasVariants ? <CheckSquare className="h-3 w-3" /> : <ArrowRightLeft className="h-3 w-3" />}
                                {hasVariants ? "Managed via variants" : "Move"}
                              </Button>
                          </CardContent>
                      </Card>

                      {/* Location Levels */}
                      {loadingLocations ? (
                          Array(2).fill(0).map((_, i) => (
                              <Card key={i} className="rounded-[2rem] h-40 animate-pulse bg-muted/20 border-none" />
                          ))
                       ) : aggregatedLevels.length === 0 ? (
                          <div className="md:col-span-1 lg:col-span-2 h-40 flex flex-col items-center justify-center border-2 border-dashed rounded-[2rem] opacity-30 gap-2">
                              <MapPin className="h-8 w-8" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-center">No stock allocated to any specific location</span>
                          </div>
                      ) : (
                          aggregatedLevels.map(level => (
                              <Card key={level.id} className="rounded-[2rem] border-none shadow-sm ring-1 ring-muted/20 hover:ring-primary/30 transition-all group overflow-hidden bg-card">
                                  <CardHeader className="pb-2 flex flex-row items-start justify-between">
                                      <div className="space-y-1">
                                          <CardTitle className="text-sm font-black uppercase tracking-tight truncate max-w-[120px]">{level.location?.name}</CardTitle>
                                          <div className="flex items-center gap-1 opacity-50">
                                              <MapPin className="h-3 w-3" />
                                              <span className="text-[9px] font-bold uppercase truncate max-w-[100px]">{level.location?.details || 'Main Store'}</span>
                                          </div>
                                      </div>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => navigate(`/locations/${level.location_id}`)}
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </Button>
                                  </CardHeader>
                                  <CardContent>
                                      <div className={`text-3xl font-black tracking-tighter ${level.quantity <= (product.low_stock_threshold || 10) ? "text-rose-500" : "text-foreground"}`}>
                                          {level.quantity}
                                      </div>
                                      <div className="flex items-center justify-between mt-4 gap-2">
                                          <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="flex-1 h-9 rounded-xl font-black uppercase text-[9px] tracking-widest gap-2 bg-muted/30 hover:bg-primary hover:text-primary-foreground"
                                            onClick={() => { setTransferInitialSource(level.location_id); setIsTransferOpen(true); }}
                                          >
                                            <ArrowRightLeft className="h-3 w-3" /> Transfer Out
                                          </Button>
                                      </div>
                                  </CardContent>
                              </Card>
                          ))
                      )}
                  </div>
              </TabsContent>

                            <TabsContent value="history" className="pt-6 space-y-6">
                  <div className="flex items-center justify-between">
                     <div>
                        <h3 className="text-xl font-black tracking-tight">Audit History</h3>
                        <p className="text-sm text-muted-foreground">Record of changes to this product.</p>
                     </div>
                     <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={fetchHistory}
                        className="gap-2"
                     >
                        <History className="h-4 w-4" />
                        Refresh
                     </Button>
                  </div>
                  
                  <div className="space-y-4">
                      {auditError && (
                          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs">
                              <p className="font-bold mb-1">Error loading history:</p>
                              <code>{auditError}</code>
                          </div>
                      )}

                      {auditLogs.length === 0 && !auditError ? (
                          <div className="p-12 text-center border-2 border-dashed rounded-2xl opacity-50">
                              <History className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">No history recorded yet</p>
                          </div>
                      ) : (
                          <div className="relative space-y-4 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-primary/20 before:via-muted/20 before:to-transparent">
                              {auditLogs.map((log) => {
                                  // Determine action style
                                  const isAdjustment = log.action === "adjust_stock" || log.action === "transfer_stock";
                                  const isUpdate = log.action.includes("UPDATE") || log.action.includes("price");
                                  
                                  // Extract data for comparison
                                  const oldData = log.old_data as any;
                                  const newData = (log.new_data || log.metadata) as any;
                                  
                                  return (
                                      <div key={log.id} className="relative flex items-start gap-6 group">
                                          {/* Timeline Marker */}
                                          <div className={`mt-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border shadow-lg ring-4 ring-background transition-all group-hover:scale-110 z-10 ${
                                              isAdjustment ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" : 
                                              isUpdate ? "bg-primary/10 border-primary/30 text-primary" : 
                                              "bg-muted border-muted-foreground/20 text-muted-foreground"
                                          }`}>
                                              {isAdjustment ? <TrendingUp className="h-5 w-5" /> : 
                                               isUpdate ? <Edit3 className="h-5 w-5" /> : 
                                               <History className="h-5 w-5" />}
                                          </div>

                                          {/* Content Card */}
                                          <Card className="flex-1 bg-card/40 border-muted/50 shadow-sm hover:shadow-md transition-all hover:bg-card/60">
                                              <CardContent className="p-4 space-y-3">
                                                  {/* Header */}
                                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-muted/20 pb-2 mb-2">
                                                      <div className="flex items-center gap-2">
                                                          <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-wider px-2 py-0">
                                                              {log.action.replace(/_/g, " ")}
                                                          </Badge>
                                                          <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1.5">
                                                              {new Date(log.created_at).toLocaleDateString(undefined, { 
                                                                  month: "short", 
                                                                  day: "numeric", 
                                                                  hour: "2-digit", 
                                                                  minute: "2-digit" 
                                                              })}
                                                          </span>
                                                      </div>
                                                       <div className="flex items-center gap-3">
                                                           <div className="flex flex-col items-end">
                                                               <span className="text-[10px] font-black uppercase tracking-tight text-foreground/80">
                                                                   {log.profiles?.full_name || (log.user_id ? "User" : "System")}
                                                               </span>
                                                               {log.profiles?.role && (
                                                                   <span className={`text-[8px] font-bold uppercase tracking-[0.15em] opacity-40 leading-none ${
                                                                       log.profiles.role === 'admin' ? 'text-amber-500 opacity-100' : ''
                                                                   }`}>
                                                                       {log.profiles.role}
                                                                   </span>
                                                               )}
                                                           </div>
                                                           <div className="h-8 w-8 rounded-full bg-muted/50 border border-primary/5 flex items-center justify-center text-[10px] font-black uppercase text-muted-foreground/40">
                                                               {(log.profiles?.full_name || "U")[0]}
                                                           </div>
                                                       </div>
                                                   </div>

                                                  {/* Variant Info */}
                                                  {log.record_id !== product.id && (
                                                      <div className="flex items-center gap-2 px-2 py-1 bg-primary/5 border border-primary/10 rounded-lg w-fit">
                                                          <Package className="h-3 w-3 text-primary" />
                                                          <span className="text-[10px] font-bold text-primary uppercase">
                                                              {variants.find(v => v.id === log.record_id)?.name || "Variant History"}
                                                          </span>
                                                      </div>
                                                  )}

                                                  {/* Diff Section */}
                                                  <div className="space-y-2">
                                                      {/* Reason/Notes - Primary */}
                                                      {(log.reason || log.metadata?.reason || log.new_data?.reason) && (
                                                          <div className="text-sm font-semibold flex items-baseline gap-2">
                                                              <span className="text-xs text-muted-foreground font-normal">Reason:</span>
                                                              {log.reason || log.metadata?.reason || log.new_data?.reason}
                                                          </div>
                                                      )}

                                                      {/* Structured Changes */}
                                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                                           {/* Quantity Change */}
                                                           {(oldData?.quantity !== undefined || newData?.quantity !== undefined) && (
                                                                <div className="flex flex-col gap-1 p-2 rounded-lg bg-muted/20 border border-muted/30">
                                                                    <span className="text-[9px] uppercase font-black opacity-50">Stock Change</span>
                                                                    <div className="flex items-center gap-3 font-mono">
                                                                        <span className="line-through opacity-40">{oldData?.quantity ?? "?"}</span>
                                                                        <span className="text-muted-foreground/30">â†’</span>
                                                                        <span className={`font-bold ${
                                                                            (newData?.quantity || 0) >= (oldData?.quantity || 0) ? "text-emerald-500" : "text-red-500"
                                                                        }`}>
                                                                            {newData?.quantity ?? "?"}
                                                                        </span>
                                                                        {oldData?.quantity !== undefined && newData?.quantity !== undefined && (
                                                                            <Badge variant="outline" className={`ml-auto text-[9px] pointer-events-none ${
                                                                                newData.quantity >= oldData.quantity ? "bg-emerald-500/5 text-emerald-500 border-emerald-500/20" : "bg-red-500/5 text-red-500 border-red-500/20"
                                                                            }`}>
                                                                                {newData.quantity >= oldData.quantity ? "+" : ""}{newData.quantity - oldData.quantity}
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                           )}

                                                           {/* Price Change */}
                                                           {(newData?.oldPrice !== undefined || newData?.newPrice !== undefined) && (
                                                                <div className="flex flex-col gap-1 p-2 rounded-lg bg-muted/20 border border-muted/30">
                                                                    <span className="text-[9px] uppercase font-black opacity-50">Price Update</span>
                                                                    <div className="flex items-center gap-3 font-mono">
                                                                        <span className="opacity-40">${newData?.oldPrice ?? "?"}</span>
                                                                        <span className="text-muted-foreground/30">â†’</span>
                                                                        <span className="text-primary font-bold">${newData?.newPrice ?? "?"}</span>
                                                                    </div>
                                                                </div>
                                                           )}

                                                           {/* Location Info */}
                                                           {(newData?.locationId || newData?.type === "assign_unallocated") && (
                                                                <div className="flex flex-col gap-1 p-2 rounded-lg bg-muted/20 border border-muted/30 col-span-full">
                                                                    <span className="text-[9px] uppercase font-black opacity-50">Target Location</span>
                                                                    <div className="flex items-center gap-2">
                                                                        <MapPin className="h-3 w-3 text-muted-foreground" />
                                                                         <span className="font-bold">
                                                                             {allLocations.find((l: InventoryLocation) => l.id === newData?.locationId)?.name || "Unallocated Stock"}
                                                                         </span>
                                                                    </div>
                                                                </div>
                                                           )}
                                                      </div>
                                                  </div>

                                                  {/* Footer Notes */}
                                                  {(log.metadata?.notes || log.new_data?.notes) && (
                                                      <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/10 p-2 rounded-md italic border-t border-muted/10 mt-2">
                                                          <CheckSquare className="h-3 w-3 mt-0.5 shrink-0" />
                                                          <span>{log.metadata?.notes || log.new_data?.notes}</span>
                                                      </div>
                                                  )}
                                              </CardContent>
                                          </Card>
                                      </div>
                                  );
                              })}
                          </div>
                      )}
                  </div>
              </TabsContent>
           </Tabs>
        </div>

        {/* Sidebar - Image Gallery */}
        <div className="space-y-6">
          <Card className="overflow-hidden border-none shadow-[0_20px_50px_rgba(0,0,0,0.1)] bg-card rounded-[2.5rem] ring-1 ring-primary/5">
             <CardHeader className="bg-primary/5 pt-4 pb-4 text-primary relative overflow-hidden">
                <div className="flex items-center gap-3 mb-1">
                   <div className="h-8 w-8 rounded-xl bg-background/50 backdrop-blur-md flex items-center justify-center shadow-sm">
                      <ImageIcon className="h-4 w-4 text-primary" />
                    </div>
                    <CardTitle className="text-xs font-black uppercase tracking-[0.25em] opacity-80">Gallery / Assets</CardTitle>
                 </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 px-6 pb-6 flex flex-col items-center">
                 {/* Main Image */}
                 <div className="relative h-36 w-36 mx-auto rounded-[2rem] overflow-hidden bg-muted/20 border-2 border-dashed border-muted/30 flex items-center justify-center group shadow-inner">
                    {mainImage ? (
                        <img src={mainImage} alt={product.name} className="h-full w-full object-contain p-2" />
                    ) : (
                        <div className="text-center opacity-40 group-hover:opacity-60 transition-opacity">
                            <ImageIcon className="h-10 w-10 mx-auto mb-2" />
                            <span className="text-[10px] font-black uppercase tracking-widest">No Image</span>
                        </div>
                    )}
                    {uploading && (
                        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    )}
                 </div>

                 {/* Thumbnails */}
                 <ScrollArea className="w-full whitespace-nowrap pb-2">
                     <div className="flex w-max space-x-2">
                         {/* Always show product.image_url as first if exists */}
                         {product.image_url && (
                             <div className="relative group">
                                 <div 
                                    className={'h-16 w-16 rounded-xl overflow-hidden cursor-pointer border-2 transition-all ' + (mainImage === product.image_url ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100')}
                                    onClick={() => handleSetMainImage(product.image_url!)}
                                 >
                                     <img src={product.image_url} className="h-full w-full object-cover" />
                                 </div>
                                 <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button 
                                      variant="destructive" 
                                      size="sm" 
                                      className="h-5 w-5 rounded-full p-0" 
                                      onClick={async (e) => { 
                                        e.stopPropagation(); 
                                        if (confirm("Clear main product image?")) {
                                            await updateProduct(product.id, { image_url: undefined });
                                            setMainImage(null);
                                            refresh();
                                        }
                                      }}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                 </div>
                             </div>
                         )}
                         {allImages.map((img: any) => (
                             <div key={img.id} className="relative group">
                                 <div 
                                    className={`h-16 w-16 rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${mainImage === img.url ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                    onClick={() => handleSetMainImage(img.url)}
                                 >
                                     <img src={img.url} className="h-full w-full object-cover" />
                                 </div>
                                 <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button 
                                      variant="destructive" 
                                      size="sm" 
                                      className="h-5 w-5 rounded-full p-0" 
                                      onClick={(e) => { 
                                        e.stopPropagation(); 
                                        setImageToDelete(img.id);
                                        setDeleteImageDialogOpen(true);
                                      }}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                 </div>
                             </div>
                         ))}
                     </div>
                 </ScrollArea>
                 
                 <div className="mt-4 w-full">
                     <Label htmlFor="image-upload" className="block w-full cursor-pointer">
                         <div className="flex items-center justify-center w-full h-12 rounded-xl border-2 border-dashed border-muted/30 hover:border-primary/50 hover:bg-primary/5 transition-all gap-2 text-muted-foreground hover:text-primary">
                            <Upload className="h-4 w-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Upload New Asset</span>
                         </div>
                         <Input 
                             id="image-upload" 
                             type="file" 
                             className="hidden" 
                             accept="image/*" 
                             onChange={handleImageUpload} 
                             disabled={uploading}
                         />
                     </Label>
                 </div>
                 
              </CardContent>
           </Card>

           {/* System Alert Card Only (Shopify Bridge Removed) */}
           <Card className="bg-rose-500/5 border-none shadow-none overflow-hidden rounded-[2.5rem]">
              <CardContent className="pt-8 space-y-4 px-8 pb-8">
                 <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-rose-500/10 flex items-center justify-center shadow-inner">
                       <AlertTriangle className="h-6 w-6 text-rose-500" />
                    </div>
                    <div>
                       <h4 className="text-sm font-black uppercase tracking-widest text-rose-500">System Alert</h4>
                       <p className="text-[9px] font-black uppercase tracking-widest text-rose-500/60 opacity-80">Inventory Violation</p>
                    </div>
                 </div>
                 
                 {anyLowStock ? (
                    <div className="space-y-3">
                       {isMasterLowStock && (
                          <div className="p-4 bg-rose-500/10 rounded-2xl text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-start gap-3 border border-rose-500/20">
                             <div className="h-1.5 w-1.5 rounded-full bg-rose-500 mt-1 shrink-0 animate-ping" />
                             <span>CRITICAL: Master product is below safety threshold ({product.low_stock_threshold || 10} units). Restock recommended.</span>
                          </div>
                       )}
                       {lowStockVariants.map(v => (
                          <div key={v.id} className="p-4 bg-rose-500/10 rounded-2xl text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-start gap-3 border border-rose-500/20">
                             <div className="h-1.5 w-1.5 rounded-full bg-rose-500 mt-1 shrink-0 animate-ping" />
                             <span>VARIANT ALERT: {v.name} ({v.sku}) is at {v.quantity_on_hand} units. Safety threshold: {v.low_stock_threshold || 10}.</span>
                          </div>
                       ))}
                    </div>
                  ) : (
                    <p className="text-xs font-medium text-muted-foreground/70 px-2 leading-relaxed italic opacity-80">Catalog health levels are currently within safe operational parameters for this master cluster.</p>
                  )}
              </CardContent>
           </Card>
        </div>

       {/* --- Dialogs --- */}
       <ConfirmationDialog 
         open={deleteProductDialogOpen} 
         onOpenChange={setDeleteProductDialogOpen}
         title="Delete Product"
         description="Are you sure you want to delete this product? This action cannot be undone."
         onConfirm={handleDelete}
         variant="destructive"
         confirmText="Delete Permanently"
       />

       <ConfirmationDialog 
         open={deleteVariantDialogOpen} 
         onOpenChange={setDeleteVariantDialogOpen}
         title="Delete Variant"
         description="Are you sure you want to delete this variant? Stock history will be removed."
         onConfirm={handleDeleteVariant}
         variant="destructive"
         confirmText="Delete Variant"
       />

       <ConfirmationDialog 
         open={deleteImageDialogOpen} 
         onOpenChange={setDeleteImageDialogOpen}
         title="Remove Asset"
         description="Are you sure you want to remove this image from the gallery?"
         onConfirm={handleDeleteImage}
         variant="destructive"
         confirmText="Remove Image"
       />
       
       {/* Stock Adjustment Dialog (Custom) */}
        <Dialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
             <DialogContent className="sm:max-w-md rounded-[2.5rem] bg-background/95 backdrop-blur-2xl border-primary/5 shadow-2xl p-0 overflow-hidden">
                 <div className="p-8 pb-4">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">
                            {stockActionType === 'add' ? "Receive Stock" : "Deduct Stock"}
                        </DialogTitle>
                        <DialogDescription className="text-[11px] font-bold uppercase tracking-widest opacity-60">
                            {stockActionType === 'add' ? "Add units to inventory. This will increase the quantity on hand." : "Remove units from inventory for damages or corrections."}
                        </DialogDescription>
                    </DialogHeader>
                 </div>
                 
                 <div className="px-8 space-y-5">
                      {variants.length > 0 && (
                          <div className="grid gap-2">
                             <Label className="text-[10px] font-black uppercase tracking-widest opacity-70">Select Variant</Label>
                             <Select value={stockVariantId} onValueChange={setStockVariantId}>
                                 <SelectTrigger className="h-12 rounded-2xl bg-muted/40 border-none font-bold text-sm px-4">
                                     <SelectValue placeholder="Target Variant" />
                                 </SelectTrigger>
                                 <SelectContent className="rounded-2xl border-primary/5 shadow-2xl">
                                     {variants.length === 0 && <SelectItem value="main" className="rounded-xl">Main Product (Total)</SelectItem>}
                                     {variants.map(v => (
                                         <SelectItem key={v.id} value={v.id} className="rounded-xl">{v.name} ({v.sku})</SelectItem>
                                     ))}
                                 </SelectContent>
                              </Select>
                          </div>
                      )}

                       <div className="grid gap-2">
                         <Label className="text-[10px] font-black uppercase tracking-widest opacity-70">Location</Label>
                         <Select value={stockLocationId} onValueChange={setStockLocationId}>
                             <SelectTrigger className="h-12 rounded-2xl bg-muted/40 border-none font-bold text-sm px-4">
                                 <SelectValue placeholder="Select Warehouse/Truck" />
                             </SelectTrigger>
                             <SelectContent className="rounded-2xl border-primary/5 shadow-2xl">
                                 {allLocations.map(loc => {
                                     const currentLevel = locationLevels.find(l => l.location_id === loc.id && (stockVariantId === 'main' ? l.product_id === product?.id : l.product_id === stockVariantId));
                                     const locQty = currentLevel?.quantity || 0;
                                     
                                     return (
                                         <SelectItem key={loc.id} value={loc.id} className="rounded-xl">
                                             <div className="flex items-center justify-between w-full gap-8">
                                                 <span className="font-bold">{loc.name}</span>
                                                 <Badge variant="outline" className="text-[9px] font-black bg-primary/5 border-primary/10">
                                                     {locQty} Units
                                                 </Badge>
                                             </div>
                                         </SelectItem>
                                     );
                                 })}
                             </SelectContent>
                         </Select>
                       </div>

                       <div className="grid gap-2">
                          <div className="flex items-center justify-between">
                             <Label className="text-[10px] font-black uppercase tracking-widest opacity-70">Quantity</Label>
                             {stockActionType === 'deduct' && stockLocationId && (
                                 <span className="text-[9px] font-black uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                     Max Available: {locationLevels.find(l => l.location_id === stockLocationId && (stockVariantId === 'main' ? l.product_id === product?.id : l.product_id === stockVariantId))?.quantity || 0}
                                 </span>
                             )}
                          </div>
                          <Input 
                              type="number" 
                              min="1" 
                              placeholder="0" 
                              value={stockQuantity} 
                              onChange={(e) => setStockQuantity(e.target.value)} 
                              className="h-14 rounded-2xl bg-muted/40 border-none font-black text-2xl tracking-tighter px-4 focus-visible:ring-primary/20"
                          />
                       </div>

                       <div className="grid gap-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest opacity-70">Reason for adjustment</Label>
                          <Input 
                              placeholder="e.g. Count Correction, Damage, etc."
                              value={stockReason} 
                              onChange={(e) => setStockReason(e.target.value)} 
                              className="h-12 rounded-2xl bg-muted/40 border-none font-bold text-sm px-4"
                          />
                       </div>
                 </div>
                 
                 <div className="p-8 pt-6 bg-muted/10 flex justify-between items-center mt-6">
                    <Button variant="ghost" onClick={() => setStockDialogOpen(false)} className="h-10 px-4 rounded-xl font-black uppercase tracking-widest text-[10px] opacity-50 hover:opacity-100">Cancel</Button>
                    <Button 
                        onClick={handleStockAdjustment}
                        className="h-12 px-8 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                       Confirm {stockActionType === 'add' ? "Reception" : "Deduction"}
                    </Button>
                 </div>
             </DialogContent>
        </Dialog>

       {/* Assign Location Dialog */}
        <Dialog open={assignLocationDialogOpen} onOpenChange={setAssignLocationDialogOpen}>
             <DialogContent className="sm:max-w-md rounded-[2.5rem] bg-background/95 backdrop-blur-2xl border-primary/5 shadow-2xl p-0 overflow-hidden">
                 <div className="p-8 pb-4">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">Assign Stock to Location</DialogTitle>
                        <DialogDescription className="text-[11px] font-bold uppercase tracking-widest opacity-60">
                            Distribute unallocated stock to a specific warehouse location.
                        </DialogDescription>
                    </DialogHeader>
                 </div>

                 <div className="px-8 space-y-5">
                    <div className="grid gap-2">
                        <Label htmlFor="location" className="text-[10px] font-black uppercase tracking-widest opacity-70">Target Location</Label>
                        <Select onValueChange={setTargetLocationId} value={targetLocationId}>
                            <SelectTrigger className="h-12 rounded-2xl bg-muted/40 border-none font-bold text-sm px-4">
                                <SelectValue placeholder="Select a location" />
                            </SelectTrigger>
                             <SelectContent className="rounded-2xl border-primary/5 shadow-2xl">
                                 {allLocations.map((loc: InventoryLocation) => (
                                     <SelectItem key={loc.id} value={loc.id} className="rounded-xl">
                                         {loc.name}
                                     </SelectItem>
                                 ))}
                             </SelectContent>
                        </Select>
                    </div>
                     <div className="grid gap-2">
                         <Label htmlFor="qty" className="text-[10px] font-black uppercase tracking-widest opacity-70">Quantity to Assign</Label>
                         <Input 
                             id="qty" 
                             type="number" 
                             min={1} 
                             max={unallocatedStock}
                             value={assignQuantity} 
                             onChange={e => setAssignQuantity(Math.min(unallocatedStock, Math.max(0, parseInt(e.target.value) || 0)))} 
                             className="h-14 rounded-2xl bg-muted/40 border-none font-black text-2xl tracking-tighter px-4 focus-visible:ring-primary/20"
                         />
                         <div className="flex items-center justify-between">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                                Max available: <span className="text-primary">{unallocatedStock}</span>
                            </p>
                            {assignQuantity > unallocatedStock && (
                                <span className="text-[9px] text-rose-500 font-black uppercase animate-pulse">Exceeds unallocated</span>
                            )}
                         </div>
                     </div>
                      <div className="grid gap-2">
                         <Label htmlFor="notes" className="text-[10px] font-black uppercase tracking-widest opacity-70">Notes (Optional)</Label>
                         <Textarea 
                             id="notes"
                             placeholder="e.g. Shelf B, Bin 4"
                             value={assignNotes}
                             onChange={(e) => setAssignNotes(e.target.value)}
                             className="min-h-[80px] rounded-2xl bg-muted/40 border-none font-bold text-sm px-4 py-3"
                         />
                     </div>
                </div>

                <div className="p-8 pt-6 bg-muted/10 flex justify-between items-center mt-6">
                    <Button variant="ghost" onClick={() => setAssignLocationDialogOpen(false)} className="h-10 px-4 rounded-xl font-black uppercase tracking-widest text-[10px] opacity-50 hover:opacity-100">Cancel</Button>
                    <Button 
                        onClick={executeAssignLocation}
                        className="h-12 px-8 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        Confirm Assignment
                    </Button>
                </div>
            </DialogContent>
       </Dialog>

       {/* Variant Edit Sheet */}
       <Sheet open={isVariantSheetOpen} onOpenChange={setIsVariantSheetOpen}>
           <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0 gap-0 h-full">
               <div className="p-6 border-b">
                   <SheetHeader>
                       <SheetTitle className="text-2xl font-black uppercase italic tracking-tighter">Edit Variant</SheetTitle>
                       <SheetDescription>Update specifications for this product variation.</SheetDescription>
                   </SheetHeader>
               </div>
               
               <ScrollArea className="flex-1 p-6">
                 {variantEditData && (
                     <div className="grid gap-6 pb-6">
                         <div className="space-y-4">
                             <h4 className="font-black uppercase text-xs tracking-widest opacity-50 border-b pb-2">Basic Info</h4>
                             <div className="grid gap-2">
                                 <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Name / Label</Label>
                                 <Input value={variantEditData.name} onChange={e => setVariantEditData({...variantEditData, name: e.target.value})} className="font-bold" />
                             </div>
                             <div className="grid gap-2">
                                 <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">SKU (Stock Keeping Unit)</Label>
                                 <Input value={variantEditData.sku} onChange={e => setVariantEditData({...variantEditData, sku: e.target.value})} className="font-mono uppercase" />
                             </div>
                         </div>

                         
                          <div className="space-y-4">
                              <h4 className="font-black uppercase text-xs tracking-widest opacity-50 border-b pb-2">Variant Image</h4>
                              <div className="flex flex-wrap gap-2 pt-2">
                                  {allImages.map((img: any) => (
                                      <div 
                                          key={img.id} 
                                          className={'h-12 w-12 rounded-lg overflow-hidden cursor-pointer border-2 transition-all ' + (variantEditData.image_url === img.url ? 'border-primary scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100')}
                                          onClick={() => setVariantEditData({...variantEditData, image_url: img.url})}
                                      >
                                          <img src={img.url} className="h-full w-full object-cover" />
                                      </div>
                                  ))}
                                  {product.image_url && (
                                      <div 
                                          className={'h-12 w-12 rounded-lg overflow-hidden cursor-pointer border-2 transition-all ' + (variantEditData.image_url === product.image_url ? 'border-primary scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100')}
                                          onClick={() => setVariantEditData({...variantEditData, image_url: product.image_url})}
                                      >
                                          <img src={product.image_url} className="h-full w-full object-cover" />
                                      </div>
                                  )}
                              </div>
                              <p className="text-[10px] text-muted-foreground font-bold uppercase opacity-50">Select an image from the product gallery.</p>
                          </div>
<div className="space-y-4">
                             <h4 className="font-black uppercase text-xs tracking-widest opacity-50 border-b pb-2">Financials</h4>
                             <div className="grid grid-cols-2 gap-4">
                                 <div className="grid gap-2">
                                     <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cost</Label>
                                     <Input 
                                        type="number" 
                                        step="0.01" 
                                        value={variantEditData.cost} 
                                        onChange={e => setVariantEditData({...variantEditData, cost: parseFloat(e.target.value)})} 
                                     />
                                 </div>
                                 <div className="grid gap-2">
                                     <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Selling Price</Label>
                                     <Input 
                                        type="number" 
                                        step="0.01" 
                                        value={variantEditData.selling_price} 
                                        onChange={e => setVariantEditData({...variantEditData, selling_price: parseFloat(e.target.value)})} 
                                     />
                                 </div>
                             </div>
                         </div>

                         <div className="space-y-4">
                             <h4 className="font-black uppercase text-xs tracking-widest opacity-50 border-b pb-2">Inventory</h4>
                             <div className="grid gap-2">
                                 <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quantity On Hand</Label>
                                 <div className="flex gap-2">
                                    <Input 
                                        type="number" 
                                        value={variantEditData.quantity_on_hand} 
                                        readOnly 
                                        className="bg-muted text-muted-foreground cursor-not-allowed" 
                                    />
                                    <Button 
                                        size="icon" 
                                        variant="outline" 
                                        onClick={() => openStockDialog('deduct', selectedVariant?.id)}
                                        title="Deduct Stock"
                                    >
                                        <Minus className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                        size="icon" 
                                        variant="outline" 
                                        onClick={() => openStockDialog('add', selectedVariant?.id)}
                                        title="Add Stock"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                 </div>
                                 <p className="text-[10px] text-muted-foreground">
                                     Use +/- buttons to adjust stock with audit reasons.
                                 </p>
                             </div>

                             <div className="pt-2">
                                 <Button 
                                    variant="secondary" 
                                    className="w-full h-8 text-xs font-bold uppercase tracking-wider border border-primary/10"
                                    onClick={() => handleSingleAssignParams(selectedVariant!)}
                                 > 
                                    <MapPin className="h-3 w-3 mr-2" /> Assign to Location 
                                 </Button>
                              </div>

                              <div className="grid gap-2">
                                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Low Stock Threshold</Label>
                                  <Input 
                                      type="number" 
                                      value={variantEditData.low_stock_threshold} 
                                      onChange={e => setVariantEditData({...variantEditData, low_stock_threshold: parseInt(e.target.value)})} 
                                  />
                              </div>

                              {/* Per-Variant Location Breakdown */}
                              <div className="pt-4 border-t space-y-4">
                                  <div className="flex items-center justify-between">
                                      <h4 className="font-black uppercase text-xs tracking-widest opacity-50">Stock by Location</h4>
                                      <Badge variant="outline" className="text-[10px] font-bold">
                                          {(locationLevels.filter(l => l.product_id === selectedVariant?.id).reduce((sum, l) => sum + l.quantity, 0)) + " Total Allocated"}
                                      </Badge>
                                  </div>
                                  
                                  <div className="space-y-2">
                                      {locationLevels
                                          .filter(l => l.product_id === selectedVariant?.id)
                                          .map(level => (
                                          <div key={level.id} className="flex items-center justify-between bg-muted/30 p-2 rounded border border-muted-foreground/10">
                                              <div className="flex items-center gap-2">
                                                  <MapPin className="h-3 w-3 text-primary" />
                                                  <span className="text-xs font-bold">{level.location.name}</span>
                                              </div>
                                              <span className="text-xs font-black">{level.quantity}</span>
                                          </div>
                                      ))}
                                      
                                      {/* Unallocated for this variant */}
                                      {(() => {
                                          const allocated = locationLevels
                                              .filter(l => l.product_id === selectedVariant?.id)
                                              .reduce((sum, l) => sum + l.quantity, 0);
                                          const unallocated = (variantEditData?.quantity_on_hand || 0) - allocated;
                                          
                                          return unallocated > 0 ? (
                                              <div className="flex items-center justify-between bg-amber-500/5 p-2 rounded border border-amber-500/10">
                                                  <div className="flex items-center gap-2">
                                                      <Package className="h-3 w-3 text-amber-500" />
                                                      <span className="text-xs font-bold text-amber-500">Unallocated</span>
                                                  </div>
                                                  <span className="text-xs font-black text-amber-500">{unallocated}</span>
                                              </div>
                                          ) : null;
                                      })()}

                                      {locationLevels.filter(l => l.product_id === selectedVariant?.id).length === 0 && (
                                          <p className="text-[10px] text-muted-foreground italic text-center py-2">
                                              No stock assigned to locations yet.
                                          </p>
                                      )}
                                  </div>
                              </div>
                          </div>
                      </div>
                  )}
               </ScrollArea>

               <div className="p-6 pb-12 border-t bg-background mt-auto">
                   <SheetFooter className="gap-2 sm:justify-between">
                       {/* Delete button on the left */}
                       <Button variant="destructive" onClick={handleDeleteVariant} className="gap-2">
                           <Trash2 className="h-4 w-4" /> Delete Variant
                       </Button>
                       <div className="flex gap-2">
                           <Button variant="outline" onClick={() => setIsVariantSheetOpen(false)}>Cancel</Button>
                           <Button onClick={handleSaveVariant} disabled={!isVariantDirty} className="px-8 font-black uppercase">Save Changes</Button>
                       </div>
                   </SheetFooter>
               </div>
           </SheetContent>
       </Sheet>
        <StockTransferDialog 
            open={isTransferOpen}
            onOpenChange={setIsTransferOpen}
            product={product}
            initialSourceLocationId={transferInitialSource}
            onSuccess={loadLevels}
        />
    </div>
  );
}




