import { Suspense } from "react";
import StaffWorkspace from "@/components/staff/StaffWorkspace";

export const instant = false;

export default function StaffPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 text-sm text-slate-600">
          Loading staff accounts…
        </p>
      }
    >
      <StaffWorkspace />
    </Suspense>
  );
}
