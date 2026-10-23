"use client";

import Link from "next/link";
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

export default function PatientAppointmentsPage() {
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

  return (
    <main className="patient-appointments-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">LARQON PATIENT PORTAL</p>
          <h1>My appointments</h1>
          <p className="muted">
            All dates and times are in India Standard Time.
          </p>
        </div>

        <Link href="/patient" className="secondary-button">
          Portal home
        </Link>
      </header>

      <section className="panel">
        <form
          className="appointment-filters"
          onSubmit={(event) => {
            event.preventDefault();
            void load(filters);
          }}
        >
          <label className="form-field">
            <span>From date</span>
            <input
              type="date"
              required
              disabled={loading}
              value={filters.from}
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
              disabled={loading}
              min={filters.from || undefined}
              value={filters.to}
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
              disabled={loading}
              value={filters.status}
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

          <button type="submit" className="primary-button" disabled={loading}>
            Find appointments
          </button>

          <button
            type="button"
            className="secondary-button"
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
        </form>

        <p className="muted">
          Choose up to 31 dates. Contact reception to book, change, or cancel an
          appointment.
        </p>
      </section>

      <div aria-live="polite">
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {loading && <p role="status">Loading your appointments...</p>}
      </div>

      {!result && !loading && !error && (
        <section className="panel">
          <p>Select a date range or choose Today.</p>
        </section>
      )}

      {result && applied && (
        <section className="panel">
          <h2>Your appointments</h2>
          <p className="muted">
            {applied.from} to {applied.to}
            {" · "}
            {result.total} results
          </p>

          {result.items.length === 0 ? (
            <p>No appointments match these filters.</p>
          ) : (
            <ul className="patient-appointment-cards">
              {result.items.map((appointment) => (
                <li key={appointment.id} className="patient-appointment-card">
                  <div className="patient-appointment-card-heading">
                    <h3>{appointment.doctor.displayName}</h3>

                    <span
                      className={`appointment-badge ${
                        appointment.status === "BOOKED"
                          ? "appointment-badge-booked"
                          : "appointment-badge-cancelled"
                      }`}
                    >
                      {appointment.status === "BOOKED" ? "Booked" : "Cancelled"}
                    </span>
                    {appointment.mode === "ONLINE" &&
                      (appointment.consultationEndedAt ? (
                        <span>
                          Completed ·{" "}
                          {new Date(
                            appointment.consultationEndedAt,
                          ).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                      ) : appointment.status === "BOOKED" ? (
                        <Link
                          href={`/patient/appointments/${appointment.id}/consultation`}
                          className="primary-button"
                        >
                          Join consultation
                        </Link>
                      ) : null)}
                  </div>

                  <p className="muted">
                    {appointment.doctor.specialty}
                    {" · "}
                    {appointment.doctor.department.name}
                  </p>

                  <p>
                    <strong>
                      {dateFormatter.format(new Date(appointment.startsAt))}
                    </strong>
                    {" · "}
                    {timeFormatter.format(new Date(appointment.startsAt))}
                    {" – "}
                    {timeFormatter.format(new Date(appointment.endsAt))}
                  </p>

                  <p>
                    {appointment.mode === "ONLINE"
                      ? "Online consultation"
                      : "In-person hospital visit"}
                  </p>

                  {appointment.mode === "ONLINE" &&
                    appointment.status === "BOOKED" && (
                      <p className="muted">Call joining is not enabled yet.</p>
                    )}

                  <p className="record-id">Reference: {appointment.id}</p>
                </li>
              ))}
            </ul>
          )}

          <div className="appointment-pagination">
            <button
              type="button"
              className="secondary-button"
              disabled={loading || result.page <= 1}
              onClick={() => void load(applied, result.page - 1)}
            >
              Previous
            </button>

            <span className="muted">
              Page {result.page} of {Math.max(1, result.totalPages)}
            </span>

            <button
              type="button"
              className="secondary-button"
              disabled={loading || result.page >= result.totalPages}
              onClick={() => void load(applied, result.page + 1)}
            >
              Next
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
