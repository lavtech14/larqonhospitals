import { Suspense } from "react";
import AppointmentBookingWorkspace from "@/components/appointments/AppointmentBookingWorkspace";

export const instant = false;

export default function NewAppointmentPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 text-sm text-slate-600">
          Loading appointment booking…
        </p>
      }
    >
      <AppointmentBookingWorkspace />
    </Suspense>
  );
}
