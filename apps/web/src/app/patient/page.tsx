"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { ApiError } from "@/lib/api";
import {
  patientApiRequest,
  type PatientAuthResponse,
  type PatientUser,
} from "@/lib/patient-api";

type SessionState =
  | { status: "loading" }
  | { status: "ready"; user: PatientUser }
  | { status: "error"; message: string };

export default function PatientHomePage() {
  const router = useRouter();

  const [session, setSession] = useState<SessionState>({ status: "loading" });

  const [reload, setReload] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const logoutLock = useRef(false);

  useEffect(() => {
    let active = true;
    let checking = false;

    async function checkSession() {
      if (checking) return;
      checking = true;

      try {
        const response =
          await patientApiRequest<PatientAuthResponse>("/patient/auth/me");

        if (!active) return;

        if (response.user.mustChangePassword) {
          setSession({ status: "loading" });
          router.replace("/patient/login");
          return;
        }

        setSession({
          status: "ready",
          user: response.user,
        });
      } catch (error) {
        if (!active) return;

        if (error instanceof ApiError && error.status === 401) {
          setSession({ status: "loading" });
          router.replace("/patient/login");
        } else {
          setSession({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Unable to verify your session.",
          });
        }
      } finally {
        checking = false;
      }
    }

    function onFocus() {
      void checkSession();
    }

    void checkSession();

    window.addEventListener("focus", onFocus);

    const timer = window.setInterval(() => {
      void checkSession();
    }, 60_000);

    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [router, reload]);

  async function logout() {
    if (logoutLock.current) return;

    logoutLock.current = true;
    setLoggingOut(true);
    setLogoutError("");

    try {
      await patientApiRequest("/patient/auth/logout", {
        method: "POST",
      });

      setSession({ status: "loading" });
      router.replace("/patient/login");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setSession({ status: "loading" });
        router.replace("/patient/login");
      } else {
        setLogoutError(
          error instanceof Error
            ? error.message
            : "Unable to sign out. Please try again.",
        );
      }
    } finally {
      logoutLock.current = false;
      setLoggingOut(false);
    }
  }

  if (session.status === "loading") {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p role="status">Checking patient session...</p>
        </section>
      </main>
    );
  }

  if (session.status === "error") {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>Unable to load your portal</h1>
          <p className="form-error" role="alert">
            {session.message}
          </p>

          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setSession({ status: "loading" });
              setReload((value) => value + 1);
            }}
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">LARQON PATIENT PORTAL</p>
        <h1>Welcome, {session.user.fullName}</h1>

        <dl className="patient-details-grid">
          <div>
            <dt>Hospital MRN</dt>
            <dd>{session.user.mrn}</dd>
          </div>
          <div>
            <dt>Login email</dt>
            <dd>{session.user.email}</dd>
          </div>
        </dl>

        <p className="muted">
          View appointments associated with your hospital record.
        </p>

        <Link href="/patient/appointments" className="primary-button">
          My appointments
        </Link>

        {logoutError && (
          <p className="form-error" role="alert">
            {logoutError}
          </p>
        )}

        <button
          type="button"
          className="secondary-button"
          disabled={loggingOut}
          onClick={() => void logout()}
        >
          {loggingOut ? "Signing out..." : "Sign out"}
        </button>
      </section>
    </main>
  );
}
