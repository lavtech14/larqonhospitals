import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useLabTests,
  useUpdateLabStatus,
  useDeleteLabTest,
} from "../../hooks/useLab";
import { useAuth } from "../../hooks/useAuth";
import { showSuccess, showError } from "../../utils/toast";
import { SkeletonTable } from "../../components/Skeleton";
import EmptyState from "../../components/EmptyState";
import OrderLabTestModal from "./OrderLabTestModal";
import UploadResultModal from "./UploadResultModal";
import { useCreateLabTest, useUploadLabResult } from "../../hooks/useLab";

const statusStyles = {
  ORDERED: "bg-yellow-100 text-yellow-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export default function LabTestsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [orderOpen, setOrderOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [activeTest, setActiveTest] = useState(null);

  const { data, isLoading, isError } = useLabTests({ page, limit: 10, status });
  const createMut = useCreateLabTest();
  const statusMut = useUpdateLabStatus();
  const uploadMut = useUploadLabResult();
  const deleteMut = useDeleteLabTest();

  const isDoctor = user?.role === "DOCTOR";
  const isLab = user?.role === "LAB";
  const isAdmin = user?.role === "ADMIN";
  const canOrder = isDoctor || isAdmin;
  const canProcess = isLab || isAdmin;

  const handleOrder = async (form) => {
    try {
      await createMut.mutateAsync(form);
      showSuccess("Test ordered");
      setOrderOpen(false);
    } catch (e) {
      showError(e.response?.data?.message || "Failed");
    }
  };

  const handleStatus = async (id, next) => {
    try {
      await statusMut.mutateAsync({ id, payload: { status: next } });
      showSuccess(`Marked ${next.toLowerCase()}`);
    } catch (e) {
      showError(e.response?.data?.message || "Failed");
    }
  };

  const handleUpload = async (formData) => {
    try {
      await uploadMut.mutateAsync({ id: activeTest.id, formData });
      showSuccess("Result uploaded");
    } catch (e) {
      showError(e.response?.data?.message || "Failed");
      throw e;
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this lab test?")) return;
    try {
      await deleteMut.mutateAsync(id);
      showSuccess("Deleted");
    } catch (e) {
      showError(e.response?.data?.message || "Failed");
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lab Tests</h1>
        {canOrder && (
          <button
            onClick={() => setOrderOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            + Order Test
          </button>
        )}
      </div>

      <select
        value={status}
        onChange={(e) => {
          setStatus(e.target.value);
          setPage(1);
        }}
        className="border rounded px-3 py-2"
      >
        <option value="">All statuses</option>
        <option value="ORDERED">Ordered</option>
        <option value="IN_PROGRESS">In Progress</option>
        <option value="COMPLETED">Completed</option>
        <option value="CANCELLED">Cancelled</option>
      </select>

      {isLoading && <SkeletonTable rows={6} cols={6} />}
      {isError && <p className="text-red-600">Failed to load</p>}

      {data && (
        <>
          <div className="overflow-x-auto bg-white rounded-xl shadow">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="p-3">Test</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Ordered By</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="p-3">
                      <Link
                        to={`/lab/${t.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {t.testName}
                      </Link>
                    </td>
                    <td className="p-3 text-xs">{t.testType}</td>
                    <td className="p-3">{t.patient.name}</td>
                    <td className="p-3">{t.orderedBy.name}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-xs ${statusStyles[t.status]}`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="p-3 space-x-2">
                      {canProcess && t.status === "ORDERED" && (
                        <button
                          onClick={() => handleStatus(t.id, "IN_PROGRESS")}
                          className="text-blue-600 hover:underline"
                        >
                          Start
                        </button>
                      )}
                      {canProcess &&
                        (t.status === "IN_PROGRESS" ||
                          t.status === "ORDERED") && (
                          <button
                            onClick={() => {
                              setActiveTest(t);
                              setUploadOpen(true);
                            }}
                            className="text-green-600 hover:underline"
                          >
                            Upload Result
                          </button>
                        )}
                      {canProcess &&
                        ["ORDERED", "IN_PROGRESS"].includes(t.status) && (
                          <button
                            onClick={() => handleStatus(t.id, "CANCELLED")}
                            className="text-red-600 hover:underline"
                          >
                            Cancel
                          </button>
                        )}
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(t.id)}
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
                    <td colSpan={6}>
                      <EmptyState
                        title="No lab tests"
                        subtitle={
                          canOrder
                            ? "Order your first test."
                            : "Nothing assigned yet."
                        }
                      />
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

      <OrderLabTestModal
        open={orderOpen}
        onClose={() => setOrderOpen(false)}
        onSubmit={handleOrder}
      />
      <UploadResultModal
        open={uploadOpen}
        onClose={() => {
          setUploadOpen(false);
          setActiveTest(null);
        }}
        onSubmit={handleUpload}
        test={activeTest}
      />
    </div>
  );
}
