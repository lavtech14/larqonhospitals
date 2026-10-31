import { Suspense } from "react";

import PatientVisits from "@/components/patient-portal/PatientVisits";

export const instant = false;

export default function PatientVisitsPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 text-sm text-slate-600">
          Loading your visits…
        </p>
      }
    >
      <PatientVisits />
    </Suspense>
  );
}
