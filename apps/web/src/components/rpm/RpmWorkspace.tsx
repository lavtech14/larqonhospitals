"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { apiRequest } from "@/lib/api";
import { useStaffUser } from "@/components/auth/StaffSessionGate";

type Assignment = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: "SCHEDULED" | "ACTIVE" | "ENDED" | "CANCELLED";

  patient: {
    id: string;
    fullName: string;
    mrn: string;
  };

  doctor: {
    id: string;
    displayName: string;
  };

  nurse: {
    id: string;
    fullName: string;
    isActive: boolean;
  };
};

type AssignmentPage = {
  items: Assignment[];

  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const statusLabels: Record<Assignment["status"], string> = {
  SCHEDULED: "Scheduled",
  ACTIVE: "Active",
  ENDED: "Ended",
  CANCELLED: "Cancelled",
};

function statusStyle(status: Assignment["status"]) {
  switch (status) {
    case "ACTIVE":
      return "bg-teal-50 text-teal-900 ring-teal-200";

    case "SCHEDULED":
      return "bg-blue-50 text-blue-900 ring-blue-200";

    case "CANCELLED":
      return "bg-red-50 text-red-800 ring-red-200";

    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

function calendarDate(value: string) {
  // These are calendar dates, not measurement timestamps.
  return new Date(value).toLocaleDateString("en-IN", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function RpmWorkspace() {
  const user = useStaffUser();

  const canRead = Boolean(user.permissions?.includes("rpm.read"));

  const canAssign = Boolean(user.permissions?.includes("rpm.assign"));

  const [data, setData] = useState<AssignmentPage | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!canRead) return;

    let cancelled = false;

    async function load() {
      try {
        const result = await apiRequest<AssignmentPage>(
          `/rpm/assignments?page=${page}&limit=10&search=${encodeURIComponent(search)}`,
        );

        if (!cancelled) {
          setData(result);
          setError("");
        }
      } catch (caught) {
        if (!cancelled) {
          setData(null);

          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load RPM assignments.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [canRead, search, page, refresh]);

  function reload() {
    setLoading(true);
    setError("");
    setRefresh((value) => value + 1);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setPage(1);
    setSearch(searchInput.trim());
    setRefresh((value) => value + 1);
  }

  function clearSearch() {
    setSearchInput("");
    setSearch("");
    setPage(1);
    setLoading(true);
    setError("");
    setRefresh((value) => value + 1);
  }

  function changePage(next: number) {
    setLoading(true);
    setError("");
    setPage(next);
  }

  if (!canRead) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-950">
          Access unavailable
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          Your account cannot access home monitoring.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-teal-700">
            Remote patient monitoring
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Home monitoring
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            View assigned patients and their daily home readings.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>

          {canAssign && (
            <Link
              href="/rpm/assign"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-800 px-5 text-sm font-semibold text-white hover:bg-teal-900"
            >
              Assign RPM
            </Link>
          )}
        </div>
      </header>

      <form
        onSubmit={submitSearch}
        className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
      >
        <label
          htmlFor="rpm-patient-search"
          className="text-sm font-semibold text-slate-800"
        >
          Find an assigned patient
        </label>

        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id="rpm-patient-search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            maxLength={100}
            placeholder="Patient name or MRN"
            className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
          />

          <button
            type="submit"
            disabled={loading}
            className="min-h-11 rounded-xl bg-teal-800 px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Search
          </button>

          {(searchInput || search) && (
            <button
              type="button"
              onClick={clearSearch}
              disabled={loading}
              className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      <div aria-busy={loading}>
        {loading ? (
          <p
            role="status"
            className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600"
          >
            Loading assigned patients…
          </p>
        ) : error ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-6"
          >
            <p className="text-sm text-red-800">{error}</p>

            <button
              type="button"
              onClick={reload}
              className="mt-3 min-h-11 font-semibold text-red-800 underline"
            >
              Try again
            </button>
          </div>
        ) : data?.items.length === 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-8">
            <h2 className="text-lg font-semibold text-slate-950">
              {search ? "No matching patients" : "No RPM assignments yet"}
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              {search
                ? "Try another patient name or MRN."
                : canAssign
                  ? "Select Assign RPM to assign a patient and nurse."
                  : "Patients will appear here when a doctor assigns you as their RPM nurse."}
            </p>
          </section>
        ) : (
          <ul className="grid gap-5 lg:grid-cols-2">
            {data?.items.map((assignment) => (
              <li
                key={assignment.id}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      {assignment.patient.fullName}
                    </h2>

                    <p className="mt-1 text-xs text-slate-500">
                      {assignment.patient.mrn}
                    </p>
                  </div>

                  <span
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold ring-1 ring-inset ${statusStyle(assignment.status)}`}
                  >
                    {statusLabels[assignment.status]}
                  </span>
                </div>

                <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-slate-500">Doctor</dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {assignment.doctor.displayName}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs text-slate-500">Assigned nurse</dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {assignment.nurse.fullName}
                    </dd>

                    {!assignment.nurse.isActive && (
                      <p className="mt-1 text-xs text-red-700">
                        Nurse account inactive
                      </p>
                    )}
                  </div>

                  <div>
                    <dt className="text-xs text-slate-500">Start date</dt>
                    <dd className="mt-1 text-slate-900">
                      {calendarDate(assignment.startDate)}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs text-slate-500">End date</dt>
                    <dd className="mt-1 text-slate-900">
                      {calendarDate(assignment.endDate)}
                    </dd>
                  </div>
                </dl>

                <p className="mt-5 whitespace-pre-wrap border-t border-slate-100 pt-4 text-sm leading-6 text-slate-600">
                  {assignment.reason}
                </p>

                <div className="mt-auto pt-5">
                  <Link
                    href={`/rpm/${assignment.id}`}
                    className="inline-flex min-h-11 items-center rounded-xl border border-teal-700 px-4 text-sm font-semibold text-teal-800 hover:bg-teal-50"
                  >
                    View patient readings →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!loading && !error && data && (
        <footer className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {data.pagination.total} assignments · Page {data.pagination.page} of{" "}
            {Math.max(1, data.pagination.totalPages)}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => changePage(page - 1)}
              className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold disabled:opacity-40"
            >
              Previous
            </button>

            <button
              type="button"
              disabled={page >= data.pagination.totalPages}
              onClick={() => changePage(page + 1)}
              className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </footer>
      )}
    </section>
  );
}
