import { useState, useRef } from "react";
import { useValidateTicket, getGetTicketQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "../components/layout/app-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useVendor } from "../lib/vendor-context";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, AlertCircle, ShoppingCart } from "lucide-react";

export default function Validate() {
  const [ticketCode, setTicketCode] = useState("");
  const { selectedVendorId } = useVendor();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const validateMutation = useValidateTicket({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetTicketQueryKey(data.code), data);
        toast({
          title: "Sale Confirmed",
          description: `Ticket ${data.code} successfully sold.`,
          className: "bg-primary text-primary-foreground border-none font-bold",
        });
        setTicketCode("");
        if (inputRef.current) {
          inputRef.current.focus();
        }
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Validation Failed",
          description: err?.message || "Failed to process sale. Check if ticket is already sold.",
          className: "font-bold",
        });
      }
    }
  });

  const handleValidate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketCode.trim() || !selectedVendorId) return;

    validateMutation.mutate({
      code: ticketCode.trim().toUpperCase(),
      data: { vendorId: selectedVendorId }
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6 h-full flex flex-col">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-black text-white rounded-md text-xs font-bold uppercase tracking-wider mb-2">
            <ShoppingCart className="w-3.5 h-3.5" /> POS Mode
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight">Sell Ticket</h1>
          <p className="text-sm text-muted-foreground">Scan or enter ticket code to record a sale to a customer.</p>
        </div>

        <form onSubmit={handleValidate} className="space-y-6 mt-8 flex-1 flex flex-col">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider ml-1">Ticket Code</label>
              <Input
                ref={inputRef}
                value={ticketCode}
                onChange={(e) => setTicketCode(e.target.value.toUpperCase())}
                placeholder="XXX-YYYY-ZZZ"
                className="h-16 text-2xl font-mono font-black uppercase text-center bg-white shadow-sm border-2 border-black focus-visible:ring-primary focus-visible:ring-offset-2"
                maxLength={20}
                autoFocus
                data-testid="input-validate-code"
              />
            </div>
          </div>

          <div className="mt-auto pb-4">
            <Button 
              type="submit" 
              className="w-full h-16 text-xl font-black uppercase tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_4px_0_0_#000] active:translate-y-1 active:shadow-[0_0px_0_0_#000] transition-all border-2 border-black"
              disabled={!ticketCode.trim() || !selectedVendorId || validateMutation.isPending}
              data-testid="button-validate-ticket"
            >
              {validateMutation.isPending ? (
                <span className="flex items-center gap-2">Processing...</span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-6 h-6" /> Confirm Sale
                </span>
              )}
            </Button>
            
            {!selectedVendorId && (
              <div className="mt-4 flex items-start gap-2 text-destructive text-sm font-bold bg-destructive/10 p-3 rounded-md">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>You must select a vendor profile from the header before making a sale.</p>
              </div>
            )}
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
