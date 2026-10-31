"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState } from "react";

import { apiRequest } from "@/lib/api";
import { useStaffUser } from "@/components/auth/StaffSessionGate";
import { allergyOptions } from "@/lib/prescription-draft";
import type { Detail } from "@/lib/prescription-draft";

export type PrescriptionDocumentData = Pick<
  Detail["prescription"],
  | "id"
  | "status"
  | "patientName"
  | "patientMrn"
  | "prescriberName"
  | "prescriberRegistrationNumber"
  | "prescriberRegistrationAuthority"
  | "issuedAt"
  | "allergyStatus"
  | "allergyDetails"
  | "instructions"
> & {
  items: Pick<
    Detail["prescription"]["items"][number],
    | "id"
    | "medicineName"
    | "genericName"
    | "strength"
    | "dosageForm"
    | "dose"
    | "route"
    | "frequency"
    | "duration"
    | "quantity"
    | "quantityUnit"
    | "instructions"
  >[];
};

const time = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "medium",
  timeStyle: "short",
});

export function isPrintable(data: Detail | null): boolean {
  const prescription = data?.prescription;

  return Boolean(
    prescription &&
    prescription.status === "ISSUED" &&
    prescription.items.length > 0 &&
    prescription.patientName?.trim() &&
    prescription.patientMrn?.trim() &&
    prescription.prescriberName?.trim() &&
    prescription.prescriberRegistrationNumber?.trim() &&
    prescription.issuedAt &&
    Number.isFinite(new Date(prescription.issuedAt).getTime()),
  );
}

