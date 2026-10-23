"use client";

import { useRef, useState } from "react";

import { useStaffUser } from "@/components/auth/StaffSessionGate";
import { apiRequest } from "@/lib/api";

const roles = [
  "ADMIN",
  "RECEPTIONIST",
  "DOCTOR",
  "NURSE",
  "LAB_TECHNICIAN",
  "LAB_REVIEWER",
  "PHARMACIST",
  "BILLING",
] as const;

interface StaffAccount {
  id: string;
  fullName: string;
  email: string;
  roles: string[];
  isActive: boolean;
  mustChangePassword: boolean;
  doctorProfile: {
    id: string;
    displayName: string;
  } | null;
}

interface StaffResponse {
  items: StaffAccount[];
  pagination: {
    page: number;
    totalPages: number;
    total: number;
  };
}

const emptyForm = {
  fullName: "",
  email: "",
  temporaryPassword: "",
  role: "RECEPTIONIST",
  addressLine1: "",
  addressLine2: "",
  city: "",
  district: "",
  state: "",
  postalCode: "",
  countryCode: "IN",
};

const addressFields = [
  { name: "addressLine1", label: "Address line 1", max: 200 },
  { name: "addressLine2", label: "Address line 2", max: 200 },
  { name: "city", label: "City", max: 100 },
  { name: "district", label: "District", max: 100 },
  { name: "state", label: "State", max: 100 },
  { name: "postalCode", label: "Postal code", max: 20 },
  { name: "countryCode", label: "Country code", max: 2 },
] as const;

function roleLabel(role: string): string {
  return role.replaceAll("_", " ");
}

function errorText(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The request could not be completed.";
}

