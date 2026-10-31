"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { useStaffUser } from "@/components/auth/StaffSessionGate";
import { ApiError, apiRequest } from "@/lib/api";

const sections = [
  ["complaint", "Presenting complaint"],
  ["history", "History"],
  ["examination", "Examination"],
  ["assessment", "Assessment"],
  ["plan", "Plan"],
] as const;

type Draft = Record<(typeof sections)[number][0], string>;

const blank = (): Draft => ({
  complaint: "",
  history: "",
  examination: "",
  assessment: "",
  plan: "",
});

type Note = Draft & {
  id: string;
  revision: number;
  createdAt: string;
  author: {
    fullName: string;
  };
};

const measurements = [
  ["temperatureC", "Temperature", "°C"],
  ["pulseBpm", "Pulse", "beats/min"],
  ["respiratoryRate", "Respiratory rate", "breaths/min"],
  ["systolicBp", "Systolic BP", "mmHg"],
  ["diastolicBp", "Diastolic BP", "mmHg"],
  ["oxygenSaturation", "SpO₂", "%"],
  ["weightKg", "Weight", "kg"],
  ["heightCm", "Height", "cm"],
] as const;

type Vital = Record<(typeof measurements)[number][0], number | null> & {
  id: string;
  measuredAt: string;
  recordedAt: string;
  notes: string | null;
  recordedBy: {
    fullName: string;
  };
};

type Page<T> = {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
};

type Visit = {
  appointment: {
    id: string;
    status: string;
    startsAt: string;
    patient: {
      fullName: string;
      mrn: string;
    };
    doctor: {
      displayName: string;
    };
    encounter: null | {
      id: string;
      status: string;
      version: number;
      startedAt: string | null;
    };
  };
  latestNote: Note | null;
  vitals: Page<Vital>;
  notes: Page<Note>;
};

type Pending = {
  kind: "start" | "notes";
  key: string;
  body: string;
};

const time = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "medium",
  timeStyle: "short",
});

const box = "rounded-2xl border border-slate-200 bg-white p-5 sm:p-6";

const button =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-teal-700";

