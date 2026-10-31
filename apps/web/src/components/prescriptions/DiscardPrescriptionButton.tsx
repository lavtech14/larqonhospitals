"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";

import { ApiError, apiRequest } from "@/lib/api";

type Snapshot = {
  key: string;
  body: string;
};

type Props = {
  appointmentId: string;
  prescriptionId: string;
  version: number;
  patientName: string;
  mrn: string;
  disabled: boolean;

  onLockChange: (locked: boolean) => void;
  onConfirmed: () => void;
  onError: (message: string, refresh: boolean) => void;
};

export default function DiscardPrescriptionButton({
  appointmentId,
  prescriptionId,
  version,
  patientName,
  mrn,
  disabled,
  onLockChange,
  onConfirmed,
  onError,
}: Props) {
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
        `/doctor/appointments/${appointmentId}` +
          `/prescriptions/${prescriptionId}/discard`,
        {
          method: "POST",

          headers: {
            "Idempotency-Key": snapshot.key,
          },

          body: snapshot.body,
        },
      );

      setPending(null);
      onLockChange(false);
      onConfirmed();
    } catch (caught) {
      const uncertain =
        !(caught instanceof ApiError) ||
        caught.status === 0 ||
        caught.status >= 500;

      if (uncertain) {
        // Preserve the original key, reason, and version.
        // Keep the parent editor locked.
        onError(
          "Discard result unconfirmed. Keep this page open and use Retry same discard.",
          false,
        );
      } else if (caught instanceof ApiError) {
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

    if (disabled || pending || lock.current || !reason.trim()) {
      return;
    }

    if (
      !window.confirm(
        `Discard the prescription draft for ${patientName} (${mrn})? ` +
          "Saved contents will remain in the audit record. " +
          "Any unsaved edits on this screen will be abandoned.",
      )
    ) {
      return;
    }

    void send({
      key: crypto.randomUUID(),

      body: JSON.stringify({
        expectedVersion: version,
        reason: reason.trim(),
      }),
    });
  }

  return (
    <section className="rounded-2xl border border-red-200 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-bold text-slate-950">Discard this draft</h2>

      <p className="mt-2 text-sm leading-6 text-slate-600">
        Use this for an accidental or unnecessary prescription draft. It will
        not be issued to the patient.
      </p>

      <form onSubmit={submit} className="mt-4">
        <label
          htmlFor="prescription-discard-reason"
          className="block text-sm font-semibold text-slate-800"
        >
          Reason for discarding
        </label>

        <textarea
          id="prescription-discard-reason"
          rows={3}
          required
          maxLength={1000}
          value={reason}
          disabled={disabled || pending !== null || sending}
          onChange={(event) => setReason(event.target.value)}
          className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm focus:outline-2 focus:outline-red-700 disabled:bg-slate-50"
        />

        <button
          type="submit"
          disabled={disabled || pending !== null || sending || !reason.trim()}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Discard draft
        </button>
      </form>

      {pending && (
        <div className="mt-4 rounded-xl bg-amber-50 p-4">
          <p role="status" className="text-sm text-amber-950">
            {sending
              ? "Submitting discard request…"
              : "The discard result is unconfirmed. Retry the original request."}
          </p>

          <button
            type="button"
            disabled={sending}
            onClick={() => void send(pending)}
            className="mt-3 min-h-11 rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {sending ? "Please wait…" : "Retry same discard"}
          </button>
        </div>
      )}
    </section>
  );
}
