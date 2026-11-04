"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { ApiError } from "@/lib/api";
import { patientApiRequest } from "@/lib/patient-api";

type Assignment = {
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

type MeasurementKey =
  | "weightKg"
  | "temperatureC"
  | "systolicBp"
  | "diastolicBp"
  | "spo2Percent"
  | "pulseBpm"
  | "bloodGlucoseMgDl";

type GlucoseContext = "" | "FASTING" | "BEFORE_MEAL" | "AFTER_MEAL" | "RANDOM";

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

type PendingRequest = {
  key: string;
  body: string;
};

const fields: {
  key: MeasurementKey;
  label: string;
  unit: string;
  step: string;
  min?: number;
  max?: number;
}[] = [
  {
    key: "weightKg",
    label: "Weight",
    unit: "kg",
    step: "0.001",
    min: 0.001,
    max: 9999.999,
  },
  {
    key: "temperatureC",
    label: "Temperature",
    unit: "°C",
    step: "0.001",
    min: -273.15,
    max: 999.999,
  },
  {
    key: "systolicBp",
    label: "Systolic blood pressure",
    unit: "mmHg",
    step: "1",
    min: 1,
    max: 2147483647,
  },
  {
    key: "diastolicBp",
    label: "Diastolic blood pressure",
    unit: "mmHg",
    step: "1",
    min: 1,
    max: 2147483647,
  },
  {
    key: "spo2Percent",
    label: "Oxygen saturation",
    unit: "%",
    step: "0.001",
    min: 0,
    max: 100,
  },
  {
    key: "pulseBpm",
    label: "Pulse",
    unit: "beats/min",
    step: "1",
    min: 1,
    max: 2147483647,
  },
  {
    key: "bloodGlucoseMgDl",
    label: "Blood glucose",
    unit: "mg/dL",
    step: "0.001",
    min: 0.001,
    max: 99999.999,
  },
];

function emptyValues(): Record<MeasurementKey, string> {
  return {
    weightKg: "",
    temperatureC: "",
    systolicBp: "",
    diastolicBp: "",
    spo2Percent: "",
    pulseBpm: "",
    bloodGlucoseMgDl: "",
  };
}

function localNow() {
  const date = new Date();

  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function hospitalDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value;

  return `${part("year")}-${part("month")}-${part("day")}`;
}

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

export default function PatientReadingForm({
  assignmentId,
}: {
  assignmentId: string;
}) {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refresh, setRefresh] = useState(0);

  const [measuredAt, setMeasuredAt] = useState(localNow);
  const [values, setValues] = useState(emptyValues);
  const [glucoseContext, setGlucoseContext] = useState<GlucoseContext>("");
  const [notes, setNotes] = useState("");

  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<Reading | null>(null);

  const saveLock = useRef(false);

  const base = `/patient/rpm/assignments/${encodeURIComponent(assignmentId)}`;

  const historyUrl = `/patient/monitoring/${assignmentId}/history`;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Reuse the authorized history endpoint for assignment details.
        const result = await patientApiRequest<{
          assignment: Assignment;
        }>(`${base}/readings?page=1&limit=1`);

        if (!cancelled) {
          setAssignment(result.assignment);
          setLoadError("");
        }
      } catch (caught) {
        if (!cancelled) {
          setAssignment(null);
          setLoadError(
            caught instanceof Error
              ? caught.message
              : "Unable to load your RPM assignment.",
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
  }, [base, refresh]);

  function reloadAssignment() {
    setLoading(true);
    setLoadError("");
    setRefresh((value) => value + 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saveLock.current) return;

    setError("");

    let request = pending;

    if (!request) {
      try {
        if (loading || loadError || !assignment?.canSubmit) {
          throw new Error(
            "This assignment is not currently open for submissions.",
          );
        }

        const measured = new Date(measuredAt);

        if (
          !Number.isFinite(measured.getTime()) ||
          measured.getTime() > Date.now()
        ) {
          throw new Error(
            "Enter a valid measurement time that is not in the future.",
          );
        }

        const measuredDate = hospitalDate(measured);
        const start = assignment.startDate.slice(0, 10);
        const end = assignment.endDate.slice(0, 10);

        if (measuredDate < start || measuredDate > end) {
          throw new Error(
            "Measurement time must fall within your monitoring dates.",
          );
        }

        const measurements: Partial<Record<MeasurementKey, number>> = {};

        for (const field of fields) {
          const raw = values[field.key].trim();

          if (!raw) continue;

          const value = Number(raw);

          if (
            !Number.isFinite(value) ||
            (field.step === "1" && !Number.isInteger(value)) ||
            (field.min !== undefined && value < field.min) ||
            (field.max !== undefined && value > field.max)
          ) {
            throw new Error(
              `Check the value and unit for ${field.label.toLowerCase()}.`,
            );
          }

          measurements[field.key] = value;
        }

        if (Object.keys(measurements).length === 0) {
          throw new Error("Enter at least one vital reading.");
        }

        if (
          (measurements.systolicBp !== undefined) !==
          (measurements.diastolicBp !== undefined)
        ) {
          throw new Error("Enter both systolic and diastolic blood pressure.");
        }

        if (measurements.bloodGlucoseMgDl !== undefined && !glucoseContext) {
          throw new Error(
            "Select when the blood glucose measurement was taken.",
          );
        }

        request = {
          key: crypto.randomUUID(),

          body: JSON.stringify({
            measuredAt: measured.toISOString(),
            ...measurements,

            ...(measurements.bloodGlucoseMgDl !== undefined
              ? { glucoseContext }
              : {}),

            notes: notes.trim(),
          }),
        };

        setPending(request);
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Check your readings.",
        );
        return;
      }
    }

    saveLock.current = true;
    setBusy(true);

    try {
      const result = await patientApiRequest<{
        replayed: boolean;
        reading: Reading;
      }>(`${base}/readings`, {
        method: "POST",

        headers: {
          "Idempotency-Key": request.key,
        },

        body: request.body,
      });

      setPending(null);
      setSaved(result.reading);
    } catch (caught) {
      const definiteRejection =
        caught instanceof ApiError &&
        [400, 401, 403, 404, 409, 422].includes(caught.status);

      if (definiteRejection) {
        setPending(null);
        setError(caught.message);
      } else {
        setError(
          "We could not confirm whether the readings were saved. Stay on this page and select “Retry same submission”.",
        );
      }
    } finally {
      saveLock.current = false;
      setBusy(false);
    }
  }

  function addAnother() {
    setSaved(null);
    setValues(emptyValues());
    setMeasuredAt(localNow());
    setGlucoseContext("");
    setNotes("");
    setError("");
    reloadAssignment();
  }

  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100";

  if (saved) {
    return (
      <section className="mx-auto max-w-3xl space-y-5">
        <header>
          <p className="text-xs font-bold uppercase tracking-widest text-teal-700">
            Submission saved
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            Your readings are saved
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Measured {dateTime(saved.measuredAt)} IST. Your doctor and assigned
            nurse can view these readings.
          </p>
        </header>

        <dl className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => {
            const value = saved[field.key];

            if (value === null || value === undefined) return null;

            return (
              <div
                key={field.key}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <dt className="text-sm text-slate-500">{field.label}</dt>
                <dd className="mt-2 text-xl font-semibold text-slate-950">
                  {value}{" "}
                  <span className="text-sm font-normal text-slate-500">
                    {field.unit}
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>

        {saved.glucoseContext && (
          <p className="text-sm capitalize text-slate-600">
            Glucose context:{" "}
            {saved.glucoseContext.replaceAll("_", " ").toLowerCase()}
          </p>
        )}

        {saved.notes && (
          <p className="whitespace-pre-wrap rounded-xl bg-white p-4 text-sm leading-6 text-slate-700">
            Your note: {saved.notes}
          </p>
        )}

        <p className="rounded-xl bg-slate-100 p-4 text-sm leading-6 text-slate-700">
          Saving does not mean a clinician has reviewed the reading. This
          version does not automatically assess high or low values.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link
            href={historyUrl}
            className="inline-flex min-h-12 items-center rounded-xl bg-teal-800 px-5 text-sm font-semibold text-white"
          >
            View my readings
          </Link>

          <button
            type="button"
            onClick={addAnother}
            className="min-h-12 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold"
          >
            Add another measurement
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      {!pending && (
        <Link
          href="/patient/monitoring"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-800 hover:underline"
        >
          ← Home monitoring
        </Link>
      )}

      <header>
        <h1 className="text-3xl font-bold text-slate-950">
          Enter vital readings
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          Enter only the measurements you took. Leave other fields blank. Use a
          separate submission for measurements taken at another time.
        </p>
      </header>

      {loading && (
        <p role="status" className="text-sm text-slate-600">
          Loading your assignment…
        </p>
      )}

      {loadError && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          <p>{loadError}</p>

          <button
            type="button"
            disabled={busy || Boolean(pending)}
            onClick={reloadAssignment}
            className="mt-2 min-h-11 font-semibold underline"
          >
            Try again
          </button>
        </div>
      )}

      {assignment && (
        <>
          <section className="rounded-xl bg-teal-50 p-4 text-sm leading-6 text-teal-950">
            <p>Doctor: {assignment.doctor.displayName}</p>
            <p>Nurse: {assignment.nurse.fullName}</p>
            <p className="mt-2">
              {calendarDate(assignment.startDate)} –{" "}
              {calendarDate(assignment.endDate)}
            </p>
          </section>

          {!assignment.canSubmit && (
            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
              This assignment is {assignment.status.toLowerCase()}. New readings
              cannot currently be submitted.
            </p>
          )}
        </>
      )}

      <form onSubmit={submit} aria-busy={busy} className="space-y-5">
        <fieldset
          disabled={
            loading ||
            Boolean(loadError) ||
            !assignment?.canSubmit ||
            busy ||
            Boolean(pending)
          }
          className="space-y-5"
        >
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <label className="block text-sm font-semibold text-slate-800">
              Measurement date and time
              <input
                type="datetime-local"
                required
                value={measuredAt}
                onChange={(event) => setMeasuredAt(event.target.value)}
                className={inputClass}
              />
            </label>

            <p className="mt-2 text-xs text-slate-500">
              Input timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
              .
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-950">
              Vital readings
            </h2>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {fields.map((field) => (
                <label
                  key={field.key}
                  className="block text-sm font-semibold text-slate-800"
                >
                  {field.label} ({field.unit})
                  <input
                    type="number"
                    step={field.step}
                    min={field.min}
                    max={field.max}
                    inputMode={field.step === "1" ? "numeric" : "decimal"}
                    value={values[field.key]}
                    onChange={(event) => {
                      const value = event.target.value;

                      setValues((current) => ({
                        ...current,
                        [field.key]: value,
                      }));

                      if (field.key === "bloodGlucoseMgDl" && !value.trim()) {
                        setGlucoseContext("");
                      }
                    }}
                    className={inputClass}
                  />
                </label>
              ))}
            </div>

            {values.bloodGlucoseMgDl.trim() && (
              <label className="mt-5 block text-sm font-semibold text-slate-800">
                Blood glucose measurement context
                <select
                  required
                  value={glucoseContext}
                  onChange={(event) =>
                    setGlucoseContext(event.target.value as GlucoseContext)
                  }
                  className={inputClass}
                >
                  <option value="">Select context</option>
                  <option value="FASTING">Fasting</option>
                  <option value="BEFORE_MEAL">Before meal</option>
                  <option value="AFTER_MEAL">After meal</option>
                  <option value="RANDOM">Random</option>
                </select>
              </label>
            )}

            <p className="mt-4 text-xs leading-5 text-slate-500">
              Enter both blood-pressure numbers together. Values are stored as
              entered; input limits are not clinical normal ranges.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <label className="block text-sm font-semibold text-slate-800">
              Note — optional
              <textarea
                rows={3}
                maxLength={2000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className={inputClass}
              />
            </label>
          </section>
        </fieldset>

        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>

        <button
          type="submit"
          disabled={
            busy ||
            (!pending &&
              (loading || Boolean(loadError) || !assignment?.canSubmit))
          }
          className="min-h-12 rounded-xl bg-teal-800 px-6 text-sm font-semibold text-white hover:bg-teal-900 disabled:opacity-50"
        >
          {busy
            ? "Saving…"
            : pending
              ? "Retry same submission"
              : "Save readings"}
        </button>
      </form>
    </section>
  );
}
