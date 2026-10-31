"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError } from "@/lib/api";
import { patientApiRequest } from "@/lib/patient-api";

import PatientPortalFrame from "./PatientPortalFrame";

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type Paged<T> = {
  items: T[];
  pagination: Pagination;
};

type Visit = {
  id: string;
  status: string;
  checkedInAt: string;
  startedAt: string | null;
  completedAt: string | null;

  appointment: {
    id: string;
    startsAt: string;
    endsAt: string;
    mode: string;

    doctor: {
      displayName: string;
      specialty: string;

      department: {
        name: string;
      };
    };
  };

  publishedSummary: {
    publishedAt: string;
  } | null;
};

type DetailResponse = {
  visit: Visit;

  records: {
    vitalCount: number;
    issuedPrescriptionCount: number;
    summaryPublished: boolean;
  };
};

type Vital = {
  id: string;
  measuredAt: string;
  recordedAt: string;

  temperatureC: number | null;
  pulseBpm: number | null;
  respiratoryRate: number | null;
  systolicBp: number | null;
  diastolicBp: number | null;
  oxygenSaturation: number | null;
  weightKg: number | null;
  heightCm: number | null;
};

type Summary = {
  id: string;
  patientName: string;
  patientMrn: string;
  doctorName: string;
  doctorRegistrationNumber: string | null;
  doctorRegistrationAuthority: string | null;
  summary: string;
  carePlan: string;
  followUp: string;
  returnPrecautions: string;
  publishedAt: string;
};

type SummaryResponse = {
  published: boolean;
  summary: Summary | null;
};

type PrescriptionHeader = {
  id: string;
  status: string;
  issuedAt: string | null;
  patientName: string | null;
  patientMrn: string | null;
  prescriberName: string | null;
  prescriberRegistrationNumber: string | null;
  prescriberRegistrationAuthority: string | null;
};

type Prescription = PrescriptionHeader & {
  allergyStatus: string;
  allergyDetails: string | null;
  instructions: string | null;

  items: {
    id: string;
    position: number;
    medicineName: string;
    genericName: string | null;
    strength: string;
    dosageForm: string;
    dose: string;
    route: string;
    frequency: string;
    duration: string;
    quantity: number;
    quantityUnit: string;
    instructions: string | null;
  }[];
};

const panel =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6";

const button =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50";

const primary = `${button} border-teal-800 bg-teal-800! text-white hover:bg-teal-900!`;

const formatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "medium",
  timeStyle: "short",
});

function dateTime(value: string | null): string {
  if (!value) return "Not recorded";

  const date = new Date(value);

  return Number.isFinite(date.getTime())
    ? `${formatter.format(date)} IST`
    : "Date unavailable";
}

function label(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function requiresLogin(caught: unknown): boolean {
  if (!(caught instanceof ApiError)) return false;
  if (caught.status === 401) return true;

  const data = caught.data;

  return (
    caught.status === 403 &&
    data !== null &&
    typeof data === "object" &&
    "code" in data &&
    data.code === "PATIENT_PASSWORD_CHANGE_REQUIRED"
  );
}

/**
 * Requests remain patient-authenticated through the existing helper.
 * A changed path never displays the previous path's response.
 */
function usePatientResource<T>(path: string) {
  const router = useRouter();
  const [revision, setRevision] = useState(0);

  const key = `${path}:${revision}`;

  const [remote, setRemote] = useState<{
    key: string;
    data: T | null;
    error: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function load() {
      try {
        const result = await patientApiRequest<T>(path, {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(45_000),
          ]),
        });

        if (!active) return;

        setRemote({
          key,
          data: result,
          error: "",
        });
      } catch (caught) {
        if (!active || controller.signal.aborted) return;

        if (requiresLogin(caught)) {
          setRemote({
            key,
            data: null,
            error: "Please sign in to your patient account.",
          });

          router.replace("/patient/login");
          return;
        }

        setRemote({
          key,
          data: null,
          error:
            caught instanceof Error
              ? caught.message
              : "Unable to load this information.",
        });
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [path, key, router]);

  return {
    data: remote?.key === key ? remote.data : null,
    error: remote?.key === key ? remote.error : "",
    loading: remote?.key !== key,
    reload: () => setRevision((current) => current + 1),
  };
}

function Feedback({ loading, error }: { loading: boolean; error: string }) {
  return (
    <>
      {loading && (
        <p role="status" className="py-5 text-sm text-slate-500">
          Loading your records…
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error} Use Refresh to try again.
        </p>
      )}
    </>
  );
}

