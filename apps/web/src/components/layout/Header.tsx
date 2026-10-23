"use client";

import { useRef, useState } from "react";
import { useStaffUser } from "@/components/auth/StaffSessionGate";
import { ApiError, apiRequest } from "@/lib/api";

export default function Header() {
  const user = useStaffUser();
  const pending = useRef(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    if (pending.current) return;

    pending.current = true;
    setBusy(true);
    setError("");

    try {
      await apiRequest<{ message: string }>("/auth/logout", {
        method: "POST",
      });

      window.location.replace("/login");
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        window.location.replace("/login");
        return;
      }

      pending.current = false;
      setBusy(false);
      setError("Could not log out. Please try again.");
    }
  }

  return (
    <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-900">Larqon Hospitals</p>
          <p className="mt-1 text-xs text-slate-500">Staff workspace</p>
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          <div className="max-w-40 text-right">
            <p className="truncate text-sm font-semibold text-slate-900">
              {user.fullName}
            </p>

            <p className="mt-1 text-xs capitalize text-slate-500">
              {user.roles
                .map((role) => role.toLowerCase().replaceAll("_", " "))
                .join(", ")}
            </p>
          </div>

          <button
            type="button"
            onClick={logout}
            disabled={busy}
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-teal-800 px-5 text-sm font-semibold text-white transition-colors hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? "Logging out…" : "Log out"}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </header>
  );
}
