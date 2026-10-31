"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import { useStaffUser } from "@/components/auth/StaffSessionGate";

type Medicine = {
  id: string;
  code: string;
  displayName: string;
  genericName: string | null;
  strength: string;
  dosageForm: string;
  isActive: boolean;
  version: number;
};

type ListResponse = {
  items: Medicine[];

  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type MedicineForm = {
  code: string;
  displayName: string;
  genericName: string;
  strength: string;
  dosageForm: string;
};

const emptyForm: MedicineForm = {
  code: "",
  displayName: "",
  genericName: "",
  strength: "",
  dosageForm: "",
};

const panel =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6";

const input =
  "mt-2 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50";

const button =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50";

const primary = `${button} border-teal-800 bg-teal-800! text-white hover:bg-teal-900!`;

const formFields = [
  {
    key: "code",
    label: "Medicine code",
    maxLength: 40,
    required: true,
    placeholder: "Your hospital catalogue code",
  },
  {
    key: "displayName",
    label: "Medicine display name",
    maxLength: 200,
    required: true,
    placeholder: "Name shown in the prescription picker",
  },
  {
    key: "genericName",
    label: "Generic name",
    maxLength: 200,
    required: false,
    placeholder: "Generic ingredient name",
  },
  {
    key: "strength",
    label: "Strength",
    maxLength: 100,
    required: true,
    placeholder: "Enter the verified product strength",
  },
  {
    key: "dosageForm",
    label: "Dosage form",
    maxLength: 100,
    required: true,
    placeholder: "Tablet, capsule, solution, etc.",
  },
] as const;

export default function MedicineWorkspace() {
  const user = useStaffUser();

  const canRead = user.permissions?.includes("medicines.read") ?? false;

  const canManage = user.permissions?.includes("medicines.manage") ?? false;

  const [form, setForm] = useState<MedicineForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const saveLock = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [status, setStatus] = useState<"true" | "false" | "all">("true");

  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);

  const requestKey = JSON.stringify([search, status, page, revision]);

  const [remote, setRemote] = useState<{
    key: string;
    data: ListResponse | null;
    error: string;
  } | null>(null);

  const data = remote?.key === requestKey ? remote.data : null;

  const loading = canRead && remote?.key !== requestKey;

  useEffect(() => {
    if (!canRead) return;

    let active = true;
    const controller = new AbortController();

    async function load() {
      const query = new URLSearchParams({
        page: String(page),
        limit: "20",
        active: status,
      });

      if (search) {
        query.set("search", search);
      }

      try {
        const result = await apiRequest<ListResponse>(
          `/medicines?${query.toString()}`,
          {
            signal: controller.signal,
          },
        );

        if (!active) return;

        setRemote({
          key: requestKey,
          data: result,
          error: "",
        });
      } catch (caught) {
        if (!active || controller.signal.aborted) return;

        setRemote({
          key: requestKey,
          data: null,
          error:
            caught instanceof Error
              ? caught.message
              : "Unable to load medicines.",
        });
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [canRead, search, status, page, requestKey]);

  useEffect(() => {
    if (!showForm) return;

    formRef.current?.querySelector<HTMLInputElement>("#medicine-code")?.focus();
  }, [showForm]);

  function change(key: keyof MedicineForm, value: string) {
    if (saveLock.current) return;

    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function addMedicine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage || saveLock.current) return;

    const code = form.code.trim().toUpperCase();
    const displayName = form.displayName.trim();
    const genericName = form.genericName.trim();
    const strength = form.strength.trim();
    const dosageForm = form.dosageForm.trim();

    setError("");
    setNotice("");

    if (!/^[A-Z0-9_-]{1,40}$/.test(code)) {
      setError(
        "Use letters, numbers, hyphens, or underscores for the medicine code.",
      );
      return;
    }

    if (!displayName || !strength || !dosageForm) {
      setError("Enter the medicine name, strength, and dosage form.");
      return;
    }

    saveLock.current = true;
    setSaving(true);

    try {
      await apiRequest("/medicines", {
        method: "POST",

        body: JSON.stringify({
          code,
          displayName,
          ...(genericName ? { genericName } : {}),
          strength,
          dosageForm,
        }),
      });

      setForm(emptyForm);
      setShowForm(false);

      // Show the new medicine in the active catalogue.
      setSearchInput("");
      setSearch("");
      setStatus("true");
      setPage(1);
      setRevision((current) => current + 1);

      setNotice(
        `${displayName} was added. It is now available in the active medicine catalogue.`,
      );
    } catch (caught) {
      const unconfirmed =
        !(caught instanceof ApiError) ||
        caught.status === 0 ||
        caught.status >= 500;

      if (unconfirmed) {
        setError(
          "The save result could not be confirmed. Refresh the catalogue and search for this medicine code before submitting again.",
        );
      } else {
        setError(caught.message);
      }
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  function searchMedicines(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setPage(1);
    setSearch(searchInput.trim());
    setRevision((current) => current + 1);
  }

  if (!canRead) {
    return (
      <section className={panel}>
        <h1 className="text-xl font-bold text-slate-950">Access unavailable</h1>

        <p role="alert" className="mt-2 text-sm text-slate-600">
          Your account cannot view the medicine catalogue.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-teal-700">
            Hospital catalogue
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Medicines
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Maintain medicine details used by doctors when preparing
            prescriptions.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            className={primary}
            disabled={saving}
            aria-expanded={showForm}
            aria-controls="add-medicine-panel"
            onClick={() => {
              if (saveLock.current) return;

              setShowForm((current) => !current);
              setError("");
            }}
          >
            {showForm ? "Hide form" : "+ Add medicine"}
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

      {error && (
        <p
          id="medicine-form-error"
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      {canManage && showForm && (
        <section
          id="add-medicine-panel"
          className={panel}
          aria-labelledby="add-medicine-title"
        >
          <h2
            id="add-medicine-title"
            className="text-xl font-bold text-slate-950"
          >
            Add medicine
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Enter verified catalogue details. New medicines are active by
            default.
          </p>

          <form
            ref={formRef}
            onSubmit={addMedicine}
            className="mt-5"
            aria-busy={saving}
            aria-describedby={error ? "medicine-form-error" : undefined}
          >
            <fieldset disabled={saving} className="min-w-0 border-0 p-0">
              <legend className="sr-only">Medicine details</legend>

              <div className="grid gap-5 sm:grid-cols-2">
                {formFields.map((field) => (
                  <div
                    key={field.key}
                    className={
                      field.key === "displayName" ? "sm:col-span-2" : ""
                    }
                  >
                    <label
                      htmlFor={`medicine-${field.key}`}
                      className="text-sm font-semibold text-slate-800"
                    >
                      {field.label}
                      {field.required ? " *" : " · optional"}
                    </label>

                    <input
                      id={`medicine-${field.key}`}
                      name={field.key}
                      className={input}
                      required={field.required}
                      maxLength={field.maxLength}
                      placeholder={field.placeholder}
                      value={form[field.key]}
                      autoComplete="off"
                      spellCheck={false}
                      pattern={
                        field.key === "code" ? "[A-Za-z0-9_-]{1,40}" : undefined
                      }
                      onChange={(event) =>
                        change(field.key, event.target.value)
                      }
                    />

                    {field.key === "code" && (
                      <p className="mt-2 text-xs text-slate-500">
                        Unique code. Letters, numbers, hyphens, and underscores
                        only.
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button type="submit" className={primary} disabled={saving}>
                  {saving ? "Adding medicine…" : "Add medicine"}
                </button>

                <button
                  type="button"
                  className={button}
                  disabled={saving}
                  onClick={() => {
                    if (
                      Object.values(form).some(
                        (value) => value.trim() !== "",
                      ) &&
                      !window.confirm("Clear the medicine details you entered?")
                    ) {
                      return;
                    }

                    setForm(emptyForm);
                    setError("");
                  }}
                >
                  Clear form
                </button>
              </div>
            </fieldset>
          </form>
        </section>
      )}

      <section className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Medicine catalogue
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {data
                ? `${data.pagination.total} matching medicines`
                : "Search and browse catalogue entries"}
            </p>
          </div>

          <button
            type="button"
            className={button}
            disabled={loading}
            onClick={() => setRevision((current) => current + 1)}
          >
            Refresh catalogue
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_200px]">
          <form onSubmit={searchMedicines} className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <label
                htmlFor="medicine-search"
                className="text-sm font-semibold text-slate-700"
              >
                Search medicines
              </label>

              <input
                id="medicine-search"
                type="search"
                className={input}
                placeholder="Name, generic name, or code"
                maxLength={200}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>

            <button type="submit" className={button}>
              Search
            </button>
          </form>

          <div>
            <label
              htmlFor="medicine-status"
              className="text-sm font-semibold text-slate-700"
            >
              Status
            </label>

            <select
              id="medicine-status"
              className={input}
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as "true" | "false" | "all");

                setPage(1);
              }}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
              <option value="all">All medicines</option>
            </select>
          </div>
        </div>

        {loading && (
          <p role="status" className="py-10 text-center text-sm text-slate-500">
            Loading medicines…
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

        {data && data.items.length === 0 && (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 px-5 py-10 text-center">
            <h3 className="font-semibold text-slate-900">No medicines found</h3>

            <p className="mt-2 text-sm text-slate-500">
              {search
                ? "Try another search or change the status filter."
                : canManage
                  ? "Use Add medicine to create your first catalogue entry."
                  : "Ask your hospital administrator to add catalogue entries."}
            </p>
          </div>
        )}

        {data && data.items.length > 0 && (
          <>
            <div className="mt-6 grid gap-3 md:hidden">
              {data.items.map((medicine) => (
                <article
                  key={medicine.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-xs font-bold text-teal-700">
                        {medicine.code}
                      </p>

                      <h3 className="mt-1 break-words font-semibold text-slate-950">
                        {medicine.displayName}
                      </h3>
                    </div>

                    <StatusBadge active={medicine.isActive} />
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="col-span-2">
                      <dt className="text-xs text-slate-500">Generic name</dt>

                      <dd className="mt-1 break-words text-slate-800">
                        {medicine.genericName || "—"}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs text-slate-500">Strength</dt>

                      <dd className="mt-1 break-words text-slate-800">
                        {medicine.strength}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs text-slate-500">Dosage form</dt>

                      <dd className="mt-1 break-words text-slate-800">
                        {medicine.dosageForm}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>

            <div className="mt-6 hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  Hospital medicine catalogue
                </caption>

                <thead className="border-y border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Medicine
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Generic name
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Strength
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Form
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {data.items.map((medicine) => (
                    <tr key={medicine.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-950">
                          {medicine.displayName}
                        </p>

                        <p className="mt-1 text-xs text-teal-700">
                          {medicine.code}
                        </p>
                      </td>

                      <td className="px-4 py-4 text-slate-600">
                        {medicine.genericName || "—"}
                      </td>

                      <td className="px-4 py-4 text-slate-600">
                        {medicine.strength}
                      </td>

                      <td className="px-4 py-4 text-slate-600">
                        {medicine.dosageForm}
                      </td>

                      <td className="px-4 py-4">
                        <StatusBadge active={medicine.isActive} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {data && (
          <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
            <p className="text-xs text-slate-500">
              Page {data.pagination.page} of{" "}
              {Math.max(1, data.pagination.totalPages)}
              {" · "}
              {data.pagination.total} medicines
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                className={button}
                disabled={loading || page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous
              </button>

              <button
                type="button"
                className={button}
                disabled={loading || page >= data.pagination.totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          </footer>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
        active
          ? "bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-200"
          : "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}
