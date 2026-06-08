import { useListWinners } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Clock, MapPin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Winners() {
  const { data: winners, isLoading } = useListWinners();

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="space-y-2">
        <h1 className="text-4xl font-black tracking-tight text-foreground">Recent Winners</h1>
        <p className="text-lg text-muted-foreground">Celebrate the latest Halgo Cash jackpot winners!</p>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : winners && winners.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-6">
          {winners.map((winner) => (
            <Card key={winner.id} className="overflow-hidden rounded-2xl border-border/50 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-card to-card/50">
              <CardContent className="p-6 relative">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Trophy className="w-24 h-24" />
                </div>
                
                <div className="relative z-10 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-xl bg-accent/20 text-accent flex items-center justify-center border border-accent/30 shadow-inner">
                      <Trophy className="w-6 h-6" />
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black text-foreground">
                        ${winner.prizeAmount.toLocaleString()}
                      </p>
                      <p className="text-xs font-bold text-accent-foreground uppercase tracking-widest bg-accent/10 inline-block px-2 py-1 rounded mt-1">
                        Prize Claimed
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-border/50">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground font-medium">Winning Ticket</span>
                      <span className="font-mono font-bold text-foreground">{winner.maskedCode}</span>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground font-medium">Draw</span>
                      <span className="font-bold text-foreground">#{winner.drawNumber}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground font-medium flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Vendor
                      </span>
                      <span className="font-medium text-foreground">{winner.vendorName || "Unknown"}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm pt-2">
                      <span className="text-muted-foreground/60 text-xs flex items-center gap-1">
                        <Clock className="w-3 h-3" /> 
                        {formatDistanceToNow(new Date(winner.claimedAt), { addSuffix: true })}
                      </span>
                    </div>
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
            <h3 className="text-xl font-bold text-foreground mb-2">No Winners Yet</h3>
            <p className="text-muted-foreground">The next big winner could be you!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
