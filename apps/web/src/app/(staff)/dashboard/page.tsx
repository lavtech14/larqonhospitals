import { Suspense } from "react";
import StaffOverview from "@/components/dashboard/StaffOverview";

export const instant = false;

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 text-sm text-slate-600">
          Loading overview…
        </p>
      }
    >
      <StaffOverview />
    </Suspense>
  );
}
