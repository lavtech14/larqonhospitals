import { Suspense } from "react";
import DepartmentWorkspace from "@/components/departments/DepartmentWorkspace";

export const instant = false;

export default function DepartmentsPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 text-sm text-slate-600">
          Loading departments…
        </p>
      }
    >
      <DepartmentWorkspace />
    </Suspense>
  );
}
