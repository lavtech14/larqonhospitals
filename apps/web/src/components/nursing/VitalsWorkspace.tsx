"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { useStaffUser } from "@/components/auth/StaffSessionGate";
import { ApiError, apiRequest } from "@/lib/api";

const fields = [
  ["temperatureC", "Temperature", "°C", "0.01"],
  ["pulseBpm", "Pulse", "beats/min", "1"],
  ["respiratoryRate", "Respiratory rate", "breaths/min", "1"],
  ["systolicBp", "Systolic blood pressure", "mmHg", "1"],
  ["diastolicBp", "Diastolic blood pressure", "mmHg", "1"],
  ["oxygenSaturation", "Oxygen saturation", "%", "0.01"],
  ["weightKg", "Weight", "kg", "0.01"],
  ["heightCm", "Height", "cm", "0.01"],
] as const;

type VitalKey = (typeof fields)[number][0];
type Measurements = Partial<Record<VitalKey, number>>;

function emptyValues(): Record<VitalKey, string> {
  return {
    temperatureC: "",
    pulseBpm: "",
    respiratoryRate: "",
    systolicBp: "",
    diastolicBp: "",
    oxygenSaturation: "",
    weightKg: "",
    heightCm: "",
  };
}

type Observation = Record<VitalKey, number | null> & {
  id: string;
  measuredAt: string;
  recordedAt: string;
  notes: string | null;
  recordedBy: {
    id: string;
    fullName: string;
  };
};

