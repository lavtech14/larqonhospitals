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

const bookingPrimary =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50";
const bookingSecondary =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50";
const bookingInput =
  "mt-2 block min-h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-teal-700 focus:outline-2 focus:outline-offset-2 focus:outline-teal-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

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
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight text-slate-950">
        {title}
      </h2>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        {searchable
          ? "Find the correct patient and verify their record before selecting."
          : "Load the directory and select an active doctor. Only eligible doctors are shown."}
      </p>
      <form
        className="mt-5 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void load(1, search.trim());
        }}
      >
        {searchable && (
          <label className="min-w-0 flex-[1_1_240px] text-xs font-semibold text-slate-600">
            Patient name, MRN or phone
            <input
              value={search}
              maxLength={100}
              disabled={disabled || loading}
              className={bookingInput}
              placeholder="Enter patient details"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        )}
        <button
          type="submit"
          className={bookingSecondary}
          disabled={disabled || loading}
        >
          {loading
            ? "Loading…"
            : searchable
              ? "Search patients"
              : "Load doctors"}
        </button>
      </form>
      {error && (
        <p
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm leading-6 text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}
      {!result && !loading && (
        <p className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm leading-6 text-slate-500">
          {searchable
            ? "Search above to load patient records."
            : "Select Load doctors to view the directory."}
        </p>
      )}
      {loading && (
        <p role="status" className="mt-4 text-sm text-slate-500">
          Loading directory…
        </p>
      )}
      {result && (
        <>
          <ul
            className="mt-5 grid max-h-[420px] list-none gap-2 overflow-y-auto p-1"
            aria-label={`${title} results`}
          >
            {items?.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`flex min-h-16 w-full cursor-pointer items-start justify-between gap-3 rounded-xl border p-4 text-left text-sm leading-6 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-60 ${selectedId === item.id ? "border-teal-700 bg-teal-50 text-teal-950 ring-1 ring-inset ring-teal-700" : "border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-slate-50"}`}
                  aria-pressed={selectedId === item.id}
                  disabled={disabled || loading}
                  onClick={() => onSelect(item)}
                >
                  <span className="min-w-0 break-words">{label(item)}</span>
                  {selectedId === item.id && (
                    <span className="shrink-0 rounded-full bg-teal-800 px-2 py-0.5 text-[10px] font-semibold text-white">
                      Selected
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {items?.length === 0 && (
            <p className="mt-4 text-sm leading-6 text-slate-500">
              No eligible results on this page. Try another search or page.
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-xs tabular-nums text-slate-500">
              Page {result.pagination.page} of{" "}
              {Math.max(1, result.pagination.totalPages)}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className={bookingSecondary}
                disabled={disabled || loading || result.pagination.page <= 1}
                onClick={() =>
                  void load(result.pagination.page - 1, appliedSearch)
                }
              >
                Previous
              </button>
              <button
                type="button"
                className={bookingSecondary}
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

  const readyToBook = Boolean(
    patient && doctor && availability && selectedSlot && !pending,
  );

  if (!allowed) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-slate-950">
          Access unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Your account cannot create appointments.
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
            Book an appointment
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Select a patient, choose a doctor and reserve a consultation slot.
          </p>
        </div>
        <Link href="/appointments" className={bookingSecondary}>
          <span aria-hidden="true">←</span>View appointments
        </Link>
      </header>

      <ol
        aria-label="Booking preparation"
        className="grid list-none grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-4 sm:p-5"
      >
        {[
          { label: "Select patient", done: Boolean(patient) },
          { label: "Select doctor", done: Boolean(doctor) },
          {
            label: "Choose visit",
            done: Boolean(selectedSlot && availability),
          },
          { label: "Review and book", done: Boolean(confirmation) },
        ].map((step, index) => (
          <li key={step.label} className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${step.done ? "bg-teal-800 text-white" : "bg-slate-100 text-slate-500"}`}
            >
              {step.done ? "✓" : index + 1}
            </span>
            <span
              className={`text-xs font-semibold ${step.done ? "text-teal-900" : "text-slate-600"}`}
            >
              {step.label}
              <span className="sr-only">
                {step.done ? ", ready" : ", not yet complete"}
              </span>
            </span>
          </li>
        ))}
      </ol>

      {error && (
        <p
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}
      {loading && (
        <p role="status" className="text-sm text-slate-600">
          Loading consultation slots…
        </p>
      )}
      {submitting && (
        <p role="status" className="text-sm text-slate-600">
          Checking booking result. Keep this page open…
        </p>
      )}

      {confirmation && (
        <section
          className="rounded-2xl border border-teal-200 bg-teal-50 p-5 sm:p-6"
          role="status"
        >
          <h2 className="text-lg font-semibold text-teal-950">
            {confirmation.appointment.status === "BOOKED"
              ? "Appointment confirmed"
              : "Original appointment is cancelled"}
          </h2>
          <p className="mt-2 text-sm font-medium text-teal-900">
            {appointmentFormatter.format(
              new Date(confirmation.appointment.startsAt),
            )}{" "}
            IST
          </p>
          <p className="mt-3 break-all text-xs leading-5 text-teal-900">
            Reference: {confirmation.appointment.id}
          </p>
          {confirmation.replayed && (
            <p className="mt-3 text-sm leading-6 text-teal-900">
              The existing appointment was returned. No duplicate booking was
              created.
            </p>
          )}
          <Link
            href="/appointments"
            className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-teal-950 underline underline-offset-4"
          >
            Open appointment list <span aria-hidden="true">→</span>
          </Link>
        </section>
      )}

      {pending ? (
        <section
          aria-labelledby="pending-title"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-5 sm:p-6"
        >
          <h2
            id="pending-title"
            className="text-lg font-semibold text-amber-950"
          >
            Check pending booking
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-900">
            This request is waiting for a confirmed result. Keep its details
            unchanged and retry the same booking. A retry uses the original
            request.
          </p>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-amber-900">Date</dt>
              <dd className="mt-1 font-semibold text-amber-950">
                {pending.body.date}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-amber-900">Time · IST</dt>
              <dd className="mt-1 font-semibold tabular-nums text-amber-950">
                {String(Math.floor(pending.body.startMinute / 60)).padStart(
                  2,
                  "0",
                )}
                :{String(pending.body.startMinute % 60).padStart(2, "0")}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-amber-900">Visit mode</dt>
              <dd className="mt-1 font-semibold text-amber-950">
                {pending.body.mode === "ONLINE"
                  ? "Online consultation"
                  : "In-person visit"}
              </dd>
            </div>
          </dl>
          <details className="mt-4 text-xs text-amber-950">
            <summary className="cursor-pointer py-2 font-semibold">
              Saved patient and doctor references
            </summary>
            <dl className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <dt>Patient ID</dt>
                <dd className="mt-1 break-all">{pending.body.patientId}</dd>
              </div>
              <div>
                <dt>Doctor ID</dt>
                <dd className="mt-1 break-all">{pending.body.doctorId}</dd>
              </div>
            </dl>
          </details>
          <button
            type="button"
            className={`${bookingPrimary} mt-4`}
            disabled={submitting}
            onClick={() => void sendBooking(pending)}
          >
            {submitting ? "Checking…" : "Retry same booking"}
          </button>
        </section>
      ) : (
        <details className="rounded-xl border border-slate-200 bg-white px-5 py-2">
          <summary className="cursor-pointer py-3 text-sm font-medium text-slate-600">
            Recover a previous booking request
          </summary>
          <p className="mb-3 max-w-2xl text-xs leading-5 text-slate-500">
            If a previous attempt lost its connection or response, restore the
            saved request from this browser tab before starting another booking.
          </p>
          <button
            type="button"
            className={`${bookingSecondary} mb-3`}
            disabled={loading || submitting}
            onClick={restorePending}
          >
            Restore pending booking
          </button>
        </details>
      )}

      <div className="grid min-w-0 items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <div className="grid min-w-0 items-start gap-5 xl:grid-cols-2">
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

          <section
            aria-labelledby="visit-title"
            className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2
                id="visit-title"
                className="text-lg font-semibold tracking-tight text-slate-950"
              >
                3. Choose your visit
              </h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                All times in IST
              </span>
            </div>
            <fieldset disabled={frozen} className="mt-5 min-w-0 border-0 p-0">
              <legend className="text-xs font-semibold text-slate-600">
                Appointment mode
              </legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {(
                  [
                    {
                      value: "IN_PERSON",
                      title: "In-person visit",
                      detail: "Consultation at the hospital.",
                    },
                    {
                      value: "ONLINE",
                      title: "Online consultation",
                      detail: "Doctor and patient connect by video or audio.",
                    },
                  ] as const
                ).map((mode) => (
                  <label
                    key={mode.value}
                    className={`flex min-w-0 items-start gap-3 rounded-xl border p-4 ${appointmentMode === mode.value ? "border-teal-700 bg-teal-50" : "border-slate-200 bg-white"} ${frozen ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                  >
                    <input
                      type="radio"
                      name="appointment-mode"
                      value={mode.value}
                      checked={appointmentMode === mode.value}
                      disabled={frozen}
                      onChange={() => {
                        setAppointmentMode(mode.value);
                        setConfirmation(null);
                        setError("");
                      }}
                      className="mt-1 size-4 shrink-0 accent-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">
                        {mode.title}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        {mode.detail}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <form
              className="mt-6 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-5"
              onSubmit={(event) => {
                event.preventDefault();
                void loadSlots();
              }}
            >
              <label className="min-w-0 flex-[1_1_200px] text-xs font-semibold text-slate-600">
                Consultation date
                <input
                  type="date"
                  required
                  value={date}
                  disabled={frozen}
                  className={bookingInput}
                  onChange={(event) => {
                    setDate(event.target.value);
                    invalidateSlots();
                  }}
                />
              </label>
              <button
                type="button"
                className={bookingSecondary}
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
                className={bookingPrimary}
                disabled={frozen || !doctor || !date}
              >
                Load available slots
              </button>
            </form>
            {!doctor && (
              <p className="mt-4 text-xs leading-5 text-slate-500">
                Select a doctor before loading available slots.
              </p>
            )}
            {!availability && !loading && doctor && (
              <p className="mt-4 text-xs leading-5 text-slate-500">
                Choose a date, then load the doctor’s available times.
              </p>
            )}
            {availability && (
              <div className="mt-6 border-t border-slate-100 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p role="status" className="text-sm text-slate-600">
                    {slotReasons[availability.reason] ??
                      "No slots are available."}
                  </p>
                  <span className="text-xs tabular-nums text-slate-500">
                    {availability.slots.length} available
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
                  {availability.slots.map((slot) => (
                    <button
                      key={slot.startsAt}
                      type="button"
                      className={`min-h-20 cursor-pointer rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-60 ${selectedSlot?.startsAt === slot.startsAt ? "border-teal-700 bg-teal-50 text-teal-950 ring-1 ring-inset ring-teal-700" : "border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-slate-50"}`}
                      aria-pressed={selectedSlot?.startsAt === slot.startsAt}
                      disabled={frozen}
                      onClick={() => {
                        setSelectedSlot(slot);
                        setConfirmation(null);
                        setError("");
                      }}
                    >
                      <strong className="block text-xs tabular-nums">
                        {slot.localStart} – {slot.localEnd}
                      </strong>
                      <span className="mt-2 block text-xs text-slate-500">
                        {slot.durationMinutes} min
                        {selectedSlot?.startsAt === slot.startsAt
                          ? " · Selected"
                          : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        <aside
          aria-labelledby="review-title"
          className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 2xl:sticky 2xl:top-6"
        >
          <p className="text-[10px] font-bold tracking-[0.16em] text-teal-800">
            BOOKING SUMMARY
          </p>
          <h2
            id="review-title"
            className="mt-2 text-lg font-semibold tracking-tight text-slate-950"
          >
            4. Review and book
          </h2>
          {pending ? (
            <p className="mt-4 text-sm leading-6 text-amber-900">
              A saved request is pending. Use its recovery panel above to check
              the result.
            </p>
          ) : (
            <>
              <dl className="mt-5 divide-y divide-slate-100 text-sm">
                <div className="pb-4">
                  <dt className="text-xs text-slate-500">Patient</dt>
                  <dd className="mt-1 break-words font-semibold text-slate-900">
                    {patient?.fullName || "Select a patient"}
                  </dd>
                  {patient && (
                    <dd className="mt-1 text-xs leading-5 text-slate-500">
                      {patient.mrn} · {patient.phone || "No phone"}
                    </dd>
                  )}
                </div>
                <div className="py-4">
                  <dt className="text-xs text-slate-500">Doctor</dt>
                  <dd className="mt-1 break-words font-semibold text-slate-900">
                    {doctor?.displayName || "Select a doctor"}
                  </dd>
                  {doctor && (
                    <dd className="mt-1 break-words text-xs leading-5 text-slate-500">
                      {doctor.department.name}
                    </dd>
                  )}
                </div>
                <div className="py-4">
                  <dt className="text-xs text-slate-500">Consultation date</dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {availability?.date || date || "Choose a date"}
                  </dd>
                </div>
                <div className="py-4">
                  <dt className="text-xs text-slate-500">Time · IST</dt>
                  <dd className="mt-1 font-medium tabular-nums text-slate-900">
                    {selectedSlot
                      ? `${selectedSlot.localStart} – ${selectedSlot.localEnd}`
                      : "Select a slot"}
                  </dd>
                </div>
                <div className="py-4">
                  <dt className="text-xs text-slate-500">Mode</dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {appointmentMode === "ONLINE"
                      ? "Online consultation"
                      : "In-person visit"}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {confirmation
                  ? "The result is shown above. Select a new slot to prepare another booking."
                  : "Review the patient and visit details. Availability is checked again when you confirm."}
              </p>
              <button
                type="button"
                className={`${bookingPrimary} mt-5 w-full`}
                disabled={frozen || !readyToBook}
                onClick={() => void confirmBooking()}
              >
                Confirm booking
              </button>
              {!readyToBook && !confirmation && (
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Select a patient, doctor and slot to continue.
                </p>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
