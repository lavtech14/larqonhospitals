import { Suspense } from "react";

import { PatientVisitDetails } from "@/components/patient-portal/PatientVisits";

export const instant = false;

type Props = {
  params: Promise<{
    id: string;
  }>;
};

async function VisitContent({ params }: Props) {
  const { id } = await params;

  return <PatientVisitDetails key={id} visitId={id} />;
}

export default function PatientVisitPage(props: Props) {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 text-sm text-slate-600">
          Loading your visit…
        </p>
      }
    >
      <VisitContent {...props} />
    </Suspense>
  );
}
