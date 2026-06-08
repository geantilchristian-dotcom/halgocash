import { useState } from "react";
import { useListVendors, useCreateVendor, getListVendorsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Vendors() {
  const { data: vendors } = useListVendors();
  const createVendor = useCreateVendor();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");

  const handleCreate = () => {
    createVendor.mutate({ data: { name, location, phone } }, {
      onSuccess: () => {
        setIsCreateOpen(false);
        queryClient.invalidateQueries({ queryKey: getListVendorsQueryKey() });
        toast({ title: "Vendor created" });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Vendors</h2>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Vendor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register Vendor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Location</label>
                <Input value={location} onChange={e => setLocation(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={createVendor.isPending}>
                Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total Sales</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendors?.map(vendor => (
              <TableRow key={vendor.id}>
                <TableCell className="font-medium">
                  {vendor.name}
                  <div className="text-xs text-muted-foreground">{vendor.phone}</div>
                </TableCell>
                <TableCell>{vendor.location}</TableCell>
                <TableCell>
                  <Badge variant={vendor.status === 'active' ? 'default' : 'secondary'}>
                    {vendor.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{vendor.totalSales?.toLocaleString() || 0}</TableCell>
                <TableCell className="text-right">{formatCurrency(vendor.totalRevenue || 0)}</TableCell>
              </TableRow>
            ))}
            {vendors?.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-4">No vendors found</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
