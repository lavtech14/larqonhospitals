import { Suspense } from "react";
import BillingPricesWorkspace from "@/components/billing/BillingPricesWorkspace";
export const instant = false;
export default function Page() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6">
          Loading billing…
        </p>
      }
    >
      <BillingPricesWorkspace />
    </Suspense>
  );
}
