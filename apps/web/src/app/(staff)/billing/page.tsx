import { Suspense } from "react";
import BillingWorkspace from "@/components/billing/BillingWorkspace";
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
      <BillingWorkspace />
    </Suspense>
  );
}
