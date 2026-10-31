"use client";
import type {
  LabParameter,
  ResultInput,
  ResultValue,
  ResultFlag,
} from "@/lib/lab-result-types";
import { resultFlags } from "@/lib/lab-result-types";
const label = (value: string) => value.toLowerCase().replaceAll("_", " ");
export function StructuredResultFields({
  parameters,
  values,
  onChange,
  disabled,
}: {
  parameters: LabParameter[];
  values: ResultInput[];
  onChange: (values: ResultInput[]) => void;
  disabled: boolean;
}) {
  function update(code: string, patch: Partial<ResultInput>) {
    if (disabled) return;
    onChange(
      parameters.map((parameter) => {
        const current = values.find(
          (value) => value.code === parameter.code,
        ) ?? {
          code: parameter.code,
          value: "",
          flag: "NOT_FLAGGED" as ResultFlag,
        };
        return code === parameter.code ? { ...current, ...patch } : current;
      }),
    );
  }
  if (!parameters.length) return null;
  return (
    <section className="space-y-4">
      <h3 className="font-semibold">Structured measurements</h3>
      <p className="text-sm text-slate-500">
        Definitions are fixed from the order. Flags are entered by lab staff and
        checked by the reviewer; they are not automatically calculated.
      </p>
      {parameters.map((parameter) => {
        const entry = values.find((value) => value.code === parameter.code);
        return (
          <div
            key={parameter.code}
            className="rounded-xl border border-slate-200 p-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                {parameter.name}
                {parameter.required ? " *" : " · optional"}
                {parameter.unit ? ` (${parameter.unit})` : ""}
                <input
                  type="text"
                  inputMode={parameter.kind === "NUMERIC" ? "decimal" : "text"}
                  required={parameter.required}
                  maxLength={1000}
                  value={entry?.value ?? ""}
                  disabled={disabled}
                  className="mt-2 block min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal"
                  onChange={(e) =>
                    update(parameter.code, {
                      value: e.target.value,
                      ...(e.target.value.trim()
                        ? {}
                        : { flag: "NOT_FLAGGED" as ResultFlag }),
                    })
                  }
                />
              </label>
              <label className="text-sm font-semibold">
                Flag
                <select
                  disabled={disabled || !entry?.value.trim()}
                  value={entry?.flag ?? "NOT_FLAGGED"}
                  onChange={(e) =>
                    update(parameter.code, {
                      flag: e.target.value as ResultFlag,
                    })
                  }
                  className="mt-2 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal"
                >
                  {resultFlags.map((flag) => (
                    <option key={flag} value={flag}>
                      {label(flag)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {parameter.referenceText && (
              <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-slate-600">
                Reference: {parameter.referenceText}
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}
export function StructuredResultTable({ values }: { values: ResultValue[] }) {
  if (!values?.length) return null;
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">Structured laboratory results</caption>
        <thead>
          <tr>
            {["Parameter", "Result", "Unit", "Reference", "Flag"].map(
              (title) => (
                <th
                  scope="col"
                  key={title}
                  className="border border-slate-300 bg-slate-50 p-2 font-semibold"
                >
                  {title}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {values.map((value) => (
            <tr key={value.code} className="lab-result-row">
              <th
                scope="row"
                className="border border-slate-300 p-2 font-medium"
              >
                {value.name}
              </th>
              <td className="whitespace-pre-wrap break-words border border-slate-300 p-2">
                {value.value || "Not recorded"}
              </td>
              <td className="border border-slate-300 p-2">
                {value.unit || "—"}
              </td>
              <td className="whitespace-pre-wrap border border-slate-300 p-2 text-xs">
                {value.referenceText || "Not specified"}
              </td>
              <td className="border border-slate-300 p-2">
                {label(value.flag)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
