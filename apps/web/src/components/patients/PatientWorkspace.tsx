"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { useStaffUser } from "@/components/auth/StaffSessionGate";
import Link from "next/link";
import {
  clearRegistrationKey,
  getRegistrationKey,
} from "@/lib/registration-key";
import { ApiError, apiRequest } from "@/lib/api";

type DuplicateCandidate = {
  id: string;
  mrn: string;
  fullName: string;
  phone: string | null;
  city: string | null;
};

function getDuplicateCandidates(error: unknown): DuplicateCandidate[] | null {
  if (!(error instanceof ApiError) || error.status !== 409) {
    return null;
  }

  const data = error.data;

  if (
    !data ||
    typeof data !== "object" ||
    !("code" in data) ||
    data.code !== "POSSIBLE_DUPLICATE" ||
    !("candidates" in data) ||
    !Array.isArray(data.candidates)
  ) {
    return null;
  }

  const valid = data.candidates.every(
    (candidate: unknown): candidate is DuplicateCandidate =>
      candidate !== null &&
      typeof candidate === "object" &&
      "id" in candidate &&
      typeof candidate.id === "string" &&
      "mrn" in candidate &&
      typeof candidate.mrn === "string" &&
      "fullName" in candidate &&
      typeof candidate.fullName === "string" &&
      "phone" in candidate &&
      (candidate.phone === null || typeof candidate.phone === "string") &&
      "city" in candidate &&
      (candidate.city === null || typeof candidate.city === "string"),
  );

  return valid && data.candidates.length > 0 ? data.candidates : null;
}

type Patient = {
  id: string;
  mrn: string;
  fullName: string;
  phone: string | null;
  city: string | null;
  createdAt: string;
};

