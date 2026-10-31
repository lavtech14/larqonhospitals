import { Suspense } from "react";
import PrescriptionWorkspace from "@/components/prescriptions/PrescriptionWorkspace";

type Props = {
  params: Promise<{ id: string }>;
};

async function Content({ params }: Props) {
  const { id } = await params;

  return <PrescriptionWorkspace key={id} appointmentId={id} />;
}

export default function PrescriptionsPage({ params }: Props) {
  return (
    <Suspense fallback={<p role="status">Loading prescriptions…</p>}>
      <Content params={params} />
    </Suspense>
  );
}
