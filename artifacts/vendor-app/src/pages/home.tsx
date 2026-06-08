import { useState } from "react";
import { useGetTicket, getGetTicketQueryKey, TicketStatus } from "@workspace/api-client-react";
import { AppLayout } from "../components/layout/app-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, AlertCircle, Ticket, Calendar, DollarSign, Loader2, User } from "lucide-react";

export default function Home() {
  const [ticketCode, setTicketCode] = useState("");
  const [searchedCode, setSearchedCode] = useState("");

  const { data: ticket, isLoading, error } = useGetTicket(searchedCode, {
    query: {
      enabled: !!searchedCode,
      queryKey: getGetTicketQueryKey(searchedCode),
      retry: false,
    }
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticketCode.trim().length > 0) {
      setSearchedCode(ticketCode.trim().toUpperCase());
    }
  };

  const getStatusColor = (status?: TicketStatus) => {
    switch (status) {
      case 'available': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'sold': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'validated': return 'bg-primary/10 text-primary border-primary/20';
      case 'claimed': return 'bg-green-100 text-green-800 border-green-200';
      case 'expired': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-black uppercase tracking-tight">Scan Ticket</h1>
          <p className="text-sm text-muted-foreground">Enter ticket code to check status instantly.</p>
        </div>

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
            <Input
              value={ticketCode}
              onChange={(e) => setTicketCode(e.target.value.toUpperCase())}
              placeholder="ENTER TICKET CODE"
              className="pl-12 h-14 text-xl font-mono font-bold uppercase bg-white shadow-sm focus-visible:ring-primary"
              maxLength={20}
              data-testid="input-ticket-code"
            />
          </div>
          <Button 
            type="submit" 
            className="w-full h-12 text-lg font-bold uppercase tracking-wider bg-black hover:bg-black/90 text-white"
            disabled={!ticketCode.trim()}
            data-testid="button-search-ticket"
          >
            Check Status
          </Button>
        </form>

        {isLoading && (
          <div className="flex flex-col items-center justify-center p-8 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-bold uppercase text-muted-foreground">Checking Ticket...</p>
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3 text-destructive">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold">Ticket Not Found</h4>
              <p className="text-sm">The code {searchedCode} does not match any valid ticket in the system.</p>
            </div>
          </div>
        )}

        {ticket && (
          <div className="bg-white border-2 border-black rounded-xl overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="bg-black text-white p-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5" />
                <span className="font-mono font-bold text-lg">{ticket.code}</span>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusColor(ticket.status)}`}>
                {ticket.status}
              </span>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Series</span>
                  <p className="font-mono font-bold text-lg">{ticket.series}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Price</span>
                  <p className="font-bold text-lg">${ticket.price.toFixed(2)}</p>
                </div>
              </div>

              <div className="border-t border-border pt-4 grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                    <Calendar className="w-3 h-3" />
                    <span>Draw</span>
                  </div>
                  <p className="font-bold">{ticket.drawNumber ? `#${ticket.drawNumber}` : 'N/A'}</p>
                </div>
                
                {ticket.status === 'sold' || ticket.status === 'validated' || ticket.status === 'claimed' ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                      <User className="w-3 h-3" />
                      <span>Vendor</span>
                    </div>
                    <p className="font-bold">{ticket.vendorName || `ID: ${ticket.vendorId}`}</p>
                  </div>
                ) : null}
              </div>

              {ticket.isWinner !== undefined && (
                <div className={`mt-4 p-4 border-2 rounded-lg ${ticket.isWinner ? 'bg-green-50 border-green-500' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wider">Result</span>
                    {ticket.isWinner ? (
                      <span className="font-black text-green-600 flex items-center gap-1">
                        <DollarSign className="w-4 h-4" /> WINNER
                      </span>
                    ) : (
                      <span className="font-bold text-gray-500">NO WIN</span>
                    )}
                  </div>
                  {ticket.isWinner && ticket.prizeAmount && (
                    <div className="mt-2 text-3xl font-black text-green-600">
                      ${ticket.prizeAmount.toFixed(2)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
