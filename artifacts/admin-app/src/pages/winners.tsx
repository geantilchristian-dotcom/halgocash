import { useListWinners } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy } from "lucide-react";

export default function Winners() {
  const { data: winners } = useListWinners();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Recent Winners</h2>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Draw</TableHead>
              <TableHead>Ticket</TableHead>
              <TableHead className="text-right">Prize Amount</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Claimed At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {winners?.map(winner => (
              <TableRow key={winner.id}>
                <TableCell className="font-medium">#{winner.drawNumber}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{winner.maskedCode}</TableCell>
                <TableCell className="text-right font-bold text-accent">
                  <div className="flex items-center justify-end gap-1">
                    <Trophy className="h-3 w-3" />
                    {formatCurrency(winner.prizeAmount)}
                  </div>
                </TableCell>
                <TableCell>{winner.vendorName || 'Direct'}</TableCell>
                <TableCell>{formatDate(winner.claimedAt)}</TableCell>
              </TableRow>
            ))}
            {winners?.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-4">No winners yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
