import Link from "next/link";
import type { ReactNode } from "react";

export default function LoginFrame({
  audience,
  changingPassword,
  busy,
  children,
}: {
  audience: "staff" | "patient";
  changingPassword: boolean;
  busy: boolean;
  children: ReactNode;
}) {
  const staff = audience === "staff";
  return (
    <main className="min-h-dvh bg-slate-50 p-4 text-slate-900 sm:p-8 lg:grid lg:place-items-center lg:p-10">
      <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[1fr_1.05fr]">
        <aside
          aria-label="Larqon Hospitals"
          className="relative overflow-hidden bg-slate-900 p-6 text-white sm:p-8 lg:flex lg:flex-col lg:p-10 xl:p-12"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-28 -bottom-28 size-96 rounded-full border-[56px] border-white/5"
          />
          <div className="relative flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-11 shrink-0 place-items-center rounded-2xl bg-teal-700 text-3xl font-medium text-white"
            >
              +
            </span>
            <div>
              <p className="text-base font-bold tracking-tight text-white">
                Larqon Hospitals
              </p>
              <p className="mt-1 text-xs text-slate-300">
                {staff ? "Staff workspace" : "Patient portal"}
              </p>
            </div>
          </div>
          <div className="relative mt-8 lg:my-auto lg:py-16">
            <p className="text-[10px] font-bold tracking-[0.18em] text-teal-200">
              {staff ? "HOSPITAL WORKSPACE" : "YOUR HOSPITAL ACCOUNT"}
            </p>
            <h2 className="mt-4 max-w-sm text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl lg:text-4xl">
              {staff
                ? "Access your daily hospital tools."
                : "Access your hospital appointments."}
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-7 text-slate-300">
              {staff
                ? "Sign in to manage the appointments, records and services available to your staff account."
                : "Review your scheduled visits and join online consultations from your hospital-provided account."}
            </p>
          </div>
          <p className="relative mt-6 hidden border-t border-white/10 pt-5 text-xs leading-6 text-slate-400 lg:block">
            {staff
              ? "Need account access? Contact your hospital administrator."
              : "Need help with your account? Contact hospital reception."}
          </p>
        </aside>

        <section
          className="min-w-0 px-5 py-7 sm:px-10 sm:py-10 lg:px-12 lg:py-12"
          aria-label={staff ? "Staff authentication" : "Patient authentication"}
        >
          {!changingPassword ? (
            <nav
              aria-label="Choose sign-in area"
              className="mb-8 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1"
            >
              {[
                { href: "/login", label: "Staff", active: staff },
                { href: "/patient/login", label: "Patient", active: !staff },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  aria-disabled={busy || undefined}
                  onClick={(event) => {
                    if (busy) event.preventDefault();
                  }}
                  className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${item.active ? "bg-white text-teal-900 shadow-sm" : "text-slate-500 hover:text-slate-900"} ${busy ? "cursor-wait opacity-60" : ""}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : (
            <p className="mb-6 text-xs font-semibold text-teal-800">
              First sign-in · Password update required
            </p>
          )}
          {children}
        </section>
      </div>
    </main>
  );
}
