"use client";
import { StructuredResultTable } from "./StructuredResultFields";
import type { ResultValue } from "@/lib/lab-result-types";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useEffect, useId, useRef, useState } from "react";

import { createPortal, flushSync } from "react-dom";

import { ApiError, apiRequest } from "@/lib/api";
import { patientApiRequest } from "@/lib/patient-api";

import PatientPortalFrame from "@/components/patient-portal/PatientPortalFrame";

type Audience = "doctor" | "patient";

type ReportHeader = {
  id: string;
  testCode: string;
  testName: string;
  specimenReference: string;
  reviewerName: string;
  releasedAt: string;
};

type Report = ReportHeader & {
  values: ResultValue[];
  patientName: string;
  patientMrn: string;
  doctorName: string;
  sampleType: string;
  collectedAt: string;
  method: string;
  resultText: string;
  comments: string;
};

type ListResponse = {
  items: ReportHeader[];

  pagination: {
    page: number;
    total: number;
    totalPages: number;
  };
};

type ReportResponse = {
  report: Report;
};

const panel = "rounded-2xl border border-slate-200 bg-white p-5 sm:p-6";

const button =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50";

function time(value: string): string {
  const date = new Date(value);

  return Number.isFinite(date.getTime())
    ? `${date.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      })} IST`
    : "Date unavailable";
}

function request<T>(
  audience: Audience,
  path: string,
  options: RequestInit = {},
) {
  return audience === "patient"
    ? patientApiRequest<T>(path, options)
    : apiRequest<T>(path, options);
}

function patientLoginRequired(caught: unknown) {
  if (!(caught instanceof ApiError)) return false;

  if (caught.status === 401) return true;

  const details = caught.data;

  return (
    caught.status === 403 &&
    details !== null &&
    typeof details === "object" &&
    "code" in details &&
    details.code === "PATIENT_PASSWORD_CHANGE_REQUIRED"
  );
}

function useResource<T>(audience: Audience, path: string) {
  const router = useRouter();
  const [revision, setRevision] = useState(0);

  const key = `${audience}:${path}:${revision}`;

  const [remote, setRemote] = useState<{
    key: string;
    data: T | null;
    error: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function load() {
      try {
        const data = await request<T>(audience, path, {
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
              : "Unable to load released reports.",
        });

        if (audience === "patient" && patientLoginRequired(caught)) {
          router.replace("/patient/login");
        }
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [audience, path, key, router]);

  return {
    data: remote?.key === key ? remote.data : null,
    error: remote?.key === key ? remote.error : "",
    loading: remote?.key !== key,
    reload: () => setRevision((value) => value + 1),
  };
}

export default function LabReportWorkspace({
  audience,
  referenceId,
}: {
  audience: Audience;
  referenceId: string;
}) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

  const endpoint =
    audience === "patient"
      ? `/patient/visits/${referenceId}/lab-reports`
      : `/doctor/appointments/${referenceId}/lab-reports`;

  const resource = useResource<ListResponse>(
    audience,
    `${endpoint}?page=${page}&limit=10`,
  );

  const backHref =
    audience === "patient"
      ? `/patient/visits/${referenceId}`
      : `/my-appointments/${referenceId}/encounter`;

  const content = (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={backHref} className="text-sm font-semibold text-teal-800">
            ← {audience === "patient" ? "Visit details" : "Clinical encounter"}
          </Link>

          <h1 className="mt-3 text-3xl font-bold">Released lab reports</h1>

          <p className="mt-2 text-sm text-slate-600">
            Reviewed reports for this visit.
          </p>
        </div>

        {!selected && (
          <button
            type="button"
            className={button}
            disabled={resource.loading}
            onClick={resource.reload}
          >
            Refresh
          </button>
        )}
      </header>

      {selected ? (
        <ReportViewer
          key={`${audience}:${referenceId}:${selected}`}
          audience={audience}
          endpoint={`${endpoint}/${selected}`}
          onClose={() => {
            setSelected(null);
            resource.reload();
          }}
        />
      ) : (
        <section className={panel}>
          {resource.loading && (
            <p role="status" className="text-sm text-slate-500">
              Loading released reports…
            </p>
          )}

          {resource.error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
            >
              {resource.error} Use Refresh to retry.
            </p>
          )}

          {resource.data && (
            <>
              {!resource.data.items.length && (
                <p className="py-6 text-sm text-slate-500">
                  No lab reports have been released on this page.
                </p>
              )}

              {resource.data.items.map((report) => (
                <article
                  key={report.id}
                  className="mb-4 rounded-xl border border-slate-200 p-4"
                >
                  <p className="text-xs font-bold text-teal-700">
                    {report.testCode}
                  </p>

                  <h2 className="mt-1 text-lg font-bold">{report.testName}</h2>

                  <p className="mt-2 text-sm text-slate-600">
                    Specimen: {report.specimenReference}
                  </p>

                  <p className="mt-2 text-xs text-slate-500">
                    Released {time(report.releasedAt)}
                    {" · "}
                    {report.reviewerName}
                  </p>

                  <button
                    type="button"
                    className={`${button} mt-4`}
                    onClick={() => setSelected(report.id)}
                  >
                    View / print report
                  </button>
                </article>
              ))}

              <footer className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Page {page} of{" "}
                  {Math.max(1, resource.data.pagination.totalPages)}
                  {" · "}
                  {resource.data.pagination.total} reports
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    className={button}
                    disabled={resource.loading || page <= 1}
                    onClick={() => setPage((value) => value - 1)}
                  >
                    Previous
                  </button>

                  <button
                    type="button"
                    className={button}
                    disabled={
                      resource.loading ||
                      page >= resource.data.pagination.totalPages
                    }
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Next
                  </button>
                </div>
              </footer>
            </>
          )}
        </section>
      )}
    </div>
  );

  return audience === "patient" ? (
    <PatientPortalFrame current="visits">{content}</PatientPortalFrame>
  ) : (
    content
  );
}

