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

      <p className="preview-note">
        Patient sign-in is available at /patient/login. Online consultation
        joining is not enabled yet.
      </p>;
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

  if (!allowed) return null;

  return (
    <section
      className="panel patient-portal-panel"
      aria-labelledby="patient-portal-title"
      aria-busy={busy}
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Patient portal</p>
          <h2 id="patient-portal-title">Portal account</h2>
          <p className="muted">Optional login account for {patientName}.</p>
        </div>

        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={() => void checkAccount()}
        >
          {busy
            ? "Please wait..."
            : checked
              ? "Refresh account status"
              : "Check account status"}
        </button>
      </div>

      <div aria-live="polite">
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {notice && <p className="success-message">{notice}</p>}
      </div>

      {versionConflict && (
        <div className="conflict-notice">
          <p>
            Reload the patient details and check their identity again before
            creating an account.
          </p>

          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={onReloadPatient}
          >
            Reload patient details
          </button>
        </div>
      )}

      {!checked && !busy && !versionConflict && (
        <p className="muted">
          Check whether this patient already has a portal account.
        </p>
      )}

      {checked && account && (
        <dl className="patient-details-grid">
          <div>
            <dt>Login email</dt>
            <dd>{account.email}</dd>
          </div>
          <div>
            <dt>Account status</dt>
            <dd>{account.isActive ? "Active" : "Inactive"}</dd>
          </div>
          <div>
            <dt>Password status</dt>
            <dd>
              {account.mustChangePassword
                ? "First-login password change required"
                : "Initial password changed"}
            </dd>
          </div>
        </dl>
      )}

      {checked && !account && !versionConflict && (
        <form onSubmit={createAccount}>
          <fieldset className="patient-fields" disabled={busy}>
            <legend>Create patient portal account</legend>

            <p>
              Patient: <strong>{patientName}</strong>
              {" · "}
              MRN: <strong>{patientMrn}</strong>
            </p>

            <div className="form-grid">
              <label className="form-field">
                <span>Portal login email *</span>
                <input
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="off"
                />
              </label>

              <label className="form-field">
                <span>Temporary password *</span>
                <input
                  name="temporaryPassword"
                  type="password"
                  required
                  minLength={16}
                  maxLength={128}
                  autoComplete="new-password"
                  aria-describedby="patient-portal-password-help"
                />
              </label>
            </div>

            <p id="patient-portal-password-help" className="muted">
              Use 16–128 characters, matching the current account API. Share it
              directly with the patient; no email is sent.
            </p>

            <label className="patient-portal-confirm">
              <input name="identityConfirmed" type="checkbox" required />
              <span>
                I checked this patients identity and confirmed the login email
                with them.
              </span>
            </label>

            <p className="muted">
              Contact details and guardian details do not automatically
              authorize portal access.
            </p>

            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? "Creating account..." : "Create portal account"}
            </button>
          </fieldset>
        </form>
      )}

      <p className="preview-note">
        Account provisioning is available. Patient sign-in and online
        consultation joining are not enabled yet.
      </p>
    </section>
  );
}