export default function IssuedPrescription({
  appointmentId,
  prescriptionId,
}: {
  appointmentId: string;
  prescriptionId: string;
}) {
  const user = useStaffUser();

  const canRead = user.permissions?.includes("prescriptions.own.read") ?? false;

  const endpoint = `/doctor/appointments/${appointmentId}/prescriptions/${prescriptionId}`;

  const [result, setResult] = useState<{
    data: Detail | null;
    error: string;
  } | null>(null);

  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);

  const uniqueId = useId();

  const portalId = `larqon-print-${uniqueId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const data = result?.data ?? null;
  const printable = isPrintable(data);

  useEffect(() => {
    if (!canRead) return;

    let active = true;
    const controller = new AbortController();

    apiRequest<Detail>(endpoint, {
      signal: controller.signal,
    })
      .then((value) => {
        if (active) {
          setResult({
            data: value,
            error: "",
          });
        }
      })
      .catch((caught) => {
        if (!active || controller.signal.aborted) return;

        setResult({
          data: null,
          error:
            caught instanceof Error
              ? caught.message
              : "Unable to load prescription.",
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [canRead, endpoint]);

  useEffect(() => {
    if (!printable) return;

    document.body.dataset.larqonPrint = portalId;

    return () => {
      if (document.body.dataset.larqonPrint === portalId) {
        delete document.body.dataset.larqonPrint;
      }
    };
  }, [printable, portalId]);

  async function reload() {
    if (lock.current) return;

    setResult(null);
    setError("");

    try {
      setResult({
        data: await apiRequest<Detail>(endpoint),
        error: "",
      });
    } catch (caught) {
      setResult({
        data: null,
        error: caught instanceof Error ? caught.message : "Unable to reload.",
      });
    }
  }

  async function print() {
    if (!data || !printable || lock.current) return;

    lock.current = true;
    setPrinting(true);
    setError("");

    try {
      // Verify authorization and current status again.
      const fresh = await apiRequest<Detail>(endpoint);

      if (
        !isPrintable(fresh) ||
        fresh.prescription.version !== data.prescription.version
      ) {
        setResult({
          data: fresh,
          error: "",
        });

        setError(
          "The record changed. Review its current status before printing.",
        );
        return;
      }

      document.body.dataset.larqonPrint = portalId;
      window.print();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to verify prescription status.",
      );
    } finally {
      lock.current = false;
      setPrinting(false);
    }
  }

  if (!canRead) {
    return <p role="alert">Your account cannot view this prescription.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/my-appointments/${appointmentId}/prescriptions`}
          className="text-sm font-semibold text-teal-800"
        >
          ← Prescriptions
        </Link>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!result || printing}
            onClick={() => void reload()}
            className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Refresh status
          </button>

          <button
            type="button"
            disabled={!printable || printing}
            onClick={() => void print()}
            className="min-h-11 rounded-xl bg-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {printing ? "Verifying…" : "Print prescription"}
          </button>
        </div>
      </div>

      {!result && <p role="status">Loading issued prescription…</p>}

      {result?.error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
          {result.error}
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
          {error}
        </p>
      )}

      {data && !printable && (
        <p role="alert" className="rounded-xl bg-amber-50 p-4">
          Printing requires an issued prescription with complete identity
          details. Current status: {data.prescription.status}.
        </p>
      )}

      {data && printable && (
        <>
          <PrescriptionDocument data={data} />

          {typeof document !== "undefined" &&
            createPortal(
              <div
                id={portalId}
                data-prescription-print-root
                style={{ display: "none" }}
              >
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
    </div>
  );
}

export function PrescriptionDocument({
  data,
}: {
  data: {
    prescription: PrescriptionDocumentData;
  };
}) {
  const prescription = data.prescription;

  return (
    <article className="prescription-sheet rounded-2xl border border-slate-200 bg-white p-6 text-slate-950 sm:p-8">
      <header className="border-b border-slate-300 pb-5">
        <p className="text-2xl font-bold">Larqon Hospitals</p>

        <h1 className="mt-1 text-lg font-semibold">Issued prescription</h1>

        <p className="mt-3 break-all text-xs text-slate-600">
          Reference: {prescription.id}
        </p>

        <p className="mt-1 text-sm">
          Issued:{" "}
          {prescription.issuedAt
            ? time.format(new Date(prescription.issuedAt))
            : ""}{" "}
          IST
        </p>
      </header>

      <section className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <h2 className="text-xs font-semibold text-slate-500">PATIENT</h2>

          <p className="mt-1 font-semibold">{prescription.patientName}</p>

          <p className="mt-1 text-sm">MRN: {prescription.patientMrn}</p>
        </div>

        <div>
          <h2 className="text-xs font-semibold text-slate-500">PRESCRIBER</h2>

          <p className="mt-1 font-semibold">{prescription.prescriberName}</p>

          <p className="mt-1 text-sm">
            Registration: {prescription.prescriberRegistrationNumber}
          </p>

          {prescription.prescriberRegistrationAuthority && (
            <p className="mt-1 text-sm">
              {prescription.prescriberRegistrationAuthority}
            </p>
          )}
        </div>
      </section>

      <section className="mt-5 border-y border-slate-200 py-4 text-sm">
        <h2 className="font-semibold">Allergy review</h2>

        <p className="mt-1">
          {
            allergyOptions.find(
              ([value]) => value === prescription.allergyStatus,
            )?.[1]
          }
        </p>

        {prescription.allergyDetails && (
          <p className="mt-2 whitespace-pre-wrap">
            {prescription.allergyDetails}
          </p>
        )}
      </section>

      <ol className="mt-5 space-y-4">
        {prescription.items.map((item, index) => (
          <li
            key={item.id}
            className="prescription-item rounded-xl border border-slate-200 p-4"
          >
            <h2 className="font-semibold">
              {index + 1}. {item.medicineName}
              {" · "}
              {item.strength}
              {" · "}
              {item.dosageForm}
            </h2>

            {item.genericName && item.genericName !== item.medicineName && (
              <p className="mt-1 text-sm">{item.genericName}</p>
            )}

            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              {[
                ["Dose", item.dose],
                ["Route", item.route],
                ["Frequency", item.frequency],
                ["Duration", item.duration],
                ["Quantity", `${item.quantity} ${item.quantityUnit}`],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-slate-500">{label}</dt>

                  <dd className="mt-1 whitespace-pre-wrap">{value}</dd>
                </div>
              ))}
            </dl>

            {item.instructions && (
              <p className="mt-3 whitespace-pre-wrap text-sm">
                {item.instructions}
              </p>
            )}
          </li>
        ))}
      </ol>

      {prescription.instructions && (
        <section className="mt-5">
          <h2 className="font-semibold">General instructions</h2>

          <p className="mt-2 whitespace-pre-wrap text-sm">
            {prescription.instructions}
          </p>
        </section>
      )}
    </article>
  );
}
