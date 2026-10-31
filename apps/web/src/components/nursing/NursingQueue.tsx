"use client";

import { useEffect, useState } from "react";
import { useStaffUser } from "@/components/auth/StaffSessionGate";
import { apiRequest } from "@/lib/api";
import Link from "next/link";

type QueueStatus = "" | "CHECKED_IN" | "READY_FOR_DOCTOR";

type QueueItem = {
  id: string;
  status: "CHECKED_IN" | "READY_FOR_DOCTOR";
  checkedInAt: string;
  appointment: {
    id: string;
    startsAt: string;
    endsAt: string;
    patient: {
      id: string;
      mrn: string;
      fullName: string;
    };
    doctor: {
      id: string;
      displayName: string;
      department: {
        id: string;
        name: string;
      };
    };
  };
};

type QueueResponse = {
  date: string;
  timeZone: string;
  items: QueueItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type LoadState = {
  key: string;
  data: QueueResponse | null;
  error: string;
  loadedAt: string | null;
};

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
});

const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50";

export default function NursingQueue() {
  const user = useStaffUser();
  const canRead = user.permissions?.includes("nursing.queue.read") ?? false;
  const canViewVitals = ["nursing.queue.read", "encounters.vitals.read"].every(
    (permission) => user.permissions?.includes(permission),
  );

  const [status, setStatus] = useState<QueueStatus>("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<LoadState | null>(null);

  const requestKey = `${page}:${status}:${revision}`;

  const loading = canRead && state?.key !== requestKey;
  const data = state?.key === requestKey ? state.data : null;
  const error = state?.key === requestKey ? state.error : "";

  useEffect(() => {
    if (!canRead) return;

    const controller = new AbortController();
    let active = true;

    const query = new URLSearchParams({
      page: String(page),
      limit: "20",
    });

    if (status) query.set("status", status);

    async function fetchQueue() {
      try {
        const result = await apiRequest<QueueResponse>(
          `/nursing/queue?${query}`,
          { signal: controller.signal },
        );

        if (!active) return;

        setState({
          key: requestKey,
          data: result,
          error: "",
          loadedAt: new Date().toISOString(),
        });
      } catch (caught) {
        if (!active || controller.signal.aborted) return;

        setState({
          key: requestKey,
          data: null,
          error:
            caught instanceof Error
              ? caught.message
              : "Unable to load the nursing queue.",
          loadedAt: null,
        });
      }
    }

    void fetchQueue();

    return () => {
      active = false;
      controller.abort();
    };
  }, [canRead, page, status, requestKey]);

  if (!canRead) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-slate-950">
          Access unavailable
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Your account cannot view the nursing queue.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-widest text-teal-800">
            NURSING WORKSPACE
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            Nursing queue
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Today’s checked-in patients, ordered by arrival time. All times are
            IST.
          </p>
        </div>

        <button
          type="button"
          className={buttonClass}
          disabled={loading}
          onClick={() => setRevision((current) => current + 1)}
        >
          {loading ? "Loading…" : "Refresh queue"}
        </button>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <label
          htmlFor="queue-status"
          className="block text-sm font-semibold text-slate-700"
        >
          Visit status
        </label>

        <select
          id="queue-status"
          value={status}
          disabled={loading}
          onChange={(event) => {
            setStatus(event.target.value as QueueStatus);
            setPage(1);
          }}
          className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm focus:outline-2 focus:outline-teal-700 sm:max-w-xs"
        >
          <option value="">All waiting patients</option>
          <option value="CHECKED_IN">Checked in</option>
          <option value="READY_FOR_DOCTOR">Ready for doctor</option>
        </select>

        {data && (
          <p className="mt-3 text-xs text-slate-500">
            Hospital date: {data.date} · {data.total} patients
            {state?.loadedAt &&
              ` · Updated ${timeFormatter.format(
                new Date(state.loadedAt),
              )} IST`}
          </p>
        )}
      </section>

      {loading && (
        <p role="status" className="text-sm text-slate-600">
          Loading today’s nursing queue…
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error} Select Refresh queue to try again.
        </div>
      )}

      {data && (
        <section aria-label="Checked-in patients" className="space-y-4">
          {data.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <h2 className="font-semibold text-slate-900">
                No patients in this queue
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Check in an eligible patient from Appointments, then refresh
                this queue.
              </p>
            </div>
          ) : (
            <ul className="grid list-none gap-4 p-0 xl:grid-cols-2">
              {data.items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-teal-800">
                        {item.appointment.patient.mrn}
                      </p>
                      <h2 className="mt-1 break-words text-lg font-bold text-slate-950">
                        {item.appointment.patient.fullName}
                      </h2>
                    </div>

                    <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-900">
                      {item.status === "CHECKED_IN"
                        ? "Checked in"
                        : "Ready for doctor"}
                    </span>
                  </div>

                  <dl className="mt-5 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-slate-500">Doctor</dt>
                      <dd className="mt-1 font-medium text-slate-800">
                        {item.appointment.doctor.displayName}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs text-slate-500">Department</dt>
                      <dd className="mt-1 text-slate-800">
                        {item.appointment.doctor.department.name}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs text-slate-500">
                        Appointment · IST
                      </dt>
                      <dd className="mt-1 text-slate-800">
                        {timeFormatter.format(
                          new Date(item.appointment.startsAt),
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs text-slate-500">
                        Checked in · IST
                      </dt>
                      <dd className="mt-1 text-slate-800">
                        {timeFormatter.format(new Date(item.checkedInAt))}
                      </dd>
                    </div>
                  </dl>
                  {canViewVitals && (
                    <div className="mt-5 border-t border-slate-100 pt-4">
                      <Link
                        href={`/nursing/${item.id}/vitals`}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900"
                      >
                        Vitals and history
                      </Link>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <footer className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Page {data.page} of {Math.max(1, data.totalPages)}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                className={buttonClass}
                disabled={loading || page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous
              </button>

              <button
                type="button"
                className={buttonClass}
                disabled={loading || page >= data.totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          </footer>
        </section>
      )}
    </div>
  );
}
