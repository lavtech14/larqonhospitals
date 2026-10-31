"use client";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ApiError, apiRequest } from "@/lib/api";
import { mayDiscardFailedBillingRequest } from "@/lib/billing-retry";
import { useStaffUser } from "@/components/auth/StaffSessionGate";
export const input =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 focus:outline-2 focus:outline-teal-600 disabled:bg-slate-100";
export const button =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50";
export const secondary =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";
export type PageInfo = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
export type Paged<T> = { items: T[]; pagination: PageInfo };
export function dateTime(s: string) {
  return new Date(s).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}
export function useLoad<T>(path: string, revision = 0) {
  const request = JSON.stringify([path, revision]);
  const [state, setState] = useState<{
    request: string;
    data: T | null;
    error: string;
  } | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    apiRequest<T>(path, { signal: abort.signal })
      .then((data) => {
        if (!abort.signal.aborted) setState({ request, data, error: "" });
      })
      .catch((error) => {
        if (!abort.signal.aborted)
          setState({
            request,
            data: null,
            error: error instanceof Error ? error.message : "Request failed.",
          });
      });
    return () => abort.abort();
  }, [path, request]);
  const current = state?.request === request ? state : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? "",
    loading: current === null,
  };
}
type Pending = {
  key: string;
  path: string;
  body: string;
  createdAt: number;
  uncertain: boolean;
};
const pendingEvent = "larqon:billing-pending";
// Hydration-safe external snapshot; the stored request survives reloads in this tab.
export function useSafeMutation<T>(
  scope: string,
  onSuccess: (value: T) => void,
) {
  const user = useStaffUser();
  const storageKey = `larqon:billing:${user.id}:${scope}`;
  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener(pendingEvent, notify);
    window.addEventListener("storage", notify);
    return () => {
      window.removeEventListener(pendingEvent, notify);
      window.removeEventListener("storage", notify);
    };
  }, []);
  const getSnapshot = useCallback(() => {
    try {
      return sessionStorage.getItem(storageKey) ?? "";
    } catch {
      return "__storage_unavailable__";
    }
  }, [storageKey]);
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const stored = useMemo(() => {
    if (raw === null) return { ready: false, pending: null, error: "" };
    if (raw === "") return { ready: true, pending: null, error: "" };
    try {
      const value = JSON.parse(raw) as Pending;
      if (
        typeof value.key !== "string" ||
        typeof value.path !== "string" ||
        typeof value.body !== "string" ||
        !value.path.startsWith("/billing/")
      )
        throw Error("Invalid request");
      return { ready: true, pending: { ...value, uncertain: true }, error: "" };
    } catch {
      return {
        ready: false,
        pending: null,
        error:
          "Pending-request recovery is unavailable. Enable session storage before submitting; preserve any earlier request for investigation.",
      };
    }
  }, [raw]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const gate = useRef(false),
    callback = useRef(onSuccess);
  useEffect(() => {
    callback.current = onSuccess;
  }, [onSuccess]);
  const writePending = useCallback(
    (value: Pending | null) => {
      if (value) sessionStorage.setItem(storageKey, JSON.stringify(value));
      else sessionStorage.removeItem(storageKey);
      window.dispatchEvent(new Event(pendingEvent));
    },
    [storageKey],
  );
  useEffect(() => {
    if (!stored.pending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [stored.pending]);
  const send = useCallback(
    async (request: Pending) => {
      if (gate.current) return;
      gate.current = true;
      setBusy(true);
      setError("");
      try {
        const value = await apiRequest<T>(request.path, {
          method: "POST",
          headers: { "Idempotency-Key": request.key },
          body: request.body,
          signal: AbortSignal.timeout(30000),
        });
        writePending(null);
        callback.current(value);
      } catch (caught) {
        const definite = mayDiscardFailedBillingRequest(
          request.uncertain,
          caught instanceof ApiError ? caught.status : undefined,
        );
        if (definite) {
          try {
            writePending(null);
          } catch {
            /* Preserve the unresolved snapshot if storage becomes unavailable. */
          }
        }
        setError(
          (caught instanceof Error ? caught.message : "Request failed.") +
            (definite
              ? " Review current data before a new submission."
              : " Result unconfirmed. Retry the same request; do not repeat the operation using another key."),
        );
      } finally {
        setBusy(false);
        gate.current = false;
      }
    },
    [writePending],
  );
  const start = (path: string, body: unknown) => {
    if (!stored.ready || stored.pending || gate.current) return;
    const request: Pending = {
      key: crypto.randomUUID(),
      path,
      body: JSON.stringify(body),
      createdAt: Date.now(),
      uncertain: false,
    };
    try {
      // Persist as uncertain before sending: another mount/reload cannot assume failure.
      writePending({ ...request, uncertain: true });
      void send(request);
    } catch {
      setError("Cannot preserve the retry request. Nothing was sent.");
    }
  };
  return {
    pending: stored.pending,
    busy,
    ready: stored.ready,
    error: error || stored.error,
    start,
    retry: () => {
      if (stored.pending) void send(stored.pending);
    },
    locked: !stored.ready || !!stored.pending || busy,
  };
}
export function Notice({
  error,
  loading,
}: {
  error?: string;
  loading?: boolean;
}) {
  return (
    <>
      {loading && (
        <p role="status" className="py-3 text-sm text-slate-600">
          Loading billing records…
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="my-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
        >
          {error}
        </p>
      )}
    </>
  );
}
export function Pager({
  info,
  onPage,
  disabled = false,
}: {
  info: PageInfo;
  onPage: (page: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm text-slate-600">
      <span>
        {info.total} records · Page {info.page} of{" "}
        {Math.max(1, info.totalPages)}
      </span>
      <div className="flex gap-2">
        <button
          className={secondary}
          disabled={disabled || info.page <= 1}
          onClick={() => onPage(info.page - 1)}
        >
          Previous
        </button>
        <button
          className={secondary}
          disabled={disabled || info.page >= info.totalPages}
          onClick={() => onPage(info.page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function BillingHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const user = useStaffUser();
  return (
    <header className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-teal-700">
        Larqon Hospitals · Billing
      </p>
      <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">{title}</h1>
      <p className="max-w-3xl text-sm leading-6 text-slate-600">
        {description}
      </p>
      <nav className="flex flex-wrap gap-3" aria-label="Billing navigation">
        <Link className={secondary} href="/billing">
          Invoices
        </Link>
        {user.permissions?.includes("billing.invoices.manage") && (
          <Link className={secondary} href="/billing/new">
            Create draft
          </Link>
        )}
        {user.permissions?.includes("billing.prices.manage") && (
          <Link className={secondary} href="/billing/prices">
            Service prices
          </Link>
        )}
      </nav>
    </header>
  );
}
export const kinds = ["CONSULTATION", "LAB", "MEDICINE"] as const;
export type Kind = (typeof kinds)[number];
export type Price = {
  id: string;
  kind: Kind;
  doctorId: string | null;
  labTestId: string | null;
  medicineId: string | null;
  displayName: string;
  quantityUnit: string;
  unitPrice: string;
  isActive: boolean;
  version: number;
};
export type Invoice = {
  id: string;
  invoiceNumber: string | null;
  patientName: string;
  patientMrn: string;
  status: string;
  currency: string;
  total: string;
  paid: string;
  outstanding: string;
  paymentStatus: string;
  version: number;
  createdAt: string;
  issuedAt: string | null;
  notes: string | null;
  cancellationReason: string | null;
  lines: {
    id: string;
    description: string;
    kind: Kind;
    quantity: string;
    quantityUnit: string;
    unitPrice: string;
    amount: string;
  }[];
  payments: {
    id: string;
    receiptNumber: string;
    method: string;
    amount: string;
    externalReference: string | null;
    notes: string | null;
    recordedAt: string;
    recordedBy: { fullName: string };
  }[];
};
export function inr(value: string) {
  return `₹${value}`;
}
