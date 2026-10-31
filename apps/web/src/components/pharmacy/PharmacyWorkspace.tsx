"use client";
import Link from "next/link";
import { useState } from "react";
import {
  input,
  button,
  secondary,
  Notice,
  Pager,
  PharmacyHeader,
  ReceiptCard,
  useLoad,
  dateTime,
} from "./pharmacy-shared";
import type { Paged, Receipt } from "./pharmacy-shared";
type QueueItem = {
  id: string;
  patientName: string;
  patientMrn: string;
  prescriberName: string;
  issuedAt: string;
  lineCount: number;
  completedLines: number;
  dispensingStatus: string;
};
export default function PharmacyWorkspace() {
  const [tab, setTab] = useState<"pending" | "all" | "history">("pending"),
    [search, setSearch] = useState(""),
    [draft, setDraft] = useState(""),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0);
  const path = `/pharmacy/${tab === "history" ? "dispenses" : "prescriptions"}?scope=${tab === "pending" ? "pending" : "all"}&search=${encodeURIComponent(search)}&page=${page}&limit=20`;
  const { data, error, loading } = useLoad<Paged<QueueItem | Receipt>>(
    path,
    revision,
  );
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <PharmacyHeader
        title="Pharmacy dispensing"
        description="Review issued prescriptions, confirm patient identity, and record full or partial supplies against available batches."
      />
      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap gap-2">
          {(["pending", "all", "history"] as const).map((x) => (
            <button
              key={x}
              className={tab === x ? button : secondary}
              aria-pressed={tab === x}
              onClick={() => {
                setTab(x);
                setPage(1);
              }}
            >
              {x === "pending"
                ? "Awaiting supply"
                : x === "all"
                  ? "All issued"
                  : "Dispensing history"}
            </button>
          ))}
        </div>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(draft.trim());
            setPage(1);
            setRevision((x) => x + 1);
          }}
        >
          <label className="min-w-48 flex-1 text-sm font-medium">
            Patient name or MRN
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
          <p className="py-6 text-slate-600">No matching records.</p>
        )}
        <div className="grid gap-4">
          {data?.items.map((item) =>
            "dispensingStatus" in item ? (
              <article
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4"
              >
                <div>
                  <h2 className="font-bold text-slate-950">
                    {item.patientName} · {item.patientMrn}
                  </h2>
                  <p className="text-sm text-slate-600">
                    {item.prescriberName} · Issued {dateTime(item.issuedAt)}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-teal-800">
                    {item.dispensingStatus.replaceAll("_", " ")} ·{" "}
                    {item.completedLines}/{item.lineCount} lines fully supplied
                  </p>
                </div>
                <Link href={`/pharmacy/${item.id}`} className={button}>
                  Review prescription
                </Link>
              </article>
            ) : (
              <ReceiptCard key={item.id} receipt={item} />
            ),
          )}
        </div>
        {data && <Pager info={data.pagination} onPage={setPage} />}
      </section>
    </main>
  );
}