function Pager({
  pagination,
  loading,
  onChange,
}: {
  pagination: Pagination;
  loading: boolean;
  onChange: (page: number) => void;
}) {
  return (
    <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
      <p className="text-xs text-slate-500">
        Page {pagination.page} of {Math.max(1, pagination.totalPages)}
        {" · "}
        {pagination.total} records
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          className={button}
          disabled={loading || pagination.page <= 1}
          onClick={() => onChange(pagination.page - 1)}
        >
          Previous
        </button>

        <button
          type="button"
          className={button}
          disabled={loading || pagination.page >= pagination.totalPages}
          onClick={() => onChange(pagination.page + 1)}
        >
          Next
        </button>
      </div>
    </footer>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-900 ring-1 ring-inset ring-teal-200">
      {label(status)}
    </span>
  );
}

export default function PatientVisits() {
  const [page, setPage] = useState(1);

  const { data, error, loading, reload } = usePatientResource<Paged<Visit>>(
    `/patient/visits?page=${page}&limit=10`,
  );

  return (
    <PatientPortalFrame current="visits">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-teal-700">
            Your health records
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight">My visits</h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            View your recorded visits, measurements, visit summaries, and issued
            prescriptions.
          </p>
        </div>

        <button
          type="button"
          className={button}
          disabled={loading}
          onClick={reload}
        >
          Refresh
        </button>
      </header>

      <Feedback loading={loading} error={error} />

      {data && (
        <>
          {!data.items.length && (
            <section className={`${panel} text-center`}>
              <h2 className="text-lg font-semibold">No visits to show</h2>

              <p className="mt-2 text-sm text-slate-600">
                Visits appear after hospital check-in. Upcoming bookings are
                under Appointments.
              </p>

              <Link href="/patient/appointments" className={`${button} mt-5`}>
                View appointments
              </Link>
            </section>
          )}

          <div className="grid gap-4">
            {data.items.map((visit) => (
              <article key={visit.id} className={panel}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-500">
                      {dateTime(visit.appointment.startsAt)}
                    </p>

                    <h2 className="mt-2 text-xl font-bold">
                      {visit.appointment.doctor.displayName}
                    </h2>

                    <p className="mt-1 text-sm text-slate-600">
                      {visit.appointment.doctor.specialty}
                      {" · "}
                      {visit.appointment.doctor.department.name}
                    </p>
                  </div>

                  <StatusBadge status={visit.status} />
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">
                    {visit.publishedSummary
                      ? "Visit summary available"
                      : "Visit summary not yet published"}
                  </p>

                  <Link
                    href={`/patient/visits/${visit.id}`}
                    className={primary}
                  >
                    View visit
                  </Link>
                </div>
              </article>
            ))}
          </div>

          <Pager
            pagination={data.pagination}
            loading={loading}
            onChange={setPage}
          />
        </>
      )}
    </PatientPortalFrame>
  );
}

