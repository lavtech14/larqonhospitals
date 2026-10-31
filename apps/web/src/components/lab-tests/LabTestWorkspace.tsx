"use client";
import LabParameterEditor from "./LabParameterEditor";
import type { LabParameter } from "@/lib/lab-result-types";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import { useStaffUser } from "@/components/auth/StaffSessionGate";

type LabTest = {
  parameters: LabParameter[];
  id: string;
  code: string;
  displayName: string;
  sampleType: string;
  preparationInstructions: string | null;
  isActive: boolean;
  version: number;
};

type ListResponse = {
  items: LabTest[];

  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type FormValues = {
  parameters: LabParameter[];
  code: string;
  displayName: string;
  sampleType: string;
  preparationInstructions: string;
  isActive: boolean;
};

type SaveResult = {
  kind: "success" | "uncertain" | "failure";
  message: string;
};

const blankForm = (): FormValues => ({
  parameters: [],
  code: "",
  displayName: "",
  sampleType: "",
  preparationInstructions: "",
  isActive: true,
});

const panel =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6";

const input =
  "mt-2 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50";

const button =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50";

const primary = `${button} border-teal-800 bg-teal-800! text-white hover:bg-teal-900!`;

export default function LabTestWorkspace() {
  const user = useStaffUser();

  const canRead = user.permissions?.includes("lab-tests.read") ?? false;

  const canManage = user.permissions?.includes("lab-tests.manage") ?? false;

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [active, setActive] = useState<"true" | "false" | "all">("true");

  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);

  const [editor, setEditor] = useState<
    { kind: "create" } | { kind: "edit"; test: LabTest } | null
  >(null);

  const [editorKey, setEditorKey] = useState(0);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const saveLock = useRef(false);

  const requestKey = JSON.stringify([search, active, page, revision]);

  const [remote, setRemote] = useState<{
    key: string;
    data: ListResponse | null;
    error: string;
  } | null>(null);

  const data = remote?.key === requestKey ? remote.data : null;

  const loading = canRead && remote?.key !== requestKey;

  useEffect(() => {
    if (!canRead) return;

    let current = true;
    const controller = new AbortController();

    async function load() {
      const query = new URLSearchParams({
        page: String(page),
        limit: "20",
        active,
      });

      if (search) query.set("search", search);

      try {
        const result = await apiRequest<ListResponse>(`/lab-tests?${query}`, {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(45_000),
          ]),
        });

        if (!current) return;

        setRemote({
          key: requestKey,
          data: result,
          error: "",
        });
      } catch (caught) {
        if (!current || controller.signal.aborted) return;

        setRemote({
          key: requestKey,
          data: null,
          error:
            caught instanceof Error
              ? caught.message
              : "Unable to load lab tests.",
        });
      }
    }

    void load();

    return () => {
      current = false;
      controller.abort();
    };
  }, [canRead, search, active, page, requestKey]);

  async function save(values: FormValues): Promise<SaveResult> {
    if (!editor || !canManage || saveLock.current) {
      return {
        kind: "failure",
        message: "The form is unavailable.",
      };
    }

    saveLock.current = true;
    setSaving(true);
    setNotice("");

    const editing = editor.kind === "edit";

    try {
      await apiRequest(
        editing ? `/lab-tests/${editor.test.id}` : "/lab-tests",
        {
          method: editing ? "PUT" : "POST",

          body: JSON.stringify({
            parameters: values.parameters,
            code: values.code.trim().toUpperCase(),
            displayName: values.displayName.trim(),
            sampleType: values.sampleType.trim(),
            preparationInstructions: values.preparationInstructions.trim(),

            ...(editing
              ? {
                  expectedVersion: editor.test.version,
                  isActive: values.isActive,
                }
              : {}),
          }),
        },
      );

      setEditor(null);
      setRevision((value) => value + 1);

      setNotice(
        editing
          ? "Lab test updated. It may no longer match the current filters."
          : "Lab test added. New tests are active by default.",
      );

      return {
        kind: "success",
        message: "",
      };
    } catch (caught) {
      const uncertain =
        !(caught instanceof ApiError) ||
        caught.status === 0 ||
        caught.status >= 500;

      if (uncertain) {
        return {
          kind: "uncertain",
          message:
            "The save result is unconfirmed. Check the latest catalogue before submitting again.",
        };
      }

      return {
        kind: "failure",
        message:
          caught instanceof Error
            ? caught.message
            : "Unable to save this lab test.",
      };
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  function openEditor(
    next: { kind: "create" } | { kind: "edit"; test: LabTest },
  ) {
    if (saveLock.current) return;

    if (
      editor &&
      !window.confirm(
        "Replace the open form? Any unsaved form values will be lost.",
      )
    ) {
      return;
    }

    setEditor(next);
    setEditorKey((value) => value + 1);
    setNotice("");
  }

  if (!canRead) {
    return (
      <section className={panel}>
        <h1 className="text-xl font-bold">Access unavailable</h1>

        <p role="alert" className="mt-2 text-sm text-slate-600">
          Your account cannot view the lab-test catalogue.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-teal-700">
            Laboratory
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Lab-test catalogue
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Manage test names, specimen requirements, and preparation
            instructions.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            className={primary}
            disabled={saving}
            onClick={() => openEditor({ kind: "create" })}
          >
            + Add lab test
          </button>
        )}
      </header>

      {notice && (
        <p
          role="status"
          className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900"
        >
          {notice}
        </p>
      )}

      {editor && canManage && (
        <LabTestForm
          key={editorKey}
          test={editor.kind === "edit" ? editor.test : null}
          saving={saving}
          onSave={save}
          onClose={() => {
            if (!saveLock.current) setEditor(null);
          }}
          onRefreshCatalogue={() => setRevision((value) => value + 1)}
        />
      )}

      <section className={panel}>
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Available tests</h2>

            <p className="mt-1 text-sm text-slate-500">
              {data
                ? `${data.pagination.total} matching tests`
                : "Search your hospital catalogue"}
            </p>
          </div>

          <button
            type="button"
            className={button}
            disabled={loading}
            onClick={() => setRevision((value) => value + 1)}
          >
            Refresh catalogue
          </button>
        </header>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_200px]">
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setSearch(searchInput.trim());
              setRevision((value) => value + 1);
            }}
          >
            <div className="min-w-0 flex-1">
              <label htmlFor="lab-search" className="text-sm font-semibold">
                Search
              </label>

              <input
                id="lab-search"
                type="search"
                maxLength={200}
                className={input}
                placeholder="Test name, code, or sample type"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>

            <button type="submit" className={button}>
              Search
            </button>
          </form>

          <label className="text-sm font-semibold">
            Status
            <select
              className={input}
              value={active}
              onChange={(event) => {
                setActive(event.target.value as "true" | "false" | "all");

                setPage(1);
              }}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
              <option value="all">All tests</option>
            </select>
          </label>
        </div>

        {loading && (
          <p role="status" className="py-10 text-center text-sm text-slate-500">
            Loading lab tests…
          </p>
        )}

        {remote?.key === requestKey && remote.error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800"
          >
            {remote.error} Use Refresh catalogue to retry.
          </p>
        )}

        {data && (
          <>
            {!data.items.length && (
              <div className="mt-6 rounded-xl border border-dashed border-slate-300 px-5 py-10 text-center">
                <h3 className="font-semibold">No lab tests found</h3>

                <p className="mt-2 text-sm text-slate-500">
                  Try another search, change the status filter, or add a
                  catalogue entry.
                </p>
              </div>
            )}

            <div className="mt-5 grid gap-4">
              {data.items.map((test) => (
                <article
                  key={test.id}
                  className="rounded-xl border border-slate-200 p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-xs font-bold text-teal-700">
                        {test.code}
                      </p>

                      <h3 className="mt-1 break-words text-lg font-semibold">
                        {test.displayName}
                      </h3>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        test.isActive
                          ? "bg-teal-50 text-teal-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {test.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-slate-600">
                    <span className="font-semibold">Sample type:</span>{" "}
                    {test.sampleType}
                  </p>

                  {test.preparationInstructions && (
                    <div className="mt-4 rounded-lg bg-slate-50 p-3">
                      <h4 className="text-xs font-semibold text-slate-500">
                        Preparation instructions
                      </h4>

                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                        {test.preparationInstructions}
                      </p>
                    </div>
                  )}

                  {canManage && (
                    <button
                      type="button"
                      className={`${button} mt-4`}
                      disabled={saving}
                      onClick={() =>
                        openEditor({
                          kind: "edit",
                          test,
                        })
                      }
                    >
                      Edit / change status
                    </button>
                  )}
                </article>
              ))}
            </div>

            <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <p className="text-xs text-slate-500">
                Page {data.pagination.page} of{" "}
                {Math.max(1, data.pagination.totalPages)}
                {" · "}
                {data.pagination.total} tests
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  className={button}
                  disabled={loading || page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </button>

                <button
                  type="button"
                  className={button}
                  disabled={loading || page >= data.pagination.totalPages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </button>
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}

function LabTestForm({
  test,
  saving,
  onSave,
  onClose,
  onRefreshCatalogue,
}: {
  test: LabTest | null;
  saving: boolean;
  onSave: (values: FormValues) => Promise<SaveResult>;
  onClose: () => void;
  onRefreshCatalogue: () => void;
}) {
  const [values, setValues] = useState<FormValues>(() =>
    test
      ? {
          parameters: test.parameters ?? [],
          code: test.code,
          displayName: test.displayName,
          sampleType: test.sampleType,
          preparationInstructions: test.preparationInstructions ?? "",
          isActive: test.isActive,
        }
      : blankForm(),
  );

  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [dirty, setDirty] = useState(false);

  const submitting = useRef(false);
  const firstInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstInput.current?.focus();
    firstInput.current?.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    if (!dirty && !saving && !uncertain) return;

    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warn);

    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, [dirty, saving, uncertain]);

  function change<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    if (saving || uncertain || submitting.current) return;

    setDirty(true);

    setValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || uncertain || submitting.current) return;

    setError("");

    if (
      !/^[A-Za-z0-9_-]{1,40}$/.test(values.code.trim()) ||
      !values.displayName.trim() ||
      !values.sampleType.trim()
    ) {
      setError("Enter a valid code, test name, and sample type.");
      return;
    }

    submitting.current = true;

    try {
      const result = await onSave(values);

      if (result.kind === "uncertain") {
        setUncertain(true);
      }

      if (result.kind !== "success") {
        setError(result.message);
      }
    } finally {
      submitting.current = false;
    }
  }

  return (
    <section className={panel}>
      <h2 className="text-xl font-bold">
        {test ? "Edit lab test" : "Add lab test"}
      </h2>

      <p className="mt-2 text-sm leading-6 text-slate-600">
        Enter details verified by your hospital laboratory.
        {test
          ? " Deactivating keeps the entry in the catalogue."
          : " New entries are active by default."}
      </p>

      {error && (
        <p
          id="lab-form-error"
          role="alert"
          className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      {uncertain && (
        <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
          <p>
            Automatic resubmission is paused. Refresh the catalogue, check
            whether your changes were saved, then close this form and reopen the
            latest record if needed.
          </p>

          <button
            type="button"
            className={`${button} mt-3`}
            onClick={onRefreshCatalogue}
          >
            Refresh catalogue to check
          </button>
        </div>
      )}

      <form
        onSubmit={submit}
        className="mt-5"
        aria-busy={saving}
        aria-describedby={error ? "lab-form-error" : undefined}
      >
        <fieldset
          disabled={saving || uncertain}
          className="min-w-0 space-y-5 border-0 p-0"
        >
          <legend className="sr-only">Lab-test details</legend>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Test code *
              <input
                ref={firstInput}
                className={input}
                required
                maxLength={40}
                pattern="[A-Za-z0-9_-]{1,40}"
                autoComplete="off"
                value={values.code}
                onChange={(event) => change("code", event.target.value)}
              />
            </label>

            <label className="text-sm font-semibold">
              Test name *
              <input
                className={input}
                required
                maxLength={200}
                value={values.displayName}
                onChange={(event) => change("displayName", event.target.value)}
              />
            </label>

            <label className="text-sm font-semibold sm:col-span-2">
              Sample type *
              <input
                className={input}
                required
                maxLength={100}
                value={values.sampleType}
                onChange={(event) => change("sampleType", event.target.value)}
              />
            </label>
          </div>

          <label className="block text-sm font-semibold">
            Preparation instructions · optional
            <textarea
              className={input}
              rows={4}
              maxLength={2000}
              value={values.preparationInstructions}
              onChange={(event) =>
                change("preparationInstructions", event.target.value)
              }
            />
          </label>

          <LabParameterEditor
            values={values.parameters}
            onChange={(parameters) => change("parameters", parameters)}
            disabled={saving || uncertain}
          />

          {test && (
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 size-4"
                checked={values.isActive}
                onChange={(event) => change("isActive", event.target.checked)}
              />

              <span>
                <span className="block font-semibold">
                  Active catalogue entry
                </span>

                <span className="mt-1 block text-slate-500">
                  Inactive entries are excluded from active catalogue searches.
                </span>
              </span>
            </label>
          )}

          <button
            type="submit"
            className={primary}
            disabled={saving || uncertain || !dirty}
          >
            {saving ? "Saving…" : test ? "Save changes" : "Add lab test"}
          </button>
        </fieldset>
      </form>

      <button
        type="button"
        className={`${button} mt-3`}
        disabled={saving}
        onClick={() => {
          if (
            (dirty || uncertain) &&
            !window.confirm(
              uncertain
                ? "Close this form? The save result is still unconfirmed. Check the catalogue before creating another entry."
                : "Close and discard unsaved form changes?",
            )
          ) {
            return;
          }

          onClose();
        }}
      >
        Close form
      </button>
    </section>
  );
}
