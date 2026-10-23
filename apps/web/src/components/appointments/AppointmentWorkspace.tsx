"use client";

import { useState } from "react";

import { useStaffUser } from "@/components/auth/StaffSessionGate";
import { ApiError, apiRequest } from "@/lib/api";
import Link from "next/link";

interface Appointment {
  id: string;
  startsAt: string;
  mode: "IN_PERSON" | "ONLINE";
  endsAt: string;
  status: "BOOKED" | "CANCELLED";
  consultationEndedAt: string | null;
  version: number;
  patient: {
    id: string;
    fullName: string;
  };
  doctor: {
    id: string;
    displayName: string;
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

  const part = (name: string) =>
    parts.find((item) => item.type === name)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

function messageFor(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The request could not be completed.";
}

export default function AppointmentWorkspace({
  scope = "all",
}: {
  scope?: "all" | "mine";
}) {
  const user = useStaffUser();

  const ownView = scope === "mine";

  const canRead = ownView
    ? (user.permissions?.includes("appointments.own.read") ?? false)
    : Boolean(
        user.permissions?.includes("appointments.read") &&
        user.permissions?.includes("patients.demographics.read"),
      );

  const canCancel =
    !ownView && (user.permissions?.includes("appointments.cancel") ?? false);

  const [filters, setFilters] = useState<Filters>({
    from: "",
    to: "",
    status: "",
  });

  const [applied, setApplied] = useState<Filters | null>(null);
  const [result, setResult] = useState<AppointmentResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const busy = loading || cancelling;

  async function load(selected: Filters, page = 1): Promise<boolean> {
    setLoading(true);
    setError("");
    setConfirmingId(null);

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

      const endpoint = ownView ? "/appointments/mine" : "/appointments";

      const response = await apiRequest<AppointmentResponse>(
        `${endpoint}?${query}`,
      );

      setResult(response);
      setApplied({ ...selected });

      return true;
    } catch (error) {
      setError(messageFor(error));
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function cancel(appointment: Appointment) {
    if (!applied || busy || !canCancel) return;

    setCancelling(true);
    setError("");
    setNotice("");

    try {
      await apiRequest(`/appointments/${appointment.id}/cancel`, {
        method: "PATCH",
        body: JSON.stringify({
          expectedVersion: appointment.version,
        }),
      });

      setConfirmingId(null);

      // Start from page one because cancellation can change filtered results.
      const refreshed = await load(applied, 1);

      setNotice(
        refreshed
          ? "Appointment cancelled. The list was refreshed."
          : "Appointment cancelled, but the list could not be refreshed. Select Refresh to update it.",
      );
    } catch (error) {
      setConfirmingId(null);

      if (error instanceof ApiError && error.status === 409) {
        await load(applied, result?.page ?? 1);
      }

      setError(`${messageFor(error)} Refresh the list before trying again.`);
    } finally {
      setCancelling(false);
    }
  }

  const primaryButton =
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50";
  const secondaryButton =
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50";
  const inputClass =
    "mt-2 block min-h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-teal-700 focus:outline-2 focus:outline-offset-2 focus:outline-teal-700 disabled:cursor-wait disabled:bg-slate-50 disabled:text-slate-500";
  const canBook =
    !ownView &&
    [
      "appointments.create",
      "patients.demographics.read",
      "doctors.read",
      "availability.read",
    ].every((permission) => user.permissions?.includes(permission));

  function renderStatus(appointment: Appointment) {
    return (
      <div className="space-y-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${appointment.status === "BOOKED" ? "bg-blue-50 text-blue-800 ring-blue-100" : "bg-slate-100 text-slate-600 ring-slate-200"}`}
        >
          <span
            aria-hidden="true"
            className={`size-1.5 rounded-full ${appointment.status === "BOOKED" ? "bg-blue-600" : "bg-slate-400"}`}
          />
          {appointment.status === "BOOKED" ? "Booked" : "Cancelled"}
        </span>
        {appointment.consultationEndedAt && (
          <div>
            <p className="text-xs font-semibold text-teal-800">
              Consultation completed
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {dateFormatter.format(new Date(appointment.consultationEndedAt))}{" "}
              ·{" "}
              {timeFormatter.format(new Date(appointment.consultationEndedAt))}
            </p>
          </div>
        )}
      </div>
    );
  }

  function renderMode(appointment: Appointment) {
    return (
      <span
        className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-medium ${appointment.mode === "ONLINE" ? "bg-violet-50 text-violet-800" : "bg-slate-100 text-slate-600"}`}
      >
        {appointment.mode === "ONLINE" ? "Online" : "In person"}
      </span>
    );
  }

  function renderActions(appointment: Appointment) {
    if (
      ownView &&
      appointment.mode === "ONLINE" &&
      appointment.status === "BOOKED" &&
      !appointment.consultationEndedAt
    ) {
      return (
        <Link
          className={primaryButton}
          href={`/my-appointments/${appointment.id}/consultation`}
          aria-label={`Join consultation with ${appointment.patient.fullName}`}
        >
          Join consultation <span aria-hidden="true">↗</span>
        </Link>
      );
    }

    if (
      canCancel &&
      appointment.status === "BOOKED" &&
      !appointment.consultationEndedAt
    ) {
      if (confirmingId === appointment.id) {
        return (
          <div className="w-full max-w-sm rounded-xl border border-amber-200 bg-amber-50 p-4 text-left">
            <p className="text-sm leading-6 text-amber-950">
              Cancel the appointment for{" "}
              <strong>{appointment.patient.fullName}</strong>?
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={secondaryButton}
                disabled={busy}
                onClick={() => setConfirmingId(null)}
              >
                Keep booking
              </button>
              <button
                type="button"
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-wait disabled:opacity-50"
                disabled={busy}
                onClick={() => void cancel(appointment)}
              >
                {cancelling ? "Cancelling…" : "Confirm cancellation"}
              </button>
            </div>
          </div>
        );
      }
      return (
        <button
          type="button"
          className={secondaryButton}
          disabled={busy}
          aria-label={`Cancel appointment for ${appointment.patient.fullName}`}
          onClick={() => {
            setError("");
            setNotice("");
            setConfirmingId(appointment.id);
          }}
        >
          Cancel booking
        </button>
      );
    }

    return (
      <span className="text-xs leading-5 text-slate-500">
        {appointment.consultationEndedAt
          ? "No further call action"
          : appointment.status === "CANCELLED"
            ? "Booking cancelled"
            : "No actions available"}
      </span>
    );
  }

  if (!canRead) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-slate-950">
          Access unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Your account cannot view appointments. Contact your hospital
          administrator if you need access.
        </p>
      </section>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold tracking-[0.18em] text-teal-800">
            PATIENT VISITS
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            {ownView ? "My appointments" : "Appointments"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {ownView
              ? "Review your assigned visits and join online consultations."
              : "Find patient bookings and manage future cancellations."}
          </p>
        </div>
        {canBook && (
          <Link href="/appointments/new" className={primaryButton}>
            <span aria-hidden="true" className="text-lg leading-none">
              +
            </span>
            Book appointment
          </Link>
        )}
      </header>

      <section
        aria-labelledby="filters-title"
        className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2
            id="filters-title"
            className="text-base font-semibold text-slate-900"
          >
            Find appointments
          </h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            India Standard Time · UTC+05:30
          </span>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (busy) return;
            setNotice("");
            void load(filters);
          }}
        >
          <fieldset
            disabled={busy}
            className="m-0 grid min-w-0 gap-4 border-0 p-0 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <legend className="sr-only">Appointment filters</legend>
            <label className="min-w-0 text-xs font-semibold text-slate-600">
              From date
              <input
                type="date"
                required
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
            <div className="flex flex-wrap items-end gap-2">
              <button
                type="submit"
                className={`${primaryButton} flex-1 sm:flex-none`}
                disabled={busy}
              >
                {loading ? "Loading…" : "Apply filters"}
              </button>
              <button
                type="button"
                className={`${secondaryButton} flex-1 sm:flex-none`}
                disabled={busy}
                onClick={() => {
                  const today = hospitalToday();
                  const selected = {
                    from: today,
                    to: today,
                    status: filters.status,
                  };
                  setFilters(selected);
                  setNotice("");
                  void load(selected);
                }}
              >
                Today
              </button>
            </div>
          </fieldset>
        </form>
        <p className="mt-4 text-xs leading-5 text-slate-500">
          Choose a range of up to 31 dates, or select Today. Booking status is
          separate from consultation completion.
        </p>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm leading-6 text-teal-900"
        >
          {notice}
        </div>
      )}
      {loading && (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-slate-600"
        >
          <span
            aria-hidden="true"
            className="size-2 rounded-full bg-teal-700"
          />
          Loading appointments…
        </p>
      )}

      {!result && !loading && (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <span
            aria-hidden="true"
            className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-teal-50 text-teal-800"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              className="size-6"
            >
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M7 2v6m10-6v6M3 11h18m-13 4h3" />
            </svg>
          </span>
          <h2 className="text-lg font-semibold text-slate-900">
            Your appointment list starts here
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
            Choose dates above and apply your filters, or select Today to review
            today’s visits.
          </p>
        </section>
      )}

      {result && applied && (
        <section
          aria-labelledby="list-title"
          aria-busy={busy}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
            <div>
              <div className="flex items-center gap-3">
                <h2
                  id="list-title"
                  className="text-lg font-semibold tracking-tight text-slate-950"
                >
                  {ownView ? "Assigned visits" : "Appointment list"}
                </h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-600">
                  {result.total} results
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {applied.from} to {applied.to} ·{" "}
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
              disabled={busy}
              onClick={() => {
                setNotice("");
                void load(applied, result.page);
              }}
            >
              Refresh list
            </button>
          </div>

          {result.items.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <h3 className="text-base font-semibold text-slate-900">
                No appointments found
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Try another date range or choose All statuses, then apply the
                filters.
              </p>
            </div>
          ) : (
            <>
              <ul
                className="m-0 list-none space-y-4 bg-slate-50/60 p-4 lg:hidden"
                aria-label="Appointments"
              >
                {result.items.map((appointment) => (
                  <li
                    key={appointment.id}
                    className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-base font-semibold text-slate-950">
                          {appointment.patient.fullName}
                        </h3>
                        <p className="mt-1 break-words text-sm text-slate-500">
                          {appointment.doctor.displayName}
                        </p>
                      </div>
                      <div className="shrink-0">{renderMode(appointment)}</div>
                    </div>
                    <dl className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-slate-500">
                          Appointment time · IST
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-slate-800">
                          <time dateTime={appointment.startsAt}>
                            {dateFormatter.format(
                              new Date(appointment.startsAt),
                            )}
                          </time>
                          <span className="mt-1 block text-xs font-normal tabular-nums text-slate-500">
                            {timeFormatter.format(
                              new Date(appointment.startsAt),
                            )}{" "}
                            –{" "}
                            {timeFormatter.format(new Date(appointment.endsAt))}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt className="mb-2 text-xs text-slate-500">
                          Booking status
                        </dt>
                        <dd>{renderStatus(appointment)}</dd>
                      </div>
                    </dl>
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      {renderActions(appointment)}
                    </div>
                  </li>
                ))}
              </ul>

              <div
                className="hidden overflow-x-auto lg:block"
                tabIndex={0}
                role="region"
                aria-label="Appointments table"
              >
                <table className="w-full min-w-[900px] border-collapse text-left">
                  <caption className="sr-only">
                    Appointments for the applied date range. All times are India
                    Standard Time.
                  </caption>
                  <thead>
                    <tr>
                      {[
                        "Patient",
                        "Doctor",
                        "Date and time",
                        "Mode",
                        "Booking status",
                        "Actions",
                      ].map((label) => (
                        <th
                          key={label}
                          scope="col"
                          className="border-b border-slate-200 bg-slate-50 px-5 py-3.5 text-[11px] font-semibold tracking-wide text-slate-500"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.items.map((appointment) => (
                      <tr key={appointment.id} className="hover:bg-slate-50/70">
                        <th
                          scope="row"
                          className="max-w-56 break-words px-5 py-5 align-top text-sm font-semibold text-slate-900"
                        >
                          {appointment.patient.fullName}
                        </th>
                        <td className="max-w-48 break-words px-5 py-5 align-top text-sm text-slate-600">
                          {appointment.doctor.displayName}
                        </td>
                        <td className="px-5 py-5 align-top">
                          <time
                            dateTime={appointment.startsAt}
                            className="whitespace-nowrap text-sm font-medium text-slate-800"
                          >
                            {dateFormatter.format(
                              new Date(appointment.startsAt),
                            )}
                          </time>
                          <span className="mt-1.5 block whitespace-nowrap text-xs tabular-nums text-slate-500">
                            {timeFormatter.format(
                              new Date(appointment.startsAt),
                            )}{" "}
                            –{" "}
                            {timeFormatter.format(new Date(appointment.endsAt))}
                          </span>
                        </td>
                        <td className="px-5 py-5 align-top">
                          {renderMode(appointment)}
                        </td>
                        <td className="px-5 py-5 align-top">
                          {renderStatus(appointment)}
                        </td>
                        <td className="min-w-44 px-5 py-5 align-top">
                          {renderActions(appointment)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 px-5 py-4 sm:px-6">
            <p className="text-xs tabular-nums text-slate-500">
              Page {result.page} of {Math.max(1, result.totalPages)}
              {result.items.length > 0 &&
                ` · Showing ${(result.page - 1) * result.limit + 1}–${(result.page - 1) * result.limit + result.items.length} of ${result.total}`}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className={secondaryButton}
                disabled={busy || result.page <= 1}
                onClick={() => void load(applied, result.page - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className={secondaryButton}
                disabled={busy || result.page >= result.totalPages}
                onClick={() => void load(applied, result.page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
