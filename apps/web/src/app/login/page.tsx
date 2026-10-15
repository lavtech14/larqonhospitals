"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiRequest } from "@/lib/api";
import type { AuthResponse } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "change-password">("login");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) return;

    const form = event.currentTarget;
    const data = new FormData(form);

    setError("");
    setMessage("");

    if (mode === "change-password") {
      const password = String(data.get("newPassword") ?? "");
      const confirmation = String(data.get("confirmPassword") ?? "");

      if (password !== confirmation) {
        setError("The new passwords do not match.");
        return;
      }

      if (password === String(data.get("currentPassword") ?? "")) {
        setError("Choose a password different from your current password.");
        return;
      }
    }

    setBusy(true);

    try {
      if (mode === "login") {
        const result = await apiRequest<AuthResponse>("/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email: email.trim(),
            password: String(data.get("password") ?? ""),
          }),
        });

        form.reset();

        if (result.user.mustChangePassword) {
          setMode("change-password");
          setMessage("Change your initial password before continuing.");
        } else {
          router.replace("/");
        }
      } else {
        await apiRequest<{ message: string }>("/auth/change-password", {
          method: "POST",
          body: JSON.stringify({
            currentPassword: String(data.get("currentPassword") ?? ""),
            newPassword: String(data.get("newPassword") ?? ""),
          }),
        });

        form.reset();
        setMode("login");
        setMessage("Password changed. Sign in with your new password.");
      }
    } catch (caught) {
      if (
        mode === "change-password" &&
        caught instanceof ApiError &&
        caught.status === 401
      ) {
        form.reset();
        setMode("login");
        setError(
          "Your session expired or the current password was incorrect. Sign in again.",
        );
      } else {
        setError(
          caught instanceof Error
            ? caught.message
            : "Something went wrong. Please try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">
          <span className="brand-icon" aria-hidden="true">
            +
          </span>

          <div>
            <strong>Larqon Hospitals</strong>
            <p className="muted">Staff workspace</p>
          </div>
        </div>

        <p className="eyebrow">WELCOME TO LARQON</p>

        <h1 id="auth-title">
          {mode === "login" ? "Staff sign in" : "Change your password"}
        </h1>

        <p className="muted">
          {mode === "login"
            ? "Use your assigned staff account to continue."
            : "Choose a new password containing 16–128 characters."}
        </p>

        <p className="success-message" role="status">
          {message}
        </p>

        <p className="form-error" id="auth-error" role="alert">
          {error}
        </p>

        <form
          key={mode}
          onSubmit={submit}
          aria-busy={busy}
          aria-describedby={error ? "auth-error" : undefined}
        >
          <fieldset className="auth-fields" disabled={busy}>
            {mode === "login" ? (
              <>
                <div className="form-field">
                  <label htmlFor="email">Staff email</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    maxLength={128}
                  />
                </div>
              </>
            ) : (
              <>
                <p className="muted">Signed in as {email}</p>

                <div className="form-field">
                  <label htmlFor="currentPassword">Current password</label>
                  <input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    required
                    maxLength={128}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="newPassword">New password</label>
                  <input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={16}
                    maxLength={128}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="confirmPassword">Confirm new password</label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={16}
                    maxLength={128}
                  />
                </div>
              </>
            )}

            <button className="primary-button auth-submit" type="submit">
              {busy
                ? "Please wait..."
                : mode === "login"
                  ? "Sign in"
                  : "Change password"}
            </button>
          </fieldset>
        </form>

        <p className="auth-footer">
          Staff accounts are provided by your hospital administrator.
        </p>
      </section>
    </main>
  );
}
