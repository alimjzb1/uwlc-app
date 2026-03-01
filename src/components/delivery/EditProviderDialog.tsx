import { useState } from "react";
import { toast } from "sonner";
import { Settings2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea"; 
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useDeliveryCompanies } from "@/hooks/use-delivery-companies";
import { DeliveryCompany } from "@/types";

interface EditProviderDialogProps {
  company: DeliveryCompany;
  onProviderUpdated: () => void;
}

export function EditProviderDialog({ company, onProviderUpdated }: EditProviderDialogProps) {
  const [open, setOpen] = useState(false);
  const { updateCompany } = useDeliveryCompanies();
  const [formData, setFormData] = useState<{
    name: string;
    api_key: string;
    base_url: string;
    is_active: boolean;
    is_default: boolean;
    rates: any;
  }>({
    name: company.name,
    api_key: company.api_key || "",
    base_url: company.base_url || "",
    is_active: company.is_active,
    is_default: company.is_default,
    rates: company.rates || {},
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await updateCompany(company.id, formData);
      setOpen(false);
      onProviderUpdated();
      toast.success("Carrier configuration updated");
    } catch (error) {
      console.error("Failed to update provider:", error);
      toast.error("Failed to update provider");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex-1 h-9 font-black uppercase text-[10px] bg-card border-muted-foreground/10 hover:border-primary">
          <Settings2 className="h-3 w-3 mr-1" /> Config
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tight">Configure Carrier</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Carrier Name</Label>
              <Input 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-11 rounded-xl bg-muted/30 border-none font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">API Key / Secret</Label>
              <Input 
                type="password"
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                className="h-11 rounded-xl bg-muted/30 border-none"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Base API URL</Label>
              <Input 
                placeholder="https://api.carrier.com"
                value={formData.base_url}
                onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                className="h-11 rounded-xl bg-muted/30 border-none font-medium"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-muted/10">
              <div className="space-y-0.5">
                <Label className="text-xs font-black uppercase">Active Status</Label>
                <div className="text-[10px] font-medium text-muted-foreground">Visible for assignments</div>
              </div>
              <Switch 
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-primary/5 rounded-2xl border border-primary/10">
              <div className="space-y-0.5">
                <Label className="text-xs font-black uppercase text-primary">System Default</Label>
                <div className="text-[10px] font-medium text-primary/60">Fallback carrier if no rules match</div>
              </div>
              <Switch 
                checked={formData.is_default}
                onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-dashed">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Delivery Rates / Notes</Label>
                <Textarea 
                    placeholder="Enter rate details or JSON configuration e.g. { 'base': 10, 'per_kg': 2 }"
                    value={
                      !formData.rates || 
                      (typeof formData.rates === 'object' && Object.keys(formData.rates).length === 0) ||
                      (Array.isArray(formData.rates) && formData.rates.length === 0)
                        ? "" 
                        : typeof formData.rates === 'string' 
                          ? formData.rates 
                          : JSON.stringify(formData.rates, null, 2)
                    }
                    onChange={(e) => {
                       setFormData({...formData, rates: e.target.value}); 
                    }}
                    className="h-24 rounded-xl bg-muted/30 border-none font-medium font-mono text-xs"
                />
                <p className="text-[9px] text-muted-foreground">
                    Store structured rate data (JSON) or general pricing notes.
                </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="font-bold uppercase text-[10px]">
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="font-black uppercase text-[10px] px-6 gap-2">
              {submitting ? "Saving..." : <><Save className="h-3 w-3" /> Save Config</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
