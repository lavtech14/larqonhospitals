"use client";

import { useRef, useState } from "react";
import { apiRequest } from "@/lib/api";

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
  };
}

interface Props {
  doctorId?: string;
  initialStaffUserId: string | null;
  disabled: boolean;
}

export default function DoctorStaffPicker({
  doctorId,
  initialStaffUserId,
  disabled,
}: Props) {
  const [selectedId, setSelectedId] = useState(initialStaffUserId ?? "");
  const [selectedLabel, setSelectedLabel] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [result, setResult] = useState<StaffResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const requestLock = useRef(false);

  async function load(page: number, term: string) {
    if (disabled || requestLock.current) return;

    requestLock.current = true;
    setLoading(true);
    setError("");

    try {
      const query = new URLSearchParams({
        role: "DOCTOR",
        status: "active",
        page: String(page),
        limit: "10",
      });

      if (term) query.set("search", term);

      const response = await apiRequest<StaffResponse>(`/staff?${query}`);

      setResult(response);
      setAppliedSearch(term);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load staff accounts.",
      );
    } finally {
      requestLock.current = false;
      setLoading(false);
    }
  }

  return (
    <section
      className="doctor-staff-picker"
      aria-labelledby="doctor-staff-title"
      aria-busy={loading}
    >
      <h3 id="doctor-staff-title">Staff login account</h3>

      <p className="muted">
        Linking connects an existing staff login to this doctor profile. It does
        not verify professional credentials.
      </p>

      <input type="hidden" name="staffUserId" value={selectedId} />

      <div className="doctor-staff-selection" aria-live="polite">
        {selectedId ? (
          <>
            <strong>{selectedLabel || "Current linked account"}</strong>
            <div className="record-id">{selectedId}</div>
          </>
        ) : (
          <span>No staff account linked.</span>
        )}
      </div>

      <div className="doctor-staff-controls">
        <label className="form-field">
          <span>Search doctor staff by name or email</span>
          <input
            value={search}
            maxLength={100}
            disabled={disabled || loading}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void load(1, search.trim());
              }
            }}
          />
        </label>

        <button
          type="button"
          className="secondary-button"
          disabled={disabled || loading}
          onClick={() => void load(1, search.trim())}
        >
          {loading ? "Loading..." : "Find accounts"}
        </button>

        <button
          type="button"
          className="secondary-button"
          disabled={disabled || loading || !selectedId}
          onClick={() => {
            setSelectedId("");
            setSelectedLabel("");
          }}
        >
          Remove link
        </button>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {result && (
        <>
          <ul className="doctor-staff-results">
            {result.items.map((account) => {
              const linkedElsewhere =
                account.doctorProfile !== null &&
                account.doctorProfile.id !== doctorId;

              const eligible =
                account.isActive &&
                account.roles.includes("DOCTOR") &&
                !linkedElsewhere;

              return (
                <li key={account.id}>
                  <button
                    type="button"
                    className="doctor-staff-option"
                    aria-pressed={selectedId === account.id}
                    disabled={disabled || loading || !eligible}
                    onClick={() => {
                      setSelectedId(account.id);
                      setSelectedLabel(
                        `${account.fullName} · ${account.email}`,
                      );
                    }}
                  >
                    <strong>{account.fullName}</strong>
                    <span>{account.email}</span>

                    {linkedElsewhere && (
                      <span>
                        Already linked to {account.doctorProfile?.displayName}
                      </span>
                    )}

                    {account.mustChangePassword && (
                      <span>First-login password change required</span>
                    )}

                    {selectedId === account.id && <span>Selected</span>}
                  </button>
                </li>
              );
            })}
          </ul>

          {result.items.length === 0 && (
            <p className="muted">
              No matching active doctor accounts. Create one under Staff
              accounts if needed.
            </p>
          )}

          <div className="doctor-staff-controls">
            <button
              type="button"
              className="secondary-button"
              disabled={disabled || loading || result.pagination.page <= 1}
              onClick={() =>
                void load(result.pagination.page - 1, appliedSearch)
              }
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
                disabled ||
                loading ||
                result.pagination.page >= result.pagination.totalPages
              }
              onClick={() =>
                void load(result.pagination.page + 1, appliedSearch)
              }
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
