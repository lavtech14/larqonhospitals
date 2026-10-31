"use client";
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, apiRequest } from "@/lib/api";
type Snapshot = { key: string; body: string };
export default function CancelLabOrder({
  appointmentId,
  orderId,
  version,
  patientName,
  mrn,
  disabled,
  onLockChange,
  onConfirmed,
  onError,
}: {
  appointmentId: string;
  orderId: string;
  version: number;
  patientName: string;
  mrn: string;
  disabled: boolean;
  onLockChange: (value: boolean) => void;
  onConfirmed: () => void;
  onError: (message: string, refresh: boolean) => void;
}) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<Snapshot | null>(null);
  const [sending, setSending] = useState(false);
  const lock = useRef(false);
  async function send(snapshot: Snapshot) {
    if (lock.current) return;
    lock.current = true;
    setSending(true);
    setPending(snapshot);
    onLockChange(true);
    try {
      await apiRequest(
        `/doctor/appointments/${appointmentId}/lab-orders/${orderId}/cancel`,
        {
          method: "POST",
          headers: { "Idempotency-Key": snapshot.key },
          body: snapshot.body,
        },
      );
      setPending(null);
      onLockChange(false);
      onConfirmed();
    } catch (caught) {
      if (
        !(caught instanceof ApiError) ||
        caught.status === 0 ||
        caught.status >= 500
      ) {
        onError(
          "Cancellation result unconfirmed. Keep this page open and use Retry same cancellation.",
          false,
        );
      } else {
        setPending(null);
        onLockChange(false);
        onError(caught.message, caught.status === 409);
      }
    } finally {
      lock.current = false;
      setSending(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || lock.current || pending || !reason.trim()) return;
    if (
      !window.confirm(
        `Cancel this uncollected lab order for ${patientName} (${mrn})?`,
      )
    )
      return;
    void send({
      key: crypto.randomUUID(),
      body: JSON.stringify({ expectedVersion: version, reason: reason.trim() }),
    });
  }
  return (
    <details className="mt-4 rounded-xl border border-red-200 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-red-800">
        Cancel uncollected order
      </summary>
      <p className="mt-2 text-xs text-slate-500">
        Cancellation is allowed before any sample collection attempt, including
        an attempt later rejected.
      </p>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <label className="block text-sm font-semibold">
          Cancellation reason
          <textarea
            rows={2}
            required
            maxLength={1000}
            disabled={disabled || pending !== null}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-2 block w-full rounded-xl border border-slate-300 p-3 font-normal"
          />
        </label>
        <button
          type="submit"
          disabled={disabled || pending !== null || !reason.trim()}
          className="min-h-11 rounded-xl border border-red-300 bg-red-50 px-4 text-sm font-semibold text-red-800 disabled:opacity-50"
        >
          Cancel order
        </button>
      </form>
      {pending && (
        <button
          type="button"
          disabled={sending}
          onClick={() => void send(pending)}
          className="mt-3 min-h-11 rounded-xl border border-amber-300 px-4 text-sm font-semibold disabled:opacity-50"
        >
          {sending ? "Cancelling…" : "Retry same cancellation"}
        </button>
      )}
    </details>
  );
}
