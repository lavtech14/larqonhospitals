"use client";
import {
  StructuredResultFields,
  StructuredResultTable,
} from "./StructuredResultFields";
import { resultInputs } from "@/lib/lab-result-types";
import type {
  LabParameter,
  ResultInput,
  ResultValue,
} from "@/lib/lab-result-types";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import { useStaffUser } from "@/components/auth/StaffSessionGate";
import LabReportRelease from "./LabReportRelease";

type Page = {
  page: number;
  total: number;
  totalPages: number;
};

type Sample = {
  id: string;
  version: number;
  specimenReference: string;
  collectedAt: string;
  releasedReport: {
    id: string;
    releasedAt: string;
  } | null;

  collectedBy: {
    fullName: string;
  };

  orderItem: {
    parameters: LabParameter[];
    testCode: string;
    testName: string;
    sampleType: string;

    order: {
      id: string;
      status: string;
      priority: string;
      patientName: string;
      patientMrn: string;
      doctorName: string;
      clinicalReason: string;
    };
  };
  currentOrderItem: {
    id: string;
  } | null;

  rejection: {
    reason: string;
    rejectedAt: string;
  } | null;
};

type Revision = {
  values: ResultValue[];
  id: string;
  revision: number;
  method: string;
  resultText: string;
  comments: string;
  createdAt: string;

  author: {
    fullName: string;
  };
};

type QueueResponse = {
  items: (Sample & {
    latestDraft: {
      revision: number;
      createdAt: string;
    } | null;
  })[];

  pagination: Page;
};

type Detail = {
  sample: Sample;
  latestDraft: Revision | null;

  history: {
    items: Revision[];
    pagination: Page;
  };
};

type Draft = {
  values: ResultInput[];
  method: string;
  resultText: string;
  comments: string;
};

type Snapshot = {
  key: string;
  body: string;
};

const panel = "rounded-2xl border border-slate-200 bg-white p-5 sm:p-6";

const button =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50";

const primary = `${button} border-teal-800 bg-teal-800! text-white`;

const input =
  "mt-2 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal focus:outline-2 focus:outline-teal-700 disabled:bg-slate-50";

function time(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function useResource<T>(path: string, enabled: boolean) {
  const [revision, setRevision] = useState(0);
  const key = `${path}:${revision}`;

  const [remote, setRemote] = useState<{
    key: string;
    data: T | null;
    error: string;
  } | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    const controller = new AbortController();

    async function load() {
      try {
        const data = await apiRequest<T>(path, {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(45_000),
          ]),
        });

        if (active) {
          setRemote({ key, data, error: "" });
        }
      } catch (caught) {
        if (!active || controller.signal.aborted) return;

        setRemote({
          key,
          data: null,
          error:
            caught instanceof Error
              ? caught.message
              : "Unable to load lab records.",
        });
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [path, key, enabled]);

  return {
    data: remote?.key === key ? remote.data : null,
    error: remote?.key === key ? remote.error : "",
    loading: enabled && remote?.key !== key,
    reload: () => setRevision((value) => value + 1),
  };
}

