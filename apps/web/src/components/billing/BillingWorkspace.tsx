"use client";
import Link from "next/link";
import { useState } from "react";
import {
  BillingHeader,
  button,
  input,
  Notice,
  Pager,
  useLoad,
  inr,
  dateTime,
} from "./billing-shared";
import type { Invoice, Paged } from "./billing-shared";
export default function BillingWorkspace() {
  const [search, setSearch] = useState(""),
    [draft, setDraft] = useState(""),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0);
  const { data, error, loading } = useLoad<Paged<Invoice>>(
    `/billing/invoices?search=${encodeURIComponent(search)}&page=${page}&limit=20`,
    revision,
  );
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <BillingHeader
        title="Billing and payments"
        description="Review internal INR invoices, recorded payments, and outstanding balances."
      />
      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(draft.trim());
            setPage(1);
            setRevision((x) => x + 1);
          }}
        >
          <label className="flex-1 text-sm font-medium">
            Patient name, MRN, or invoice number
            <input
              className={`${input} mt-1`}
              value={draft}
              maxLength={100}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <button className={button}>Search / refresh</button>
        </form>
        <Notice error={error} loading={loading} />
        {data?.items.length === 0 && (
          <p className="py-5 text-sm text-slate-600">No invoices found.</p>
        )}
        <div className="grid gap-4">
          {data?.items.map((i) => (
            <article
              key={i.id}
              className="flex flex-wrap justify-between gap-4 rounded-xl border border-slate-200 p-4"
            >
              <div>
                <h2 className="font-bold">
                  {i.patientName} · {i.patientMrn}
                </h2>
                <p className="text-sm text-slate-600">
                  {i.invoiceNumber ?? "Unissued draft"} ·{" "}
                  {dateTime(i.createdAt)}
                </p>
                <p className="mt-1 text-xs font-semibold text-teal-800">
                  {i.status} · {i.paymentStatus.replaceAll("_", " ")}
                </p>
              </div>
              <div className="text-sm">
                <p>
                  Total {inr(i.total)} · Recorded {inr(i.paid)}
                </p>
                <p className="font-bold">
                  {i.status === "ISSUED" ? "Outstanding" : "Draft total"}{" "}
                  {inr(i.status === "ISSUED" ? i.outstanding : i.total)}
                </p>
              </div>
              <Link href={`/billing/${i.id}`} className={button}>
                Open invoice
              </Link>
            </article>
          ))}
        </div>
        {data && <Pager info={data.pagination} onPage={setPage} />}
      </section>
    </main>
  );
}
