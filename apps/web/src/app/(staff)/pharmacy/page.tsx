import { Suspense } from "react";
import PharmacyWorkspace from "@/components/pharmacy/PharmacyWorkspace";
export const instant = false;
export default function PharmacyPage() {
  return (
    <Suspense
      fallback={
        <p className="p-6" role="status">
          Loading pharmacy…
        </p>
      }
    >
      <PharmacyWorkspace />
    </Suspense>
  );
}
