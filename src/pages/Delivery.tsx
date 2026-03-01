import { useState } from "react";
import { useDeliveryCompanies } from "@/hooks/use-delivery-companies";
import { 
  Truck, 
  Plus, 
  Zap, 
  Trash2, 
  CheckCircle2,
  Info

} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AddProviderDialog } from "@/components/delivery/AddProviderDialog";
import { EditProviderDialog } from "@/components/delivery/EditProviderDialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

export default function Delivery() {
  const { 
    companies, 
    mappings, 
    loading, 
    refresh,
    deleteCompany,
    deleteMapping,
    addMapping 
  } = useDeliveryCompanies();

  const [activeTab, setActiveTab] = useState("providers");
  const [newTag, setNewTag] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<string | null>(null);

  const handleAddMapping = async () => {
    if (!newTag || !selectedProvider) return;
    try {
      await addMapping({ tag: newTag, delivery_company_id: selectedProvider });
      setNewTag("");
      setSelectedProvider("");
      toast.success("Mapping created");
    } catch (err) {
      toast.error("Failed to add mapping");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!companyToDelete) return;
    try {
      await deleteCompany(companyToDelete);
      toast.success("Provider deleted successfully");
    } catch (e: any) {
      toast.error("Failed to delete provider. It may be in use by active orders or rules.");
      console.error(e);
    } finally {
      setDeleteDialogOpen(false);
      setCompanyToDelete(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tighter text-foreground flex items-center gap-3">
            <Truck className="h-10 w-10 text-primary" /> Delivery & Logistics
          </h1>
          <p className="text-muted-foreground font-medium text-lg">
            Automate carrier assignment and manage shipping provider integrations.
          </p>
        </div>
        <AddProviderDialog onProviderAdded={refresh} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-transparent border-b rounded-none h-14 w-full justify-start gap-10 px-0 mb-6">
          <TabsTrigger value="providers" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-0 text-sm font-black uppercase tracking-widest transition-all">
            Shipping Providers ({companies.length})
          </TabsTrigger>
          <TabsTrigger value="mappings" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-0 text-sm font-black uppercase tracking-widest transition-all">
            Smart Assignments
          </TabsTrigger>
          <TabsTrigger value="logs" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-0 text-sm font-black uppercase tracking-widest transition-all">
            Delivery Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-[220px] rounded-2xl" />
              ))
            ) : companies.length === 0 ? (
               <div className="col-span-full py-20 bg-muted/20 border-2 border-dashed rounded-3xl flex flex-col items-center gap-4 text-muted-foreground">
                 <Truck className="h-12 w-12 opacity-20" />
                 <p className="font-bold">No providers configured</p>
               </div>
            ) : (
              companies.map((company) => (
                <Card key={company.id} className="rounded-2xl border-2 hover:border-primary/30 transition-all group relative overflow-hidden bg-card shadow-sm hover:shadow-xl hover:-translate-y-1">
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                         <Truck className="h-6 w-6" />
                      </div>
                      <Badge variant={company.is_active ? "default" : "secondary"} className={cn(
                        "font-black text-[9px] uppercase tracking-widest px-2 py-0.5 border-none",
                        company.is_active ? "bg-emerald-500 shadow-lg shadow-emerald-500/20" : "bg-muted"
                      )}>
                        {company.is_active ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                    <CardTitle className="text-xl font-black pt-4 tracking-tight group-hover:text-primary transition-colors">{company.name}</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">ID: {company.id.split('-')[0]}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                     <div className="flex items-center justify-between text-xs py-2 border-t border-muted">
                        <span className="font-bold text-muted-foreground uppercase tracking-widest text-[9px]">Default Carrier</span>
                        <Badge variant="outline" className={cn(
                            "h-5 text-[9px] font-black uppercase border-none",
                            company.is_default ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground"
                        )}>
                            {company.is_default ? "Yes" : "No"}
                        </Badge>
                     </div>
                     <div className="flex gap-2">
                        <EditProviderDialog company={company} onProviderUpdated={refresh} />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-9 h-9 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          onClick={() => {
                            setCompanyToDelete(company.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>

                     </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="mappings" className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Configuration Panel */}
                <div className="space-y-6">
                    <Card className="rounded-2xl border-none shadow-xl bg-primary/5 p-6">
                        <div className="space-y-6">
                            <div className="flex items-center gap-3">
                                <Zap className="h-6 w-6 text-primary" />
                                <h3 className="text-xl font-black tracking-tight">Auto-Assignment</h3>
                            </div>
                            <p className="text-sm font-medium text-muted-foreground">
                                Define carrier priority based on Shopify order tags. 
                            </p>
                            
                            <div className="space-y-4 pt-4 border-t border-primary/10">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-primary">Order Tag</label>
                                    <Input 
                                      placeholder="e.g. Beirut-Express" 
                                      className="bg-background border-none h-11 focus-visible:ring-primary shadow-sm"
                                      value={newTag}
                                      onChange={(e) => setNewTag(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-primary">Carrier Provider</label>
                                    <select 
                                      className="flex h-11 w-full rounded-md bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-bold border-none shadow-sm"
                                      value={selectedProvider}
                                      onChange={(e) => setSelectedProvider(e.target.value)}
                                    >
                                        <option value="">Select Provider...</option>
                                        {companies.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <Button className="w-full h-11 font-black uppercase tracking-widest text-[11px] gap-2 mt-2" onClick={handleAddMapping}>
                                    <Plus className="h-4 w-4" /> Create Rule
                                </Button>
                            </div>
                        </div>
                    </Card>

                    <div className="p-6 bg-slate-900 text-white rounded-2xl space-y-4 shadow-2xl">
                        <div className="flex items-center gap-2">
                            <Info className="h-4 w-4 text-primary" />
                            <h4 className="text-xs font-black uppercase tracking-widest">How it works</h4>
                        </div>
                        <ul className="space-y-3">
                            {[
                                "Rules are matched against Shopify tags.",
                                "Highest priority rule wins the assignment.",
                                "If no tags match, default carrier is used.",
                                "Assignment happens at 'New' order stage."
                            ].map((text, i) => (
                                <li key={i} className="flex gap-2 text-xs font-semibold opacity-80">
                                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                                    {text}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Rules Table */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="rounded-2xl border-2 border-muted overflow-hidden bg-card">
                        <Table>
                            <TableHeader className="bg-muted/50 h-14">
                                <TableRow>
                                    <TableHead className="font-bold text-[10px] uppercase tracking-widest pl-6">Tag Trigger</TableHead>
                                    <TableHead className="font-bold text-[10px] uppercase tracking-widest">Assigned Provider</TableHead>
                                    <TableHead className="font-bold text-[10px] uppercase tracking-widest">Priority</TableHead>
                                    <TableHead className="text-right font-bold text-[10px] uppercase tracking-widest pr-6">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                     Array.from({ length: 4 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="pl-6"><Skeleton className="h-4 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                                            <TableCell className="pr-6"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                        </TableRow>
                                     ))
                                ) : mappings.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-64 text-center text-muted-foreground italic text-sm">
                                            No assignment rules defined yet.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    mappings.map((mapping) => (
                                        <TableRow key={mapping.id} className="hover:bg-muted/30 group">
                                            <TableCell className="pl-6">
                                                <Badge variant="outline" className="font-bold border-primary/30 text-primary bg-primary/5 uppercase tracking-wide">
                                                   {mapping.tag}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-black text-sm">
                                                {companies.find(c => c.id === mapping.delivery_company_id)?.name || "Unknown"}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="h-1.5 w-12 bg-muted rounded-full overflow-hidden">
                                                        <div 
                                                          className="h-full bg-primary" 
                                                          style={{ width: `${Math.min(mapping.priority * 10, 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-bold text-muted-foreground">{mapping.priority}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <Button 
                                                  variant="ghost" 
                                                  size="sm" 
                                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive transition-opacity opacity-0 group-hover:opacity-100"
                                                  onClick={() => deleteMapping(mapping.id)}
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
                </div>
            </div>
        </TabsContent>

        <TabsContent value="logs">
             <div className="flex flex-col items-center justify-center py-40 border-2 border-dashed rounded-3xl opacity-20 text-center space-y-4">
                <Truck className="h-20 w-20" />
                <h3 className="text-2xl font-black uppercase tracking-tighter">Integration Logs Coming Soon</h3>
                <p className="font-medium max-w-sm">Track every API request and response between Shopify and your shipping providers.</p>
             </div>
        </TabsContent>
      </Tabs>

      <ConfirmationDialog 
        open={deleteDialogOpen} 
        onOpenChange={setDeleteDialogOpen}
        title="Delete Delivery Provider"
        description="Are you sure you want to delete this provider? This may affect active shipping rules or orders."
        onConfirm={handleDeleteConfirm}
        variant="destructive"
        confirmText="Delete Provider"
      />
    </div>
  );
}
