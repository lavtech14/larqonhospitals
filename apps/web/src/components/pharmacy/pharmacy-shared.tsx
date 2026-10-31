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
import { mayDiscardFailedPharmacyRequest } from "@/lib/pharmacy-retry";
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
export type Lot = {
  id: string;
  medicineId: string;
  batchNumber: string;
  expiryDate: string;
  receivedQuantity: string;
  quantityUnit: string;
  availableQuantity: string;
  dispensedQuantity: string;
  expired: boolean;
  verifiedSnapshot: boolean;
  medicineName: string | null;
  strength: string | null;
  dosageForm: string | null;
  supplierName: string | null;
  reference: string | null;
  receivedAt: string;
  receivedBy: { fullName: string };
  medicine: {
    code: string;
    displayName: string;
    strength: string;
    dosageForm: string;
    isActive: boolean;
  };
};
export type Receipt = {
  id: string;
  prescriptionId: string;
  patientName: string;
  patientMrn: string;
  notes: string | null;
  dispensedAt: string;
  dispensedBy: { fullName: string };
  items: {
    id: string;
    prescriptionItemId: string;
    stockLotId: string;
    quantity: string;
    quantityUnit: string;
    medicineName: string;
    strength: string;
    dosageForm: string;
    batchNumber: string;
    expiryDate: string;
  }[];
};
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
const pendingEvent = "larqon:pharmacy-pending";
// Hydration-safe external snapshot; the stored request survives reloads in this tab.
export function useSafeMutation<T>(
  scope: string,
  onSuccess: (value: T) => void,
) {
  const user = useStaffUser();
  const storageKey = `larqon:pharmacy:${user.id}:${scope}`;
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
        !value.path.startsWith("/pharmacy/")
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
        const definite = mayDiscardFailedPharmacyRequest(
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
          Loading pharmacy records…
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
export function PharmacyHeader({
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
        Larqon Hospitals · Pharmacy
      </p>
      <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
        {title}
      </h1>
      <p className="max-w-3xl text-sm leading-6 text-slate-600">
        {description}
      </p>
      <nav aria-label="Pharmacy navigation" className="flex flex-wrap gap-3">
        {user.permissions?.includes("pharmacy.prescriptions.read") && (
          <Link className={secondary} href="/pharmacy">
            Prescription queue
          </Link>
        )}
        {user.permissions?.includes("pharmacy.stock.read") && (
          <Link className={secondary} href="/pharmacy/stock">
            Stock receipts
          </Link>
        )}
      </nav>
    </header>
  );
}
export function ReceiptCard({ receipt }: { receipt: Receipt }) {
  return (
    <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <strong className="text-slate-950">
            {receipt.patientName} · {receipt.patientMrn}
          </strong>
          <p className="text-sm text-slate-600">
            {dateTime(receipt.dispensedAt)} · {receipt.dispensedBy.fullName}
          </p>
        </div>
        <span className="break-all text-xs text-slate-500">
          Receipt {receipt.id}
        </span>
      </div>
      <ul className="divide-y divide-slate-100">
        {receipt.items.map((x) => (
          <li key={x.id} className="py-2 text-sm">
            <strong>
              {x.medicineName} · {x.strength} · {x.dosageForm}
            </strong>
            <p>
              {x.quantity} {x.quantityUnit} · Batch {x.batchNumber} · Expiry{" "}
              {x.expiryDate.slice(0, 10)}
            </p>
          </li>
        ))}
      </ul>
      {receipt.notes && (
        <p className="whitespace-pre-wrap text-sm text-slate-600">
          {receipt.notes}
        </p>
      )}
    </article>
  );
}
