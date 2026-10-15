"use client";

import { useState } from "react";
import type { FormEvent } from "react";

type Patient = {
  id: string;
  name: string;
  phone: string;
};

const initialPatients: Patient[] = [
  {
    id: "DEMO-001",
    name: "Demo Patient A",
    phone: "0000000001",
  },
  {
    id: "DEMO-002",
    name: "Demo Patient B",
    phone: "0000000002",
  },
];

export default function PatientWorkspace() {
  const [patients, setPatients] = useState(initialPatients);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const query = search.trim().toLowerCase();

  const filteredPatients = patients.filter((patient) =>
    [patient.id, patient.name, patient.phone].some((value) =>
      value.toLowerCase().includes(query),
    ),
  );

  function registerPatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const form = event.currentTarget;
    const data = new FormData(form);

    const name = String(data.get("name") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();

    if (name.length < 2 || name.length > 100) {
      setError("Enter a patient name between 2 and 100 characters.");
      return;
    }

    if (!/^\d{10}$/.test(phone)) {
      setError("Enter a 10-digit phone number.");
      return;
    }

    const possibleDuplicate = patients.some(
      (patient) =>
        patient.name.toLowerCase() === name.toLowerCase() &&
        patient.phone === phone,
    );

    if (possibleDuplicate) {
      setError(
        "A matching name and phone already exist. Review the existing record.",
      );
      return;
    }

    const patient: Patient = {
      id: `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      name,
      phone,
    };

    setPatients((current) => [patient, ...current]);
    setSearch("");
    setShowForm(false);
    form.reset();

    setMessage(
      `${name} was added to this demo list. This record is not saved to a database.`,
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

        <button
          className="primary-button"
          type="button"
          aria-expanded={showForm}
          aria-controls="registration-panel"
          onClick={() => {
            setShowForm((current) => !current);
            setError("");
          }}
        >
          {showForm ? "Close registration" : "+ Register patient"}
        </button>
      </section>

      <p className="preview-note">
        Demo only. Use fictional information. Records reset when this page is
        refreshed or unmounted.
      </p>

      <p className="success-message" role="status">
        {message}
      </p>

      {showForm && (
        <section
          className="panel registration-panel"
          id="registration-panel"
          aria-labelledby="registration-title"
        >
          <h2 id="registration-title">Register a demo patient</h2>
          <p className="muted">Basic details for this interface prototype.</p>

          <form onSubmit={registerPatient}>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="patient-name">Full name *</label>
                <input
                  autoFocus
                  id="patient-name"
                  name="name"
                  autoComplete="off"
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="Demo Patient C"
                />
              </div>

              <div className="form-field">
                <label htmlFor="patient-phone">Phone number *</label>
                <input
                  id="patient-phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  pattern="[0-9]{10}"
                  maxLength={10}
                  aria-describedby="phone-help"
                  placeholder="0000000003"
                />
                <small id="phone-help">
                  Enter 10 digits for this prototype.
                </small>
              </div>
            </div>

            <p className="form-error" role="alert">
              {error}
            </p>

            <div className="form-actions">
              <button className="primary-button" type="submit">
                Add demo patient
              </button>

              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setError("");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="panel" aria-labelledby="directory-title">
        <div className="panel-heading">
          <div>
            <h2 id="directory-title">Patient directory</h2>
            <p className="muted" role="status">
              {filteredPatients.length} of {patients.length} patients shown
            </p>
          </div>
        </div>

        <div className="patient-search form-field">
          <label htmlFor="patient-search">
            Search by name, demo ID or phone
          </label>
          <input
            id="patient-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search patients..."
          />
        </div>

        {filteredPatients.length === 0 ? (
          <div className="empty-state">
            <h3>No matching patients</h3>
            <p className="muted">Try another name, demo ID or phone number.</p>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setSearch("")}
            >
              Clear search
            </button>
          </div>
        ) : (
          <div
            className="table-scroll"
            role="region"
            aria-label="Patient directory"
            tabIndex={0}
          >
            <table>
              <caption className="sr-only">
                Fictional patient names, demo IDs and phone numbers
              </caption>
              <thead>
                <tr>
                  <th scope="col">Patient</th>
                  <th scope="col">Demo ID</th>
                  <th scope="col">Phone</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map((patient) => (
                  <tr key={patient.id}>
                    <th scope="row">
                      <span className="patient-name">{patient.name}</span>
                    </th>
                    <td>{patient.id}</td>
                    <td>{patient.phone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
