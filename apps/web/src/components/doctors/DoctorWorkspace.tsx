"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, apiRequest } from "@/lib/api";
import { useStaffUser } from "@/components/auth/StaffSessionGate";
import Link from "next/link";
import DoctorStaffPicker from "@/components/doctors/DoctorStaffPicker";

type Department = {
  id: string;
  name: string;
  isActive: boolean;
};

type Doctor = {
  id: string;
  displayName: string;
  specialty: string;
  qualification: string | null;
  isActive: boolean;
  version: number;
  department: Department;
};

type ManagedDoctor = Doctor & {
  registrationNumber: string | null;
  registrationAuthority: string | null;
  staffUserId: string | null;
};

type PageResult<T> = {
  items: T[];
  pagination: {
    page: number;
    total: number;
    totalPages: number;
  };
};

type Editor = { mode: "create" } | { mode: "edit"; doctor: ManagedDoctor };

const fields = [
  {
    name: "displayName",
    label: "Doctor display name",
    max: 100,
    required: true,
  },
  { name: "specialty", label: "Specialty", max: 100, required: true },
  { name: "qualification", label: "Qualification", max: 200, required: false },
  {
    name: "registrationNumber",
    label: "Professional registration number",
    max: 100,
    required: false,
  },
  {
    name: "registrationAuthority",
    label: "Registration authority",
    max: 100,
    required: false,
  },
] as const;

async function loadDepartments(signal: AbortSignal) {
  const departments: Department[] = [];
  let page = 1;

  while (true) {
    const result = await apiRequest<PageResult<Department>>(
      `/departments?page=${page}&limit=100`,
      { signal },
    );

    departments.push(...result.items);

    if (page >= result.pagination.totalPages) break;
    page += 1;
  }

  return departments;
}

