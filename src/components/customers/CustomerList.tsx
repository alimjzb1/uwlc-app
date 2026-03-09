import { Link, useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

import { format } from "date-fns";
import { Eye } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";

interface CustomerListProps {
  customers: any[]; // Using any to avoid type errors since we extended it locally in the hook
  loading: boolean;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
}

export function CustomerList({ customers, loading, selectedIds, onToggleSelect, onToggleAll }: CustomerListProps) {
  const navigate = useNavigate();

  if (loading) {
    return <div className="p-12 text-center text-muted-foreground animate-pulse">Loading customer database...</div>;
  }

  if (customers.length === 0) {
    return <div className="p-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">No customers found.</div>;
  }

  return (
    <div className="rounded-2xl border-none bg-card shadow-[0_8px_40px_rgba(0,0,0,0.12)] overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/10 h-14 border-b border-muted/20">
          <TableRow className="hover:bg-transparent border-none">
            <TableHead className="w-[60px] pl-6">
              <Checkbox 
                checked={customers.length > 0 && selectedIds.length === customers.length}
                onCheckedChange={onToggleAll}
                aria-label="Select all"
                className="border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
            </TableHead>
            <TableHead className="font-black text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">Name</TableHead>
            <TableHead className="font-black text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70 hidden sm:table-cell">Contact</TableHead>
            <TableHead className="font-black text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">Orders</TableHead>
            <TableHead className="font-black text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">Total Spent</TableHead>
            <TableHead className="font-black text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">Last Order</TableHead>
            <TableHead className="text-right font-black text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70 pr-6">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer) => (
            <TableRow 
              key={customer.id} 
              className="group hover:bg-muted/[0.15] border-b border-muted/5 transition-colors cursor-pointer"
              onClick={() => navigate(`/customers/${customer.id}`)}
            >
              <TableCell className="pl-6 py-4" onClick={(e) => e.stopPropagation()}>
                <Checkbox 
                  checked={selectedIds.includes(customer.id)}
                  onCheckedChange={() => onToggleSelect(customer.id)}
                  className="border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
              </TableCell>
              <TableCell>
                <div className="font-black text-sm text-foreground tracking-tight">
                  {customer.first_name} {customer.last_name}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground opacity-50 uppercase mt-0.5">
                  ID: {customer.id.substring(0, 8)}
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <div className="text-xs font-medium text-foreground">{customer.email}</div>
                <div className="text-[10px] text-muted-foreground opacity-60">{customer.phone || '-'}</div>
              </TableCell>
              <TableCell>
                 <div className="font-black text-sm">{customer.orders_count || 0}</div>
              </TableCell>
              <TableCell>
                 <div className="font-black text-sm text-emerald-600 dark:text-emerald-500">
                    ${(customer.total_spent || 0).toFixed(2)}
                 </div>
              </TableCell>
              <TableCell>
                <div className="text-xs font-medium">
                  {customer.last_order_date ? format(new Date(customer.last_order_date), 'MMM d, yyyy') : '-'}
                </div>
              </TableCell>
              <TableCell className="text-right pr-6">
                <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0 rounded-lg hover:bg-primary hover:text-primary-foreground transition-all">
                  <Link to={`/customers/${customer.id}`}>
                    <Eye className="h-4 w-4" />
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
