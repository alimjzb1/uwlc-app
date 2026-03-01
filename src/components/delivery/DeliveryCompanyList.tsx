import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeliveryCompany } from "@/types";
import { Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface DeliveryCompanyListProps {
  companies: DeliveryCompany[];
  loading: boolean;
}

export function DeliveryCompanyList({ companies, loading }: DeliveryCompanyListProps) {
  if (loading) {
    return <div className="p-4 text-center">Loading providers...</div>;
  }

  if (companies.length === 0) {
    return <div className="p-4 text-center text-muted-foreground">No delivery providers found.</div>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Provider Name</TableHead>
            <TableHead>Base URL</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies.map((company) => (
            <TableRow key={company.id}>
              <TableCell className="font-medium">{company.name}</TableCell>
              <TableCell className="font-mono text-xs">{company.base_url || '-'}</TableCell>
              <TableCell>
                {company.is_active ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </TableCell>
              <TableCell>
                {company.created_at ? format(new Date(company.created_at), 'PP') : '-'}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" disabled>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-destructive" disabled>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
