import { useListVendors } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Store } from "lucide-react";

export default function Vendors() {
  const { data: vendors, isLoading } = useListVendors();

  // Filter out inactive vendors if needed, or just show active ones
  const activeVendors = vendors?.filter(v => v.status === 'active') || [];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="space-y-2">
        <h1 className="text-4xl font-black tracking-tight text-foreground">Find a Vendor</h1>
        <p className="text-lg text-muted-foreground">Buy your Halgo Cash tickets from an authorized vendor near you.</p>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : activeVendors.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-6">
          {activeVendors.map((vendor) => (
            <Card key={vendor.id} className="overflow-hidden rounded-2xl border-border/50 shadow-sm hover:shadow-md transition-shadow group">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Store className="w-6 h-6" />
                  </div>
                  <div className="space-y-3 flex-1">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="font-bold text-lg text-foreground line-clamp-1">{vendor.name}</h3>
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-green-500/10 text-green-600 border-green-500/20 shrink-0">
                          Active
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 mt-3">
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                          <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-foreground/50" />
                          <span className="leading-snug">{vendor.location}</span>
                        </div>
                        
                        {vendor.phone && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="w-4 h-4 shrink-0 text-foreground/50" />
                            <span className="font-mono">{vendor.phone}</span>
                          </div>
                        )}
                      </div>
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
            <Store className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-xl font-bold text-foreground mb-2">No Vendors Available</h3>
            <p className="text-muted-foreground">We couldn't find any active vendors at the moment.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
