import { Suspense } from "react";
import PharmacyPrescriptionWorkspace from "@/components/pharmacy/PharmacyPrescriptionWorkspace";
export const instant = false;
async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PharmacyPrescriptionWorkspace key={id} id={id} />;
}
export default function PharmacyPrescriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <p className="p-6" role="status">
          Loading prescription…
        </p>
      }
    >
      <Content params={params} />
    </Suspense>
  );
}
