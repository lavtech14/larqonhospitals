import { Suspense } from "react";

import LabQueue from "@/components/lab/LabQueue";

export const instant = false;

export default function LabPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 text-sm text-slate-600">
          Loading laboratory workspace…
        </p>
      }
    >
      <LabQueue />
    </Suspense>
  );
}
