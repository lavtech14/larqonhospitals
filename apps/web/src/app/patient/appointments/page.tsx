import { Suspense } from "react";
import PatientAppointmentList from "@/components/patient-portal/PatientAppointmentList";

export const instant = false;

export default function PatientAppointmentsPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 text-sm text-slate-600">
          Loading your appointments…
        </p>
      }
    >
      <PatientAppointmentList />
    </Suspense>
  );
}
