import { useCustomers } from "@/hooks/use-customers";
import { useShopifySync } from "@/hooks/use-shopify-sync";
import { useAppSettings } from "@/hooks/use-app-settings";
import { CustomerList } from "@/components/customers/CustomerList";
import { Input } from "@/components/ui/input";
import { Search, RefreshCw, ArrowDownWideNarrow, ArrowUpNarrowWide, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Button } from "@/components/ui/button";
import { PageSizeSelector } from "@/components/ui/PageSizeSelector";
import { cn } from "@/lib/utils";

export default function Customers() {
  const { getSetting } = useAppSettings();
  const { syncRecentCustomers, isSyncing } = useShopifySync();
  
  const defaultPageSize = getSetting('default_page_size', 50);
  const [pageSize, setPageSize] = useState<string>(String(defaultPageSize));
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const { customers, loading, refreshCustomers } = useCustomers(pageSize, sortOrder);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Auto-sync on load
  useEffect(() => {
    syncRecentCustomers(Number(defaultPageSize))
      .then(() => refreshCustomers())
      .catch(err => console.error("Auto-sync failed:", err));
  }, []);


  useEffect(() => {
    if (defaultPageSize) setPageSize(String(defaultPageSize));
  }, [defaultPageSize]);

  const filteredCustomers = customers.filter(customer => 
    `${customer.first_name} ${customer.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (customer.phone && customer.phone.includes(searchQuery))
  );

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSync = async () => {
    try {
      await syncRecentCustomers(Number(pageSize));
      refreshCustomers();
      toast.success('Customers synced successfully');
    } catch (err: any) {
      toast.error('Sync failed: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            Customers
            <span className="text-sm font-bold bg-muted px-2 py-1 rounded-full text-muted-foreground self-start mt-1">
                {customers.length} Total
            </span>
          </h1>
          <p className="text-muted-foreground">
            View and manage your customer details.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PageSizeSelector value={pageSize} onChange={setPageSize} />
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
            className="h-9 gap-2 font-black uppercase text-[10px] tracking-widest"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
            {isSyncing ? 'Syncing...' : 'Sync'}
          </Button>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search customers..."
            className="pl-8 bg-card/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-10 gap-2 font-bold uppercase text-[10px] tracking-wider shrink-0 bg-card/30">
              {sortOrder === 'desc' ? <ArrowDownWideNarrow className="h-3.5 w-3.5" /> : <ArrowUpNarrowWide className="h-3.5 w-3.5" />}
              {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[160px]">
            <DropdownMenuItem onClick={() => setSortOrder('desc')} className="text-xs font-semibold flex items-center justify-between cursor-pointer">
              Newest to Oldest
              {sortOrder === 'desc' && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOrder('asc')} className="text-xs font-semibold flex items-center justify-between cursor-pointer">
              Oldest to Newest
              {sortOrder === 'asc' && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CustomerList 
        customers={filteredCustomers} 
        loading={loading} 
        selectedIds={selectedIds}
        onToggleSelect={toggleSelection}
        onToggleAll={() => {
             if (selectedIds.length === filteredCustomers.length) {
                setSelectedIds([]);
            } else {
                setSelectedIds(filteredCustomers.map(c => c.id));
            }
        }}
      />

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
                 <Button size="sm" variant="secondary" className="h-8 font-bold text-[10px] uppercase tracking-wider" onClick={() => alert("Bulk Edit Coming Soon")}>
                    Edit Tags
                </Button>
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
