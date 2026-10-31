"use client";
import Link from "next/link";
import { useRef } from "react";
import HomeIcon from "./HomeIcon";
const links = [
  ["#care", "Our care"],
  ["#your-visit", "Your visit"],
  ["#patient-portal", "Patient portal"],
  ["#questions", "FAQs"],
] as const;
export default function PublicHeader() {
  const menu = useRef<HTMLDetailsElement>(null),
    toggle = useRef<HTMLElement>(null);
  return (
    <header className="sticky top-0 z-30 border-b border-[#dce5df] bg-[#fbfcf8]/95 backdrop-blur-md">
      <div className="mx-auto flex min-h-22 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link
          href="/"
          aria-label="Larqon Hospitals home"
          className="flex items-center gap-2.5"
        >
          <span className="grid size-10 place-items-center rounded-[14px] bg-[#164c42] text-white">
            <HomeIcon name="plus" className="size-7" />
          </span>
          <span className="text-[20px] font-bold leading-5 tracking-[-.7px] text-[#183f36]">
            Larqon
            <span className="mt-1 block text-[10px] font-semibold tracking-[.24em]">
              HOSPITALS
            </span>
          </span>
        </Link>
        <nav
          aria-label="Hospital navigation"
          className="hidden items-center gap-7 text-[13px] font-semibold text-[#466054] lg:flex"
        >
          {links.map(([href, label]) => (
            <a
              key={href}
              className="transition-colors hover:text-[#143f34]"
              href={href}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-5 lg:flex">
          <Link href="/login" className="text-xs font-semibold text-[#526359]">
            Staff sign in
          </Link>
          <Link
            href="/patient/login"
            className="inline-flex min-h-11 items-center gap-3 rounded-full bg-[#164c42] px-5 text-xs font-semibold text-white hover:bg-[#103d34]"
          >
            Patient sign in
            <HomeIcon name="arrow" className="size-4" />
          </Link>
        </div>
        <details
          ref={menu}
          className="relative lg:hidden"
          onKeyDown={(e) => {
            if (e.key === "Escape" && menu.current?.open) {
              menu.current.open = false;
              toggle.current?.focus();
            }
          }}
        >
          <summary
            ref={toggle}
            className="grid min-h-11 cursor-pointer list-none place-items-center rounded-full border border-[#cddbd1] px-4 text-sm font-semibold text-[#234a3d] [&::-webkit-details-marker]:hidden"
          >
            Menu
          </summary>
          <nav
            aria-label="Mobile hospital navigation"
            className="absolute right-0 top-14 w-[min(20rem,calc(100vw-2.5rem))] rounded-2xl border border-[#dce5df] bg-white p-3 shadow-xl"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a") && menu.current)
                menu.current.open = false;
            }}
          >
            {links.map(([href, label]) => (
              <a
                href={href}
                key={href}
                className="block rounded-xl p-3 text-sm font-semibold text-[#244a3e] hover:bg-[#eef5ef]"
              >
                {label}
              </a>
            ))}
            <Link
              href="/patient/login"
              className="mt-2 block rounded-xl bg-[#164c42] p-3 text-center text-sm font-semibold text-white"
            >
              Patient sign in
            </Link>
            <Link
              href="/login"
              className="mt-1 block rounded-xl p-3 text-center text-sm font-semibold text-[#526359]"
            >
              Staff sign in
            </Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
