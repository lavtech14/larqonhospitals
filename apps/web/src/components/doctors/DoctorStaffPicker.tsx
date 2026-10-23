"use client";

import { useRef, useState } from "react";
import { apiRequest } from "@/lib/api";

interface StaffAccount {
  id: string;
  fullName: string;
  email: string;
  roles: string[];
  isActive: boolean;
  mustChangePassword: boolean;
  doctorProfile: {
    id: string;
    displayName: string;
  } | null;
}

interface StaffResponse {
  items: StaffAccount[];
  pagination: {
    page: number;
    totalPages: number;
  };
}

interface Props {
  doctorId?: string;
  initialStaffUserId: string | null;
  disabled: boolean;
}

export default function DoctorStaffPicker({
  doctorId,
  initialStaffUserId,
  disabled,
}: Props) {
  const [selectedId, setSelectedId] = useState(initialStaffUserId ?? "");
  const [selectedLabel, setSelectedLabel] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [result, setResult] = useState<StaffResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const requestLock = useRef(false);

  async function load(page: number, term: string) {
    if (disabled || requestLock.current) return;

    requestLock.current = true;
    setLoading(true);
    setError("");

    try {
      const query = new URLSearchParams({
        role: "DOCTOR",
        status: "active",
        page: String(page),
        limit: "10",
      });

      if (term) query.set("search", term);

      const response = await apiRequest<StaffResponse>(`/staff?${query}`);

      setResult(response);
      setAppliedSearch(term);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load staff accounts.",
      );
    } finally {
      requestLock.current = false;
      setLoading(false);
    }
  }

  return (
    <section
      className="mt-6 min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5"
      aria-labelledby="doctor-staff-title"
      aria-busy={loading}
    >
      <h3
        id="doctor-staff-title"
        className="text-sm font-semibold text-slate-900"
      >
        Staff login account
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        Linking connects an existing staff login to this doctor profile. It does
        not verify professional credentials.
      </p>

      <input type="hidden" name="staffUserId" value={selectedId} />

      <div
        className="min-w-0 rounded-xl border border-teal-100 bg-teal-50 p-4 text-sm text-teal-950"
        aria-live="polite"
      >
        {selectedId ? (
          <>
            <strong>{selectedLabel || "Current linked account"}</strong>
            <div className="mt-1 block break-words text-xs leading-5 text-slate-500">
              {selectedId}
            </div>
          </>
        ) : (
          <span>No staff account linked.</span>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3 [&>label]:flex-[1_1_260px]">
        <label className="block min-w-0 text-xs font-semibold text-slate-600 [&>label]:block [&>span]:block [&>input]:mt-2 [&>input]:block [&>input]:min-h-12 [&>input]:w-full [&>input]:min-w-0 [&>input]:rounded-xl [&>input]:border [&>input]:border-slate-300 [&>input]:bg-white [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:font-normal [&>input]:text-slate-900 [&>input:disabled]:bg-slate-50 [&>select]:mt-2 [&>select]:block [&>select]:min-h-12 [&>select]:w-full [&>select]:min-w-0 [&>select]:rounded-xl [&>select]:border [&>select]:border-slate-300 [&>select]:bg-white [&>select]:px-3 [&>select]:py-2 [&>select]:text-sm [&>select]:font-normal [&>select]:text-slate-900 [&>select:disabled]:bg-slate-50 [&>input:focus-visible]:outline-2 [&>input:focus-visible]:outline-offset-2 [&>input:focus-visible]:outline-teal-700 [&>select:focus-visible]:outline-2 [&>select:focus-visible]:outline-offset-2 [&>select:focus-visible]:outline-teal-700">
          <span>Search doctor staff by name or email</span>
          <input
            value={search}
            maxLength={100}
            disabled={disabled || loading}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void load(1, search.trim());
              }
            }}
          />
        </label>

        <button
          type="button"
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled || loading}
          onClick={() => void load(1, search.trim())}
        >
          {loading ? "Loading..." : "Find accounts"}
        </button>

        <button
          type="button"
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled || loading || !selectedId}
          onClick={() => {
            setSelectedId("");
            setSelectedLabel("");
          }}
        >
          Remove link
        </button>
      </div>

      {error && (
        <p
          className="my-4 text-sm leading-6 text-red-700 empty:hidden"
          role="alert"
        >
          {error}
        </p>
      )}

      {result && (
        <>
          <ul className="grid max-h-[440px] list-none gap-3 overflow-y-auto p-1 sm:grid-cols-2">
            {result.items.map((account) => {
              const linkedElsewhere =
                account.doctorProfile !== null &&
                account.doctorProfile.id !== doctorId;

              const eligible =
                account.isActive &&
                account.roles.includes("DOCTOR") &&
                !linkedElsewhere;

              return (
                <li key={account.id}>
                  <button
                    type="button"
                    className="flex min-h-24 w-full cursor-pointer flex-col items-start gap-1 rounded-xl border border-slate-200 bg-white p-4 text-left text-sm leading-6 text-slate-700 transition-colors hover:border-teal-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 aria-pressed:border-teal-700 aria-pressed:bg-teal-50 aria-pressed:ring-1 aria-pressed:ring-teal-700 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:break-all [&>strong]:break-words"
                    aria-pressed={selectedId === account.id}
                    disabled={disabled || loading || !eligible}
                    onClick={() => {
                      setSelectedId(account.id);
                      setSelectedLabel(
                        `${account.fullName} · ${account.email}`,
                      );
                    }}
                  >
                    <strong>{account.fullName}</strong>
                    <span>{account.email}</span>

                    {linkedElsewhere && (
                      <span>
                        Already linked to {account.doctorProfile?.displayName}
                      </span>
                    )}

                    {account.mustChangePassword && (
                      <span>First-login password change required</span>
                    )}

                    {selectedId === account.id && <span>Selected</span>}
                  </button>
                </li>
              );
            })}
          </ul>

          {result.items.length === 0 && (
            <p className="mt-2 text-sm leading-6 text-slate-500">
              No matching active doctor accounts. Create one under Staff
              accounts if needed.
            </p>
          )}

          <div className="flex flex-wrap items-end gap-3 [&>label]:flex-[1_1_260px]">
            <button
              type="button"
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={disabled || loading || result.pagination.page <= 1}
              onClick={() =>
                void load(result.pagination.page - 1, appliedSearch)
              }
            >
              Previous
            </button>

            <span className="mt-2 text-sm leading-6 text-slate-500">
              Page {result.pagination.page} of{" "}
              {Math.max(1, result.pagination.totalPages)}
            </span>

            <button
              type="button"
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                disabled ||
                loading ||
                result.pagination.page >= result.pagination.totalPages
              }
              onClick={() =>
                void load(result.pagination.page + 1, appliedSearch)
              }
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
