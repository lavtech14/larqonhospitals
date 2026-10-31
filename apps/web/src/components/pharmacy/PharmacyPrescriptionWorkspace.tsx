"use client";
import { useState } from "react";
import { useStaffUser } from "@/components/auth/StaffSessionGate";
import {
  button,
  input,
  secondary,
  Notice,
  Pager,
  PharmacyHeader,
  ReceiptCard,
  useLoad,
  useSafeMutation,
  dateTime,
} from "./pharmacy-shared";
import type { Lot, Paged, Receipt } from "./pharmacy-shared";
type Item = {
  id: string;
  medicineId: string;
  medicineName: string;
  strength: string;
  dosageForm: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  quantity: string;
  quantityUnit: string;
  instructions: string | null;
  dispensedQuantity: string;
  remainingQuantity: string;
};
type Detail = {
  prescription: {
    id: string;
    status: string;
    version: number;
    patientName: string;
    patientMrn: string;
    prescriberName: string;
    prescriberRegistrationNumber: string | null;
    prescriberRegistrationAuthority: string | null;
    issuedAt: string;
    allergyStatus: string;
    allergyDetails: string | null;
    instructions: string | null;
    items: Item[];
  };
  history: Receipt[];
  historyLimitedTo: number;
};
type Allocation = {
  clientId: string;
  prescriptionItemId: string;
  stockLotId: string;
  quantity: string;
  label: string;
};
function LotPicker({
  item,
  onAdd,
  disabled,
  revision,
}: {
  item: Item;
  onAdd: (lot: Lot, amount: string) => void;
  disabled: boolean;
  revision: number;
}) {
  const [page, setPage] = useState(1),
    [amounts, setAmounts] = useState<Record<string, string>>({});
  const { data, error, loading } = useLoad<Paged<Lot>>(
    `/pharmacy/stock?medicineId=${item.medicineId}&page=${page}&limit=10`,
    revision,
  );
  return (
    <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-600">
        Lots are ordered by earliest expiry. Choose a matching unit; quantities
        below are not reserved.
      </p>
      <Notice error={error} loading={loading} />
      {data?.items.map((lot) => {
        const eligible =
          !lot.expired &&
          lot.verifiedSnapshot &&
          lot.medicine.isActive &&
          Number(lot.availableQuantity) > 0 &&
          lot.quantityUnit.trim().toLowerCase() ===
            item.quantityUnit.trim().toLowerCase() &&
          lot.medicineName === item.medicineName &&
          lot.strength === item.strength &&
          lot.dosageForm === item.dosageForm;
        return (
          <div
            key={lot.id}
            className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3"
          >
            <div className="min-w-48 flex-1">
              <p className="text-sm font-semibold">
                Batch {lot.batchNumber} · Expiry {lot.expiryDate.slice(0, 10)}
              </p>
              <p className="text-xs text-slate-600">
                On hand {lot.availableQuantity} {lot.quantityUnit}
              </p>
              {!eligible && (
                <p className="text-xs text-rose-700">
                  Unavailable, expired, or description/unit does not match.
                </p>
              )}
            </div>
            <label className="w-32 text-xs font-medium">
              Supply quantity
              <input
                aria-label={`Supply quantity from batch ${lot.batchNumber}`}
                className={`${input} mt-1`}
                type="number"
                min="0.01"
                step="0.01"
                max={Math.min(
                  Number(lot.availableQuantity),
                  Number(item.remainingQuantity),
                )}
                disabled={disabled || !eligible}
                value={amounts[lot.id] ?? ""}
                onChange={(e) =>
                  setAmounts({ ...amounts, [lot.id]: e.target.value })
                }
              />
            </label>
            <button
              type="button"
              className={secondary}
              disabled={
                disabled ||
                !eligible ||
                !(Number(amounts[lot.id]) > 0) ||
                Number(amounts[lot.id]) >
                  Math.min(
                    Number(lot.availableQuantity),
                    Number(item.remainingQuantity),
                  )
              }
              onClick={() => {
                onAdd(lot, amounts[lot.id]);
                setAmounts({ ...amounts, [lot.id]: "" });
              }}
            >
              Add supply
            </button>
          </div>
        );
      })}
      {data?.items.length === 0 && (
        <p className="text-sm">No stock for this medicine.</p>
      )}
      {data && (
        <Pager info={data.pagination} onPage={setPage} disabled={disabled} />
      )}
    </div>
  );
}
export default function PharmacyPrescriptionWorkspace({ id }: { id: string }) {
  const user = useStaffUser();
  const canDispense = user.permissions?.includes("pharmacy.dispense");
  const [revision, setRevision] = useState(0),
    [allocations, setAllocations] = useState<Allocation[]>([]),
    [openItem, setOpenItem] = useState<string | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [notes, setNotes] = useState(""),
    [message, setMessage] = useState(""),
    [localError, setLocalError] = useState("");
  const records = useLoad<Detail>(`/pharmacy/prescriptions/${id}`, revision);
  const mutation = useSafeMutation<{ receipt: Receipt; replayed: boolean }>(
    `dispense:${id}`,
    (value) => {
      setMessage(`Supply recorded. Receipt ${value.receipt.id}`);
      setAllocations([]);
      setNotes("");
      setConfirmed(false);
      setOpenItem(null);
      setRevision((x) => x + 1);
    },
  );
  const p = records.data?.prescription;
  const locked = mutation.locked || !canDispense || p?.status !== "ISSUED";
  function add(item: Item, lot: Lot, amount: string) {
    if (
      allocations.some(
        (x) => x.prescriptionItemId === item.id && x.stockLotId === lot.id,
      )
    ) {
      setLocalError(
        "That item and lot are already selected. Remove the selected line to change its quantity.",
      );
      return;
    }
    setLocalError("");
    setAllocations([
      ...allocations,
      {
        clientId: crypto.randomUUID(),
        prescriptionItemId: item.id,
        stockLotId: lot.id,
        quantity: amount,
        label: `${item.medicineName} · ${item.strength} · ${lot.batchNumber} · ${amount} ${item.quantityUnit}`,
      },
    ]);
  }
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <PharmacyHeader
        title="Review and dispense"
        description="Verify the patient, review the issued directions and allergies, and record only the quantities physically supplied."
      />
      <Notice error={records.error} loading={records.loading} />
      {message && (
        <p
          role="status"
          className="rounded-xl bg-teal-50 p-3 text-sm text-teal-900"
        >
          {message}
        </p>
      )}
      <Notice error={mutation.error || localError} />
      {mutation.pending && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p>
            An earlier supply result is unconfirmed. Its exact request is
            preserved in this browser tab. Resolve it before recording another
            supply.
          </p>
          <button
            className={`${button} mt-3`}
            disabled={mutation.busy}
            onClick={mutation.retry}
          >
            {mutation.busy ? "Checking…" : "Retry same dispensing"}
          </button>
        </div>
      )}
      {p && (
        <>
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
            <h2 className="text-xl font-bold">
              {p.patientName} · {p.patientMrn}
            </h2>
            <p className="text-sm text-slate-600">
              {p.prescriberName} · {p.prescriberRegistrationNumber} ·{" "}
              {p.prescriberRegistrationAuthority}
            </p>
            <p className="text-sm text-slate-600">
              Issued {dateTime(p.issuedAt)} · {p.status}
            </p>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
              <strong>
                Allergy review: {p.allergyStatus.replaceAll("_", " ")}
              </strong>
              {p.allergyDetails && (
                <p className="whitespace-pre-wrap">{p.allergyDetails}</p>
              )}
            </div>
            {p.instructions && (
              <p className="whitespace-pre-wrap text-sm">{p.instructions}</p>
            )}
            {p.status !== "ISSUED" && (
              <p role="status" className="text-sm font-semibold text-rose-700">
                This prescription is no longer eligible for further dispensing.
                Historical supplies remain visible.
              </p>
            )}
          </section>
          <section className="space-y-4">
            <h2 className="text-lg font-bold">Prescribed medicines</h2>
            {p.items.map((item) => (
              <article
                key={item.id}
                className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"
              >
                <h3 className="font-bold">
                  {item.medicineName} · {item.strength} · {item.dosageForm}
                </h3>
                <p className="text-sm">
                  Dose {item.dose} · {item.route} · {item.frequency} ·{" "}
                  {item.duration}
                </p>
                {item.instructions && (
                  <p className="whitespace-pre-wrap text-sm text-slate-600">
                    {item.instructions}
                  </p>
                )}
                <div className="flex flex-wrap gap-3 text-sm">
                  <span>
                    Prescribed {item.quantity} {item.quantityUnit}
                  </span>
                  <span>Supplied {item.dispensedQuantity}</span>
                  <strong className="text-teal-800">
                    Remaining {item.remainingQuantity}
                  </strong>
                </div>
                {canDispense && Number(item.remainingQuantity) > 0 && (
                  <button
                    className={secondary}
                    disabled={locked}
                    onClick={() =>
                      setOpenItem(openItem === item.id ? null : item.id)
                    }
                  >
                    {openItem === item.id
                      ? "Hide stock lots"
                      : "Choose stock lots"}
                  </button>
                )}
                {openItem === item.id && (
                  <LotPicker
                    item={item}
                    disabled={locked}
                    revision={revision}
                    onAdd={(lot, amount) => add(item, lot, amount)}
                  />
                )}
              </article>
            ))}
          </section>
          {canDispense && (
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
              <h2 className="text-lg font-bold">Selected supply</h2>
              <ul className="space-y-2">
                {allocations.map((a) => (
                  <li
                    key={a.clientId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-sm"
                  >
                    <span>{a.label}</span>
                    <button
                      className={secondary}
                      disabled={locked}
                      onClick={() =>
                        setAllocations(
                          allocations.filter((x) => x.clientId !== a.clientId),
                        )
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              {!allocations.length && (
                <p className="text-sm text-slate-600">
                  Add one or more medicine quantities from the stock lots above.
                </p>
              )}
              <label className="block text-sm font-medium">
                Dispensing note (optional)
                <textarea
                  className={`${input} mt-1`}
                  rows={3}
                  maxLength={1000}
                  disabled={locked}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-teal-700"
                  checked={confirmed}
                  disabled={locked}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>
                  I verified the patient name and MRN, reviewed the prescription
                  and allergies, and checked the selected medicines, batches,
                  expiry dates, units, and quantities.
                </span>
              </label>
              <button
                className={button}
                disabled={
                  locked ||
                  !confirmed ||
                  !allocations.length ||
                  allocations.length > 100
                }
                onClick={() => {
                  setMessage("");
                  mutation.start(`/pharmacy/prescriptions/${id}/dispense`, {
                    expectedPrescriptionVersion: p.version,
                    patientAndPrescriptionConfirmed: confirmed,
                    notes,
                    allocations: allocations.map(
                      ({ prescriptionItemId, stockLotId, quantity }) => ({
                        prescriptionItemId,
                        stockLotId,
                        quantity,
                      }),
                    ),
                  });
                }}
              >
                {mutation.busy
                  ? "Recording supply…"
                  : "Confirm and record dispensing"}
              </button>
              <p className="text-xs text-slate-500">
                Recorded supplies are immutable. Returns, corrections,
                substitutions, and pack conversions require separate workflows.
              </p>
              <button
                className={secondary}
                disabled={mutation.locked}
                onClick={() => {
                  setAllocations([]);
                  setConfirmed(false);
                  setOpenItem(null);
                  setRevision((x) => x + 1);
                }}
              >
                Reload current prescription and stock
              </button>
            </section>
          )}
          <section className="space-y-4">
            <h2 className="text-lg font-bold">Dispensing history</h2>
            {records.data?.history.length === 0 && (
              <p className="text-sm text-slate-600">
                No supplies recorded yet.
              </p>
            )}
            {records.data?.history.map((receipt) => (
              <ReceiptCard key={receipt.id} receipt={receipt} />
            ))}
            <p className="text-xs text-slate-500">
              Showing the latest {records.data?.historyLimitedTo} receipts. Use
              the pharmacy dispensing history for older entries.
            </p>
          </section>
        </>
      )}
    </main>
  );
}
