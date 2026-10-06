import { useParams, Link } from "react-router-dom";
import { usePrescription } from "../../hooks/usePrescriptions";
import { useAuth } from "../../hooks/useAuth";
import { SkeletonLine } from "../../components/Skeleton";
import { downloadPrescriptionPdf } from "./prescriptionPdf";

export default function PrescriptionDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, isLoading, isError } = usePrescription(id);

  if (isLoading)
    return (
      <div className="p-6 space-y-3">
        <SkeletonLine className="w-40" />
        <SkeletonLine className="w-64 h-7" />
      </div>
    );

  if (isError) return <div className="p-6 text-red-600">Failed to load</div>;

  const canDownload = ["ADMIN", "DOCTOR", "RECEPTIONIST", "PATIENT"].includes(
    user?.role,
  );

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <Link to="/prescriptions" className="text-blue-600 hover:underline">
        ← Back
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Prescription #{data.id.slice(0, 8)}
        </h1>
        {canDownload && (
          <button
            onClick={() => downloadPrescriptionPdf(data)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            ⬇ Download PDF
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-6 grid grid-cols-2 gap-4 text-sm">
        <p>
          <b>Patient:</b> {data.patient.name}
        </p>
        <p>
          <b>Phone:</b> {data.patient.phone}
        </p>
        <p>
          <b>Doctor:</b> {data.appointment.doctor.user.name}
        </p>
        <p>
          <b>Specialization:</b> {data.appointment.doctor.specialization}
        </p>
        <p>
          <b>Date:</b> {new Date(data.createdAt).toLocaleDateString()}
        </p>
        <p>
          <b>Follow-up:</b>{" "}
          {data.followUpDate
            ? new Date(data.followUpDate).toLocaleDateString()
            : "-"}
        </p>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-3">Medicine</th>
              <th className="p-3">Dosage</th>
              <th className="p-3">Duration</th>
            </tr>
          </thead>
          <tbody>
            {data.medicines.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="p-3">{m.name}</td>
                <td className="p-3">{m.dosage}</td>
                <td className="p-3">{m.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.notes && (
        <div className="bg-white rounded-xl shadow p-6 text-sm">
          <p className="font-medium mb-1">Notes</p>
          <p className="text-slate-700">{data.notes}</p>
        </div>
      )}
    </div>
  );
}
