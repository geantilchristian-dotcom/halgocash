import { useListDraws, useGetLatestDraw, ListDrawsStatus } from "@workspace/api-client-react";
import { AppLayout } from "../components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Clock, Users, Calendar, DollarSign, Ticket } from "lucide-react";
import { format } from "date-fns";

export default function Draws() {
  const { data: latestDraw, isLoading: isLoadingLatest } = useGetLatestDraw();
  const { data: draws, isLoading: isLoadingDraws } = useListDraws({ limit: 5 });

  const activeDraws = draws?.filter(d => d.status === 'active') || [];
  const activeDraw = activeDraws.length > 0 ? activeDraws[0] : null;

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-black uppercase tracking-tight">Draws & Jackpots</h1>
          <p className="text-sm text-muted-foreground">Current jackpots and recent results.</p>
        </div>

        {activeDraw && (
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Active Draw
            </h2>
            <Card className="bg-primary text-primary-foreground border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <CardContent className="p-6 space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wider opacity-90">Draw #{activeDraw.drawNumber}</p>
                    <div className="text-4xl font-black flex items-center mt-1">
                      <DollarSign className="w-8 h-8 -mr-1" />
                      {activeDraw.jackpotAmount.toLocaleString()}
                    </div>
                  </div>
                  <Trophy className="w-10 h-10 opacity-20 absolute right-6 top-6" />
                </div>
                
                <div className="grid grid-cols-2 gap-4 border-t border-black/10 pt-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-80 mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Draws At
                    </p>
                    <p className="font-bold text-sm">
                      {format(new Date(activeDraw.scheduledAt), 'MMM d, h:mm a')}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-80 mb-1 flex items-center gap-1">
                      <Ticket className="w-3 h-3" /> Pool
                    </p>
                    <p className="font-bold text-sm">
                      ${activeDraw.prizePool.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Recent Results</h2>
          
          <div className="space-y-3">
            {isLoadingDraws ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 bg-white rounded-lg border-2 border-muted animate-pulse" />
              ))
            ) : draws?.filter(d => d.status === 'completed').map((draw) => (
              <div key={draw.id} className="bg-white p-4 rounded-xl border-2 border-black shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Draw #{draw.drawNumber}</p>
                  <div className="font-mono font-black text-lg tracking-widest bg-muted/50 px-2 py-1 rounded inline-block">
                    {draw.winningTicketCode || "NO WINNER"}
                  </div>
                  {draw.drawnAt && (
                    <p className="text-[10px] text-muted-foreground mt-2 font-medium">
                      Drawn: {format(new Date(draw.drawnAt), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Jackpot</p>
                  <p className="font-bold text-lg text-green-600">${draw.jackpotAmount.toLocaleString()}</p>
                </div>
              </div>
            ))}
            
            {draws?.filter(d => d.status === 'completed').length === 0 && (
              <div className="text-center py-8 text-muted-foreground font-medium text-sm">
                No completed draws yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
