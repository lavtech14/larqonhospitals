"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { useStaffUser } from "@/components/auth/StaffSessionGate";
import { ApiError, apiRequest } from "@/lib/api";

interface Patient {
  id: string;
  fullName: string;
  phone: string | null;
  mrn: string;
}

interface Doctor {
  id: string;
  displayName: string;
  specialty: string;
  isActive: boolean;
  department: {
    id: string;
    name: string;
    isActive: boolean;
  };
}

interface DirectoryResponse<T> {
  items: T[];
  pagination: {
    page: number;
    totalPages: number;
    total: number;
  };
}

interface Slot {
  startsAt: string;
  localStart: string;
  localEnd: string;
  durationMinutes: number;
}

interface SlotResponse {
  doctor: {
    id: string;
    displayName: string;
  };
  date: string;
  availabilityVersion: number;
  reason: string;
  slots: Slot[];
}

interface BookingBody {
  patientId: string;
  doctorId: string;
  date: string;
  startMinute: number;
  expectedAvailabilityVersion: number;
  mode?: "IN_PERSON" | "ONLINE";
}

interface PendingBooking {
  key: string;
  body: BookingBody;
}

interface BookingResponse {
  replayed: boolean;
  appointment: {
    id: string;
    patientId: string;
    doctorId: string;
    startsAt: string;
    endsAt: string;
    status: "BOOKED" | "CANCELLED";
  };
}

function errorText(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The request could not be completed.";
}

function todayInHospital(): string {
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

const appointmentFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "medium",
  timeStyle: "short",
});

const slotReasons: Record<string, string> = {
  OPEN: "Choose a consultation slot.",
  DOCTOR_INACTIVE: "This doctor is inactive.",
  DEPARTMENT_INACTIVE: "This department is inactive.",
  HOSPITAL_CLOSED: "The hospital is closed on this date.",
  DOCTOR_UNAVAILABLE: "The doctor is on leave.",
  NO_WEEKLY_SCHEDULE: "No weekly schedule has been configured.",
  NON_WORKING_DAY: "The doctor has no consultation hours on this day.",
  NO_FUTURE_SLOTS: "No future slots remain for this date.",
  ALL_SLOTS_BOOKED: "All remaining slots are booked.",
};

/* Reusable directory picker. Searches run only when submitted. */
function DirectoryPicker<T extends { id: string }>({
  title,
  endpoint,
  searchable = false,
  disabled,
  selectedId,
  label,
  eligible,
  onSelect,
}: {
  title: string;
  endpoint: string;
  searchable?: boolean;
  disabled: boolean;
  selectedId?: string;
  label: (item: T) => string;
  eligible?: (item: T) => boolean;
  onSelect: (item: T) => void;
}) {
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [result, setResult] = useState<DirectoryResponse<T> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const requestLock = useRef(false);

  async function load(page: number, term: string) {
    if (requestLock.current || disabled) return;

    requestLock.current = true;
    setLoading(true);
    setError("");

    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: "10",
      });

      if (searchable && term) query.set("search", term);

      const response = await apiRequest<DirectoryResponse<T>>(
        `${endpoint}?${query}`,
      );

      setResult(response);
      setAppliedSearch(term);
    } catch (error) {
      setError(errorText(error));
    } finally {
      requestLock.current = false;
      setLoading(false);
    }
  }

  const items = result?.items.filter((item) => !eligible || eligible(item));

  return (
    <section className="panel booking-section">
      <h2>{title}</h2>

      <form
        className="booking-picker-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          void load(1, search.trim());
        }}
      >
        {searchable && (
          <label className="form-field">
            <span>Search by MRN, patient name or phone</span>
            <input
              value={search}
              maxLength={100}
              disabled={disabled || loading}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        )}

        <button
          type="submit"
          className="secondary-button"
          disabled={disabled || loading}
        >
          {loading
            ? "Loading..."
            : searchable
              ? "Search patients"
              : "Load doctors"}
        </button>
      </form>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {result && (
        <>
          <ul className="booking-picker-list">
            {items?.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="booking-picker-option"
                  aria-pressed={selectedId === item.id}
                  disabled={disabled || loading}
                  onClick={() => onSelect(item)}
                >
                  {label(item)}
                  {selectedId === item.id && (
                    <span className="booking-selected-label">Selected</span>
                  )}
                </button>
              </li>
            ))}
          </ul>

          {items?.length === 0 && (
            <p className="muted">
              No eligible results on this page. Try another search or page.
            </p>
          )}

          <div className="booking-picker-toolbar">
            <button
              type="button"
              className="secondary-button"
              disabled={disabled || loading || result.pagination.page <= 1}
              onClick={() =>
                void load(result.pagination.page - 1, appliedSearch)
              }
            >
              Previous
            </button>

            <span className="muted">
              Page {result.pagination.page} of{" "}
              {Math.max(1, result.pagination.totalPages)}
            </span>

            <button
              type="button"
              className="secondary-button"
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

