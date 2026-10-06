import { Link } from "react-router-dom";

export default function PrescriptionCard({
  prescription,
  showActions,
  onEdit,
}) {
  const {
    id,
    patient,
    appointment,
    medicines,
    notes,
    followUpDate,
    createdAt,
  } = prescription;
  const doctor = appointment?.doctor;

  return (
    <div className="bg-white rounded-xl shadow p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <Link
            to={`/prescriptions/${id}`}
            className="text-lg font-semibold text-blue-700 hover:underline"
          >
            Rx #{id.slice(0, 8)}
          </Link>
          <p className="text-xs text-slate-500 mt-1">
            {new Date(createdAt).toLocaleString()}
          </p>
        </div>
        {showActions && onEdit && (
          <button
            onClick={onEdit}
            className="text-sm text-blue-600 hover:underline"
          >
            Edit
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <p>
          <b>Patient:</b> {patient?.name}
        </p>
        <p>
          <b>Doctor:</b> {doctor?.user?.name || "-"}
        </p>
        <p>
          <b>Date:</b>{" "}
          {appointment ? new Date(appointment.date).toLocaleDateString() : "-"}
        </p>
        <p>
          <b>Follow-up:</b>{" "}
          {followUpDate ? new Date(followUpDate).toLocaleDateString() : "-"}
        </p>
      </div>

      <table className="w-full text-sm border rounded">
        <thead className="bg-slate-50 text-left">
          <tr>
            <th className="p-2">Medicine</th>
            <th className="p-2">Dosage</th>
            <th className="p-2">Duration</th>
          </tr>
        </thead>
        <tbody>
          {medicines.map((m) => (
            <tr key={m.id} className="border-t">
              <td className="p-2">{m.name}</td>
              <td className="p-2">{m.dosage}</td>
              <td className="p-2">{m.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {notes && (
        <p className="text-sm text-slate-700">
          <b>Notes:</b> {notes}
        </p>
      )}
    </div>
  );
}
