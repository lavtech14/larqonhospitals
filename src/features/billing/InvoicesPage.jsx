import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useInvoices,
  useCreateInvoice,
  useDeleteInvoice,
} from "../../hooks/useInvoices";
import { useAuth } from "../../hooks/useAuth";
import { showSuccess, showError } from "../../utils/toast";
import { SkeletonTable } from "../../components/Skeleton";
import EmptyState from "../../components/EmptyState";
import InvoiceFormModal from "./InvoiceFormModal";
import PaymentModal from "./PaymentModal";
import { useCreatePayment } from "../../hooks/usePayments";

export default function InvoicesPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading, isError } = useInvoices({ page, limit: 10, status });
  const createMut = useCreateInvoice();

  const deleteMut = useDeleteInvoice();

  const canCreate = ["ADMIN", "RECEPTIONIST"].includes(user?.role);
  const canPay = ["ADMIN", "RECEPTIONIST"].includes(user?.role);
  const canDelete = user?.role === "ADMIN";
  const [payInvoice, setPayInvoice] = useState(null);
  const payMutt = useCreatePayment();

  const handleCreate = async (form) => {
    try {
      await createMut.mutateAsync(form);
      showSuccess("Invoice created");
      setModalOpen(false);
    } catch (e) {
      showError(e.response?.data?.message || "Failed");
    }
  };

  const handlePayment = async (payload) => {
    try {
      const res = await payMutt.mutateAsync(payload);
      showSuccess(`Payment recorded — invoice ${res.invoice.status}`);
      setPayInvoice(null);
    } catch (e) {
      showError(e.response?.data?.message || "Payment failed");
      throw e;
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this invoice?")) return;
    try {
      await deleteMut.mutateAsync(id);
      showSuccess("Invoice deleted");
    } catch (e) {
      showError(e.response?.data?.message || "Failed");
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Invoices</h1>
        {canCreate && (
          <button
            onClick={() => setModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            + New Invoice
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
        <option value="UNPAID">Unpaid</option>
        <option value="PAID">Paid</option>
        <option value="REFUNDED">Refunded</option>
      </select>

      {isLoading && <SkeletonTable rows={6} cols={6} />}
      {isError && <p className="text-red-600">Failed to load</p>}

      {data && (
        <>
          <div className="overflow-x-auto bg-white rounded-xl shadow">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="p-3">Invoice #</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((inv) => (
                  <tr key={inv.id} className="border-t">
                    <td className="p-3 font-mono text-xs">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {inv.invoiceNo}
                      </Link>
                    </td>
                    <td className="p-3">{inv.patient.name}</td>
                    <td className="p-3">₹{Number(inv.total).toFixed(2)}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          inv.status === "PAID"
                            ? "bg-green-100 text-green-800"
                            : inv.status === "REFUNDED"
                              ? "bg-slate-200 text-slate-700"
                              : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-3">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3 space-x-2">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="text-slate-600 hover:underline"
                      >
                        View
                      </Link>
                      {canPay && inv.status === "UNPAID" && (
                        <button onClick={() => setPayInvoice(inv)}>
                          Record Payment
                        </button>
                      )}
                      {canDelete && inv.status !== "PAID" && (
                        <button
                          onClick={() => handleDelete(inv.id)}
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
                    <td colSpan={6}>
                      <EmptyState
                        title="No invoices"
                        subtitle="Create your first invoice."
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

      <InvoiceFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
      />
      <PaymentModal
        open={!!payInvoice}
        onClose={() => setPayInvoice(null)}
        onSubmit={handlePayment}
        invoice={payInvoice}
      />
    </div>
  );
}
