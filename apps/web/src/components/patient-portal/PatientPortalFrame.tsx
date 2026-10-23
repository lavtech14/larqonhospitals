import Link from "next/link";
import type { ReactNode } from "react";

export default function PatientPortalFrame({
  current,
  actions,
  children,
}: {
  current: "home" | "appointments";
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <a
        href="#patient-main"
        className="sr-only z-50 rounded-lg bg-white px-4 py-3 text-teal-900 shadow-sm focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to main content
      </a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/patient"
            className="flex min-h-11 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-800 text-2xl text-white"
            >
              +
            </span>
            <span className="text-sm font-bold text-slate-950">
              Larqon Hospitals
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Patient portal
              </span>
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <nav
              aria-label="Patient portal navigation"
              className="flex gap-1 rounded-xl bg-slate-100 p-1"
            >
              {[
                { href: "/patient", label: "Home", value: "home" },
                {
                  href: "/patient/appointments",
                  label: "Appointments",
                  value: "appointments",
                },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={current === item.value ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:px-4 ${current === item.value ? "bg-white text-teal-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            {actions}
          </div>
        </div>
      </header>
      <main
        id="patient-main"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 outline-none sm:px-6 sm:py-8 lg:px-8 lg:py-10"
      >
        {children}
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-6 text-xs leading-6 text-slate-500 sm:px-6 lg:px-8">
        Larqon Hospitals · Patient portal
      </footer>
    </div>
  );
}
