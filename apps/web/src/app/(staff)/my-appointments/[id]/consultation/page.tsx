export const instant = false;
import { Suspense } from "react";
import ConsultationRoom from "@/components/consultations/ConsultationRoom";

type Props = {
  params: Promise<{ id: string }>;
};

async function DoctorCall({ params }: Props) {
  const { id } = await params;

  return <ConsultationRoom appointmentId={id} audience="doctor" />;
}

export default function DoctorConsultationPage({ params }: Props) {
  return (
    <Suspense fallback={<p role="status">Loading consultation...</p>}>
      <DoctorCall params={params} />
    </Suspense>
  );
}
