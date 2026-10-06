import { useState } from "react";
import { Link } from "react-router-dom";
import { SkeletonTable } from "../../components/Skeleton";
import {
  useDoctors,
  useSpecializations,
  useCreateDoctor,
  useUpdateDoctor,
  useDeleteDoctor,
} from "../../hooks/useDoctors";
import { useAuth } from "../../hooks/useAuth";
import { showSuccess, showError } from "../../utils/toast";
import DoctorFormModal from "./DoctorFormModal";
import ConfirmModal from "../../components/ConfirmModal";

export default function DoctorsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  // Delete confirm modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deletingName, setDeletingName] = useState("");
  const [busyDelete, setBusyDelete] = useState(false);

  const { data, isLoading, isError } = useDoctors({
    page,
    limit: 10,
    search,
    specialization,
  });
  const { data: specializations = [] } = useSpecializations();
  const createMut = useCreateDoctor();
  const updateMut = useUpdateDoctor();
  const deleteMut = useDeleteDoctor();

  const isAdmin = user?.role === "ADMIN";

  const handleSubmit = async (form) => {
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, payload: form });
        showSuccess("Doctor updated");
      } else {
        await createMut.mutateAsync(form);
        showSuccess("Doctor created");
      }
      setModalOpen(false);
      setEditing(null);
    } catch (e) {
      showError(e.response?.data?.message || "Failed");
    }
  };

  const openDeleteConfirm = (doctor) => {
    setDeletingId(doctor.id);
    setDeletingName(doctor.user?.name || "this doctor");
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    setBusyDelete(true);
    try {
      await deleteMut.mutateAsync(deletingId);
      showSuccess("Doctor deleted");
      setConfirmOpen(false);
      setDeletingId(null);
      setDeletingName("");
    } catch (e) {
      showError(e.response?.data?.message || "Delete failed");
    } finally {
      setBusyDelete(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Doctors</h1>
        {isAdmin && (
          <button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            + Add Doctor
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by name or specialization..."
          className="border rounded px-3 py-2 w-full max-w-sm"
        />
        <select
          value={specialization}
          onChange={(e) => {
            setSpecialization(e.target.value);
            setPage(1);
          }}
          className="border rounded px-3 py-2"
        >
          <option value="">All specializations</option>
          {specializations.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
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
                  <th className="p-3">Name</th>
                  <th className="p-3">Specialization</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Fees</th>
                  {isAdmin && <th className="p-3">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {data.data.map((d) => (
                  <tr key={d.id} className="border-t">
                    <td className="p-3">
                      <Link
                        to={`/doctors/${d.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {d.user.name}
                      </Link>
                    </td>
                    <td className="p-3">{d.specialization}</td>
                    <td className="p-3">{d.user.email}</td>
                    <td className="p-3">{d.user.phone || "-"}</td>
                    <td className="p-3">₹{Number(d.fees).toFixed(2)}</td>
                    {isAdmin && (
                      <td className="p-3 space-x-2">
                        <button
                          onClick={() => {
                            setEditing(d);
                            setModalOpen(true);
                          }}
                          className="text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openDeleteConfirm(d)}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">
                      No doctors found
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

      <DoctorFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
        initial={editing}
      />

      <ConfirmModal
        open={confirmOpen}
        title="Delete doctor?"
        message={`Are you sure you want to delete "${deletingName}" and their login account? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        busy={busyDelete}
        onConfirm={confirmDelete}
        onCancel={() => {
          setConfirmOpen(false);
          setDeletingId(null);
          setDeletingName("");
        }}
      />
    </div>
  );
}
