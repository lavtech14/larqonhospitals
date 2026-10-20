"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStaffUser } from "@/components/auth/StaffSessionGate";

const links = [
  { href: "/", label: "Overview", permissions: [] },
  {
    href: "/patients",
    label: "Patients",
    permissions: ["patients.demographics.read"],
  },
  {
    href: "/departments",
    label: "Departments",
    permissions: ["departments.read"],
  },
  {
    href: "/doctors",
    label: "Doctors",
    permissions: ["doctors.read"],
  },
  {
    href: "/appointments",
    label: "Appointments",
    permissions: ["appointments.read", "patients.demographics.read"],
  },
  {
    href: "/my-appointments",
    label: "My appointments",
    permissions: ["appointments.own.read"],
  },
  {
    href: "/staff",
    label: "Staff accounts",
    permissions: ["staff.read"],
  },
];

export default function StaffNavigation() {
  const pathname = usePathname();
  const user = useStaffUser();

  return (
    <nav aria-label="Main navigation">
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
              className={`nav-link${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {link.label}
            </Link>
          );
        })}
    </nav>
  );
}
