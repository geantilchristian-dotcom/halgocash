import { useState } from "react";
import { useClaimPrize, getGetTicketQueryKey, ClaimResult } from "@workspace/api-client-react";
import { AppLayout } from "../components/layout/app-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useVendor } from "../lib/vendor-context";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Trophy, AlertCircle, DollarSign, CheckCircle2 } from "lucide-react";

export default function Claim() {
  const [ticketCode, setTicketCode] = useState("");
  const [lastClaim, setLastClaim] = useState<ClaimResult | null>(null);
  const { selectedVendorId } = useVendor();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const claimMutation = useClaimPrize({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetTicketQueryKey(data.ticket.code), data.ticket);
        setLastClaim(data);
        setTicketCode("");
        toast({
          title: "Prize Claimed",
          description: "Payout recorded successfully.",
          className: "bg-green-600 text-white border-none font-bold",
        });
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Claim Failed",
          description: err?.message || "Could not process claim. Ticket may not be a winner or already claimed.",
          className: "font-bold",
        });
      }
    }
  });

  const handleClaim = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketCode.trim() || !selectedVendorId) return;
    setLastClaim(null);

    claimMutation.mutate({
      code: ticketCode.trim().toUpperCase(),
      data: { vendorId: selectedVendorId }
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-md text-xs font-bold uppercase tracking-wider mb-2 border border-green-200">
            <Trophy className="w-3.5 h-3.5" /> Payout Mode
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight">Claim Prize</h1>
          <p className="text-sm text-muted-foreground">Process winning tickets and record cash payouts.</p>
        </div>

        <form onSubmit={handleClaim} className="space-y-4 bg-white p-5 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider ml-1">Winning Ticket Code</label>
            <Input
              value={ticketCode}
              onChange={(e) => setTicketCode(e.target.value.toUpperCase())}
              placeholder="ENTER CODE"
              className="h-14 text-xl font-mono font-bold uppercase bg-gray-50 focus-visible:ring-green-500 focus-visible:border-green-500"
              maxLength={20}
              data-testid="input-claim-code"
            />
          </div>

          <Button 
            type="submit" 
            className="w-full h-14 text-lg font-black uppercase tracking-wider bg-black hover:bg-black/90 text-white"
            disabled={!ticketCode.trim() || !selectedVendorId || claimMutation.isPending}
            data-testid="button-submit-claim"
          >
            {claimMutation.isPending ? "Verifying..." : "Process Claim"}
          </Button>
          
          {!selectedVendorId && (
            <div className="flex items-start gap-2 text-destructive text-xs font-bold mt-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>Select vendor to process payouts.</p>
            </div>
          )}
        </form>

        {lastClaim && (
          <div className="bg-green-50 border-2 border-green-600 rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-green-600 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> 
                PAYOUT APPROVED
              </h3>
            </div>
            <div className="p-6 flex flex-col items-center justify-center text-center space-y-4">
              <div className="text-sm font-bold text-green-800 uppercase tracking-widest">
                Pay Customer
              </div>
              <div className="text-5xl font-black text-green-700 flex items-center">
                <DollarSign className="w-10 h-10 -mr-1" />
                {lastClaim.prizeAmount.toFixed(2)}
              </div>
              <div className="bg-green-100 px-4 py-2 rounded-md border border-green-200 w-full mt-4">
                <p className="text-xs font-bold text-green-800 uppercase">Ticket {lastClaim.ticket.code}</p>
                <p className="text-xs text-green-700 mt-1">{lastClaim.message}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
