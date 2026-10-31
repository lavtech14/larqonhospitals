import { Suspense } from "react";
import CreateBillingInvoiceWorkspace from "@/components/billing/CreateBillingInvoiceWorkspace";
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
      <CreateBillingInvoiceWorkspace />
    </Suspense>
  );
}
