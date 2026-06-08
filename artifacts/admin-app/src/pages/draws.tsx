import { useState } from "react";
import { useListDraws, useCreateDraw, useRunDraw, getListDrawsQueryKey, getGetStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Play, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Draws() {
  const { data: draws, isLoading } = useListDraws();
  const createDraw = useCreateDraw();
  const runDraw = useRunDraw();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [jackpot, setJackpot] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const handleCreate = () => {
    createDraw.mutate({ data: { jackpotAmount: Number(jackpot), scheduledAt: new Date(scheduledAt).toISOString() } }, {
      onSuccess: () => {
        setIsCreateOpen(false);
        queryClient.invalidateQueries({ queryKey: getListDrawsQueryKey() });
        toast({ title: "Draw created successfully" });
      }
    });
  };

  const handleRun = (id: number) => {
    runDraw.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDrawsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
        toast({ title: "Draw executed" });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Draws</h2>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> New Draw</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Draw</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Jackpot Amount (CDF)</label>
                <Input type="number" value={jackpot} onChange={e => setJackpot(e.target.value)} placeholder="5000000" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Scheduled Date</label>
                <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={createDraw.isPending}>
                Create Draw
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Jackpot</TableHead>
              <TableHead className="text-right">Tickets Sold</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {draws?.map(draw => (
              <TableRow key={draw.id}>
                <TableCell className="font-medium">#{draw.drawNumber}</TableCell>
                <TableCell>
                  <Badge variant={draw.status === 'active' ? 'default' : draw.status === 'completed' ? 'secondary' : 'outline'}>
                    {draw.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{formatCurrency(draw.jackpotAmount)}</TableCell>
                <TableCell className="text-right">{draw.totalTicketsSold.toLocaleString()}</TableCell>
                <TableCell>{formatDate(draw.scheduledAt)}</TableCell>
                <TableCell className="text-right">
                  {draw.status === 'active' && (
                    <Button size="sm" variant="secondary" onClick={() => handleRun(draw.id)} disabled={runDraw.isPending}>
                      <Play className="h-4 w-4 mr-1" /> Run Draw
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {draws?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-4">No draws found</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
