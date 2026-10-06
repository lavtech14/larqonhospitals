import { useState } from "react";
import { Link } from "react-router-dom";
import { Receipt } from "lucide-react";
import { usePayments, usePaymentStats } from "../../hooks/usePayments";
import { useAuth } from "../../hooks/useAuth";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import { SkeletonTable } from "../../components/Skeleton";
import KpiCard from "../dashboard/KpiCard";

const statusVariant = {
  SUCCESS: "success",
  PENDING: "warning",
  FAILED: "danger",
  REFUNDED: "purple",
  PARTIALLY_REFUNDED: "info",
};

export default function PaymentsListPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [range, setRange] = useState(7);

  const { data, isLoading } = usePayments({ page, limit: 20, type, status });
  const { data: stats } = usePaymentStats(range);

  const canSeeStats = ["ADMIN", "RECEPTIONIST"].includes(user?.role);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
          <p className="text-sm text-slate-500 mt-1">
            All collections and refunds
          </p>
        </div>
        {canSeeStats && (
          <div className="flex gap-2">
            {[7, 14, 30].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-sm rounded-lg border ${
                  range === r
                    ? "bg-brand-600 text-white border-brand-600"
                    : "bg-white border-slate-300 hover:bg-slate-50"
                }`}
              >
                {r}d
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      {canSeeStats && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Collected"
            value={`₹${stats.totalCollected.toFixed(0)}`}
            icon="💰"
            accent="green"
          />
          <KpiCard
            label="Refunded"
            value={`₹${stats.totalRefunded.toFixed(0)}`}
            icon="↩️"
            accent="red"
          />
          <KpiCard
            label="Net"
            value={`₹${stats.net.toFixed(0)}`}
            icon="📈"
            accent="blue"
          />
          <KpiCard
            label="Transactions"
            value={stats.count}
            icon="🧾"
            accent="purple"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All types</option>
          <option value="PAYMENT">Payments</option>
          <option value="REFUND">Refunds</option>
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="SUCCESS">Success</option>
          <option value="PENDING">Pending</option>
          <option value="FAILED">Failed</option>
          <option value="REFUNDED">Refunded</option>
        </select>
      </div>

      {isLoading && <SkeletonTable rows={8} cols={6} />}

      {data && (
        <>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Invoice</th>
                  <th className="px-5 py-3 font-medium">Patient</th>
                  <th className="px-5 py-3 font-medium">Method</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium text-right">Amount</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3 text-xs text-slate-600">
                      {new Date(p.paidAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        to={`/invoices/${p.invoice.id}`}
                        className="text-brand-600 hover:underline font-mono text-xs"
                      >
                        {p.invoice.invoiceNo}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {p.invoice.patient.name}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {p.method.replace("_", " ")}
                    </td>
                    <td className="px-5 py-3">
                      <Badge
                        variant={p.type === "REFUND" ? "danger" : "success"}
                        size="sm"
                      >
                        {p.type}
                      </Badge>
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-medium ${p.type === "REFUND" ? "text-red-600" : "text-slate-900"}`}
                    >
                      {p.type === "REFUND" ? "-" : ""}₹
                      {Number(p.amount).toFixed(2)}
                    </td>
                    <td className="px-5 py-3">
                      <Badge
                        variant={statusVariant[p.status] || "default"}
                        size="sm"
                      >
                        {p.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState icon={Receipt} title="No payments yet" />
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