export function PatientVisitDetails({ visitId }: { visitId: string }) {
  const { data, loading, error, reload } = usePatientResource<DetailResponse>(
    `/patient/visits/${visitId}`,
  );

  // Remount record sections on explicit refresh.
  const [recordsRevision, setRecordsRevision] = useState(0);

  return (
    <PatientPortalFrame current="visits">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/patient/visits"
          className="text-sm font-semibold text-teal-800"
        >
          ← My visits
        </Link>

        <button
          type="button"
          className={button}
          disabled={loading}
          onClick={() => {
            reload();
            setRecordsRevision((current) => current + 1);
          }}
        >
          Refresh visit
        </button>
      </header>

      <Feedback loading={loading} error={error} />

      {data && (
        <>
          <section className={panel}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-teal-700">
                  Visit details
                </p>

                <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
                  {data.visit.appointment.doctor.displayName}
                </h1>

                <p className="mt-2 text-sm text-slate-600">
                  {data.visit.appointment.doctor.specialty}
                  {" · "}
                  {data.visit.appointment.doctor.department.name}
                </p>
              </div>

              <StatusBadge status={data.visit.status} />
            </div>

            <dl className="mt-6 grid gap-5 text-sm sm:grid-cols-3">
              {[
                ["Appointment", dateTime(data.visit.appointment.startsAt)],
                ["Checked in", dateTime(data.visit.checkedInAt)],
                [
                  "Completed",
                  data.visit.completedAt
                    ? dateTime(data.visit.completedAt)
                    : "Not completed",
                ],
              ].map(([title, value]) => (
                <div key={title}>
                  <dt className="text-xs text-slate-500">{title}</dt>
                  <dd className="mt-1 font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className={panel}>
            <h2 className="text-xl font-bold">Laboratory reports</h2>

            <p className="mt-2 text-sm text-slate-600">
              View reports reviewed and released by the laboratory.
            </p>

            <Link
              href={`/patient/visits/${visitId}/lab-reports`}
              className={`${button} mt-4`}
            >
              View lab reports
            </Link>
          </section>
          <SummarySection
            key={`summary:${visitId}:${recordsRevision}`}
            visitId={visitId}
          />

          <VitalsSection
            key={`vitals:${visitId}:${recordsRevision}`}
            visitId={visitId}
          />

          <PrescriptionsSection
            key={`prescriptions:${visitId}:${recordsRevision}`}
            visitId={visitId}
          />
        </>
      )}
    </PatientPortalFrame>
  );
}

function SummarySection({ visitId }: { visitId: string }) {
  const { data, loading, error, reload } = usePatientResource<SummaryResponse>(
    `/patient/visits/${visitId}/summary`,
  );

  return (
    <section className={panel}>
      <SectionHeader
        title="Doctor’s visit summary"
        loading={loading}
        onRefresh={reload}
      />

      <Feedback loading={loading} error={error} />

      {data && !data.summary && (
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Your doctor has not published a visit summary yet.
        </p>
      )}

      {data?.summary && (
        <div className="mt-5 space-y-5">
          <div className="rounded-xl bg-teal-50 p-4 text-sm">
            <p className="font-semibold text-teal-950">
              {data.summary.patientName}
            </p>

            <p className="mt-1 text-teal-800">{data.summary.patientMrn}</p>

            <p className="mt-3 text-slate-600">
              Published by {data.summary.doctorName}
              {" · "}
              {dateTime(data.summary.publishedAt)}
            </p>
          </div>

          {[
            ["Visit summary", data.summary.summary],
            ["Care plan and advice", data.summary.carePlan],
            ["Follow-up instructions", data.summary.followUp],
            ["When to seek further help", data.summary.returnPrecautions],
          ].map(([title, value]) =>
            value ? (
              <div key={title}>
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                  {value}
                </p>
              </div>
            ) : null,
          )}
        </div>
      )}
    </section>
  );
}

const measurements = [
  ["temperatureC", "Temperature", "°C"],
  ["pulseBpm", "Pulse", "beats/min"],
  ["respiratoryRate", "Respiratory rate", "breaths/min"],
  ["systolicBp", "Systolic BP", "mmHg"],
  ["diastolicBp", "Diastolic BP", "mmHg"],
  ["oxygenSaturation", "Oxygen saturation", "%"],
  ["weightKg", "Weight", "kg"],
  ["heightCm", "Height", "cm"],
] as const;

function VitalsSection({ visitId }: { visitId: string }) {
  const [page, setPage] = useState(1);

  const { data, loading, error, reload } = usePatientResource<Paged<Vital>>(
    `/patient/visits/${visitId}/vitals?page=${page}&limit=5`,
  );

  return (
    <section className={panel}>
      <SectionHeader
        title="Recorded vitals"
        loading={loading}
        onRefresh={reload}
      />

      <Feedback loading={loading} error={error} />

      {data && (
        <>
          {!data.items.length && (
            <p className="mt-4 text-sm text-slate-600">
              No measurements on this page.
            </p>
          )}

          {data.items.map((vital) => (
            <article
              key={vital.id}
              className="mt-4 rounded-xl border border-slate-200 p-4"
            >
              <h3 className="text-sm font-semibold">
                Measured {dateTime(vital.measuredAt)}
              </h3>

              <dl className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                {measurements.map(([key, title, unit]) =>
                  vital[key] !== null && vital[key] !== undefined ? (
                    <div key={key}>
                      <dt className="text-xs text-slate-500">{title}</dt>

                      <dd className="mt-1 text-lg font-semibold">
                        {vital[key]}{" "}
                        <span className="text-xs font-normal text-slate-500">
                          {unit}
                        </span>
                      </dd>
                    </div>
                  ) : null,
                )}
              </dl>
            </article>
          ))}

          <Pager
            pagination={data.pagination}
            loading={loading}
            onChange={setPage}
          />
        </>
      )}
    </section>
  );
}

function PrescriptionsSection({ visitId }: { visitId: string }) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

  const { data, loading, error, reload } = usePatientResource<
    Paged<PrescriptionHeader>
  >(`/patient/visits/${visitId}/prescriptions?page=${page}&limit=5`);

  return (
    <section className={panel}>
      <SectionHeader
        title="Issued prescriptions"
        loading={loading}
        onRefresh={() => {
          setSelected(null);
          reload();
        }}
      />

      <Feedback loading={loading} error={error} />

      {data && (
        <>
          {!data.items.length && (
            <p className="mt-4 text-sm text-slate-600">
              No issued prescriptions on this page.
            </p>
          )}

          <div className="mt-4 space-y-3">
            {data.items.map((prescription) => (
              <article
                key={prescription.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {prescription.prescriberName || "Issued prescription"}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Issued {dateTime(prescription.issuedAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={button}
                      aria-expanded={selected === prescription.id}
                      onClick={() =>
                        setSelected((current) =>
                          current === prescription.id ? null : prescription.id,
                        )
                      }
                    >
                      {selected === prescription.id
                        ? "Close details"
                        : "View prescription"}
                    </button>

                    <Link
                      href={
                        `/patient/visits/${visitId}` +
                        `/prescriptions/${prescription.id}/print`
                      }
                      className={primary}
                    >
                      View / print
                    </Link>
                  </div>
                </div>

                {selected === prescription.id && (
                  <PrescriptionDetails
                    key={prescription.id}
                    visitId={visitId}
                    prescriptionId={prescription.id}
                  />
                )}
              </article>
            ))}
          </div>

          <Pager
            pagination={data.pagination}
            loading={loading}
            onChange={(nextPage) => {
              setSelected(null);
              setPage(nextPage);
            }}
          />
        </>
      )}
    </section>
  );
}

function PrescriptionDetails({
  visitId,
  prescriptionId,
}: {
  visitId: string;
  prescriptionId: string;
}) {
  const { data, loading, error, reload } = usePatientResource<{
    prescription: Prescription;
  }>(`/patient/visits/${visitId}/prescriptions/${prescriptionId}`);

  const prescription = data?.prescription;

  return (
    <div className="mt-5 border-t border-slate-200 pt-5">
      <Feedback loading={loading} error={error} />

      {error && (
        <button type="button" className={`${button} mt-3`} onClick={reload}>
          Refresh
        </button>
      )}

      {prescription && (
        <div className="space-y-5">
          <div className="rounded-xl bg-slate-50 p-4 text-sm">
            <p className="font-semibold">{prescription.patientName}</p>

            <p className="mt-1 text-slate-600">{prescription.patientMrn}</p>

            {prescription.prescriberRegistrationNumber && (
              <p className="mt-3 text-slate-600">
                Prescriber registration:{" "}
                {prescription.prescriberRegistrationNumber}
                {prescription.prescriberRegistrationAuthority
                  ? ` · ${prescription.prescriberRegistrationAuthority}`
                  : ""}
              </p>
            )}
          </div>

          <div className="text-sm">
            <h4 className="font-semibold">Allergy review at issuance</h4>

            <p className="mt-2 text-slate-700">
              {label(prescription.allergyStatus)}
            </p>

            {prescription.allergyDetails && (
              <p className="mt-2 whitespace-pre-wrap break-words text-slate-700">
                {prescription.allergyDetails}
              </p>
            )}
          </div>

          <ol className="space-y-4">
            {prescription.items.map((item, index) => (
              <li
                key={item.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <h4 className="font-semibold">
                  {index + 1}. {item.medicineName}
                </h4>

                <p className="mt-1 text-sm text-slate-600">
                  {item.strength} · {item.dosageForm}
                </p>

                {item.genericName && (
                  <p className="mt-1 text-xs text-slate-500">
                    {item.genericName}
                  </p>
                )}

                <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                  {[
                    ["Dose", item.dose],
                    ["Route", item.route],
                    ["Frequency", item.frequency],
                    ["Duration", item.duration],
                    ["Quantity", `${item.quantity} ${item.quantityUnit}`],
                  ].map(([title, value]) => (
                    <div key={title}>
                      <dt className="text-xs text-slate-500">{title}</dt>

                      <dd className="mt-1 whitespace-pre-wrap break-words font-medium">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>

                {item.instructions && (
                  <p className="mt-4 whitespace-pre-wrap break-words rounded-lg bg-teal-50 p-3 text-sm leading-6 text-teal-950">
                    {item.instructions}
                  </p>
                )}
              </li>
            ))}
          </ol>

          {prescription.instructions && (
            <div>
              <h4 className="text-sm font-semibold">General instructions</h4>

              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                {prescription.instructions}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  loading,
  onRefresh,
}: {
  title: string;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold">{title}</h2>

      <button
        type="button"
        className={button}
        disabled={loading}
        onClick={onRefresh}
      >
        Refresh
      </button>
    </header>
  );
}