export default function DoctorEncounter({
  appointmentId,
}: {
  appointmentId: string;
}) {
  const user = useStaffUser();

  const has = (permission: string) =>
    user.permissions?.includes(permission) ?? false;

  const canRead = has("encounters.own.read");

  const [vitalsPage, setVitalsPage] = useState(1);
  const [notesPage, setNotesPage] = useState(1);
  const [revision, setRevision] = useState(0);

  const requestKey = `${appointmentId}:${vitalsPage}:${notesPage}:${revision}`;

  const [remote, setRemote] = useState<{
    key: string;
    data: Visit | null;
    error: string;
  } | null>(null);

  const [draft, setDraft] = useState<Draft>(blank);

  const dirty = useRef(false);
  const baseVersion = useRef<number | null>(null);

  const [isDirty, setIsDirty] = useState(false);
  const [needsReview, setNeedsReview] = useState(false);

  const [pending, setPending] = useState<Pending | null>(null);
  const locked = useRef(false);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loading = canRead && remote?.key !== requestKey;

  const data = remote?.key === requestKey ? remote.data : null;

  const encounter = data?.appointment.encounter;

  const frozen = loading || sending || pending !== null;

  const endpoint = `/doctor/appointments/${appointmentId}/encounter`;

  useEffect(() => {
    if (!canRead) return;

    let active = true;
    const controller = new AbortController();

    async function load() {
      try {
        const result = await apiRequest<Visit>(
          `${endpoint}?vitalsPage=${vitalsPage}&notesPage=${notesPage}`,
          { signal: controller.signal },
        );

        if (!active) return;

        setRemote({
          key: requestKey,
          data: result,
          error: "",
        });

        if (!dirty.current) {
          const note = result.latestNote;

          setDraft(
            note
              ? {
                  complaint: note.complaint,
                  history: note.history,
                  examination: note.examination,
                  assessment: note.assessment,
                  plan: note.plan,
                }
              : blank(),
          );

          baseVersion.current = result.appointment.encounter?.version ?? null;

          setNeedsReview(false);
        } else if (
          baseVersion.current !== result.appointment.encounter?.version
        ) {
          // Preserve the local draft and require review.
          setNeedsReview(true);
        }
      } catch (caught) {
        if (!active || controller.signal.aborted) return;

        setRemote({
          key: requestKey,
          data: null,
          error:
            caught instanceof Error ? caught.message : "Unable to load visit.",
        });
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [canRead, endpoint, vitalsPage, notesPage, requestKey]);

  useEffect(() => {
    if (!isDirty && !pending) return;

    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warn);

    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, [isDirty, pending]);

  async function send(snapshot: Pending) {
    if (locked.current) return;

    locked.current = true;
    setSending(true);
    setPending(snapshot);
    setError("");
    setNotice("");

    try {
      await apiRequest(`${endpoint}/${snapshot.kind}`, {
        method: "POST",
        headers: {
          "Idempotency-Key": snapshot.key,
        },
        body: snapshot.body,
      });

      setPending(null);

      if (snapshot.kind === "notes") {
        dirty.current = false;
        setIsDirty(false);
        setNeedsReview(false);
        setNotesPage(1);
      }

      setNotice(
        snapshot.kind === "start"
          ? "Visit start confirmed."
          : "Clinical notes save confirmed. Previous revisions are preserved.",
      );

      setRevision((current) => current + 1);
    } catch (caught) {
      const uncertain =
        !(caught instanceof ApiError) ||
        caught.status === 0 ||
        caught.status >= 500;

      if (uncertain) {
        setError(
          "Result unconfirmed. Keep this page open and retry the same action.",
        );
      } else {
        setPending(null);
        setError(caught.message);

        if (caught.status === 409) {
          if (snapshot.kind === "notes") {
            setNeedsReview(true);
          }

          setRevision((current) => current + 1);
        }
      }
    } finally {
      locked.current = false;
      setSending(false);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      frozen ||
      data?.appointment.status !== "BOOKED" ||
      !encounter ||
      !has("encounters.own.notes.write") ||
      encounter.status !== "IN_PROGRESS" ||
      needsReview ||
      !isDirty ||
      baseVersion.current === null
    ) {
      return;
    }

    if (!Object.values(draft).some((value) => value.trim())) {
      setError("Enter at least one note section.");
      return;
    }

    void send({
      kind: "notes",
      key: crypto.randomUUID(),
      body: JSON.stringify({
        expectedVersion: baseVersion.current,
        ...draft,
      }),
    });
  }

  function pages<T>(result: Page<T>, change: (page: number) => void) {
    return (
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <span>
          Page {result.page} of {Math.max(1, result.totalPages)}
          {" · "}
          {result.total} records
        </span>

        <div className="flex gap-2">
          <button
            type="button"
            className={button}
            disabled={frozen || result.page <= 1}
            onClick={() => change(result.page - 1)}
          >
            Previous
          </button>

          <button
            type="button"
            className={button}
            disabled={frozen || result.page >= result.totalPages}
            onClick={() => change(result.page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  if (!canRead) {
    return <p role="alert">Your account cannot access doctor encounters.</p>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/my-appointments"
            className="text-sm font-semibold text-teal-800"
            onClick={(event) => {
              if (pending) {
                event.preventDefault();
                setError("Resolve the pending action before leaving.");
              } else if (
                isDirty &&
                !window.confirm("Leave and discard your unsaved draft?")
              ) {
                event.preventDefault();
              }
            }}
          >
            ← My appointments
          </Link>

          <h1 className="mt-3 text-3xl font-bold text-slate-950">
            Clinical encounter
          </h1>
        </div>

        <button
          className={button}
          disabled={frozen}
          onClick={() => setRevision((current) => current + 1)}
        >
          Refresh visit
        </button>
      </header>

      {notice && (
        <p
          role="status"
          className="rounded-xl bg-teal-50 p-4 text-sm text-teal-900"
        >
          {notice}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      {pending && (
        <div className="rounded-xl bg-amber-50 p-4">
          <p className="mb-3 text-sm">
            {sending
              ? "Submitting…"
              : "The original request is retained for a safe retry."}
          </p>

          <button
            className={button}
            disabled={sending}
            onClick={() => void send(pending)}
          >
            {sending ? "Please wait…" : "Retry same action"}
          </button>
        </div>
      )}

      {loading && <p role="status">Loading visit…</p>}

      {remote?.key === requestKey && remote.error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
          {remote.error} Use Refresh visit to retry.
        </p>
      )}

      {data && (
        <>
          <section className={`${box} border-teal-200 bg-teal-50`}>
            <p className="text-xs font-bold text-teal-800">
              {data.appointment.patient.mrn}
            </p>

            <h2 className="mt-1 text-xl font-bold">
              {data.appointment.patient.fullName}
            </h2>

            <p className="mt-2 text-sm">
              {data.appointment.doctor.displayName}
              {" · "}
              {time.format(new Date(data.appointment.startsAt))} IST
            </p>

            <p className="mt-2 text-sm font-semibold">
              Visit:{" "}
              {encounter
                ? encounter.status.replaceAll("_", " ")
                : "Not checked in"}
            </p>

            {encounter?.startedAt && (
              <p className="mt-1 text-xs">
                Started {time.format(new Date(encounter.startedAt))} IST
              </p>
            )}

            {data.appointment.status === "BOOKED" &&
              encounter?.status === "READY_FOR_DOCTOR" &&
              has("encounters.own.start") && (
                <button
                  className={`${button} mt-4 bg-teal-800 text-white`}
                  disabled={frozen}
                  onClick={() => {
                    const confirmed = window.confirm(
                      `Start the visit for ${data.appointment.patient.fullName} (${data.appointment.patient.mrn})?`,
                    );

                    if (!confirmed) return;

                    void send({
                      kind: "start",
                      key: crypto.randomUUID(),
                      body: JSON.stringify({
                        expectedVersion: encounter.version,
                      }),
                    });
                  }}
                >
                  Start visit
                </button>
              )}

            {has("prescriptions.own.read") && (
              <Link
                href={`/my-appointments/${appointmentId}/prescriptions`}
                className={`${button} mt-4`}
                onClick={(event) => {
                  if (pending) {
                    event.preventDefault();
                    setError(
                      "Resolve the pending action before opening prescriptions.",
                    );
                  } else if (
                    isDirty &&
                    !window.confirm(
                      "Your clinical notes have unsaved changes. Leave this page?",
                    )
                  ) {
                    event.preventDefault();
                  }
                }}
              >
                Prescriptions
              </Link>
            )}

            {has("lab-orders.own.read") && (
              <Link
                href={`/my-appointments/${appointmentId}/lab-orders`}
                className={`${button} mt-4`}
                onClick={(event) => {
                  if (pending) {
                    event.preventDefault();
                    setError(
                      "Resolve the pending action before opening lab orders.",
                    );
                  } else if (
                    isDirty &&
                    !window.confirm(
                      "Leave and discard your unsaved clinical note edits?",
                    )
                  ) {
                    event.preventDefault();
                  }
                }}
              >
                Order lab tests
              </Link>
            )}
            {has("lab-orders.own.read") && (
              <Link
                href={`/my-appointments/${appointmentId}/lab-reports`}
                className={`${button} mt-4`}
                onClick={(event) => {
                  if (pending) {
                    event.preventDefault();
                    setError(
                      "Resolve the pending action before opening reports.",
                    );
                  } else if (
                    isDirty &&
                    !window.confirm(
                      "Leave and discard unsaved clinical note edits?",
                    )
                  ) {
                    event.preventDefault();
                  }
                }}
              >
                Released lab reports
              </Link>
            )}
            <Link
              href={`/my-appointments/${appointmentId}/summary`}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-900"
              onClick={(event) => {
                if (pending) {
                  event.preventDefault();
                  return;
                }

                if (
                  isDirty &&
                  !window.confirm(
                    "Leave this screen and discard unsaved clinical note edits?",
                  )
                ) {
                  event.preventDefault();
                }
              }}
            >
              Finalize visit summary
            </Link>

            {encounter?.status === "CHECKED_IN" && (
              <p className="mt-3 text-sm">
                Waiting for the nurse to mark this patient ready.
              </p>
            )}
          </section>

          <section className={box}>
            <h2 className="text-xl font-bold">Vitals history</h2>

            {!data.vitals.items.length && (
              <p className="mt-3 text-sm text-slate-600">
                No readings on this page.
              </p>
            )}

            {data.vitals.items.map((vital) => (
              <article
                key={vital.id}
                className="mt-4 rounded-xl border border-slate-200 p-4"
              >
                <h3 className="text-sm font-semibold">
                  Measured {time.format(new Date(vital.measuredAt))} IST
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  Recorded by {vital.recordedBy.fullName}
                  {" · "}
                  {time.format(new Date(vital.recordedAt))} IST
                </p>

                <dl className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                  {measurements.map(
                    ([key, label, unit]) =>
                      vital[key] !== null && (
                        <div key={key}>
                          <dt className="text-xs text-slate-500">{label}</dt>
                          <dd className="mt-1 font-semibold">
                            {vital[key]}{" "}
                            <span className="text-xs font-normal">{unit}</span>
                          </dd>
                        </div>
                      ),
                  )}
                </dl>

                {vital.notes && (
                  <p className="mt-3 whitespace-pre-wrap text-sm">
                    {vital.notes}
                  </p>
                )}
              </article>
            ))}

            {pages(data.vitals, setVitalsPage)}
          </section>

          {encounter && (
            <section className={box}>
              <h2 className="text-xl font-bold">Clinical notes · draft</h2>

              <p className="mt-2 text-sm text-slate-600">
                Every save preserves a complete revision. These notes are not
                signed or finalized.
              </p>

              {needsReview && (
                <div className="my-4 rounded-xl bg-amber-50 p-4 text-sm">
                  <p>
                    The encounter changed. Your local draft is preserved.
                    Compare it with the latest saved revision below before
                    continuing.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className={button}
                      disabled={frozen}
                      onClick={() => {
                        if (
                          !window.confirm(
                            "Discard your local draft and load the latest saved notes?",
                          )
                        ) {
                          return;
                        }

                        dirty.current = false;
                        setIsDirty(false);
                        setRevision((current) => current + 1);
                      }}
                    >
                      Load latest saved notes
                    </button>

                    <button
                      className={button}
                      disabled={frozen || encounter.status !== "IN_PROGRESS"}
                      onClick={() => {
                        if (
                          !window.confirm(
                            "I reviewed the latest revision and want to save my local draft as the next revision.",
                          )
                        ) {
                          return;
                        }

                        baseVersion.current = encounter.version;
                        setNeedsReview(false);
                      }}
                    >
                      Keep draft after review
                    </button>
                  </div>
                </div>
              )}

              <form className="mt-5" onSubmit={save}>
                <fieldset
                  disabled={
                    frozen ||
                    data.appointment.status !== "BOOKED" ||
                    encounter.status !== "IN_PROGRESS" ||
                    !has("encounters.own.notes.write")
                  }
                  className="m-0 min-w-0 space-y-4 border-0 p-0"
                >
                  <legend className="sr-only">Clinical note sections</legend>

                  {sections.map(([key, label]) => (
                    <label
                      key={key}
                      htmlFor={`note-${key}`}
                      className="block text-sm font-semibold text-slate-700"
                    >
                      {label}

                      <textarea
                        id={`note-${key}`}
                        rows={4}
                        maxLength={5000}
                        value={draft[key]}
                        onChange={(event) => {
                          dirty.current = true;
                          setIsDirty(true);

                          setDraft((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }));
                        }}
                        className="mt-2 block w-full rounded-xl border border-slate-300 p-3 font-normal focus:outline-2 focus:outline-teal-700 disabled:bg-slate-50"
                      />
                    </label>
                  ))}

                  <button
                    type="submit"
                    className={`${button} bg-teal-800 text-white`}
                    disabled={needsReview || !isDirty}
                  >
                    Save draft revision
                  </button>
                </fieldset>
              </form>

              {encounter.status !== "IN_PROGRESS" && (
                <p className="mt-3 text-sm text-slate-600">
                  Start the visit to edit notes. Closed encounters remain
                  read-only.
                </p>
              )}
            </section>
          )}

          <section className={box}>
            <h2 className="text-xl font-bold">Saved note revisions</h2>

            {data.latestNote && (
              <article className="mt-4 rounded-xl border border-teal-200 p-4">
                <h3 className="font-semibold">
                  Latest saved revision #{data.latestNote.revision}
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  {data.latestNote.author.fullName}
                  {" · "}
                  {time.format(new Date(data.latestNote.createdAt))} IST
                </p>

                {sections.map(([key, label]) => (
                  <div key={key} className="mt-3">
                    <h4 className="text-xs font-semibold text-slate-500">
                      {label}
                    </h4>
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {data.latestNote?.[key] || "Not recorded"}
                    </p>
                  </div>
                ))}
              </article>
            )}

            {!data.notes.total && (
              <p className="mt-3 text-sm text-slate-600">
                No clinical notes saved yet.
              </p>
            )}

            {data.notes.items.map((note) => (
              <details
                key={note.id}
                className="mt-3 rounded-xl border border-slate-200 p-4"
              >
                <summary className="cursor-pointer text-sm font-semibold">
                  Revision #{note.revision}
                  {" · "}
                  {note.author.fullName}
                  {" · "}
                  {time.format(new Date(note.createdAt))} IST
                </summary>

                {sections.map(([key, label]) => (
                  <div key={key} className="mt-3">
                    <h3 className="text-xs font-semibold text-slate-500">
                      {label}
                    </h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {note[key] || "Not recorded"}
                    </p>
                  </div>
                ))}
              </details>
            ))}

            {pages(data.notes, setNotesPage)}
          </section>
        </>
      )}
    </div>
  );
}
