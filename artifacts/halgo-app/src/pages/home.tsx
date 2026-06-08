import { useState } from "react";
import { useGetTicket, getGetTicketQueryKey, useGetStats } from "@workspace/api-client-react";
import { Search, Trophy, ArrowRight, Star, AlertCircle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const [ticketCode, setTicketCode] = useState("");
  const [searchCode, setSearchCode] = useState("");

  const { data: stats, isLoading: statsLoading } = useGetStats();
  const { 
    data: ticket, 
    isLoading: ticketLoading, 
    isError 
  } = useGetTicket(searchCode, {
    query: {
      enabled: !!searchCode,
      queryKey: getGetTicketQueryKey(searchCode),
      retry: false
    }
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticketCode.trim()) {
      setSearchCode(ticketCode.trim().toUpperCase());
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-12">
      {/* Hero Section */}
      <section className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700 pt-8 md:pt-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/20 text-accent-foreground font-semibold text-sm mb-4 border border-accent/30 shadow-sm">
          <Star className="w-4 h-4" />
          <span>The DRC's Official Lottery</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tight text-foreground max-w-3xl mx-auto leading-[1.1]">
          Did you hit the <br className="hidden md:block"/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-amber-500">
            Jackpot today?
          </span>
        </h1>
        <p className="text-xl text-muted-foreground font-medium max-w-2xl mx-auto">
          Enter your ticket code below to see if you are a winner.
        </p>

        {/* Active Jackpot Banner */}
        {statsLoading ? (
          <Skeleton className="h-24 w-full max-w-md mx-auto rounded-3xl mt-8" />
        ) : stats?.activeDraw ? (
          <div className="mt-8 mx-auto max-w-md bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-6 text-primary-foreground shadow-2xl shadow-primary/30 transform hover:scale-[1.02] transition-transform duration-300">
            <h3 className="text-primary-foreground/80 font-bold uppercase tracking-wider text-sm mb-2">
              Next Draw: #{stats.activeDraw.drawNumber}
            </h3>
            <div className="text-4xl font-black mb-1">
              ${stats.activeDraw.jackpotAmount.toLocaleString()}
            </div>
            <p className="text-primary-foreground/90 font-medium">
              Buy a ticket before {new Date(stats.activeDraw.scheduledAt).toLocaleDateString()}
            </p>
          </div>
        ) : null}
      </section>

      {/* Check Ticket Section */}
      <section className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-10 duration-700 delay-150 fill-mode-both">
        <Card className="border-2 border-primary/20 shadow-2xl shadow-primary/5 bg-card/50 backdrop-blur-xl overflow-hidden rounded-3xl">
          <CardContent className="p-8 md:p-12">
            <form onSubmit={handleSearch} className="space-y-6">
              <div className="space-y-2 text-center mb-8">
                <h2 className="text-3xl font-black">Check Your Ticket</h2>
                <p className="text-muted-foreground">Type your 8-12 character code</p>
              </div>
              
              <div className="relative group">
                <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                  <Search className="h-6 w-6 text-muted-foreground group-focus-within:text-primary transition-colors" />
                </div>
                <Input
                  type="text"
                  value={ticketCode}
                  onChange={(e) => setTicketCode(e.target.value)}
                  placeholder="e.g. HLG-12345"
                  className="pl-16 pr-6 py-8 text-2xl md:text-3xl font-bold uppercase tracking-widest text-center rounded-2xl bg-muted/50 border-2 border-transparent focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20 transition-all placeholder:text-muted-foreground/40 placeholder:font-medium placeholder:tracking-normal"
                />
              </div>

              <Button 
                type="submit" 
                size="lg" 
                className="w-full h-16 text-lg font-bold rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20 group"
                disabled={!ticketCode.trim() || ticketLoading}
              >
                {ticketLoading ? (
                  <span className="animate-pulse">Checking...</span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Reveal Result <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                )}
              </Button>
            </form>

            {/* Results Area */}
            <div className="mt-8">
              {ticketLoading && (
                <div className="space-y-4">
                  <Skeleton className="h-32 w-full rounded-2xl" />
                </div>
              )}

              {isError && (
                <div className="bg-destructive/10 border-2 border-destructive/20 text-destructive rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-3 animate-in zoom-in-95 duration-300">
                  <AlertCircle className="w-10 h-10" />
                  <div>
                    <h3 className="font-bold text-lg">Ticket Not Found</h3>
                    <p className="text-destructive/80 font-medium text-sm">Please check the code and try again.</p>
                  </div>
                </div>
              )}

              {ticket && !ticketLoading && (
                <div className={`rounded-2xl p-8 border-2 flex flex-col items-center justify-center text-center space-y-4 animate-in zoom-in-95 duration-500 shadow-2xl ${
                  ticket.isWinner 
                    ? "bg-accent/10 border-accent text-accent-foreground shadow-accent/20" 
                    : "bg-muted/50 border-border/50 text-foreground"
                }`}>
                  {ticket.isWinner ? (
                    <>
                      <div className="w-20 h-20 rounded-full bg-accent text-accent-foreground flex items-center justify-center mb-2 animate-bounce">
                        <Trophy className="w-10 h-10" />
                      </div>
                      <div>
                        <Badge variant="outline" className="mb-3 bg-accent/20 text-accent-foreground border-accent/30 px-3 py-1 font-bold text-sm uppercase tracking-widest">
                          Winner
                        </Badge>
                        <h3 className="font-black text-4xl mb-2 text-foreground">
                          ${ticket.prizeAmount?.toLocaleString()}
                        </h3>
                        <p className="font-medium text-muted-foreground">
                          Congratulations! Your ticket is a winner in draw #{ticket.drawNumber}.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-2">
                        <CheckCircle2 className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="font-bold text-2xl mb-2">Not a Winner</h3>
                        <p className="font-medium text-muted-foreground">
                          This ticket did not win in draw #{ticket.drawNumber}. Better luck next time!
                        </p>
                      </div>
                    </>
                  )}
                  
                  <div className="w-full h-px bg-border/50 my-2" />
                  
                  <div className="grid grid-cols-2 gap-4 w-full text-left text-sm">
                    <div>
                      <p className="text-muted-foreground font-medium mb-1">Code</p>
                      <p className="font-mono font-bold">{ticket.code}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground font-medium mb-1">Status</p>
                      <p className="font-bold capitalize">{ticket.status}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
