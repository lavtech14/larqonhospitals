"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, apiRequest } from "@/lib/api";
import { useStaffUser } from "@/components/auth/StaffSessionGate";

type TimeRange = {
  startMinute: number;
  endMinute: number;
};

type WorkingWindow = TimeRange & {
  dayOfWeek: number;
  slotMinutes: number;
  breaks: TimeRange[];
};

type Availability = {
  doctorId: string;
  timeZone: string;
  version: number;
  windows: WorkingWindow[];
};

type DraftBreak = {
  key: string;
  start: string;
  end: string;
};

type DraftWindow = {
  key: string;
  day: string;
  start: string;
  end: string;
  slot: string;
  breaks: DraftBreak[];
};

const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatTime(minutes: number): string {
  return `${Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
}

function parseTime(value: string, allowMidnightEnd = false): number {
  if (allowMidnightEnd && value === "24:00") return 1440;

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new Error(
      "Enter times as HH:mm, for example 09:00 or 17:30. End times may also be 24:00.",
    );
  }

  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function makeDraft(availability: Availability): DraftWindow[] {
  return availability.windows.map((window, index) => ({
    key: `window-${index}`,
    day: String(window.dayOfWeek),
    start: formatTime(window.startMinute),
    end: formatTime(window.endMinute),
    slot: String(window.slotMinutes),
    breaks: window.breaks.map((pause, breakIndex) => ({
      key: `break-${index}-${breakIndex}`,
      start: formatTime(pause.startMinute),
      end: formatTime(pause.endMinute),
    })),
  }));
}

export default function AvailabilityWorkspace({
  doctorId,
}: {
  doctorId: string;
}) {
  const user = useStaffUser();
  const canRead = user.permissions?.includes("availability.read") ?? false;
  const canManage = user.permissions?.includes("availability.manage") ?? false;

  const [loaded, setLoaded] = useState<Availability | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!canRead) return;

    let active = true;
    const controller = new AbortController();

    async function load() {
      try {
        const result = await apiRequest<{ availability: Availability }>(
          `/doctors/${doctorId}/availability`,
          { signal: controller.signal },
        );

        if (active) {
          setLoaded(result.availability);
          setError("");
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load availability.",
          );
        }
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [doctorId, canRead, reload]);

  function reloadLatest() {
    setLoaded(null);
    setError("");
    setReload((value) => value + 1);
  }

  if (!canRead) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          Access unavailable
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Your account cannot view doctor availability.
        </p>
      </section>
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      <Link
        className="inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-teal-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        href="/doctors"
      >
        Back to doctors
      </Link>

      <section className="mt-5 mb-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="mb-2 text-[10px] font-bold tracking-[0.16em] text-teal-800">
            DOCTOR SCHEDULING
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Weekly availability
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Hospital timezone: Asia/Kolkata. Use 24-hour times such as 09:00 and
            17:30.
          </p>
        </div>
      </section>

      {!loaded ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          {error ? (
            <>
              <p
                className="my-4 text-sm leading-6 text-red-700 empty:hidden"
                role="alert"
              >
                {error}
              </p>
              <button
                className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                onClick={reloadLatest}
              >
                Try again
              </button>
            </>
          ) : (
            <p role="status">Loading availability...</p>
          )}
        </section>
      ) : (
        <AvailabilityEditor
          initial={loaded}
          canManage={canManage}
          reloadLatest={reloadLatest}
        />
      )}
    </div>
  );
}

function AvailabilityEditor({
  initial,
  canManage,
  reloadLatest,
}: {
  initial: Availability;
  canManage: boolean;
  reloadLatest: () => void;
}) {
  const [windows, setWindows] = useState(() => makeDraft(initial));
  const [version, setVersion] = useState(initial.version);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);

  function changeWindow(key: string, changes: Partial<DraftWindow>) {
    setWindows((current) =>
      current.map((window) =>
        window.key === key ? { ...window, ...changes } : window,
      ),
    );
    setMessage("");
  }

  function changeBreak(
    windowKey: string,
    breakKey: string,
    changes: Partial<DraftBreak>,
  ) {
    setWindows((current) =>
      current.map((window) =>
        window.key !== windowKey
          ? window
          : {
              ...window,
              breaks: window.breaks.map((pause) =>
                pause.key === breakKey ? { ...pause, ...changes } : pause,
              ),
            },
      ),
    );
    setMessage("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage || saving || conflict) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        expectedVersion: version,
        windows: windows.map((window) => ({
          dayOfWeek: Number(window.day),
          startMinute: parseTime(window.start),
          endMinute: parseTime(window.end, true),
          slotMinutes: Number(window.slot),
          breaks: window.breaks.map((pause) => ({
            startMinute: parseTime(pause.start),
            endMinute: parseTime(pause.end, true),
          })),
        })),
      };

      const result = await apiRequest<{ availability: Availability }>(
        `/doctors/${initial.doctorId}/availability`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
      );

      setVersion(result.availability.version);
      setMessage("Weekly availability saved successfully.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save availability.",
      );

      if (caught instanceof ApiError && caught.status === 409) {
        setConflict(true);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight text-slate-950">
        Working windows and breaks
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Add separate windows for split shifts. Saving replaces the complete
        weekly template. An empty template means no recurring availability.
      </p>

      <p
        className="my-4 text-sm leading-6 text-teal-800 empty:hidden"
        role="status"
      >
        {message}
      </p>

      <form onSubmit={save} aria-busy={saving}>
        <fieldset
          className="m-0 min-w-0 border-0 p-0 disabled:opacity-70"
          disabled={saving || !canManage}
        >
          <legend className="sr-only">Weekly availability settings</legend>

          {windows.length === 0 && (
            <p className="px-5 py-12 text-center text-sm text-slate-500">
              No working windows configured.
            </p>
          )}

          {windows.map((window, index) => (
            <section
              className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5 [&>h3]:mb-5"
              key={window.key}
            >
              <h3 className="text-sm font-semibold text-slate-900">
                Working window {index + 1}
              </h3>

              <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="block min-w-0 text-xs font-semibold text-slate-600 [&>label]:block [&>span]:block [&>input]:mt-2 [&>input]:block [&>input]:min-h-12 [&>input]:w-full [&>input]:min-w-0 [&>input]:rounded-xl [&>input]:border [&>input]:border-slate-300 [&>input]:bg-white [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:font-normal [&>input]:text-slate-900 [&>input:disabled]:bg-slate-50 [&>select]:mt-2 [&>select]:block [&>select]:min-h-12 [&>select]:w-full [&>select]:min-w-0 [&>select]:rounded-xl [&>select]:border [&>select]:border-slate-300 [&>select]:bg-white [&>select]:px-3 [&>select]:py-2 [&>select]:text-sm [&>select]:font-normal [&>select]:text-slate-900 [&>select:disabled]:bg-slate-50 [&>input:focus-visible]:outline-2 [&>input:focus-visible]:outline-offset-2 [&>input:focus-visible]:outline-teal-700 [&>select:focus-visible]:outline-2 [&>select:focus-visible]:outline-offset-2 [&>select:focus-visible]:outline-teal-700">
                  <label htmlFor={`${window.key}-day`}>Day</label>
                  <select
                    id={`${window.key}-day`}
                    value={window.day}
                    onChange={(event) =>
                      changeWindow(window.key, { day: event.target.value })
                    }
                  >
                    {days.map((day, dayIndex) => (
                      <option key={day} value={dayIndex}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="block min-w-0 text-xs font-semibold text-slate-600 [&>label]:block [&>span]:block [&>input]:mt-2 [&>input]:block [&>input]:min-h-12 [&>input]:w-full [&>input]:min-w-0 [&>input]:rounded-xl [&>input]:border [&>input]:border-slate-300 [&>input]:bg-white [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:font-normal [&>input]:text-slate-900 [&>input:disabled]:bg-slate-50 [&>select]:mt-2 [&>select]:block [&>select]:min-h-12 [&>select]:w-full [&>select]:min-w-0 [&>select]:rounded-xl [&>select]:border [&>select]:border-slate-300 [&>select]:bg-white [&>select]:px-3 [&>select]:py-2 [&>select]:text-sm [&>select]:font-normal [&>select]:text-slate-900 [&>select:disabled]:bg-slate-50 [&>input:focus-visible]:outline-2 [&>input:focus-visible]:outline-offset-2 [&>input:focus-visible]:outline-teal-700 [&>select:focus-visible]:outline-2 [&>select:focus-visible]:outline-offset-2 [&>select:focus-visible]:outline-teal-700">
                  <label htmlFor={`${window.key}-start`}>Start (HH:mm)</label>
                  <input
                    id={`${window.key}-start`}
                    value={window.start}
                    required
                    maxLength={5}
                    placeholder="09:00"
                    onChange={(event) =>
                      changeWindow(window.key, { start: event.target.value })
                    }
                  />
                </div>

                <div className="block min-w-0 text-xs font-semibold text-slate-600 [&>label]:block [&>span]:block [&>input]:mt-2 [&>input]:block [&>input]:min-h-12 [&>input]:w-full [&>input]:min-w-0 [&>input]:rounded-xl [&>input]:border [&>input]:border-slate-300 [&>input]:bg-white [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:font-normal [&>input]:text-slate-900 [&>input:disabled]:bg-slate-50 [&>select]:mt-2 [&>select]:block [&>select]:min-h-12 [&>select]:w-full [&>select]:min-w-0 [&>select]:rounded-xl [&>select]:border [&>select]:border-slate-300 [&>select]:bg-white [&>select]:px-3 [&>select]:py-2 [&>select]:text-sm [&>select]:font-normal [&>select]:text-slate-900 [&>select:disabled]:bg-slate-50 [&>input:focus-visible]:outline-2 [&>input:focus-visible]:outline-offset-2 [&>input:focus-visible]:outline-teal-700 [&>select:focus-visible]:outline-2 [&>select:focus-visible]:outline-offset-2 [&>select:focus-visible]:outline-teal-700">
                  <label htmlFor={`${window.key}-end`}>End (HH:mm)</label>
                  <input
                    id={`${window.key}-end`}
                    value={window.end}
                    required
                    maxLength={5}
                    placeholder="13:00"
                    onChange={(event) =>
                      changeWindow(window.key, { end: event.target.value })
                    }
                  />
                </div>

                <div className="block min-w-0 text-xs font-semibold text-slate-600 [&>label]:block [&>span]:block [&>input]:mt-2 [&>input]:block [&>input]:min-h-12 [&>input]:w-full [&>input]:min-w-0 [&>input]:rounded-xl [&>input]:border [&>input]:border-slate-300 [&>input]:bg-white [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:font-normal [&>input]:text-slate-900 [&>input:disabled]:bg-slate-50 [&>select]:mt-2 [&>select]:block [&>select]:min-h-12 [&>select]:w-full [&>select]:min-w-0 [&>select]:rounded-xl [&>select]:border [&>select]:border-slate-300 [&>select]:bg-white [&>select]:px-3 [&>select]:py-2 [&>select]:text-sm [&>select]:font-normal [&>select]:text-slate-900 [&>select:disabled]:bg-slate-50 [&>input:focus-visible]:outline-2 [&>input:focus-visible]:outline-offset-2 [&>input:focus-visible]:outline-teal-700 [&>select:focus-visible]:outline-2 [&>select:focus-visible]:outline-offset-2 [&>select:focus-visible]:outline-teal-700">
                  <label htmlFor={`${window.key}-slot`}>Slot minutes</label>
                  <input
                    id={`${window.key}-slot`}
                    type="number"
                    min={5}
                    max={120}
                    step={1}
                    required
                    value={window.slot}
                    onChange={(event) =>
                      changeWindow(window.key, { slot: event.target.value })
                    }
                  />
                </div>
              </div>

              {window.breaks.map((pause, breakIndex) => (
                <div
                  className="mt-5 grid min-w-0 items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                  key={pause.key}
                >
                  <div className="block min-w-0 text-xs font-semibold text-slate-600 [&>label]:block [&>span]:block [&>input]:mt-2 [&>input]:block [&>input]:min-h-12 [&>input]:w-full [&>input]:min-w-0 [&>input]:rounded-xl [&>input]:border [&>input]:border-slate-300 [&>input]:bg-white [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:font-normal [&>input]:text-slate-900 [&>input:disabled]:bg-slate-50 [&>select]:mt-2 [&>select]:block [&>select]:min-h-12 [&>select]:w-full [&>select]:min-w-0 [&>select]:rounded-xl [&>select]:border [&>select]:border-slate-300 [&>select]:bg-white [&>select]:px-3 [&>select]:py-2 [&>select]:text-sm [&>select]:font-normal [&>select]:text-slate-900 [&>select:disabled]:bg-slate-50 [&>input:focus-visible]:outline-2 [&>input:focus-visible]:outline-offset-2 [&>input:focus-visible]:outline-teal-700 [&>select:focus-visible]:outline-2 [&>select:focus-visible]:outline-offset-2 [&>select:focus-visible]:outline-teal-700">
                    <label htmlFor={`${pause.key}-start`}>
                      Break {breakIndex + 1} start
                    </label>
                    <input
                      id={`${pause.key}-start`}
                      value={pause.start}
                      required
                      maxLength={5}
                      placeholder="11:00"
                      onChange={(event) =>
                        changeBreak(window.key, pause.key, {
                          start: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="block min-w-0 text-xs font-semibold text-slate-600 [&>label]:block [&>span]:block [&>input]:mt-2 [&>input]:block [&>input]:min-h-12 [&>input]:w-full [&>input]:min-w-0 [&>input]:rounded-xl [&>input]:border [&>input]:border-slate-300 [&>input]:bg-white [&>input]:px-3 [&>input]:py-2 [&>input]:text-sm [&>input]:font-normal [&>input]:text-slate-900 [&>input:disabled]:bg-slate-50 [&>select]:mt-2 [&>select]:block [&>select]:min-h-12 [&>select]:w-full [&>select]:min-w-0 [&>select]:rounded-xl [&>select]:border [&>select]:border-slate-300 [&>select]:bg-white [&>select]:px-3 [&>select]:py-2 [&>select]:text-sm [&>select]:font-normal [&>select]:text-slate-900 [&>select:disabled]:bg-slate-50 [&>input:focus-visible]:outline-2 [&>input:focus-visible]:outline-offset-2 [&>input:focus-visible]:outline-teal-700 [&>select:focus-visible]:outline-2 [&>select:focus-visible]:outline-offset-2 [&>select:focus-visible]:outline-teal-700">
                    <label htmlFor={`${pause.key}-end`}>Break end</label>
                    <input
                      id={`${pause.key}-end`}
                      value={pause.end}
                      required
                      maxLength={5}
                      placeholder="11:30"
                      onChange={(event) =>
                        changeBreak(window.key, pause.key, {
                          end: event.target.value,
                        })
                      }
                    />
                  </div>

                  {canManage && (
                    <button
                      className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                      type="button"
                      onClick={() =>
                        changeWindow(window.key, {
                          breaks: window.breaks.filter(
                            (item) => item.key !== pause.key,
                          ),
                        })
                      }
                    >
                      Remove break
                    </button>
                  )}
                </div>
              ))}

              {canManage && (
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    disabled={window.breaks.length >= 8}
                    onClick={() =>
                      changeWindow(window.key, {
                        breaks: [
                          ...window.breaks,
                          {
                            key: crypto.randomUUID(),
                            start: "",
                            end: "",
                          },
                        ],
                      })
                    }
                  >
                    + Add break
                  </button>

                  <button
                    className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    onClick={() => {
                      setWindows((current) =>
                        current.filter((item) => item.key !== window.key),
                      );
                      setMessage("");
                    }}
                  >
                    Remove window
                  </button>
                </div>
              )}
            </section>
          ))}

          {canManage && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={windows.length >= 28}
                onClick={() => {
                  setWindows((current) => [
                    ...current,
                    {
                      key: crypto.randomUUID(),
                      day: "1",
                      start: "09:00",
                      end: "13:00",
                      slot: "20",
                      breaks: [],
                    },
                  ]);
                  setMessage("");
                }}
              >
                + Add working window
              </button>

              <button
                className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                type="submit"
                disabled={conflict}
              >
                {saving ? "Saving..." : "Save weekly availability"}
              </button>
            </div>
          )}
        </fieldset>

        <p
          className="my-4 text-sm leading-6 text-red-700 empty:hidden"
          role="alert"
        >
          {error}
        </p>

        {conflict && (
          <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950 [&>button]:mt-4">
            <p>
              Availability changed elsewhere. Your edits remain visible. Review
              or copy them before loading the latest template.
            </p>
            <button
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              onClick={reloadLatest}
            >
              Discard edits and load latest
            </button>
          </div>
        )}
      </form>

      <p className="mt-5 text-xs leading-6 text-slate-500">
        Version {version}. Times are in {initial.timeZone}. End-of-day may be
        entered as 24:00. This template does not book or cancel appointments.
      </p>
    </section>
  );
}
