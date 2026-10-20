"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

import { ApiError } from "@/lib/api";
import { patientApiRequest, type PatientAuthResponse } from "@/lib/patient-api";

export default function PatientLoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "change-password">("login");

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const requestLock = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (requestLock.current) return;

    const form = event.currentTarget;
    const values = new FormData(form);

    setError("");
    setMessage("");

    if (mode === "change-password") {
      const currentPassword = String(values.get("currentPassword") ?? "");
      const newPassword = String(values.get("newPassword") ?? "");
      const confirmation = String(values.get("confirmPassword") ?? "");

      if (newPassword !== confirmation) {
        setError("The new passwords do not match.");
        return;
      }

      if (newPassword === currentPassword) {
        setError("Choose a password different from your current password.");
        return;
      }
    }

    requestLock.current = true;
    setBusy(true);

    try {
      if (mode === "login") {
        const result = await patientApiRequest<PatientAuthResponse>(
          "/patient/auth/login",
          {
            method: "POST",
            body: JSON.stringify({
              email: email.trim().toLowerCase(),
              password: String(values.get("password") ?? ""),
            }),
          },
        );

        form.reset();
        setEmail(result.user.email);

        if (result.user.mustChangePassword) {
          setMode("change-password");
          setMessage("Change your temporary password before continuing.");
        } else {
          router.replace("/patient");
        }
      } else {
        await patientApiRequest<{ message: string }>(
          "/patient/auth/change-password",
          {
            method: "POST",
            body: JSON.stringify({
              currentPassword: String(values.get("currentPassword") ?? ""),
              newPassword: String(values.get("newPassword") ?? ""),
            }),
          },
        );

        form.reset();
        setMode("login");
        setMessage("Password changed. Sign in with your new password.");
      }
    } catch (error) {
      if (
        mode === "change-password" &&
        error instanceof ApiError &&
        error.status === 401
      ) {
        form.reset();
        setMode("login");

        setError(
          "Your session expired or the current password was incorrect. Sign in again.",
        );
      } else {
        setError(
          error instanceof Error
            ? error.message
            : "Unable to complete the request.",
        );
      }
    } finally {
      requestLock.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="patient-auth-title">
        <div className="auth-brand">
          <span className="brand-icon" aria-hidden="true">
            +
          </span>
          <div>
            <strong>Larqon Hospitals</strong>
            <p className="muted">Patient portal</p>
          </div>
        </div>

        <p className="eyebrow">PATIENT ACCESS</p>

        <h1 id="patient-auth-title">
          {mode === "login" ? "Patient sign in" : "Change your password"}
        </h1>

        <p className="muted">
          {mode === "login"
            ? "Use the portal account provided by the hospital."
            : "Choose a new password containing 16–128 characters."}
        </p>

        <div aria-live="polite">
          {message && <p className="success-message">{message}</p>}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <form key={mode} onSubmit={submit} aria-busy={busy}>
          <fieldset className="auth-fields" disabled={busy}>
            {mode === "login" ? (
              <>
                <label className="form-field">
                  <span>Login email</span>
                  <input
                    name="email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>

                <label className="form-field">
                  <span>Password</span>
                  <input
                    name="password"
                    type="password"
                    required
                    maxLength={128}
                    autoComplete="current-password"
                  />
                </label>
              </>
            ) : (
              <>
                <p className="muted">Signed in as {email}</p>

                <label className="form-field">
                  <span>Current password</span>
                  <input
                    name="currentPassword"
                    type="password"
                    required
                    maxLength={128}
                    autoComplete="current-password"
                  />
                </label>

                <label className="form-field">
                  <span>New password</span>
                  <input
                    name="newPassword"
                    type="password"
                    required
                    minLength={16}
                    maxLength={128}
                    autoComplete="new-password"
                  />
                </label>

                <label className="form-field">
                  <span>Confirm new password</span>
                  <input
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={16}
                    maxLength={128}
                    autoComplete="new-password"
                  />
                </label>
              </>
            )}

            <button type="submit" className="primary-button auth-submit">
              {busy
                ? "Please wait..."
                : mode === "login"
                  ? "Sign in"
                  : "Change password"}
            </button>
          </fieldset>
        </form>

        <p className="auth-footer">
          Need a portal account or help signing in? Contact hospital reception.
        </p>

        <Link href="/login" className="text-link">
          Staff sign in
        </Link>
      </section>
    </main>
  );
}
