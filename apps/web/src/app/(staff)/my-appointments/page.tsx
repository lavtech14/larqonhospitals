import { Suspense } from "react";
import AppointmentWorkspace from "@/components/appointments/AppointmentWorkspace";

export const instant = false;

export default function MyAppointmentsPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 text-sm text-slate-600">
          Loading your appointments…
        </p>
      }
    >
      <AppointmentWorkspace scope="mine" />
    </Suspense>
  );
}
