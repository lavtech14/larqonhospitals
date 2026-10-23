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

  const primaryButton =
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50";
  const secondaryButton =
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50";
  const inputClass =
    "mt-2 block min-h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-teal-700 focus:outline-2 focus:outline-offset-2 focus:outline-teal-700 disabled:bg-slate-50 disabled:opacity-60";

  if (!canRead)
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-slate-950">
          Access unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          You do not have permission to view patient demographics.
        </p>
      </section>
    );

  if (!patient)
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <Link
          href="/patients"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-teal-800"
        >
          <span aria-hidden="true">←</span>Back to patients
        </Link>
        {loadError ? (
          <>
            <p role="alert" className="mt-4 text-sm leading-6 text-red-700">
              {loadError}
            </p>
            <button
              type="button"
              className={`${secondaryButton} mt-4`}
              onClick={loadLatest}
            >
              Try again
            </button>
          </>
        ) : (
          <p role="status" className="mt-5 text-sm text-slate-500">
            Loading patient details…
          </p>
        )}
      </section>
    );

  const record = patient;
  const groups: {
    title: string;
    names: FieldName[];
    extra?: "sex" | "owner";
  }[] = [
    {
      title: "Patient identity",
      names: ["fullName", "dateOfBirth"],
      extra: "sex",
    },
    {
      title: "Contact information",
      names: ["phone", "phoneContactName", "contactEmail"],
      extra: "owner",
    },
    {
      title: "Address",
      names: [
        "addressLine1",
        "addressLine2",
        "city",
        "district",
        "state",
        "postalCode",
        "countryCode",
      ],
    },
    {
      title: "Guardian details",
      names: ["guardianName", "guardianRelationship", "guardianPhone"],
    },
    {
      title: "Emergency contact",
      names: [
        "emergencyContactName",
        "emergencyContactRelationship",
        "emergencyContactPhone",
      ],
    },
  ];

  function renderField(name: FieldName) {
    const field = fields.find((item) => item.name === name)!;
    const value =
      field.name === "dateOfBirth"
        ? (record.dateOfBirth?.slice(0, 10) ?? "")
        : (record[field.name] ?? "");
    return editing ? (
      <div key={name} className="min-w-0">
        <label
          htmlFor={`edit-${name}`}
          className="text-xs font-semibold text-slate-600"
        >
          {field.label}
          {name === "fullName" && (
            <span aria-hidden="true" className="ml-1 text-red-700">
              *
            </span>
          )}
        </label>
        <input
          id={`edit-${name}`}
          name={name}
          type={
            name === "dateOfBirth"
              ? "date"
              : name === "contactEmail"
                ? "email"
                : name.toLowerCase().endsWith("phone")
                  ? "tel"
                  : "text"
          }
          defaultValue={value}
          required={name === "fullName"}
          minLength={name === "fullName" ? 2 : undefined}
          maxLength={field.max}
          autoComplete="off"
          className={inputClass}
        />
      </div>
    ) : (
      <div key={name} className="min-w-0">
        <dt className="text-xs text-slate-500">{field.label}</dt>
        <dd
          className={`mt-2 break-words whitespace-pre-wrap text-sm leading-6 ${value ? "font-medium text-slate-900" : "text-slate-500"}`}
        >
          {value || (name === "dateOfBirth" ? "Not recorded" : "Not provided")}
        </dd>
      </div>
    );
  }

  function renderExtra(extra: "sex" | "owner") {
    const sex = extra === "sex";
    const label = sex ? "Administrative sex" : "Primary phone belongs to";
    const name = sex ? "administrativeSex" : "phoneOwner";
    const id = sex ? "edit-administrative-sex" : "edit-phone-owner";
    const value = sex ? record.administrativeSex : record.phoneOwner;
    const options = sex
      ? [
          { value: "UNKNOWN", label: "Unknown / not recorded" },
          { value: "MALE", label: "Male" },
          { value: "FEMALE", label: "Female" },
          { value: "OTHER", label: "Other" },
        ]
      : [
          { value: "UNKNOWN", label: "Unknown / not recorded" },
          { value: "PATIENT", label: "Patient" },
          { value: "GUARDIAN", label: "Guardian" },
          { value: "OTHER", label: "Other contact" },
        ];
    return editing ? (
      <div>
        <label htmlFor={id} className="text-xs font-semibold text-slate-600">
          {label}
        </label>
        <select id={id} name={name} defaultValue={value} className={inputClass}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    ) : (
      <div>
        <dt className="text-xs text-slate-500">{label}</dt>
        <dd className="mt-2 text-sm font-medium leading-6 text-slate-900">
          {options.find((option) => option.value === value)?.label}
        </dd>
      </div>
    );
  }

  function renderGroups() {
    const Grid = editing ? "div" : "dl";
    return (
      <div className="min-w-0 space-y-7 p-5 sm:p-6">
        {groups.map((group, index) => (
          <section
            key={group.title}
            aria-labelledby={`patient-group-${index}`}
            className={index ? "border-t border-slate-100 pt-6" : ""}
          >
            <h3
              id={`patient-group-${index}`}
              className="text-sm font-semibold text-slate-900"
            >
              {group.title}
            </h3>
            <Grid className="mt-5 grid min-w-0 gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
              {group.names.map(renderField)}
              {group.extra && renderExtra(group.extra)}
            </Grid>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <Link
        href="/patients"
        className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-teal-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
      >
        <span aria-hidden="true">←</span>Back to patients
      </Link>
      <header className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <div className="flex min-w-0 items-center gap-4">
          <span
            aria-hidden="true"
            className="hidden size-16 shrink-0 place-items-center rounded-2xl bg-teal-50 text-2xl font-semibold text-teal-800 sm:grid"
          >
            {record.fullName.trim().charAt(0).toUpperCase() || "P"}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.16em] text-teal-800">
              PATIENT RECORD
            </p>
            <h1 className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              {record.fullName}
            </h1>
            <p className="mt-2 break-words text-xs font-semibold text-slate-500">
              MRN: {record.mrn}
            </p>
          </div>
        </div>
        {canEdit && !editing && (
          <button
            type="button"
            className={primaryButton}
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
        {editing && (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">
            Editing patient details
          </span>
        )}
      </header>
      {message && (
        <p
          role="status"
          className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm leading-6 text-teal-950"
        >
          {message}
        </p>
      )}
      <section
        aria-labelledby="demographics-title"
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
          <div>
            <h2
              id="demographics-title"
              className="text-lg font-semibold tracking-tight text-slate-950"
            >
              {editing ? "Edit patient information" : "Patient information"}
            </h2>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {editing
                ? "Update known details. Full name is required."
                : "Demographic, contact and address details recorded for this patient."}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs tabular-nums text-slate-600">
            Version {record.version}
          </span>
        </div>
        {editing ? (
          <form key={record.version} onSubmit={save} aria-busy={saving}>
            <fieldset disabled={saving} className="m-0 min-w-0 border-0 p-0">
              <legend className="sr-only">Edit patient demographics</legend>
              {renderGroups()}
              {saveError && (
                <p
                  role="alert"
                  className="mx-5 mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800 sm:mx-6"
                >
                  {saveError}
                </p>
              )}
              {conflict && (
                <div className="mx-5 mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 sm:mx-6">
                  <h3 className="text-sm font-semibold text-amber-950">
                    This record has changed
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-amber-900">
                    Your edits remain in this form. Review or copy them before
                    loading the latest record. Saving is paused.
                  </p>
                  <button
                    type="button"
                    className={`${secondaryButton} mt-4`}
                    onClick={loadLatest}
                  >
                    Discard edits and load latest
                  </button>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-6">
                <p className="text-xs leading-5 text-slate-500">
                  Changes are checked against the latest record version.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={secondaryButton}
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
                  <button
                    type="submit"
                    className={primaryButton}
                    disabled={saving || conflict}
                  >
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </div>
            </fieldset>
          </form>
        ) : (
          renderGroups()
        )}
      </section>
      {!editing && (
        <PatientPortalAccount
          key={`${record.id}:${record.version}`}
          patientId={record.id}
          patientName={record.fullName}
          patientMrn={record.mrn}
          patientVersion={record.version}
          onBusyChange={setPortalBusy}
          onReloadPatient={loadLatest}
        />
      )}
    </div>
  );
}
