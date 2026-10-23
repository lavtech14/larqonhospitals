export const instant = false;
import { Suspense } from "react";
import ConsultationRoom from "@/components/consultations/ConsultationRoom";

type Props = {
  params: Promise<{ id: string }>;
};

async function PatientCall({ params }: Props) {
  const { id } = await params;

  return <ConsultationRoom appointmentId={id} audience="patient" />;
}

export default function PatientConsultationPage({ params }: Props) {
  return (
    <Suspense fallback={<p role="status">Loading consultation...</p>}>
      <PatientCall params={params} />
    </Suspense>
  );
}
