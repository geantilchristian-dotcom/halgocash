import { createContext, useContext, useState, ReactNode } from "react";
import { useListVendors } from "@workspace/api-client-react";

interface VendorContextType {
  selectedVendorId: number | null;
  setSelectedVendorId: (id: number | null) => void;
  vendorName: string | null;
}

const VendorContext = createContext<VendorContextType | undefined>(undefined);

export function VendorProvider({ children }: { children: ReactNode }) {
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null);
  
  const { data: vendors } = useListVendors();
  const selectedVendor = vendors?.find((v) => v.id === selectedVendorId);

  return (
    <VendorContext.Provider
      value={{
        selectedVendorId,
        setSelectedVendorId,
        vendorName: selectedVendor?.name ?? null,
      }}
    >
      {children}
    </VendorContext.Provider>
  );
}

export function useVendor() {
  const context = useContext(VendorContext);
  if (context === undefined) {
    throw new Error("useVendor must be used within a VendorProvider");
  }
  return context;
}
