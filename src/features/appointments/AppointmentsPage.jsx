import { useState } from "react";
import { Link } from "react-router-dom";
import { showSuccess, showError } from "../../utils/toast";
import { SkeletonTable } from "../../components/Skeleton";
import {
  useAppointments,
  useCreateAppointment,
  useUpdateAppointmentStatus,
  useDeleteAppointment,
} from "../../hooks/useAppointments";
import { useAuth } from "../../hooks/useAuth";
import AppointmentFormModal from "./AppointmentFormModal";

const statusStyles = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export default function AppointmentsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading, isError } = useAppointments({
    page,
    limit: 10,
    status,
    date,
  });
  const createMut = useCreateAppointment();
  const statusMut = useUpdateAppointmentStatus();
  const deleteMut = useDeleteAppointment();

  const canBook = ["ADMIN", "RECEPTIONIST", "PATIENT"].includes(user?.role);
  const canChangeStatus = ["ADMIN", "RECEPTIONIST", "DOCTOR"].includes(
    user?.role,
  );
  const canDelete = user?.role === "ADMIN";

  const handleBook = async (form) => {
    try {
      await createMut.mutateAsync(form);
      showSuccess("Appointment booked");
      setModalOpen(false);
    } catch (e) {
      showError(e.response?.data?.message || "Booking failed");
    }
  };

  const handleStatus = async (id, next) => {
    try {
      await statusMut.mutateAsync({ id, payload: { status: next } });
      showSuccess(`Marked as ${next.toLowerCase()}`);
    } catch (e) {
      showError(e.response?.data?.message || "Update failed");
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Appointments</h1>
        {canBook && (
          <button
            onClick={() => setModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            + Book Appointment
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setPage(1);
          }}
          className="border rounded px-3 py-2"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="border rounded px-3 py-2"
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {isLoading && <SkeletonTable rows={6} cols={5} />}
      {isError && <p className="text-red-600">Failed to load</p>}

      {data && (
        <>
          <div className="overflow-x-auto bg-white rounded-xl shadow">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Slot</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Doctor</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="p-3">
                      {new Date(a.date).toLocaleDateString()}
                    </td>
                    <td className="p-3">{a.slot}</td>
                    <td className="p-3">
                      <Link
                        to={`/patients/${a.patient.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {a.patient.name}
                      </Link>
                    </td>
                    <td className="p-3">{a.doctor.user.name}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-xs ${statusStyles[a.status]}`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="p-3 space-x-2">
                      <Link
                        to={`/appointments/${a.id}`}
                        className="text-slate-600 hover:underline"
                      >
                        View
                      </Link>
                      {canChangeStatus && a.status === "PENDING" && (
                        <button
                          onClick={() => handleStatus(a.id, "CONFIRMED")}
                          className="text-blue-600 hover:underline"
                        >
                          Confirm
                        </button>
                      )}
                      {canChangeStatus && a.status === "CONFIRMED" && (
                        <button
                          onClick={() => handleStatus(a.id, "COMPLETED")}
                          className="text-green-600 hover:underline"
                        >
                          Complete
                        </button>
                      )}
                      {canChangeStatus &&
                        ["PENDING", "CONFIRMED"].includes(a.status) && (
                          <button
                            onClick={() => handleStatus(a.id, "CANCELLED")}
                            className="text-red-600 hover:underline"
                          >
                            Cancel
                          </button>
                        )}
                      {canDelete && (
                        <button
                          onClick={() => deleteMut.mutate(a.id)}
                          className="text-red-700 hover:underline"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">
                      No appointments
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Page {data.pagination.page} of {data.pagination.totalPages} ·{" "}
              {data.pagination.total} total
            </p>
            <div className="space-x-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 border rounded disabled:opacity-40"
              >
                Prev
              </button>
              <button
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 border rounded disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      <AppointmentFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleBook}
      />
    </div>
  );
}
