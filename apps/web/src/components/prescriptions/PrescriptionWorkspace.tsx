"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import { useStaffUser } from "@/components/auth/StaffSessionGate";
import DiscardPrescriptionButton from "./DiscardPrescriptionButton";

import {
  allergyOptions,
  buildSaveBody,
  fromDetail,
} from "@/lib/prescription-draft";

import type { Detail, Draft } from "@/lib/prescription-draft";

import PrescriptionDraftFields from "./PrescriptionDraftFields";
import IssuePrescriptionButton from "./IssuePrescriptionButton";

const box = "rounded-2xl border border-slate-200 bg-white p-5 sm:p-6";

const button =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50";

const primary = `${button} border-teal-800 bg-teal-800! text-white hover:bg-teal-900!`;

const input =
  "mt-2 block min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal focus:outline-2 focus:outline-teal-700 disabled:bg-slate-50";

const time = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "medium",
  timeStyle: "short",
});

type Snapshot = {
  key: string;
  body: string;
  uncertain?: boolean;
};

type ListResponse = {
  patient: {
    mrn: string;
    fullName: string;
  };
  encounter: {
    status: string;
    version: number;
  } | null;
  items: {
    id: string;
    status: string;
    version: number;
    updatedAt: string;
    author: {
      id: string;
      fullName: string;
    };
  }[];
  pagination: {
    page: number;
    total: number;
    totalPages: number;
  };
};

function useLeaveWarning(active: boolean) {
  useEffect(() => {
    if (!active) return;

    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warn);

    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, [active]);
}

function isUnconfirmed(caught: unknown, snapshot?: Snapshot): boolean {
  return (
    snapshot?.uncertain === true ||
    !(caught instanceof ApiError) ||
    caught.status === 0 ||
    caught.status >= 500
  );
}

function formatTime(value: string): string {
  const date = new Date(value);

  return Number.isFinite(date.getTime())
    ? `${time.format(date)} IST`
    : "Time unavailable";
}

