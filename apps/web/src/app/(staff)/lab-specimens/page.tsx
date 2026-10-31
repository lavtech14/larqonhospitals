import { Suspense } from "react";

import LabSpecimenRejections from "@/components/lab/LabSpecimenRejections";

export const instant = false;

export default function LabSpecimensPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 text-sm text-slate-600">
          Loading specimens…
        </p>
      }
    >
      <LabSpecimenRejections />
    </Suspense>
  );
}
