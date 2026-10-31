import { Suspense } from "react";
import IssuedPrescription from "@/components/prescriptions/IssuedPrescription";

type Props = {
  params: Promise<{
    id: string;
    prescriptionId: string;
  }>;
};

async function Content({ params }: Props) {
  const { id, prescriptionId } = await params;

  return (
    <IssuedPrescription
      key={`${id}:${prescriptionId}`}
      appointmentId={id}
      prescriptionId={prescriptionId}
    />
  );
}

export default function PrintPage({ params }: Props) {
  return (
    <Suspense fallback={<p role="status">Loading prescription…</p>}>
      <Content params={params} />
    </Suspense>
  );
}
