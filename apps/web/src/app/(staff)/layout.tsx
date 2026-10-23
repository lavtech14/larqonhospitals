import { Suspense } from "react";
import type { ReactNode } from "react";
import StaffSessionGate from "@/components/auth/StaffSessionGate";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          className="grid min-h-dvh place-items-center bg-slate-50 text-sm text-slate-600"
        >
          Loading staff session…
        </div>
      }
    >
      <StaffSessionGate>
        <div className="min-h-dvh bg-slate-50 text-slate-900 lg:flex">
          <a
            href="#staff-main"
            className="sr-only z-50 rounded-lg bg-white px-4 py-3 text-teal-900 shadow-lg focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
          >
            Skip to main content
          </a>
          <Sidebar />
          <div className="min-w-0 flex-1">
            <Header />
            <main
              id="staff-main"
              tabIndex={-1}
              className="mx-auto w-full max-w-[1500px] p-4 outline-none sm:p-6 lg:p-8 xl:p-10"
            >
              {children}
            </main>
          </div>
        </div>
      </StaffSessionGate>
    </Suspense>
  );
}
