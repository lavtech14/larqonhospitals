import { Suspense } from "react";
import DoctorWorkspace from "@/components/doctors/DoctorWorkspace";

export const instant = false;

export default function DoctorsPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 text-sm text-slate-600">
          Loading doctors…
        </p>
      }
    >
      <DoctorWorkspace />
    </Suspense>
  );
}
