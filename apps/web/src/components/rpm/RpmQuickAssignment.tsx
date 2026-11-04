"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import { useStaffUser } from "@/components/auth/StaffSessionGate";

type Patient = {
  id: string;
  fullName: string;
  mrn: string;
  hasActivePortalAccount: boolean;
};

type Nurse = {
  id: string;
  fullName: string;
};

type NursePage = {
  items: Nurse[];
  pagination: {
    page: number;
    totalPages: number;
  };
};

type PendingRequest = {
  key: string;
  body: string;
};

type AssignmentResult = {
  replayed: boolean;
  assignment: {
    id: string;
    status: string;
    patient: {
      fullName: string;
      mrn: string;
    };
    nurse: {
      fullName: string;
    };
  };
};

function hospitalToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value;

  return `${part("year")}-${part("month")}-${part("day")}`;
}

export default function RpmQuickAssignment() {
  const user = useStaffUser();

  const allowed = Boolean(user.permissions?.includes("rpm.assign"));

  const [mrn, setMrn] = useState("");
  const [patient, setPatient] = useState<Patient | null>(null);
  const [patientBusy, setPatientBusy] = useState(false);
  const [patientError, setPatientError] = useState("");

  const [nurseSearchInput, setNurseSearchInput] = useState("");
  const [nurseSearch, setNurseSearch] = useState("");
  const [nursePage, setNursePage] = useState(1);
  const [nurseReload, setNurseReload] = useState(0);
  const [nurseResult, setNurseResult] = useState<NursePage | null>(null);
  const [selectedNurse, setSelectedNurse] = useState<Nurse | null>(null);
  const [nursesLoading, setNursesLoading] = useState(true);
  const [nurseError, setNurseError] = useState("");

  const [startDate, setStartDate] = useState(hospitalToday);
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<AssignmentResult | null>(null);

  const saveLock = useRef(false);
  const patientLock = useRef(false);

  useEffect(() => {
    if (!allowed) return;

    let cancelled = false;

    async function loadNurses() {
      try {
        const result = await apiRequest<NursePage>(
          `/rpm/nurses?page=${nursePage}&limit=10&search=${encodeURIComponent(nurseSearch)}`,
        );

        if (!cancelled) {
          setNurseResult(result);
          setNurseError("");
        }
      } catch (caught) {
        if (!cancelled) {
          setNurseResult(null);
          setNurseError(
            caught instanceof Error
              ? caught.message
              : "Unable to load nurse accounts.",
          );
        }
      } finally {
        if (!cancelled) setNursesLoading(false);
      }
    }

    void loadNurses();

    return () => {
      cancelled = true;
    };
  }, [allowed, nursePage, nurseSearch, nurseReload]);

  async function verifyPatient() {
    if (patientLock.current || busy || pending || !mrn.trim()) {
      return;
    }

    patientLock.current = true;
    setPatientBusy(true);
    setPatientError("");
    setPatient(null);

    try {
      const result = await apiRequest<Patient>(
        `/rpm/patient-lookup?search=${encodeURIComponent(mrn.trim())}`,
      );

      setPatient(result);
    } catch (caught) {
      setPatientError(
        caught instanceof Error
          ? caught.message
          : "Unable to verify the patient.",
      );
    } finally {
      patientLock.current = false;
      setPatientBusy(false);
    }
  }

  function searchNurses() {
    setNursesLoading(true);
    setNurseError("");
    setNursePage(1);
    setNurseSearch(nurseSearchInput.trim());
    setNurseReload((value) => value + 1);
  }

  function changeNursePage(next: number) {
    setNursesLoading(true);
    setNursePage(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saveLock.current || patientBusy || !allowed) {
      return;
    }

    setError("");

    let request = pending;

    if (!request) {
      if (!patient) {
        setError("Verify the patient first.");
        return;
      }

      if (!patient.hasActivePortalAccount) {
        setError(
          "This patient needs an active portal account before RPM can be assigned.",
        );
        return;
      }

      if (!selectedNurse) {
        setError("Select a nurse.");
        return;
      }

      if (!startDate || !endDate || endDate < startDate) {
        setError("Select valid start and end dates.");
        return;
      }

      if (endDate < hospitalToday()) {
        setError("The end date cannot be in the past.");
        return;
      }

      if (reason.trim().length < 3) {
        setError("Enter the reason for monitoring.");
        return;
      }

      request = {
        key: crypto.randomUUID(),

        body: JSON.stringify({
          patientId: patient.id,
          nurseStaffId: selectedNurse.id,
          startDate,
          endDate,
          reason: reason.trim(),
          notes: notes.trim(),
        }),
      };

      setPending(request);
    }

    saveLock.current = true;
    setBusy(true);

    try {
      const result = await apiRequest<AssignmentResult>("/rpm/assignments", {
        method: "POST",
        headers: {
          "Idempotency-Key": request.key,
        },
        body: request.body,
      });

      setPending(null);
      setSaved(result);
    } catch (caught) {
      const definiteRejection =
        caught instanceof ApiError &&
        [400, 401, 403, 404, 409, 422].includes(caught.status);

      if (definiteRejection) {
        setPending(null);
        setError(caught.message);
      } else {
        setError(
          "The result is unconfirmed. Stay on this page and select “Retry same assignment” to check safely.",
        );
      }
    } finally {
      saveLock.current = false;
      setBusy(false);
    }
  }

  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100";

  const secondaryButton =
    "min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40";

  const locked = busy || Boolean(pending) || patientBusy;

  if (!allowed) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-950">
          Access unavailable
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Your account cannot assign home monitoring.
        </p>
      </section>
    );
  }

  if (saved) {
    const assignment = saved.assignment;
    const scheduled = assignment.status === "SCHEDULED";

    return (
      <section className="mx-auto max-w-2xl rounded-2xl border border-teal-200 bg-white p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-teal-700">
          Assignment saved
        </p>

        <h1 className="mt-3 text-2xl font-bold text-slate-950">
          {scheduled ? "RPM scheduled" : "RPM assigned"}
        </h1>

        <dl className="mt-6 space-y-4 text-sm">
          <div>
            <dt className="text-slate-500">Patient</dt>
            <dd className="mt-1 font-semibold text-slate-900">
              {assignment.patient.fullName} · {assignment.patient.mrn}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">Assigned nurse</dt>
            <dd className="mt-1 font-semibold text-slate-900">
              {assignment.nurse.fullName}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">Status</dt>
            <dd className="mt-1 font-semibold text-slate-900">
              {assignment.status}
            </dd>
          </div>
        </dl>

        <p className="mt-5 text-sm leading-6 text-slate-600">
          {scheduled
            ? "The assignment is saved. Reading submission becomes available on its start date."
            : "The assignment is active. No separate plan or activation step is required."}
        </p>

        <Link
          href="/rpm"
          className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-teal-800 px-5 text-sm font-semibold text-white hover:bg-teal-900"
        >
          Back to home monitoring
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      {!pending && (
        <Link
          href="/rpm"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-800 hover:underline"
        >
          ← Home monitoring
        </Link>
      )}

      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-teal-700">
          Doctor workspace
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          Assign RPM
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          Assign a patient and nurse for daily home readings. No appointment or
          monitoring plan is required.
        </p>
      </header>

      <form onSubmit={submit} aria-busy={busy} className="space-y-5">
        <fieldset disabled={locked} className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-950">Patient</h2>

            <label
              htmlFor="rpm-mrn"
              className="mt-4 block text-sm font-semibold text-slate-800"
            >
              Patient MRN
            </label>

            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <input
                id="rpm-mrn"
                value={mrn}
                maxLength={30}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => {
                  setMrn(event.target.value);
                  setPatient(null);
                  setPatientError("");
                }}
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-3 text-sm focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />

              <button
                type="button"
                onClick={() => void verifyPatient()}
                className={secondaryButton}
              >
                {patientBusy ? "Checking…" : "Verify patient"}
              </button>
            </div>

            <p role="alert" className="mt-3 text-sm text-red-700">
              {patientError}
            </p>

            {patient && (
              <div role="status" className="mt-4 rounded-xl bg-teal-50 p-4">
                <p className="font-semibold text-teal-950">
                  {patient.fullName}
                </p>
                <p className="mt-1 text-sm text-teal-800">{patient.mrn}</p>

                {!patient.hasActivePortalAccount && (
                  <p className="mt-3 text-sm text-red-800">
                    An active patient portal account is required. Ask reception
                    or an administrator to set it up.
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-950">
              Assign nurse
            </h2>

            {selectedNurse && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-teal-50 p-4">
                <div>
                  <p className="text-sm font-semibold text-teal-950">
                    {selectedNurse.fullName}
                  </p>
                  <p className="mt-1 text-xs text-teal-800">
                    Account ID ending {selectedNurse.id.slice(-8)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedNurse(null)}
                  className="min-h-11 px-2 text-sm font-semibold text-teal-900"
                >
                  Clear
                </button>
              </div>
            )}

            <label
              htmlFor="rpm-nurse-search"
              className="mt-4 block text-sm font-semibold text-slate-800"
            >
              Search nurse name
            </label>

            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <input
                id="rpm-nurse-search"
                value={nurseSearchInput}
                maxLength={100}
                onChange={(event) => setNurseSearchInput(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-3 text-sm focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />

              <button
                type="button"
                onClick={searchNurses}
                disabled={nursesLoading}
                className={secondaryButton}
              >
                Search
              </button>
            </div>

            {nursesLoading ? (
              <p role="status" className="mt-4 text-sm text-slate-500">
                Loading nurses…
              </p>
            ) : nurseError ? (
              <div role="alert" className="mt-4 text-sm text-red-700">
                <p>{nurseError}</p>
                <button
                  type="button"
                  onClick={searchNurses}
                  className="mt-2 min-h-11 font-semibold underline"
                >
                  Try again
                </button>
              </div>
            ) : nurseResult?.items.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                No active nurse accounts found.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {nurseResult?.items.map((nurse) => (
                  <li key={nurse.id}>
                    <label className="flex min-h-16 cursor-pointer items-center gap-3 py-3">
                      <input
                        type="radio"
                        name="rpm-nurse"
                        checked={selectedNurse?.id === nurse.id}
                        onChange={() => setSelectedNurse(nurse)}
                        className="size-4"
                      />

                      <span>
                        <span className="block text-sm font-semibold text-slate-900">
                          {nurse.fullName}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          Account ID ending {nurse.id.slice(-8)}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}

            {nurseResult && !nursesLoading && (
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Page {nurseResult.pagination.page} of{" "}
                  {Math.max(1, nurseResult.pagination.totalPages)}
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={nursePage <= 1}
                    onClick={() => changeNursePage(nursePage - 1)}
                    className={secondaryButton}
                  >
                    Previous
                  </button>

                  <button
                    type="button"
                    disabled={nursePage >= nurseResult.pagination.totalPages}
                    onClick={() => changeNursePage(nursePage + 1)}
                    className={secondaryButton}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-950">
              Monitoring details
            </h2>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-800">
                Start date
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className={inputClass}
                />
              </label>

              <label className="block text-sm font-semibold text-slate-800">
                End date
                <input
                  type="date"
                  required
                  min={startDate || undefined}
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className={inputClass}
                />
              </label>
            </div>

            <p className="text-xs leading-5 text-slate-500">
              Dates use the hospital timezone, Asia/Kolkata. Monitoring includes
              the entire end date.
            </p>

            <label className="block text-sm font-semibold text-slate-800">
              Reason for monitoring
              <textarea
                required
                minLength={3}
                maxLength={2000}
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className={inputClass}
              />
            </label>

            <label className="block text-sm font-semibold text-slate-800">
              Staff notes — optional
              <textarea
                maxLength={2000}
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className={inputClass}
              />
            </label>

            <p className="text-xs text-slate-500">
              Staff notes are not shown to the patient.
            </p>
          </section>
        </fieldset>

        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>

        <button
          type="submit"
          disabled={
            busy ||
            patientBusy ||
            (!pending && (!patient?.hasActivePortalAccount || !selectedNurse))
          }
          className="min-h-12 rounded-xl bg-teal-800 px-6 text-sm font-semibold text-white hover:bg-teal-900 disabled:opacity-50"
        >
          {busy
            ? "Assigning…"
            : pending
              ? "Retry same assignment"
              : "Assign RPM"}
        </button>
      </form>
    </section>
  );
}
