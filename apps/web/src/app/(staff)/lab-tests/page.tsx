import { Suspense } from "react";

import LabTestWorkspace from "@/components/lab-tests/LabTestWorkspace";

export const instant = false;

export default function LabTestsPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 text-sm text-slate-600">
          Loading lab-test catalogue…
        </p>
      }
    >
      <LabTestWorkspace />
    </Suspense>
  );
}
