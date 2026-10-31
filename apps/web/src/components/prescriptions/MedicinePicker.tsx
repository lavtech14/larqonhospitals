"use client";
import { useEffect, useId, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { MedicineSearchClient } from "@/lib/medicine-search-client";
import type { Medicine } from "@/lib/prescription-draft";
export default function MedicinePicker({
  disabled,
  onSelect,
  selectedIds = [],
  label = "Find and add medicine",
}: {
  disabled: boolean;
  onSelect: (medicine: Medicine) => void;
  selectedIds?: string[];
  label?: string;
}) {
  const id = useId(),
    field = useRef<HTMLInputElement>(null),
    results = useRef<HTMLUListElement>(null);
  const client = useRef(
    new MedicineSearchClient(async (term, signal) => {
      const query = new URLSearchParams({ search: term, limit: "12" });
      const response = await apiRequest<{ items: Medicine[] }>(
        `/medicines/search?${query}`,
        { signal },
      );
      return response.items;
    }),
  );
  const [search, setSearch] = useState(""),
    [attempt, setAttempt] = useState(0);
  const term = search.trim(),
    request = `${term}:${attempt}`;
  const [result, setResult] = useState<{
    request: string;
    items: Medicine[];
    error: string;
  } | null>(null);
  useEffect(() => {
    if (disabled || term.length < 2) return;
    const controller = new AbortController();
    client.current
      .search(term, controller.signal, attempt > 0)
      .then((items) => {
        if (!controller.signal.aborted)
          setResult({ request, items, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({
            request,
            items: [],
            error: error instanceof Error ? error.message : "Search failed.",
          });
      });
    return () => controller.abort();
  }, [disabled, term, attempt, request]);
  const visible = result?.request === request ? result : null;
  return (
    <div className="space-y-3">
      <label
        htmlFor={id}
        className="block text-sm font-semibold text-slate-900"
      >
        {label}
      </label>
      <div className="flex gap-2">
        <input
          ref={field}
          id={id}
          type="search"
          autoComplete="off"
          value={search}
          maxLength={100}
          disabled={disabled}
          onChange={(e) => {
            setSearch(e.target.value);
            setResult(null);
            setAttempt(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              results.current
                ?.querySelector<HTMLButtonElement>("button")
                ?.focus();
            }
            if (e.key === "Escape") {
              setSearch("");
              setAttempt(0);
            }
          }}
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm focus:outline-2 focus:outline-teal-700"
          placeholder="Search name, generic name or medicine code"
        />
        <button
          type="button"
          disabled={disabled || term.length < 2}
          onClick={() => setAttempt((x) => x + 1)}
          className="rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-50"
        >
          Refresh results
        </button>
      </div>
      {term.length < 2 && (
        <p className="text-xs text-slate-500">
          Type at least two characters. Select a medicine to add a line; no
          prescribing directions are filled automatically.
        </p>
      )}
      {term.length >= 2 && !visible && !disabled && (
        <p role="status" className="text-xs text-teal-700">
          Finding medicines…
        </p>
      )}
      {visible?.error && (
        <p role="alert" className="text-sm text-rose-700">
          {visible.error} Use Refresh results to retry.
        </p>
      )}
      {visible && !visible.error && term.length >= 2 && (
        <ul
          ref={results}
          aria-label="Medicine search results"
          className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white"
        >
          {!visible.items.length && (
            <li className="p-4 text-sm text-slate-600">
              No active medicines found. Try another name or ask the
              administrator to check the catalogue.
            </li>
          )}
          {visible.items.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onSelect(m);
                  setSearch("");
                  setAttempt(0);
                  field.current?.focus();
                }}
                className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-teal-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-700 disabled:opacity-50"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-950">
                    {m.displayName}
                  </span>
                  <span className="mt-1 block text-xs text-slate-600">
                    {m.strength} · {m.dosageForm}
                    {m.code ? ` · ${m.code}` : ""}
                  </span>
                  {m.genericName && (
                    <span className="mt-1 block text-xs text-slate-500">
                      {m.genericName}
                    </span>
                  )}
                </span>
                <span className="shrink-0 rounded-lg bg-teal-50 px-2.5 py-2 text-xs font-bold text-teal-800">
                  {selectedIds.includes(m.id) ? "Add another line" : "+ Add"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {visible && visible.items.length === 12 && (
        <p className="text-xs text-slate-500">
          Showing the first 12 matches. Refine the name to find a specific
          medicine.
        </p>
      )}
    </div>
  );
}
