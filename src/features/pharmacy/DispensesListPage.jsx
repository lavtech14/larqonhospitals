import { useState } from "react";

import { PackageCheck } from "lucide-react";
import { useDispenses } from "../../hooks/usePharmacy";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import { SkeletonTable } from "../../components/Skeleton";

export default function DispensesListPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const { data, isLoading } = useDispenses({ page, limit: 20, status });

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Dispense History</h1>

      <div className="flex gap-2">
        {["", "PENDING", "DISPENSED", "PARTIAL", "CANCELLED"].map((s) => (
          <button
            key={s || "all"}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              status === s
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-white border-slate-300 hover:bg-slate-50"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {isLoading && <SkeletonTable rows={6} cols={5} />}

      {data && (
        <>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Patient</th>
                  <th className="px-5 py-3 font-medium">Items</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Dispensed by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3.5 text-xs text-slate-600">
                      {new Date(d.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium">{d.patient.name}</div>
                      <div className="text-xs text-slate-500">
                        {d.patient.phone}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">{d.items.length}</td>
                    <td className="px-5 py-3.5">
                      <Badge
                        variant={
                          d.status === "DISPENSED" ? "success" : "warning"
                        }
                      >
                        {d.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">
                      {d.dispensedBy?.name || "—"}
                    </td>
                  </tr>
                ))}
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState
                        icon={PackageCheck}
                        title="No dispenses yet"
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
              <Button
                size="sm"
                variant="secondary"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
