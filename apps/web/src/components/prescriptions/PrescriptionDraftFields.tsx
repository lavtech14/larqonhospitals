"use client";
import { useState } from "react";
import type { FormEvent } from "react";
import { allergyOptions, emptyRow } from "@/lib/prescription-draft";
import type { AllergyStatus, Draft, DraftRow } from "@/lib/prescription-draft";
import MedicinePicker from "./MedicinePicker";
const input =
  "mt-1.5 block min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950 focus:outline-2 focus:outline-teal-700 disabled:bg-slate-50";
const secondary =
  "min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";
type Props = {
  draft: Draft;
  frozen: boolean;
  isDirty: boolean;
  sending: boolean;
  needsReview: boolean;
  onChange: (update: (current: Draft) => Draft) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
};
export default function PrescriptionDraftFields({
  draft,
  frozen,
  isDirty,
  sending,
  needsReview,
  onChange,
  onSave,
}: Props) {
  const [replacing, setReplacing] = useState<string | null>(null);
  const replaceRow = draft.rows.find((row) => row.clientId === replacing);
  function updateRow(id: string, patch: Partial<DraftRow>) {
    onChange((current) => ({
      ...current,
      rows: current.rows.map((row) =>
        row.clientId === id ? { ...row, ...patch } : row,
      ),
    }));
  }
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
      <form
        id="prescription-draft-form"
        onSubmit={onSave}
        className="min-w-0 space-y-4"
      >
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-teal-700">
                1 · Medicines
              </p>
              <h2 className="mt-1 text-lg font-bold text-slate-950">
                Build the prescription
              </h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {draft.rows.length} / 50 lines
            </span>
          </div>
          {replaceRow && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-950">
              <span>
                Replacing{" "}
                {replaceRow.medicine?.displayName ?? "the selected line"}.
                Review its directions after selecting.
              </span>
              <button
                type="button"
                disabled={frozen}
                className="font-bold underline"
                onClick={() => setReplacing(null)}
              >
                Cancel replacement
              </button>
            </div>
          )}
          <MedicinePicker
            disabled={frozen || (!replacing && draft.rows.length >= 50)}
            label={
              replaceRow
                ? "Choose replacement medicine"
                : "Find and add medicine"
            }
            selectedIds={draft.rows.flatMap((row) =>
              row.medicine ? [row.medicine.id] : [],
            )}
            onSelect={(medicine) => {
              if (replaceRow) {
                updateRow(replaceRow.clientId, {
                  medicine,
                  needsReselection: false,
                });
                setReplacing(null);
              } else {
                const row = { ...emptyRow(), medicine };
                onChange((current) => ({
                  ...current,
                  rows: [...current.rows, row],
                }));
              }
            }}
          />
        </section>
        <fieldset disabled={frozen} className="min-w-0 space-y-3 border-0 p-0">
          <legend className="sr-only">Medicine directions</legend>
          {!draft.rows.length && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <span className="mx-auto grid size-11 place-items-center rounded-xl bg-teal-100 text-xl font-semibold text-teal-800">
                Rx
              </span>
              <h3 className="mt-3 text-sm font-bold text-slate-900">
                Start with a medicine
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-6 text-slate-600">
                Use the catalogue search above. Each selected medicine becomes a
                compact line for its prescribing directions.
              </p>
            </div>
          )}
          {draft.rows.map((row, index) => (
            <article
              key={row.clientId}
              className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
            >
              <div className="mb-4 flex flex-wrap items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-teal-50 text-xs font-bold text-teal-800">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1 basis-36">
                  <h3 className="text-sm font-bold text-slate-950">
                    {row.medicine?.displayName ?? "Select a medicine"}
                  </h3>
                  {row.medicine && (
                    <p className="mt-1 text-xs text-slate-600">
                      {row.medicine.strength} · {row.medicine.dosageForm}
                      {row.medicine.genericName
                        ? ` · ${row.medicine.genericName}`
                        : ""}
                    </p>
                  )}
                </div>
                <div className="ml-auto flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    className="text-xs font-semibold text-teal-800 underline underline-offset-4"
                    onClick={() => {
                      setReplacing(row.clientId);
                      document
                        .getElementById("prescription-draft-form")
                        ?.scrollIntoView({ behavior: "auto", block: "start" });
                    }}
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    className="min-h-8 px-1 text-xs font-semibold text-rose-700"
                    aria-label={`Remove medicine ${index + 1}`}
                    onClick={() => {
                      onChange((current) => ({
                        ...current,
                        rows: current.rows.filter(
                          (item) => item.clientId !== row.clientId,
                        ),
                      }));
                      if (replacing === row.clientId) setReplacing(null);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
              {row.needsReselection && (
                <p
                  role="alert"
                  className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-950"
                >
                  This catalogue entry changed or is inactive. Use Change to
                  review and reselect an active medicine.
                </p>
              )}
              <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {(
                  [
                    ["dose", "Dose", 200],
                    ["route", "Route", 100],
                    ["frequency", "Frequency", 200],
                    ["duration", "Duration", 200],
                  ] as const
                ).map(([key, label, max]) => (
                  <label
                    key={key}
                    className="text-xs font-semibold text-slate-700"
                  >
                    {label}
                    <input
                      className={input}
                      required
                      maxLength={max}
                      value={row[key]}
                      autoComplete="off"
                      onChange={(e) =>
                        updateRow(row.clientId, { [key]: e.target.value })
                      }
                    />
                  </label>
                ))}
                <label className="text-xs font-semibold text-slate-700">
                  Quantity
                  <input
                    className={input}
                    type="number"
                    required
                    min="0.01"
                    max="99999999.99"
                    step="0.01"
                    value={row.quantity}
                    onChange={(e) =>
                      updateRow(row.clientId, { quantity: e.target.value })
                    }
                  />
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  Quantity unit
                  <input
                    className={input}
                    required
                    maxLength={50}
                    value={row.quantityUnit}
                    autoComplete="off"
                    onChange={(e) =>
                      updateRow(row.clientId, { quantityUnit: e.target.value })
                    }
                  />
                </label>
              </div>
              <details className="mt-4 border-t border-slate-100 pt-3">
                <summary className="cursor-pointer text-xs font-semibold text-slate-600">
                  {row.instructions
                    ? "Edit additional medicine directions"
                    : "Add medicine directions (optional)"}
                </summary>
                <label className="mt-3 block text-xs font-semibold text-slate-700">
                  Additional medicine directions
                  <textarea
                    className={input}
                    rows={2}
                    maxLength={1000}
                    value={row.instructions}
                    onChange={(e) =>
                      updateRow(row.clientId, { instructions: e.target.value })
                    }
                  />
                </label>
              </details>
            </article>
          ))}
        </fieldset>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <label className="block text-sm font-semibold text-slate-900">
            General prescription instructions{" "}
            <span className="text-xs font-normal text-slate-500">
              · optional
            </span>
            <textarea
              disabled={frozen}
              className={input}
              rows={2}
              maxLength={2000}
              value={draft.instructions}
              onChange={(e) =>
                onChange((current) => ({
                  ...current,
                  instructions: e.target.value,
                }))
              }
            />
          </label>
        </section>
        <div className="sticky bottom-4 z-10 flex flex-nowrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-800" role="status">
              {sending
                ? "Saving your draft…"
                : isDirty
                  ? "Unsaved changes"
                  : "Draft saved"}
            </p>
            <p className="mt-1 hidden text-[11px] text-slate-500 sm:block">
              Save before reviewing and issuing. Ctrl / ⌘ + S
            </p>
          </div>
          <button
            type="submit"
            disabled={frozen || !isDirty || needsReview}
            className="min-h-11 shrink-0 rounded-xl bg-teal-800 px-5 text-sm font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? "Saving…" : "Save draft"}
          </button>
        </div>
      </form>
      <aside className="space-y-4 xl:sticky xl:top-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-teal-700">
            2 · Safety review
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-950">Allergies</h2>
          <fieldset
            disabled={frozen}
            className="mt-4 min-w-0 space-y-4 border-0 p-0"
          >
            <legend className="sr-only">Allergy review</legend>
            <label className="block text-xs font-semibold text-slate-700">
              Allergy review status
              <select
                form="prescription-draft-form"
                className={input}
                value={draft.allergyStatus}
                onChange={(e) =>
                  onChange((current) => ({
                    ...current,
                    allergyStatus: e.target.value as AllergyStatus,
                  }))
                }
              >
                {allergyOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Allergy review notes
              <textarea
                form="prescription-draft-form"
                className={input}
                rows={3}
                maxLength={2000}
                value={draft.allergyDetails}
                onChange={(e) =>
                  onChange((current) => ({
                    ...current,
                    allergyDetails: e.target.value,
                  }))
                }
              />
            </label>
          </fieldset>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Complete the review before issuing. Reported allergies and an
            unknown status require notes.
          </p>
        </section>
        <section className="rounded-2xl border border-teal-100 bg-teal-50/60 p-4 text-xs leading-6 text-slate-600">
          <p className="font-bold text-teal-900">3 · Review and issue</p>
          <p className="mt-1">
            Save the draft, open its preview below, then confirm issuance. No
            dose, route, frequency, duration, or quantity is chosen
            automatically.
          </p>
        </section>
      </aside>
    </div>
  );
}
