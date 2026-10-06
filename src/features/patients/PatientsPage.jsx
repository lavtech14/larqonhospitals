import { useState } from "react";
import { Link } from "react-router-dom";
import { showSuccess, showError } from "../../utils/toast";
import { SkeletonTable } from "../../components/Skeleton";
import {
  usePatients,
  useCreatePatient,
  useUpdatePatient,
  useDeletePatient,
} from "../../hooks/usePatients";
import { useAuth } from "../../hooks/useAuth";
import PatientFormModal from "./PatientFormModal";
import ConfirmModal from "../../components/ConfirmModal";

export default function PatientsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data, isLoading, isError } = usePatients({ page, limit: 10, search });
  const createMut = useCreatePatient();
  const updateMut = useUpdatePatient();
  const deleteMut = useDeletePatient();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deletingName, setDeletingName] = useState("");
  const [busyDelete, setBusyDelete] = useState(false);

  const canEdit = ["ADMIN", "RECEPTIONIST"].includes(user?.role);
  const canDelete = user?.role === "ADMIN";

  const handleSubmit = async (form) => {
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, payload: form });
        showSuccess("Patient updated");
      } else {
        await createMut.mutateAsync(form);
        showSuccess("Patient created");
      }
      setModalOpen(false);
      setEditing(null);
    } catch (e) {
      showError(e.response?.data?.message || "Failed");
    }
  };

  const openDeleteConfirm = (patient) => {
    setDeletingId(patient.id);
    setDeletingName(patient.name);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    setBusyDelete(true);
    try {
      await deleteMut.mutateAsync(deletingId);
      showSuccess("Patient deleted");
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
        <h1 className="text-2xl font-bold">Patients</h1>
        {canEdit && (
          <button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            + Add Patient
          </button>
        )}
      </div>

      <input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        placeholder="Search by name or phone..."
        className="border rounded px-3 py-2 w-full max-w-sm"
      />

      {isLoading && <SkeletonTable rows={6} cols={5} />}
      {isError && <p className="text-red-600">Failed to load</p>}

      {data && (
        <>
          <div className="overflow-x-auto bg-white rounded-xl shadow">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Gender</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Blood</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-3">
                      <Link
                        to={`/patients/${p.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="p-3">{p.gender}</td>
                    <td className="p-3">{p.phone}</td>
                    <td className="p-3">{p.bloodGroup || "-"}</td>
                    <td className="p-3 space-x-2">
                      {canEdit && (
                        <button
                          onClick={() => {
                            setEditing(p);
                            setModalOpen(true);
                          }}
                          className="text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => openDeleteConfirm(p)}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500">
                      No patients found
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

      <PatientFormModal
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
        title="Delete patient?"
        message={`Are you sure you want to delete "${deletingName}"? This action cannot be undone.`}
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
