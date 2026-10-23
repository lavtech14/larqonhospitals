"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";

import { useStaffUser } from "@/components/auth/StaffSessionGate";
import { ApiError, apiRequest } from "@/lib/api";

interface PatientAccount {
  id: string;
  patientId: string;
  email: string;
  isActive: boolean;
  mustChangePassword: boolean;
  version: number;
  createdAt: string;
}

interface AccountResponse {
  account: PatientAccount | null;
}

interface Props {
  patientId: string;
  patientName: string;
  patientMrn: string;
  patientVersion: number;
  onBusyChange: (busy: boolean) => void;
  onReloadPatient: () => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The request could not be completed.";
}

function isPatientVersionConflict(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 409) {
    return false;
  }

  const data = error.data;

  return (
    data !== null &&
    typeof data === "object" &&
    "code" in data &&
    data.code === "PATIENT_VERSION_CONFLICT"
  );
}

export default function PatientPortalAccount({
  patientId,
  patientName,
  patientMrn,
  patientVersion,
  onBusyChange,
  onReloadPatient,
}: Props) {
  const user = useStaffUser();

  const allowed =
    user.permissions?.includes("patients.account.manage") &&
    user.permissions?.includes("patients.demographics.read");

  const [account, setAccount] = useState<PatientAccount | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [versionConflict, setVersionConflict] = useState(false);

  const requestLock = useRef(false);

  const endpoint = `/patients/${encodeURIComponent(patientId)}/account`;

  async function checkAccount() {
    if (requestLock.current || !allowed) return;

    requestLock.current = true;
    setBusy(true);
    onBusyChange(true);
    setError("");
    setNotice("");

    try {
      const response = await apiRequest<AccountResponse>(endpoint);

      setAccount(response.account);
      setChecked(true);
    } catch (error) {
      // A failed lookup must not be interpreted as "no account".
      setChecked(false);
      setError(errorMessage(error));
    } finally {
      requestLock.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      requestLock.current ||
      !allowed ||
      !checked ||
      account ||
      versionConflict
    ) {
      return;
    }

    const form = event.currentTarget;
    const values = new FormData(form);

    if (values.get("identityConfirmed") !== "on") {
      setError("Confirm the patient's identity before continuing.");
      return;
    }

    requestLock.current = true;
    setBusy(true);
    onBusyChange(true);
    setError("");
    setNotice("");

    try {
      const response = await apiRequest<AccountResponse>(endpoint, {
        method: "POST",
        body: JSON.stringify({
          email: String(values.get("email") ?? "")
            .trim()
            .toLowerCase(),
          temporaryPassword: String(values.get("temporaryPassword") ?? ""),
          expectedPatientVersion: patientVersion,
          identityConfirmed: true,
        }),
      });

      if (!response.account) {
        throw new Error(
          "The server did not return an account. Check account status.",
        );
      }

      form.reset();
      setAccount(response.account);
      setChecked(true);

      setNotice(
        "Portal account created. The patient must change the temporary password at first sign-in.",
      );
    } catch (error) {
      setChecked(false);
      setVersionConflict(isPatientVersionConflict(error));

      setError(
        isPatientVersionConflict(error)
          ? errorMessage(error)
          : `${errorMessage(error)} Check account status before submitting another creation request.`,
      );
    } finally {
      requestLock.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }

  const primaryButton =
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50";
  const secondaryButton =
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50";
  const inputClass =
    "mt-2 block min-h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-teal-700 focus:outline-2 focus:outline-offset-2 focus:outline-teal-700 disabled:bg-slate-50 disabled:opacity-60";

  if (!allowed) return null;

  return (
    <section
      aria-labelledby="patient-portal-title"
      aria-busy={busy}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.16em] text-teal-800">
            PATIENT PORTAL
          </p>
          <h2
            id="patient-portal-title"
            className="mt-2 text-lg font-semibold tracking-tight text-slate-950"
          >
            Portal account
          </h2>
          <p className="mt-2 break-words text-sm leading-6 text-slate-500">
            Optional sign-in access for {patientName}.
          </p>
        </div>
        <button
          type="button"
          className={secondaryButton}
          disabled={busy}
          onClick={() => void checkAccount()}
        >
          {busy
            ? "Please wait…"
            : checked
              ? "Refresh account status"
              : "Check account status"}
        </button>
      </div>
      <div className="space-y-5 p-5 sm:p-6">
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm leading-6 text-teal-950"
          >
            {notice}
          </p>
        )}
        {busy && (
          <p role="status" className="text-sm text-slate-500">
            Checking account request…
          </p>
        )}
        {versionConflict && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
            <h3 className="text-sm font-semibold text-amber-950">
              Verify the latest patient record
            </h3>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              Reload the patient details and check their identity again before
              creating an account.
            </p>
            <button
              type="button"
              className={`${secondaryButton} mt-4`}
              disabled={busy}
              onClick={onReloadPatient}
            >
              Reload patient details
            </button>
          </div>
        )}
        {!checked && !busy && !versionConflict && (
          <div className="rounded-xl border border-dashed border-slate-300 px-5 py-7">
            <h3 className="text-sm font-semibold text-slate-900">
              Check before creating an account
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Select Check account status to find out whether this patient
              already has portal access.
            </p>
          </div>
        )}
        {checked && account && (
          <div>
            <div className="mb-5 flex items-center gap-2">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${account.isActive ? "bg-teal-50 text-teal-900" : "bg-slate-100 text-slate-600"}`}
              >
                {account.isActive ? "Active account" : "Inactive account"}
              </span>
            </div>
            <dl className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              <div className="min-w-0">
                <dt className="text-xs text-slate-500">Login email</dt>
                <dd className="mt-2 break-all text-sm font-medium text-slate-900">
                  {account.email}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Account status</dt>
                <dd className="mt-2 text-sm font-medium text-slate-900">
                  {account.isActive ? "Active" : "Inactive"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Password status</dt>
                <dd className="mt-2 text-sm font-medium leading-6 text-slate-900">
                  {account.mustChangePassword
                    ? "First-login password change required"
                    : "Initial password changed"}
                </dd>
              </div>
            </dl>
          </div>
        )}
        {checked && !account && !versionConflict && (
          <form onSubmit={createAccount}>
            <fieldset disabled={busy} className="m-0 min-w-0 border-0 p-0">
              <legend className="text-base font-semibold text-slate-900">
                Create patient portal account
              </legend>
              <p className="mt-3 break-words rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                <strong>{patientName}</strong>
                <span className="ml-2 text-xs text-slate-500">
                  MRN: {patientMrn}
                </span>
              </p>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <label className="min-w-0 text-xs font-semibold text-slate-600">
                  Portal login email{" "}
                  <span aria-hidden="true" className="text-red-700">
                    *
                  </span>
                  <input
                    name="email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="off"
                    className={inputClass}
                  />
                </label>
                <label className="min-w-0 text-xs font-semibold text-slate-600">
                  Temporary password{" "}
                  <span aria-hidden="true" className="text-red-700">
                    *
                  </span>
                  <input
                    name="temporaryPassword"
                    type="password"
                    required
                    minLength={16}
                    maxLength={128}
                    autoComplete="new-password"
                    aria-describedby="patient-portal-password-help"
                    className={inputClass}
                  />
                </label>
              </div>
              <p
                id="patient-portal-password-help"
                className="mt-3 text-xs leading-5 text-slate-500"
              >
                Use 16–128 characters. Share the temporary password directly
                with the patient; no email is sent. The patient must change it
                at first sign-in.
              </p>
              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-700">
                <input
                  name="identityConfirmed"
                  type="checkbox"
                  required
                  className="mt-1 size-4 shrink-0 accent-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                />
                <span>
                  I checked this patient’s identity and confirmed the login
                  email with them.
                </span>
              </label>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Contact details and guardian details do not automatically
                authorize portal access.
              </p>
              <button
                type="submit"
                className={`${primaryButton} mt-5`}
                disabled={busy}
              >
                {busy ? "Creating account…" : "Create portal account"}
              </button>
            </fieldset>
          </form>
        )}
        <p className="border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
          Patient sign-in:{" "}
          <span className="font-semibold text-slate-700">/patient/login</span>.
          Assigned online appointments can be joined from the patient portal
          during the allowed joining window.
        </p>
      </div>
    </section>
  );
}
