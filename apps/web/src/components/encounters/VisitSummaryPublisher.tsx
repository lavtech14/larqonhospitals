"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import { useStaffUser } from "@/components/auth/StaffSessionGate";

type PublishedSummary = {
  id: string;
  patientName: string;
  patientMrn: string;
  doctorName: string;
  doctorRegistrationNumber: string | null;
  doctorRegistrationAuthority: string | null;
  summary: string;
  carePlan: string;
  followUp: string;
  returnPrecautions: string;
  publishedAt: string;
};

type Response = {
  appointmentId: string;

  patient: {
    fullName: string;
    mrn: string;
  };

  encounter: {
    id: string;
    status: string;
    version: number;
    completedAt: string | null;
  };

  sourceNote: {
    id: string;
    revision: number;
    assessment: string;
    plan: string;
  } | null;

  draftPrescriptionCount: number;
  publishedSummary: PublishedSummary | null;
};

type Fields = {
  summary: string;
  carePlan: string;
  followUp: string;
  returnPrecautions: string;
};

type Snapshot = {
  key: string;
  body: string;
};

const emptyFields: Fields = {
  summary: "",
  carePlan: "",
  followUp: "",
  returnPrecautions: "",
};

const button =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";

const input =
  "mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-normal focus:outline-2 focus:outline-teal-700 disabled:bg-slate-50";

const sections = [
  {
    key: "summary",
    label: "Visit summary",
    max: 5000,
    required: true,
  },
  {
    key: "carePlan",
    label: "Care plan and advice",
    max: 5000,
    required: true,
  },
  {
    key: "followUp",
    label: "Follow-up instructions",
    max: 2000,
    required: false,
  },
  {
    key: "returnPrecautions",
    label: "When to seek further help",
    max: 2000,
    required: false,
  },
] as const;

