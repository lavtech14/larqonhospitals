"use client";

import Link from "next/link";
import PatientPortalFrame from "./PatientPortalFrame";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError } from "@/lib/api";
import { patientApiRequest } from "@/lib/patient-api";

interface Appointment {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "BOOKED" | "CANCELLED";
  consultationEndedAt: string | null;
  mode: "IN_PERSON" | "ONLINE";
  doctor: {
    displayName: string;
    specialty: string;
    department: {
      name: string;
    };
  };
}

interface AppointmentResponse {
  items: Appointment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  timeZone: string;
}

interface Filters {
  from: string;
  to: string;
  status: string;
}

function hospitalToday(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const value = (name: string) =>
    parts.find((part) => part.type === name)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}`;
}

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "medium",
});

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

function passwordChangeRequired(error: ApiError): boolean {
  const data = error.data;

  return (
    data !== null &&
    typeof data === "object" &&
    "code" in data &&
    data.code === "PATIENT_PASSWORD_CHANGE_REQUIRED"
  );
}

export default function PatientAppointmentList() {
  const router = useRouter();

  const [filters, setFilters] = useState<Filters>({
    from: "",
    to: "",
    status: "",
  });

  const [applied, setApplied] = useState<Filters | null>(null);
  const [result, setResult] = useState<AppointmentResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const requestLock = useRef(false);

  async function load(selected: Filters, page = 1) {
    if (requestLock.current) return;

    requestLock.current = true;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const query = new URLSearchParams({
        from: selected.from,
        to: selected.to,
        page: String(page),
        limit: "20",
      });

      if (selected.status) {
        query.set("status", selected.status);
      }

      const response = await patientApiRequest<AppointmentResponse>(
        `/patient/appointments?${query}`,
      );

      setResult(response);
      setApplied({ ...selected });
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 401 || passwordChangeRequired(error))
      ) {
        router.replace("/patient/login");
        return;
      }

      setError(
        error instanceof Error
          ? error.message
          : "Unable to load your appointments.",
      );
    } finally {
      requestLock.current = false;
      setLoading(false);
    }
  }

  const primaryButton =
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50";
  const secondaryButton =
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50";
  const inputClass =
    "mt-2 block min-h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-teal-700 focus:outline-2 focus:outline-offset-2 focus:outline-teal-700 disabled:cursor-wait disabled:bg-slate-50";

  return (
    <PatientPortalFrame
      current="appointments"
      actions={
        <Link href="/patient" className={secondaryButton}>
          Portal home
        </Link>
      }
    >
      <header>
        <p className="text-[10px] font-bold tracking-[0.18em] text-teal-800">
          YOUR VISITS
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          My appointments
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Find your scheduled visits and online consultations. All dates and
          times are in India Standard Time.
        </p>
      </header>
      <section
        aria-labelledby="patient-filters-title"
        className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
      >
        <h2
          id="patient-filters-title"
          className="text-base font-semibold text-slate-900"
        >
          Find your appointments
        </h2>
        <form
          className="mt-5"
          onSubmit={(event) => {
            event.preventDefault();
            void load(filters);
          }}
        >
          <fieldset
            disabled={loading}
            className="m-0 grid min-w-0 items-end gap-4 border-0 p-0 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <legend className="sr-only">Appointment filters</legend>
            <label className="min-w-0 text-xs font-semibold text-slate-600">
              From date
              <input
                type="date"
                required
                disabled={loading}
                value={filters.from}
                className={inputClass}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    from: event.target.value,
                  }))
                }
              />
            </label>
            <label className="min-w-0 text-xs font-semibold text-slate-600">
              To date
              <input
                type="date"
                required
                disabled={loading}
                min={filters.from || undefined}
                value={filters.to}
                className={inputClass}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    to: event.target.value,
                  }))
                }
              />
            </label>
            <label className="min-w-0 text-xs font-semibold text-slate-600">
              Booking status
              <select
                disabled={loading}
                value={filters.status}
                className={inputClass}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
              >
                <option value="">All statuses</option>
                <option value="BOOKED">Booked</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className={primaryButton}
                disabled={loading}
              >
                Find appointments
              </button>
              <button
                type="button"
                className={secondaryButton}
                disabled={loading}
                onClick={() => {
                  const today = hospitalToday();
                  const selected = {
                    from: today,
                    to: today,
                    status: filters.status,
                  };
                  setFilters(selected);
                  void load(selected);
                }}
              >
                Today
              </button>
            </div>
          </fieldset>
        </form>
        <p className="mt-4 text-xs leading-6 text-slate-500">
          Choose up to 31 dates. Contact reception to book, change or cancel a
          visit.
        </p>
      </section>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
        >
          {error}
        </p>
      )}
      {loading && (
        <p role="status" className="text-sm text-slate-500">
          Loading your appointments…
        </p>
      )}
      {!result && !loading && !error && (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <h2 className="text-lg font-semibold text-slate-950">
            Find a visit to continue
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Choose a date range above, or select Today.
          </p>
        </section>
      )}
      {result && applied && (
        <section aria-labelledby="patient-results-title">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2
                id="patient-results-title"
                className="text-lg font-semibold tracking-tight text-slate-950"
              >
                Your appointments
              </h2>
              <p className="mt-2 text-xs leading-6 text-slate-500">
                {applied.from} to {applied.to} · {result.total} results ·{" "}
                {applied.status === "BOOKED"
                  ? "Booked"
                  : applied.status === "CANCELLED"
                    ? "Cancelled"
                    : "All booking statuses"}
              </p>
            </div>
            <button
              type="button"
              className={secondaryButton}
              disabled={loading}
              onClick={() => void load(applied, result.page)}
            >
              Refresh list
            </button>
          </div>
          {result.items.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center">
              <h3 className="text-base font-semibold text-slate-900">
                No appointments found
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Try another date range or choose All statuses. Contact reception
                if you need help locating a visit.
              </p>
            </div>
          ) : (
            <ul className="m-0 grid list-none gap-5 lg:grid-cols-2">
              {result.items.map((appointment) => (
                <li
                  key={appointment.id}
                  className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white"
                >
                  <div className="p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-lg font-semibold text-slate-950">
                          {appointment.doctor.displayName}
                        </h3>
                        <p className="mt-1 break-words text-xs leading-6 text-slate-500">
                          {appointment.doctor.specialty} ·{" "}
                          {appointment.doctor.department.name}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${appointment.status === "BOOKED" ? "bg-blue-50 text-blue-800" : "bg-slate-100 text-slate-600"}`}
                      >
                        {appointment.status === "BOOKED"
                          ? "Booked"
                          : "Cancelled"}
                      </span>
                    </div>
                    <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-slate-500">
                          Appointment date
                        </dt>
                        <dd className="mt-2 text-sm font-semibold text-slate-900">
                          <time dateTime={appointment.startsAt}>
                            {dateFormatter.format(
                              new Date(appointment.startsAt),
                            )}
                          </time>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Time · IST</dt>
                        <dd className="mt-2 text-sm font-medium tabular-nums text-slate-800">
                          {timeFormatter.format(new Date(appointment.startsAt))}{" "}
                          – {timeFormatter.format(new Date(appointment.endsAt))}
                        </dd>
                      </div>
                    </dl>
                    <span
                      className={`mt-5 inline-flex rounded-lg px-2.5 py-1.5 text-xs font-semibold ${appointment.mode === "ONLINE" ? "bg-violet-50 text-violet-800" : "bg-slate-100 text-slate-600"}`}
                    >
                      {appointment.mode === "ONLINE"
                        ? "Online consultation"
                        : "In-person hospital visit"}
                    </span>
                    {appointment.mode === "ONLINE" &&
                      appointment.consultationEndedAt && (
                        <div className="mt-4 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3">
                          <p className="text-sm font-semibold text-teal-900">
                            Consultation completed
                          </p>
                          <p className="mt-1 text-xs leading-5 text-teal-900">
                            {dateFormatter.format(
                              new Date(appointment.consultationEndedAt),
                            )}{" "}
                            ·{" "}
                            {timeFormatter.format(
                              new Date(appointment.consultationEndedAt),
                            )}{" "}
                            IST
                          </p>
                        </div>
                      )}
                    {appointment.mode === "ONLINE" &&
                      appointment.status === "BOOKED" &&
                      !appointment.consultationEndedAt && (
                        <div className="mt-4">
                          <p className="text-xs leading-6 text-slate-500">
                            Joining opens 10 minutes before the appointment and
                            closes at its scheduled end.
                          </p>
                          <Link
                            href={`/patient/appointments/${appointment.id}/consultation`}
                            className={`${primaryButton} mt-3 w-full sm:w-auto`}
                          >
                            Join consultation <span aria-hidden="true">↗</span>
                            <span className="sr-only">
                              {" "}
                              with {appointment.doctor.displayName}
                            </span>
                          </Link>
                        </div>
                      )}
                  </div>
                  <details className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 sm:px-6">
                    <summary className="cursor-pointer py-1 text-xs font-medium text-slate-500">
                      Appointment reference
                    </summary>
                    <p className="mt-2 break-all text-xs leading-6 text-slate-600">
                      {appointment.id}
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <p className="text-xs tabular-nums text-slate-500">
              Page {result.page} of {Math.max(1, result.totalPages)}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className={secondaryButton}
                disabled={loading || result.page <= 1}
                onClick={() => void load(applied, result.page - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className={secondaryButton}
                disabled={loading || result.page >= result.totalPages}
                onClick={() => void load(applied, result.page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      )}
    </PatientPortalFrame>
  );
}
