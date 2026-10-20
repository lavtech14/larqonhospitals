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

  if (!canRead) {
    return (
      <section className="panel registration-panel">
        <h1>Access unavailable</h1>
        <p className="muted">Your account cannot view departments.</p>
      </section>
    );
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">HOSPITAL CONFIGURATION</p>
          <h1>Departments</h1>
          <p className="muted">
            Organize hospital departments for doctor profiles and scheduling.
          </p>
        </div>

        {canManage && !editor && (
          <button
            className="primary-button"
            type="button"
            onClick={() => openEditor({ mode: "create" })}
          >
            + Add department
          </button>
        )}
      </section>

      <p className="success-message" role="status">
        {message}
      </p>

      {editor && canManage && (
        <section className="panel registration-panel">
          <h2>
            {editor.mode === "create" ? "Add department" : "Edit department"}
          </h2>

          <form
            key={editor.mode === "create" ? "create" : editor.department.id}
            onSubmit={save}
            aria-busy={saving}
          >
            <fieldset className="patient-fields" disabled={saving}>
              <legend className="sr-only">Department details</legend>

              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="department-code">Department code *</label>
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
                  />
                  <small id="department-code-help">
                    Codes cannot be changed after creation.
                  </small>
                </div>

                <div className="form-field">
                  <label htmlFor="department-name">Department name *</label>
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
                  />
                </div>
              </div>

              {editor.mode === "edit" && (
                <label className="department-active">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={editor.department.isActive}
                  />
                  <span>Department is active</span>
                </label>
              )}

              <p className="form-error" role="alert">
                {error}
              </p>

              {conflict && (
                <div className="conflict-notice">
                  <p>
                    Another update changed this department. Your edits remain
                    visible. Review or copy them before discarding this form.
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
                  {saving ? "Saving..." : "Save department"}
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

      <section className="panel" aria-labelledby="department-list-title">
        <div className="panel-heading">
          <div>
            <h2 id="department-list-title">Department directory</h2>
            <p className="muted" role="status">
              {loading
                ? "Loading departments..."
                : data
                  ? `${data.pagination.total} departments`
                  : "Department list unavailable"}
            </p>
          </div>

          <button
            className="secondary-button"
            type="button"
            disabled={loading || saving}
            onClick={() => setReload((value) => value + 1)}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="patient-feedback">Loading departments...</p>
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
        ) : !data?.items.length ? (
          <div className="empty-state">
            <h3>No departments found</h3>
            <p className="muted">
              An administrator can add the first department.
            </p>
          </div>
        ) : (
          <>
            <div
              className="table-scroll"
              role="region"
              aria-label="Department directory"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col">Department</th>
                    <th scope="col">Code</th>
                    <th scope="col">Status</th>
                    {canManage && <th scope="col">Action</th>}
                  </tr>
                </thead>

                <tbody>
                  {data.items.map((department) => (
                    <tr key={department.id}>
                      <th scope="row">{department.name}</th>
                      <td>{department.code}</td>
                      <td>
                        <span
                          className={`status ${
                            department.isActive ? "completed" : "inactive"
                          }`}
                        >
                          {department.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {canManage && (
                        <td>
                          <button
                            className="secondary-button"
                            type="button"
                            disabled={editor !== null || saving}
                            aria-label={`Edit ${department.name}`}
                            onClick={() =>
                              openEditor({ mode: "edit", department })
                            }
                          >
                            Edit
                          </button>
                        </td>
                      )}
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
                  disabled={page <= 1 || editor !== null}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </button>
                <button
                  className="secondary-button"
                  type="button"
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
      </section>
    </>
  );
}
