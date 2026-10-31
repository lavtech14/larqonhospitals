import { Suspense } from "react";
import NursingQueue from "@/components/nursing/NursingQueue";

export default function NursingPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-slate-600">
          Loading nursing workspace…
        </p>
      }
    >
      <NursingQueue />
    </Suspense>
  );
}
