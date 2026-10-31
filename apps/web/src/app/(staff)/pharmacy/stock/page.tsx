import { Suspense } from "react";
import PharmacyStockWorkspace from "@/components/pharmacy/PharmacyStockWorkspace";
export const instant = false;
export default function PharmacyStockPage() {
  return (
    <Suspense
      fallback={
        <p className="p-6" role="status">
          Loading stock…
        </p>
      }
    >
      <PharmacyStockWorkspace />
    </Suspense>
  );
}
