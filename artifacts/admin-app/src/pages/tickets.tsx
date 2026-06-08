import { useListTickets } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function Tickets() {
  const { data: tickets, isLoading } = useListTickets({ limit: 100 });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Recent Tickets</h2>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Draw</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets?.map(ticket => (
              <TableRow key={ticket.id}>
                <TableCell className="font-mono text-xs">{ticket.code}</TableCell>
                <TableCell>{ticket.drawNumber ? `#${ticket.drawNumber}` : '-'}</TableCell>
                <TableCell>
                  <Badge variant={ticket.status === 'validated' ? 'default' : 'outline'}>
                    {ticket.status}
                  </Badge>
                </TableCell>
                <TableCell>{ticket.vendorName || '-'}</TableCell>
                <TableCell className="text-right">{formatCurrency(ticket.price)}</TableCell>
                <TableCell>{ticket.validatedAt ? formatDate(ticket.validatedAt) : (ticket.soldAt ? formatDate(ticket.soldAt) : '-')}</TableCell>
              </TableRow>
            ))}
            {tickets?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-4">No tickets found</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