function ReportViewer({
  audience,
  endpoint,
  onClose,
}: {
  audience: Audience;
  endpoint: string;
  onClose: () => void;
}) {
  const router = useRouter();

  const resource = useResource<ReportResponse>(audience, endpoint);

  const [verified, setVerified] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [invalidated, setInvalidated] = useState(false);
  const [printing, setPrinting] = useState(false);

  const lock = useRef(false);
  const printRequest = useRef<AbortController | null>(null);

  const uniqueId = useId();

  const portalId =
    "larqon-lab-report-" + uniqueId.replace(/[^a-zA-Z0-9_-]/g, "");

  const report = invalidated
    ? null
    : (verified ?? resource.data?.report ?? null);

  useEffect(() => {
    return () => {
      printRequest.current?.abort();

      if (document.body.dataset.larqonPrint === portalId) {
        delete document.body.dataset.larqonPrint;
      }
    };
  }, [portalId]);

  async function printReport() {
    if (!report || lock.current) return;

    lock.current = true;
    setPrinting(true);
    setError("");

    const controller = new AbortController();
    printRequest.current = controller;

    try {
      // Recheck the signed-in user's ownership/access.
      const fresh = await request<ReportResponse>(audience, endpoint, {
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(45_000),
        ]),
      });

      if (controller.signal.aborted) return;

      // Released reports are immutable. If the response differs,
      // show the refreshed document for review before printing.
      if (JSON.stringify(fresh.report) !== JSON.stringify(report)) {
        setVerified(fresh.report);

        setError(
          "The report response changed. Review the refreshed document, then print again.",
        );

        return;
      }

      flushSync(() => {
        setVerified(fresh.report);
      });

      document.body.dataset.larqonPrint = portalId;

      window.print();
    } catch (caught) {
      if (controller.signal.aborted) return;

      setVerified(null);
      setInvalidated(true);

      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to verify report access.",
      );

      if (audience === "patient" && patientLoginRequired(caught)) {
        router.replace("/patient/login");
      }
    } finally {
      if (document.body.dataset.larqonPrint === portalId) {
        delete document.body.dataset.larqonPrint;
      }

      if (printRequest.current === controller) {
        printRequest.current = null;
      }

      lock.current = false;

      if (!controller.signal.aborted) {
        setPrinting(false);
      }
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap justify-between gap-3">
        <button
          type="button"
          className={button}
          disabled={printing}
          onClick={() => {
            if (!lock.current) onClose();
          }}
        >
          ← Report list
        </button>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={button}
            disabled={printing || resource.loading}
            onClick={() => {
              if (lock.current) return;

              setVerified(null);
              setInvalidated(false);
              setError("");
              resource.reload();
            }}
          >
            Refresh report
          </button>

          <button
            type="button"
            className={`${button} border-teal-800 bg-teal-800! text-white`}
            disabled={!report || resource.loading || printing}
            onClick={() => void printReport()}
          >
            {printing ? "Verifying…" : "Print / Save as PDF"}
          </button>
        </div>
      </header>

      {resource.loading && (
        <p role="status" className="text-sm">
          Loading report…
        </p>
      )}

      {(error || resource.error) && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {error || resource.error}
        </p>
      )}

      {report && !resource.loading && (
        <>
          <p className="text-sm text-slate-500">
            Choose “Save as PDF” in the browser’s print dialog to download a
            copy.
          </p>

          <LabReportDocument report={report} />

          {typeof document !== "undefined" &&
            createPortal(
              <div id={portalId} style={{ display: "none" }}>
                <LabReportDocument report={report} />
              </div>,
              document.body,
            )}
        </>
      )}

      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }

          body[data-larqon-print="${portalId}"] > :not(#${portalId}) {
            display: none !important;
          }

          body[data-larqon-print="${portalId}"] > #${portalId} {
            display: block !important;
          }

          #${portalId} {
            color: #000;
            background: #fff;
            font-size: 11pt;
          }

          #${portalId} .lab-report-sheet {
            border: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }

          #${portalId} .lab-report-identity {
            break-inside: avoid;
          }

          #${portalId} .lab-result-row { break-inside: avoid; }

          #${portalId} * {
            overflow-wrap: anywhere;
          }
        }
      `}</style>
    </div>
  );
}

function LabReportDocument({ report }: { report: Report }) {
  return (
    <article className="lab-report-sheet rounded-2xl border border-slate-200 bg-white p-6 text-slate-950 sm:p-8">
      <header className="border-b border-slate-300 pb-5">
        <p className="text-2xl font-bold">Larqon Hospitals</p>

        <h1 className="mt-2 text-lg font-semibold">
          Released laboratory report
        </h1>

        <p className="mt-3 break-all text-xs text-slate-500">
          Report reference: {report.id}
        </p>
      </header>

      <section className="lab-report-identity mt-5 grid gap-5 border-b border-slate-200 pb-5 sm:grid-cols-2">
        <div>
          <h2 className="text-xs font-semibold text-slate-500">PATIENT</h2>

          <p className="mt-1 font-semibold">{report.patientName}</p>

          <p className="mt-1 text-sm">MRN: {report.patientMrn}</p>

          <p className="mt-2 text-sm">Ordering doctor: {report.doctorName}</p>
        </div>

        <div className="text-sm">
          <p className="font-semibold">{report.testName}</p>

          <p className="mt-1">Test code: {report.testCode}</p>

          <p className="mt-1">Specimen: {report.specimenReference}</p>

          <p className="mt-1">Sample type: {report.sampleType}</p>

          <p className="mt-1">Collected: {time(report.collectedAt)}</p>
        </div>
      </section>

      <StructuredResultTable values={report.values ?? []} />
      {report.method && (
        <section className="mt-5 text-sm">
          <h2 className="font-semibold">Method</h2>
          <p className="mt-2 whitespace-pre-wrap">{report.method}</p>
        </section>
      )}

      <section className="mt-6">
        <h2 className="font-semibold">Result report</h2>

        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7">
          {report.resultText}
        </p>
      </section>

      {report.comments && (
        <section className="mt-6">
          <h2 className="font-semibold">Comments</h2>

          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7">
            {report.comments}
          </p>
        </section>
      )}

      <footer className="mt-8 border-t border-slate-300 pt-4 text-sm">
        <p className="font-semibold">
          Reviewed and released by {report.reviewerName}
        </p>

        <p className="mt-2">Released: {time(report.releasedAt)}</p>
      </footer>
    </article>
  );
}
