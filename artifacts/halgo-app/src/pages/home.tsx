import { useState } from "react";
import { 
  useCheckBalance, 
  useListDestinations, 
  useListTransactions, 
  useCreateBooking, 
  useGetBookingSummary,
  useHealthCheck,
  getListTransactionsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowRight, Wallet, History, Ticket, Search, ShieldCheck, MapPin, Receipt, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// Halgo Homepage Component
export default function Home() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Call health check as requested (ignored in UI)
  useHealthCheck();
  
  // State
  const [code, setCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [balanceData, setBalanceData] = useState<{ balance: number; currency: string; ownerName: string | null } | null>(null);

  // Queries & Mutations
  const checkBalanceMutation = useCheckBalance();
  const { data: destinations, isLoading: isLoadingDestinations } = useListDestinations();
  const { data: transactions, isLoading: isLoadingTransactions } = useListTransactions(
    { code: code || undefined },
    { query: { enabled: !!code, queryKey: getListTransactionsQueryKey({ code }) } }
  );
  const { data: summary } = useGetBookingSummary();
  const createBookingMutation = useCreateBooking();

  // Booking Form Schema
  const bookingSchema = z.object({
    destinationId: z.coerce.number().min(1, "Please select a destination"),
    quantity: z.coerce.number().min(1, "Must select at least 1 ticket").max(10, "Maximum 10 tickets"),
    ticketType: z.string().min(1, "Please select a ticket type"),
  });

  const form = useForm<z.infer<typeof bookingSchema>>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      destinationId: 0,
      quantity: 1,
      ticketType: "standard",
    },
  });

  const handleCheckBalance = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode.length !== 10) {
      toast({
        title: "Invalid Code",
        description: "Please enter a valid 10-digit code.",
        variant: "destructive"
      });
      return;
    }
    
    checkBalanceMutation.mutate({ data: { code: inputCode } }, {
      onSuccess: (data) => {
        setBalanceData(data);
        setCode(inputCode);
        toast({
          title: "Balance Checked",
          description: "Successfully retrieved your account balance.",
        });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to check balance. Please check your code and try again.",
          variant: "destructive"
        });
      }
    });
  };

  const onSubmitBooking = (values: z.infer<typeof bookingSchema>) => {
    if (!code) {
      toast({
        title: "Code Required",
        description: "Please check your balance first to verify your code.",
        variant: "destructive"
      });
      return;
    }

    createBookingMutation.mutate(
      { 
        data: { 
          code, 
          destinationId: values.destinationId, 
          quantity: values.quantity, 
          ticketType: values.ticketType 
        } 
      },
      {
        onSuccess: () => {
          toast({
            title: "Booking Successful!",
            description: "Your ticket has been booked and payment confirmed.",
          });
          form.reset({
            destinationId: 0,
            quantity: 1,
            ticketType: "standard"
          });
          // Refresh transactions and balance
          queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey({ code }) });
          checkBalanceMutation.mutate({ data: { code } }, {
            onSuccess: (data) => setBalanceData(data)
          });
        },
        onError: () => {
          toast({
            title: "Booking Failed",
            description: "There was an error processing your booking or payment.",
            variant: "destructive"
          });
        }
      }
    );
  };

  // Format currency helper
  const formatCurrency = (amount: number, currency: string = "CDF") => {
    return new Intl.NumberFormat('en-CD', { style: 'currency', currency }).format(amount);
  };

  return (
    <div className="min-h-[100dvh] bg-muted/40 pb-20">
      {/* Header */}
      <header className="bg-primary text-primary-foreground pt-12 pb-6 px-6 rounded-b-3xl shadow-md sticky top-0 z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Halgo</h1>
          </div>
          <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30 border-none font-medium">
            DRC Transport
          </Badge>
        </div>

        {!balanceData ? (
          <form onSubmit={handleCheckBalance} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code" className="text-primary-foreground/80 font-medium">Enter your 10-digit code</Label>
              <div className="flex gap-2">
                <Input 
                  id="code" 
                  type="text" 
                  inputMode="numeric"
                  placeholder="e.g. 1234567890" 
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-12 text-lg focus-visible:ring-accent"
                  data-testid="input-code"
                />
                <Button 
                  type="submit" 
                  className="h-12 px-6 bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={inputCode.length !== 10 || checkBalanceMutation.isPending}
                  data-testid="button-check-balance"
                >
                  {checkBalanceMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <p className="text-primary-foreground/80 font-medium text-sm">
              Hello, {balanceData.ownerName || "Valued Customer"}
            </p>
            <div className="flex items-end gap-2">
              <h2 className="text-4xl font-bold tracking-tight" data-testid="text-balance">
                {formatCurrency(balanceData.balance, balanceData.currency)}
              </h2>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-primary-foreground/60 text-xs flex items-center gap-1">
                <Activity className="w-3 h-3" /> Live Balance
              </p>
              {summary && (
                <p className="text-primary-foreground/60 text-xs text-right">
                  System Stats: {summary.totalBookings} tickets booked
                </p>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="px-4 py-6 space-y-6 max-w-md mx-auto">
        
        {/* Booking Section */}
        <section>
          <div className="flex items-center gap-2 mb-3 px-2">
            <Ticket className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Book a Ticket</h3>
          </div>
          
          <Card className="border-none shadow-md overflow-hidden bg-card/60 backdrop-blur-sm">
            <CardContent className="p-0">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmitBooking)} className="p-5 space-y-5">
                  
                  <FormField
                    control={form.control}
                    name="destinationId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground/80">Destination</FormLabel>
                        <Select 
                          onValueChange={(val) => field.onChange(parseInt(val, 10))} 
                          value={field.value ? field.value.toString() : ""}
                          disabled={isLoadingDestinations || !code}
                        >
                          <FormControl>
                            <SelectTrigger className="h-12 bg-background" data-testid="select-destination">
                              <SelectValue placeholder="Select where you're going" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {destinations?.map((dest) => (
                              <SelectItem key={dest.id} value={dest.id.toString()}>
                                <div className="flex justify-between items-center w-full min-w-[200px]">
                                  <span>{dest.name} {dest.zone ? `(${dest.zone})` : ""}</span>
                                  <span className="font-medium text-primary ml-4">
                                    {formatCurrency(dest.price)}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground/80">Passengers</FormLabel>
                          <Select 
                            onValueChange={(val) => field.onChange(parseInt(val, 10))} 
                            value={field.value.toString()}
                            disabled={!code}
                          >
                            <FormControl>
                              <SelectTrigger className="h-12 bg-background" data-testid="select-quantity">
                                <SelectValue placeholder="Qty" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {[1, 2, 3, 4, 5].map((num) => (
                                <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="ticketType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-foreground/80">Class</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={!code}>
                            <FormControl>
                              <SelectTrigger className="h-12 bg-background" data-testid="select-type">
                                <SelectValue placeholder="Class" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="standard">Standard</SelectItem>
                              <SelectItem value="premium">Premium</SelectItem>
                              <SelectItem value="vip">VIP</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-14 text-base font-bold shadow-lg shadow-primary/20"
                    disabled={!code || createBookingMutation.isPending}
                    data-testid="button-confirm-payment"
                  >
                    {createBookingMutation.isPending ? (
                      <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...</>
                    ) : (
                      <>Confirm Payment <ArrowRight className="ml-2 h-5 w-5" /></>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </section>

        {/* Transactions Section */}
        {code && (
          <section className="animate-in fade-in slide-in-from-bottom-8 duration-500 delay-150 fill-mode-both">
            <div className="flex items-center justify-between mb-3 px-2">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">Recent Activity</h3>
              </div>
            </div>

            <Card className="border-none shadow-sm bg-card/60 backdrop-blur-sm">
              <CardContent className="p-0">
                {isLoadingTransactions ? (
                  <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                    <Loader2 className="w-6 h-6 animate-spin mb-2 text-primary" />
                    <p>Loading activity...</p>
                  </div>
                ) : transactions && transactions.length > 0 ? (
                  <div className="divide-y divide-border/50">
                    {transactions.map((tx) => (
                      <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.amount < 0 ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                            {tx.amount < 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{tx.description || tx.type}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(tx.date), "MMM d, yyyy • h:mm a")}
                            </p>
                          </div>
                        </div>
                        <div className={`font-bold ${tx.amount < 0 ? 'text-foreground' : 'text-primary'}`}>
                          {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                    <Receipt className="w-10 h-10 mb-3 text-muted-foreground/30" />
                    <p>No recent activity found.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}
      </main>
    </div>
  );
}
