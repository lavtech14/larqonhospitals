import { Suspense } from "react";
import PatientLoginForm from "@/components/auth/PatientLoginForm";

export default function PatientLoginPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 text-sm text-slate-600">
          Loading patient sign-in…
        </p>
      }
    >
      <PatientLoginForm />
    </Suspense>
  );
}
