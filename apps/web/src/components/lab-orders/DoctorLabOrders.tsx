"use client";
import CancelLabOrder from "./CancelLabOrder";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import { useStaffUser } from "@/components/auth/StaffSessionGate";

type Test = {
  id: string;
  code: string;
  displayName: string;
  sampleType: string;
  preparationInstructions: string | null;
  isActive: boolean;
  version: number;
};

type Order = {
  version: number;
  orderedByStaffId: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  id: string;
  status: string;
  priority: string;
  clinicalReason: string;
  patientName: string;
  patientMrn: string;
  doctorName: string;
  orderedAt: string;

  items: {
    samples: { id: string }[];
    id: string;
    testCode: string;
    testName: string;
    sampleType: string;
    preparationInstructions: string | null;
  }[];
};

type OrdersResponse = {
  patient: {
    fullName: string;
    mrn: string;
  };

  encounter: {
    id: string;
    status: string;
    version: number;
  } | null;

  items: Order[];

  pagination: {
    page: number;
    total: number;
    totalPages: number;
  };
};

type Snapshot = {
  key: string;
  body: string;
};

const panel = "rounded-2xl border border-slate-200 bg-white p-5 sm:p-6";

const button =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50";

const primary = `${button} border-teal-800 bg-teal-800! text-white`;

const input =
  "mt-2 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-teal-700 disabled:bg-slate-50";

function useResource<T>(path: string, enabled: boolean) {
  const [revision, setRevision] = useState(0);
  const key = `${path}:${revision}`;

  const [remote, setRemote] = useState<{
    key: string;
    data: T | null;
    error: string;
  } | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    const controller = new AbortController();

    async function load() {
      try {
        const data = await apiRequest<T>(path, {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(45_000),
          ]),
        });

        if (active) {
          setRemote({ key, data, error: "" });
        }
      } catch (caught) {
        if (!active || controller.signal.aborted) return;

        setRemote({
          key,
          data: null,
          error:
            caught instanceof Error
              ? caught.message
              : "Unable to load information.",
        });
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [path, key, enabled]);

  return {
    data: remote?.key === key ? remote.data : null,
    error: remote?.key === key ? remote.error : "",
    loading: enabled && remote?.key !== key,
    reload: () => setRevision((value) => value + 1),
  };
}

