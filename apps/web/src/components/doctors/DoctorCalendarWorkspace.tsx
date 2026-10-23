"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useStaffUser } from "@/components/auth/StaffSessionGate";
import { ApiError, apiRequest } from "@/lib/api";

interface Slot {
  startsAt: string;
  endsAt: string;
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
  timeZone: string;
  availabilityVersion: number;
  reservationChecked: boolean;
  reason: string;
  slots: Slot[];
}

interface Closure {
  id: string;
  date: string;
  isClosed: boolean;
  version: number;
}

interface ClosureResponse {
  timeZone: string;
  items: Closure[];
}

interface CalendarData {
  slots: SlotResponse;
  doctorClosure: Closure | null;
  hospitalClosure: Closure | null;
}

interface Props {
  doctorId: string;
}

const reasonLabels: Record<string, string> = {
  OPEN: "Consultation slots are available.",
  DOCTOR_INACTIVE: "This doctor profile is inactive.",
  DEPARTMENT_INACTIVE: "This department is inactive.",
  HOSPITAL_CLOSED: "The hospital is closed on this date.",
  DOCTOR_UNAVAILABLE: "The doctor is on leave on this date.",
  NO_WEEKLY_SCHEDULE: "Configure weekly availability first.",
  NON_WORKING_DAY: "No consultation hours are configured for this weekday.",
  NO_FUTURE_SLOTS: "No future consultation slots remain on this date.",
  ALL_SLOTS_BOOKED: "All remaining consultation slots are booked.",
};

