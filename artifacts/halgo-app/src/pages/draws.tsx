import { useListDraws } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Calendar, Hash, Trophy, Info } from "lucide-react";
import { format } from "date-fns";

export default function Draws() {
  const { data: draws, isLoading } = useListDraws();

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="space-y-2">
        <h1 className="text-4xl font-black tracking-tight text-foreground">Draw Results</h1>
        <p className="text-lg text-muted-foreground">Check the latest winning numbers and upcoming jackpots.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : draws && draws.length > 0 ? (
        <div className="grid gap-6">
          {draws.map((draw) => (
            <Card key={draw.id} className="overflow-hidden rounded-2xl border-border/50 shadow-md">
              <div className={`h-2 w-full ${
                draw.status === 'active' ? 'bg-primary' : 
                draw.status === 'upcoming' ? 'bg-accent' : 
                'bg-muted'
              }`} />
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  
                  <div className="space-y-4 flex-1">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={`font-bold uppercase tracking-wider text-xs px-2 py-1 ${
                        draw.status === 'active' ? 'text-primary border-primary/30 bg-primary/10' : 
                        draw.status === 'upcoming' ? 'text-accent border-accent/30 bg-accent/10' : 
                        'text-muted-foreground border-muted-foreground/30 bg-muted'
                      }`}>
                        {draw.status}
                      </Badge>
                      <span className="font-bold text-foreground flex items-center gap-1">
                        <Hash className="w-4 h-4 text-muted-foreground" />
                        Draw {draw.drawNumber}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                          <Calendar className="w-4 h-4" /> Date
                        </p>
                        <p className="font-semibold text-foreground">
                          {format(new Date(draw.scheduledAt), "MMM d, yyyy")}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                          <Info className="w-4 h-4" /> Tickets
                        </p>
                        <p className="font-semibold text-foreground">
                          {draw.totalTicketsSold.toLocaleString()} sold
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="md:border-l md:border-border/50 md:pl-6 flex flex-col md:items-end justify-center min-w-[200px] space-y-4">
                    <div className="md:text-right">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Jackpot</p>
                      <p className="text-3xl font-black text-foreground">
                        ${draw.jackpotAmount.toLocaleString()}
                      </p>
                    </div>
                    
                    {draw.status === 'completed' && draw.winningTicketCode && (
                      <div className="bg-accent/10 border border-accent/20 rounded-xl p-3 flex items-center gap-3 w-full md:w-auto">
                        <Trophy className="w-5 h-5 text-accent" />
                        <div>
                          <p className="text-xs font-bold text-accent-foreground uppercase tracking-widest">Winning Code</p>
                          <p className="font-mono font-bold text-foreground">{draw.winningTicketCode}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center border-dashed">
          <CardContent className="pt-6">
            <Trophy className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-xl font-bold text-foreground mb-2">No Draws Found</h3>
            <p className="text-muted-foreground">Check back later for draw results.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
