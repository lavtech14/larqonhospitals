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

  if (!canRead) {
    return (
      <section className="panel registration-panel">
        <h1>Patient directory access unavailable</h1>
        <p className="muted">
          Your account does not have permission to view this directory.
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="page-heading" aria-labelledby="patients-title">
        <div>
          <p className="eyebrow">PATIENT MANAGEMENT</p>
          <h1 id="patients-title">Patients</h1>
          <p className="muted">
            Search existing records before registering a patient.
          </p>
        </div>

        {canCreate && (
          <button
            className="primary-button"
            type="button"
            disabled={saving}
            aria-expanded={showForm}
            aria-controls="registration-panel"
            onClick={() => {
              setShowForm((current) => !current);
              setFormError("");
            }}
          >
            {showForm ? "Close registration" : "+ Register patient"}
          </button>
        )}
      </section>

      <p className="preview-note">
        Development environment — use fictional patient information.
      </p>

      <p className="success-message" role="status">
        {message}
      </p>

      {showForm && canCreate && (
        <section
          className="panel registration-panel"
          id="registration-panel"
          aria-labelledby="registration-title"
        >
          <h2 id="registration-title">Register patient</h2>
          <p className="muted">
            Full name is required. Add contact and address details when
            available.
          </p>

          <form onSubmit={registerPatient} aria-busy={saving}>
            <fieldset className="patient-fields" disabled={saving}>
              <legend className="sr-only">Patient registration details</legend>

              <div
                className="form-grid"
                onChange={() => {
                  setDuplicates(null);
                  setDuplicateConfirmed(false);
                  setFormError("");
                }}
              >
                {registrationFields.map((field) => (
                  <div className="form-field" key={field.name}>
                    <label htmlFor={`patient-${field.name}`}>
                      {field.label}
                      {field.required ? " *" : ""}
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
                      placeholder={
                        field.name === "countryCode" ? "IN" : undefined
                      }
                    />
                  </div>
                ))}
                <div className="form-field">
                  <label htmlFor="patient-phone-owner">
                    Primary phone belongs to
                  </label>

                  <select
                    id="patient-phone-owner"
                    name="phoneOwner"
                    defaultValue="UNKNOWN"
                  >
                    <option value="UNKNOWN">Unknown / not recorded</option>
                    <option value="PATIENT">Patient</option>
                    <option value="GUARDIAN">Guardian</option>
                    <option value="OTHER">Other contact</option>
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="patient-administrative-sex">
                    Administrative sex
                  </label>

                  <select
                    id="patient-administrative-sex"
                    name="administrativeSex"
                    defaultValue="UNKNOWN"
                  >
                    <option value="UNKNOWN">Unknown / not recorded</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <p className="form-error" role="alert">
                {formError}
              </p>
              {duplicates && (
                <section
                  className="conflict-notice"
                  aria-labelledby="duplicate-title"
                >
                  <h3 id="duplicate-title">
                    Review possible existing patients
                  </h3>

                  <p>
                    Up to five matches are shown. A shared name or phone number
                    does not prove these records belong to the same person.
                  </p>

                  <ul className="duplicate-list">
                    {duplicates.map((candidate) => (
                      <li key={candidate.id}>
                        <strong>{candidate.fullName}</strong>
                        <span className="record-id">MRN: {candidate.mrn}</span>
                        <span>
                          {candidate.phone || "Phone not provided"} ·{" "}
                          {candidate.city || "City not provided"}
                        </span>

                        <Link
                          className="text-link"
                          href={`/patients/${candidate.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          prefetch={false}
                        >
                          Open record in a new tab
                        </Link>
                      </li>
                    ))}
                  </ul>

                  <label className="duplicate-confirmation">
                    <input
                      type="checkbox"
                      checked={duplicateConfirmed}
                      onChange={(event) =>
                        setDuplicateConfirmed(event.target.checked)
                      }
                    />

                    <span>
                      I reviewed the possible matches and verified that this
                      registration is for a different person.
                    </span>
                  </label>
                </section>
              )}

              <div className="form-actions">
                <button
                  className="primary-button"
                  type="submit"
                  disabled={duplicates !== null && !duplicateConfirmed}
                >
                  {saving ? "Registering..." : "Register patient"}
                </button>

                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
              </div>
            </fieldset>
          </form>
        </section>
      )}

      <section className="panel" aria-labelledby="directory-title">
        <div className="panel-heading">
          <div>
            <h2 id="directory-title">Patient directory</h2>
            <p className="muted" role="status">
              {loading
                ? "Loading patients..."
                : data
                  ? `${data.pagination.total} matching patients`
                  : "Patient list unavailable"}
            </p>
          </div>

          <button
            className="secondary-button"
            type="button"
            disabled={loading}
            onClick={() => setReload((current) => current + 1)}
          >
            Refresh
          </button>
        </div>

        <form className="patient-search" onSubmit={submitSearch}>
          <div className="form-field">
            <label htmlFor="patient-search">
              {" "}
              Search by MRN, name or phone
            </label>
            <input
              id="patient-search"
              type="search"
              maxLength={100}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search patients..."
            />
          </div>

          <div className="form-actions">
            <button className="secondary-button" type="submit">
              Search
            </button>

            <button
              className="secondary-button"
              type="button"
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
        </form>

        <div aria-busy={loading}>
          {loading ? (
            <p className="patient-feedback">Loading patient records...</p>
          ) : currentResult?.error ? (
            <div className="empty-state">
              <p className="form-error" role="alert">
                {currentResult.error}
              </p>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setReload((current) => current + 1)}
              >
                Try again
              </button>
            </div>
          ) : data?.items.length === 0 ? (
            <div className="empty-state">
              <h3>No matching patients</h3>
              <p className="muted">
                Try another search or register a new patient.
              </p>
            </div>
          ) : data ? (
            <>
              <div
                className="table-scroll"
                role="region"
                aria-label="Patient directory"
                tabIndex={0}
              >
                <table>
                  <caption className="sr-only">
                    Patient names, identifiers, phone numbers and cities
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Patient</th>
                      <th scope="col">Phone</th>
                      <th scope="col">City</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((patient) => (
                      <tr key={patient.id}>
                        <th scope="row">
                          <Link
                            className="patient-name text-link"
                            href={`/patients/${patient.id}`}
                            prefetch={false}
                          >
                            {patient.fullName}
                          </Link>
                          <span className="record-id">MRN: {patient.mrn}</span>
                        </th>
                        <td>{patient.phone || "Not provided"}</td>
                        <td>{patient.city || "Not provided"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pagination-bar">
                <span>
                  Page {data.pagination.page} of{" "}
                  {Math.max(1, data.pagination.totalPages)}
                </span>

                <div className="pagination-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => current - 1)}
                  >
                    Previous
                  </button>

                  <button
                    className="secondary-button"
                    type="button"
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
    </>
  );
}
