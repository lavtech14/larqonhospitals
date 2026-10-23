"use client";

import LoginFrame from "./LoginFrame";
import LoginPasswordInput from "./LoginPasswordInput";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

import { ApiError } from "@/lib/api";
import { patientApiRequest, type PatientAuthResponse } from "@/lib/patient-api";

export default function PatientLoginForm() {
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
    <LoginFrame
      audience="patient"
      changingPassword={mode === "change-password"}
      busy={busy}
    >
      <p className="text-[10px] font-bold tracking-[0.16em] text-teal-800">
        WELCOME TO LARQON
      </p>
      <h1
        id="patient-auth-title"
        className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl"
      >
        {mode === "login" ? "Patient sign in" : "Change your password"}
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">
        {mode === "login"
          ? "Use the portal account provided by the hospital."
          : "Choose a new password containing 16–128 characters."}
      </p>
      {message && (
        <p
          role="status"
          className="mt-5 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm leading-6 text-teal-950"
        >
          {message}
        </p>
      )}
      {error && (
        <p
          id="patient-auth-error"
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
        >
          {error}
        </p>
      )}
      <form
        key={mode}
        onSubmit={submit}
        aria-labelledby="patient-auth-title"
        aria-busy={busy}
        aria-describedby={error ? "patient-auth-error" : undefined}
        className="mt-6"
      >
        <fieldset
          disabled={busy}
          className="m-0 grid min-w-0 gap-5 border-0 p-0 disabled:opacity-70"
        >
          <legend className="sr-only">
            {mode === "login"
              ? "Patient sign in details"
              : "Password change details"}
          </legend>
          {mode === "login" ? (
            <>
              <div className="min-w-0">
                <label
                  htmlFor="patient-email"
                  className="text-xs font-semibold text-slate-600"
                >
                  Login email
                </label>
                <input
                  id="patient-email"
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="username"
                  value={email}
                  disabled={busy}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 block min-h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 focus:border-teal-700 focus:outline-2 focus:outline-offset-2 focus:outline-teal-700 disabled:cursor-wait disabled:bg-slate-50"
                />
              </div>
              <LoginPasswordInput
                id="patient-password"
                name="password"
                label="Password"
                required
                maxLength={128}
                autoComplete="current-password"
                disabled={busy}
              />
            </>
          ) : (
            <>
              <p className="break-all rounded-xl bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-600">
                Signed in as{" "}
                <strong className="font-semibold text-slate-900">
                  {email}
                </strong>
              </p>
              <LoginPasswordInput
                id="patient-currentPassword"
                name="currentPassword"
                label="Current password"
                required
                maxLength={128}
                autoComplete="current-password"
                disabled={busy}
              />
              <LoginPasswordInput
                id="patient-newPassword"
                name="newPassword"
                label="New password"
                required
                minLength={16}
                maxLength={128}
                autoComplete="new-password"
                disabled={busy}
              />
              <LoginPasswordInput
                id="patient-confirmPassword"
                name="confirmPassword"
                label="Confirm new password"
                required
                minLength={16}
                maxLength={128}
                autoComplete="new-password"
                disabled={busy}
              />
            </>
          )}
          <button
            type="submit"
            disabled={busy}
            className="mt-1 inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-800 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-wait disabled:opacity-60"
          >
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Change password"}
          </button>
        </fieldset>
      </form>
      <p className="mt-7 border-t border-slate-100 pt-5 text-center text-xs leading-6 text-slate-500">
        Need a portal account or help signing in? Contact hospital reception.
      </p>
    </LoginFrame>
  );
}
