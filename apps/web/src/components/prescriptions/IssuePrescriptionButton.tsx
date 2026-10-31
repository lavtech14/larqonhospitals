"use client";

import { useRef, useState } from "react";
import { ApiError, apiRequest } from "@/lib/api";

type Snapshot = {
  key: string;
  body: string;
  uncertain?: boolean;
};

export default function IssuePrescriptionButton({
  appointmentId,
  prescriptionId,
  version,
  patientName,
  mrn,
  disabled,
  disabledReason,
  onLockChange,
  onConfirmed,
  onError,
}: {
  appointmentId: string;
  prescriptionId: string;
  version: number;
  patientName: string;
  mrn: string;
  disabled: boolean;
  disabledReason?: string;
  onLockChange: (locked: boolean) => void;
  onConfirmed: () => void;
  onError: (message: string, refresh: boolean) => void;
}) {
  const [reviewed, setReviewed] = useState(false);
  const [pending, setPending] = useState<Snapshot | null>(null);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);

  async function send(snapshot: Snapshot) {
    if (lock.current) return;

    lock.current = true;
    setSending(true);
    setPending(snapshot);
    setError("");
    onLockChange(true);

    try {
      await apiRequest(
        `/doctor/appointments/${appointmentId}/prescriptions/${prescriptionId}/issue`,
        {
          method: "POST",
          headers: {
            "Idempotency-Key": snapshot.key,
          },
          body: snapshot.body,
        },
      );
    } catch (caught) {
      const uncertain =
        snapshot.uncertain === true ||
        !(caught instanceof ApiError) ||
        caught.status === 0 ||
        caught.status >= 500;

      if (uncertain) {
        setPending({ ...snapshot, uncertain: true });
        setError(
          "Issuance result unconfirmed. Keep this page open and retry the same issuance.",
        );
      } else {
        setPending(null);
        onLockChange(false);
        onError(caught.message, caught.status === 409);
      }

      return;
    } finally {
      lock.current = false;
      setSending(false);
    }

    setPending(null);
    onLockChange(false);
    onConfirmed();
  }

  return (
    <section className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
      <h2 className="text-lg font-bold text-slate-950">
        Issue saved prescription
      </h2>

      <p className="mt-2 text-sm leading-6 text-slate-700">
        Save your changes and review the saved medicines, allergy information
        and instructions. Issuance locks the saved prescription.
      </p>

      <label className="mt-4 flex items-start gap-3 text-sm font-medium">
        <input
          type="checkbox"
          checked={reviewed}
          disabled={disabled || Boolean(pending)}
          onChange={(event) => setReviewed(event.target.checked)}
          className="mt-1 size-4 accent-teal-800"
        />
        I reviewed the saved prescription for {patientName} ({mrn}).
      </label>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {pending ? (
        <button
          type="button"
          disabled={sending}
          onClick={() => void send(pending)}
          className="mt-4 min-h-11 rounded-xl bg-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {sending ? "Issuing…" : "Retry same issuance"}
        </button>
      ) : (
        <button
          type="button"
          disabled={disabled || !reviewed || sending}
          onClick={() => {
            if (disabled || !reviewed) return;

            void send({
              key: crypto.randomUUID(),
              body: JSON.stringify({
                expectedVersion: version,
                reviewConfirmed: true,
              }),
            });
          }}
          className="mt-4 min-h-11 rounded-xl bg-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Issue prescription
        </button>
      )}

      {disabled && !pending && (
        <p className="mt-2 text-xs text-slate-600">
          {disabledReason ??
            "Save all edits, complete allergy review and resolve catalogue warnings first."}
        </p>
      )}
    </section>
  );
}