export default function AppointmentBookingWorkspace() {
  const user = useStaffUser();

  const requiredPermissions = [
    "appointments.create",
    "patients.demographics.read",
    "doctors.read",
    "availability.read",
  ];

  const allowed = requiredPermissions.every((permission) =>
    user.permissions?.includes(permission),
  );

  const [patient, setPatient] = useState<Patient | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [date, setDate] = useState("");

  const [availability, setAvailability] = useState<SlotResponse | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [pending, setPending] = useState<PendingBooking | null>(null);
  const [confirmation, setConfirmation] = useState<BookingResponse | null>(
    null,
  );

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [appointmentMode, setAppointmentMode] = useState<
    "IN_PERSON" | "ONLINE"
  >("IN_PERSON");

  const submissionLock = useRef(false);
  const slotRequestLock = useRef(false);

  const storageKey = `larqon:pending-appointment:${user.id}`;
  const frozen = loading || submitting || pending !== null;

  function invalidateSlots() {
    setAvailability(null);
    setSelectedSlot(null);
    setConfirmation(null);
    setError("");
  }

  async function loadSlots() {
    if (!doctor || !date || pending || slotRequestLock.current) {
      return;
    }

    slotRequestLock.current = true;
    setLoading(true);
    setError("");
    setAvailability(null);
    setSelectedSlot(null);
    setConfirmation(null);

    try {
      const response = await apiRequest<SlotResponse>(
        `/doctors/${doctor.id}/slots?date=${date}`,
      );

      setAvailability(response);
    } catch (error) {
      setError(errorText(error));
    } finally {
      slotRequestLock.current = false;
      setLoading(false);
    }
  }

  function restorePending() {
    setError("");

    try {
      const raw = sessionStorage.getItem(storageKey);

      if (!raw) {
        setError("No pending booking was found in this browser tab.");
        return;
      }

      const restored = JSON.parse(raw) as PendingBooking;

      if (
        !restored ||
        typeof restored.key !== "string" ||
        !restored.body ||
        typeof restored.body.patientId !== "string" ||
        typeof restored.body.doctorId !== "string" ||
        typeof restored.body.date !== "string" ||
        !Number.isInteger(restored.body.startMinute) ||
        !Number.isInteger(restored.body.expectedAvailabilityVersion)
      ) {
        throw new Error(
          "The saved booking request is invalid. Check the appointment list before making another booking.",
        );
      }

      setPending(restored);
      setConfirmation(null);
    } catch (error) {
      setError(errorText(error));
    }
  }

  async function sendBooking(request: PendingBooking) {
    if (submissionLock.current) return;

    submissionLock.current = true;
    setSubmitting(true);
    setError("");

    try {
      const response = await apiRequest<BookingResponse>("/appointments", {
        method: "POST",
        headers: {
          "Idempotency-Key": request.key,
        },
        body: JSON.stringify(request.body),
        signal: AbortSignal.timeout(25_000),
      });

      // The server has confirmed the result.
      setConfirmation(response);
      setPending(null);
      setAvailability(null);
      setSelectedSlot(null);

      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        // A retained key can only replay the same appointment.
      }
    } catch (error) {
      const definitelyRejected =
        error instanceof ApiError &&
        [400, 404, 409, 422].includes(error.status);

      if (definitelyRejected) {
        try {
          sessionStorage.removeItem(storageKey);
          setPending(null);
        } catch {
          // Keep recovery available if local storage could not be cleared.
        }

        setAvailability(null);
        setSelectedSlot(null);
        setError(
          `${errorText(error)} Refresh the slots before choosing again.`,
        );
      } else {
        // A lost response does not prove the booking failed.
        setError(
          `${errorText(error)} The result is unconfirmed. Use “Retry same booking” to check safely.`,
        );
      }
    } finally {
      submissionLock.current = false;
      setSubmitting(false);
    }
  }

  async function confirmBooking() {
    if (
      !patient ||
      !doctor ||
      !availability ||
      !selectedSlot ||
      frozen ||
      submissionLock.current
    ) {
      return;
    }

    try {
      if (sessionStorage.getItem(storageKey)) {
        setError(
          "A previous booking request needs checking. Select “Restore pending booking” before starting another.",
        );
        return;
      }

      const [hours, minutes] = selectedSlot.localStart.split(":").map(Number);

      const request: PendingBooking = {
        key: crypto.randomUUID(),
        body: {
          patientId: patient.id,
          doctorId: doctor.id,
          date: availability.date,
          startMinute: hours * 60 + minutes,
          expectedAvailabilityVersion: availability.availabilityVersion,
          mode: appointmentMode,
        },
      };

      // Save the exact request before sending it.
      // Only identifiers and booking parameters are stored.
      sessionStorage.setItem(storageKey, JSON.stringify(request));
      setPending(request);

      await sendBooking(request);
    } catch (error) {
      setError(`${errorText(error)} The booking could not be prepared.`);
    }
  }

  if (!allowed) {
    return (
      <section className="panel">
        <h1>Access unavailable</h1>
        <p>Your account cannot create appointments.</p>
      </section>
    );
  }

  return (
    <div className="booking-workspace">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Patient visits</p>
          <h1>Book an appointment</h1>
          <p className="muted">
            Select a patient, doctor, and consultation slot. All times are in
            India Standard Time.
          </p>
        </div>

        <Link href="/appointments" className="secondary-button">
          View appointments
        </Link>
      </header>

      <div aria-live="polite">
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {loading && <p role="status">Loading consultation slots...</p>}
        {submitting && <p role="status">Checking booking result...</p>}
      </div>

      {confirmation && (
        <section className="panel booking-confirmation" role="status">
          <h2>
            {confirmation.appointment.status === "BOOKED"
              ? "Appointment confirmed"
              : "Original appointment is cancelled"}
          </h2>
          <p>
            Reference: <strong>{confirmation.appointment.id}</strong>
          </p>
          <p>
            {appointmentFormatter.format(
              new Date(confirmation.appointment.startsAt),
            )}
          </p>
          {confirmation.replayed && (
            <p className="muted">
              The existing appointment was returned. No duplicate booking was
              created.
            </p>
          )}
          <Link href="/appointments" className="text-link">
            Open appointment list
          </Link>
        </section>
      )}

      {pending ? (
        <section className="panel">
          <h2>Check pending booking</h2>
          <p>Keep this request unchanged until its result is confirmed.</p>
          <dl className="booking-summary">
            <dt>Patient ID</dt>
            <dd>{pending.body.patientId}</dd>
            <dt>Doctor ID</dt>
            <dd>{pending.body.doctorId}</dd>
            <dt>Date</dt>
            <dd>{pending.body.date}</dd>
            <dt>Time</dt>
            <dd>
              {String(Math.floor(pending.body.startMinute / 60)).padStart(
                2,
                "0",
              )}
              :{String(pending.body.startMinute % 60).padStart(2, "0")}
            </dd>
            <dt>Mode</dt>
            <dd>
              {pending.body.mode === "ONLINE"
                ? "Online consultation"
                : "In-person visit"}
            </dd>
          </dl>

          <button
            type="button"
            className="primary-button"
            disabled={submitting}
            onClick={() => void sendBooking(pending)}
          >
            {submitting ? "Checking..." : "Retry same booking"}
          </button>
        </section>
      ) : (
        <button
          type="button"
          className="secondary-button booking-recovery"
          disabled={loading || submitting}
          onClick={restorePending}
        >
          Restore pending booking
        </button>
      )}
      <section className="panel">
        <label className="form-field">
          <span>Appointment mode</span>
          <select
            value={appointmentMode}
            disabled={frozen}
            onChange={(event) => {
              setAppointmentMode(event.target.value as "IN_PERSON" | "ONLINE");
              setConfirmation(null);
              setError("");
            }}
          >
            <option value="IN_PERSON">In-person visit</option>
            <option value="ONLINE">Online consultation</option>
          </select>
        </label>

        <p className="muted">
          Online appointments are being prepared for video consultations. Call
          joining is not enabled yet.
        </p>
      </section>
      <div className="booking-picker-grid">
        <DirectoryPicker<Patient>
          title="1. Select patient"
          endpoint="/patients"
          searchable
          disabled={frozen}
          selectedId={patient?.id}
          label={(item) =>
            `${item.mrn} · ${item.fullName} · ${item.phone || "No phone"}`
          }
          onSelect={(item) => {
            setPatient(item);
            setConfirmation(null);
            setError("");
          }}
        />

        <DirectoryPicker<Doctor>
          title="2. Select doctor"
          endpoint="/doctors"
          disabled={frozen}
          selectedId={doctor?.id}
          eligible={(item) => item.isActive && item.department.isActive}
          label={(item) =>
            `${item.displayName} · ${item.specialty} · ${item.department.name}`
          }
          onSelect={(item) => {
            setDoctor(item);
            invalidateSlots();
          }}
        />
      </div>

      <section className="panel booking-section">
        <h2>3. Choose a date and slot</h2>

        <form
          className="booking-picker-toolbar"
          onSubmit={(event) => {
            event.preventDefault();
            void loadSlots();
          }}
        >
          <label className="form-field">
            <span>Consultation date</span>
            <input
              type="date"
              required
              value={date}
              disabled={frozen}
              onChange={(event) => {
                setDate(event.target.value);
                invalidateSlots();
              }}
            />
          </label>

          <button
            type="button"
            className="secondary-button"
            disabled={frozen}
            onClick={() => {
              setDate(todayInHospital());
              invalidateSlots();
            }}
          >
            Today
          </button>

          <button
            type="submit"
            className="primary-button"
            disabled={frozen || !doctor || !date}
          >
            Load available slots
          </button>
        </form>

        {!doctor && <p className="muted">Select a doctor to load slots.</p>}

        {availability && (
          <>
            <p className="muted">
              {slotReasons[availability.reason] ?? "No slots are available."}
            </p>

            <div className="booking-slot-grid">
              {availability.slots.map((slot) => (
                <button
                  key={slot.startsAt}
                  type="button"
                  className="booking-slot"
                  aria-pressed={selectedSlot?.startsAt === slot.startsAt}
                  disabled={frozen}
                  onClick={() => {
                    setSelectedSlot(slot);
                    setConfirmation(null);
                    setError("");
                  }}
                >
                  <strong>
                    {slot.localStart} – {slot.localEnd}
                  </strong>
                  <span>{slot.durationMinutes} minutes</span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {patient && doctor && availability && selectedSlot && !pending && (
        <section className="panel booking-section">
          <h2>4. Confirm appointment</h2>

          <dl className="booking-summary">
            <dt>Patient</dt>
            <dd>
              {patient.fullName}
              <br />
              <span className="muted">{patient.phone || "No phone"}</span>
            </dd>
            <dt>Patient ID</dt>
            <dd>{patient.id}</dd>
            <dt>Doctor</dt>
            <dd>{doctor.displayName}</dd>
            <dt>Date</dt>
            <dd>{availability.date}</dd>
            <dt>Time</dt>
            <dd>
              {selectedSlot.localStart} – {selectedSlot.localEnd} IST
            </dd>
            <dt>Mode</dt>
            <dd>
              {appointmentMode === "ONLINE"
                ? "Online consultation"
                : "In-person visit"}
            </dd>
          </dl>

          <p className="muted">
            Availability is checked again when you confirm.
          </p>

          <button
            type="button"
            className="primary-button"
            disabled={frozen}
            onClick={() => void confirmBooking()}
          >
            Confirm booking
          </button>
        </section>
      )}
    </div>
  );
}