export default function DoctorLabOrders({
  appointmentId,
}: {
  appointmentId: string;
}) {
  const user = useStaffUser();

  const has = (permission: string) =>
    user.permissions?.includes(permission) ?? false;

  const canRead = has("lab-orders.own.read");

  const canCreate =
    canRead && has("lab-orders.own.create") && has("lab-tests.read");

  const endpoint = `/doctor/appointments/${appointmentId}/lab-orders`;

  const [page, setPage] = useState(1);

  const orders = useResource<OrdersResponse>(
    `${endpoint}?page=${page}&limit=10`,
    canRead,
  );

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const catalogue = useResource<{
    items: Test[];
  }>(
    `/lab-tests?active=true&page=1&limit=20&search=${encodeURIComponent(search)}`,
    canCreate,
  );

  const [selected, setSelected] = useState<Test[]>([]);
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<"ROUTINE" | "URGENT">("ROUTINE");

  const [reviewed, setReviewed] = useState(false);

  const [pending, setPending] = useState<Snapshot | null>(null);
  const [sending, setSending] = useState(false);

  const lock = useRef(false);
  const cancelLock = useRef(false);
  const [cancelLocked, setCancelLocked] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const frozen = sending || pending !== null || cancelLocked;

  const encounter = orders.data?.encounter;
  const open = encounter?.status === "IN_PROGRESS";

  useEffect(() => {
    if (!selected.length && !reason.trim() && !pending && !cancelLocked) return;

    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warn);

    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, [selected.length, reason, pending, cancelLocked]);

  function refresh() {
    if (lock.current || pending) return;

    setReviewed(false);
    orders.reload();
    catalogue.reload();
  }

  async function send(snapshot: Snapshot) {
    if (lock.current || cancelLock.current) return;

    lock.current = true;

    setSending(true);
    setPending(snapshot);
    setError("");
    setNotice("");

    try {
      const result = await apiRequest<{
        replayed: boolean;
        order: Order;
      }>(endpoint, {
        method: "POST",

        headers: {
          "Idempotency-Key": snapshot.key,
        },

        body: snapshot.body,
      });

      setPending(null);
      setSelected([]);
      setReason("");
      setPriority("ROUTINE");
      setReviewed(false);

      setNotice(`Lab order confirmed. Reference: ${result.order.id}`);

      setPage(1);
      orders.reload();
    } catch (caught) {
      const uncertain =
        !(caught instanceof ApiError) ||
        caught.status === 0 ||
        caught.status >= 500;

      if (uncertain) {
        setError(
          "Order result unconfirmed. Keep this page open and use Retry same order.",
        );
      } else if (caught instanceof ApiError) {
        setPending(null);
        setReviewed(false);
        setError(caught.message);

        if (caught.status === 409) {
          orders.reload();
          catalogue.reload();
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
      !canCreate ||
      !open ||
      !encounter ||
      !orders.data ||
      orders.loading ||
      frozen ||
      lock.current ||
      !reviewed ||
      selected.length === 0 ||
      !reason.trim()
    ) {
      return;
    }

    if (
      !window.confirm(
        `Create a lab order for ${orders.data.patient.fullName} ` +
          `(${orders.data.patient.mrn}) with ${selected.length} test(s)?`,
      )
    ) {
      return;
    }

    void send({
      key: crypto.randomUUID(),

      body: JSON.stringify({
        expectedEncounterVersion: encounter.version,
        clinicalReason: reason.trim(),
        priority,
        reviewConfirmed: true,

        tests: selected.map((test) => ({
          testId: test.id,
          expectedVersion: test.version,
        })),
      }),
    });
  }

  if (!canRead) {
    return (
      <p role="alert" className={panel}>
        Your account cannot view these lab orders.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={`/my-appointments/${appointmentId}/encounter`}
            className="text-sm font-semibold text-teal-800"
            onClick={(event) => {
              if (lock.current || pending || cancelLock.current) {
                event.preventDefault();
                setError("Resolve the pending order before leaving.");
              } else if (
                (selected.length > 0 || reason.trim()) &&
                !window.confirm("Leave and discard the unsent lab-order form?")
              ) {
                event.preventDefault();
              }
            }}
          >
            ← Clinical encounter
          </Link>

          <h1 className="mt-3 text-3xl font-bold">Lab orders</h1>
        </div>

        <button
          type="button"
          className={button}
          disabled={frozen || orders.loading}
          onClick={refresh}
        >
          Refresh
        </button>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="rounded-xl bg-teal-50 p-4 text-sm text-teal-900"
        >
          {notice}
        </p>
      )}

      {pending && (
        <button
          type="button"
          className={button}
          disabled={sending}
          onClick={() => void send(pending)}
        >
          {sending ? "Submitting…" : "Retry same order"}
        </button>
      )}

      {orders.loading && <p role="status">Loading encounter and orders…</p>}

      {orders.error && (
        <p role="alert" className={panel}>
          {orders.error} Use Refresh to retry.
        </p>
      )}

      {orders.data && (
        <>
          <section className={panel}>
            <p className="text-xs font-bold text-teal-700">
              {orders.data.patient.mrn}
            </p>

            <h2 className="mt-1 text-xl font-bold">
              {orders.data.patient.fullName}
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              Encounter: {encounter?.status ?? "Not checked in"}
            </p>
          </section>

          {canCreate && open ? (
            <>
              <section className={panel}>
                <h2 className="text-xl font-bold">Select lab tests</h2>

                <form
                  className="mt-4 flex items-end gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setSearch(searchInput.trim());
                    catalogue.reload();
                  }}
                >
                  <label className="min-w-0 flex-1 text-sm font-semibold">
                    Search catalogue
                    <input
                      className={input}
                      maxLength={200}
                      value={searchInput}
                      disabled={frozen}
                      placeholder="Test name or code"
                      onChange={(event) => setSearchInput(event.target.value)}
                    />
                  </label>

                  <button
                    type="submit"
                    className={button}
                    disabled={frozen || catalogue.loading}
                  >
                    Search
                  </button>
                </form>

                <p className="mt-2 text-xs text-slate-500">
                  Showing up to 20 matches. Refine your search if the required
                  test is not shown.
                </p>

                {catalogue.loading && (
                  <p role="status" className="mt-4 text-sm">
                    Loading tests…
                  </p>
                )}

                {catalogue.error && (
                  <p role="alert" className="mt-4 text-sm text-red-700">
                    {catalogue.error}
                  </p>
                )}

                {catalogue.data?.items.length === 0 && (
                  <p className="mt-4 text-sm text-slate-500">
                    No active tests found.
                  </p>
                )}

                <div className="mt-4 grid gap-3">
                  {catalogue.data?.items.map((test) => {
                    const added = selected.some((item) => item.id === test.id);

                    return (
                      <article
                        key={test.id}
                        className="rounded-xl border border-slate-200 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold text-teal-700">
                              {test.code}
                            </p>

                            <h3 className="mt-1 font-semibold">
                              {test.displayName}
                            </h3>

                            <p className="mt-1 text-sm text-slate-500">
                              Sample: {test.sampleType}
                            </p>
                          </div>

                          <button
                            type="button"
                            className={button}
                            disabled={frozen || added || selected.length >= 30}
                            onClick={() => {
                              setSelected((current) =>
                                current.some((item) => item.id === test.id) ||
                                current.length >= 30
                                  ? current
                                  : [...current, test],
                              );

                              setReviewed(false);
                            }}
                          >
                            {added ? "Selected" : "Add test"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              <form onSubmit={submit} className={panel}>
                <h2 className="text-xl font-bold">Review lab order</h2>

                <fieldset
                  disabled={frozen}
                  className="mt-5 min-w-0 space-y-5 border-0 p-0"
                >
                  <legend className="sr-only">Lab-order details</legend>

                  {!selected.length && (
                    <p className="text-sm text-slate-500">
                      Select at least one test above.
                    </p>
                  )}

                  {selected.map((test) => (
                    <article
                      key={test.id}
                      className="rounded-xl border border-teal-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">{test.displayName}</h3>

                          <p className="mt-1 text-sm text-slate-600">
                            {test.code} · {test.sampleType}
                          </p>
                        </div>

                        <button
                          type="button"
                          className="text-sm font-semibold text-red-700"
                          onClick={() => {
                            setSelected((current) =>
                              current.filter((item) => item.id !== test.id),
                            );

                            setReviewed(false);
                          }}
                        >
                          Remove
                        </button>
                      </div>

                      {test.preparationInstructions && (
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                          {test.preparationInstructions}
                        </p>
                      )}
                    </article>
                  ))}

                  <label className="block text-sm font-semibold">
                    Clinical reason *
                    <textarea
                      className={input}
                      rows={4}
                      required
                      maxLength={2000}
                      value={reason}
                      onChange={(event) => {
                        setReason(event.target.value);
                        setReviewed(false);
                      }}
                    />
                  </label>

                  <label className="block text-sm font-semibold">
                    Priority
                    <select
                      className={input}
                      value={priority}
                      onChange={(event) => {
                        setPriority(event.target.value as "ROUTINE" | "URGENT");

                        setReviewed(false);
                      }}
                    >
                      <option value="ROUTINE">Routine</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </label>

                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 size-4"
                      checked={reviewed}
                      onChange={(event) => setReviewed(event.target.checked)}
                    />

                    <span>
                      I reviewed the patient’s name and MRN, selected tests,
                      specimen requirements, and clinical reason.
                    </span>
                  </label>

                  <button
                    type="submit"
                    className={primary}
                    disabled={
                      frozen || !reviewed || !selected.length || !reason.trim()
                    }
                  >
                    {sending ? "Submitting…" : "Submit lab order"}
                  </button>
                </fieldset>
              </form>
            </>
          ) : (
            <p className={panel}>
              New orders require ordering permission and an encounter in
              progress. Existing orders remain available below.
            </p>
          )}

          <section className={panel}>
            <h2 className="text-xl font-bold">Existing lab orders</h2>

            {!orders.data.items.length && (
              <p className="mt-4 text-sm text-slate-500">
                No orders on this page.
              </p>
            )}

            {orders.data.items.map((order) => (
              <article
                key={order.id}
                className="mt-4 rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="font-semibold">
                    {order.status} · {order.priority}
                  </p>

                  <p className="text-xs text-slate-500">
                    {new Date(order.orderedAt).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    IST
                  </p>
                </div>

                <p className="mt-2 break-all text-xs text-slate-500">
                  Reference: {order.id}
                </p>

                <p className="mt-3 whitespace-pre-wrap text-sm">
                  {order.clinicalReason}
                </p>

                {order.cancellationReason && (
                  <p className="mt-3 whitespace-pre-wrap rounded-xl bg-amber-50 p-3 text-sm">
                    Cancelled: {order.cancellationReason}
                  </p>
                )}
                {has("lab-orders.own.cancel") &&
                  order.orderedByStaffId === user.id &&
                  order.status === "ORDERED" &&
                  !order.items.some((item) => item.samples?.length) && (
                    <CancelLabOrder
                      key={`${order.id}:${order.version}`}
                      appointmentId={appointmentId}
                      orderId={order.id}
                      version={order.version}
                      patientName={order.patientName}
                      mrn={order.patientMrn}
                      disabled={frozen}
                      onLockChange={(value) => {
                        cancelLock.current = value;
                        setCancelLocked(value);
                      }}
                      onConfirmed={() => {
                        setReviewed(false);
                        setError("");
                        setNotice("Uncollected lab order cancelled.");
                        orders.reload();
                      }}
                      onError={(message, refresh) => {
                        setError(message);
                        if (refresh) {
                          setReviewed(false);
                          orders.reload();
                        }
                      }}
                    />
                  )}
                <ul className="mt-4 space-y-3">
                  {order.items.map((item) => (
                    <li key={item.id} className="rounded-lg bg-slate-50 p-3">
                      <p className="text-sm font-semibold">{item.testName}</p>

                      <p className="mt-1 text-xs text-slate-500">
                        {item.testCode} · {item.sampleType}
                      </p>

                      {item.preparationInstructions && (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                          {item.preparationInstructions}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </article>
            ))}

            <footer className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Page {page} of {Math.max(1, orders.data.pagination.totalPages)}
                {" · "}
                {orders.data.pagination.total} orders
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  className={button}
                  disabled={frozen || page <= 1}
                  onClick={() => {
                    setReviewed(false);
                    setPage((current) => current - 1);
                  }}
                >
                  Previous
                </button>

                <button
                  type="button"
                  className={button}
                  disabled={frozen || page >= orders.data.pagination.totalPages}
                  onClick={() => {
                    setReviewed(false);
                    setPage((current) => current + 1);
                  }}
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
