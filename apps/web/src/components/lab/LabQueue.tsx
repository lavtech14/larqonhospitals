"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import { useStaffUser } from "@/components/auth/StaffSessionGate";

type Item = {
  id: string;
  testCode: string;
  testName: string;
  sampleType: string;
  preparationInstructions: string | null;
  samples: {
    id: string;
    specimenReference: string;

    rejection: {
      reason: string;
      rejectedAt: string;

      rejectedBy: {
        fullName: string;
      };
    } | null;
  }[];

  sample: {
    specimenReference: string;
    collectedAt: string;
    collectedBy: {
      fullName: string;
    };
  } | null;
};

type Order = {
  id: string;
  version: number;
  priority: string;
  clinicalReason: string;
  patientName: string;
  patientMrn: string;
  doctorName: string;
  orderedAt: string;
  items: Item[];
};

type Response = {
  items: Order[];

  pagination: {
    page: number;
    total: number;
    totalPages: number;
  };
};

type Selection = {
  order: Order;
  item: Item;
};

type Snapshot = {
  endpoint: string;
  key: string;
  body: string;
};

const panel = "rounded-2xl border border-slate-200 bg-white p-5 sm:p-6";

const button =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50";

const primary = `${button} border-teal-800 bg-teal-800! text-white`;

const input =
  "mt-2 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-teal-700 disabled:bg-slate-50";

function nowInHospital(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return (
    `${get("year")}-${get("month")}-${get("day")}` +
    `T${get("hour")}:${get("minute")}:${get("second")}`
  );
}

