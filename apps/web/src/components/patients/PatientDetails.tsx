"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, apiRequest } from "@/lib/api";
import { useStaffUser } from "@/components/auth/StaffSessionGate";
import PatientPortalAccount from "@/components/patients/PatientPortalAccount";

const fields = [
  { name: "fullName", label: "Full name", max: 100 },
  { name: "phone", label: "Phone number", max: 16 },
  { name: "addressLine1", label: "Address line 1", max: 200 },
  { name: "addressLine2", label: "Address line 2", max: 200 },
  { name: "city", label: "City / town", max: 100 },
  { name: "district", label: "District", max: 100 },
  { name: "state", label: "State / region", max: 100 },
  { name: "postalCode", label: "Postal code", max: 20 },
  { name: "countryCode", label: "Country code", max: 2 },
  { name: "dateOfBirth", label: "Date of birth", max: 10 },
  { name: "phoneContactName", label: "Primary phone contact name", max: 100 },
  { name: "contactEmail", label: "Contact email", max: 254 },
  { name: "guardianName", label: "Guardian name", max: 100 },
  { name: "guardianRelationship", label: "Guardian relationship", max: 50 },
  { name: "guardianPhone", label: "Guardian phone", max: 16 },
  { name: "emergencyContactName", label: "Emergency contact name", max: 100 },
  {
    name: "emergencyContactRelationship",
    label: "Emergency contact relationship",
    max: 50,
  },
  { name: "emergencyContactPhone", label: "Emergency contact phone", max: 16 },
] as const;

type FieldName = (typeof fields)[number]["name"];

type Patient = {
  id: string;
  mrn: string;
  fullName: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  administrativeSex: "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
  phoneOwner: "PATIENT" | "GUARDIAN" | "OTHER" | "UNKNOWN";
} & Record<Exclude<FieldName, "fullName">, string | null>;

