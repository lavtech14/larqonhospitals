"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import { useStaffUser } from "@/components/auth/StaffSessionGate";

type Candidate = {
  id: string;
  version: number;
  specimenReference: string;
  collectedAt: string;

  orderItem: {
    testName: string;
    sampleType: string;

    order: {
      id: string;
      version: number;
      patientName: string;
      patientMrn: string;
    };
  };
};

type Response = {
  items: Candidate[];

  pagination: {
    page: number;
    total: number;
    totalPages: number;
  };
};

type Snapshot = {
  sampleId: string;
  key: string;
  body: string;
};

const panel = "rounded-2xl border border-slate-200 bg-white p-5 sm:p-6";

const button =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";

export default function LabSpecimenRejections() {
  const user = useStaffUser();

  const canRead = user.permissions?.includes("lab.queue.read") ?? false;

  const canReject = user.permissions?.includes("lab.samples.reject") ?? false;

  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const key = `${page}:${revision}`;

  const [remote, setRemote] = useState<{
    key: string;
    data: Response | null;
    error: string;
  } | null>(null);

  const [selected, setSelected] = useState<Candidate | null>(null);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const [pending, setPending] = useState<Snapshot | null>(null);
  const [sending, setSending] = useState(false);
  const lock = useRef(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const data = remote?.key === key ? remote.data : null;
  const loading = canRead && remote?.key !== key;
  const frozen = sending || pending !== null;

  useEffect(() => {
    if (!canRead) return;

    let active = true;
    const controller = new AbortController();

    async function load() {
      try {
        const result = await apiRequest<Response>(
          `/lab/specimens/rejection-queue?page=${page}&limit=10`,
          {
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(45_000),
            ]),
          },
        );

        if (active) {
          setRemote({ key, data: result, error: "" });
        }
      } catch (caught) {
        if (!active || controller.signal.aborted) return;

        setRemote({
          key,
          data: null,
          error:
            caught instanceof Error
              ? caught.message
              : "Unable to load specimens.",
        });
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [canRead, page, key]);

  useEffect(() => {
    if (!selected && !pending) return;

    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warn);

    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, [selected, pending]);

  function close(): boolean {
    if (lock.current || pending) return false;

    if (
      selected &&
      reason.trim() &&
      !window.confirm("Discard the unsaved rejection reason?")
    ) {
      return false;
    }

    setSelected(null);
    setReason("");
    setConfirmed(false);

    return true;
  }

  async function reject(snapshot: Snapshot) {
    if (lock.current) return;

    lock.current = true;
    setSending(true);
    setPending(snapshot);
    setError("");
    setNotice("");

    try {
      await apiRequest(`/lab/specimens/${snapshot.sampleId}/reject`, {
        method: "POST",

        headers: {
          "Idempotency-Key": snapshot.key,
        },

        body: snapshot.body,
      });

      setPending(null);
      setSelected(null);
      setReason("");
      setConfirmed(false);

      setNotice(
        "Specimen rejected. The test is back in Sample collection for recollection.",
      );

      setRevision((value) => value + 1);
    } catch (caught) {
      const uncertain =
        !(caught instanceof ApiError) ||
        caught.status === 0 ||
        caught.status >= 500;

      if (uncertain) {
        setError(
          "Rejection result unconfirmed. Keep this page open and retry the same rejection.",
        );
      } else if (caught instanceof ApiError) {
        setPending(null);
        setConfirmed(false);
        setError(caught.message);

        if (caught.status === 409) {
          setSelected(null);
          setReason("");
          setRevision((value) => value + 1);
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
      !selected ||
      !canReject ||
      frozen ||
      lock.current ||
      !confirmed ||
      !reason.trim()
    ) {
      return;
    }

    if (
      !window.confirm(
        `Reject specimen ${selected.specimenReference} for ` +
          `${selected.orderItem.order.patientName} ` +
          `(${selected.orderItem.order.patientMrn})? ` +
          "This test will require recollection.",
      )
    ) {
      return;
    }

    void reject({
      sampleId: selected.id,
      key: crypto.randomUUID(),

      body: JSON.stringify({
        expectedSampleVersion: selected.version,
        expectedOrderVersion: selected.orderItem.order.version,
        reason: reason.trim(),
        rejectionConfirmed: true,
      }),
    });
  }

  if (!canRead) {
    return (
      <p role="alert" className={panel}>
        Your account cannot view specimens.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Specimen rejection</h1>

          <p className="mt-2 text-sm text-slate-600">
            Current specimens without saved results or released reports.
          </p>
        </div>

        <button
          type="button"
          className={button}
          disabled={frozen || loading}
          onClick={() => {
            if (close()) {
              setRevision((value) => value + 1);
            }
          }}
        >
          Refresh
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
          onClick={() => void reject(pending)}
        >
          {sending ? "Rejecting…" : "Retry same rejection"}
        </button>
      )}

      {selected && (
        <form onSubmit={submit} className={panel}>
          <h2 className="text-lg font-bold">
            {selected.orderItem.order.patientName}
          </h2>

          <p className="mt-1 text-sm text-teal-800">
            {selected.orderItem.order.patientMrn}
          </p>

          <p className="mt-3 text-sm">
            {selected.orderItem.testName}
            {" · "}
            {selected.specimenReference}
          </p>

          <fieldset
            disabled={frozen}
            className="mt-5 min-w-0 space-y-4 border-0 p-0"
          >
            <legend className="sr-only">Specimen rejection details</legend>

            <label className="block text-sm font-semibold">
              Rejection reason *
              <textarea
                rows={4}
                required
                maxLength={1000}
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  setConfirmed(false);
                }}
                className="mt-2 block w-full rounded-xl border border-slate-300 p-3 text-sm font-normal"
              />
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 size-4"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />

              <span>
                I verified the patient, ordered test, specimen reference, and
                rejection reason.
              </span>
            </label>

            <button
              type="submit"
              disabled={!confirmed || !reason.trim()}
              className={`${button} border-red-300 bg-red-50! text-red-800`}
            >
              Reject and request recollection
            </button>
          </fieldset>

          <button
            type="button"
            className={`${button} mt-3`}
            disabled={frozen}
            onClick={() => close()}
          >
            Close
          </button>
        </form>
      )}

      <section className={panel}>
        {loading && <p role="status">Loading specimens…</p>}

        {remote?.key === key && remote.error && (
          <p role="alert" className="text-sm text-red-700">
            {remote.error} Use Refresh to retry.
          </p>
        )}

        {data && (
          <>
            {!data.items.length && (
              <p className="text-sm text-slate-500">
                No specimens eligible for rejection on this page.
              </p>
            )}

            {data.items.map((sample) => (
              <article
                key={sample.id}
                className="mb-4 rounded-xl border border-slate-200 p-4"
              >
                <p className="text-xs font-bold text-teal-700">
                  {sample.orderItem.order.patientMrn}
                </p>

                <h2 className="mt-1 font-bold">
                  {sample.orderItem.order.patientName}
                </h2>

                <p className="mt-2 text-sm">
                  {sample.orderItem.testName}
                  {" · "}
                  {sample.orderItem.sampleType}
                </p>

                <p className="mt-2 text-sm font-semibold">
                  Specimen: {sample.specimenReference}
                </p>

                {canReject && (
                  <button
                    type="button"
                    className={`${button} mt-4`}
                    disabled={frozen}
                    onClick={() => {
                      if (!close()) return;

                      setSelected(sample);
                      setError("");
                      setNotice("");
                    }}
                  >
                    Review rejection
                  </button>
                )}
              </article>
            ))}

            <footer className="mt-5 flex flex-wrap justify-between gap-3">
              <p className="text-xs text-slate-500">
                Page {page} of {Math.max(1, data.pagination.totalPages)}
                {" · "}
                {data.pagination.total} specimens
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  className={button}
                  disabled={frozen || loading || page <= 1}
                  onClick={() => {
                    if (close()) setPage((value) => value - 1);
                  }}
                >
                  Previous
                </button>

                <button
                  type="button"
                  className={button}
                  disabled={
                    frozen || loading || page >= data.pagination.totalPages
                  }
                  onClick={() => {
                    if (close()) setPage((value) => value + 1);
                  }}
                >
                  Next
                </button>
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