function time(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function LabQueue() {
  const user = useStaffUser();

  const canRead = user.permissions?.includes("lab.queue.read") ?? false;

  const canCollect = user.permissions?.includes("lab.samples.collect") ?? false;

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);

  const requestKey = JSON.stringify([search, page, revision]);

  const [remote, setRemote] = useState<{
    key: string;
    data: Response | null;
    error: string;
  } | null>(null);

  const [selection, setSelection] = useState<Selection | null>(null);

  const [reference, setReference] = useState("");
  const [collectedAt, setCollectedAt] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [conflicted, setConflicted] = useState(false);

  const [pending, setPending] = useState<Snapshot | null>(null);
  const [sending, setSending] = useState(false);

  const lock = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const data = remote?.key === requestKey ? remote.data : null;

  const loading = canRead && remote?.key !== requestKey;
  const frozen = sending || pending !== null;

  useEffect(() => {
    if (!canRead) return;

    let active = true;
    const controller = new AbortController();

    async function load() {
      const query = new URLSearchParams({
        page: String(page),
        limit: "20",
      });

      if (search) query.set("search", search);

      try {
        const result = await apiRequest<Response>(`/lab/orders?${query}`, {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(45_000),
          ]),
        });

        if (active) {
          setRemote({
            key: requestKey,
            data: result,
            error: "",
          });
        }
      } catch (caught) {
        if (!active || controller.signal.aborted) return;

        setRemote({
          key: requestKey,
          data: null,
          error:
            caught instanceof Error
              ? caught.message
              : "Unable to load the lab queue.",
        });
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [canRead, search, page, requestKey]);

  useEffect(() => {
    if (!selection && !pending) return;

    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warn);

    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, [selection, pending]);

  useEffect(() => {
    if (!selection) return;

    formRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    formRef.current
      ?.querySelector<HTMLInputElement>("#specimen-reference")
      ?.focus();
  }, [selection]);

  function closeForm(): boolean {
    if (frozen || lock.current) return false;

    if (selection && !window.confirm("Close the unsaved collection form?")) {
      return false;
    }

    setSelection(null);
    setConfirmed(false);
    setConflicted(false);

    return true;
  }

  async function collect(snapshot: Snapshot) {
    if (lock.current) return;

    lock.current = true;
    setSending(true);
    setPending(snapshot);
    setError("");
    setNotice("");

    try {
      await apiRequest(snapshot.endpoint, {
        method: "POST",

        headers: {
          "Idempotency-Key": snapshot.key,
        },

        body: snapshot.body,
      });

      setPending(null);
      setSelection(null);
      setReference("");
      setCollectedAt("");
      setConfirmed(false);
      setConflicted(false);

      setNotice("Specimen collection confirmed.");
      setRevision((current) => current + 1);
    } catch (caught) {
      const uncertain =
        !(caught instanceof ApiError) ||
        caught.status === 0 ||
        caught.status >= 500;

      if (uncertain) {
        setError(
          "Collection result unconfirmed. Keep this page open and use Retry same collection.",
        );
      } else if (caught instanceof ApiError) {
        setPending(null);
        setConfirmed(false);
        setError(caught.message);

        if (caught.status === 409) {
          setConflicted(true);
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
      !selection ||
      !canCollect ||
      frozen ||
      lock.current ||
      conflicted ||
      !confirmed
    ) {
      return;
    }

    const specimenReference = reference.trim().toUpperCase();

    if (!/^[A-Z0-9][A-Z0-9_-]{0,49}$/.test(specimenReference)) {
      setError("Enter a valid specimen reference.");
      return;
    }

    // The input is explicitly hospital time, not browser time.
    const timestamp = new Date(`${collectedAt}+05:30`);

    if (!Number.isFinite(timestamp.getTime())) {
      setError("Enter a valid collection time.");
      return;
    }

    if (
      !window.confirm(
        `Record collection for ${selection.order.patientName} ` +
          `(${selection.order.patientMrn})?\n` +
          `${selection.item.testName}\n` +
          `Specimen: ${specimenReference}`,
      )
    ) {
      return;
    }

    void collect({
      endpoint:
        `/lab/orders/${selection.order.id}` +
        `/items/${selection.item.id}/collect`,

      key: crypto.randomUUID(),

      body: JSON.stringify({
        expectedOrderVersion: selection.order.version,
        specimenReference,
        collectedAt: timestamp.toISOString(),
        collectionConfirmed: true,
      }),
    });
  }

  if (!canRead) {
    return (
      <p role="alert" className={panel}>
        Your account cannot access the lab queue.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-teal-700">
            Laboratory workspace
          </p>

          <h1 className="mt-2 text-3xl font-bold">Sample collection</h1>

          <p className="mt-2 text-sm text-slate-600">
            Pending orders, oldest first. Verify patient identity before
            recording each specimen.
          </p>
        </div>

        <button
          type="button"
          className={button}
          disabled={frozen || loading}
          onClick={() => {
            if (!closeForm()) return;

            setRevision((current) => current + 1);
          }}
        >
          Refresh queue
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
          onClick={() => void collect(pending)}
        >
          {sending ? "Recording…" : "Retry same collection"}
        </button>
      )}

      {selection && (
        <form ref={formRef} onSubmit={submit} className={panel}>
          <h2 className="text-xl font-bold">Record specimen collection</h2>

          <div className="mt-4 rounded-xl bg-teal-50 p-4">
            <p className="text-xs font-bold text-teal-800">
              {selection.order.patientMrn}
            </p>

            <p className="mt-1 font-bold">{selection.order.patientName}</p>

            <p className="mt-3 text-sm">
              {selection.item.testName}
              {" · "}
              {selection.item.sampleType}
            </p>

            {selection.item.preparationInstructions && (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {selection.item.preparationInstructions}
              </p>
            )}
          </div>

          {conflicted && (
            <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm">
              This order changed. Review the refreshed queue, close this form,
              and reopen the pending test. Do not record a second specimen if
              collection already appears.
            </p>
          )}

          <fieldset
            disabled={frozen || conflicted}
            className="mt-5 min-w-0 space-y-5 border-0 p-0"
          >
            <legend className="sr-only">Specimen collection details</legend>

            <label
              htmlFor="specimen-reference"
              className="block text-sm font-semibold"
            >
              Specimen reference *
              <input
                id="specimen-reference"
                className={input}
                required
                maxLength={50}
                pattern="[A-Za-z0-9][A-Za-z0-9_-]{0,49}"
                value={reference}
                onChange={(event) => {
                  setReference(event.target.value);
                  setConfirmed(false);
                }}
              />
            </label>

            <label className="block text-sm font-semibold">
              Actual collection time · Asia/Kolkata *
              <input
                type="datetime-local"
                step="1"
                className={input}
                required
                value={collectedAt}
                onChange={(event) => {
                  setCollectedAt(event.target.value);
                  setConfirmed(false);
                }}
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
                I verified the patient’s name and MRN, the ordered test and
                specimen label, and confirm that this specimen has actually been
                collected.
              </span>
            </label>

            <button
              type="submit"
              className={primary}
              disabled={!confirmed || !reference.trim()}
            >
              Record collection
            </button>
          </fieldset>

          <button
            type="button"
            className={`${button} mt-4`}
            disabled={frozen}
            onClick={() => closeForm()}
          >
            Close form
          </button>
        </form>
      )}

      <section className={panel}>
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();

            if (!closeForm()) return;

            setSearch(searchInput.trim());
            setPage(1);
            setRevision((current) => current + 1);
          }}
        >
          <label className="min-w-0 flex-1 text-sm font-semibold">
            Search by patient name or MRN
            <input
              className={input}
              maxLength={100}
              value={searchInput}
              disabled={frozen}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </label>

          <button type="submit" className={button} disabled={frozen}>
            Search
          </button>
        </form>

        {loading && (
          <p role="status" className="mt-5 text-sm text-slate-500">
            Loading pending orders…
          </p>
        )}

        {remote?.key === requestKey && remote.error && (
          <p role="alert" className="mt-5 text-sm text-red-700">
            {remote.error} Use Refresh queue to retry.
          </p>
        )}

        {data && (
          <>
            {!data.items.length && (
              <p className="py-8 text-center text-sm text-slate-500">
                No pending collections on this page.
              </p>
            )}

            {data.items.map((order) => (
              <article
                key={order.id}
                className="mt-5 rounded-xl border border-slate-200 p-4 sm:p-5"
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-teal-700">
                      {order.patientMrn}
                    </p>

                    <h2 className="mt-1 text-lg font-bold">
                      {order.patientName}
                    </h2>

                    <p className="mt-1 text-xs text-slate-500">
                      {order.doctorName}
                      {" · "}
                      {time(order.orderedAt)} IST
                    </p>
                  </div>

                  <span
                    className={`h-fit rounded-full px-3 py-1 text-xs font-bold ${
                      order.priority === "URGENT"
                        ? "bg-amber-100 text-amber-900"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {order.priority}
                  </span>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">
                  {order.clinicalReason}
                </p>

                <div className="mt-4 space-y-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="rounded-lg bg-slate-50 p-4">
                      <h3 className="font-semibold">{item.testName}</h3>

                      <p className="mt-1 text-xs text-slate-500">
                        {item.testCode} · {item.sampleType}
                      </p>
                      {item.samples.length > 0 && (
                        <details className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                          <summary className="cursor-pointer text-sm font-semibold text-amber-950">
                            Previous rejected specimens · latest 5
                          </summary>

                          <ul className="mt-3 space-y-3">
                            {item.samples.map((attempt) => (
                              <li key={attempt.id} className="text-sm">
                                <p className="font-semibold">
                                  {attempt.specimenReference}
                                </p>

                                <p className="mt-1 whitespace-pre-wrap text-amber-950">
                                  {attempt.rejection?.reason}
                                </p>

                                {attempt.rejection && (
                                  <p className="mt-1 text-xs text-amber-800">
                                    {attempt.rejection.rejectedBy.fullName}
                                    {" · "}
                                    {time(attempt.rejection.rejectedAt)} IST
                                  </p>
                                )}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}

                      {item.sample ? (
                        <p className="mt-3 text-sm text-teal-800">
                          Collected: {item.sample.specimenReference}
                          {" · "}
                          {time(item.sample.collectedAt)} IST
                          {" · "}
                          {item.sample.collectedBy.fullName}
                        </p>
                      ) : (
                        canCollect && (
                          <button
                            type="button"
                            className={`${button} mt-3`}
                            disabled={frozen}
                            onClick={() => {
                              if (!closeForm()) return;

                              setSelection({ order, item });
                              setReference("");
                              setCollectedAt(nowInHospital());
                              setConfirmed(false);
                              setConflicted(false);
                              setError("");
                            }}
                          >
                            Record collection
                          </button>
                        )
                      )}
                    </div>
                  ))}
                </div>
              </article>
            ))}

            <footer className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Page {page} of {Math.max(1, data.pagination.totalPages)}
                {" · "}
                {data.pagination.total} pending orders
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  className={button}
                  disabled={frozen || page <= 1}
                  onClick={() => {
                    if (closeForm()) {
                      setPage((current) => current - 1);
                    }
                  }}
                >
                  Previous
                </button>

                <button
                  type="button"
                  className={button}
                  disabled={frozen || page >= data.pagination.totalPages}
                  onClick={() => {
                    if (closeForm()) {
                      setPage((current) => current + 1);
                    }
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