export default function StaffWorkspace() {
  const user = useStaffUser();

  const canRead = user.permissions?.includes("staff.read") ?? false;
  const canManage = user.permissions?.includes("staff.manage") ?? false;

  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");

  const [applied, setApplied] = useState({
    search: "",
    role: "",
    status: "",
  });

  const [result, setResult] = useState<StaffResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const [listError, setListError] = useState("");
  const [createError, setCreateError] = useState("");
  const [notice, setNotice] = useState("");

  const createLock = useRef(false);
  const listLock = useRef(false);

  const busy = loading || creating;

  async function load(filters: typeof applied, page = 1): Promise<void> {
    if (listLock.current) return;

    listLock.current = true;
    setLoading(true);
    setListError("");

    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: "20",
      });

      if (filters.search) query.set("search", filters.search);
      if (filters.role) query.set("role", filters.role);
      if (filters.status) query.set("status", filters.status);

      const response = await apiRequest<StaffResponse>(`/staff?${query}`);

      setResult(response);
      setApplied({ ...filters });
    } catch (error) {
      setListError(errorText(error));
    } finally {
      listLock.current = false;
      setLoading(false);
    }
  }

  async function createAccount() {
    if (createLock.current || !canManage || busy) return;

    createLock.current = true;
    setCreating(true);
    setCreateError("");
    setNotice("");

    try {
      const address = Object.fromEntries(
        addressFields
          .map(({ name }) => [name, form[name].trim()] as const)
          .filter(([, value]) => value.length > 0),
      );

      const response = await apiRequest<{ user: StaffAccount }>("/staff", {
        method: "POST",
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          temporaryPassword: form.temporaryPassword,
          roles: [form.role],
          ...address,
        }),
      });

      setForm({ ...emptyForm });

      setNotice(
        `${response.user.fullName}'s account was created. They must change their temporary password at first login.`,
      );

      const filters = {
        search: response.user.email,
        role: "",
        status: "",
      };

      setSearch(filters.search);
      setRole("");
      setStatus("");

      await load(filters);
    } catch (error) {
      setCreateError(
        `${errorText(error)} If the connection failed, search for the email before submitting again.`,
      );
    } finally {
      createLock.current = false;
      setCreating(false);
    }
  }

  if (!canRead) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          Access unavailable
        </h1>
        <p>Your account cannot view staff administration.</p>
      </section>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="mb-2 text-[11px] font-bold tracking-[0.18em] text-teal-800">
            Administration
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Staff accounts
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Create hospital staff accounts and review assigned roles.
          </p>
        </div>
      </header>

      {canManage && (
        <details className="group rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <summary className="flex min-h-12 cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded-xl text-base font-semibold text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 [&::-webkit-details-marker]:hidden">
            <span>
              Create staff account
              <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
                Set up a staff login, role and address.
              </span>
            </span>
            <span className="rounded-xl bg-teal-800 px-4 py-3 text-sm font-semibold text-white">
              <span className="group-open:hidden">+ Add staff</span>
              <span className="hidden group-open:inline">Close form</span>
            </span>
          </summary>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void createAccount();
            }}
          >
            <fieldset
              className="mt-5 min-w-0 rounded-xl border border-slate-200 p-4 sm:p-5 disabled:opacity-70 [&>legend]:px-2 [&>legend]:text-sm [&>legend]:font-semibold [&>legend]:text-slate-900"
              disabled={busy}
            >
              <legend className="mt-2 text-sm leading-6 text-slate-500">
                Account details
              </legend>

              <div className="mt-3 grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                <label className="block min-w-0 text-xs font-semibold text-slate-600 [&>span]:block [&>input]:mt-2 [&>input]:block [&>input]:min-h-12 [&>input]:w-full [&>input]:min-w-0 [&>input]:rounded-xl [&>input]:border [&>input]:border-slate-300 [&>input]:bg-white [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:font-normal [&>input]:text-slate-900 [&>input:disabled]:bg-slate-50 [&>select]:mt-2 [&>select]:block [&>select]:min-h-12 [&>select]:w-full [&>select]:min-w-0 [&>select]:rounded-xl [&>select]:border [&>select]:border-slate-300 [&>select]:bg-white [&>select]:px-3 [&>select]:py-2 [&>select]:text-sm [&>select]:font-normal [&>select]:text-slate-900 [&>select:disabled]:bg-slate-50 [&>input:focus-visible]:outline-2 [&>input:focus-visible]:outline-offset-2 [&>input:focus-visible]:outline-teal-700 [&>select:focus-visible]:outline-2 [&>select:focus-visible]:outline-offset-2 [&>select:focus-visible]:outline-teal-700">
                  <span>Full name</span>
                  <input
                    required
                    minLength={2}
                    maxLength={100}
                    autoComplete="off"
                    value={form.fullName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        fullName: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="block min-w-0 text-xs font-semibold text-slate-600 [&>span]:block [&>input]:mt-2 [&>input]:block [&>input]:min-h-12 [&>input]:w-full [&>input]:min-w-0 [&>input]:rounded-xl [&>input]:border [&>input]:border-slate-300 [&>input]:bg-white [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:font-normal [&>input]:text-slate-900 [&>input:disabled]:bg-slate-50 [&>select]:mt-2 [&>select]:block [&>select]:min-h-12 [&>select]:w-full [&>select]:min-w-0 [&>select]:rounded-xl [&>select]:border [&>select]:border-slate-300 [&>select]:bg-white [&>select]:px-3 [&>select]:py-2 [&>select]:text-sm [&>select]:font-normal [&>select]:text-slate-900 [&>select:disabled]:bg-slate-50 [&>input:focus-visible]:outline-2 [&>input:focus-visible]:outline-offset-2 [&>input:focus-visible]:outline-teal-700 [&>select:focus-visible]:outline-2 [&>select:focus-visible]:outline-offset-2 [&>select:focus-visible]:outline-teal-700">
                  <span>Email</span>
                  <input
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="off"
                    value={form.email}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="block min-w-0 text-xs font-semibold text-slate-600 [&>span]:block [&>input]:mt-2 [&>input]:block [&>input]:min-h-12 [&>input]:w-full [&>input]:min-w-0 [&>input]:rounded-xl [&>input]:border [&>input]:border-slate-300 [&>input]:bg-white [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:font-normal [&>input]:text-slate-900 [&>input:disabled]:bg-slate-50 [&>select]:mt-2 [&>select]:block [&>select]:min-h-12 [&>select]:w-full [&>select]:min-w-0 [&>select]:rounded-xl [&>select]:border [&>select]:border-slate-300 [&>select]:bg-white [&>select]:px-3 [&>select]:py-2 [&>select]:text-sm [&>select]:font-normal [&>select]:text-slate-900 [&>select:disabled]:bg-slate-50 [&>input:focus-visible]:outline-2 [&>input:focus-visible]:outline-offset-2 [&>input:focus-visible]:outline-teal-700 [&>select:focus-visible]:outline-2 [&>select:focus-visible]:outline-offset-2 [&>select:focus-visible]:outline-teal-700">
                  <span>Role</span>
                  <select
                    value={form.role}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        role: event.target.value,
                      }))
                    }
                  >
                    {roles.map((item) => (
                      <option key={item} value={item}>
                        {roleLabel(item)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block min-w-0 text-xs font-semibold text-slate-600 [&>span]:block [&>input]:mt-2 [&>input]:block [&>input]:min-h-12 [&>input]:w-full [&>input]:min-w-0 [&>input]:rounded-xl [&>input]:border [&>input]:border-slate-300 [&>input]:bg-white [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:font-normal [&>input]:text-slate-900 [&>input:disabled]:bg-slate-50 [&>select]:mt-2 [&>select]:block [&>select]:min-h-12 [&>select]:w-full [&>select]:min-w-0 [&>select]:rounded-xl [&>select]:border [&>select]:border-slate-300 [&>select]:bg-white [&>select]:px-3 [&>select]:py-2 [&>select]:text-sm [&>select]:font-normal [&>select]:text-slate-900 [&>select:disabled]:bg-slate-50 [&>input:focus-visible]:outline-2 [&>input:focus-visible]:outline-offset-2 [&>input:focus-visible]:outline-teal-700 [&>select:focus-visible]:outline-2 [&>select:focus-visible]:outline-offset-2 [&>select:focus-visible]:outline-teal-700">
                  <span>Temporary password</span>
                  <input
                    type="password"
                    required
                    minLength={15}
                    maxLength={128}
                    autoComplete="new-password"
                    aria-describedby="staff-password-help"
                    value={form.temporaryPassword}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        temporaryPassword: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <p
                id="staff-password-help"
                className="mt-2 text-sm leading-6 text-slate-500"
              >
                Use a unique password of 15–128 characters. The staff member
                must change it at first login.
              </p>
            </fieldset>

            <fieldset
              className="mt-5 min-w-0 rounded-xl border border-slate-200 p-4 sm:p-5 disabled:opacity-70 [&>legend]:px-2 [&>legend]:text-sm [&>legend]:font-semibold [&>legend]:text-slate-900"
              disabled={busy}
            >
              <legend className="mt-2 text-sm leading-6 text-slate-500">
                Address
              </legend>

              <div className="mt-3 grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {addressFields.map((field) => (
                  <label
                    className="block min-w-0 text-xs font-semibold text-slate-600 [&>span]:block [&>input]:mt-2 [&>input]:block [&>input]:min-h-12 [&>input]:w-full [&>input]:min-w-0 [&>input]:rounded-xl [&>input]:border [&>input]:border-slate-300 [&>input]:bg-white [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:font-normal [&>input]:text-slate-900 [&>input:disabled]:bg-slate-50 [&>select]:mt-2 [&>select]:block [&>select]:min-h-12 [&>select]:w-full [&>select]:min-w-0 [&>select]:rounded-xl [&>select]:border [&>select]:border-slate-300 [&>select]:bg-white [&>select]:px-3 [&>select]:py-2 [&>select]:text-sm [&>select]:font-normal [&>select]:text-slate-900 [&>select:disabled]:bg-slate-50 [&>input:focus-visible]:outline-2 [&>input:focus-visible]:outline-offset-2 [&>input:focus-visible]:outline-teal-700 [&>select:focus-visible]:outline-2 [&>select:focus-visible]:outline-offset-2 [&>select:focus-visible]:outline-teal-700"
                    key={field.name}
                  >
                    <span>{field.label}</span>
                    <input
                      value={form[field.name]}
                      maxLength={field.max}
                      pattern={
                        field.name === "countryCode" ? "[A-Za-z]{2}" : undefined
                      }
                      onChange={(event) => {
                        const value =
                          field.name === "countryCode"
                            ? event.target.value.toUpperCase()
                            : event.target.value;

                        setForm((current) => ({
                          ...current,
                          [field.name]: value,
                        }));
                      }}
                    />
                  </label>
                ))}
              </div>
            </fieldset>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Share the temporary password directly with the staff member. This
              page does not send an email.
            </p>

            {form.role === "ADMIN" && (
              <p className="my-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                Administrator accounts can manage staff and hospital
                configuration. Check the selected role before creating.
              </p>
            )}

            <div aria-live="polite">
              {createError && (
                <p
                  className="my-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
                  role="alert"
                >
                  {createError}
                </p>
              )}
              {notice && (
                <p className="my-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm leading-6 text-teal-950">
                  {notice}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy}
            >
              {creating ? "Creating account..." : "Create account"}
            </button>
          </form>
        </details>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight text-slate-950">
          Staff directory
        </h2>

        <form
          className="mt-5 mb-5 grid min-w-0 items-end gap-4 border-b border-slate-100 pb-6 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            void load({
              search: search.trim(),
              role,
              status,
            });
          }}
        >
          <label className="block min-w-0 text-xs font-semibold text-slate-600 [&>span]:block [&>input]:mt-2 [&>input]:block [&>input]:min-h-12 [&>input]:w-full [&>input]:min-w-0 [&>input]:rounded-xl [&>input]:border [&>input]:border-slate-300 [&>input]:bg-white [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:font-normal [&>input]:text-slate-900 [&>input:disabled]:bg-slate-50 [&>select]:mt-2 [&>select]:block [&>select]:min-h-12 [&>select]:w-full [&>select]:min-w-0 [&>select]:rounded-xl [&>select]:border [&>select]:border-slate-300 [&>select]:bg-white [&>select]:px-3 [&>select]:py-2 [&>select]:text-sm [&>select]:font-normal [&>select]:text-slate-900 [&>select:disabled]:bg-slate-50 [&>input:focus-visible]:outline-2 [&>input:focus-visible]:outline-offset-2 [&>input:focus-visible]:outline-teal-700 [&>select:focus-visible]:outline-2 [&>select:focus-visible]:outline-offset-2 [&>select:focus-visible]:outline-teal-700">
            <span>Name or email</span>
            <input
              value={search}
              maxLength={100}
              disabled={busy}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <label className="block min-w-0 text-xs font-semibold text-slate-600 [&>span]:block [&>input]:mt-2 [&>input]:block [&>input]:min-h-12 [&>input]:w-full [&>input]:min-w-0 [&>input]:rounded-xl [&>input]:border [&>input]:border-slate-300 [&>input]:bg-white [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:font-normal [&>input]:text-slate-900 [&>input:disabled]:bg-slate-50 [&>select]:mt-2 [&>select]:block [&>select]:min-h-12 [&>select]:w-full [&>select]:min-w-0 [&>select]:rounded-xl [&>select]:border [&>select]:border-slate-300 [&>select]:bg-white [&>select]:px-3 [&>select]:py-2 [&>select]:text-sm [&>select]:font-normal [&>select]:text-slate-900 [&>select:disabled]:bg-slate-50 [&>input:focus-visible]:outline-2 [&>input:focus-visible]:outline-offset-2 [&>input:focus-visible]:outline-teal-700 [&>select:focus-visible]:outline-2 [&>select:focus-visible]:outline-offset-2 [&>select:focus-visible]:outline-teal-700">
            <span>Role</span>
            <select
              value={role}
              disabled={busy}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="">All roles</option>
              {roles.map((item) => (
                <option key={item} value={item}>
                  {roleLabel(item)}
                </option>
              ))}
            </select>
          </label>

          <label className="block min-w-0 text-xs font-semibold text-slate-600 [&>span]:block [&>input]:mt-2 [&>input]:block [&>input]:min-h-12 [&>input]:w-full [&>input]:min-w-0 [&>input]:rounded-xl [&>input]:border [&>input]:border-slate-300 [&>input]:bg-white [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:font-normal [&>input]:text-slate-900 [&>input:disabled]:bg-slate-50 [&>select]:mt-2 [&>select]:block [&>select]:min-h-12 [&>select]:w-full [&>select]:min-w-0 [&>select]:rounded-xl [&>select]:border [&>select]:border-slate-300 [&>select]:bg-white [&>select]:px-3 [&>select]:py-2 [&>select]:text-sm [&>select]:font-normal [&>select]:text-slate-900 [&>select:disabled]:bg-slate-50 [&>input:focus-visible]:outline-2 [&>input:focus-visible]:outline-offset-2 [&>input:focus-visible]:outline-teal-700 [&>select:focus-visible]:outline-2 [&>select:focus-visible]:outline-offset-2 [&>select:focus-visible]:outline-teal-700">
            <span>Status</span>
            <select
              value={status}
              disabled={busy}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

          <button
            type="submit"
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy}
          >
            {loading ? "Loading..." : "Search staff"}
          </button>
        </form>

        {loading && (
          <p role="status" className="my-4 text-sm text-slate-500">
            Loading staff accounts…
          </p>
        )}
        {listError && (
          <p
            className="my-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
            role="alert"
          >
            {listError}
          </p>
        )}

        {!result && !loading && (
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Select Search staff to load the directory.
          </p>
        )}

        {result && (
          <>
            <p className="mt-2 text-sm leading-6 text-slate-500" role="status">
              {result.pagination.total} matching accounts
            </p>

            {result.items.length === 0 ? (
              <p className="mt-5 rounded-xl border border-dashed border-slate-300 px-5 py-10 text-center text-sm text-slate-500 lg:hidden">
                No matching staff accounts. Try another name, role or status.
              </p>
            ) : (
              <ul
                className="mt-5 grid list-none gap-4 sm:grid-cols-2 lg:hidden"
                aria-label="Staff accounts"
              >
                {result.items.map((account) => (
                  <li
                    key={account.id}
                    className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-base font-semibold text-slate-950">
                          {account.fullName}
                        </h3>
                        <p className="mt-1 break-all text-xs leading-5 text-slate-500">
                          {account.email}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${account.isActive ? "bg-teal-50 text-teal-900" : "bg-slate-100 text-slate-600"}`}
                      >
                        {account.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {account.roles.map((item) => (
                        <span
                          key={item}
                          className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600"
                        >
                          {roleLabel(item)}
                        </span>
                      ))}
                    </div>
                    <dl className="mt-4 grid gap-4 border-t border-slate-100 pt-4">
                      <div>
                        <dt className="text-xs text-slate-500">
                          Password status
                        </dt>
                        <dd className="mt-1 text-sm text-slate-700">
                          {account.mustChangePassword
                            ? "Password change required"
                            : "Initial password changed"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">
                          Doctor profile
                        </dt>
                        <dd className="mt-1 break-words text-sm text-slate-700">
                          {account.doctorProfile?.displayName ?? "Not linked"}
                        </dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 hidden overflow-x-auto rounded-xl border border-slate-200 lg:block">
              <table
                className="w-full min-w-[850px] border-collapse text-left"
                aria-busy={loading}
              >
                <caption className="sr-only">
                  Staff account names, login emails, roles, status and linked
                  doctor profiles
                </caption>
                <thead className="bg-slate-50">
                  <tr>
                    <th
                      scope="col"
                      className="border-b border-slate-200 px-5 py-3.5 text-[11px] font-semibold tracking-wide text-slate-500"
                    >
                      Staff member
                    </th>
                    <th
                      scope="col"
                      className="border-b border-slate-200 px-5 py-3.5 text-[11px] font-semibold tracking-wide text-slate-500"
                    >
                      Roles
                    </th>
                    <th
                      scope="col"
                      className="border-b border-slate-200 px-5 py-3.5 text-[11px] font-semibold tracking-wide text-slate-500"
                    >
                      Account
                    </th>
                    <th
                      scope="col"
                      className="border-b border-slate-200 px-5 py-3.5 text-[11px] font-semibold tracking-wide text-slate-500"
                    >
                      Doctor profile
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.items.map((account) => (
                    <tr key={account.id} className="hover:bg-slate-50/70">
                      <td className="max-w-72 break-words px-5 py-5 align-top text-sm text-slate-700">
                        <strong>{account.fullName}</strong>
                        <div className="mt-2 text-sm leading-6 text-slate-500">
                          {account.email}
                        </div>
                      </td>
                      <td className="max-w-72 break-words px-5 py-5 align-top text-sm text-slate-700">
                        <div className="flex flex-wrap gap-1.5">
                          {account.roles.map((item) => (
                            <span
                              key={item}
                              className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600"
                            >
                              {roleLabel(item)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="max-w-72 break-words px-5 py-5 align-top text-sm text-slate-700">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${account.isActive ? "bg-teal-50 text-teal-900" : "bg-slate-100 text-slate-600"}`}
                        >
                          {account.isActive ? "Active" : "Inactive"}
                        </span>
                        {account.mustChangePassword && (
                          <span className="mt-2 text-sm leading-6 text-slate-500">
                            Password change required
                          </span>
                        )}
                      </td>
                      <td className="max-w-72 break-words px-5 py-5 align-top text-sm text-slate-700">
                        {account.doctorProfile?.displayName ?? "Not linked"}
                      </td>
                    </tr>
                  ))}

                  {result.items.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-10 text-center text-sm text-slate-500"
                      >
                        No matching staff accounts.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={busy || result.pagination.page <= 1}
                onClick={() => void load(applied, result.pagination.page - 1)}
              >
                Previous
              </button>

              <span className="mt-2 text-sm leading-6 text-slate-500">
                Page {result.pagination.page} of{" "}
                {Math.max(1, result.pagination.totalPages)}
              </span>

              <button
                type="button"
                className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  busy || result.pagination.page >= result.pagination.totalPages
                }
                onClick={() => void load(applied, result.pagination.page + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
