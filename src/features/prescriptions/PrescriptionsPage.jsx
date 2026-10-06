import { useState } from "react";
import { Link } from "react-router-dom";
import { usePrescriptions } from "../../hooks/usePrescriptions";
import { SkeletonTable } from "../../components/Skeleton";
import EmptyState from "../../components/EmptyState";

export default function PrescriptionsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = usePrescriptions({ page, limit: 10 });

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Prescriptions</h1>

      {isLoading && <SkeletonTable rows={6} cols={5} />}
      {isError && <p className="text-red-600">Failed to load</p>}

      {data && (
        <>
          <div className="overflow-x-auto bg-white rounded-xl shadow">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="p-3">Rx #</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Doctor</th>
                  <th className="p-3">Medicines</th>
                  <th className="p-3">Date</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-3 font-mono text-xs">
                      #{p.id.slice(0, 8)}
                    </td>
                    <td className="p-3">{p.patient.name}</td>
                    <td className="p-3">{p.appointment.doctor.user.name}</td>
                    <td className="p-3">{p.medicines.length}</td>
                    <td className="p-3">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <Link
                        to={`/prescriptions/${p.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        title="No prescriptions yet"
                        subtitle="Doctors can write prescriptions from appointment pages."
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
    </div>
  );
}