type PatientPage = {
  items: Patient[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type LoadState = {
  key: string;
  data: PatientPage | null;
  error: string;
};

const registrationFields = [
  { name: "fullName", label: "Full name", maxLength: 100, required: true },
  { name: "phone", label: "Phone number", maxLength: 16, required: false },
  {
    name: "addressLine1",
    label: "Address line 1",
    maxLength: 200,
    required: false,
  },
  {
    name: "addressLine2",
    label: "Address line 2",
    maxLength: 200,
    required: false,
  },
  { name: "city", label: "City / town", maxLength: 100, required: false },
  { name: "district", label: "District", maxLength: 100, required: false },
  { name: "state", label: "State / region", maxLength: 100, required: false },
  { name: "postalCode", label: "Postal code", maxLength: 20, required: false },
  { name: "countryCode", label: "Country code", maxLength: 2, required: false },
  {
    name: "dateOfBirth",
    label: "Date of birth",
    maxLength: 10,
    required: false,
  },
  {
    name: "phoneContactName",
    label: "Primary phone contact name",
    maxLength: 100,
    required: false,
  },
  {
    name: "contactEmail",
    label: "Contact email",
    maxLength: 254,
    required: false,
  },
  {
    name: "guardianName",
    label: "Guardian name",
    maxLength: 100,
    required: false,
  },
  {
    name: "guardianRelationship",
    label: "Guardian relationship",
    maxLength: 50,
    required: false,
  },
  {
    name: "guardianPhone",
    label: "Guardian phone",
    maxLength: 16,
    required: false,
  },
  {
    name: "emergencyContactName",
    label: "Emergency contact name",
    maxLength: 100,
    required: false,
  },
  {
    name: "emergencyContactRelationship",
    label: "Emergency contact relationship",
    maxLength: 50,
    required: false,
  },
  {
    name: "emergencyContactPhone",
    label: "Emergency contact phone",
    maxLength: 16,
    required: false,
  },
];

export default function PatientWorkspace() {
  const user = useStaffUser();

  const canRead =
    user.permissions?.includes("patients.demographics.read") ?? false;

  const canCreate =
    user.permissions?.includes("patients.demographics.create") ?? false;

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<LoadState | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");

  const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(
    null,
  );

  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);

  const requestKey = JSON.stringify([page, search, reload]);
  const currentResult = result?.key === requestKey ? result : null;
  const loading = canRead && currentResult === null;
  const data = currentResult?.data;

  useEffect(() => {
    if (!canRead) return;

    const controller = new AbortController();
    let active = true;

    async function loadPatients() {
      const query = new URLSearchParams({
        page: String(page),
        limit: "20",
      });

      if (search) query.set("search", search);

      try {
        const response = await apiRequest<PatientPage>(`/patients?${query}`, {
          signal: controller.signal,
        });

        if (active) {
          setResult({
            key: requestKey,
            data: response,
            error: "",
          });
        }
      } catch (error) {
        if (active) {
          setResult({
            key: requestKey,
            data: null,
            error:
              error instanceof Error
                ? error.message
                : "Unable to load patients.",
          });
        }
      }
    }

    void loadPatients();

    return () => {
      active = false;
      controller.abort();
    };
  }, [canRead, page, search, requestKey]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
    setReload((current) => current + 1);
  }

  async function registerPatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || !canCreate) return;

    const form = event.currentTarget;
    const formData = new FormData(form);

    // Only submit the fields supported by the registration API.
    const payload: Record<string, string | boolean> = {};

    for (const field of registrationFields) {
      const value = String(formData.get(field.name) ?? "").trim();

      if (duplicates && duplicateConfirmed) {
        payload.duplicateReviewConfirmed = true;
      }

      if (value) {
        payload[field.name] =
          field.name === "countryCode" ? value.toUpperCase() : value;
      }
    }
    payload.administrativeSex = String(
      formData.get("administrativeSex") ?? "UNKNOWN",
    );
    payload.phoneOwner = String(formData.get("phoneOwner") ?? "UNKNOWN");
    setSaving(true);
    setFormError("");
    setMessage("");

    try {
      const body = JSON.stringify(payload);
      const requestKey = await getRegistrationKey(user.id, body);

      const response = await apiRequest<{
        patient: Patient;
        replayed: boolean;
      }>("/patients", {
        method: "POST",
        headers: {
          "Idempotency-Key": requestKey,
        },
        body,
      });

      clearRegistrationKey(user.id);

      form.reset();
      setShowForm(false);

      setSearchInput("");
      setSearch("");
      setPage(1);
      setReload((current) => current + 1);
      setDuplicates(null);
      setDuplicateConfirmed(false);

      setMessage(
        `${response.patient.fullName} was registered successfully. MRN: ${response.patient.mrn}`,
      );
    } catch (error) {
      const candidates = getDuplicateCandidates(error);

      if (candidates) {
        setDuplicates(candidates);
        setDuplicateConfirmed(false);
      }
      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to register the patient.",
      );
    } finally {
      setSaving(false);
    }
  }

  const primaryButton =
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50";
  const secondaryButton =
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50";
  const inputClass =
    "mt-2 block min-h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-2 focus:outline-offset-2 focus:outline-teal-700 disabled:cursor-wait disabled:bg-slate-50 disabled:opacity-60";

  function renderField(name: string) {
    const field = registrationFields.find((item) => item.name === name);
    if (!field) return null;
    return (
      <div key={field.name} className="min-w-0">
        <label
          htmlFor={`patient-${field.name}`}
          className="text-xs font-semibold text-slate-600"
        >
          {field.label}
          {field.required && (
            <span className="ml-1 text-red-700" aria-hidden="true">
              *
            </span>
          )}
        </label>
        <input
          id={`patient-${field.name}`}
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
          autoComplete="off"
          required={field.required}
          minLength={field.name === "fullName" ? 2 : undefined}
          maxLength={field.maxLength}
          placeholder={field.name === "countryCode" ? "IN" : undefined}
          className={inputClass}
        />
      </div>
    );
  }

  if (!canRead) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-slate-950">
          Patient directory access unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Your account does not have permission to view this directory.
        </p>
      </section>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <header
        className="flex flex-wrap items-end justify-between gap-5"
        aria-labelledby="patients-title"
      >
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold tracking-[0.18em] text-teal-800">
            PATIENT MANAGEMENT
          </p>
          <h1
            id="patients-title"
            className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl"
          >
            Patients
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Find existing patient records or register a new patient. Search
            before creating a record.
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            className={showForm ? secondaryButton : primaryButton}
            disabled={saving}
            aria-expanded={showForm}
            aria-controls="registration-panel"
            onClick={() => {
              setShowForm((current) => !current);
              setFormError("");
            }}
          >
            {!showForm && (
              <span className="text-lg leading-none" aria-hidden="true">
                +
              </span>
            )}
            {showForm ? "Close registration" : "Register patient"}
          </button>
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

      {showForm && canCreate && (
        <section
          id="registration-panel"
          aria-labelledby="registration-title"
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
            <div>
              <p className="text-[10px] font-bold tracking-[0.16em] text-teal-800">
                NEW PATIENT RECORD
              </p>
              <h2
                id="registration-title"
                className="mt-2 text-xl font-semibold tracking-tight text-slate-950"
              >
                Register patient
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Full name is required. Record other details when they are known.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
              <span aria-hidden="true" className="text-red-700">
                *
              </span>{" "}
              Required field
            </span>
          </div>
          <form onSubmit={registerPatient} aria-busy={saving}>
            <fieldset disabled={saving} className="m-0 min-w-0 border-0 p-0">
              <legend className="sr-only">Patient registration details</legend>
              <div className="grid min-w-0 gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_240px]">
                <div
                  className="min-w-0 space-y-7"
                  onChange={() => {
                    setDuplicates(null);
                    setDuplicateConfirmed(false);
                    setFormError("");
                  }}
                >
                  <section aria-labelledby="identity-title">
                    <h3
                      id="identity-title"
                      className="text-sm font-semibold text-slate-900"
                    >
                      1. Patient identity
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Use the patient’s full name. Leave unknown optional
                      details unrecorded.
                    </p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      {renderField("fullName")}
                      {renderField("dateOfBirth")}
                      <div>
                        <label
                          htmlFor="patient-administrative-sex"
                          className="text-xs font-semibold text-slate-600"
                        >
                          Administrative sex
                        </label>
                        <select
                          id="patient-administrative-sex"
                          name="administrativeSex"
                          defaultValue="UNKNOWN"
                          className={inputClass}
                        >
                          <option value="UNKNOWN">
                            Unknown / not recorded
                          </option>
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                    </div>
                  </section>
                  <section
                    aria-labelledby="contact-title"
                    className="border-t border-slate-100 pt-6"
                  >
                    <h3
                      id="contact-title"
                      className="text-sm font-semibold text-slate-900"
                    >
                      2. Contact information
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Record who owns the primary phone number.
                    </p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      {renderField("phone")}
                      <div>
                        <label
                          htmlFor="patient-phone-owner"
                          className="text-xs font-semibold text-slate-600"
                        >
                          Primary phone belongs to
                        </label>
                        <select
                          id="patient-phone-owner"
                          name="phoneOwner"
                          defaultValue="UNKNOWN"
                          className={inputClass}
                        >
                          <option value="UNKNOWN">
                            Unknown / not recorded
                          </option>
                          <option value="PATIENT">Patient</option>
                          <option value="GUARDIAN">Guardian</option>
                          <option value="OTHER">Other contact</option>
                        </select>
                      </div>
                      {renderField("phoneContactName")}
                      {renderField("contactEmail")}
                    </div>
                  </section>
                  <section
                    aria-labelledby="address-title"
                    className="border-t border-slate-100 pt-6"
                  >
                    <h3
                      id="address-title"
                      className="text-sm font-semibold text-slate-900"
                    >
                      3. Address
                    </h3>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      {[
                        "addressLine1",
                        "addressLine2",
                        "city",
                        "district",
                        "state",
                        "postalCode",
                        "countryCode",
                      ].map(renderField)}
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      Use a two-letter country code, such as IN for India.
                    </p>
                  </section>
                  <section
                    aria-labelledby="guardian-title"
                    className="border-t border-slate-100 pt-6"
                  >
                    <h3
                      id="guardian-title"
                      className="text-sm font-semibold text-slate-900"
                    >
                      4. Guardian details
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Add these details when a guardian is involved.
                    </p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      {[
                        "guardianName",
                        "guardianRelationship",
                        "guardianPhone",
                      ].map(renderField)}
                    </div>
                  </section>
                  <section
                    aria-labelledby="emergency-title"
                    className="border-t border-slate-100 pt-6"
                  >
                    <h3
                      id="emergency-title"
                      className="text-sm font-semibold text-slate-900"
                    >
                      5. Emergency contact
                    </h3>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      {[
                        "emergencyContactName",
                        "emergencyContactRelationship",
                        "emergencyContactPhone",
                      ].map(renderField)}
                    </div>
                  </section>
                </div>
                <aside
                  aria-label="Registration guidance"
                  className="h-fit rounded-xl bg-slate-50 p-5"
                >
                  <h3 className="text-sm font-semibold text-slate-900">
                    Before you register
                  </h3>
                  <ul className="mt-3 list-disc space-y-3 pl-4 text-xs leading-6 text-slate-600">
                    <li>
                      Search the directory and verify any possible matches.
                    </li>
                    <li>
                      A medical record number is assigned when the record is
                      created.
                    </li>
                    <li>
                      A shared phone number may belong to a guardian or another
                      contact.
                    </li>
                    <li>
                      Patient portal access is managed separately from the
                      patient record.
                    </li>
                  </ul>
                </aside>
              </div>

              {formError && (
                <p
                  role="alert"
                  className="mx-5 mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800 sm:mx-6"
                >
                  {formError}
                </p>
              )}

              {duplicates && (
                <section
                  aria-labelledby="duplicate-title"
                  className="mx-5 mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 sm:mx-6 sm:p-5"
                >
                  <h3
                    id="duplicate-title"
                    className="text-base font-semibold text-amber-950"
                  >
                    Review possible existing patients
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-amber-900">
                    Up to five matches are shown. A shared name or phone number
                    does not prove these records belong to the same person.
                  </p>
                  <ul className="mt-4 grid list-none gap-3 sm:grid-cols-2">
                    {duplicates.map((candidate) => (
                      <li
                        key={candidate.id}
                        className="min-w-0 rounded-xl border border-amber-200 bg-white p-4"
                      >
                        <strong className="block break-words text-sm text-slate-900">
                          {candidate.fullName}
                        </strong>
                        <p className="mt-1 break-words text-xs font-medium text-slate-600">
                          MRN: {candidate.mrn}
                        </p>
                        <p className="mt-2 break-words text-xs leading-5 text-slate-500">
                          {candidate.phone || "Phone not provided"} ·{" "}
                          {candidate.city || "City not provided"}
                        </p>
                        <Link
                          href={`/patients/${candidate.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          prefetch={false}
                          className="mt-3 inline-flex min-h-11 items-center text-xs font-semibold text-teal-800 underline underline-offset-4"
                        >
                          Open record in a new tab{" "}
                          <span aria-hidden="true" className="ml-1">
                            ↗
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm leading-6 text-amber-950">
                    <input
                      type="checkbox"
                      checked={duplicateConfirmed}
                      onChange={(event) =>
                        setDuplicateConfirmed(event.target.checked)
                      }
                      className="mt-1 size-4 shrink-0 accent-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                    />
                    <span>
                      I reviewed the possible matches and verified that this
                      registration is for a different person.
                    </span>
                  </label>
                </section>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-6">
                <p className="text-xs leading-5 text-slate-500">
                  Review the details before saving the patient record.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={primaryButton}
                    disabled={
                      saving || (duplicates !== null && !duplicateConfirmed)
                    }
                  >
                    {saving ? "Registering…" : "Register patient"}
                  </button>
                </div>
              </div>
            </fieldset>
          </form>
        </section>
      )}

      <section
        aria-labelledby="directory-title"
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
          <div>
            <h2
              id="directory-title"
              className="text-lg font-semibold tracking-tight text-slate-950"
            >
              Patient directory
            </h2>
            <p role="status" className="mt-2 text-xs leading-5 text-slate-500">
              {loading
                ? "Loading patients…"
                : data
                  ? `${data.pagination.total} matching patients`
                  : "Patient list unavailable"}
            </p>
          </div>
          <button
            type="button"
            className={secondaryButton}
            disabled={loading}
            onClick={() => setReload((current) => current + 1)}
          >
            Refresh list
          </button>
        </div>
        <form
          className="border-b border-slate-100 p-5 sm:p-6"
          onSubmit={submitSearch}
        >
          <div className="flex flex-wrap items-end gap-3">
            <label
              htmlFor="patient-search"
              className="min-w-0 flex-[1_1_320px] text-xs font-semibold text-slate-600"
            >
              Search by MRN, name or phone
              <input
                id="patient-search"
                type="search"
                maxLength={100}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Enter patient name, MRN or phone"
                className={inputClass}
              />
            </label>
            <button type="submit" className={primaryButton}>
              Search
            </button>
            <button
              type="button"
              className={secondaryButton}
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setPage(1);
                setReload((current) => current + 1);
              }}
            >
              Clear
            </button>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            {search ? (
              <>
                Showing results for{" "}
                <strong className="break-words font-semibold text-slate-700">
                  {search}
                </strong>
                . Select Clear to view all records.
              </>
            ) : (
              "Search runs when you select Search. Open a patient record to review its details."
            )}
          </p>
        </form>

        <div aria-busy={loading}>
          {loading ? (
            <p
              role="status"
              className="px-6 py-12 text-center text-sm text-slate-500"
            >
              Loading patient records…
            </p>
          ) : currentResult?.error ? (
            <div className="px-6 py-12 text-center">
              <p role="alert" className="text-sm leading-6 text-red-700">
                {currentResult.error}
              </p>
              <button
                type="button"
                className={`${secondaryButton} mt-5`}
                onClick={() => setReload((current) => current + 1)}
              >
                Try again
              </button>
            </div>
          ) : data?.items.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <h3 className="text-base font-semibold text-slate-900">
                No matching patients
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Try another search
                {canCreate
                  ? " or use Register patient to create a record."
                  : "."}
              </p>
            </div>
          ) : data ? (
            <>
              <ul
                aria-label="Patient records"
                className="m-0 grid list-none gap-4 bg-slate-50/60 p-4 sm:grid-cols-2 lg:hidden"
              >
                {data.items.map((patient) => (
                  <li
                    key={patient.id}
                    className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <Link
                      href={`/patients/${patient.id}`}
                      prefetch={false}
                      className="inline-flex min-h-11 items-center gap-3 font-semibold text-slate-900 hover:text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                    >
                      <span
                        aria-hidden="true"
                        className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-sm text-teal-800"
                      >
                        {patient.fullName.trim().charAt(0).toUpperCase() || "P"}
                      </span>
                      <span className="min-w-0 break-words">
                        {patient.fullName}
                      </span>
                    </Link>
                    <p className="mt-3 break-words text-xs font-semibold text-teal-800">
                      MRN: {patient.mrn}
                    </p>
                    <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm">
                      <div>
                        <dt className="text-xs text-slate-500">Phone</dt>
                        <dd className="mt-1 break-words text-slate-700">
                          {patient.phone || "Not provided"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">City / town</dt>
                        <dd className="mt-1 break-words text-slate-700">
                          {patient.city || "Not provided"}
                        </dd>
                      </div>
                    </dl>
                    <Link
                      href={`/patients/${patient.id}`}
                      prefetch={false}
                      className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-teal-800 hover:underline"
                    >
                      View patient record <span aria-hidden="true">→</span>
                      <span className="sr-only"> for {patient.fullName}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div
                className="hidden overflow-x-auto lg:block"
                role="region"
                aria-label="Patient directory table"
                tabIndex={0}
              >
                <table className="w-full min-w-[680px] border-collapse text-left">
                  <caption className="sr-only">
                    Patient names, medical record numbers, phone numbers and
                    cities
                  </caption>
                  <thead>
                    <tr>
                      {[
                        "Patient",
                        "Medical record number",
                        "Phone",
                        "City / town",
                        "Record",
                      ].map((title) => (
                        <th
                          key={title}
                          scope="col"
                          className="border-b border-slate-200 bg-slate-50 px-5 py-3.5 text-[11px] font-semibold tracking-wide text-slate-500"
                        >
                          {title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.items.map((patient) => (
                      <tr key={patient.id} className="hover:bg-slate-50/70">
                        <th
                          scope="row"
                          className="max-w-72 px-5 py-4 text-sm font-semibold text-slate-900"
                        >
                          <Link
                            href={`/patients/${patient.id}`}
                            prefetch={false}
                            className="flex min-h-11 items-center gap-3 rounded-lg hover:text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                          >
                            <span
                              aria-hidden="true"
                              className="grid size-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-xs text-teal-800"
                            >
                              {patient.fullName
                                .trim()
                                .charAt(0)
                                .toUpperCase() || "P"}
                            </span>
                            <span className="min-w-0 break-words">
                              {patient.fullName}
                            </span>
                          </Link>
                        </th>
                        <td className="break-words px-5 py-4 text-xs font-semibold text-teal-800">
                          {patient.mrn}
                        </td>
                        <td className="px-5 py-4 text-sm tabular-nums text-slate-600">
                          {patient.phone || "Not provided"}
                        </td>
                        <td className="max-w-48 break-words px-5 py-4 text-sm text-slate-600">
                          {patient.city || "Not provided"}
                        </td>
                        <td className="px-5 py-4">
                          <Link
                            href={`/patients/${patient.id}`}
                            prefetch={false}
                            className={secondaryButton}
                          >
                            View record
                            <span className="sr-only">
                              {" "}
                              for {patient.fullName}
                            </span>
                            <span aria-hidden="true">↗</span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 px-5 py-4 sm:px-6">
                <p className="text-xs tabular-nums text-slate-500">
                  Page {data.pagination.page} of{" "}
                  {Math.max(1, data.pagination.totalPages)} ·{" "}
                  {data.pagination.total} records
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={secondaryButton}
                    disabled={page <= 1}
                    onClick={() => setPage((current) => current - 1)}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className={secondaryButton}
                    disabled={page >= data.pagination.totalPages}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </section>
      <p className="text-xs leading-5 text-slate-500">
        For testing, use fictional patient information.
      </p>
    </div>
  );
}
