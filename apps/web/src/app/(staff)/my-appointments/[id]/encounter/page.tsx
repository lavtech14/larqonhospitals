import { Suspense } from "react";
import DoctorEncounter from "@/components/encounters/DoctorEncounter";

type Props = {
  params: Promise<{ id: string }>;
};

async function EncounterContent({ params }: Props) {
  const { id } = await params;

  return <DoctorEncounter key={id} appointmentId={id} />;
}

export default function DoctorEncounterPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-slate-600">
          Loading clinical encounter…
        </p>
      }
    >
      <EncounterContent params={params} />
    </Suspense>
  );
}
