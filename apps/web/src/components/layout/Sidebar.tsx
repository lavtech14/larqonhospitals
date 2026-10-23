"use client";

import Link from "next/link";
import { useRef } from "react";
import { useStaffUser } from "@/components/auth/StaffSessionGate";
import StaffNavigation from "./StaffNavigation";
import WorkspaceIcon from "./WorkspaceIcon";

function Brand() {
  return (
    <Link
      href="/"
      className="flex min-h-12 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-teal-700"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-teal-800 text-white">
        <WorkspaceIcon name="plus" className="size-7" />
      </span>
      <span className="text-base font-bold tracking-tight text-slate-950">
        Larqon Hospitals
        <span className="mt-0.5 block text-xs font-medium tracking-normal text-slate-500">
          Hospital workspace
        </span>
      </span>
    </Link>
  );
}

export default function Sidebar() {
  const user = useStaffUser();
  const menu = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const initials =
    user.fullName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join("") || "S";

  return (
    <aside
      aria-label="Hospital workspace"
      className="border-b border-slate-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:border-r lg:border-b-0 xl:w-72"
    >
      <div className="hidden px-6 pt-7 pb-8 lg:block">
        <Brand />
      </div>
      <div className="hidden px-4 lg:block">
        <p className="mb-3 px-3 text-[10px] font-bold tracking-[0.18em] text-slate-500">
          WORKSPACE
        </p>
        <StaffNavigation />
      </div>
      <details
        ref={menu}
        className="group p-4 lg:hidden"
        onKeyDown={(event) => {
          if (event.key === "Escape" && menu.current?.open) {
            menu.current.open = false;
            summary.current?.focus();
          }
        }}
      >
        <summary
          ref={summary}
          className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-xl text-sm font-bold text-slate-900 focus-visible:outline-2 focus-visible:outline-teal-700 [&::-webkit-details-marker]:hidden"
        >
          <span
            className="grid size-10 place-items-center rounded-xl bg-teal-800 text-xl text-white"
            aria-hidden="true"
          >
            +
          </span>
          <span>Larqon Hospitals</span>
          <span className="ml-auto rounded-lg border border-slate-200 px-3 py-2 text-xs">
            <span className="group-open:hidden">Menu</span>
            <span className="hidden group-open:inline">Close</span>
          </span>
        </summary>
        <div className="pt-4">
          <StaffNavigation
            onNavigate={() => {
              if (menu.current) menu.current.open = false;
              summary.current?.focus();
            }}
          />
        </div>
      </details>
      <div className="mt-auto hidden px-6 pt-10 pb-6 lg:block">
        <div className="border-t border-slate-100 pt-5">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-700"
            >
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {user.fullName}
              </p>
              <p className="mt-1 text-xs text-slate-500">Staff workspace</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
