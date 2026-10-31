import { Suspense } from "react";

import LabResultsWorkspace from "@/components/lab/LabResultsWorkspace";

export const instant = false;

export default function LabResultsPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 text-sm text-slate-600">
          Loading laboratory results…
        </p>
      }
    >
      <LabResultsWorkspace />
    </Suspense>
  );
}