export default function LabResultsWorkspace() {
  const user = useStaffUser();

  const canRead = user.permissions?.includes("lab.results.read") ?? false;

  const [selected, setSelected] = useState<string | null>(null);

  const [state, setState] = useState<"pending" | "drafted" | "all">("pending");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const query = new URLSearchParams({
    page: String(page),
    limit: "10",
    state,
    search,
  });

  const queue = useResource<QueueResponse>(
    `/lab/results/queue?${query}`,
    canRead && selected === null,
  );

  if (!canRead) {
    return (
      <p role="alert" className={panel}>
        Your account cannot view laboratory results.
      </p>
    );
  }

  if (selected) {
    return (
      <ResultEditor
        key={selected}
        sampleId={selected}
        onClose={() => {
          setSelected(null);
          queue.reload();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-teal-700">
            Laboratory
          </p>

          <h1 className="mt-2 text-3xl font-bold">Draft results</h1>

          <p className="mt-2 text-sm text-slate-600">
            Internal reports for collected specimens. Saving does not release a
            report.
          </p>
        </div>

        <button
          type="button"
          className={button}
          disabled={queue.loading}
          onClick={queue.reload}
        >
          Refresh
        </button>
      </header>

      <section className={panel}>
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setSearch(searchInput.trim());
              queue.reload();
            }}
          >
            <label className="min-w-0 flex-1 text-sm font-semibold">
              Patient name or MRN
              <input
                className={input}
                maxLength={100}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </label>

            <button type="submit" className={button}>
              Search
            </button>
          </form>

          <label className="text-sm font-semibold">
            Result state
            <select
              className={input}
              value={state}
              onChange={(event) => {
                setState(event.target.value as "pending" | "drafted" | "all");
                setPage(1);
              }}
            >
              <option value="pending">No draft yet</option>
              <option value="drafted">Draft saved</option>
              <option value="all">All collected specimens</option>
            </select>
          </label>
        </div>

        {queue.loading && (
          <p role="status" className="mt-5 text-sm">
            Loading collected specimens…
          </p>
        )}

        {queue.error && (
          <p role="alert" className="mt-5 text-sm text-red-700">
            {queue.error} Use Refresh to retry.
          </p>
        )}

        {queue.data && (
          <>
            {!queue.data.items.length && (
              <p className="py-8 text-center text-sm text-slate-500">
                No specimens match these filters.
              </p>
            )}

            {queue.data.items.map((sample) => (
              <article
                key={sample.id}
                className="mt-4 rounded-xl border border-slate-200 p-4"
              >
                <p className="text-xs font-bold text-teal-700">
                  {sample.orderItem.order.patientMrn}
                </p>

                <h2 className="mt-1 text-lg font-bold">
                  {sample.orderItem.order.patientName}
                </h2>

                <p className="mt-2 text-sm font-semibold">
                  {sample.orderItem.testName}
                  {" · "}
                  {sample.orderItem.order.priority}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  Specimen: {sample.specimenReference}
                  {" · Collected "}
                  {time(sample.collectedAt)} IST
                </p>

                <p className="mt-2 text-sm text-slate-600">
                  {sample.releasedReport
                    ? "Report released"
                    : sample.latestDraft
                      ? `Draft revision ${sample.latestDraft.revision} saved`
                      : "No result draft saved"}
                </p>

                <button
                  type="button"
                  className={`${button} mt-4`}
                  onClick={() => setSelected(sample.id)}
                >
                  Open result
                </button>
              </article>
            ))}

            <Pager
              pagination={queue.data.pagination}
              disabled={queue.loading}
              onChange={setPage}
            />
          </>
        )}
      </section>
    </div>
  );
}

function ResultEditor({
  sampleId,
  onClose,
}: {
  sampleId: string;
  onClose: () => void;
}) {
  const user = useStaffUser();

  const canWrite = user.permissions?.includes("lab.results.write") ?? false;

  const [page, setPage] = useState(1);

  const resource = useResource<Detail>(
    `/lab/samples/${sampleId}/result?page=${page}&limit=5`,
    true,
  );

  const [draft, setDraft] = useState<Draft>({
    values: [],
    method: "",
    resultText: "",
    comments: "",
  });

  const dirty = useRef(false);
  const baseVersion = useRef<number | null>(null);

  const [isDirty, setIsDirty] = useState(false);
  const [needsReview, setNeedsReview] = useState(false);
  const [releaseLocked, setReleaseLocked] = useState(false);

  const [pending, setPending] = useState<Snapshot | null>(null);
  const [sending, setSending] = useState(false);

  const lock = useRef(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const data = resource.data;

  const frozen =
    resource.loading || sending || pending !== null || releaseLocked;

  const editable = Boolean(
    canWrite &&
    data &&
    data.sample.currentOrderItem &&
    !data.sample.rejection &&
    !data.sample.releasedReport &&
    ["ORDERED", "COLLECTED"].includes(data.sample.orderItem.order.status),
  );

  useEffect(() => {
    if (!data) return;

    if (!dirty.current) {
      setDraft({
        method: data.latestDraft?.method ?? "",
        resultText: data.latestDraft?.resultText ?? "",
        comments: data.latestDraft?.comments ?? "",
        values: resultInputs(
          data.sample.orderItem.parameters ?? [],
          data.latestDraft?.values ?? [],
        ),
      });

      baseVersion.current = data.sample.version;
      setNeedsReview(false);
    } else if (baseVersion.current !== data.sample.version) {
      setNeedsReview(true);
    }
  }, [data]);

  useEffect(() => {
    if (!isDirty && !pending && !releaseLocked) return;

    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warn);

    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, [isDirty, pending, releaseLocked]);

  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    if (frozen || !editable || lock.current) return;

    dirty.current = true;
    setIsDirty(true);
    setNotice("");

    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function send(snapshot: Snapshot) {
    if (lock.current || releaseLocked) return;

    lock.current = true;
    setSending(true);
    setPending(snapshot);
    setError("");
    setNotice("");

    try {
      await apiRequest(`/lab/samples/${sampleId}/result`, {
        method: "POST",

        headers: {
          "Idempotency-Key": snapshot.key,
        },

        body: snapshot.body,
      });

      setPending(null);
      dirty.current = false;
      setIsDirty(false);
      setNeedsReview(false);

      setNotice("Draft result saved. It has not been reviewed or released.");

      setPage(1);
      resource.reload();
    } catch (caught) {
      const uncertain =
        !(caught instanceof ApiError) ||
        caught.status === 0 ||
        caught.status >= 500;

      if (uncertain) {
        setError(
          "Save result unconfirmed. Keep this page open and retry the same save.",
        );
      } else if (caught instanceof ApiError) {
        setPending(null);
        setError(caught.message);

        if (caught.status === 409) {
          setNeedsReview(true);
          resource.reload();
        }
      }
    } finally {
      lock.current = false;
      setSending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !editable ||
      frozen ||
      lock.current ||
      needsReview ||
      !isDirty ||
      baseVersion.current === null
    ) {
      return;
    }

    if (
      !draft.resultText.trim() &&
      !draft.values.some((value) => value.value.trim())
    ) {
      setError("Enter the result report.");
      return;
    }

    void send({
      key: crypto.randomUUID(),

      body: JSON.stringify({
        expectedVersion: baseVersion.current,
        values: draft.values,
        method: draft.method.trim(),
        resultText: draft.resultText.trim(),
        comments: draft.comments.trim(),
      }),
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap justify-between gap-3">
        <button
          type="button"
          className={button}
          onClick={() => {
            if (lock.current || pending || releaseLocked) {
              setError("Resolve the pending save before leaving.");
              return;
            }

            if (isDirty && !window.confirm("Discard unsaved result edits?")) {
              return;
            }

            onClose();
          }}
        >
          ← Results queue
        </button>

        <button
          type="button"
          className={button}
          disabled={frozen}
          onClick={resource.reload}
        >
          Refresh result
        </button>
      </header>

      {notice && (
        <p
          role="status"
          className="rounded-xl bg-teal-50 p-4 text-sm text-teal-900"
        >
          {notice}
        </p>
      )}

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
          onClick={() => void send(pending)}
        >
          {sending ? "Saving…" : "Retry same save"}
        </button>
      )}

      {resource.loading && <p role="status">Loading specimen result…</p>}

      {resource.error && (
        <p role="alert" className={panel}>
          {resource.error} Use Refresh result to retry.
        </p>
      )}

      {data && (
        <>
          {data.sample.rejection && (
            <p
              role="alert"
              className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950"
            >
              This specimen was rejected: {data.sample.rejection.reason} Result
              entry is locked.
            </p>
          )}
          <section className={panel}>
            <p className="text-xs font-bold text-teal-700">
              {data.sample.orderItem.order.patientMrn}
            </p>

            <h1 className="mt-1 text-2xl font-bold">
              {data.sample.orderItem.order.patientName}
            </h1>

            <h2 className="mt-4 font-semibold">
              {data.sample.orderItem.testName}
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              {data.sample.orderItem.sampleType}
              {" · Specimen "}
              {data.sample.specimenReference}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Collected {time(data.sample.collectedAt)} IST
              {" · "}
              {data.sample.collectedBy.fullName}
            </p>

            <p className="mt-4 whitespace-pre-wrap text-sm text-slate-600">
              Clinical reason: {data.sample.orderItem.order.clinicalReason}
            </p>
          </section>

          {needsReview && (
            <section className="rounded-xl bg-amber-50 p-4 text-sm">
              <p>
                The saved record changed. Your local text is preserved. Review
                the latest saved draft below.
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

                    setDraft({
                      method: data.latestDraft?.method ?? "",
                      resultText: data.latestDraft?.resultText ?? "",
                      comments: data.latestDraft?.comments ?? "",
                      values: resultInputs(
                        data.sample.orderItem.parameters ?? [],
                        data.latestDraft?.values ?? [],
                      ),
                    });

                    baseVersion.current = data.sample.version;
                    dirty.current = false;
                    setIsDirty(false);
                    setNeedsReview(false);
                  }}
                >
                  Load latest draft
                </button>

                <button
                  type="button"
                  className={button}
                  disabled={frozen || !editable}
                  onClick={() => {
                    if (
                      !window.confirm(
                        "I reviewed the saved draft and want to retain my local text as the next revision.",
                      )
                    ) {
                      return;
                    }

                    baseVersion.current = data.sample.version;
                    setNeedsReview(false);
                  }}
                >
                  Keep edits after review
                </button>
              </div>
            </section>
          )}

          <form onSubmit={submit} className={panel}>
            <h2 className="text-xl font-bold">Draft report</h2>

            <p className="mt-2 text-sm text-slate-500">
              Every save creates a revision. This is not a reviewed or released
              report.
            </p>

            <fieldset
              disabled={frozen || !editable}
              className="mt-5 min-w-0 space-y-5 border-0 p-0"
            >
              <legend className="sr-only">Draft report fields</legend>

              <label className="block text-sm font-semibold">
                Method · optional
                <input
                  className={input}
                  maxLength={200}
                  value={draft.method}
                  onChange={(event) => change("method", event.target.value)}
                />
              </label>

              <StructuredResultFields
                parameters={data.sample.orderItem.parameters ?? []}
                values={draft.values}
                onChange={(values) => change("values", values)}
                disabled={frozen || !editable}
              />

              <label className="block text-sm font-semibold">
                Result report
                {data.sample.orderItem.parameters.length
                  ? " · optional narrative"
                  : " *"}
                <textarea
                  className={input}
                  rows={10}
                  required={data.sample.orderItem.parameters.length === 0}
                  maxLength={10000}
                  value={draft.resultText}
                  onChange={(event) => change("resultText", event.target.value)}
                />
              </label>

              <label className="block text-sm font-semibold">
                Comments · optional
                <textarea
                  className={input}
                  rows={4}
                  maxLength={2000}
                  value={draft.comments}
                  onChange={(event) => change("comments", event.target.value)}
                />
              </label>

              {canWrite && (
                <button
                  type="submit"
                  className={primary}
                  disabled={
                    frozen ||
                    !editable ||
                    !isDirty ||
                    needsReview ||
                    (!draft.resultText.trim() &&
                      !draft.values.some((value) => value.value.trim()))
                  }
                >
                  Save draft revision
                </button>
              )}
            </fieldset>

            {!editable && (
              <p className="mt-4 text-sm text-slate-500">
                This report is read-only for your account or the current order
                status.
              </p>
            )}
          </form>
          <LabReportRelease
            key={`${sampleId}:${data.sample.version}`}
            sampleId={sampleId}
            disabled={frozen || isDirty || needsReview}
            onLockChange={setReleaseLocked}
            onReleased={() => {
              setNotice("Report released. Further draft edits are locked.");

              resource.reload();
            }}
          />
          <section className={panel}>
            <h2 className="text-xl font-bold">Saved revisions</h2>

            {data.latestDraft && (
              <details className="mt-4 rounded-xl border border-teal-200 p-4">
                <summary className="cursor-pointer text-sm font-semibold">
                  Latest saved draft · revision {data.latestDraft.revision}
                </summary>

                <RevisionContent revision={data.latestDraft} />
              </details>
            )}

            {!data.history.items.length && (
              <p className="mt-4 text-sm text-slate-500">
                No draft result has been saved.
              </p>
            )}

            {data.history.items.map((revision) => (
              <details
                key={revision.id}
                className="mt-3 rounded-xl border border-slate-200 p-4"
              >
                <summary className="cursor-pointer text-sm font-semibold">
                  Revision {revision.revision}
                  {" · "}
                  {revision.author.fullName}
                  {" · "}
                  {time(revision.createdAt)} IST
                </summary>

                <RevisionContent revision={revision} />
              </details>
            ))}

            <Pager
              pagination={data.history.pagination}
              disabled={frozen}
              onChange={setPage}
            />
          </section>
        </>
      )}
    </div>
  );
}

