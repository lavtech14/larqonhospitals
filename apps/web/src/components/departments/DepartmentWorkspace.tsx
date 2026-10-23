"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, apiRequest } from "@/lib/api";
import { useStaffUser } from "@/components/auth/StaffSessionGate";

type Department = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  version: number;
};

type DepartmentPage = {
  items: Department[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type Editor = { mode: "create" } | { mode: "edit"; department: Department };

type LoadState = {
  key: string;
  data: DepartmentPage | null;
  error: string;
};

export default function DepartmentWorkspace() {
  const user = useStaffUser();

  const canRead = user.permissions?.includes("departments.read") ?? false;
  const canManage = user.permissions?.includes("departments.manage") ?? false;

  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<LoadState | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);

  const requestKey = JSON.stringify([page, reload]);
  const current = result?.key === requestKey ? result : null;
  const loading = canRead && current === null;
  const data = current?.data;

  useEffect(() => {
    if (!canRead) return;

    let active = true;
    const controller = new AbortController();

    async function load() {
      try {
        const response = await apiRequest<DepartmentPage>(
          `/departments?page=${page}&limit=20`,
          { signal: controller.signal },
        );

        if (active) {
          setResult({ key: requestKey, data: response, error: "" });
        }
      } catch (caught) {
        if (active) {
          setResult({
            key: requestKey,
            data: null,
            error:
              caught instanceof Error
                ? caught.message
                : "Unable to load departments.",
          });
        }
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [canRead, page, requestKey]);

  function openEditor(next: Editor) {
    setEditor(next);
    setError("");
    setMessage("");
    setConflict(false);
  }

  function closeEditor() {
    setEditor(null);
    setError("");
    setConflict(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editor || !canManage || saving || conflict) return;

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();

    setSaving(true);
    setError("");
    setMessage("");

    try {
      if (editor.mode === "create") {
        await apiRequest<{ department: Department }>("/departments", {
          method: "POST",
          body: JSON.stringify({
            code: String(formData.get("code") ?? "")
              .trim()
              .toUpperCase(),
            name,
          }),
        });

        setPage(1);
        setMessage("Department created successfully.");
      } else {
        await apiRequest<{ department: Department }>(
          `/departments/${editor.department.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              name,
              isActive: formData.get("isActive") === "on",
              expectedVersion: editor.department.version,
            }),
          },
        );

        setMessage("Department updated successfully.");
      }

      closeEditor();
      setReload((value) => value + 1);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save department.",
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

  const primaryButton =
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50";
  const secondaryButton =
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50";
  const inputClass =
    "mt-2 block min-h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 placeholder:text-slate-400 read-only:cursor-default read-only:border-slate-200 read-only:bg-slate-50 read-only:text-slate-500 focus:border-teal-700 focus:outline-2 focus:outline-offset-2 focus:outline-teal-700 disabled:cursor-wait disabled:opacity-60";

  function statusBadge(department: Department) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${department.isActive ? "bg-teal-50 text-teal-900 ring-teal-100" : "bg-slate-100 text-slate-600 ring-slate-200"}`}
      >
        <span
          aria-hidden="true"
          className={`size-1.5 rounded-full ${department.isActive ? "bg-teal-700" : "bg-slate-400"}`}
        />
        {department.isActive ? "Active" : "Inactive"}
      </span>
    );
  }

  function editAction(department: Department) {
    return (
      canManage && (
        <button
          type="button"
          className={secondaryButton}
          disabled={editor !== null || saving}
          aria-label={`Edit ${department.name}`}
          onClick={() => openEditor({ mode: "edit", department })}
        >
          Edit department
        </button>
      )
    );
  }

  if (!canRead)
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-slate-950">
          Access unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Your account cannot view departments.
        </p>
      </section>
    );

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold tracking-[0.18em] text-teal-800">
            HOSPITAL CONFIGURATION
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Departments
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Organize the departments used for doctor profiles and consultation
            schedules.
          </p>
        </div>
        {canManage && !editor && (
          <button
            type="button"
            className={primaryButton}
            aria-controls="department-editor"
            onClick={() => openEditor({ mode: "create" })}
          >
            <span aria-hidden="true" className="text-lg leading-none">
              +
            </span>
            Add department
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

      {editor && canManage && (
        <section
          id="department-editor"
          aria-labelledby="department-editor-title"
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5 sm:p-6">
            <div>
              <p className="text-[10px] font-bold tracking-[0.16em] text-teal-800">
                {editor.mode === "create"
                  ? "NEW DEPARTMENT"
                  : "DEPARTMENT SETTINGS"}
              </p>
              <h2
                id="department-editor-title"
                className="mt-2 text-xl font-semibold tracking-tight text-slate-950"
              >
                {editor.mode === "create"
                  ? "Add department"
                  : "Edit department"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {editor.mode === "create"
                  ? "Enter a unique code and the department’s display name."
                  : "Update the department name or active status. Its code stays unchanged."}
              </p>
            </div>
            {editor.mode === "edit" && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs tabular-nums text-slate-600">
                Version {editor.department.version}
              </span>
            )}
          </div>
          <form
            key={editor.mode === "create" ? "create" : editor.department.id}
            onSubmit={save}
            aria-busy={saving}
          >
            <fieldset disabled={saving} className="m-0 min-w-0 border-0 p-0">
              <legend className="sr-only">Department details</legend>
              <div className="grid min-w-0 gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_260px]">
                <div className="min-w-0">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="min-w-0">
                      <label
                        htmlFor="department-code"
                        className="text-xs font-semibold text-slate-600"
                      >
                        Department code{" "}
                        <span aria-hidden="true" className="text-red-700">
                          *
                        </span>
                      </label>
                      <input
                        id="department-code"
                        name="code"
                        required
                        minLength={2}
                        maxLength={20}
                        pattern="[A-Za-z][A-Za-z0-9_-]*"
                        defaultValue={
                          editor.mode === "edit" ? editor.department.code : ""
                        }
                        readOnly={editor.mode === "edit"}
                        placeholder="GENERAL_MEDICINE"
                        aria-describedby="department-code-help"
                        className={inputClass}
                      />
                      <p
                        id="department-code-help"
                        className="mt-2 text-xs leading-5 text-slate-500"
                      >
                        Codes cannot be changed after creation. Start with a
                        letter; use letters, numbers, underscores or hyphens.
                      </p>
                    </div>
                    <div className="min-w-0">
                      <label
                        htmlFor="department-name"
                        className="text-xs font-semibold text-slate-600"
                      >
                        Department name{" "}
                        <span aria-hidden="true" className="text-red-700">
                          *
                        </span>
                      </label>
                      <input
                        id="department-name"
                        name="name"
                        required
                        minLength={2}
                        maxLength={100}
                        defaultValue={
                          editor.mode === "edit" ? editor.department.name : ""
                        }
                        placeholder="General Medicine"
                        className={inputClass}
                      />
                    </div>
                  </div>
                  {editor.mode === "edit" && (
                    <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4">
                      <input
                        type="checkbox"
                        name="isActive"
                        defaultChecked={editor.department.isActive}
                        className="mt-1 size-4 shrink-0 accent-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-slate-900">
                          Department is active
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">
                          Clear this option to mark the department inactive.
                        </span>
                      </span>
                    </label>
                  )}
                </div>
                <aside
                  aria-label="Department guidance"
                  className="h-fit rounded-xl bg-slate-50 p-5"
                >
                  <h3 className="text-sm font-semibold text-slate-900">
                    Keep departments consistent
                  </h3>
                  <p className="mt-2 text-xs leading-6 text-slate-600">
                    Use a recognizable name for staff and a stable code for the
                    department. Review existing entries before creating another.
                  </p>
                </aside>
              </div>
              {error && (
                <p
                  role="alert"
                  className="mx-5 mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800 sm:mx-6"
                >
                  {error}
                </p>
              )}
              {conflict && (
                <div className="mx-5 mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 sm:mx-6">
                  <h3 className="text-sm font-semibold text-amber-950">
                    This department has changed
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-amber-900">
                    Another update changed this department. Your edits remain
                    visible. Review or copy them before discarding this form.
                    Saving is paused.
                  </p>
                  <button
                    type="button"
                    className={`${secondaryButton} mt-4`}
                    onClick={() => {
                      closeEditor();
                      setReload((value) => value + 1);
                    }}
                  >
                    Discard edits and refresh list
                  </button>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-6">
                <p className="text-xs leading-5 text-slate-500">
                  {editor.mode === "create"
                    ? "Required fields are marked with an asterisk."
                    : "Review the changes before saving."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={closeEditor}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={primaryButton}
                    disabled={saving || conflict}
                  >
                    {saving ? "Saving…" : "Save department"}
                  </button>
                </div>
              </div>
            </fieldset>
          </form>
        </section>
      )}

      <section
        aria-labelledby="department-list-title"
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
          <div>
            <h2
              id="department-list-title"
              className="text-lg font-semibold tracking-tight text-slate-950"
            >
              Department directory
            </h2>
            <p role="status" className="mt-2 text-xs leading-5 text-slate-500">
              {loading
                ? "Loading departments…"
                : data
                  ? `${data.pagination.total} departments`
                  : "Department list unavailable"}
            </p>
          </div>
          <button
            type="button"
            className={secondaryButton}
            disabled={loading || saving}
            onClick={() => setReload((value) => value + 1)}
          >
            Refresh list
          </button>
        </div>
        <div aria-busy={loading}>
          {loading ? (
            <p
              role="status"
              className="px-6 py-12 text-center text-sm text-slate-500"
            >
              Loading departments…
            </p>
          ) : current?.error ? (
            <div className="px-6 py-12 text-center">
              <p role="alert" className="text-sm leading-6 text-red-700">
                {current.error}
              </p>
              <button
                type="button"
                className={`${secondaryButton} mt-5`}
                onClick={() => setReload((value) => value + 1)}
              >
                Try again
              </button>
            </div>
          ) : !data?.items.length ? (
            <div className="px-6 py-14 text-center">
              <h3 className="text-base font-semibold text-slate-900">
                No departments found
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {canManage
                  ? "Use Add department to create the first entry."
                  : "An administrator can add the first department."}
              </p>
            </div>
          ) : (
            <>
              <ul
                className="m-0 grid list-none gap-4 bg-slate-50/60 p-4 sm:grid-cols-2 lg:hidden"
                aria-label="Departments"
              >
                {data.items.map((department) => (
                  <li
                    key={department.id}
                    className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="min-w-0 break-words text-base font-semibold text-slate-950">
                        {department.name}
                      </h3>
                      <div className="shrink-0">{statusBadge(department)}</div>
                    </div>
                    <p className="mt-4 text-xs text-slate-500">
                      Department code
                    </p>
                    <p className="mt-1 break-all font-mono text-xs font-medium leading-6 text-slate-700">
                      {department.code}
                    </p>
                    {canManage && (
                      <div className="mt-4 border-t border-slate-100 pt-4">
                        {editAction(department)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <div
                className="hidden overflow-x-auto lg:block"
                role="region"
                aria-label="Department directory table"
                tabIndex={0}
              >
                <table className="w-full min-w-[650px] border-collapse text-left">
                  <caption className="sr-only">
                    Hospital departments with code, active status and available
                    management actions
                  </caption>
                  <thead>
                    <tr>
                      {[
                        "Department",
                        "Code",
                        "Status",
                        ...(canManage ? ["Action"] : []),
                      ].map((label) => (
                        <th
                          key={label}
                          scope="col"
                          className="border-b border-slate-200 bg-slate-50 px-5 py-3.5 text-[11px] font-semibold tracking-wide text-slate-500"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.items.map((department) => (
                      <tr key={department.id} className="hover:bg-slate-50/70">
                        <th
                          scope="row"
                          className="max-w-80 break-words px-5 py-5 text-sm font-semibold text-slate-900"
                        >
                          {department.name}
                        </th>
                        <td className="max-w-64 break-all px-5 py-5 font-mono text-xs text-slate-600">
                          {department.code}
                        </td>
                        <td className="px-5 py-5">{statusBadge(department)}</td>
                        {canManage && (
                          <td className="px-5 py-5">
                            {editAction(department)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 px-5 py-4 sm:px-6">
                <p className="text-xs tabular-nums text-slate-500">
                  Page {data.pagination.page} of{" "}
                  {Math.max(1, data.pagination.totalPages)} ·{" "}
                  {data.pagination.total} departments
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={secondaryButton}
                    disabled={page <= 1 || editor !== null}
                    onClick={() => setPage((value) => value - 1)}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className={secondaryButton}
                    disabled={
                      page >= data.pagination.totalPages || editor !== null
                    }
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
