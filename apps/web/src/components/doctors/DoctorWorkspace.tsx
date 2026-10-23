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
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          Access unavailable
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Your account cannot view the doctor directory.
        </p>
      </section>
    );
  }

  const busy = saving || opening;
  const listControlsDisabled = busy || editor !== null || loading;

  return (
    <div className="min-w-0 space-y-6">
      <section className="mb-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="mb-2 text-[10px] font-bold tracking-[0.16em] text-teal-800">
            HOSPITAL DIRECTORY
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Doctors
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Manage doctor profiles and their primary departments.
          </p>
        </div>

        {canManage && !editor && (
          <button
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
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

      <p
        className="my-4 text-sm leading-6 text-teal-800 empty:hidden"
        role="status"
      >
        {opening ? "Loading profile..." : message}
      </p>

      {!editor && error && (
        <p
          className="my-4 text-sm leading-6 text-red-700 empty:hidden"
          role="alert"
        >
          {error}
        </p>
      )}

      {editor && canManage && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight text-slate-950">
            {editor.mode === "create" ? "Add doctor" : "Edit doctor"}
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Profile creation does not create a login or verify professional
            credentials.
          </p>

          <form
            key={editor.mode === "create" ? "create" : editor.doctor.id}
            onSubmit={save}
            aria-busy={saving}
          >
            <fieldset
              className="m-0 min-w-0 border-0 p-0 disabled:opacity-70"
              disabled={saving}
            >
              <legend className="sr-only">Doctor profile details</legend>

              <div className="mt-5 grid min-w-0 gap-5 sm:grid-cols-2">
                {fields.map((field) => (
                  <div
                    className="block min-w-0 text-xs font-semibold text-slate-600 [&>label]:block [&>span]:block [&>input]:mt-2 [&>input]:block [&>input]:min-h-12 [&>input]:w-full [&>input]:min-w-0 [&>input]:rounded-xl [&>input]:border [&>input]:border-slate-300 [&>input]:bg-white [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:font-normal [&>input]:text-slate-900 [&>input:disabled]:bg-slate-50 [&>select]:mt-2 [&>select]:block [&>select]:min-h-12 [&>select]:w-full [&>select]:min-w-0 [&>select]:rounded-xl [&>select]:border [&>select]:border-slate-300 [&>select]:bg-white [&>select]:px-3 [&>select]:py-2 [&>select]:text-sm [&>select]:font-normal [&>select]:text-slate-900 [&>select:disabled]:bg-slate-50 [&>input:focus-visible]:outline-2 [&>input:focus-visible]:outline-offset-2 [&>input:focus-visible]:outline-teal-700 [&>select:focus-visible]:outline-2 [&>select:focus-visible]:outline-offset-2 [&>select:focus-visible]:outline-teal-700"
                    key={field.name}
                  >
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

                <div className="block min-w-0 text-xs font-semibold text-slate-600 [&>label]:block [&>span]:block [&>input]:mt-2 [&>input]:block [&>input]:min-h-12 [&>input]:w-full [&>input]:min-w-0 [&>input]:rounded-xl [&>input]:border [&>input]:border-slate-300 [&>input]:bg-white [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:font-normal [&>input]:text-slate-900 [&>input:disabled]:bg-slate-50 [&>select]:mt-2 [&>select]:block [&>select]:min-h-12 [&>select]:w-full [&>select]:min-w-0 [&>select]:rounded-xl [&>select]:border [&>select]:border-slate-300 [&>select]:bg-white [&>select]:px-3 [&>select]:py-2 [&>select]:text-sm [&>select]:font-normal [&>select]:text-slate-900 [&>select:disabled]:bg-slate-50 [&>input:focus-visible]:outline-2 [&>input:focus-visible]:outline-offset-2 [&>input:focus-visible]:outline-teal-700 [&>select:focus-visible]:outline-2 [&>select:focus-visible]:outline-offset-2 [&>select:focus-visible]:outline-teal-700">
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
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Staff-account linking requires staff-directory access.
                </p>
              )}
              {editor.mode === "edit" && (
                <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4 text-sm font-medium text-slate-700 [&>input]:size-4 [&>input]:accent-teal-800">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={editor.doctor.isActive}
                  />
                  <span>Doctor profile is active</span>
                </label>
              )}

              <p
                className="my-4 text-sm leading-6 text-red-700 empty:hidden"
                role="alert"
              >
                {error}
              </p>

              {conflict && (
                <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950 [&>button]:mt-4">
                  <p>
                    Saving is paused. Your edits remain visible. Review or copy
                    them before discarding the form and reopening the latest
                    profile.
                  </p>
                  <button
                    className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
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

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                  type="submit"
                  disabled={conflict}
                >
                  {saving ? "Saving..." : "Save doctor"}
                </button>
                <button
                  className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
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

      <section
        className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
        aria-labelledby="doctor-directory-title"
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2
              id="doctor-directory-title"
              className="text-lg font-semibold tracking-tight text-slate-950"
            >
              Doctor directory
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500" role="status">
              {loading
                ? "Loading..."
                : doctors
                  ? `${doctors.pagination.total} matching profiles`
                  : "Directory unavailable"}
            </p>
          </div>
        </div>

        <div className="mb-5 max-w-md block min-w-0 text-xs font-semibold text-slate-600 [&>label]:block [&>span]:block [&>input]:mt-2 [&>input]:block [&>input]:min-h-12 [&>input]:w-full [&>input]:min-w-0 [&>input]:rounded-xl [&>input]:border [&>input]:border-slate-300 [&>input]:bg-white [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:font-normal [&>input]:text-slate-900 [&>input:disabled]:bg-slate-50 [&>select]:mt-2 [&>select]:block [&>select]:min-h-12 [&>select]:w-full [&>select]:min-w-0 [&>select]:rounded-xl [&>select]:border [&>select]:border-slate-300 [&>select]:bg-white [&>select]:px-3 [&>select]:py-2 [&>select]:text-sm [&>select]:font-normal [&>select]:text-slate-900 [&>select:disabled]:bg-slate-50 [&>input:focus-visible]:outline-2 [&>input:focus-visible]:outline-offset-2 [&>input:focus-visible]:outline-teal-700 [&>select:focus-visible]:outline-2 [&>select:focus-visible]:outline-offset-2 [&>select:focus-visible]:outline-teal-700">
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
          <p className="px-5 py-12 text-center text-sm text-slate-500">
            Loading doctor profiles...
          </p>
        ) : current?.error ? (
          <div className="px-5 py-12 text-center [&>button]:mt-4">
            <p
              className="my-4 text-sm leading-6 text-red-700 empty:hidden"
              role="alert"
            >
              {current.error}
            </p>
            <button
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              onClick={() => setReload((value) => value + 1)}
            >
              Try again
            </button>
          </div>
        ) : !doctors?.items.length ? (
          <div className="px-5 py-12 text-center [&>button]:mt-4">
            <h3 className="text-sm font-semibold text-slate-900">
              No matching doctors
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              An administrator can create profiles after adding an active
              department.
            </p>
          </div>
        ) : (
          <>
            <ul
              className="mb-5 grid list-none gap-4 sm:grid-cols-2 lg:hidden"
              aria-label="Doctor profiles"
            >
              {doctors.items.map((doctor) => (
                <li
                  key={doctor.id}
                  className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-base font-semibold text-slate-950">
                        {doctor.displayName}
                      </h3>
                      <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                        {doctor.specialty}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${doctor.isActive ? "bg-teal-50 text-teal-900" : "bg-slate-100 text-slate-600"}`}
                    >
                      {doctor.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="mt-4 text-xs text-slate-500">
                    Primary department
                  </p>
                  <p className="mt-1 break-words text-sm font-medium text-slate-800">
                    {doctor.department.name}
                  </p>
                  {!doctor.department.isActive && (
                    <p className="mt-1 text-xs text-amber-800">
                      Department inactive
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                    {canManage && (
                      <button
                        type="button"
                        className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={editor !== null || busy}
                        aria-label={`Edit ${doctor.displayName}`}
                        onClick={() => void openEdit(doctor.id)}
                      >
                        Edit
                      </button>
                    )}
                    {canViewAvailability && (
                      <>
                        <Link
                          href={`/doctors/${doctor.id}/availability`}
                          prefetch={false}
                          className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-800 hover:underline"
                        >
                          Schedule
                          <span className="sr-only">
                            {" "}
                            for {doctor.displayName}
                          </span>
                        </Link>
                        <Link
                          href={`/doctors/${doctor.id}/calendar`}
                          prefetch={false}
                          className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-800 hover:underline"
                        >
                          Calendar
                          <span className="sr-only">
                            {" "}
                            for {doctor.displayName}
                          </span>
                        </Link>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div
              className="hidden overflow-x-auto rounded-xl border border-slate-200 lg:block"
              role="region"
              aria-label="Doctor directory"
              tabIndex={0}
            >
              <table className="w-full min-w-[820px] border-collapse text-left">
                <caption className="sr-only">
                  Doctor profiles with department, status and available
                  management actions
                </caption>
                <thead className="bg-slate-50">
                  <tr>
                    <th
                      scope="col"
                      className="border-b border-slate-200 px-5 py-3.5 text-[11px] font-semibold tracking-wide text-slate-500"
                    >
                      Doctor
                    </th>
                    <th
                      scope="col"
                      className="border-b border-slate-200 px-5 py-3.5 text-[11px] font-semibold tracking-wide text-slate-500"
                    >
                      Department
                    </th>
                    <th
                      scope="col"
                      className="border-b border-slate-200 px-5 py-3.5 text-[11px] font-semibold tracking-wide text-slate-500"
                    >
                      Status
                    </th>
                    {canManage && (
                      <th
                        scope="col"
                        className="border-b border-slate-200 px-5 py-3.5 text-[11px] font-semibold tracking-wide text-slate-500"
                      >
                        Action
                      </th>
                    )}
                    {canViewAvailability && (
                      <th
                        scope="col"
                        className="border-b border-slate-200 px-5 py-3.5 text-[11px] font-semibold tracking-wide text-slate-500"
                      >
                        Availability
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {doctors.items.map((doctor) => (
                    <tr key={doctor.id}>
                      <th scope="row" className="max-w-60 px-5 py-5 align-top">
                        <span className="block break-words text-sm font-semibold text-slate-900">
                          {doctor.displayName}
                        </span>
                        <span className="mt-1 block break-words text-xs leading-5 text-slate-500">
                          {doctor.specialty}
                        </span>
                      </th>
                      <td className="max-w-64 break-words px-5 py-5 align-top text-sm text-slate-600">
                        {doctor.department.name}
                        {!doctor.department.isActive && (
                          <span className="mt-1 block break-words text-xs leading-5 text-slate-500">
                            Department inactive
                          </span>
                        )}
                      </td>
                      <td className="max-w-64 break-words px-5 py-5 align-top text-sm text-slate-600">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${doctor.isActive ? "bg-teal-50 text-teal-900" : "bg-slate-100 text-slate-600"}`}
                        >
                          {doctor.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {canManage && (
                        <td className="max-w-64 break-words px-5 py-5 align-top text-sm text-slate-600">
                          <button
                            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                        <td className="max-w-64 break-words px-5 py-5 align-top text-sm text-slate-600">
                          <Link
                            className="inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-teal-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                            href={`/doctors/${doctor.id}/availability`}
                            prefetch={false}
                          >
                            View schedule
                          </Link>
                          {user.permissions?.includes("availability.read") && (
                            <>
                              <span
                                aria-hidden="true"
                                className="mx-2 text-slate-300"
                              >
                                /
                              </span>
                              <Link
                                href={`/doctors/${doctor.id}/calendar`}
                                className="inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-teal-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
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

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5 text-xs tabular-nums text-slate-500">
              <span>
                Page {doctors.pagination.page} of{" "}
                {Math.max(1, doctors.pagination.totalPages)}
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled={listControlsDisabled || page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </button>
                <button
                  className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
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
    </div>
  );
}
