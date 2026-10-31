import { Suspense } from "react";
import BillingInvoiceWorkspace from "@/components/billing/BillingInvoiceWorkspace";
export const instant = false;
async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BillingInvoiceWorkspace key={id} id={id} />;
}
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6">
          Loading invoice…
        </p>
      }
    >
      <Content params={params} />
    </Suspense>
  );
}
