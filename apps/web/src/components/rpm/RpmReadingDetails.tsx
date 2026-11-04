"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";

type Reading = {
  id: string;
  measuredAt: string;
  submittedAt: string;
  weightKg: string | number | null;
  temperatureC: string | number | null;
  systolicBp: number | null;
  diastolicBp: number | null;
  spo2Percent: string | number | null;
  pulseBpm: number | null;
  bloodGlucoseMgDl: string | number | null;
  glucoseContext: string | null;
  notes: string | null;
};

type ReadingResponse = {
  assignment: {
    id: string;
    status: string;
    startDate: string;
    endDate: string;
    reason: string;
    notes: string | null;

    patient: {
      fullName: string;
      mrn: string;
    };

    doctor: {
      displayName: string;
    };

    nurse: {
      fullName: string;
      isActive: boolean;
    };
  };

  items: Reading[];

  pagination: {
    page: number;
    total: number;
    totalPages: number;
  };
};

function dateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function calendarDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Vital({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
}) {
  if (value === null || value === undefined) return null;

  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-2 text-xl font-semibold text-slate-950">
        {value}
        {unit && (
          <span className="ml-1 text-xs font-medium text-slate-500">
            {unit}
          </span>
        )}
      </dd>
    </div>
  );
}

export default function RpmReadingDetails({
  assignmentId,
}: {
  assignmentId: string;
}) {
  const [data, setData] = useState<ReadingResponse | null>(null);
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await apiRequest<ReadingResponse>(
          `/rpm/assignments/${encodeURIComponent(assignmentId)}/readings?page=${page}&limit=10`,
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
              : "Unable to load patient readings.",
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
  }, [assignmentId, page, refresh]);

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
    <section className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/rpm"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-800 hover:underline"
      >
        ← Home monitoring
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-teal-700">
            Patient home readings
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            {data?.assignment.patient.fullName ?? "Patient readings"}
          </h1>

          {data && (
            <p className="mt-2 text-sm text-slate-600">
              {data.assignment.patient.mrn} · {data.assignment.status}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </header>

      <div aria-busy={loading} className="space-y-6">
        {loading ? (
          <p role="status" className="p-6 text-sm text-slate-600">
            Loading patient readings…
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
        ) : data ? (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-slate-950">
                RPM assignment
              </h2>

              <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Doctor</dt>
                  <dd className="mt-1 font-semibold text-slate-900">
                    {data.assignment.doctor.displayName}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">Assigned nurse</dt>
                  <dd className="mt-1 font-semibold text-slate-900">
                    {data.assignment.nurse.fullName}
                  </dd>

                  {!data.assignment.nurse.isActive && (
                    <p className="mt-1 text-xs text-red-700">
                      Nurse account inactive
                    </p>
                  )}
                </div>

                <div>
                  <dt className="text-slate-500">Start date</dt>
                  <dd className="mt-1 text-slate-900">
                    {calendarDate(data.assignment.startDate)}
                  </dd>
                </div>

                <div>
                  <dt className="text-slate-500">End date</dt>
                  <dd className="mt-1 text-slate-900">
                    {calendarDate(data.assignment.endDate)}
                  </dd>
                </div>
              </dl>

              <div className="mt-5 border-t border-slate-100 pt-4">
                <h3 className="text-sm font-semibold text-slate-900">Reason</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                  {data.assignment.reason}
                </p>
              </div>

              {data.assignment.notes && (
                <div className="mt-4 rounded-xl bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Internal staff notes
                  </h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                    {data.assignment.notes}
                  </p>
                </div>
              )}
            </section>

            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                Reading history
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Patient-reported measurements, newest first. Measurement times
                are displayed in IST.
              </p>
            </div>

            {data.items.length === 0 ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-8">
                <h3 className="font-semibold text-slate-950">
                  No readings submitted yet
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  The patient’s daily measurements will appear here.
                </p>
              </section>
            ) : (
              <ul className="space-y-5">
                {data.items.map((reading) => (
                  <li
                    key={reading.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
                  >
                    <h3 className="font-semibold text-slate-950">
                      Measured {dateTime(reading.measuredAt)} IST
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      Submitted {dateTime(reading.submittedAt)} IST
                    </p>

                    <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <Vital
                        label="Weight"
                        value={reading.weightKg}
                        unit="kg"
                      />

                      <Vital
                        label="Temperature"
                        value={reading.temperatureC}
                        unit="°C"
                      />

                      <Vital
                        label="Blood pressure"
                        value={
                          reading.systolicBp !== null &&
                          reading.diastolicBp !== null
                            ? `${reading.systolicBp}/${reading.diastolicBp}`
                            : null
                        }
                        unit="mmHg"
                      />

                      <Vital
                        label="Oxygen saturation"
                        value={reading.spo2Percent}
                        unit="%"
                      />

                      <Vital
                        label="Pulse"
                        value={reading.pulseBpm}
                        unit="beats/min"
                      />

                      <Vital
                        label={
                          reading.glucoseContext
                            ? `Blood glucose · ${reading.glucoseContext
                                .replaceAll("_", " ")
                                .toLowerCase()}`
                            : "Blood glucose"
                        }
                        value={reading.bloodGlucoseMgDl}
                        unit="mg/dL"
                      />
                    </dl>

                    {reading.notes && (
                      <div className="mt-4 border-t border-slate-100 pt-4">
                        <p className="text-xs font-semibold text-slate-500">
                          Patient note
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                          {reading.notes}
                        </p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <footer className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                {data.pagination.total} submissions · Page{" "}
                {data.pagination.page} of{" "}
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
          </>
        ) : null}
      </div>
    </section>
  );
}
