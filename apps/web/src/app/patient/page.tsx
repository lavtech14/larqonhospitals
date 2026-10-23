import { Suspense } from "react";
import PatientPortalHome from "@/components/patient-portal/PatientPortalHome";

export const instant = false;

export default function PatientHomePage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 text-sm text-slate-600">
          Loading patient portal…
        </p>
      }
    >
      <PatientPortalHome />
    </Suspense>
  );
}