type HistoryResponse = {
  encounter: {
    id: string;
    version: number;
    status: string;
    checkedInAt: string;
  };
  patient: {
    id: string;
    mrn: string;
    fullName: string;
  };
  items: Observation[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type LoadState = {
  key: string;
  data: HistoryResponse | null;
  error: string;
};

type PendingSave = {
  key: string;
  body: string;
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "medium",
  timeStyle: "medium",
});

function indiaInputTime(): string {
  const offset = 330 * 60_000;

  return new Date(Date.now() + offset).toISOString().slice(0, 23);
}

const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50";

const primaryButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50";

const inputClass =
  "mt-2 block min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-offset-2 focus:outline-teal-700 disabled:bg-slate-100";

export default function VitalsWorkspace({
  encounterId,
}: {
  encounterId: string;
}) {
  const user = useStaffUser();

  const canRead = ["nursing.queue.read", "encounters.vitals.read"].every(
    (permission) => user.permissions?.includes(permission),
  );

  const canRecord =
    user.permissions?.includes("encounters.vitals.record") ?? false;

  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<LoadState | null>(null);

  const [values, setValues] = useState(emptyValues);
  const [measuredAt, setMeasuredAt] = useState("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<PendingSave | null>(null);
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const [readying, setReadying] = useState(false);
  const [pendingReady, setPendingReady] = useState<string | null>(null);
  const readyLocked = useRef(false);

  const workflowLocked = readying || pendingReady !== null;

  const locked = useRef(false);

  const requestKey = `${encounterId}:${page}:${revision}`;
  const loading = canRead && state?.key !== requestKey;
  const data = state?.key === requestKey ? state.data : null;
  const loadError = state?.key === requestKey ? state.error : "";

  const encounterOpen =
    data?.encounter.status === "CHECKED_IN" ||
    data?.encounter.status === "READY_FOR_DOCTOR";

  useEffect(() => {
    if (!canRead) return;

    let active = true;
    const controller = new AbortController();

    async function load() {
      try {
        const result = await apiRequest<HistoryResponse>(
          `/encounters/${encounterId}/vitals?page=${page}&limit=10`,
          { signal: controller.signal },
        );

        if (!active) return;

        setState({
          key: requestKey,
          data: result,
          error: "",
        });

        setMeasuredAt((current) => current || indiaInputTime());
      } catch (caught) {
        if (!active || controller.signal.aborted) return;

        setState({
          key: requestKey,
          data: null,
          error:
            caught instanceof Error
              ? caught.message
              : "Unable to load this visit.",
        });
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [canRead, encounterId, page, requestKey]);

  // Warn on browser reload/close while a save remains unresolved.
  useEffect(() => {
    if (!pending && !pendingReady) return;

    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", beforeUnload);

    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [pending, pendingReady]);

  async function markReady() {
    if (
      !data ||
      !canRecord ||
      readyLocked.current ||
      locked.current ||
      saving ||
      pending ||
      loading
    ) {
      return;
    }

    if (!pendingReady) {
      const hasUnsavedValues =
        Object.values(values).some((value) => value.trim() !== "") ||
        notes.trim() !== "";

      if (hasUnsavedValues) {
        setSaveError(
          "Save your entered measurements and notes before marking this visit ready.",
        );
        return;
      }

      const confirmed = window.confirm(
        `Mark ${data.patient.fullName} (${data.patient.mrn}) ready for the doctor?`,
      );

      if (!confirmed) return;
    }

    const body =
      pendingReady ??
      JSON.stringify({
        expectedVersion: data.encounter.version,
      });

    readyLocked.current = true;
    setReadying(true);
    setPendingReady(body);
    setSaveError("");
    setNotice("");

    try {
      const response = await apiRequest<{
        alreadyReady: boolean;
        encounter: {
          id: string;
          status: string;
          version: number;
        };
      }>(`/encounters/${encounterId}/ready`, {
        method: "POST",
        body,
      });

      setPendingReady(null);

      setNotice(
        response.alreadyReady
          ? "This visit is already marked ready for the doctor."
          : "Patient marked ready for the doctor.",
      );

      setRevision((current) => current + 1);
    } catch (caught) {
      const uncertain =
        !(caught instanceof ApiError) ||
        caught.status === 0 ||
        caught.status >= 500;

      if (uncertain) {
        setSaveError(
          "The result is unconfirmed. Keep this page open and retry the same ready action.",
        );
      } else {
        setPendingReady(null);
        setSaveError(caught.message);

        if (caught.status === 409) {
          setRevision((current) => current + 1);
        }
      }
    } finally {
      readyLocked.current = false;
      setReadying(false);
    }
  }
  async function send(snapshot: PendingSave) {
    if (locked.current || workflowLocked) return;

    locked.current = true;
    setSaving(true);
    setPending(snapshot);
    setSaveError("");
    setNotice("");

    try {
      const response = await apiRequest<{
        replayed: boolean;
        observation: { id: string };
      }>(`/encounters/${encounterId}/vitals`, {
        method: "POST",
        headers: {
          "Idempotency-Key": snapshot.key,
        },
        body: snapshot.body,
      });

      setPending(null);
      setValues(emptyValues());
      setNotes("");
      setMeasuredAt(indiaInputTime());

      setNotice(
        response.replayed
          ? "The previous save was confirmed. No duplicate reading was created."
          : "Vitals saved successfully.",
      );

      // Fetch the latest encounter version and reading history.
      setPage(1);
      setRevision((current) => current + 1);
    } catch (caught) {
      const uncertain =
        !(caught instanceof ApiError) ||
        caught.status === 0 ||
        caught.status >= 500;

      if (uncertain) {
        // Keep the identical key, timestamp, version and measurements.
        setSaveError(
          "The save result is unconfirmed. Keep this page open and use Retry same save.",
        );
      } else {
        setPending(null);

        setSaveError(
          caught instanceof Error ? caught.message : "Unable to save vitals.",
        );

        if (caught.status === 409) {
          setRevision((current) => current + 1);
        }
      }
    } finally {
      locked.current = false;
      setSaving(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !data ||
      !canRecord ||
      !encounterOpen ||
      loading ||
      locked.current ||
      workflowLocked ||
      pending
    ) {
      return;
    }

    setSaveError("");
    setNotice("");

    const measurements: Measurements = {};

    for (const [key] of fields) {
      const raw = values[key].trim();

      if (raw === "") continue;

      const number = Number(raw);

      if (!Number.isFinite(number)) {
        setSaveError("Enter valid numeric measurements.");
        return;
      }

      measurements[key] = number;
    }

    if (Object.keys(measurements).length === 0) {
      setSaveError("Record at least one measurement.");
      return;
    }

    if (
      (measurements.systolicBp !== undefined) !==
      (measurements.diastolicBp !== undefined)
    ) {
      setSaveError(
        "Record both systolic and diastolic blood pressure together.",
      );
      return;
    }

    // The input is explicitly interpreted as India Standard Time,
    // regardless of the computer's timezone.
    const timestamp = new Date(`${measuredAt}+05:30`);

    if (!Number.isFinite(timestamp.getTime())) {
      setSaveError("Choose a valid measurement date and time.");
      return;
    }

    if (timestamp.getTime() < new Date(data.encounter.checkedInAt).getTime()) {
      setSaveError("Measurement time must be on or after patient check-in.");
      return;
    }

    const snapshot: PendingSave = {
      key: crypto.randomUUID(),
      body: JSON.stringify({
        expectedVersion: data.encounter.version,
        measuredAt: timestamp.toISOString(),
        ...measurements,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      }),
    };

    await send(snapshot);
  }

  if (!canRead) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-slate-950">
          Access unavailable
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Your account cannot view encounter vitals.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/nursing"
            className="text-sm font-semibold text-teal-800 hover:underline"
            onClick={(event) => {
              if (pending || workflowLocked) {
                event.preventDefault();
                setSaveError(
                  "Resolve the pending save before leaving this page.",
                );
              }
            }}
          >
            ← Nursing queue
          </Link>

          <h1 className="mt-3 text-3xl font-bold text-slate-950">
            Vitals and history
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Verify the patient’s name and MRN before recording measurements.
          </p>
        </div>

        <button
          type="button"
          className={buttonClass}
          disabled={loading || saving || Boolean(pending)}
          onClick={() => setRevision((current) => current + 1)}
        >
          Refresh visit
        </button>
      </header>

      {notice && (
        <p
          role="status"
          className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900"
        >
          {notice}
        </p>
      )}

      {saveError && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {saveError}
        </p>
      )}

      {pending && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-3 text-sm text-amber-950">
            {saving
              ? "Saving these measurements…"
              : "The original measurements are locked until this save is confirmed."}
          </p>

          <button
            type="button"
            className={buttonClass}
            disabled={saving}
            onClick={() => void send(pending)}
          >
            {saving ? "Please wait…" : "Retry same save"}
          </button>
        </div>
      )}

      {loading && (
        <p role="status" className="text-sm text-slate-600">
          Loading patient and measurements…
        </p>
      )}

      {loadError && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {loadError} Select Refresh visit to try again.
        </p>
      )}

      {data && (
        <>
          <section className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
            <p className="text-xs font-bold text-teal-800">
              {data.patient.mrn}
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-950">
              {data.patient.fullName}
            </h2>

            <p className="mt-2 text-sm text-slate-700">
              Checked in:{" "}
              {dateTimeFormatter.format(new Date(data.encounter.checkedInAt))}{" "}
              IST
            </p>
          </section>

          {canRecord && encounterOpen ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <h2 className="text-lg font-bold text-slate-950">
                Record a new measurement set
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Leave unavailable measurements blank. Every save creates a
                separate history entry.
              </p>
              {canRecord && data.encounter.status === "CHECKED_IN" && (
                <section className="rounded-2xl border border-teal-200 bg-white p-5">
                  <h2 className="text-lg font-bold text-slate-950">
                    Nursing handover
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Save the measurements, then mark this patient ready for the
                    doctor.
                  </p>

                  <button
                    type="button"
                    className={`${primaryButtonClass} mt-4`}
                    disabled={
                      saving ||
                      loading ||
                      Boolean(pending) ||
                      readying ||
                      (!pendingReady && data.total === 0)
                    }
                    onClick={() => void markReady()}
                  >
                    {readying
                      ? "Updating…"
                      : pendingReady
                        ? "Retry same ready action"
                        : "Ready for doctor"}
                  </button>

                  {data.total === 0 && (
                    <p className="mt-2 text-xs text-slate-500">
                      Record at least one measurement set first.
                    </p>
                  )}
                </section>
              )}

              {data.encounter.status === "READY_FOR_DOCTOR" && (
                <p
                  role="status"
                  className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm font-semibold text-teal-900"
                >
                  Patient is ready for the doctor.
                </p>
              )}
              <form
                className="mt-6"
                onSubmit={(event) => void submit(event)}
                aria-busy={saving}
              >
                <fieldset
                  disabled={
                    saving || loading || Boolean(pending) || workflowLocked
                  }
                  className="m-0 min-w-0 space-y-5 border-0 p-0"
                >
                  <legend className="sr-only">Vitals measurements</legend>

                  <div>
                    <label
                      htmlFor="measured-at"
                      className="text-sm font-semibold text-slate-700"
                    >
                      Measurement date and time · IST
                    </label>

                    <input
                      id="measured-at"
                      type="datetime-local"
                      step="0.001"
                      required
                      value={measuredAt}
                      onChange={(event) => setMeasuredAt(event.target.value)}
                      className={inputClass}
                    />

                    <button
                      type="button"
                      onClick={() => setMeasuredAt(indiaInputTime())}
                      className="mt-2 text-xs font-semibold text-teal-800 underline"
                    >
                      Use current time
                    </button>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                    {fields.map(([key, label, unit, step]) => (
                      <label
                        key={key}
                        htmlFor={`vital-${key}`}
                        className="text-sm font-semibold text-slate-700"
                      >
                        {label}
                        <span className="ml-1 font-normal text-slate-500">
                          ({unit})
                        </span>

                        <input
                          id={`vital-${key}`}
                          type="number"
                          step={step}
                          min={
                            key === "weightKg" || key === "heightCm"
                              ? "0.01"
                              : "0"
                          }
                          max={key === "oxygenSaturation" ? "100" : undefined}
                          value={values[key]}
                          onChange={(event) =>
                            setValues((current) => ({
                              ...current,
                              [key]: event.target.value,
                            }))
                          }
                          className={inputClass}
                        />
                      </label>
                    ))}
                  </div>

                  <label
                    htmlFor="vitals-notes"
                    className="block text-sm font-semibold text-slate-700"
                  >
                    Measurement notes · optional
                    <textarea
                      id="vitals-notes"
                      value={notes}
                      maxLength={1000}
                      rows={3}
                      onChange={(event) => setNotes(event.target.value)}
                      className={inputClass}
                    />
                  </label>

                  <button type="submit" className={primaryButtonClass}>
                    Save vitals
                  </button>
                </fieldset>
              </form>
            </section>
          ) : (
            <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-700">
              {canRecord
                ? "This encounter is no longer open for new nursing measurements. Its history remains available."
                : "You have read-only access to these measurements."}
            </p>
          )}

          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-950">
                Measurement history
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {data.total} reading sets · newest measurement first
              </p>
            </div>

            {data.items.length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
                No measurements recorded yet.
              </p>
            )}

            {data.items.map((observation) => (
              <article
                key={observation.id}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <h3 className="font-semibold text-slate-950">
                  Measured{" "}
                  {dateTimeFormatter.format(new Date(observation.measuredAt))}{" "}
                  IST
                </h3>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Recorded by {observation.recordedBy.fullName} ·{" "}
                  {dateTimeFormatter.format(new Date(observation.recordedAt))}{" "}
                  IST
                </p>

                <dl className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
                  {fields.map(([key, label, unit]) =>
                    observation[key] !== null ? (
                      <div key={key}>
                        <dt className="text-xs text-slate-500">{label}</dt>
                        <dd className="mt-1 text-base font-semibold text-slate-900">
                          {observation[key]}{" "}
                          <span className="text-xs font-normal text-slate-500">
                            {unit}
                          </span>
                        </dd>
                      </div>
                    ) : null,
                  )}
                </dl>

                {observation.notes && (
                  <p className="mt-5 whitespace-pre-wrap border-t border-slate-100 pt-4 text-sm text-slate-700">
                    {observation.notes}
                  </p>
                )}
              </article>
            ))}

            <footer className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Page {data.page} of {Math.max(1, data.totalPages)}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  className={buttonClass}
                  disabled={saving || Boolean(pending) || data.page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Previous
                </button>

                <button
                  type="button"
                  className={buttonClass}
                  disabled={
                    saving || Boolean(pending) || data.page >= data.totalPages
                  }
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </button>
              </div>
            </footer>
          </section>
        </>
      )}
    </div>
  );
}
