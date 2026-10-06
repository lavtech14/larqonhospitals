import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { usePatientEMR, useUploadAttachment } from "../../hooks/useEMR";
import { useAuth } from "../../hooks/useAuth";
import { showSuccess, showError } from "../../utils/toast";
import { SkeletonLine } from "../../components/Skeleton";
import TimelineItem from "./TimelineItem";
import AttachmentsSection from "./AttachmentsSection";
import AttachmentUploadModal from "./AttachmentUploadModal";

const TABS = [
  "Timeline",
  "Prescriptions",
  "Lab Tests",
  "Attachments",
  "Invoices",
];

export default function EMRPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, isLoading, isError } = usePatientEMR(id);
  const uploadMut = useUploadAttachment(id);

  const [tab, setTab] = useState("Timeline");
  const [modalOpen, setModalOpen] = useState(false);

  const canUpload = ["ADMIN", "DOCTOR", "RECEPTIONIST", "LAB"].includes(
    user?.role,
  );

  if (isLoading)
    return (
      <div className="p-6 space-y-3">
        <SkeletonLine className="w-40" />
        <SkeletonLine className="w-64 h-7" />
        <SkeletonLine className="w-full h-32" />
      </div>
    );

  if (isError) return <div className="p-6 text-red-600">Failed to load</div>;

  const { patient, appointments, prescriptions, attachments, invoices } = data;

  const handleUpload = async (formData) => {
    try {
      await uploadMut.mutateAsync(formData);
      showSuccess("Uploaded");
    } catch (e) {
      showError(e.response?.data?.message || "Upload failed");
      throw e;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <Link to="/patients" className="text-blue-600 hover:underline">
        ← Patients
      </Link>
      {/* Patient header */}
      <div className="bg-white rounded-xl shadow p-6">
        <h1 className="text-2xl font-bold">{patient.name}</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-3 text-slate-600">
          <p>
            <b>DOB:</b> {new Date(patient.dob).toLocaleDateString()}
          </p>
          <p>
            <b>Gender:</b> {patient.gender}
          </p>
          <p>
            <b>Blood:</b> {patient.bloodGroup || "-"}
          </p>
          <p>
            <b>Phone:</b> {patient.phone}
          </p>
        </div>
      </div>
      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
            {t === "Attachments" && attachments.length > 0 && (
              <span className="ml-1 text-xs bg-slate-200 px-1.5 py-0.5 rounded">
                {attachments.length}
              </span>
            )}
          </button>
        ))}
      </div>
      {/* Timeline */}
      {tab === "Timeline" && (
        <div className="pt-2">
          {appointments.length === 0 && (
            <p className="text-slate-500 text-sm">No appointments yet.</p>
          )}
          {appointments.map((a) => (
            <TimelineItem
              key={a.id}
              icon="📅"
              title={`${a.status} · ${new Date(a.date).toLocaleDateString()} @ ${a.slot}`}
              subtitle={a.doctor.user.name}
            >
              <p className="text-sm text-slate-600">
                <b>Specialization:</b> {a.doctor.specialization}
              </p>
              {a.notes && (
                <p className="text-sm text-slate-600 mt-1">
                  <b>Notes:</b> {a.notes}
                </p>
              )}
              {a.prescription && (
                <div className="mt-3 border-t pt-3">
                  <p className="text-sm font-medium mb-1">💊 Prescription</p>
                  <ul className="text-sm text-slate-700 space-y-1">
                    {a.prescription.medicines.map((m) => (
                      <li key={m.id}>
                        <b>{m.name}</b> — {m.dosage} · {m.duration}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={`/prescriptions/${a.prescription.id}`}
                    className="text-xs text-blue-600 hover:underline inline-block mt-2"
                  >
                    View full prescription →
                  </Link>
                </div>
              )}
            </TimelineItem>
          ))}
        </div>
      )}
      {/* Prescriptions */}
      {tab === "Prescriptions" && (
        <div className="space-y-3">
          {prescriptions.length === 0 && (
            <p className="text-slate-500 text-sm">No prescriptions yet.</p>
          )}
          {prescriptions.map((p) => (
            <div key={p.id} className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    Rx #{p.id.slice(0, 8)} · {p.medicines.length} medicine(s)
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(p.createdAt).toLocaleDateString()} ·{" "}
                    {p.appointment.doctor.user.name}
                  </p>
                </div>
                <Link
                  to={`/prescriptions/${p.id}`}
                  className="text-blue-600 text-sm hover:underline"
                >
                  View →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Attachments */}
      {tab === "Attachments" && (
        <div className="space-y-4">
          {canUpload && (
            <button
              onClick={() => setModalOpen(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              + Upload Attachment
            </button>
          )}
          <AttachmentsSection patientId={id} attachments={attachments} />
        </div>
      )}
      {/* Invoices */}
      {tab === "Invoices" && (
        <div className="space-y-3">
          {invoices.length === 0 && (
            <p className="text-slate-500 text-sm">No invoices yet.</p>
          )}
          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="bg-white rounded-xl shadow p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-medium">₹{Number(inv.total).toFixed(2)}</p>
                <p className="text-xs text-slate-500">
                  {new Date(inv.createdAt).toLocaleDateString()} · {inv.status}
                </p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded ${
                  inv.status === "PAID"
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {inv.status}
              </span>
            </div>
          ))}
        </div>
      )}
      {/* Lab Tests */}
      {tab === "Lab Tests" && (
        <div className="space-y-3">
          {data.labTests?.length === 0 && (
            <p className="text-slate-500 text-sm">No lab tests ordered yet.</p>
          )}
          {data.labTests?.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-xl shadow p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-medium">{t.testName}</p>
                <p className="text-xs text-slate-500">
                  {t.testType} · ordered by {t.orderedBy.name} ·{" "}
                  {new Date(t.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    t.status === "COMPLETED"
                      ? "bg-green-100 text-green-700"
                      : t.status === "IN_PROGRESS"
                        ? "bg-blue-100 text-blue-700"
                        : t.status === "CANCELLED"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {t.status}
                </span>
                <Link
                  to={`/lab/${t.id}`}
                  className="text-blue-600 text-sm hover:underline"
                >
                  View →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
      <AttachmentUploadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleUpload}
      />
    </div>
  );
}
