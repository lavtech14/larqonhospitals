"use client";

import { useRef, useState } from "react";
import { ApiError, apiRequest } from "@/lib/api";

export type EncounterSummary = {
  id: string;
  status:
    | "CHECKED_IN"
    | "READY_FOR_DOCTOR"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "CANCELLED";
  checkedInAt: string;
  version: number;
};

export type CheckInResponse = {
  alreadyCheckedIn: boolean;
  appointment: {
    id: string;
    version: number;
  };
  encounter: EncounterSummary;
};

type Props = {
  appointment: {
    id: string;
    version: number;
    startsAt: string;
    mode: "IN_PERSON" | "ONLINE";
    status: "BOOKED" | "CANCELLED";
    consultationEndedAt: string | null;
    encounter?: EncounterSummary | null;
    patient: {
      fullName: string;
      mrn?: string;
    };
    doctor: {
      displayName: string;
    };
  };
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onCheckedIn: (result: CheckInResponse) => void;
};

function hospitalDate(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

export default function CheckInButton({
  appointment,
  disabled,
  onBusyChange,
  onCheckedIn,
}: Props) {
  const locked = useRef(false);

  // Keep the same version if the server result is unconfirmed.
  const pendingVersion = useRef<number | null>(null);

  const [sending, setSending] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [error, setError] = useState("");

  const eligible =
    appointment.mode === "IN_PERSON" &&
    appointment.status === "BOOKED" &&
    !appointment.consultationEndedAt &&
    hospitalDate(new Date(appointment.startsAt)) === hospitalDate(new Date());

  async function checkIn() {
    if (locked.current || disabled || appointment.encounter) return;
    if (!eligible && !unconfirmed) return;

    if (!unconfirmed) {
      const confirmed = window.confirm(
        [
          "Confirm that this patient has arrived:",
          "",
          appointment.patient.fullName,
          `MRN: ${appointment.patient.mrn ?? "Unavailable"}`,
          `Doctor: ${appointment.doctor.displayName}`,
          "",
          "Check in this patient?",
        ].join("\n"),
      );

      if (!confirmed) return;
    }

    locked.current = true;
    setSending(true);
    onBusyChange(true);
    setError("");

    pendingVersion.current ??= appointment.version;

    let response: CheckInResponse;

    try {
      response = await apiRequest<CheckInResponse>(
        `/appointments/${appointment.id}/check-in`,
        {
          method: "POST",
          body: JSON.stringify({
            expectedVersion: pendingVersion.current,
          }),
        },
      );
    } catch (caught) {
      const uncertain =
        !(caught instanceof ApiError) ||
        caught.status === 0 ||
        caught.status >= 500;

      setUnconfirmed(uncertain);

      if (!uncertain) {
        pendingVersion.current = null;
      }

      setError(
        uncertain
          ? "The result is unconfirmed. Retry the same check-in to check safely."
          : `${
              caught instanceof Error ? caught.message : "Check-in failed."
            } Refresh the appointment list before trying again.`,
      );

      locked.current = false;
      setSending(false);
      onBusyChange(false);
      return;
    }

    pendingVersion.current = null;
    setUnconfirmed(false);
    locked.current = false;
    setSending(false);
    onBusyChange(false);

    onCheckedIn(response);
  }

  if (appointment.encounter) return null;
  if (!eligible && !unconfirmed) return null;

  // The updated reception API supplies both fields.
  if (appointment.encounter === undefined || !appointment.patient.mrn) {
    return (
      <p className="text-xs text-amber-800">
        Refresh to load patient identification and check-in status.
      </p>
    );
  }

  return (
    <div className="max-w-sm space-y-2">
      <button
        type="button"
        disabled={disabled || sending}
        onClick={() => void checkIn()}
        aria-label={`Check in ${appointment.patient.fullName}`}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sending
          ? "Checking in…"
          : unconfirmed
            ? "Retry same check-in"
            : "Check in"}
      </button>

      {error && (
        <p role="alert" className="text-xs leading-5 text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
