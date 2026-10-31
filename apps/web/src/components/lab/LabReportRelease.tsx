"use client";
import { StructuredResultTable } from "./StructuredResultFields";
import type { ResultValue } from "@/lib/lab-result-types";

import { useEffect, useRef, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import { useStaffUser } from "@/components/auth/StaffSessionGate";

type ReportText = {
  values: ResultValue[];
  method: string;
  resultText: string;
  comments: string;
};

type Response = {
  sample: {
    currentOrderItem: { id: string } | null;
    rejection: { reason: string; rejectedAt: string } | null;
    id: string;
    version: number;
    specimenReference: string;
    collectedAt: string;

    orderItem: {
      testName: string;
      sampleType: string;

      order: {
        status: string;
        patientName: string;
        patientMrn: string;
      };
    };
  };

  latestDraft:
    | (ReportText & {
        id: string;
        revision: number;
        authorStaffId: string;

        author: {
          fullName: string;
        };
      })
    | null;

  report:
    | (ReportText & {
        id: string;
        patientName: string;
        patientMrn: string;
        testName: string;
        specimenReference: string;
        reviewerName: string;
        releasedAt: string;
      })
    | null;
};

type Snapshot = {
  key: string;
  body: string;
};

const button =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50";

export default function LabReportRelease({
  sampleId,
  disabled,
  onLockChange,
  onReleased,
}: {
  sampleId: string;
  disabled: boolean;
  onLockChange: (locked: boolean) => void;
  onReleased: () => void;
}) {
  const user = useStaffUser();

  const canRelease = user.permissions?.includes("lab.results.release") ?? false;

  const endpoint = `/lab/samples/${sampleId}/release`;

  const [revision, setRevision] = useState(0);

  const [remote, setRemote] = useState<{
    revision: number;
    data: Response | null;
    error: string;
  } | null>(null);

  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState<Snapshot | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const lock = useRef(false);

  const data = remote?.revision === revision ? remote.data : null;

  const loading = remote?.revision !== revision;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function load() {
      try {
        const result = await apiRequest<Response>(endpoint, {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(45_000),
          ]),
        });

        if (!active) return;

        setRemote({
          revision,
          data: result,
          error: "",
        });

        setConfirmed(false);
      } catch (caught) {
        if (!active || controller.signal.aborted) return;

        setRemote({
          revision,
          data: null,
          error:
            caught instanceof Error
              ? caught.message
              : "Unable to load report review.",
        });
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [endpoint, revision]);

  useEffect(() => {
    if (!pending) return;

    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warn);

    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, [pending]);

  async function send(snapshot: Snapshot) {
    if (lock.current) return;

    lock.current = true;
    setPending(snapshot);
    setSending(true);
    setError("");
    onLockChange(true);

    try {
      await apiRequest(endpoint, {
        method: "POST",

        headers: {
          "Idempotency-Key": snapshot.key,
        },

        body: snapshot.body,
      });

      setPending(null);
      setConfirmed(false);
      onLockChange(false);

      setRevision((value) => value + 1);
      onReleased();
    } catch (caught) {
      const uncertain =
        !(caught instanceof ApiError) ||
        caught.status === 0 ||
        caught.status >= 500;

      if (uncertain) {
        setError(
          "Release result unconfirmed. Keep this page open and retry the same release.",
        );
      } else if (caught instanceof ApiError) {
        setPending(null);
        setConfirmed(false);
        onLockChange(false);
        setError(caught.message);

        if (caught.status === 409) {
          setRevision((value) => value + 1);
        }
      }
    } finally {
      lock.current = false;
      setSending(false);
    }
  }

  const selfReview = Boolean(data?.latestDraft?.authorStaffId === user.id);

  const releaseDisabled =
    !data?.sample.currentOrderItem ||
    Boolean(data?.sample.rejection) ||
    disabled ||
    loading ||
    sending ||
    pending !== null ||
    !canRelease ||
    !data?.latestDraft ||
    Boolean(data?.report) ||
    selfReview ||
    !confirmed ||
    !data ||
    !["ORDERED", "COLLECTED"].includes(data.sample.orderItem.order.status);

  const text = data?.report ?? data?.latestDraft;

  return (
    <section className="rounded-2xl border border-teal-200 bg-white p-5 sm:p-6">
      <header className="flex flex-wrap justify-between gap-3">
        <h2 className="text-xl font-bold">
          {data?.report ? "Released report" : "Review and release"}
        </h2>

        <button
          type="button"
          className={button}
          disabled={disabled || loading || sending || pending !== null}
          onClick={() => {
            setConfirmed(false);
            setRevision((value) => value + 1);
          }}
        >
          Refresh review
        </button>
      </header>

      {loading && (
        <p role="status" className="mt-4 text-sm">
          Loading report review…
        </p>
      )}

      {(error || remote?.error) && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {error || remote?.error}
        </p>
      )}

      {pending && (
        <button
          type="button"
          className={`${button} mt-4`}
          disabled={sending}
          onClick={() => void send(pending)}
        >
          {sending ? "Releasing…" : "Retry same release"}
        </button>
      )}

      {data && (
        <div className="mt-5 space-y-5">
          <div className="rounded-xl bg-teal-50 p-4">
            <p className="text-xs font-bold text-teal-800">
              {data.report?.patientMrn ??
                data.sample.orderItem.order.patientMrn}
            </p>

            <p className="mt-1 font-semibold">
              {data.report?.patientName ??
                data.sample.orderItem.order.patientName}
            </p>

            <p className="mt-3 text-sm">
              {data.report?.testName ?? data.sample.orderItem.testName}
              {" · "}
              {data.report?.specimenReference ?? data.sample.specimenReference}
            </p>
          </div>

          {!data.report && data.latestDraft && (
            <p className="text-sm text-slate-600">
              Reviewing revision {data.latestDraft.revision}
              {" · Entered by "}
              {data.latestDraft.author.fullName}
            </p>
          )}

          {text ? (
            <div className="space-y-4 rounded-xl border border-slate-200 p-4 text-sm">
              <StructuredResultTable values={text.values ?? []} />
              {text.method && (
                <p>
                  <strong>Method:</strong> {text.method}
                </p>
              )}

              <div>
                <h3 className="font-semibold">Result report</h3>

                <p className="mt-2 whitespace-pre-wrap break-words leading-7">
                  {text.resultText}
                </p>
              </div>

              {text.comments && (
                <div>
                  <h3 className="font-semibold">Report comments</h3>

                  <p className="mt-2 whitespace-pre-wrap break-words">
                    {text.comments}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Save a result draft before review.
            </p>
          )}

          {data.report ? (
            <p role="status" className="text-sm text-teal-900">
              Released by {data.report.reviewerName}
              {" · "}
              {new Date(data.report.releasedAt).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
                dateStyle: "medium",
                timeStyle: "short",
              })}{" "}
              IST
            </p>
          ) : (
            <>
              {selfReview && (
                <p className="rounded-xl bg-amber-50 p-4 text-sm">
                  A different reviewer must release the revision you authored.
                </p>
              )}

              {canRelease ? (
                <>
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 size-4"
                      disabled={
                        disabled ||
                        loading ||
                        sending ||
                        pending !== null ||
                        !data.latestDraft ||
                        selfReview
                      }
                      checked={confirmed}
                      onChange={(event) => setConfirmed(event.target.checked)}
                    />

                    <span>
                      I verified the patient, specimen, test, and the full
                      report shown above, including comments. I approve release
                      of this revision.
                    </span>
                  </label>

                  <button
                    type="button"
                    className={`${button} border-teal-800 bg-teal-800! text-white`}
                    disabled={releaseDisabled}
                    onClick={() => {
                      if (
                        releaseDisabled ||
                        lock.current ||
                        !data.latestDraft
                      ) {
                        return;
                      }

                      if (
                        !window.confirm(
                          `Release revision ${data.latestDraft.revision} ` +
                            `for ${data.sample.orderItem.order.patientName} ` +
                            `(${data.sample.orderItem.order.patientMrn})? ` +
                            "Further draft edits will be locked.",
                        )
                      ) {
                        return;
                      }

                      void send({
                        key: crypto.randomUUID(),

                        body: JSON.stringify({
                          expectedVersion: data.sample.version,
                          sourceRevisionId: data.latestDraft.id,
                          reviewConfirmed: true,
                        }),
                      });
                    }}
                  >
                    Release report
                  </button>
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  A lab reviewer must approve and release this report.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
