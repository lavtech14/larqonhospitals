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

  if (!canRead) {
    return (
      <section className="panel">
        <h1>Access unavailable</h1>
        <p>Your account cannot view appointments.</p>
      </section>
    );
  }

  return (
    <div className="appointment-workspace">
      <header className="page-heading">
        {!ownView &&
          [
            "appointments.create",
            "patients.demographics.read",
            "doctors.read",
            "availability.read",
          ].every((permission) => user.permissions?.includes(permission)) && (
            <Link href="/appointments/new" className="primary-button">
              Book appointment
            </Link>
          )}
        <div>
          <p className="eyebrow">Patient visits</p>
          <h1>{ownView ? "My appointments" : "Appointments"}</h1>
          <p className="muted">
            {ownView
              ? "Review appointments assigned to your linked doctor profile."
              : "Review bookings and manage future cancellations."}{" "}
            All times are in India Standard Time.
          </p>
        </div>
      </header>

      <section className="panel">
        <form
          className="appointment-filters"
          onSubmit={(event) => {
            event.preventDefault();
            setNotice("");
            void load(filters);
          }}
        >
          <label className="form-field">
            <span>From date</span>
            <input
              type="date"
              required
              value={filters.from}
              disabled={busy}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  from: event.target.value,
                }))
              }
            />
          </label>

          <label className="form-field">
            <span>To date</span>
            <input
              type="date"
              required
              min={filters.from || undefined}
              value={filters.to}
              disabled={busy}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  to: event.target.value,
                }))
              }
            />
          </label>

          <label className="form-field">
            <span>Status</span>
            <select
              value={filters.status}
              disabled={busy}
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

          <button type="submit" className="primary-button" disabled={busy}>
            {loading ? "Loading..." : "Apply filters"}
          </button>

          <button
            type="button"
            className="secondary-button"
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
        </form>

        <p className="muted">Choose up to 31 dates, or select Today.</p>
      </section>

      <div aria-live="polite">
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {notice && <p className="success-message">{notice}</p>}
        {loading && <p role="status">Loading appointments...</p>}
      </div>

      {!result && !loading && (
        <section className="panel">
          <h2>Find appointments</h2>
          <p className="muted">Select a date range above or choose Today.</p>
        </section>
      )}

      {result && applied && (
        <section className="panel" aria-busy={busy}>
          <div className="appointment-list-heading">
            <div>
              <h2>Appointment list</h2>
              <p className="muted">
                {applied.from} to {applied.to}
                {" · "}
                {applied.status || "All statuses"}
                {" · "}
                {result.total} results
              </p>
            </div>

            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => {
                setNotice("");
                void load(applied, result.page);
              }}
            >
              Refresh
            </button>
          </div>

          {result.items.length === 0 ? (
            <p>No appointments match these filters.</p>
          ) : (
            <div className="table-scroll">
              <table className="appointment-table">
                <caption className="appointment-caption">
                  Appointments for the applied date range
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Patient</th>
                    <th scope="col">Doctor</th>
                    <th scope="col">Date and time</th>
                    <th scope="col">Status</th>
                    {canCancel && <th scope="col">Actions</th>}
                  </tr>
                </thead>

                <tbody>
                  {result.items.map((appointment) => (
                    <tr key={appointment.id}>
                      <td>{appointment.patient.fullName}</td>
                      <td>{appointment.doctor.displayName}</td>
                      <td>
                        <div>
                          {dateFormatter.format(new Date(appointment.startsAt))}
                        </div>
                        <span className="muted">
                          {timeFormatter.format(new Date(appointment.startsAt))}
                          {" – "}
                          {timeFormatter.format(new Date(appointment.endsAt))}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`appointment-badge ${
                            appointment.status === "BOOKED"
                              ? "appointment-badge-booked"
                              : "appointment-badge-cancelled"
                          }`}
                        >
                          {appointment.status === "BOOKED"
                            ? "Booked"
                            : "Cancelled"}
                        </span>
                        <div className="muted">
                          {appointment.mode === "ONLINE"
                            ? "Online"
                            : "In person"}
                        </div>
                      </td>

                      {canCancel && (
                        <td>
                          {appointment.status === "CANCELLED" ? (
                            <span className="muted">—</span>
                          ) : confirmingId === appointment.id ? (
                            <div className="appointment-confirm">
                              <p>
                                Cancel this appointment for{" "}
                                <strong>{appointment.patient.fullName}</strong>?
                              </p>
                              <div className="appointment-actions">
                                <button
                                  type="button"
                                  className="secondary-button"
                                  disabled={busy}
                                  onClick={() => setConfirmingId(null)}
                                >
                                  Keep booking
                                </button>
                                <button
                                  type="button"
                                  className="primary-button"
                                  disabled={busy}
                                  onClick={() => void cancel(appointment)}
                                >
                                  {cancelling
                                    ? "Cancelling..."
                                    : "Confirm cancellation"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={busy}
                              onClick={() => {
                                setError("");
                                setNotice("");
                                setConfirmingId(appointment.id);
                              }}
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="appointment-pagination">
            <p className="muted">
              Page {result.page} of {Math.max(1, result.totalPages)}
            </p>

            <div className="appointment-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={busy || result.page <= 1}
                onClick={() => void load(applied, result.page - 1)}
              >
                Previous
              </button>

              <button
                type="button"
                className="secondary-button"
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
