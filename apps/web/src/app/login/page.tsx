import { Suspense } from "react";
import StaffLoginForm from "@/components/auth/StaffLoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 text-sm text-slate-600">
          Loading staff sign-in…
        </p>
      }
    >
      <StaffLoginForm />
    </Suspense>
  );
}
