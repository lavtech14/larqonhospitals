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
      <section className="panel">
        <h1>Access unavailable</h1>
        <p>Your account cannot view staff administration.</p>
      </section>
    );
  }

  return (
    <div className="staff-workspace">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Staff accounts</h1>
          <p className="muted">
            Create hospital staff accounts and review assigned roles.
          </p>
        </div>
      </header>

      {canManage && (
        <section className="panel">
          <h2>Create staff account</h2>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void createAccount();
            }}
          >
            <fieldset className="staff-form-fieldset" disabled={busy}>
              <legend className="muted">Account details</legend>

              <div className="staff-form-grid">
                <label className="form-field">
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

                <label className="form-field">
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

                <label className="form-field">
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

                <label className="form-field">
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

              <p id="staff-password-help" className="muted">
                Use a unique password of 15–128 characters. The staff member
                must change it at first login.
              </p>
            </fieldset>

            <fieldset className="staff-form-fieldset" disabled={busy}>
              <legend className="muted">Address</legend>

              <div className="staff-form-grid">
                {addressFields.map((field) => (
                  <label className="form-field" key={field.name}>
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

            <p className="muted">
              Share the temporary password directly with the staff member. This
              page does not send an email.
            </p>

            {form.role === "ADMIN" && (
              <p className="staff-admin-notice">
                Administrator accounts can manage staff and hospital
                configuration. Check the selected role before creating.
              </p>
            )}

            <div aria-live="polite">
              {createError && (
                <p className="form-error" role="alert">
                  {createError}
                </p>
              )}
              {notice && <p className="success-message">{notice}</p>}
            </div>

            <button type="submit" className="primary-button" disabled={busy}>
              {creating ? "Creating account..." : "Create account"}
            </button>
          </form>
        </section>
      )}

      <section className="panel">
        <h2>Staff directory</h2>

        <form
          className="staff-filter-bar"
          onSubmit={(event) => {
            event.preventDefault();
            void load({
              search: search.trim(),
              role,
              status,
            });
          }}
        >
          <label className="form-field">
            <span>Name or email</span>
            <input
              value={search}
              maxLength={100}
              disabled={busy}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <label className="form-field">
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

          <label className="form-field">
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

          <button type="submit" className="secondary-button" disabled={busy}>
            {loading ? "Loading..." : "Search staff"}
          </button>
        </form>

        {listError && (
          <p className="form-error" role="alert">
            {listError}
          </p>
        )}

        {!result && !loading && (
          <p className="muted">Select Search staff to load the directory.</p>
        )}

        {result && (
          <>
            <p className="muted" role="status">
              {result.pagination.total} matching accounts
            </p>

            <div className="table-scroll">
              <table className="staff-table" aria-busy={loading}>
                <thead>
                  <tr>
                    <th scope="col">Staff member</th>
                    <th scope="col">Roles</th>
                    <th scope="col">Account</th>
                    <th scope="col">Doctor profile</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((account) => (
                    <tr key={account.id}>
                      <td>
                        <strong>{account.fullName}</strong>
                        <div className="muted">{account.email}</div>
                      </td>
                      <td>{account.roles.map(roleLabel).join(", ")}</td>
                      <td>
                        <div>{account.isActive ? "Active" : "Inactive"}</div>
                        {account.mustChangePassword && (
                          <span className="muted">
                            Password change required
                          </span>
                        )}
                      </td>
                      <td>
                        {account.doctorProfile?.displayName ?? "Not linked"}
                      </td>
                    </tr>
                  ))}

                  {result.items.length === 0 && (
                    <tr>
                      <td colSpan={4}>No matching staff accounts.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="staff-pagination">
              <button
                type="button"
                className="secondary-button"
                disabled={busy || result.pagination.page <= 1}
                onClick={() => void load(applied, result.pagination.page - 1)}
              >
                Previous
              </button>

              <span className="muted">
                Page {result.pagination.page} of{" "}
                {Math.max(1, result.pagination.totalPages)}
              </span>

              <button
                type="button"
                className="secondary-button"
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
