import { Suspense } from "react";
import AppointmentWorkspace from "@/components/appointments/AppointmentWorkspace";

export const instant = false;

export default function AppointmentsPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 text-sm text-slate-600">
          Loading appointments…
        </p>
      }
    >
      <AppointmentWorkspace />
    </Suspense>
  );
}
