import { useState } from "react";
import { useForm } from "react-hook-form";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { DeliveryCompany } from "@/types";

interface AddProviderDialogProps {
  onProviderAdded: () => void;
}

export function AddProviderDialog({ onProviderAdded }: AddProviderDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, watch } = useForm<Omit<DeliveryCompany, 'id' | 'created_at' | 'updated_at'>>({
      defaultValues: {
          is_active: true
      }
  });

  const isActive = watch("is_active");

  const onSubmit = async (data: Omit<DeliveryCompany, 'id' | 'created_at' | 'updated_at'>) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from('delivery_companies')
        .insert([data]);

      if (insertError) throw insertError;

      onProviderAdded();
      setOpen(false);
      reset();
    } catch (err: any) {
      console.error("Error adding provider:", err);
      setError(err.message || "Failed to add provider");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add Provider
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Add Delivery Provider</DialogTitle>
            <DialogDescription>
              Configure a new delivery company integration.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                className="col-span-3"
                placeholder="Provider Name (e.g. FleetRunnr)"
                required
                {...register("name", { required: true })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="base_url" className="text-right">
                Base URL
              </Label>
              <Input
                id="base_url"
                className="col-span-3"
                placeholder="https://api.example.com"
                {...register("base_url")}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="api_key" className="text-right">
                API Key
              </Label>
              <Input
                id="api_key"
                type="password"
                className="col-span-3"
                placeholder="Optional API Key"
                {...register("api_key")}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="is_active" className="text-right">
                Active
              </Label>
              <Switch 
                id="is_active" 
                checked={isActive} 
                onCheckedChange={(checked) => setValue("is_active", checked)}
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="rates" className="text-right pt-2">
                Rates / Notes
              </Label>
              <textarea
                id="rates"
                className="col-span-3 flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Rate details or notes..."
                {...register("rates")}
              />
            </div>
            {error && (
              <div className="text-sm text-red-500 text-center">
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
             <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Provider
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