export default function DoctorWorkspace() {
  const user = useStaffUser();

  const canRead = user.permissions?.includes("doctors.read") ?? false;
  const canManage = user.permissions?.includes("doctors.manage") ?? false;
  const canViewAvailability =
    user.permissions?.includes("availability.read") ?? false;
  const canReadStaff = user.permissions?.includes("staff.read") ?? false;

  const [page, setPage] = useState(1);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [reload, setReload] = useState(0);

  const [loaded, setLoaded] = useState<{
    key: string;
    doctors: PageResult<Doctor> | null;
    departments: Department[];
    error: string;
  } | null>(null);

  const [editor, setEditor] = useState<Editor | null>(null);
  const [opening, setOpening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);

  const key = JSON.stringify([page, departmentFilter, reload]);
  const current = loaded?.key === key ? loaded : null;
  const loading = canRead && current === null;
  const doctors = current?.doctors;
  const departments = current?.departments ?? [];

  useEffect(() => {
    if (!canRead) return;

    const controller = new AbortController();
    let active = true;

    async function load() {
      const query = new URLSearchParams({
        page: String(page),
        limit: "20",
      });

      if (departmentFilter) {
        query.set("departmentId", departmentFilter);
      }

      try {
        const [doctorResult, departmentResult] = await Promise.all([
          apiRequest<PageResult<Doctor>>(`/doctors?${query}`, {
            signal: controller.signal,
          }),
          loadDepartments(controller.signal),
        ]);

        if (active) {
          setLoaded({
            key,
            doctors: doctorResult,
            departments: departmentResult,
            error: "",
          });
        }
      } catch (caught) {
        if (active) {
          setLoaded({
            key,
            doctors: null,
            departments: [],
            error:
              caught instanceof Error
                ? caught.message
                : "Unable to load doctors.",
          });
        }
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [canRead, page, departmentFilter, key]);

  function closeEditor() {
    setEditor(null);
    setError("");
    setConflict(false);
  }

  async function openEdit(id: string) {
    if (opening || saving || editor) return;

    setOpening(true);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest<{ doctor: ManagedDoctor }>(
        `/doctors/${id}/management`,
      );

      setEditor({ mode: "edit", doctor: result.doctor });
      setConflict(false);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to open profile.",
      );
    } finally {
      setOpening(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editor || !canManage || saving || conflict) return;

    const form = new FormData(event.currentTarget);
    const payload: Record<string, string | boolean | number | null> = {};

    for (const field of fields) {
      const text = String(form.get(field.name) ?? "").trim();
      const value = field.required ? text : text || null;

      if (editor.mode === "create") {
        if (value !== null) payload[field.name] = value;
      } else if (value !== editor.doctor[field.name]) {
        payload[field.name] = value;
      }
    }

    if (canReadStaff) {
      const staffUserId = String(form.get("staffUserId") ?? "").trim() || null;

      if (editor.mode === "create") {
        if (staffUserId) {
          payload.staffUserId = staffUserId;
        }
      } else if (staffUserId !== editor.doctor.staffUserId) {
        payload.staffUserId = staffUserId;
      }
    }
    const departmentId = String(form.get("departmentId") ?? "");

    if (editor.mode === "create") {
      payload.departmentId = departmentId;
    } else {
      if (departmentId !== editor.doctor.department.id) {
        payload.departmentId = departmentId;
      }

      const isActive = form.get("isActive") === "on";

      if (isActive !== editor.doctor.isActive) {
        payload.isActive = isActive;
      }

      if (Object.keys(payload).length === 0) {
        closeEditor();
        setMessage("No changes to save.");
        return;
      }

      payload.expectedVersion = editor.doctor.version;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await apiRequest(
        editor.mode === "create" ? "/doctors" : `/doctors/${editor.doctor.id}`,
        {
          method: editor.mode === "create" ? "POST" : "PATCH",
          body: JSON.stringify(payload),
        },
      );

      const created = editor.mode === "create";

      closeEditor();

      if (created) {
        setPage(1);
        setDepartmentFilter("");
      }

      setReload((value) => value + 1);
      setMessage(
        created
          ? "Doctor profile created successfully."
          : "Doctor profile updated successfully.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save profile.",
      );

      if (
        editor.mode === "edit" &&
        caught instanceof ApiError &&
        caught.status === 409
      ) {
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
        <p className="muted">Your account cannot view the doctor directory.</p>
      </section>
    );
  }

  const busy = saving || opening;
  const listControlsDisabled = busy || editor !== null || loading;

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">HOSPITAL DIRECTORY</p>
          <h1>Doctors</h1>
          <p className="muted">
            Manage doctor profiles and their primary departments.
          </p>
        </div>

        {canManage && !editor && (
          <button
            className="primary-button"
            type="button"
            disabled={
              loading || opening || !departments.some((d) => d.isActive)
            }
            onClick={() => {
              setEditor({ mode: "create" });
              setError("");
              setMessage("");
              setConflict(false);
            }}
          >
            + Add doctor
          </button>
        )}
      </section>

      <p className="success-message" role="status">
        {opening ? "Loading profile..." : message}
      </p>

      {!editor && error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {editor && canManage && (
        <section className="panel registration-panel">
          <h2>{editor.mode === "create" ? "Add doctor" : "Edit doctor"}</h2>

          <p className="muted">
            Profile creation does not create a login or verify professional
            credentials.
          </p>

          <form
            key={editor.mode === "create" ? "create" : editor.doctor.id}
            onSubmit={save}
            aria-busy={saving}
          >
            <fieldset className="patient-fields" disabled={saving}>
              <legend className="sr-only">Doctor profile details</legend>

              <div className="form-grid">
                {fields.map((field) => (
                  <div className="form-field" key={field.name}>
                    <label htmlFor={`doctor-${field.name}`}>
                      {field.label}
                      {field.required ? " *" : ""}
                    </label>
                    <input
                      id={`doctor-${field.name}`}
                      name={field.name}
                      required={field.required}
                      minLength={field.required ? 2 : undefined}
                      maxLength={field.max}
                      defaultValue={
                        editor.mode === "edit"
                          ? (editor.doctor[field.name] ?? "")
                          : ""
                      }
                    />
                  </div>
                ))}

                <div className="form-field">
                  <label htmlFor="doctor-department">
                    Primary department *
                  </label>
                  <select
                    id="doctor-department"
                    name="departmentId"
                    required
                    defaultValue={
                      editor.mode === "edit" ? editor.doctor.department.id : ""
                    }
                  >
                    <option value="" disabled>
                      Select a department
                    </option>

                    {departments
                      .filter(
                        (department) =>
                          department.isActive ||
                          (editor.mode === "edit" &&
                            department.id === editor.doctor.department.id),
                      )
                      .map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                          {!department.isActive ? " (inactive)" : ""}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              {canReadStaff ? (
                <DoctorStaffPicker
                  key={
                    editor.mode === "create"
                      ? "new-doctor-staff"
                      : editor.doctor.id
                  }
                  doctorId={
                    editor.mode === "edit" ? editor.doctor.id : undefined
                  }
                  initialStaffUserId={
                    editor.mode === "edit" ? editor.doctor.staffUserId : null
                  }
                  disabled={saving || conflict}
                />
              ) : (
                <p className="muted">
                  Staff-account linking requires staff-directory access.
                </p>
              )}
              {editor.mode === "edit" && (
                <label className="department-active">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={editor.doctor.isActive}
                  />
                  <span>Doctor profile is active</span>
                </label>
              )}

              <p className="form-error" role="alert">
                {error}
              </p>

              {conflict && (
                <div className="conflict-notice">
                  <p>
                    Saving is paused. Your edits remain visible. Review or copy
                    them before discarding the form and reopening the latest
                    profile.
                  </p>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      closeEditor();
                      setReload((value) => value + 1);
                    }}
                  >
                    Discard edits and refresh list
                  </button>
                </div>
              )}

              <div className="form-actions">
                <button
                  className="primary-button"
                  type="submit"
                  disabled={conflict}
                >
                  {saving ? "Saving..." : "Save doctor"}
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={closeEditor}
                >
                  Cancel
                </button>
              </div>
            </fieldset>
          </form>
        </section>
      )}

      <section className="panel" aria-labelledby="doctor-directory-title">
        <div className="panel-heading">
          <div>
            <h2 id="doctor-directory-title">Doctor directory</h2>
            <p className="muted" role="status">
              {loading
                ? "Loading..."
                : doctors
                  ? `${doctors.pagination.total} matching profiles`
                  : "Directory unavailable"}
            </p>
          </div>
        </div>

        <div className="patient-search form-field">
          <label htmlFor="doctor-filter">Filter by department</label>
          <select
            id="doctor-filter"
            value={departmentFilter}
            disabled={listControlsDisabled}
            onChange={(event) => {
              setDepartmentFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
                {!department.isActive ? " (inactive)" : ""}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="patient-feedback">Loading doctor profiles...</p>
        ) : current?.error ? (
          <div className="empty-state">
            <p className="form-error" role="alert">
              {current.error}
            </p>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setReload((value) => value + 1)}
            >
              Try again
            </button>
          </div>
        ) : !doctors?.items.length ? (
          <div className="empty-state">
            <h3>No matching doctors</h3>
            <p className="muted">
              An administrator can create profiles after adding an active
              department.
            </p>
          </div>
        ) : (
          <>
            <div
              className="table-scroll"
              role="region"
              aria-label="Doctor directory"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col">Doctor</th>
                    <th scope="col">Department</th>
                    <th scope="col">Status</th>
                    {canManage && <th scope="col">Action</th>}
                    {canViewAvailability && <th scope="col">Availability</th>}
                  </tr>
                </thead>

                <tbody>
                  {doctors.items.map((doctor) => (
                    <tr key={doctor.id}>
                      <th scope="row">
                        <span className="patient-name">
                          {doctor.displayName}
                        </span>
                        <span className="record-id">{doctor.specialty}</span>
                      </th>
                      <td>
                        {doctor.department.name}
                        {!doctor.department.isActive && (
                          <span className="record-id">Department inactive</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`status ${doctor.isActive ? "completed" : "inactive"}`}
                        >
                          {doctor.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {canManage && (
                        <td>
                          <button
                            className="secondary-button"
                            type="button"
                            disabled={editor !== null || busy}
                            aria-label={`Edit ${doctor.displayName}`}
                            onClick={() => void openEdit(doctor.id)}
                          >
                            Edit
                          </button>
                        </td>
                      )}
                      {canViewAvailability && (
                        <td>
                          <Link
                            className="text-link"
                            href={`/doctors/${doctor.id}/availability`}
                            prefetch={false}
                          >
                            View schedule
                          </Link>
                          {user.permissions?.includes("availability.read") && (
                            <>
                              {" | "}
                              <Link
                                href={`/doctors/${doctor.id}/calendar`}
                                className="text-link"
                                prefetch={false}
                              >
                                Calendar
                              </Link>
                            </>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination-bar">
              <span>
                Page {doctors.pagination.page} of{" "}
                {Math.max(1, doctors.pagination.totalPages)}
              </span>
              <div className="pagination-actions">
                <button
                  className="secondary-button"
                  type="button"
                  disabled={listControlsDisabled || page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={
                    listControlsDisabled ||
                    page >= doctors.pagination.totalPages
                  }
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </>
  );
}
