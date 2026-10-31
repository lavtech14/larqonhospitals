import { Suspense } from "react";

import MedicineWorkspace from "@/components/medicines/MedicineWorkspace";

export default function MedicinesPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-slate-500">
          Loading medicine catalogue…
        </p>
      }
    >
      <MedicineWorkspace />
    </Suspense>
  );
}
