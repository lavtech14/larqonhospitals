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
      className={`consultation-presence${
        connectionState === ConnectionState.Connected && otherParticipant
          ? " consultation-presence-connected"
          : ""
      }`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="consultation-presence-dot" aria-hidden="true" />
      {message}
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
    <div className="consultation-media">
      <div className="consultation-grid">
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

  return (
    <section className="consultation-page">
      <header className="consultation-heading">
        <div>
          <p className="eyebrow">LARQON HOSPITALS</p>
          <h1>Online consultation</h1>
          <p className="muted">
            {audience === "doctor"
              ? "Connect with your scheduled patient."
              : "Connect with your scheduled doctor."}
          </p>
        </div>

        {!session && (
          <Link href={backHref} className="nav-link">
            Back to appointments
          </Link>
        )}
      </header>
      {statusError && (
        <p className="form-error" role="status">
          {statusError}
        </p>
      )}

      {audience === "doctor" && (session !== null || closurePending) && (
        <div style={{ marginBottom: 16 }}>
          <button
            type="button"
            className="primary-button"
            disabled={endingBusy}
            onClick={endConsultation}
          >
            {endingBusy
              ? "Please wait..."
              : closurePending
                ? "Retry room closure"
                : "End consultation"}
          </button>
        </div>
      )}

      {endedAt && (
        <div role="status" className="consultation-lobby">
          <h2>Consultation completed</h2>

          <p className="muted">
            This consultation has ended. Joining is no longer available.
          </p>

          {closurePending && audience === "doctor" && (
            <p className="form-error">
              Completion was saved, but server room closure is pending. Use
              “Retry room closure”.
            </p>
          )}

          <Link href={backHref} className="primary-button">
            Back to appointments
          </Link>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {endedAt ? null : session ? (
        <LiveKitRoom
          data-lk-theme="default"
          serverUrl={session.serverUrl}
          token={session.token}
          connect
          audio={microphoneEnabled}
          video={cameraEnabled}
          className="consultation-live-room"
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
      ) : (
        <div className="consultation-lobby">
          <span className="consultation-symbol" aria-hidden="true">
            +
          </span>

          <h2>
            {left ? "You have left the call" : "Ready for your consultation?"}
          </h2>

          <p className="muted">
            Joining is available from 10 minutes before your appointment until
            its scheduled end.
          </p>

          <fieldset className="consultation-options" disabled={busy}>
            <legend>Device settings</legend>

            <label>
              <input
                type="checkbox"
                checked={microphoneEnabled}
                onChange={(event) => setMicrophoneEnabled(event.target.checked)}
              />
              Enable microphone when joining
            </label>

            <label>
              <input
                type="checkbox"
                checked={cameraEnabled}
                onChange={(event) => setCameraEnabled(event.target.checked)}
              />
              Enable camera when joining
            </label>
          </fieldset>

          <button
            type="button"
            className="primary-button"
            disabled={busy}
            onClick={join}
          >
            {busy
              ? "Joining..."
              : left
                ? "Rejoin consultation"
                : "Join consultation"}
          </button>

          <p className="muted">
            You can turn your camera and microphone on or off during the call.
          </p>
        </div>
      )}
    </section>
  );
}
