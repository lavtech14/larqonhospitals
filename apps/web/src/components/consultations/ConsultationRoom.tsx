"use client";

import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import {
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
  useConnectionState,
  useRemoteParticipants,
} from "@livekit/components-react";

import { ConnectionState, Track } from "livekit-client";

import { apiRequest } from "@/lib/api";
import { patientApiRequest } from "@/lib/patient-api";

type JoinResponse = {
  appointmentId: string;
  serverUrl: string;
  roomName: string;
  token: string;
  tokenExpiresAt: string;
  joinWindowEndsAt: string;
};
type ConsultationStatus = {
  appointmentId: string;
  endedAt: string | null;
  roomClosurePending: boolean;
};

type Props = {
  appointmentId: string;
  audience: "doctor" | "patient";
};

function ConsultationPresence({
  audience,
}: {
  audience: "doctor" | "patient";
}) {
  const connectionState = useConnectionState();
  const participants = useRemoteParticipants();

  const otherRole = audience === "doctor" ? "patient" : "doctor";

  const otherParticipant = participants.find((participant) =>
    participant.identity.startsWith(`${otherRole}-`),
  );

  let message = "Connecting to consultation…";

  if (
    connectionState === ConnectionState.Reconnecting ||
    connectionState === ConnectionState.SignalReconnecting
  ) {
    message = "Connection interrupted. Reconnecting…";
  } else if (connectionState === ConnectionState.Connected) {
    message = otherParticipant
      ? `${otherRole === "doctor" ? "Doctor" : "Patient"} connected`
      : `Waiting for the ${otherRole}…`;
  } else if (connectionState === ConnectionState.Disconnected) {
    message = "Disconnected from consultation.";
  }

  return (
    <div
      className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-4 py-3 text-xs text-slate-200 sm:px-5 sm:text-sm"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className={`size-2 shrink-0 rounded-full ${connectionState === ConnectionState.Connected && otherParticipant ? "bg-emerald-400" : "bg-amber-400"}`}
        />
        {message}
      </span>
      <span className="text-xs text-slate-400">
        {audience === "doctor" ? "Doctor workspace" : "Patient portal"}
      </span>
    </div>
  );
}

