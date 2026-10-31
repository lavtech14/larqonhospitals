"use client";
import { useState } from "react";
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
} from "./billing-shared";
import type { Kind, Paged, Price } from "./billing-shared";
type Entity = {
  id: string;
  displayName: string;
  code?: string;
  strength?: string;
  dosageForm?: string;
};
export default function BillingPricesWorkspace() {
  const [kind, setKind] = useState<Kind>("CONSULTATION"),
    [search, setSearch] = useState(""),
    [draft, setDraft] = useState(""),
    [cataloguePage, setCataloguePage] = useState(1),
    [pricePage, setPricePage] = useState(1),
    [entity, setEntity] = useState<Entity | null>(null),
    [editing, setEditing] = useState<Price | null>(null),
    [unit, setUnit] = useState("consultation"),
    [amount, setAmount] = useState(""),
    [active, setActive] = useState(true),
    [revision, setRevision] = useState(0),
    [message, setMessage] = useState("");
  const mutation = useSafeMutation<{ priceId: string }>("prices", () => {
    setMessage("Price saved. Existing invoice prices remain unchanged.");
    setRevision((x) => x + 1);
    setEntity(null);
    setEditing(null);
    setAmount("");
  });
  const catalogue = useLoad<Paged<Entity>>(
    `/billing/catalogue?kind=${kind}&search=${encodeURIComponent(search)}&page=${cataloguePage}&limit=10`,
  );
  const prices = useLoad<Paged<Price>>(
    `/billing/prices?kind=${kind}&page=${pricePage}&limit=20`,
    revision,
  );
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <BillingHeader
        title="Service prices"
        description="Set consultation fees, test prices, and medicine prices per exact dispensing unit. Amounts are INR; no tax or conversion is added."
      />
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
        <button
          className={button}
          disabled={mutation.busy}
          onClick={mutation.retry}
        >
          Retry same price save
        </button>
      )}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap gap-2">
          {kinds.map((k) => (
            <button
              className={kind === k ? button : secondary}
              disabled={mutation.locked}
              key={k}
              onClick={() => {
                setKind(k);
                setEntity(null);
                setEditing(null);
                setAmount("");
                setActive(true);
                setUnit(
                  k === "LAB"
                    ? "test"
                    : k === "CONSULTATION"
                      ? "consultation"
                      : "",
                );
                setCataloguePage(1);
                setPricePage(1);
              }}
            >
              {k === "CONSULTATION"
                ? "Consultations"
                : k === "LAB"
                  ? "Lab tests"
                  : "Medicines"}
            </button>
          ))}
        </div>
        <form
          className="flex items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(draft.trim());
            setCataloguePage(1);
          }}
        >
          <label className="flex-1 text-sm font-medium">
            Find catalogue entry
            <input
              className={`${input} mt-1`}
              disabled={mutation.locked || !!editing}
              value={draft}
              maxLength={100}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <button className={secondary} disabled={mutation.locked || !!editing}>
            Find
          </button>
        </form>
        <Notice error={catalogue.error} loading={catalogue.loading} />
        {!editing && (
          <div className="grid gap-2">
            {catalogue.data?.items.map((e) => (
              <button
                className={`rounded-xl border p-3 text-left text-sm ${entity?.id === e.id ? "border-teal-600 bg-teal-50" : "border-slate-200"}`}
                disabled={mutation.locked}
                key={e.id}
                onClick={() => setEntity(e)}
              >
                {e.displayName} {e.strength} {e.dosageForm}{" "}
                {e.code && `· ${e.code}`}
              </button>
            ))}
            {catalogue.data && (
              <Pager
                info={catalogue.data.pagination}
                onPage={setCataloguePage}
                disabled={mutation.locked}
              />
            )}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const entityId = editing
              ? (editing.doctorId ?? editing.labTestId ?? editing.medicineId)
              : entity?.id;
            if (!entityId) return;
            mutation.start(
              editing
                ? `/billing/prices/${editing.id}/update`
                : "/billing/prices",
              {
                kind,
                entityId,
                quantityUnit: unit,
                unitPrice: amount,
                isActive: active,
                ...(editing ? { expectedVersion: editing.version } : {}),
              },
            );
          }}
        >
          <fieldset
            disabled={mutation.locked}
            className="grid gap-4 sm:grid-cols-2"
          >
            <legend className="mb-3 text-sm font-bold">
              {editing
                ? `Editing: ${editing.displayName}`
                : entity
                  ? `New price: ${entity.displayName}`
                  : "Choose an entry above"}
            </legend>
            <label className="text-sm font-medium">
              Price per unit (INR)
              <input
                className={`${input} mt-1`}
                type="number"
                min="0"
                step="0.01"
                max="9999999999.99"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label className="text-sm font-medium">
              Quantity unit
              <input
                className={`${input} mt-1`}
                value={unit}
                required
                maxLength={50}
                readOnly={kind !== "MEDICINE" || !!editing}
                onChange={(e) => setUnit(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Active price
            </label>
            <div className="flex flex-wrap gap-3">
              <button className={button} disabled={!entity && !editing}>
                Save price
              </button>
              <button
                className={secondary}
                type="button"
                onClick={() => {
                  setEditing(null);
                  setEntity(null);
                  setAmount("");
                  setActive(true);
                }}
              >
                Clear selection
              </button>
            </div>
          </fieldset>
        </form>
      </section>
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Configured prices</h2>
          <button
            className={secondary}
            disabled={mutation.locked}
            onClick={() => {
              setEditing(null);
              setEntity(null);
              setAmount("");
              setRevision((x) => x + 1);
            }}
          >
            Refresh prices
          </button>
        </div>
        <Notice error={prices.error} loading={prices.loading} />
        {prices.data?.items.length === 0 && (
          <p className="text-sm text-slate-600">
            No prices configured for this category.
          </p>
        )}
        {prices.data?.items.map((p) => (
          <article
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
          >
            <div>
              <strong>{p.displayName}</strong>
              <p className="text-sm">
                {inr(p.unitPrice)} / {p.quantityUnit} ·{" "}
                {p.isActive ? "Active" : "Inactive"} · Version {p.version}
              </p>
            </div>
            <button
              className={secondary}
              disabled={mutation.locked}
              onClick={() => {
                setEditing(p);
                setEntity(null);
                setUnit(p.quantityUnit);
                setAmount(p.unitPrice);
                setActive(p.isActive);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Edit
            </button>
          </article>
        ))}
        {prices.data && (
          <Pager
            info={prices.data.pagination}
            onPage={setPricePage}
            disabled={mutation.locked}
          />
        )}
      </section>
    </main>
  );
}
