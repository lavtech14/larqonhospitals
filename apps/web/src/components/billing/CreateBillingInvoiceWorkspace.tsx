"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffUser } from "@/components/auth/StaffSessionGate";
import {
  BillingHeader,
  button,
  input,
  secondary,
  Notice,
  Pager,
  useLoad,
  useSafeMutation,
  kinds,
  inr,
  dateTime,
} from "./billing-shared";
import type { Kind, Paged, Price } from "./billing-shared";
type Patient = { id: string; fullName: string; mrn: string };
type Charge = {
  id: string;
  kind: Kind;
  description: string;
  quantity: string;
  quantityUnit: string;
  happenedAt: string;
  price: Price | null;
  lineAmount: string | null;
  reservedInvoiceId: string | null;
};
export default function CreateBillingInvoiceWorkspace() {
  const router = useRouter(),
    user = useStaffUser();
  const canCreate = user.permissions?.includes("billing.invoices.manage");
  const [patient, setPatient] = useState<Patient | null>(null),
    [search, setSearch] = useState(""),
    [draft, setDraft] = useState(""),
    [patientPage, setPatientPage] = useState(1),
    [kind, setKind] = useState<Kind>("CONSULTATION"),
    [chargePage, setChargePage] = useState(1),
    [selected, setSelected] = useState<Charge[]>([]),
    [notes, setNotes] = useState(""),
    [revision, setRevision] = useState(0);
  const mutation = useSafeMutation<{ invoiceId: string }>(
    "create-invoice",
    (v) => router.push(`/billing/${v.invoiceId}`),
  );
  const patients = useLoad<Paged<Patient>>(
    `/billing/patients?search=${encodeURIComponent(search)}&page=${patientPage}&limit=10`,
  );
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <BillingHeader
        title="Create an invoice draft"
        description="Choose the patient and existing service records. Prices and quantities come from verified source records; they cannot be entered as arbitrary charges."
      />
      <Notice error={mutation.error} />
      {mutation.pending && (
        <div className="rounded-xl bg-amber-50 p-4 text-sm">
          <p>
            An earlier draft-creation result is unconfirmed. Resolve that
            request first.
          </p>
          <button
            className={`${button} mt-3`}
            disabled={mutation.busy}
            onClick={mutation.retry}
          >
            Retry same draft creation
          </button>
        </div>
      )}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-bold">1. Select patient</h2>
        <form
          className="flex items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(draft.trim());
            setPatientPage(1);
          }}
        >
          <label className="flex-1 text-sm font-medium">
            Patient name or MRN
            <input
              className={`${input} mt-1`}
              value={draft}
              disabled={mutation.locked}
              maxLength={100}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <button className={secondary} disabled={mutation.locked}>
            Find
          </button>
        </form>
        <Notice error={patients.error} loading={patients.loading} />
        <div className="grid gap-2">
          {patients.data?.items.map((p) => (
            <button
              key={p.id}
              disabled={mutation.locked}
              className={`rounded-xl border p-3 text-left text-sm ${patient?.id === p.id ? "border-teal-600 bg-teal-50" : "border-slate-200"}`}
              onClick={() => {
                setPatient(p);
                setSelected([]);
                setNotes("");
                setChargePage(1);
              }}
            >
              {p.fullName} · {p.mrn}
            </button>
          ))}
        </div>
        {patients.data && (
          <Pager
            info={patients.data.pagination}
            onPage={setPatientPage}
            disabled={mutation.locked}
          />
        )}
      </section>
      {patient && (
        <>
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
            <h2 className="text-lg font-bold">
              2. Select charges for {patient.fullName} · {patient.mrn}
            </h2>
            <div className="flex flex-wrap gap-2">
              {kinds.map((k) => (
                <button
                  className={kind === k ? button : secondary}
                  disabled={mutation.locked}
                  key={k}
                  onClick={() => {
                    setKind(k);
                    setChargePage(1);
                  }}
                >
                  {k === "CONSULTATION"
                    ? "Consultations"
                    : k === "LAB"
                      ? "Ordered tests"
                      : "Dispensed medicines"}
                </button>
              ))}
              <button
                className={secondary}
                disabled={mutation.locked}
                onClick={() => {
                  setSelected([]);
                  setRevision((x) => x + 1);
                }}
              >
                Refresh charges / clear selection
              </button>
            </div>
            <Charges
              patientId={patient.id}
              kind={kind}
              page={chargePage}
              revision={revision}
              selected={selected}
              disabled={mutation.locked || !canCreate}
              onPage={setChargePage}
              onToggle={(charge) => {
                const key = `${charge.kind}:${charge.id}`;
                setSelected(
                  selected.some((x) => `${x.kind}:${x.id}` === key)
                    ? selected.filter((x) => `${x.kind}:${x.id}` !== key)
                    : [...selected, charge],
                );
              }}
            />
          </section>
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
            <h2 className="text-lg font-bold">
              3. Review draft charges ({selected.length}/100)
            </h2>
            {selected.map((c) => (
              <div
                key={`${c.kind}:${c.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm"
              >
                <span>
                  {c.description} · {c.quantity} {c.quantityUnit} ·{" "}
                  {inr(c.lineAmount!)}
                </span>
                <button
                  className={secondary}
                  disabled={mutation.locked}
                  onClick={() =>
                    setSelected(
                      selected.filter(
                        (x) => x.kind !== c.kind || x.id !== c.id,
                      ),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <label className="block text-sm font-medium">
              Invoice note (optional)
              <textarea
                className={`${input} mt-1`}
                rows={3}
                maxLength={1000}
                value={notes}
                disabled={mutation.locked}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <p className="text-sm text-slate-600">
              The server calculates and saves the exact INR total. Review the
              saved draft before issuing it. No tax or discount is added.
            </p>
            <button
              className={button}
              disabled={
                mutation.locked ||
                !canCreate ||
                !selected.length ||
                selected.length > 100
              }
              onClick={() =>
                mutation.start("/billing/invoices", {
                  patientId: patient.id,
                  notes,
                  lines: selected.map((c) => ({
                    kind: c.kind,
                    sourceId: c.id,
                    priceId: c.price!.id,
                    expectedPriceVersion: c.price!.version,
                  })),
                })
              }
            >
              {mutation.busy ? "Saving…" : "Save draft invoice"}
            </button>
          </section>
        </>
      )}
    </main>
  );
}
function Charges({
  patientId,
  kind,
  page,
  revision,
  selected,
  disabled,
  onPage,
  onToggle,
}: {
  patientId: string;
  kind: Kind;
  page: number;
  revision: number;
  selected: Charge[];
  disabled: boolean;
  onPage: (p: number) => void;
  onToggle: (c: Charge) => void;
}) {
  const { data, error, loading } = useLoad<Paged<Charge>>(
    `/billing/patients/${patientId}/charges?kind=${kind}&page=${page}&limit=20`,
    revision,
  );
  return (
    <>
      <Notice error={error} loading={loading} />
      {data?.items.length === 0 && (
        <p className="text-sm text-slate-600">
          No source records in this category.
        </p>
      )}
      {data?.items.map((c) => (
        <article key={c.id} className="rounded-xl border border-slate-200 p-3">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-teal-700"
              disabled={disabled || !c.price || !!c.reservedInvoiceId}
              checked={selected.some((s) => s.kind === c.kind && s.id === c.id)}
              onChange={() => onToggle(c)}
            />
            <div className="min-w-0">
              <strong className="text-sm">{c.description}</strong>
              <p className="text-xs text-slate-500">{dateTime(c.happenedAt)}</p>
              <p className="text-sm">
                {c.quantity} {c.quantityUnit} ·{" "}
                {c.price
                  ? `${inr(c.price.unitPrice)} each · ${inr(c.lineAmount!)}`
                  : "No active price configured for this exact service/unit"}
              </p>
              {c.reservedInvoiceId && (
                <Link
                  className="text-sm font-semibold text-teal-700 underline"
                  href={`/billing/${c.reservedInvoiceId}`}
                >
                  Already reserved or billed — open invoice
                </Link>
              )}
            </div>
          </label>
        </article>
      ))}
      {data && (
        <Pager info={data.pagination} onPage={onPage} disabled={disabled} />
      )}
    </>
  );
}
