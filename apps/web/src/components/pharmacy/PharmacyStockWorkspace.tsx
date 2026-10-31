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
  useLoad,
  useSafeMutation,
  dateTime,
} from "./pharmacy-shared";
import type { Lot, Paged } from "./pharmacy-shared";
type Medicine = {
  id: string;
  code: string;
  displayName: string;
  strength: string;
  dosageForm: string;
};
export default function PharmacyStockWorkspace() {
  const user = useStaffUser();
  const canReceive = user.permissions?.includes("pharmacy.stock.receive");
  const [revision, setRevision] = useState(0),
    [page, setPage] = useState(1),
    [filter, setFilter] = useState(""),
    [filterDraft, setFilterDraft] = useState("");
  const [medicineSearch, setMedicineSearch] = useState(""),
    [medicineDraft, setMedicineDraft] = useState(""),
    [medicine, setMedicine] = useState<Medicine | null>(null),
    [message, setMessage] = useState(""),
    [formKey, setFormKey] = useState(0);
  const mutation = useSafeMutation<{ replayed: boolean; stock: Lot }>(
    "receive",
    () => {
      setMessage("Stock receipt recorded.");
      setRevision((x) => x + 1);
      setPage(1);
      setMedicine(null);
      setFormKey((x) => x + 1);
    },
  );
  const records = useLoad<Paged<Lot>>(
    `/pharmacy/stock?search=${encodeURIComponent(filter)}&page=${page}&limit=20`,
    revision,
  );
  const catalogue = useLoad<{ items: Medicine[] }>(
    `/medicines?search=${encodeURIComponent(medicineSearch)}&active=true&page=1&limit=20`,
  );
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <PharmacyHeader
        title="Pharmacy stock"
        description="Receive stock as individual lots with explicit units, batch references, and expiry dates. Balances are calculated from recorded supplies."
      />
      {message && (
        <p
          role="status"
          className="rounded-xl bg-teal-50 p-3 text-sm text-teal-900"
        >
          {message}
        </p>
      )}
      {canReceive && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="text-lg font-bold">Receive medicine stock</h2>
          <Notice error={mutation.error} />
          {mutation.pending && (
            <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
              <p>
                A saved receiving request is awaiting confirmation. Keep the
                same request until it is resolved.
              </p>
              <button
                className={`${button} mt-3`}
                disabled={mutation.busy}
                onClick={mutation.retry}
              >
                {mutation.busy ? "Checking…" : "Retry same receipt"}
              </button>
            </div>
          )}
          <form
            className="flex items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setMedicineSearch(medicineDraft.trim());
            }}
          >
            <label className="flex-1 text-sm font-medium">
              Find medicine by name
              <input
                className={`${input} mt-1`}
                maxLength={100}
                value={medicineDraft}
                disabled={mutation.locked}
                onChange={(e) => setMedicineDraft(e.target.value)}
              />
            </label>
            <button className={secondary} disabled={mutation.locked}>
              Find
            </button>
          </form>
          <Notice error={catalogue.error} loading={catalogue.loading} />
          <p className="text-xs text-slate-500">
            Showing up to 20 matches. Narrow the name search if needed.
          </p>
          <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200">
            {catalogue.data?.items.map((x) => (
              <button
                key={x.id}
                disabled={mutation.locked}
                type="button"
                aria-pressed={medicine?.id === x.id}
                onClick={() => setMedicine(x)}
                className={`block w-full border-b border-slate-100 p-3 text-left text-sm ${medicine?.id === x.id ? "bg-teal-50 text-teal-950" : "hover:bg-slate-50"}`}
              >
                <strong>{x.displayName}</strong> · {x.strength} · {x.dosageForm}
                <span className="ml-2 text-xs text-slate-500">{x.code}</span>
              </button>
            ))}
            {catalogue.data?.items.length === 0 && (
              <p className="p-3 text-sm">No active medicines found.</p>
            )}
          </div>
          <form
            key={formKey}
            onSubmit={(e) => {
              e.preventDefault();
              if (!medicine) return;
              const values = new FormData(e.currentTarget);
              mutation.start("/pharmacy/stock/receive", {
                medicineId: medicine.id,
                batchNumber: String(values.get("batchNumber")),
                expiryDate: String(values.get("expiryDate")),
                receivedQuantity: String(values.get("receivedQuantity")),
                quantityUnit: String(values.get("quantityUnit")),
                supplierName: String(values.get("supplierName")),
                reference: String(values.get("reference")),
              });
            }}
          >
            <fieldset
              disabled={mutation.locked}
              className="grid gap-4 sm:grid-cols-2"
            >
              <legend className="mb-3 text-sm font-semibold">
                {medicine
                  ? `Selected: ${medicine.displayName} · ${medicine.strength} · ${medicine.dosageForm}`
                  : "Select a medicine above"}
              </legend>
              <label className="text-sm font-medium">
                Batch number
                <input
                  className={`${input} mt-1`}
                  name="batchNumber"
                  maxLength={100}
                  required
                />
              </label>
              <label className="text-sm font-medium">
                Expiry date
                <input
                  className={`${input} mt-1`}
                  type="date"
                  name="expiryDate"
                  required
                />
              </label>
              <label className="text-sm font-medium">
                Quantity received
                <input
                  className={`${input} mt-1`}
                  type="number"
                  name="receivedQuantity"
                  min="0.01"
                  max="9999999999.99"
                  step="0.01"
                  required
                />
              </label>
              <label className="text-sm font-medium">
                Stock unit
                <input
                  className={`${input} mt-1`}
                  name="quantityUnit"
                  placeholder="For example: tablet"
                  maxLength={50}
                  required
                />
                <span className="text-xs font-normal text-slate-500">
                  Use the prescribed unit. No pack conversion is performed.
                </span>
              </label>
              <label className="text-sm font-medium">
                Supplier (optional)
                <input
                  className={`${input} mt-1`}
                  name="supplierName"
                  maxLength={200}
                />
              </label>
              <label className="text-sm font-medium">
                Delivery reference (optional)
                <input
                  className={`${input} mt-1`}
                  name="reference"
                  maxLength={100}
                />
              </label>
              <button
                className={`${button} sm:col-span-2`}
                disabled={!medicine}
                type="submit"
              >
                {mutation.busy ? "Recording…" : "Record stock receipt"}
              </button>
            </fieldset>
          </form>
        </section>
      )}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-bold">Stock receipts and balances</h2>
        <form
          className="flex items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setFilter(filterDraft.trim());
            setPage(1);
            setRevision((x) => x + 1);
          }}
        >
          <label className="flex-1 text-sm font-medium">
            Medicine name or batch
            <input
              className={`${input} mt-1`}
              maxLength={100}
              value={filterDraft}
              onChange={(e) => setFilterDraft(e.target.value)}
            />
          </label>
          <button className={secondary}>Search / refresh</button>
        </form>
        <Notice error={records.error} loading={records.loading} />
        {records.data?.items.length === 0 && (
          <p className="py-5 text-sm text-slate-600">
            No stock receipts found.
          </p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {records.data?.items.map((lot) => (
            <article
              key={lot.id}
              className="space-y-2 rounded-xl border border-slate-200 p-4"
            >
              <h3 className="font-bold">
                {lot.medicineName ?? lot.medicine.displayName} ·{" "}
                {lot.strength ?? lot.medicine.strength} ·{" "}
                {lot.dosageForm ?? lot.medicine.dosageForm}
              </h3>
              <p className="text-sm">
                Batch {lot.batchNumber} · Expiry {lot.expiryDate.slice(0, 10)}
              </p>
              <p className="text-sm font-semibold text-teal-800">
                On hand {lot.availableQuantity} {lot.quantityUnit}
              </p>
              <p className="text-xs text-slate-600">
                Received {lot.receivedQuantity} · Dispensed{" "}
                {lot.dispensedQuantity}
              </p>
              {(lot.expired ||
                !lot.medicine.isActive ||
                !lot.verifiedSnapshot) && (
                <p className="text-xs font-semibold text-rose-700">
                  Not eligible for dispensing:{" "}
                  {lot.expired
                    ? "expiry policy"
                    : !lot.medicine.isActive
                      ? "inactive medicine"
                      : "missing receipt snapshots"}
                </p>
              )}
              <p className="text-xs text-slate-500">
                {dateTime(lot.receivedAt)} · {lot.receivedBy.fullName}
              </p>
              {lot.supplierName && (
                <p className="text-xs text-slate-500">
                  {lot.supplierName} · {lot.reference}
                </p>
              )}
            </article>
          ))}
        </div>
        {records.data && (
          <Pager info={records.data.pagination} onPage={setPage} />
        )}
      </section>
    </main>
  );
}
