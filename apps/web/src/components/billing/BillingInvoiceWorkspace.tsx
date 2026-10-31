"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { apiRequest } from "@/lib/api";
import { useStaffUser } from "@/components/auth/StaffSessionGate";
import {
  BillingHeader,
  button,
  input,
  secondary,
  Notice,
  useLoad,
  useSafeMutation,
  inr,
  dateTime,
} from "./billing-shared";
import type { Invoice } from "./billing-shared";
type Print = { container: HTMLDivElement; invoice: Invoice };
export default function BillingInvoiceWorkspace({ id }: { id: string }) {
  const user = useStaffUser();
  const canManage = user.permissions?.includes("billing.invoices.manage"),
    canPay = user.permissions?.includes("billing.payments.record");
  const [revision, setRevision] = useState(0),
    [review, setReview] = useState(false),
    [reason, setReason] = useState(""),
    [method, setMethod] = useState<"CASH" | "UPI" | "CARD">("CASH"),
    [amount, setAmount] = useState(""),
    [reference, setReference] = useState(""),
    [notes, setNotes] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [message, setMessage] = useState(""),
    [printing, setPrinting] = useState(false),
    [printError, setPrintError] = useState(""),
    [print, setPrint] = useState<Print | null>(null);
  const printGate = useRef(false);
  const mutation = useSafeMutation<{ receiptNumber?: string }>(
    "invoice:" + id,
    (v) => {
      setMessage(
        v.receiptNumber
          ? `Payment recorded. Receipt ${v.receiptNumber}`
          : "Invoice updated.",
      );
      setReview(false);
      setReason("");
      setAmount("");
      setReference("");
      setNotes("");
      setConfirmed(false);
      setRevision((x) => x + 1);
    },
  );
  const records = useLoad<Invoice>(`/billing/invoices/${id}`, revision),
    invoice = records.data;
  useEffect(() => {
    if (!print) return;
    return () => {
      print.container.remove();
      if (document.body.dataset.larqonPrint === print.container.id)
        delete document.body.dataset.larqonPrint;
    };
  }, [print]);
  async function printInvoice() {
    if (printGate.current) return;
    printGate.current = true;
    setPrinting(true);
    setPrintError("");
    let container: HTMLDivElement | undefined;
    try {
      const current = await apiRequest<Invoice>(`/billing/invoices/${id}`, {
        signal: AbortSignal.timeout(30000),
      });
      container = document.createElement("div");
      container.id = "larqon-billing-print-" + crypto.randomUUID();
      container.className = "hidden";
      document.body.appendChild(container);
      flushSync(() => setPrint({ container: container!, invoice: current }));
      document.body.dataset.larqonPrint = container.id;
      window.addEventListener("afterprint", () => setPrint(null), {
        once: true,
      });
      window.print();
    } catch (e) {
      container?.remove();
      setPrint(null);
      setPrintError(e instanceof Error ? e.message : "Unable to print.");
    } finally {
      setPrinting(false);
      printGate.current = false;
    }
  }
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <BillingHeader
        title="Invoice details"
        description="Review the saved prices, issue the invoice, and record money actually received. UPI/card entries are manual records, without gateway verification."
      />
      <Notice error={records.error || printError} loading={records.loading} />
      {message && (
        <p
          role="status"
          className="rounded-xl bg-teal-50 p-3 text-sm text-teal-900"
        >
          {message}
        </p>
      )}
      <Notice error={mutation.error} />
      {mutation.pending && (
        <div className="rounded-xl bg-amber-50 p-4 text-sm">
          <p>
            An earlier invoice/payment result is unconfirmed. Keep its exact
            request until resolved.
          </p>
          <button
            className={`${button} mt-3`}
            disabled={mutation.busy}
            onClick={mutation.retry}
          >
            Retry same billing action
          </button>
        </div>
      )}
      {invoice && (
        <>
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">
                  {invoice.invoiceNumber ?? "Draft invoice"}
                </h2>
                <p className="text-sm">
                  {invoice.patientName} · {invoice.patientMrn}
                </p>
                <p className="text-xs text-slate-500">
                  {invoice.status} ·{" "}
                  {invoice.paymentStatus.replaceAll("_", " ")} · Version{" "}
                  {invoice.version}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className={secondary}
                  disabled={mutation.locked || printing}
                  onClick={() => {
                    setReview(false);
                    setConfirmed(false);
                    setRevision((x) => x + 1);
                  }}
                >
                  Refresh
                </button>
                <button
                  className={secondary}
                  disabled={mutation.locked || printing}
                  onClick={() => void printInvoice()}
                >
                  {printing ? "Verifying…" : "Print / Save as PDF"}
                </button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Total", invoice.total],
                ["Payments recorded", invoice.paid],
                [
                  invoice.status === "ISSUED"
                    ? "Outstanding"
                    : "Not due (unissued)",
                  invoice.outstanding,
                ],
              ].map(([label, value]) => (
                <div className="rounded-xl bg-slate-50 p-4" key={label}>
                  <p className="text-xs text-slate-600">{label}</p>
                  <strong className="text-xl">{inr(value)}</strong>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="p-2">Charge</th>
                    <th className="p-2">Quantity</th>
                    <th className="p-2">Unit price</th>
                    <th className="p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.map((l) => (
                    <tr className="border-b border-slate-100" key={l.id}>
                      <td className="p-2">{l.description}</td>
                      <td className="p-2">
                        {l.quantity} {l.quantityUnit}
                      </td>
                      <td className="p-2">{inr(l.unitPrice)}</td>
                      <td className="p-2 text-right">{inr(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {invoice.notes && (
              <p className="whitespace-pre-wrap text-sm">{invoice.notes}</p>
            )}
            {invoice.cancellationReason && (
              <p className="whitespace-pre-wrap text-sm text-rose-700">
                Draft cancelled: {invoice.cancellationReason}
              </p>
            )}
            <p className="text-xs text-slate-500">
              Internal INR billing record. Prices are frozen on this draft; no
              tax or discount is calculated.
            </p>
          </section>
          {invoice.status === "DRAFT" && canManage && (
            <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 sm:p-6">
              <div className="space-y-4">
                <h2 className="text-lg font-bold">Issue invoice</h2>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={review}
                    disabled={mutation.locked}
                    onChange={(e) => setReview(e.target.checked)}
                  />
                  <span>
                    I reviewed the patient, source charges, quantities, frozen
                    prices, and total.
                  </span>
                </label>
                <button
                  className={button}
                  disabled={mutation.locked || !review}
                  onClick={() =>
                    mutation.start(`/billing/invoices/${id}/issue`, {
                      expectedVersion: invoice.version,
                      reviewConfirmed: review,
                    })
                  }
                >
                  Issue and assign invoice number
                </button>
              </div>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  mutation.start(`/billing/invoices/${id}/cancel`, {
                    expectedVersion: invoice.version,
                    reason,
                  });
                }}
              >
                <h2 className="text-lg font-bold">Cancel draft</h2>
                <label className="block text-sm font-medium">
                  Reason
                  <textarea
                    className={`${input} mt-1`}
                    required
                    rows={2}
                    maxLength={1000}
                    disabled={mutation.locked}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <button
                  className={secondary}
                  disabled={mutation.locked || !reason.trim()}
                >
                  Cancel draft and release charges
                </button>
              </form>
            </section>
          )}
          {invoice.status === "ISSUED" &&
            canPay &&
            invoice.outstanding !== "0.00" && (
              <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
                <h2 className="text-lg font-bold">Record a payment</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    mutation.start(`/billing/invoices/${id}/payments`, {
                      expectedVersion: invoice.version,
                      method,
                      amount,
                      ...(method !== "CASH"
                        ? { externalReference: reference }
                        : {}),
                      notes,
                      receiptConfirmed: confirmed,
                    });
                  }}
                >
                  <fieldset
                    className="grid gap-4 sm:grid-cols-2"
                    disabled={mutation.locked}
                  >
                    <label className="text-sm font-medium">
                      Method
                      <select
                        className={`${input} mt-1`}
                        value={method}
                        onChange={(e) => {
                          setMethod(e.target.value as typeof method);
                          setReference("");
                          setConfirmed(false);
                        }}
                      >
                        <option value="CASH">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="CARD">Card</option>
                      </select>
                    </label>
                    <label className="text-sm font-medium">
                      Amount received (INR)
                      <input
                        className={`${input} mt-1`}
                        type="number"
                        min="0.01"
                        max={invoice.outstanding}
                        step="0.01"
                        value={amount}
                        required
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </label>
                    {method !== "CASH" && (
                      <label className="text-sm font-medium sm:col-span-2">
                        Transaction reference
                        <input
                          className={`${input} mt-1`}
                          required
                          maxLength={100}
                          value={reference}
                          onChange={(e) => setReference(e.target.value)}
                        />
                        <span className="text-xs font-normal text-slate-500">
                          Use the transaction reference, not card details.
                          Confirm receipt in your payment system.
                        </span>
                      </label>
                    )}
                    <label className="text-sm font-medium sm:col-span-2">
                      Payment note (optional)
                      <textarea
                        className={`${input} mt-1`}
                        rows={2}
                        maxLength={1000}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </label>
                    <label className="flex items-start gap-2 text-sm sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                      />
                      <span>
                        I verified the patient/invoice and actual receipt of
                        this amount. This action records a manual payment.
                      </span>
                    </label>
                    <button className={button} disabled={!confirmed}>
                      Record payment and receipt
                    </button>
                  </fieldset>
                </form>
              </section>
            )}
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
            <h2 className="text-lg font-bold">Payment receipts</h2>
            {!invoice.payments.length && (
              <p className="text-sm text-slate-600">No payments recorded.</p>
            )}
            {invoice.payments.map((p) => (
              <article
                key={p.id}
                className="space-y-1 rounded-xl border border-slate-200 p-3 text-sm"
              >
                <strong>
                  {p.receiptNumber} · {inr(p.amount)} · {p.method}
                </strong>
                <p>
                  {dateTime(p.recordedAt)} · {p.recordedBy.fullName}
                </p>
                {p.externalReference && (
                  <p className="break-all">
                    Transaction reference: {p.externalReference}
                  </p>
                )}
                {p.notes && (
                  <p className="whitespace-pre-wrap text-slate-600">
                    {p.notes}
                  </p>
                )}
              </article>
            ))}
          </section>
        </>
      )}
      {print &&
        createPortal(
          <BillingDocument invoice={print.invoice} />,
          print.container,
        )}
      <style>{`@media print { @page { size:A4; margin:12mm; } body[data-larqon-print^="larqon-billing-print-"] > :not([id^="larqon-billing-print-"]) { display:none !important; } body[data-larqon-print^="larqon-billing-print-"] > [id^="larqon-billing-print-"] { display:block !important; color:#000; background:#fff; font-size:10pt; } .billing-print-sheet table { width:100%; border-collapse:collapse; } .billing-print-sheet th,.billing-print-sheet td { border:1px solid #bbb; padding:6px; text-align:left; overflow-wrap:anywhere; } .billing-print-sheet tr,.billing-print-identity { break-inside:avoid; } }`}</style>
    </main>
  );
}
function BillingDocument({ invoice: i }: { invoice: Invoice }) {
  return (
    <article className="billing-print-sheet">
      <div className="billing-print-identity">
        <h1>Larqon Hospitals</h1>
        <h2>
          Internal billing statement · {i.invoiceNumber ?? "Unissued draft"}
        </h2>
        <p>
          {i.patientName} · MRN {i.patientMrn}
        </p>
        <p>
          {i.status} ·{" "}
          {i.issuedAt ? dateTime(i.issuedAt) : dateTime(i.createdAt)}
        </p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Charge</th>
            <th>Quantity</th>
            <th>INR/unit</th>
            <th>INR amount</th>
          </tr>
        </thead>
        <tbody>
          {i.lines.map((l) => (
            <tr key={l.id}>
              <td>{l.description}</td>
              <td>
                {l.quantity} {l.quantityUnit}
              </td>
              <td>{l.unitPrice}</td>
              <td>{l.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <strong>
          Total INR {i.total} · Recorded payments INR {i.paid} · Outstanding INR{" "}
          {i.outstanding}
        </strong>
      </p>
      {i.notes && <p>{i.notes}</p>}
      <h3>Payment receipts — manually recorded</h3>
      <table>
        <thead>
          <tr>
            <th>Receipt/date</th>
            <th>Method/reference</th>
            <th>INR amount</th>
            <th>Recorded by</th>
          </tr>
        </thead>
        <tbody>
          {i.payments.map((p) => (
            <tr key={p.id}>
              <td>
                {p.receiptNumber}
                <br />
                {dateTime(p.recordedAt)}
              </td>
              <td>
                {p.method}
                <br />
                {p.externalReference}
              </td>
              <td>{p.amount}</td>
              <td>{p.recordedBy.fullName}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        No tax calculation or gateway verification is included in this
        statement.
      </p>
    </article>
  );
}