export default function VisitSummaryPublisher({
  appointmentId,
}: {
  appointmentId: string;
}) {
  const user = useStaffUser();

  const canRead = user.permissions?.includes("encounters.own.read") ?? false;

  const canPublish =
    user.permissions?.includes("encounters.own.publish") ?? false;

  const endpoint = `/doctor/appointments/${appointmentId}/encounter/summary`;

  const [revision, setRevision] = useState(0);

  const [remote, setRemote] = useState<{
    revision: number;
    data: Response | null;
    error: string;
  } | null>(null);

  const [fields, setFields] = useState<Fields>(emptyFields);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);

  const [isDirty, setIsDirty] = useState(false);
  const dirty = useRef(false);

  const [pending, setPending] = useState<Snapshot | null>(null);
  const [sending, setSending] = useState(false);

  const lock = useRef(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const data = remote?.revision === revision ? remote.data : null;

  const loading = canRead && remote?.revision !== revision;

  const frozen = loading || sending || pending !== null;

  useEffect(() => {
    if (!canRead) return;

    let active = true;
    const controller = new AbortController();

    async function load() {
      try {
        const result = await apiRequest<Response>(endpoint, {
          signal: controller.signal,
        });

        if (!active) return;

        setRemote({
          revision,
          data: result,
          error: "",
        });

        // Always require fresh confirmation after refreshing.
        setReviewConfirmed(false);
      } catch (caught) {
        if (!active || controller.signal.aborted) return;

        setRemote({
          revision,
          data: null,
          error:
            caught instanceof Error
              ? caught.message
              : "Unable to load visit summary.",
        });
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [canRead, endpoint, revision]);

  useEffect(() => {
    if (!isDirty && !pending && !sending) return;

    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warn);

    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, [isDirty, pending, sending]);

  function change(key: keyof Fields, value: string) {
    if (frozen || lock.current) return;

    dirty.current = true;
    setIsDirty(true);
    setReviewConfirmed(false);

    setFields((current) => ({
      ...current,
      [key]: value,
    }));

    setNotice("");
  }

  async function publish(snapshot: Snapshot) {
    if (lock.current) return;

    lock.current = true;

    setSending(true);
    setPending(snapshot);
    setError("");
    setNotice("");

    try {
      await apiRequest(`${endpoint}/publish`, {
        method: "POST",

        headers: {
          "Idempotency-Key": snapshot.key,
        },

        body: snapshot.body,
      });

      setPending(null);

      dirty.current = false;
      setIsDirty(false);

      setReviewConfirmed(false);

      setNotice(
        "Visit summary published. The clinical encounter is completed.",
      );

      setRevision((current) => current + 1);
    } catch (caught) {
      const uncertain =
        !(caught instanceof ApiError) ||
        caught.status === 0 ||
        caught.status >= 500;

      if (uncertain) {
        setError(
          "Publication result unconfirmed. Keep this page open and retry the same publication.",
        );
      } else if (caught instanceof ApiError) {
        setPending(null);
        setReviewConfirmed(false);
        setError(caught.message);

        if (caught.status === 409) {
          // Preserve local summary text while refreshing
          // the encounter version and source note.
          setRevision((current) => current + 1);
        }
      }
    } finally {
      lock.current = false;
      setSending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !data ||
      !data.sourceNote ||
      !canPublish ||
      frozen ||
      lock.current ||
      !reviewConfirmed ||
      data.encounter.status !== "IN_PROGRESS" ||
      data.draftPrescriptionCount > 0 ||
      data.publishedSummary
    ) {
      return;
    }

    if (!fields.summary.trim() || !fields.carePlan.trim()) {
      setError("Enter a visit summary and care plan.");
      return;
    }

    if (
      !window.confirm(
        `Publish the summary for ${data.patient.fullName} ` +
          `(${data.patient.mrn}) and complete this encounter? ` +
          "Clinical notes and this published summary will be locked.",
      )
    ) {
      return;
    }

    const snapshot: Snapshot = {
      key: crypto.randomUUID(),

      body: JSON.stringify({
        expectedVersion: data.encounter.version,
        sourceNoteRevisionId: data.sourceNote.id,

        summary: fields.summary.trim(),
        carePlan: fields.carePlan.trim(),
        followUp: fields.followUp.trim(),
        returnPrecautions: fields.returnPrecautions.trim(),

        reviewConfirmed: true,
      }),
    };

    void publish(snapshot);
  }

  if (!canRead) {
    return <p role="alert">Your account cannot view this encounter.</p>;
  }

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-950">
            Finalize visit summary
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            Only the published summary will be shared with the patient. Clinical
            draft revisions remain private.
          </p>
        </div>

        <button
          type="button"
          className={button}
          disabled={frozen}
          onClick={() => {
            if (lock.current) return;

            setRevision((current) => current + 1);
          }}
        >
          Refresh status
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
        <button
          type="button"
          className={button}
          disabled={sending}
          onClick={() => void publish(pending)}
        >
          {sending ? "Publishing…" : "Retry same publication"}
        </button>
      )}

      {loading && <p role="status">Loading summary status…</p>}

      {remote?.revision === revision && remote.error && (
        <p role="alert" className="text-sm text-red-700">
          {remote.error} Use Refresh status to retry.
        </p>
      )}

      {data && (
        <>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-bold text-teal-800">
              {data.publishedSummary?.patientMrn ?? data.patient.mrn}
            </p>

            <p className="mt-1 font-semibold">
              {data.publishedSummary?.patientName ?? data.patient.fullName}
            </p>

            <p className="mt-2 text-sm text-slate-600">
              Encounter: {data.encounter.status}
            </p>
          </div>

          {data.publishedSummary ? (
            <div className="space-y-5">
              <p className="text-sm text-teal-800">
                Published by {data.publishedSummary.doctorName}
                {" · "}
                {new Date(data.publishedSummary.publishedAt).toLocaleString(
                  "en-IN",
                  {
                    timeZone: "Asia/Kolkata",
                    dateStyle: "medium",
                    timeStyle: "short",
                  },
                )}
                {" IST"}
              </p>

              {sections.map(({ key, label }) => {
                const value = data.publishedSummary?.[key];

                if (!value) return null;

                return (
                  <div key={key}>
                    <h3 className="font-semibold">{label}</h3>

                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                      {value}
                    </p>
                  </div>
                );
              })}

              {isDirty && (
                <p className="rounded-xl bg-amber-50 p-4 text-sm">
                  A summary has already been published. Your unsaved local text
                  was not published.
                </p>
              )}
            </div>
          ) : (
            <>
              {!data.sourceNote && (
                <p className="rounded-xl bg-amber-50 p-4 text-sm">
                  Save clinical notes before publishing a visit summary.
                </p>
              )}

              {data.draftPrescriptionCount > 0 && (
                <p className="rounded-xl bg-amber-50 p-4 text-sm">
                  {data.draftPrescriptionCount} prescription draft(s) remain.
                  Issue them before completing this encounter.
                </p>
              )}

              {data.sourceNote && (
                <details className="rounded-xl border border-slate-200 p-4">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Review latest clinical note · revision{" "}
                    {data.sourceNote.revision}
                  </summary>

                  <h3 className="mt-4 text-sm font-semibold">Assessment</h3>

                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {data.sourceNote.assessment || "No assessment entered."}
                  </p>

                  <h3 className="mt-4 text-sm font-semibold">Plan</h3>

                  <p className="mt-2 whitespace-pre-wrap text-sm">
                    {data.sourceNote.plan || "No plan entered."}
                  </p>
                </details>
              )}

              {canPublish && data.encounter.status === "IN_PROGRESS" ? (
                <form onSubmit={submit}>
                  <fieldset
                    disabled={frozen}
                    className="min-w-0 space-y-5 border-0 p-0"
                  >
                    <legend className="sr-only">
                      Patient-facing visit summary
                    </legend>

                    {sections.map(({ key, label, max, required }) => (
                      <label key={key} className="block text-sm font-semibold">
                        {label}
                        {required ? " *" : " · optional"}

                        <textarea
                          className={input}
                          rows={key === "summary" ? 5 : 4}
                          maxLength={max}
                          required={required}
                          value={fields[key]}
                          onChange={(event) => change(key, event.target.value)}
                        />
                      </label>
                    ))}

                    <label className="flex items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1 size-4"
                        checked={reviewConfirmed}
                        onChange={(event) =>
                          setReviewConfirmed(event.target.checked)
                        }
                      />

                      <span>
                        I reviewed the latest clinical note and this
                        patient-facing summary. Publishing will complete the
                        encounter and lock further clinical note edits.
                      </span>
                    </label>
                    <div
                      role="status"
                      className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
                    >
                      <p className="font-semibold">Publication readiness</p>

                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        <li>
                          Saved clinical note:{" "}
                          {data.sourceNote ? "Yes" : "Missing"}
                        </li>

                        <li>
                          Prescription drafts remaining:{" "}
                          {data.draftPrescriptionCount}
                        </li>

                        <li>
                          Request state:{" "}
                          {sending
                            ? "Submitting"
                            : pending
                              ? "Unconfirmed — use Retry same publication"
                              : loading
                                ? "Loading"
                                : "Ready"}
                        </li>
                      </ul>
                    </div>

                    <button
                      type="submit"
                      className={`${button} border-teal-800 bg-teal-800! text-white`}
                      disabled={
                        frozen ||
                        !reviewConfirmed ||
                        !data.sourceNote ||
                        data.draftPrescriptionCount > 0 ||
                        !fields.summary.trim() ||
                        !fields.carePlan.trim()
                      }
                    >
                      Publish summary and complete visit
                    </button>
                  </fieldset>
                </form>
              ) : (
                <p className="text-sm text-slate-600">
                  Publishing requires the assigned doctor’s permission and an
                  encounter in progress.
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
