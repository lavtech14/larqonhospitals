"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { patientApiRequest } from "@/lib/patient-api";

type Summary = {
  assignment: {
    id: string;
    startDate: string;
    endDate: string;
    doctor: {
      displayName: string;
    };
    nurse: {
      fullName: string;
    };
  } | null;
};

function calendarDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function PatientRpmAssignedBanner() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    let checking = false;

    async function load() {
      if (checking) return;
      checking = true;

      try {
        const result = await patientApiRequest<Summary>("/patient/rpm/summary");

        if (active) {
          setData(result);
          setError("");
        }
      } catch (caught) {
        if (active) {
          // Do not display an outdated active assignment after failure.
          setData(null);
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to check your home-monitoring assignment.",
          );
        }
      } finally {
        checking = false;
        if (active) setLoading(false);
      }
    }

    function onFocus() {
      void load();
    }

    void load();

    window.addEventListener("focus", onFocus);

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load();
      }
    }, 60_000);

    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [refresh]);

  if (loading) {
    return (
      <p
        role="status"
        className="rounded-xl bg-slate-100 p-4 text-sm text-slate-600"
      >
        Checking home-monitoring assignment…
      </p>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p role="status" className="text-sm text-slate-600">
          Home-monitoring status is temporarily unavailable.
        </p>

        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setRefresh((value) => value + 1);
          }}
          className="mt-2 min-h-11 text-sm font-semibold text-teal-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data?.assignment) return null;

  const assignment = data.assignment;

  return (
    <section
      aria-labelledby="rpm-assigned-title"
      className="rounded-2xl border border-teal-200 bg-teal-50 p-5 sm:p-6"
    >
      <p className="text-xs font-bold uppercase tracking-widest text-teal-700">
        Home monitoring
      </p>

      <h2
        id="rpm-assigned-title"
        className="mt-2 text-xl font-bold text-teal-950"
      >
        RPM assigned
      </h2>

      <p className="mt-3 text-sm leading-6 text-teal-950">
        {assignment.doctor.displayName} has assigned home monitoring. Enter the
        readings you take at home during the assigned period.
      </p>

      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-teal-800">Assigned nurse</dt>
          <dd className="mt-1 font-semibold text-teal-950">
            {assignment.nurse.fullName}
          </dd>
        </div>

        <div>
          <dt className="text-teal-800">Monitoring dates</dt>
          <dd className="mt-1 font-semibold text-teal-950">
            {calendarDate(assignment.startDate)} –{" "}
            {calendarDate(assignment.endDate)}
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={`/patient/monitoring/${assignment.id}/readings/new`}
          className="inline-flex min-h-12 items-center rounded-xl bg-teal-800 px-5 text-sm font-semibold text-white hover:bg-teal-900"
        >
          Enter vital readings
        </Link>

        <Link
          href={`/patient/monitoring/${assignment.id}/history`}
          className="inline-flex min-h-12 items-center rounded-xl border border-teal-700 bg-white px-5 text-sm font-semibold text-teal-800 hover:bg-teal-100"
        >
          View my readings
        </Link>
      </div>
    </section>
  );
}
