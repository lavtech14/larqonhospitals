"use client";
import { useId } from "react";
import type { LabParameter } from "@/lib/lab-result-types";
const input =
  "mt-1 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal";
export default function LabParameterEditor({
  values,
  onChange,
  disabled,
}: {
  values: LabParameter[];
  onChange: (values: LabParameter[]) => void;
  disabled: boolean;
}) {
  const id = useId();
  function update(index: number, patch: Partial<LabParameter>) {
    if (!disabled)
      onChange(
        values.map((entry, i) =>
          i === index ? { ...entry, ...patch } : entry,
        ),
      );
  }
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 p-4">
      <h3 className="font-semibold">Result parameters</h3>
      <p className="text-sm leading-6 text-slate-600">
        Leave empty for a narrative report. Configure each measurement using
        laboratory-approved names, units, and reference text. Include
        applicability in the reference text; ranges are not adjusted
        automatically for age or sex.
      </p>
      {values.map((entry, index) => (
        <article key={`${id}-${index}`} className="rounded-xl bg-slate-50 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Parameter code
              <input
                className={input}
                required
                maxLength={40}
                pattern="[A-Za-z0-9_-]+"
                value={entry.code}
                onChange={(e) => update(index, { code: e.target.value })}
              />
            </label>
            <label className="text-sm font-semibold">
              Parameter name
              <input
                className={input}
                required
                maxLength={100}
                value={entry.name}
                onChange={(e) => update(index, { name: e.target.value })}
              />
            </label>
            <label className="text-sm font-semibold">
              Value type
              <select
                className={input}
                value={entry.kind}
                onChange={(e) =>
                  update(index, {
                    kind: e.target.value as LabParameter["kind"],
                  })
                }
              >
                <option value="NUMERIC">Numeric</option>
                <option value="TEXT">Text</option>
              </select>
            </label>
            <label className="text-sm font-semibold">
              Unit
              <input
                className={input}
                maxLength={50}
                value={entry.unit}
                onChange={(e) => update(index, { unit: e.target.value })}
              />
            </label>
            <label className="text-sm font-semibold sm:col-span-2">
              Reference text and applicability
              <textarea
                rows={2}
                className={input}
                maxLength={500}
                value={entry.referenceText}
                onChange={(e) =>
                  update(index, { referenceText: e.target.value })
                }
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap justify-between gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={entry.required}
                onChange={(e) => update(index, { required: e.target.checked })}
              />
              Value required before saving
            </label>
            <button
              type="button"
              disabled={disabled}
              className="min-h-11 text-sm font-semibold text-red-700"
              onClick={() => onChange(values.filter((_, i) => i !== index))}
            >
              Remove parameter
            </button>
          </div>
        </article>
      ))}
      <button
        type="button"
        disabled={disabled || values.length >= 50}
        className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold disabled:opacity-50"
        onClick={() =>
          onChange([
            ...values,
            {
              code: "",
              name: "",
              kind: "NUMERIC",
              unit: "",
              referenceText: "",
              required: true,
            },
          ])
        }
      >
        + Add parameter
      </button>
    </section>
  );
}
