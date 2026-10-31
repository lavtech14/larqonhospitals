"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal, flushSync } from "react-dom";
import { useEffect, useId, useRef, useState } from "react";

import { ApiError } from "@/lib/api";
import { patientApiRequest } from "@/lib/patient-api";

import { PrescriptionDocument } from "@/components/prescriptions/IssuedPrescription";

import type { PrescriptionDocumentData } from "@/components/prescriptions/IssuedPrescription";

import PatientPortalFrame from "./PatientPortalFrame";

type PrescriptionResponse = {
  visitId: string;

  prescription: PrescriptionDocumentData & {
    version: number;
  };
};

const button =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50";

function printable(data: PrescriptionResponse | null): boolean {
  const prescription = data?.prescription;

  return Boolean(
    prescription &&
    prescription.status === "ISSUED" &&
    prescription.items.length > 0 &&
    prescription.patientName?.trim() &&
    prescription.patientMrn?.trim() &&
    prescription.prescriberName?.trim() &&
    prescription.prescriberRegistrationNumber?.trim() &&
    Number.isInteger(prescription.version) &&
    prescription.version > 0 &&
    prescription.issuedAt &&
    Number.isFinite(new Date(prescription.issuedAt).getTime()),
  );
}

function requiresLogin(caught: unknown): boolean {
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

export default function PatientPrescriptionPrint({
  visitId,
  prescriptionId,
}: {
  visitId: string;
  prescriptionId: string;
}) {
  const router = useRouter();

  const endpoint =
    `/patient/visits/${visitId}` + `/prescriptions/${prescriptionId}`;

  const [revision, setRevision] = useState(0);

  const requestKey = `${endpoint}:${revision}`;

  const [remote, setRemote] = useState<{
    key: string;
    data: PrescriptionResponse | null;
    error: string;
  } | null>(null);

  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState("");

  const lock = useRef(false);
  const printRequest = useRef<AbortController | null>(null);

  const uniqueId = useId();

  const portalId =
    `larqon-patient-print-` + uniqueId.replace(/[^a-zA-Z0-9_-]/g, "");

  const data = remote?.key === requestKey ? remote.data : null;

  const loading = remote?.key !== requestKey;
  const canPrint = printable(data);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function load() {
      try {
        const result = await patientApiRequest<PrescriptionResponse>(endpoint, {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(45_000),
          ]),
        });

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
              : "Unable to load your prescription.",
        });

        if (requiresLogin(caught)) {
          router.replace("/patient/login");
        }
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [endpoint, requestKey, router]);

  useEffect(() => {
    return () => {
      printRequest.current?.abort();

      if (document.body.dataset.larqonPrint === portalId) {
        delete document.body.dataset.larqonPrint;
      }
    };
  }, [portalId]);

  async function printPrescription() {
    if (!data || !canPrint || lock.current) return;

    lock.current = true;
    setPrinting(true);
    setError("");

    const controller = new AbortController();
    printRequest.current = controller;

    try {
      // Recheck ownership, patient session, and issued status.
      const fresh = await patientApiRequest<PrescriptionResponse>(endpoint, {
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(45_000),
        ]),
      });

      if (controller.signal.aborted) return;

      if (!printable(fresh)) {
        setRemote({
          key: requestKey,
          data: fresh,
          error: "",
        });

        setError("This prescription is not available for printing.");

        return;
      }

      if (fresh.prescription.version !== data.prescription.version) {
        setRemote({
          key: requestKey,
          data: fresh,
          error: "",
        });

        setError(
          "The prescription changed. Review the refreshed document, then print again.",
        );

        return;
      }

      // Render the verified response before opening print preview.
      flushSync(() => {
        setRemote({
          key: requestKey,
          data: fresh,
          error: "",
        });
      });

      document.body.dataset.larqonPrint = portalId;

      window.print();
    } catch (caught) {
      if (controller.signal.aborted) return;

      // Clear the old document when verification fails.
      setRemote({
        key: requestKey,
        data: null,
        error:
          caught instanceof Error
            ? caught.message
            : "Unable to verify prescription status.",
      });

      if (requiresLogin(caught)) {
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
    <PatientPortalFrame current="visits">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/patient/visits/${visitId}`}
          className="text-sm font-semibold text-teal-800"
          onClick={(event) => {
            if (lock.current) {
              event.preventDefault();
            }
          }}
        >
          ← Visit details
        </Link>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={button}
            disabled={loading || printing}
            onClick={() => {
              if (lock.current) return;

              setError("");
              setRevision((current) => current + 1);
            }}
          >
            Refresh status
          </button>

          <button
            type="button"
            className={`${button} border-teal-800 bg-teal-800! text-white`}
            disabled={loading || printing || !canPrint}
            onClick={() => void printPrescription()}
          >
            {printing ? "Verifying…" : "Print / Save as PDF"}
          </button>
        </div>
      </header>

      <p className="text-sm leading-6 text-slate-600">
        Review your prescription below. To download a PDF, choose “Save as PDF”
        in your browser’s print dialog.
      </p>

      {loading && (
        <p role="status" className="text-sm text-slate-500">
          Loading your issued prescription…
        </p>
      )}

      {remote?.key === requestKey && remote.error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {remote.error} Use Refresh status to try again.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950"
        >
          {error}
        </p>
      )}

      {data && !canPrint && (
        <p
          role="alert"
          className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950"
        >
          Printing requires an issued prescription with complete patient and
          prescriber details.
        </p>
      )}

      {data && canPrint && (
        <>
          <PrescriptionDocument data={data} />

          {typeof document !== "undefined" &&
            createPortal(
              <div id={portalId} style={{ display: "none" }}>
                <PrescriptionDocument data={data} />
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

          #${portalId} .prescription-sheet {
            border: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
            border-radius: 0 !important;
          }

          #${portalId} .prescription-item {
            break-inside: avoid;
            border-color: #999;
          }

          #${portalId} * {
            overflow-wrap: anywhere;
          }
        }
      `}</style>
    </PatientPortalFrame>
  );
}
