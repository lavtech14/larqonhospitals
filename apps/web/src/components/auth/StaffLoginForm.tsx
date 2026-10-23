"use client";

import LoginFrame from "./LoginFrame";
import LoginPasswordInput from "./LoginPasswordInput";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiRequest } from "@/lib/api";
import type { AuthResponse } from "@/lib/api";

export default function StaffLoginForm() {
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
    <LoginFrame
      audience="staff"
      changingPassword={mode === "change-password"}
      busy={busy}
    >
      <p className="text-[10px] font-bold tracking-[0.16em] text-teal-800">
        WELCOME TO LARQON
      </p>
      <h1
        id="staff-auth-title"
        className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl"
      >
        {mode === "login" ? "Staff sign in" : "Change your password"}
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">
        {mode === "login"
          ? "Use your assigned staff account to continue."
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
          id="staff-auth-error"
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
        >
          {error}
        </p>
      )}
      <form
        key={mode}
        onSubmit={submit}
        aria-labelledby="staff-auth-title"
        aria-busy={busy}
        aria-describedby={error ? "staff-auth-error" : undefined}
        className="mt-6"
      >
        <fieldset
          disabled={busy}
          className="m-0 grid min-w-0 gap-5 border-0 p-0 disabled:opacity-70"
        >
          <legend className="sr-only">
            {mode === "login"
              ? "Staff sign in details"
              : "Password change details"}
          </legend>
          {mode === "login" ? (
            <>
              <div className="min-w-0">
                <label
                  htmlFor="staff-email"
                  className="text-xs font-semibold text-slate-600"
                >
                  Staff email
                </label>
                <input
                  id="staff-email"
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
                id="staff-password"
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
                id="staff-currentPassword"
                name="currentPassword"
                label="Current password"
                required
                maxLength={128}
                autoComplete="current-password"
                disabled={busy}
              />
              <LoginPasswordInput
                id="staff-newPassword"
                name="newPassword"
                label="New password"
                required
                minLength={16}
                maxLength={128}
                autoComplete="new-password"
                disabled={busy}
              />
              <LoginPasswordInput
                id="staff-confirmPassword"
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
        Staff accounts are provided by your hospital administrator.
      </p>
    </LoginFrame>
  );
}
