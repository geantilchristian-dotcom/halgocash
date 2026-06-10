import { useListDraws } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Calendar, Hash, Trophy, Ticket } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

function formatFC(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/\s/g, ".") + " FC";
}

const STATUS_LABEL: Record<string, string> = {
  active:    "En cours",
  upcoming:  "À venir",
  completed: "Terminé",
};
const STATUS_CLASS: Record<string, string> = {
  active:    "text-primary border-primary/30 bg-primary/10",
  upcoming:  "text-yellow-600 border-yellow-400/30 bg-yellow-400/10",
  completed: "text-muted-foreground border-muted-foreground/30 bg-muted",
};

export default function Draws() {
  const { data: draws, isLoading } = useListDraws();

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500 pb-24 px-4 pt-4">
      <div className="space-y-1">
        <h1 className="text-3xl font-black tracking-tight text-foreground">Tirages Jackpot</h1>
        <p className="text-base text-muted-foreground">Résultats des tirages hebdomadaires Halgo Cash.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : draws && draws.length > 0 ? (
        <div className="grid gap-4">
          {draws.map((draw) => (
            <Card key={draw.id} className="overflow-hidden rounded-2xl border-border/50 shadow-md">
              <div className={`h-1.5 w-full ${
                draw.status === "active"    ? "bg-primary" :
                draw.status === "upcoming"  ? "bg-yellow-400" :
                "bg-muted-foreground/30"
              }`} />
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={`font-bold uppercase tracking-wider text-xs px-2 py-1 ${STATUS_CLASS[draw.status] ?? STATUS_CLASS.completed}`}>
                        {STATUS_LABEL[draw.status] ?? draw.status}
                      </Badge>
                      <span className="font-bold text-foreground flex items-center gap-1">
                        <Hash className="w-4 h-4 text-muted-foreground" />
                        Tirage {draw.drawNumber}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-0.5 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" /> Date
                        </p>
                        <p className="font-semibold text-foreground text-sm">
                          {format(new Date(draw.scheduledAt), "d MMMM yyyy", { locale: fr })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-0.5 flex items-center gap-1">
                          <Ticket className="w-3.5 h-3.5" /> Tickets vendus
                        </p>
                        <p className="font-semibold text-foreground text-sm">
                          {draw.totalTicketsSold.toLocaleString("fr-FR")}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="sm:border-l sm:border-border/50 sm:pl-5 flex flex-col sm:items-end justify-center space-y-3 min-w-[160px]">
                    <div className="sm:text-right">
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Jackpot</p>
                      <p className="text-2xl font-black text-foreground">
                        {formatFC(draw.jackpotAmount)}
                      </p>
                    </div>

                    {draw.status === "completed" && draw.winningTicketCode && (
                      <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-xl p-3 flex items-center gap-2 w-full sm:w-auto">
                        <Trophy className="w-4 h-4 text-yellow-500 shrink-0" />
                        <div>
                          <p className="text-[10px] font-black text-yellow-700 dark:text-yellow-400 uppercase tracking-widest">Code gagnant</p>
                          <p className="font-mono font-bold text-foreground text-sm">{draw.winningTicketCode}</p>
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
            <h3 className="text-xl font-bold text-foreground mb-2">Aucun tirage</h3>
            <p className="text-muted-foreground">Les résultats des tirages s'afficheront ici.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
