"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { patientApiRequest } from "@/lib/patient-api";

type Assignment = {
  id: string;
  startDate: string;
  endDate: string;
  status: "SCHEDULED" | "ACTIVE" | "ENDED" | "CANCELLED";
  canSubmit: boolean;

  doctor: {
    displayName: string;
  };

  nurse: {
    fullName: string;
  };
};

type Response = {
  items: Assignment[];

  pagination: {
    page: number;
    total: number;
    totalPages: number;
  };
};

function calendarDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusStyle(status: Assignment["status"]) {
  if (status === "ACTIVE") {
    return "bg-teal-50 text-teal-900";
  }

  if (status === "SCHEDULED") {
    return "bg-blue-50 text-blue-900";
  }

  return "bg-slate-100 text-slate-700";
}

export default function PatientMonitoringWorkspace() {
  const [data, setData] = useState<Response | null>(null);
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await patientApiRequest<Response>(
          `/patient/rpm/assignments?page=${page}&limit=10`,
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
              : "Unable to load your monitoring assignments.",
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
  }, [page, refresh]);

  function reload() {
    setLoading(true);
    setError("");
    setRefresh((value) => value + 1);
  }

  function changePage(next: number) {
    setLoading(true);
    setError("");
    setPage(next);
  }

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/patient"
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm font-semibold text-teal-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
      >
        <span aria-hidden="true">←</span>
        Back to patient home
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-teal-700">
            Patient portal
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            Home monitoring
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Enter your home readings during the assigned dates and view previous
            measurements.
          </p>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={reload}
          className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </header>

      <div aria-busy={loading}>
        {loading ? (
          <p role="status" className="p-6 text-sm text-slate-600">
            Loading your assignments…
          </p>
        ) : error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-5"
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
              No RPM assigned yet
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Your monitoring assignment will appear here when your doctor
              assigns it.
            </p>
          </section>
        ) : (
          <ul className="space-y-5">
            {data?.items.map((assignment) => (
              <li
                key={assignment.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      {assignment.doctor.displayName}
                    </h2>

                    <p className="mt-1 text-sm text-slate-600">
                      Nurse: {assignment.nurse.fullName}
                    </p>
                  </div>

                  <span
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold ${statusStyle(assignment.status)}`}
                  >
                    {assignment.status}
                  </span>
                </div>

                <p className="mt-5 text-sm text-slate-700">
                  {calendarDate(assignment.startDate)} –{" "}
                  {calendarDate(assignment.endDate)}
                </p>

                {assignment.status === "SCHEDULED" && (
                  <p className="mt-3 text-sm text-slate-500">
                    You can enter readings from the start date.
                  </p>
                )}

                {(assignment.status === "ENDED" ||
                  assignment.status === "CANCELLED") && (
                  <p className="mt-3 text-sm text-slate-500">
                    New submissions are closed. Your saved readings remain
                    available.
                  </p>
                )}

                <div className="mt-5 flex flex-wrap gap-3">
                  {assignment.canSubmit && (
                    <Link
                      href={`/patient/monitoring/${assignment.id}/readings/new`}
                      className="inline-flex min-h-12 items-center rounded-xl bg-teal-800 px-5 text-sm font-semibold text-white hover:bg-teal-900"
                    >
                      Enter vital readings
                    </Link>
                  )}

                  <Link
                    href={`/patient/monitoring/${assignment.id}/history`}
                    className="inline-flex min-h-12 items-center rounded-xl border border-teal-700 px-5 text-sm font-semibold text-teal-800 hover:bg-teal-50"
                  >
                    View my readings
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
              className="min-h-11 rounded-xl border bg-white px-4 text-sm font-semibold disabled:opacity-40"
            >
              Previous
            </button>

            <button
              type="button"
              disabled={page >= data.pagination.totalPages}
              onClick={() => changePage(page + 1)}
              className="min-h-11 rounded-xl border bg-white px-4 text-sm font-semibold disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </footer>
      )}
    </section>
  );
}