function RevisionContent({ revision }: { revision: Revision }) {
  return (
    <div className="mt-4 space-y-4 text-sm">
      <StructuredResultTable values={revision.values ?? []} />
      {revision.method && (
        <p>
          <strong>Method:</strong> {revision.method}
        </p>
      )}

      <p className="whitespace-pre-wrap break-words leading-7">
        {revision.resultText}
      </p>

      {revision.comments && (
        <div>
          <h3 className="font-semibold">Comments</h3>

          <p className="mt-2 whitespace-pre-wrap break-words">
            {revision.comments}
          </p>
        </div>
      )}
    </div>
  );
}

function Pager({
  pagination,
  disabled,
  onChange,
}: {
  pagination: Page;
  disabled: boolean;
  onChange: (page: number) => void;
}) {
  return (
    <footer className="mt-5 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-slate-500">
        Page {pagination.page} of {Math.max(1, pagination.totalPages)}
        {" · "}
        {pagination.total} records
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          className={button}
          disabled={disabled || pagination.page <= 1}
          onClick={() => onChange(pagination.page - 1)}
        >
          Previous
        </button>

        <button
          type="button"
          className={button}
          disabled={disabled || pagination.page >= pagination.totalPages}
          onClick={() => onChange(pagination.page + 1)}
        >
          Next
        </button>
      </div>
    </footer>
  );
}
