"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { patientApiRequest } from "@/lib/patient-api";

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

type Response = {
  assignment: {
    id: string;
    status: string;
    canSubmit: boolean;
    startDate: string;
    endDate: string;

    doctor: {
      displayName: string;
    };

    nurse: {
      fullName: string;
    };
  };

  items: Reading[];

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

function dateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function Vital({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number | null | undefined;
  unit: string;
}) {
  if (value === null || value === undefined) return null;

  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <dt className="text-xs text-slate-500">{label}</dt>

      <dd className="mt-2 text-xl font-semibold text-slate-950">
        {value}{" "}
        <span className="text-xs font-medium text-slate-500">{unit}</span>
      </dd>
    </div>
  );
}

export default function PatientMonitoringHistory({
  assignmentId,
}: {
  assignmentId: string;
}) {
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
          `/patient/rpm/assignments/${encodeURIComponent(assignmentId)}/readings?page=${page}&limit=10`,
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
              : "Unable to load your readings.",
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
    <section className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/patient/monitoring"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-800 hover:underline"
      >
        ← Home monitoring
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-teal-700">
            Patient portal
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            My readings
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Your saved home measurements, newest first. Measurement times are
            shown in IST.
          </p>
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

      <div aria-busy={loading} className="space-y-5">
        {loading ? (
          <p role="status" className="p-6 text-sm text-slate-600">
            Loading your readings…
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
            <section className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-teal-950">
                    Home-monitoring assignment
                  </h2>

                  <p className="mt-2 text-sm text-teal-900">
                    Doctor: {data.assignment.doctor.displayName}
                  </p>

                  <p className="mt-1 text-sm text-teal-900">
                    Nurse: {data.assignment.nurse.fullName}
                  </p>
                </div>

                <span className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-teal-900">
                  {data.assignment.status}
                </span>
              </div>

              <p className="mt-4 text-sm text-teal-900">
                {calendarDate(data.assignment.startDate)} –{" "}
                {calendarDate(data.assignment.endDate)}
              </p>

              {data.assignment.canSubmit && (
                <Link
                  href={`/patient/monitoring/${assignmentId}/readings/new`}
                  className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-teal-800 px-5 text-sm font-semibold text-white hover:bg-teal-900"
                >
                  Enter vital readings
                </Link>
              )}
            </section>

            {data.items.length === 0 ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-8">
                <h2 className="text-lg font-semibold text-slate-950">
                  No readings saved yet
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Your submitted measurements will appear here.
                </p>
              </section>
            ) : (
              <ul className="space-y-5">
                {data.items.map((reading) => (
                  <li
                    key={reading.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
                  >
                    <h2 className="font-semibold text-slate-950">
                      Measured {dateTime(reading.measuredAt)} IST
                    </h2>

                    <p className="mt-1 text-xs text-slate-500">
                      Saved {dateTime(reading.submittedAt)} IST
                    </p>

                    <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                          Your note
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

            <p className="rounded-xl bg-slate-100 p-4 text-sm leading-6 text-slate-600">
              These records show your submitted values. They do not indicate
              that a clinician has reviewed them or that the values are within a
              normal range.
            </p>

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
