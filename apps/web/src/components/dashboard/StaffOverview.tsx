"use client";

import Link from "next/link";
import { useStaffUser } from "@/components/auth/StaffSessionGate";
import WorkspaceIcon from "@/components/layout/WorkspaceIcon";
import type { WorkspaceIconName } from "@/components/layout/WorkspaceIcon";

const modules: {
  title: string;
  description: string;
  href: string;
  icon: WorkspaceIconName;
  permissions: string[];
}[] = [
  {
    title: "Appointments",
    description: "Find bookings, review schedules and manage upcoming visits.",
    href: "/appointments",
    icon: "appointments",
    permissions: ["appointments.read", "patients.demographics.read"],
  },
  {
    title: "My appointments",
    description: "Review your assigned visits and open online consultations.",
    href: "/my-appointments",
    icon: "appointments",
    permissions: ["appointments.own.read"],
  },
  {
    title: "Patients",
    description:
      "Search patient records and review registration and contact details.",
    href: "/patients",
    icon: "patients",
    permissions: ["patients.demographics.read"],
  },
  {
    title: "Doctors",
    description:
      "Browse doctor profiles, departments and consultation schedules.",
    href: "/doctors",
    icon: "doctors",
    permissions: ["doctors.read"],
  },
  {
    title: "Departments",
    description:
      "Explore the hospital departments and their available services.",
    href: "/departments",
    icon: "departments",
    permissions: ["departments.read"],
  },
  {
    title: "Staff accounts",
    description: "Review staff accounts and manage workspace access.",
    href: "/staff",
    icon: "staff",
    permissions: ["staff.read"],
  },
];

export default function StaffOverview() {
  const user = useStaffUser();
  const can = (permissions: string[]) =>
    permissions.every((permission) => user.permissions?.includes(permission));
  const available = modules.filter((module) => can(module.permissions));
  const canBook = can([
    "appointments.create",
    "appointments.read",
    "patients.demographics.read",
    "doctors.read",
  ]);
  const preferred =
    available.find((module) => module.href === "/my-appointments") ??
    available.find((module) => module.href === "/appointments") ??
    available[0];
  const firstName = user.fullName.trim().split(/\s+/)[0] || "there";

  return (
    <div className="space-y-8">
      <section
        aria-labelledby="page-title"
        className="flex flex-wrap items-end justify-between gap-5"
      >
        <div>
          <p className="text-[11px] font-bold tracking-[0.18em] text-teal-800">
            STAFF WORKSPACE
          </p>
          <h1
            id="page-title"
            className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl"
          >
            Hospital overview
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
            Welcome, {firstName}. Find your next task and get to the information
            you need.
          </p>
        </div>
        {canBook && (
          <Link
            href="/appointments/new"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-teal-800 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <WorkspaceIcon name="plus" className="size-5" />
            Book appointment
          </Link>
        )}
      </section>

      <section
        aria-labelledby="start-title"
        className="grid gap-5 xl:grid-cols-[1.65fr_1fr]"
      >
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-6 text-white sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-16 -right-16 size-64 rounded-full border-[36px] border-white/5"
          />
          <div className="relative">
            <span className="inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-teal-100">
              Your daily workspace
            </span>
            <h2
              id="start-title"
              className="mt-6 max-w-md text-2xl font-semibold tracking-tight text-white sm:text-3xl"
            >
              A clear place to start your day.
            </h2>
            <p className="mt-3 max-w-md text-sm leading-7 text-slate-300">
              Open appointments, review patient information and move between the
              tools available to your account.
            </p>
            {preferred && (
              <Link
                href={preferred.href}
                className="mt-7 inline-flex min-h-12 items-center gap-3 rounded-xl bg-white px-5 text-sm font-semibold text-slate-950 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                Open {preferred.title.toLowerCase()}
                <WorkspaceIcon name="arrow" className="size-4" />
              </Link>
            )}
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <span className="grid size-11 place-items-center rounded-xl bg-teal-50 text-teal-800">
            <WorkspaceIcon name="staff" className="size-6" />
          </span>
          <h2 className="mt-5 text-lg font-semibold text-slate-950">
            Your workspace access
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            The tools below follow your assigned hospital permissions.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {user.roles.map((role) => (
              <span
                key={role}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold capitalize text-slate-700"
              >
                {role.toLowerCase().replaceAll("_", " ")}
              </span>
            ))}
          </div>
          <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
            Need a different tool? Contact your hospital administrator.
          </p>
        </div>
      </section>

      <section aria-labelledby="tools-title">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2
              id="tools-title"
              className="text-xl font-semibold tracking-tight text-slate-950"
            >
              Workspace tools
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Choose a task to continue.
            </p>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
            {available.length} available
          </span>
        </div>
        {available.length ? (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {available.map((module) => (
              <Link
                key={module.href}
                href={module.href}
                className="group rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-teal-300 hover:bg-teal-50/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-700 transition-colors group-hover:bg-teal-100 group-hover:text-teal-900">
                    <WorkspaceIcon name={module.icon} className="size-5" />
                  </span>
                  <WorkspaceIcon
                    name="arrow"
                    className="size-4 text-slate-400 group-hover:text-teal-800"
                  />
                </div>
                <h3 className="mt-5 text-base font-semibold text-slate-900">
                  {module.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {module.description}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <p
            role="status"
            className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600"
          >
            No tools are assigned to this account yet. Contact your hospital
            administrator.
          </p>
        )}
      </section>
      <p className="border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500">
        For appointment details, open the appointment list. This overview does
        not display live hospital totals.
      </p>
    </div>
  );
}
