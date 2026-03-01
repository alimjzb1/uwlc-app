import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLocations } from "@/hooks/use-locations";
import { 
  Building2, 
  MapPin,
  Trash2, 
  Settings2,
  ExternalLink,
  Copy,
  Check,
  Plus
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { InventoryLocation } from "@/types";


export default function Locations() {
  const navigate = useNavigate();
  const { 
    locations, 
    loading, 
    addLocation, 
    updateLocation, 
    deleteLocation
  } = useLocations();
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  const [selectedLocation, setSelectedLocation] = useState<InventoryLocation | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    details: "",
    precise_location_url: ""
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    try {
      if (selectedLocation) {
        await updateLocation(selectedLocation.id, formData);
        setIsEditOpen(false);
      } else {
        await addLocation(formData);
        setIsAddOpen(false);
      }
      setFormData({ name: "", details: "", precise_location_url: "" });
      setSelectedLocation(null);
    } catch (err) {
      console.error("Failed to save location", err);
    }
  };



  const openEdit = (location: InventoryLocation) => {
    setSelectedLocation(location);
    setFormData({
        name: location.name,
        details: location.details || "",
        precise_location_url: location.precise_location_url || ""
    });
    setIsEditOpen(true);
  };

  return (
    <div className="space-y-8 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" /> Multi-Location
          </h2>
          <p className="text-muted-foreground font-medium mt-1">Manage physical stocking points and warehouses.</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button 
                onClick={() => { setSelectedLocation(null); setFormData({ name: "", details: "", precise_location_url: "" }); }}
                className="font-black uppercase text-[10px] tracking-widest px-6 h-12 rounded-2xl gap-2 shadow-lg shadow-primary/20"
            >
              <Plus className="h-4 w-4" /> Add Location
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">New Stock Location</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6 pt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Location Name</Label>
                  <Input 
                    placeholder="e.g. Beirut Central Warehouse"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="h-11 rounded-xl bg-muted/30 border-none font-bold placeholder:font-medium"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Details / Address</Label>
                  <Input 
                    placeholder="Floor 2, Industrial Zone"
                    value={formData.details}
                    onChange={e => setFormData({ ...formData, details: e.target.value })}
                    className="h-11 rounded-xl bg-muted/30 border-none font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Maps URL (Precise Location)</Label>
                  <Input 
                    placeholder="https://maps.google.com/..."
                    value={formData.precise_location_url}
                    onChange={e => setFormData({ ...formData, precise_location_url: e.target.value })}
                    className="h-11 rounded-xl bg-muted/30 border-none font-medium"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full font-black uppercase text-[10px] tracking-widest h-12 rounded-2xl">
                  Create Location
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="sm:max-w-[425px] rounded-3xl p-6">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black uppercase tracking-tight">Edit Location</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6 pt-4">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Location Name</Label>
                            <Input 
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="h-11 rounded-xl bg-muted/30 border-none font-bold"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Details / Address</Label>
                            <Input 
                                value={formData.details}
                                onChange={e => setFormData({ ...formData, details: e.target.value })}
                                className="h-11 rounded-xl bg-muted/30 border-none font-medium"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Maps URL</Label>
                            <Input 
                                value={formData.precise_location_url}
                                onChange={e => setFormData({ ...formData, precise_location_url: e.target.value })}
                                className="h-11 rounded-xl bg-muted/30 border-none font-medium"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" className="w-full font-black uppercase text-[10px] tracking-widest h-12 rounded-2xl">
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>



      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
           Array(3).fill(0).map((_, i) => (
             <Card key={i} className="rounded-3xl border-muted-foreground/10 bg-card h-48 animate-pulse" />
           ))
        ) : locations.length === 0 ? (
          <div className="col-span-full h-64 flex flex-col items-center justify-center border-2 border-dashed rounded-3xl opacity-50 space-y-4">
            <MapPin className="h-12 w-12 text-muted-foreground" />
            <p className="font-black uppercase text-xs tracking-widest">No locations configured yet</p>
          </div>
        ) : (
          locations.map((location) => (
            <Card key={location.id} className="group rounded-[32px] border-muted-foreground/10 bg-card overflow-hidden hover:border-primary/30 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-primary/5">
              <CardHeader className="pb-3 flex flex-row items-start justify-between">
                <div className="space-y-1 cursor-pointer" onClick={() => navigate(`/locations/${location.id}`)}>
                  <CardTitle className="text-lg font-black uppercase tracking-tight leading-none truncate max-w-[200px] hover:text-primary transition-colors">
                    {location.name}
                  </CardTitle>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> Warehouse
                  </div>
                </div>

                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => deleteLocation(location.id)}>
                     <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                   </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/30 rounded-2xl border border-muted-foreground/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Address</span>
                    <span className="text-[10px] font-bold truncate max-w-[150px]">{location.details || 'No details provided'}</span>
                  </div>
                  
                  {location.precise_location_url && (
                    <div className="flex items-center justify-between pt-3 border-t border-muted/50">
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Maps Link</span>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary"
                          onClick={() => window.open(location.precise_location_url, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 rounded-xl bg-muted hover:bg-muted-foreground/10"
                          onClick={() => handleCopy(location.precise_location_url!, location.id)}
                        >
                          {copiedId === location.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <Button 
                    variant="outline" 
                    className="h-10 rounded-xl font-black uppercase text-[9px] tracking-widest gap-2 bg-card w-full"
                    onClick={() => openEdit(location)}
                  >
                    <Settings2 className="h-3 w-3" /> Edit Info
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

