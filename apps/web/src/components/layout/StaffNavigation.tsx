"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStaffUser } from "@/components/auth/StaffSessionGate";
import WorkspaceIcon from "./WorkspaceIcon";
import type { WorkspaceIconName } from "./WorkspaceIcon";

const links: {
  href: string;
  label: string;
  icon: WorkspaceIconName;
  permissions: string[];
}[] = [
  { href: "/", label: "Overview", icon: "overview", permissions: [] },
  {
    href: "/appointments",
    label: "Appointments",
    icon: "appointments",
    permissions: ["appointments.read", "patients.demographics.read"],
  },
  {
    href: "/my-appointments",
    label: "My appointments",
    icon: "appointments",
    permissions: ["appointments.own.read"],
  },
  {
    href: "/patients",
    label: "Patients",
    icon: "patients",
    permissions: ["patients.demographics.read"],
  },
  {
    href: "/doctors",
    label: "Doctors",
    icon: "doctors",
    permissions: ["doctors.read"],
  },
  {
    href: "/departments",
    label: "Departments",
    icon: "departments",
    permissions: ["departments.read"],
  },
  {
    href: "/staff",
    label: "Staff accounts",
    icon: "staff",
    permissions: ["staff.read"],
  },
];

export default function StaffNavigation({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const user = useStaffUser();

  return (
    <nav aria-label="Main navigation" className="grid gap-1.5">
      {links
        .filter((link) =>
          link.permissions.every((permission) =>
            user.permissions?.includes(permission),
          ),
        )
        .map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${active ? "bg-teal-50 text-teal-900 ring-1 ring-inset ring-teal-100" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}
            >
              <WorkspaceIcon name={link.icon} className="size-5 shrink-0" />
              <span>{link.label}</span>
              {active && (
                <span
                  aria-hidden="true"
                  className="ml-auto size-1.5 rounded-full bg-teal-700"
                />
              )}
            </Link>
          );
        })}
    </nav>
  );
}