function hospitalToday(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}`;
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function dateLabel(date: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export default function DoctorCalendarWorkspace({ doctorId }: Props) {
  // Same session hook used by the existing availability workspace.
  const user = useStaffUser();

  const canRead = user.permissions?.includes("availability.read") ?? false;

  const canManage = user.permissions?.includes("availability.manage") ?? false;

  const [today] = useState(hospitalToday);
  const [date, setDate] = useState(today);
  const [revision, setRevision] = useState(0);

  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stale, setStale] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!canRead || !date) return;

    const controller = new AbortController();
    let active = true;

    async function load() {
      setLoading(true);
      setData(null);
      setError("");

      const query = new URLSearchParams({
        from: date,
        to: date,
      });

      try {
        const [slots, doctorClosures, hospitalClosures] = await Promise.all([
          apiRequest<SlotResponse>(`/doctors/${doctorId}/slots?date=${date}`, {
            signal: controller.signal,
          }),
          apiRequest<ClosureResponse>(
            `/doctors/${doctorId}/closures?${query}`,
            { signal: controller.signal },
          ),
          apiRequest<ClosureResponse>(`/calendar/closures?${query}`, {
            signal: controller.signal,
          }),
        ]);

        if (!active) return;

        setData({
          slots,
          doctorClosure:
            doctorClosures.items.find((item) => item.date === date) ?? null,
          hospitalClosure:
            hospitalClosures.items.find((item) => item.date === date) ?? null,
        });

        setStale(false);
      } catch (error) {
        if (active) {
          setError(errorMessage(error));
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [doctorId, date, revision, canRead]);

  async function saveClosure(scope: "doctor" | "hospital", isClosed: boolean) {
    if (!data || saving || loading || stale || !canManage) return;

    const current =
      scope === "doctor" ? data.doctorClosure : data.hospitalClosure;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await apiRequest(
        scope === "doctor"
          ? `/doctors/${doctorId}/closures`
          : "/calendar/closures",
        {
          method: "PUT",
          body: JSON.stringify({
            date,
            isClosed,
            expectedVersion: current?.version ?? 0,
          }),
        },
      );

      setMessage(
        scope === "doctor"
          ? isClosed
            ? "Doctor leave saved."
            : "Doctor leave removed."
          : isClosed
            ? "Hospital closure saved."
            : "Hospital closure removed.",
      );

      // Reload closures and recalculate slots after saving.
      setRevision((value) => value + 1);
    } catch (error) {
      // A failed request may have reached the server.
      // Require a fresh read before another write.
      setStale(true);

      setError(
        error instanceof ApiError && error.status === 409
          ? "This date was changed by another administrator. Refresh the calendar before trying again."
          : `${errorMessage(error)} Refresh the calendar before trying again.`,
      );
    } finally {
      setSaving(false);
    }
  }

  if (!canRead) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          Access unavailable
        </h1>
        <p>Your account cannot view doctor availability.</p>
      </section>
    );
  }

  const busy = loading || saving;
  const doctorClosed = data?.doctorClosure?.isClosed ?? false;
  const hospitalClosed = data?.hospitalClosure?.isClosed ?? false;

  return (
    <div className="grid min-w-0 gap-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="mb-2 text-[10px] font-bold tracking-[0.16em] text-teal-800">
            Doctor calendar
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            {data?.slots.doctor.displayName ?? "Consultation calendar"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Review consultation slots, doctor leave, and hospital closures.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/doctors"
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Back to doctors
          </Link>

          <Link
            href={`/doctors/${doctorId}/availability`}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Weekly availability
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 flex flex-wrap items-end gap-3 [&>label]:flex-[1_1_240px] [&>label]:max-w-md">
        <label className="block min-w-0 text-xs font-semibold text-slate-600 [&>label]:block [&>span]:block [&>input]:mt-2 [&>input]:block [&>input]:min-h-12 [&>input]:w-full [&>input]:min-w-0 [&>input]:rounded-xl [&>input]:border [&>input]:border-slate-300 [&>input]:bg-white [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:font-normal [&>input]:text-slate-900 [&>input:disabled]:bg-slate-50 [&>select]:mt-2 [&>select]:block [&>select]:min-h-12 [&>select]:w-full [&>select]:min-w-0 [&>select]:rounded-xl [&>select]:border [&>select]:border-slate-300 [&>select]:bg-white [&>select]:px-3 [&>select]:py-2 [&>select]:text-sm [&>select]:font-normal [&>select]:text-slate-900 [&>select:disabled]:bg-slate-50 [&>input:focus-visible]:outline-2 [&>input:focus-visible]:outline-offset-2 [&>input:focus-visible]:outline-teal-700 [&>select:focus-visible]:outline-2 [&>select:focus-visible]:outline-offset-2 [&>select:focus-visible]:outline-teal-700">
          <span>Consultation date</span>
          <input
            type="date"
            value={date}
            min={today || undefined}
            max={today ? addDays(today, 180) : undefined}
            disabled={saving || !date}
            onChange={(event) => {
              const value = event.target.value;
              if (!value) return;

              setDate(value);
              setMessage("");
            }}
          />
        </label>

        <button
          type="button"
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy || !date}
          onClick={() => {
            setMessage("");
            setRevision((value) => value + 1);
          }}
        >
          {loading ? "Refreshing..." : "Refresh calendar"}
        </button>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          All times are in India Standard Time.
        </p>
      </section>

      <div aria-live="polite">
        {error && (
          <p
            className="my-4 text-sm leading-6 text-red-700 empty:hidden"
            role="alert"
          >
            {error}
          </p>
        )}
        {message && (
          <p className="my-4 text-sm leading-6 text-teal-800 empty:hidden">
            {message}
          </p>
        )}
      </div>

      {loading && <p role="status">Loading calendar...</p>}

      {data && (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 flex flex-col items-start justify-between gap-5">
              <div>
                <p className="mb-2 text-[10px] font-bold tracking-[0.16em] text-teal-800">
                  Doctor
                </p>
                <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                  {doctorClosed ? "On leave" : "No leave recorded"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {doctorClosed
                    ? "Consultation slots are blocked for this date."
                    : "Weekly consultation hours apply."}
                </p>
              </div>

              {canManage && (
                <button
                  type="button"
                  className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={busy || stale}
                  onClick={() => void saveClosure("doctor", !doctorClosed)}
                >
                  {doctorClosed ? "Remove leave" : "Mark full-day leave"}
                </button>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 flex flex-col items-start justify-between gap-5">
              <div>
                <p className="mb-2 text-[10px] font-bold tracking-[0.16em] text-teal-800">
                  Hospital
                </p>
                <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                  {hospitalClosed ? "Closed" : "No closure recorded"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {hospitalClosed
                    ? "Consultation slots are blocked for every doctor."
                    : "Each doctor’s schedule and leave apply."}
                </p>
              </div>

              {canManage && (
                <details className="w-full border-t border-slate-100 pt-3 [&>summary]:cursor-pointer [&>summary]:py-2 [&>summary]:text-sm [&>summary]:font-semibold [&>summary]:text-slate-700 [&>button]:mt-4">
                  <summary>Manage hospital closure</summary>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    This changes slot availability for every doctor on{" "}
                    {dateLabel(date)}.
                  </p>

                  <button
                    type="button"
                    className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={busy || stale}
                    onClick={() =>
                      void saveClosure("hospital", !hospitalClosed)
                    }
                  >
                    {hospitalClosed
                      ? "Remove hospital closure"
                      : "Close hospital for this date"}
                  </button>
                </details>
              )}
            </section>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="mb-2 text-[10px] font-bold tracking-[0.16em] text-teal-800">
                  Slot preview
                </p>
                <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                  {dateLabel(date)}
                </h2>
              </div>
              <span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold tabular-nums text-teal-900">
                {data.slots.slots.length} slots
              </span>
            </div>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              {reasonLabels[data.slots.reason] ?? "No slots are available."}
            </p>

            {data.slots.slots.length > 0 && (
              <ul className="mt-5 grid list-none gap-3 min-[380px]:grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {data.slots.slots.map((slot) => (
                  <li
                    key={slot.startsAt}
                    className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 [&>strong]:text-xs [&>strong]:tabular-nums [&>strong]:text-slate-900 [&>span]:text-xs [&>span]:text-slate-500"
                  >
                    <strong>
                      {slot.localStart} – {slot.localEnd}
                    </strong>
                    <span>{slot.durationMinutes} minutes</span>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-6 border-t border-slate-100 pt-4 text-xs leading-6 text-slate-500">
              Existing doctor bookings are excluded. Availability can change
              until your booking is confirmed. Refresh to update the results.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
