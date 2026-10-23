import { Suspense } from "react";
import PatientWorkspace from "@/components/patients/PatientWorkspace";

export const instant = false;

export default function PatientsPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 text-sm text-slate-600">
          Loading patients…
        </p>
      }
    >
      <PatientWorkspace />
    </Suspense>
  );
}
