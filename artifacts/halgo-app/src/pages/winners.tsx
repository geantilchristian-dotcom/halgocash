import { useListWinners } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Clock, MapPin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

function formatFC(n: number | string) {
  const num = typeof n === "string" ? parseFloat(n) : n;
  return new Intl.NumberFormat("fr-FR").format(Math.round(num)).replace(/\s/g, ".") + " FC";
}

export default function Winners() {
  const { data: winners, isLoading } = useListWinners();

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500 pb-24 px-4 pt-4">
      <div className="space-y-1">
        <h1 className="text-3xl font-black tracking-tight text-foreground">Palmarès des Gagnants</h1>
        <p className="text-base text-muted-foreground">Les derniers gagnants du jackpot Halgo Cash !</p>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : winners && winners.length > 0 ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {winners.map((winner) => (
            <Card key={winner.id} className="overflow-hidden rounded-2xl border-border/50 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-card to-card/50">
              <CardContent className="p-5 relative">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Trophy className="w-20 h-20" />
                </div>

                <div className="relative z-10 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="w-11 h-11 rounded-xl bg-yellow-400/20 text-yellow-500 flex items-center justify-center border border-yellow-400/30">
                      <Trophy className="w-5 h-5" />
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-foreground">
                        {formatFC(winner.prizeAmount)}
                      </p>
                      <span className="text-[10px] font-black text-yellow-700 dark:text-yellow-400 uppercase tracking-widest bg-yellow-400/10 inline-block px-2 py-0.5 rounded mt-1">
                        Prix réclamé
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-border/50">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground font-medium">Ticket gagnant</span>
                      <span className="font-mono font-bold text-foreground">{winner.maskedCode}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground font-medium">Tirage</span>
                      <span className="font-bold text-foreground">#{winner.drawNumber}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground font-medium flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Vendeur
                      </span>
                      <span className="font-medium text-foreground">{winner.vendorName || "—"}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm pt-1">
                      <span className="text-muted-foreground/60 text-xs flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(winner.claimedAt), { addSuffix: true, locale: fr })}
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
            <h3 className="text-xl font-bold text-foreground mb-2">Aucun gagnant pour l'instant</h3>
            <p className="text-muted-foreground">Le prochain grand gagnant, c'est peut-être vous !</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