export default function PrescriptionWorkspace({
  appointmentId,
}: {
  appointmentId: string;
}) {
  const user = useStaffUser();

  const canRead = user.permissions?.includes("prescriptions.own.read") ?? false;

  const canWrite = ["prescriptions.own.write", "medicines.read"].every(
    (permission) => user.permissions?.includes(permission),
  );

  const endpoint = `/doctor/appointments/${appointmentId}/prescriptions`;

  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);

  const requestKey = `${page}:${revision}`;

  const [remote, setRemote] = useState<{
    key: string;
    data: ListResponse | null;
    error: string;
  } | null>(null);

  const [pending, setPending] = useState<Snapshot | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const lock = useRef(false);

  const data = remote?.key === requestKey ? remote.data : null;

  const loading = canRead && remote?.key !== requestKey;
  const frozen = loading || sending || pending !== null;

  useLeaveWarning(pending !== null);

  useEffect(() => {
    if (!canRead || selected) return;

    let active = true;
    const controller = new AbortController();

    async function load() {
      try {
        const result = await apiRequest<ListResponse>(
          `${endpoint}?page=${page}&limit=20`,
          { signal: controller.signal },
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
              : "Unable to load prescriptions.",
        });
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [canRead, selected, endpoint, page, requestKey]);

  async function create(snapshot: Snapshot) {
    if (lock.current) return;

    lock.current = true;
    setSending(true);
    setPending(snapshot);
    setError("");

    try {
      const result = await apiRequest<{
        prescriptionId: string;
      }>(endpoint, {
        method: "POST",
        headers: {
          "Idempotency-Key": snapshot.key,
        },
        body: snapshot.body,
      });

      setPending(null);
      setSelected(result.prescriptionId);
    } catch (caught) {
      if (isUnconfirmed(caught, snapshot)) {
        setPending({ ...snapshot, uncertain: true });
        setError(
          "Creation result unconfirmed. Keep this page open and retry the same creation.",
        );
      } else if (caught instanceof ApiError) {
        setPending(null);
        setError(caught.message);

        const details = caught.data;

        if (
          details &&
          typeof details === "object" &&
          "code" in details &&
          details.code === "DRAFT_ALREADY_EXISTS" &&
          "prescriptionId" in details &&
          typeof details.prescriptionId === "string"
        ) {
          setSelected(details.prescriptionId);
          setError("");
        } else if (caught.status === 409) {
          setRevision((current) => current + 1);
        }
      }
    } finally {
      lock.current = false;
      setSending(false);
    }
  }

  if (!canRead) {
    return (
      <p role="alert" className={box}>
        Your account cannot view prescriptions.
      </p>
    );
  }

  if (selected) {
    return (
      <PrescriptionEditor
        key={selected}
        appointmentId={appointmentId}
        id={selected}
        onClose={() => {
          setSelected(null);
          setRevision((current) => current + 1);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href={`/my-appointments/${appointmentId}/encounter`}
            className="text-sm font-semibold text-teal-800"
            onClick={(event) => {
              if (lock.current || pending) {
                event.preventDefault();
                setError("Resolve the pending creation before leaving.");
              }
            }}
          >
            ← Clinical encounter
          </Link>

          <h1 className="mt-3 text-3xl font-bold">Prescriptions</h1>
        </div>

        <button
          type="button"
          className={button}
          disabled={frozen}
          onClick={() => setRevision((current) => current + 1)}
        >
          Refresh list
        </button>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      {pending && (
        <button
          type="button"
          className={button}
          disabled={sending}
          onClick={() => void create(pending)}
        >
          {sending ? "Creating…" : "Retry same creation"}
        </button>
      )}

      {loading && <p role="status">Loading prescriptions…</p>}

      {remote?.key === requestKey && remote.error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4">
          {remote.error} Use Refresh list to retry.
        </p>
      )}

      {data && (
        <>
          <section className={box}>
            <p className="text-xs font-bold text-teal-800">
              {data.patient.mrn}
            </p>

            <h2 className="mt-1 text-xl font-bold">{data.patient.fullName}</h2>

            {canWrite && data.encounter?.status === "IN_PROGRESS" ? (
              <button
                type="button"
                className={`${primary} mt-4`}
                disabled={frozen}
                onClick={() => {
                  if (!data.encounter || lock.current) return;

                  const existing = data.items.find(
                    (item) =>
                      item.status === "DRAFT" && item.author.id === user.id,
                  );
                  if (existing) {
                    setSelected(existing.id);
                    return;
                  }
                  void create({
                    key: crypto.randomUUID(),
                    body: JSON.stringify({
                      expectedEncounterVersion: data.encounter.version,
                    }),
                  });
                }}
              >
                {data.items.some(
                  (item) =>
                    item.status === "DRAFT" && item.author.id === user.id,
                )
                  ? "Continue draft"
                  : "New prescription"}
              </button>
            ) : (
              <p className="mt-3 text-sm text-slate-600">
                Draft creation requires prescribing access and an encounter in
                progress.
              </p>
            )}
          </section>

          {!data.items.length && (
            <p className={box}>No prescriptions on this page.</p>
          )}

          {data.items.map((prescription) => (
            <article
              key={prescription.id}
              className={`${box} flex flex-wrap items-center justify-between gap-4`}
            >
              <div>
                <h2 className="font-semibold">{prescription.status}</h2>

                <p className="mt-1 text-sm text-slate-600">
                  {prescription.author.fullName}
                  {" · Updated "}
                  {formatTime(prescription.updatedAt)}
                </p>
              </div>

              <button
                type="button"
                className={button}
                disabled={frozen}
                onClick={() => setSelected(prescription.id)}
              >
                Open prescription
              </button>
            </article>
          ))}

          <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <span>
              Page {data.pagination.page} of{" "}
              {Math.max(1, data.pagination.totalPages)}
              {" · "}
              {data.pagination.total} prescriptions
            </span>

            <div className="flex gap-2">
              <button
                type="button"
                className={button}
                disabled={frozen || page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous
              </button>

              <button
                type="button"
                className={button}
                disabled={frozen || page >= data.pagination.totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}

function PrescriptionEditor({
  appointmentId,
  id,
  onClose,
}: {
  appointmentId: string;
  id: string;
  onClose: () => void;
}) {
  const user = useStaffUser();

  const endpoint = `/doctor/appointments/${appointmentId}/prescriptions/${id}`;

  const [revision, setRevision] = useState(0);

  const [remote, setRemote] = useState<{
    revision: number;
    data: Detail | null;
    error: string;
  } | null>(null);

  const [draft, setDraft] = useState<Draft>({
    allergyStatus: "NOT_REVIEWED",
    allergyDetails: "",
    instructions: "",
    rows: [],
  });

  const dirty = useRef(false);
  const baseVersion = useRef<number | null>(null);

  const [isDirty, setIsDirty] = useState(false);
  const [needsReview, setNeedsReview] = useState(false);

  const [pending, setPending] = useState<Snapshot | null>(null);
  const [sending, setSending] = useState(false);

  const lock = useRef(false);

  // Issuance belongs to this editor, not the prescription list.
  const [issueLocked, setIssueLocked] = useState(false);
  const issueLock = useRef(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loading = remote?.revision !== revision;

  const data = remote?.data ?? null;

  const frozen = loading || sending || pending !== null || issueLocked;

  const canEdit = Boolean(
    data &&
    data.prescription.authorStaffId === user.id &&
    data.prescription.status === "DRAFT" &&
    data.encounter.status === "IN_PROGRESS" &&
    ["prescriptions.own.write", "medicines.read"].every((permission) =>
      user.permissions?.includes(permission),
    ),
  );

  useLeaveWarning(isDirty || pending !== null || issueLocked);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function load() {
      try {
        const result = await apiRequest<Detail>(endpoint, {
          signal: controller.signal,
        });

        if (!active) return;

        setRemote({
          revision,
          data: result,
          error: "",
        });

        if (!dirty.current) {
          setDraft(fromDetail(result));
          baseVersion.current = result.prescription.version;
          setNeedsReview(false);
        } else if (baseVersion.current !== result.prescription.version) {
          setNeedsReview(true);
        }
      } catch (caught) {
        if (!active || controller.signal.aborted) return;

        setRemote({
          revision,
          data: null,
          error:
            caught instanceof Error
              ? caught.message
              : "Unable to load prescription.",
        });
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [endpoint, revision]);

  function change(update: (current: Draft) => Draft) {
    if (!canEdit || frozen || lock.current || issueLock.current) {
      return;
    }

    dirty.current = true;
    setIsDirty(true);
    setDraft(update);
    setNotice("");
  }

  async function send(snapshot: Snapshot) {
    if (lock.current || issueLock.current) return;

    lock.current = true;
    setSending(true);
    setPending(snapshot);
    setError("");
    setNotice("");

    try {
      await apiRequest(endpoint, {
        method: "PUT",
        headers: {
          "Idempotency-Key": snapshot.key,
        },
        body: snapshot.body,
      });

      setPending(null);

      dirty.current = false;
      setIsDirty(false);
      setNeedsReview(false);

      setNotice("Draft save confirmed. This prescription has not been issued.");

      setRevision((current) => current + 1);
    } catch (caught) {
      if (isUnconfirmed(caught, snapshot)) {
        setPending({ ...snapshot, uncertain: true });
        setError(
          "Save result unconfirmed. Keep this page open and use Retry same save.",
        );
      } else if (caught instanceof ApiError) {
        setPending(null);
        setError(caught.message);

        if (caught.status === 409) {
          setNeedsReview(true);

          const details = caught.data;

          if (
            details &&
            typeof details === "object" &&
            "code" in details &&
            details.code === "MEDICINE_CHANGED_OR_UNAVAILABLE" &&
            "medicineId" in details &&
            typeof details.medicineId === "string"
          ) {
            const medicineId = details.medicineId;

            setDraft((current) => ({
              ...current,
              rows: current.rows.map((row) =>
                row.medicine?.id === medicineId
                  ? { ...row, needsReselection: true }
                  : row,
              ),
            }));
          }

          setRevision((current) => current + 1);
        }
      }
    } finally {
      lock.current = false;
      setSending(false);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !canEdit ||
      frozen ||
      lock.current ||
      issueLock.current ||
      needsReview ||
      !isDirty ||
      baseVersion.current === null
    ) {
      return;
    }

    try {
      const snapshot: Snapshot = {
        key: crypto.randomUUID(),
        body: buildSaveBody(draft, baseVersion.current),
      };

      void send(snapshot);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Check the prescription fields.",
      );
    }
  }

  function allowLeaving(): boolean {
    if (lock.current || issueLock.current || pending !== null) {
      setError("Resolve the pending save or issuance before leaving.");

      return false;
    }

    if (
      dirty.current &&
      !window.confirm("Discard your unsaved prescription edits?")
    ) {
      return false;
    }

    return true;
  }

  const issueReason = isDirty
    ? "Save your changes before issuing."
    : needsReview
      ? "Resolve the saved-draft conflict first."
      : !data?.prescription.items.length
        ? "Add and save at least one medicine."
        : data.prescription.allergyStatus === "NOT_REVIEWED"
          ? "Complete the allergy review and save the draft."
          : ["ALLERGIES_REPORTED", "UNKNOWN"].includes(
                data.prescription.allergyStatus,
              ) && !data.prescription.allergyDetails?.trim()
            ? "Add allergy review notes and save the draft."
            : fromDetail(data).rows.some((row) => row.needsReselection)
              ? "Review and reselect changed catalogue entries."
              : loading
                ? "Refreshing the confirmed saved prescription…"
                : undefined;
  return (
    <div
      className="space-y-5 pb-6"
      onKeyDown={(event) => {
        if (
          canEdit &&
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "s"
        ) {
          event.preventDefault();
          if (!frozen && isDirty && !needsReview)
            document
              .querySelector<HTMLFormElement>("#prescription-draft-form")
              ?.requestSubmit();
        }
      }}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="min-h-10 text-sm font-semibold text-teal-800"
          onClick={() => {
            if (allowLeaving()) onClose();
          }}
        >
          ← Prescription list
        </button>
        <button
          type="button"
          className={button}
          disabled={frozen}
          onClick={() => {
            if (!lock.current && !issueLock.current)
              setRevision((current) => current + 1);
          }}
        >
          Refresh prescription
        </button>
      </header>
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-teal-100 bg-teal-50 p-3 text-sm text-teal-900"
        >
          {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-800"
        >
          {error}
        </p>
      )}
      {pending && (
        <button
          type="button"
          className={button}
          disabled={sending || issueLocked}
          onClick={() => void send(pending)}
        >
          {sending ? "Saving…" : "Retry same save"}
        </button>
      )}
      {loading && (
        <p role="status" className="text-xs text-slate-500">
          {data ? "Refreshing saved prescription…" : "Loading prescription…"}
        </p>
      )}
      {remote?.revision === revision && remote.error && (
        <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm">
          {remote.error} Use Refresh prescription to retry.
        </p>
      )}
      {data && (
        <>
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-teal-700">
                Prescription · {data.patient.mrn}
              </p>
              <h1 className="mt-1 text-xl font-bold text-slate-950">
                {data.prescription.issuedAt
                  ? (data.prescription.patientName ?? data.patient.fullName)
                  : data.patient.fullName}
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                {data.prescription.issuedAt
                  ? (data.prescription.prescriberName ??
                    data.prescription.author.fullName)
                  : data.prescription.author.fullName}
                {data.prescription.issuedAt
                  ? ` · Issued ${formatTime(data.prescription.issuedAt)}`
                  : " · Drafts are not visible to patients"}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
              {data.prescription.status}
            </span>
            {data.prescription.status === "ISSUED" && (
              <Link
                href={`/my-appointments/${appointmentId}/prescriptions/${id}/print`}
                className={button}
                onClick={(event) => {
                  if (!allowLeaving()) event.preventDefault();
                }}
              >
                View / print prescription
              </Link>
            )}
          </section>
          {needsReview && canEdit && (
            <section className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
              <p>
                Your local edits are preserved. Review the latest saved
                prescription before continuing. Flagged medicines must also be
                reselected.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={button}
                  disabled={frozen}
                  onClick={() => {
                    if (
                      !window.confirm(
                        "Discard local edits and load the latest saved draft?",
                      )
                    ) {
                      return;
                    }

                    // Use the response already displayed for review.
                    setDraft(fromDetail(data));
                    baseVersion.current = data.prescription.version;

                    dirty.current = false;
                    setIsDirty(false);
                    setNeedsReview(false);
                    setError("");
                    setNotice("Latest saved draft loaded.");
                  }}
                >
                  Load latest saved draft
                </button>

                <button
                  type="button"
                  className={button}
                  disabled={frozen}
                  onClick={() => {
                    if (
                      !window.confirm(
                        "I reviewed the saved draft and want to keep my local edits as the next save.",
                      )
                    ) {
                      return;
                    }

                    baseVersion.current = data.prescription.version;

                    setNeedsReview(false);
                    setNotice(
                      "Local edits retained. Save the draft before issuing.",
                    );
                  }}
                >
                  Keep edits after review
                </button>
              </div>

              <details className="mt-4">
                <summary className="cursor-pointer font-semibold">
                  Latest saved prescription
                </summary>

                <PrescriptionPreview draft={fromDetail(data)} />
              </details>
            </section>
          )}

          {canEdit ? (
            <PrescriptionDraftFields
              draft={draft}
              frozen={frozen}
              isDirty={isDirty}
              sending={sending}
              needsReview={needsReview}
              onChange={change}
              onSave={save}
            />
          ) : (
            <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-600">
              Read-only prescription. Editing requires the author, prescribing
              access, a draft, and a visit in progress.
            </p>
          )}
          {isDirty && !canEdit && (
            <section className={box}>
              <h2 className="text-lg font-bold">
                Unsaved local draft · read-only
              </h2>
              <p className="mt-2 text-sm">
                These edits are preserved here and have not been saved.
              </p>
              <PrescriptionPreview draft={draft} />
            </section>
          )}
          <details
            className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
            open={!canEdit}
          >
            <summary className="cursor-pointer text-sm font-bold text-slate-900">
              {canEdit
                ? `Preview ${isDirty ? "unsaved" : "saved"} prescription`
                : "Saved prescription"}
            </summary>
            <PrescriptionPreview draft={canEdit ? draft : fromDetail(data)} />
          </details>
          {canEdit && user.permissions?.includes("prescriptions.own.issue") && (
            <IssuePrescriptionButton
              key={
                `${data.prescription.id}:` +
                `${data.prescription.version}:${revision}`
              }
              appointmentId={appointmentId}
              prescriptionId={id}
              version={data.prescription.version}
              patientName={data.patient.fullName}
              mrn={data.patient.mrn}
              disabledReason={issueReason}
              disabled={
                frozen ||
                isDirty ||
                needsReview ||
                data.prescription.items.length === 0 ||
                data.prescription.allergyStatus === "NOT_REVIEWED" ||
                (["ALLERGIES_REPORTED", "UNKNOWN"].includes(
                  data.prescription.allergyStatus,
                ) &&
                  !data.prescription.allergyDetails?.trim()) ||
                fromDetail(data).rows.some((row) => row.needsReselection)
              }
              onLockChange={(value) => {
                issueLock.current = value;
                setIssueLocked(value);

                if (value) {
                  setNotice("");
                  setError("");
                }
              }}
              onConfirmed={() => {
                setNotice(
                  "Prescription issued. Its saved contents are locked.",
                );

                setRevision((current) => current + 1);
              }}
              onError={(message, refresh) => {
                setError(message);

                if (refresh) {
                  setRevision((current) => current + 1);
                }
              }}
            />
          )}
          {canEdit && (
            <details className="rounded-xl border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer text-xs font-semibold text-rose-700">
                Discard an unnecessary draft
              </summary>
              <div className="mt-4">
                <DiscardPrescriptionButton
                  key={`discard:${id}:${data.prescription.version}:${revision}`}
                  appointmentId={appointmentId}
                  prescriptionId={id}
                  version={data.prescription.version}
                  patientName={data.patient.fullName}
                  mrn={data.patient.mrn}
                  disabled={frozen || needsReview}
                  onLockChange={(value) => {
                    // Reuse the editor's existing mutation lock.
                    // It now covers both issuance and discard.
                    issueLock.current = value;
                    setIssueLocked(value);

                    if (value) {
                      setError("");
                      setNotice("");
                    }
                  }}
                  onConfirmed={() => {
                    dirty.current = false;
                    setIsDirty(false);
                    setNeedsReview(false);

                    setNotice(
                      "Draft discarded. Its saved contents were retained and it no longer blocks visit completion.",
                    );

                    setRevision((current) => current + 1);
                  }}
                  onError={(message, refresh) => {
                    setError(message);

                    if (refresh) {
                      setRevision((current) => current + 1);
                    }
                  }}
                />
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function PrescriptionPreview({ draft }: { draft: Draft }) {
  const allergyLabel =
    allergyOptions.find(([value]) => value === draft.allergyStatus)?.[1] ??
    draft.allergyStatus;

  return (
    <div className="mt-4 space-y-4 text-sm">
      <p>
        <strong>Allergy review:</strong> {allergyLabel}
      </p>

      {draft.allergyDetails && (
        <p className="whitespace-pre-wrap">{draft.allergyDetails}</p>
      )}

      {!draft.rows.length && (
        <p className="text-slate-500">No medicines entered.</p>
      )}

      <ol className="space-y-3">
        {draft.rows.map((row, index) => (
          <li
            key={row.clientId}
            className="rounded-xl border border-slate-200 p-4"
          >
            <h3 className="font-semibold">
              {index + 1}.{" "}
              {row.medicine
                ? `${row.medicine.displayName} · ${row.medicine.strength} · ${row.medicine.dosageForm}`
                : "Medicine not selected"}
            </h3>

            {row.medicine?.genericName && (
              <p className="mt-1 text-slate-600">{row.medicine.genericName}</p>
            )}

            <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Dose", row.dose],
                ["Route", row.route],
                ["Frequency", row.frequency],
                ["Duration", row.duration],
                ["Quantity", `${row.quantity} ${row.quantityUnit}`.trim()],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-slate-500">{label}</dt>

                  <dd className="mt-1 whitespace-pre-wrap">
                    {value || "Not entered"}
                  </dd>
                </div>
              ))}
            </dl>

            {row.instructions && (
              <p className="mt-3 whitespace-pre-wrap">{row.instructions}</p>
            )}
          </li>
        ))}
      </ol>

      {draft.instructions && (
        <div>
          <h3 className="font-semibold">General instructions</h3>

          <p className="mt-2 whitespace-pre-wrap">{draft.instructions}</p>
        </div>
      )}
    </div>
  );
}
