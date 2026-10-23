"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PatientPortalFrame from "./PatientPortalFrame";

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

export default function PatientPortalHome() {
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

  const primaryButton =
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-800 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50";
  const secondaryButton =
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-wait disabled:opacity-60";

  if (session.status === "loading")
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-50 p-5">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-slate-900">
            Larqon Hospitals
          </p>
          <p role="status" className="mt-3 text-sm leading-6 text-slate-500">
            Checking patient session…
          </p>
        </section>
      </main>
    );

  if (session.status === "error")
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-50 p-5">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Unable to load your portal
          </h1>
          <p role="alert" className="mt-4 text-sm leading-6 text-red-700">
            {session.message}
          </p>
          <button
            type="button"
            className={`${primaryButton} mt-5`}
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

  return (
    <PatientPortalFrame
      current="home"
      actions={
        <button
          type="button"
          className={secondaryButton}
          disabled={loggingOut}
          onClick={() => void logout()}
        >
          {loggingOut ? "Signing out…" : "Sign out"}
        </button>
      }
    >
      {logoutError && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
        >
          {logoutError}
        </p>
      )}
      <section
        aria-labelledby="portal-title"
        className="relative overflow-hidden rounded-3xl bg-slate-900 p-6 text-white sm:p-9"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-16 size-72 rounded-full border-[40px] border-white/5"
        />
        <div className="relative max-w-2xl">
          <p className="text-[10px] font-bold tracking-[0.18em] text-teal-200">
            YOUR HOSPITAL ACCOUNT
          </p>
          <h1
            id="portal-title"
            className="mt-4 break-words text-2xl font-semibold tracking-tight text-white sm:text-4xl"
          >
            Welcome, {session.user.fullName}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
            Review appointments linked to your hospital record and open your
            scheduled online consultations.
          </p>
          <Link
            href="/patient/appointments"
            className="mt-6 inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-white px-5 text-sm font-semibold text-slate-950 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            My appointments <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
      <section
        aria-labelledby="account-title"
        className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
      >
        <h2
          id="account-title"
          className="text-lg font-semibold tracking-tight text-slate-950"
        >
          Your account
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Use your medical record number when contacting hospital reception.
        </p>
        <dl className="mt-5 grid gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-xs text-slate-500">Hospital MRN</dt>
            <dd className="mt-2 break-words text-sm font-semibold text-teal-900">
              {session.user.mrn}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-slate-500">Login email</dt>
            <dd className="mt-2 break-all text-sm font-medium text-slate-900">
              {session.user.email}
            </dd>
          </div>
        </dl>
      </section>
      <div className="grid gap-5 sm:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-950">
            Joining an online consultation
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            Open My appointments, find your online visit and select Join
            consultation. Joining opens 10 minutes before the appointment and
            closes at its scheduled end.
          </p>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-950">
            Need to change a visit?
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            Contact hospital reception to book, change or cancel an appointment,
            or to request help with your account.
          </p>
        </section>
      </div>
    </PatientPortalFrame>
  );
}