export default function PatientDetails({ patientId }: { patientId: string }) {
  const user = useStaffUser();
  const canRead =
    user.permissions?.includes("patients.demographics.read") ?? false;
  const canEdit =
    user.permissions?.includes("patients.demographics.update") ?? false;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [message, setMessage] = useState("");
  const [portalBusy, setPortalBusy] = useState(false);

  useEffect(() => {
    if (!canRead) return;

    let active = true;
    const controller = new AbortController();

    async function load() {
      try {
        const result = await apiRequest<{ patient: Patient }>(
          `/patients/${encodeURIComponent(patientId)}`,
          { signal: controller.signal },
        );

        if (active) {
          setPatient(result.patient);
          setLoadError("");
        }
      } catch (error) {
        if (active) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load this patient.",
          );
        }
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [patientId, canRead, reload]);

  function loadLatest() {
    setPatient(null);
    setLoadError("");
    setSaveError("");
    setConflict(false);
    setMessage("");
    setEditing(false);
    setReload((current) => current + 1);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!patient || !canEdit || saving || conflict) return;

    const formData = new FormData(event.currentTarget);
    const changes: Record<string, string | null> = {};

    for (const field of fields) {
      let value = String(formData.get(field.name) ?? "").trim();

      if (field.name === "countryCode") {
        value = value.toUpperCase();
      }

      const normalized = field.name === "fullName" ? value : value || null;

      const existingValue =
        field.name === "dateOfBirth"
          ? (patient.dateOfBirth?.slice(0, 10) ?? null)
          : patient[field.name];

      if (normalized !== existingValue) {
        changes[field.name] = normalized;
      }
    }

    const administrativeSex = String(
      formData.get("administrativeSex") ?? patient.administrativeSex,
    );

    if (administrativeSex !== patient.administrativeSex) {
      changes.administrativeSex = administrativeSex;
    }
    const phoneOwner = String(formData.get("phoneOwner") ?? patient.phoneOwner);

    if (phoneOwner !== patient.phoneOwner) {
      changes.phoneOwner = phoneOwner;
    }
    if (Object.keys(changes).length === 0) {
      setEditing(false);
      setMessage("No changes to save.");
      return;
    }

    setSaving(true);
    setSaveError("");
    setMessage("");

    try {
      const result = await apiRequest<{ patient: Patient }>(
        `/patients/${encodeURIComponent(patientId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            ...changes,
            expectedVersion: patient.version,
          }),
        },
      );

      setPatient(result.patient);
      setEditing(false);
      setConflict(false);
      setMessage("Patient details updated successfully.");
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Unable to save changes.",
      );

      if (error instanceof ApiError && error.status === 409) {
        setConflict(true);
      }
    } finally {
      setSaving(false);
    }
  }

  if (!canRead) {
    return (
      <section className="panel registration-panel">
        <h1>Access unavailable</h1>
        <p className="muted">
          You do not have permission to view patient demographics.
        </p>
      </section>
    );
  }

  if (!patient) {
    return (
      <section className="panel registration-panel">
        <Link className="text-link" href="/patients">
          Back to patients
        </Link>

        {loadError ? (
          <>
            <p className="form-error" role="alert">
              {loadError}
            </p>
            <button
              className="secondary-button"
              type="button"
              onClick={loadLatest}
            >
              Try again
            </button>
          </>
        ) : (
          <p className="muted" role="status">
            Loading patient details...
          </p>
        )}
      </section>
    );
  }

  return (
    <>
      <Link className="text-link" href="/patients">
        Back to patients
      </Link>

      <section className="page-heading patient-detail-heading">
        <div>
          <p className="eyebrow">PATIENT DEMOGRAPHICS</p>
          <h1>{patient.fullName}</h1>
          <p className="record-id">MRN: {patient.mrn}</p>
        </div>

        {canEdit && !editing && (
          <button
            className="primary-button"
            type="button"
            disabled={portalBusy}
            onClick={() => {
              setEditing(true);
              setSaveError("");
              setConflict(false);
              setMessage("");
            }}
          >
            Edit details
          </button>
        )}
      </section>

      <p className="success-message" role="status">
        {message}
      </p>

      <section className="panel registration-panel">
        {editing ? (
          <form key={patient.version} onSubmit={save} aria-busy={saving}>
            <fieldset className="patient-fields" disabled={saving}>
              <legend className="sr-only">Edit patient demographics</legend>

              <div className="form-grid">
                {fields.map((field) => (
                  <div className="form-field" key={field.name}>
                    <label htmlFor={`edit-${field.name}`}>
                      {field.label}
                      {field.name === "fullName" ? " *" : ""}
                    </label>
                    <input
                      id={`edit-${field.name}`}
                      name={field.name}
                      type={
                        field.name === "dateOfBirth"
                          ? "date"
                          : field.name === "contactEmail"
                            ? "email"
                            : field.name.toLowerCase().endsWith("phone")
                              ? "tel"
                              : "text"
                      }
                      defaultValue={
                        field.name === "dateOfBirth"
                          ? (patient.dateOfBirth?.slice(0, 10) ?? "")
                          : (patient[field.name] ?? "")
                      }
                      required={field.name === "fullName"}
                      minLength={field.name === "fullName" ? 2 : undefined}
                      maxLength={field.max}
                      autoComplete="off"
                    />
                  </div>
                ))}
                <div className="form-field">
                  <label htmlFor="edit-phone-owner">
                    Primary phone belongs to
                  </label>

                  <select
                    id="edit-phone-owner"
                    name="phoneOwner"
                    defaultValue={patient.phoneOwner}
                  >
                    <option value="UNKNOWN">Unknown / not recorded</option>
                    <option value="PATIENT">Patient</option>
                    <option value="GUARDIAN">Guardian</option>
                    <option value="OTHER">Other contact</option>
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="edit-administrative-sex">
                    Administrative sex
                  </label>

                  <select
                    id="edit-administrative-sex"
                    name="administrativeSex"
                    defaultValue={patient.administrativeSex}
                  >
                    <option value="UNKNOWN">Unknown / not recorded</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <p className="form-error" role="alert">
                {saveError}
              </p>

              {conflict && (
                <div className="conflict-notice">
                  <p>
                    Your edits remain in this form. Review or copy them before
                    loading the latest record. Saving is paused.
                  </p>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={loadLatest}
                  >
                    Discard edits and load latest
                  </button>
                </div>
              )}

              <div className="form-actions">
                <button
                  className="primary-button"
                  type="submit"
                  disabled={conflict}
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>

                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    if (conflict) {
                      loadLatest();
                    } else {
                      setEditing(false);
                      setSaveError("");
                    }
                  }}
                >
                  {conflict ? "Discard edits and reload" : "Cancel"}
                </button>
              </div>
            </fieldset>
          </form>
        ) : (
          <>
            <dl className="patient-details-grid">
              {fields.map((field) => (
                <div key={field.name}>
                  <dt>{field.label}</dt>
                  <dd>
                    {field.name === "dateOfBirth"
                      ? patient.dateOfBirth?.slice(0, 10) || "Not recorded"
                      : patient[field.name] || "Not provided"}
                  </dd>
                </div>
              ))}
              <div>
                <dt>Administrative sex</dt>
                <dd>
                  {patient.administrativeSex === "UNKNOWN"
                    ? "Unknown / not recorded"
                    : patient.administrativeSex === "MALE"
                      ? "Male"
                      : patient.administrativeSex === "FEMALE"
                        ? "Female"
                        : "Other"}
                </dd>
              </div>
              <div>
                <dt>Primary phone belongs to</dt>
                <dd>
                  {
                    {
                      PATIENT: "Patient",
                      GUARDIAN: "Guardian",
                      OTHER: "Other contact",
                      UNKNOWN: "Unknown / not recorded",
                    }[patient.phoneOwner]
                  }
                </dd>
              </div>
            </dl>

            <p className="preview-note">Record version {patient.version}</p>
          </>
        )}
      </section>
      {!editing && (
        <PatientPortalAccount
          key={`${patient.id}:${patient.version}`}
          patientId={patient.id}
          patientName={patient.fullName}
          patientMrn={patient.mrn}
          patientVersion={patient.version}
          onBusyChange={setPortalBusy}
          onReloadPatient={loadLatest}
        />
      )}
    </>
  );
}
