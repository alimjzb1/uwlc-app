import { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Product } from "@/types";
import { MapPin, ArrowRightLeft, AlertCircle } from "lucide-react";
import { useLocations } from "@/hooks/use-locations";
import { toast } from "sonner";

interface StockTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  onSuccess?: () => void;
  initialSourceLocationId?: string | null;
}

export function StockTransferDialog({ 
  open, 
  onOpenChange, 
  product, 
  onSuccess,
  initialSourceLocationId 
}: StockTransferDialogProps) {
  const { locations, transferStock, getStockByLocation } = useLocations();
  const [loading, setLoading] = useState(false);
  const [currentLevels, setCurrentLevels] = useState<{location_id: string, quantity: number}[]>([]);
  
  const [formData, setFormData] = useState({
    fromLocationId: initialSourceLocationId || "unallocated",
    toLocationId: "",
    quantity: "",
    reason: "Transfer between locations",
    notes: ""
  });

  useEffect(() => {
    if (open) {
        setFormData(prev => ({ 
            ...prev, 
            fromLocationId: initialSourceLocationId || "unallocated",
            toLocationId: "",
            quantity: "" 
        }));
        loadCurrentLevels();
    }
  }, [open, product.id, initialSourceLocationId]);

  async function loadCurrentLevels() {
      try {
          const levels = await getStockByLocation(product.id);
          setCurrentLevels(levels.map(l => ({ location_id: l.location_id, quantity: l.quantity })));
      } catch (err) {
          console.error("Failed to load levels:", err);
      }
  }

  const getAvailableInSource = () => {
      if (formData.fromLocationId === "unallocated") {
          const totalAllocated = currentLevels.reduce((sum, l) => sum + l.quantity, 0);
          return Math.max(0, (product.quantity_on_hand || 0) - totalAllocated);
      }
      const level = currentLevels.find(l => l.location_id === formData.fromLocationId);
      return level?.quantity || 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(formData.quantity);
    if (isNaN(qty) || qty <= 0) {
        toast.error("Please enter a valid quantity");
        return;
    }

    if (!formData.toLocationId) {
        toast.error("Please select a destination");
        return;
    }

    setLoading(true);
    try {
      await transferStock({
        productId: product.id,
        fromLocationId: formData.fromLocationId === "unallocated" ? null : formData.fromLocationId,
        toLocationId: formData.toLocationId === "unallocated" ? null : formData.toLocationId,
        quantity: qty,
        reason: formData.reason,
        notes: formData.notes
      });
      toast.success("Stock transferred successfully");
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to transfer stock");
    } finally {
      setLoading(false);
    }
  };

  const available = getAvailableInSource();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] rounded-[2rem]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
            <ArrowRightLeft className="h-6 w-6 text-primary" /> Transfer Stock
          </DialogTitle>
          <DialogDescription className="font-medium">
             Move <span className="text-foreground font-bold">{product.name}</span> across your warehousing network.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="grid grid-cols-2 gap-4">
            {/* From */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-1">Source</Label>
              <Select 
                value={formData.fromLocationId} 
                onValueChange={(val) => setFormData({...formData, fromLocationId: val})}
              >
                <SelectTrigger className="h-12 rounded-2xl bg-muted/30 border-none font-bold">
                  <SelectValue placeholder="Select Source" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="unallocated">Unallocated Stock</SelectItem>
                  {locations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* To */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-1">Destination</Label>
              <Select 
                value={formData.toLocationId} 
                onValueChange={(val) => setFormData({...formData, toLocationId: val})}
              >
                <SelectTrigger className="h-12 rounded-2xl bg-muted/30 border-none font-bold">
                  <SelectValue placeholder="Select Destination" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="unallocated">Unallocated Stock</SelectItem>
                  {locations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id} disabled={loc.id === formData.fromLocationId}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-between">
             <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Available at Source</span>
             </div>
             <span className="text-sm font-black text-primary">{available} Units</span>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quantity to Move</Label>
            <Input 
              type="number"
              placeholder="0"
              value={formData.quantity}
              onChange={(e) => setFormData({...formData, quantity: e.target.value})}
              className="h-12 rounded-2xl bg-muted/20 border-none text-lg font-black"
              max={available}
              min={1}
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Reason / Instruction</Label>
            <Input 
              placeholder="e.g. Restocking retail point"
              value={formData.reason}
              onChange={(e) => setFormData({...formData, reason: e.target.value})}
              className="h-12 rounded-2xl bg-muted/20 border-none font-medium"
            />
          </div>

          {available < parseInt(formData.quantity || "0") && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-[10px] font-bold uppercase tracking-tight">
                  <AlertCircle className="h-4 w-4" />
                  Not enough stock in source location
              </div>
          )}

          <DialogFooter>
            <Button 
                type="submit" 
                disabled={loading || available < parseInt(formData.quantity || "0") || !formData.toLocationId}
                className="w-full h-14 rounded-3xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20"
            >
              {loading ? "Processing..." : "Confirm Transfer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