function CallContent() {
  const tracks = useTracks([
    {
      source: Track.Source.Camera,
      withPlaceholder: true,
    },
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col [&_.lk-control-bar]:h-auto! [&_.lk-control-bar]:min-h-20 [&_.lk-control-bar]:shrink-0 [&_.lk-control-bar]:flex-wrap! [&_.lk-control-bar]:gap-2 [&_.lk-control-bar]:px-3 [&_.lk-control-bar]:py-3">
      <div className="min-h-0 flex-1 overflow-hidden [&>.lk-grid-layout]:h-full">
        <GridLayout tracks={tracks}>
          <ParticipantTile />
        </GridLayout>
      </div>

      <RoomAudioRenderer />

      <ControlBar
        controls={{
          microphone: true,
          camera: true,
          screenShare: false,
          chat: false,
          leave: true,
        }}
      />
    </div>
  );
}

export default function ConsultationRoom({ appointmentId, audience }: Props) {
  const joining = useRef(false);

  const [session, setSession] = useState<JoinResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [left, setLeft] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);

  const ending = useRef(false);

  const [endingBusy, setEndingBusy] = useState(false);
  const [endedAt, setEndedAt] = useState<string | null>(null);
  const [closurePending, setClosurePending] = useState(false);
  const [statusError, setStatusError] = useState("");

  const consultationPath =
    audience === "doctor"
      ? `/appointments/${encodeURIComponent(appointmentId)}/consultation`
      : `/patient/appointments/${encodeURIComponent(appointmentId)}/consultation`;

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function checkStatus() {
      try {
        const result =
          audience === "doctor"
            ? await apiRequest<ConsultationStatus>(consultationPath)
            : await patientApiRequest<ConsultationStatus>(consultationPath);

        if (disposed) return;

        setStatusError("");
        setEndedAt(result.endedAt);
        setClosurePending(result.roomClosurePending);

        if (result.endedAt) {
          // Unmounting LiveKitRoom disconnects this browser.
          setSession(null);
        }
      } catch {
        if (!disposed) {
          setStatusError(
            "Unable to check consultation status. Check your connection.",
          );
        }
      } finally {
        if (!disposed) {
          timer = setTimeout(checkStatus, 5000);
        }
      }
    }

    void checkStatus();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
    };
  }, [audience, consultationPath]);

  async function endConsultation() {
    if (ending.current) return;

    if (
      !endedAt &&
      !window.confirm(
        "End this consultation for both participants? It cannot be reopened.",
      )
    ) {
      return;
    }

    ending.current = true;
    setEndingBusy(true);
    setError("");

    try {
      const result = await apiRequest<ConsultationStatus>(
        `${consultationPath}/end`,
        { method: "POST" },
      );

      setEndedAt(result.endedAt);
      setClosurePending(result.roomClosurePending);
      setSession(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The result is unconfirmed. Check the consultation status and retry.",
      );
    } finally {
      ending.current = false;
      setEndingBusy(false);
    }
  }
  const backHref =
    audience === "doctor" ? "/my-appointments" : "/patient/appointments";

  async function join() {
    if (joining.current || ending.current || endedAt) return;

    joining.current = true;
    setBusy(true);
    setError("");
    setLeft(false);

    try {
      const id = encodeURIComponent(appointmentId);

      const result =
        audience === "doctor"
          ? await apiRequest<JoinResponse>(
              `/appointments/${id}/consultation/join`,
              { method: "POST" },
            )
          : await patientApiRequest<JoinResponse>(
              `/patient/appointments/${id}/consultation/join`,
              { method: "POST" },
            );

      // Keep the token only in component memory.
      const latest =
        audience === "doctor"
          ? await apiRequest<ConsultationStatus>(consultationPath)
          : await patientApiRequest<ConsultationStatus>(consultationPath);

      if (latest.endedAt) {
        setEndedAt(latest.endedAt);
        setClosurePending(latest.roomClosurePending);
        return;
      }

      setSession(result);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to join the consultation. Please try again.",
      );
    } finally {
      joining.current = false;
      setBusy(false);
    }
  }

  const primaryButton =
    "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-800 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50";
  const secondaryButton =
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50";
  const dangerButton =
    "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 transition-colors hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-wait disabled:opacity-50";

  return (
    <section
      aria-labelledby="consultation-title"
      className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6 sm:py-8 lg:py-10"
    >
      <header className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] text-teal-800">
            LARQON HOSPITALS ·{" "}
            {audience === "doctor" ? "DOCTOR WORKSPACE" : "PATIENT PORTAL"}
          </p>
          <h1
            id="consultation-title"
            className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl"
          >
            Online consultation
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            {audience === "doctor"
              ? "Connect with your scheduled patient."
              : "Connect with your scheduled doctor."}
          </p>
        </div>
        {!session && (
          <Link href={backHref} className={secondaryButton}>
            <span aria-hidden="true">←</span>Back to appointments
          </Link>
        )}
      </header>

      {statusError && (
        <p
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"
        >
          {statusError}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
        >
          {error}
        </p>
      )}

      {audience === "doctor" && (session !== null || closurePending) && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:px-5">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {closurePending
                ? "Room closure needs attention"
                : "Consultation controls"}
            </p>
            <p className="mt-1 max-w-2xl text-xs leading-6 text-slate-500">
              {closurePending
                ? "Completion is saved. Retry closing the server room."
                : "Use Leave in the call controls to disconnect temporarily. End consultation ends the consultation for both participants."}
            </p>
          </div>
          <button
            type="button"
            className={dangerButton}
            disabled={endingBusy}
            onClick={endConsultation}
          >
            {endingBusy
              ? "Please wait…"
              : closurePending
                ? "Retry room closure"
                : "End consultation"}
          </button>
        </div>
      )}

      {endedAt && (
        <div
          role="status"
          className="rounded-3xl border border-slate-200 bg-white px-6 py-10 text-center sm:py-14"
        >
          <span
            aria-hidden="true"
            className="mx-auto grid size-16 place-items-center rounded-2xl bg-teal-50 text-3xl text-teal-800"
          >
            ✓
          </span>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
            Consultation completed
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-slate-500">
            This consultation has ended. Joining is no longer available through
            the portal.
          </p>
          <p className="mt-3 text-xs leading-6 text-slate-500">
            Completed{" "}
            {new Date(endedAt).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
            IST
          </p>
          {closurePending && audience === "doctor" && (
            <p className="mx-auto mt-5 max-w-lg rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
              Completion was saved, but server room closure is pending. Use
              “Retry room closure” above.
            </p>
          )}
          <Link href={backHref} className={`${primaryButton} mt-6`}>
            Back to appointments
          </Link>
        </div>
      )}

      {endedAt ? null : session ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm">
          <LiveKitRoom
            data-lk-theme="default"
            serverUrl={session.serverUrl}
            token={session.token}
            connect
            audio={microphoneEnabled}
            video={cameraEnabled}
            className="flex! h-[clamp(420px,72dvh,850px)]! min-h-0 flex-col! bg-slate-950"
            onError={() => {
              setError(
                "A call error occurred. Check your connection and device permissions.",
              );
            }}
            onMediaDeviceFailure={() => {
              setError(
                "Camera or microphone access failed. Check browser permissions and try enabling the device again.",
              );
            }}
            onDisconnected={() => {
              setSession(null);
              setLeft(true);
            }}
          >
            <ConsultationPresence audience={audience} />
            <CallContent />
          </LiveKitRoom>
          <p className="border-t border-slate-800 px-4 py-3 text-xs leading-6 text-slate-300">
            Camera and microphone can be changed during the call. Leave
            disconnects only you.
          </p>
        </div>
      ) : (
        <div className="grid overflow-hidden rounded-3xl border border-slate-200 bg-white lg:grid-cols-[1fr_1.1fr]">
          <div className="relative overflow-hidden bg-slate-900 p-6 text-white sm:p-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -bottom-16 size-64 rounded-full border-[36px] border-white/5"
            />
            <div className="relative">
              <span
                aria-hidden="true"
                className="grid size-14 place-items-center rounded-2xl bg-teal-800 text-3xl text-white"
              >
                +
              </span>
              <p className="mt-7 text-[10px] font-bold tracking-[0.18em] text-teal-200">
                CONSULTATION LOBBY
              </p>
              <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-tight text-white">
                {left
                  ? "You have left the call"
                  : "Ready for your consultation?"}
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                {left
                  ? "You can request to rejoin while this consultation is open and its joining window is available."
                  : "Choose your device settings, then join your scheduled consultation."}
              </p>
              <p className="mt-6 border-t border-white/10 pt-5 text-xs leading-6 text-slate-400">
                Joining opens 10 minutes before your appointment and closes at
                its scheduled end.
              </p>
            </div>
          </div>
          <div className="p-6 sm:p-8">
            <p className="text-base font-semibold text-slate-950">
              Before you join
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Find a quiet place and allow browser access if you choose to
              enable your camera or microphone.
            </p>
            <fieldset
              disabled={busy}
              className="mt-6 grid min-w-0 gap-3 border-0 p-0"
            >
              <legend className="mb-3 text-xs font-semibold text-slate-600">
                Device settings
              </legend>
              <label
                className={`flex min-h-20 items-center gap-3 rounded-xl border p-4 ${microphoneEnabled ? "border-teal-700 bg-teal-50" : "border-slate-200 bg-white"} ${busy ? "cursor-wait opacity-60" : "cursor-pointer"}`}
              >
                <input
                  type="checkbox"
                  checked={microphoneEnabled}
                  onChange={(event) =>
                    setMicrophoneEnabled(event.target.checked)
                  }
                  className="size-4 shrink-0 accent-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">
                    Enable microphone when joining
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    {microphoneEnabled
                      ? "Microphone requested on entry."
                      : "Start muted and turn it on during the call."}
                  </span>
                </span>
              </label>
              <label
                className={`flex min-h-20 items-center gap-3 rounded-xl border p-4 ${cameraEnabled ? "border-teal-700 bg-teal-50" : "border-slate-200 bg-white"} ${busy ? "cursor-wait opacity-60" : "cursor-pointer"}`}
              >
                <input
                  type="checkbox"
                  checked={cameraEnabled}
                  onChange={(event) => setCameraEnabled(event.target.checked)}
                  className="size-4 shrink-0 accent-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">
                    Enable camera when joining
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    {cameraEnabled
                      ? "Camera requested on entry."
                      : "Start with camera off and enable it when ready."}
                  </span>
                </span>
              </label>
            </fieldset>
            <button
              type="button"
              className={`${primaryButton} mt-6 w-full`}
              disabled={busy}
              onClick={join}
            >
              {busy
                ? "Joining…"
                : left
                  ? "Rejoin consultation"
                  : "Join consultation"}
            </button>
            <p className="mt-4 text-center text-xs leading-6 text-slate-500">
              Your selected settings apply when the room connects.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
