import { useParams, Link } from "react-router-dom";
import { Plus, RotateCcw, Download } from "lucide-react";
import { useState } from "react";
import { useInvoice } from "../../hooks/useInvoices";
import {
  usePaymentsByInvoice,
  useCreatePayment,
  useRefundPayment,
} from "../../hooks/usePayments";
import { useAuth } from "../../hooks/useAuth";
import { showSuccess, showError } from "../../utils/toast";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Avatar from "../../components/ui/Avatar";
import { SkeletonLine } from "../../components/Skeleton";
import PaymentModal from "./PaymentModal";
import { downloadInvoicePdf } from "./invoicePdf";

const statusVariant = {
  PAID: "success",
  UNPAID: "warning",
  PARTIAL: "info",
  REFUNDED: "purple",
};

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: invoice, isLoading, isError } = useInvoice(id);
  const { data: paymentData } = usePaymentsByInvoice(id);
  const createMut = useCreatePayment();
  const refundMut = useRefundPayment();
  const [payOpen, setPayOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        <SkeletonLine className="w-40" />
        <SkeletonLine className="w-64 h-7" />
      </div>
    );
  }
  if (isError) return <div className="p-6 text-red-600">Failed to load</div>;

  const canPay = ["ADMIN", "RECEPTIONIST"].includes(user?.role);
  const canRefund = user?.role === "ADMIN";
  const summary = paymentData?.summary;
  const remaining = summary?.remaining ?? Number(invoice.total);
  const payments = paymentData?.payments || [];

  const handlePayment = async (payload) => {
    try {
      const res = await createMut.mutateAsync(payload);
      showSuccess(
        `Payment of ₹${payload.amount} recorded — invoice is now ${res.invoice.status}`,
      );
      setPayOpen(false);
    } catch (e) {
      showError(e.response?.data?.message || "Payment failed");
      throw e;
    }
  };

  const handleRefund = async (payment) => {
    const amountStr = prompt(
      `Refund amount (max ₹${Number(payment.amount).toFixed(2)})`,
      Number(payment.amount).toFixed(2),
    );
    if (!amountStr) return;
    const amount = Number(amountStr);
    if (!amount || amount <= 0) return showError("Invalid amount");
    try {
      await refundMut.mutateAsync({
        id: payment.id,
        payload: { amount, notes: "Refund processed" },
      });
      showSuccess(`Refund of ₹${amount} issued`);
    } catch (e) {
      showError(e.response?.data?.message || "Refund failed");
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <Link to="/invoices" className="text-brand-600 hover:underline text-sm">
        ← Invoices
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">
              {invoice.invoiceNo}
            </h1>
            <Badge variant={statusVariant[invoice.status] || "default"}>
              {invoice.status}
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {new Date(invoice.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            icon={Download}
            onClick={() => downloadInvoicePdf(invoice)}
          >
            PDF
          </Button>
          {canPay && remaining > 0 && (
            <Button
              icon={Plus}
              variant="success"
              onClick={() => setPayOpen(true)}
            >
              Record Payment
            </Button>
          )}
        </div>
      </div>

      {/* Patient + summary */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 md:col-span-2">
          <div className="flex items-center gap-3">
            <Avatar name={invoice.patient.name} size="lg" />
            <div>
              <p className="font-semibold text-slate-900">
                {invoice.patient.name}
              </p>
              <p className="text-sm text-slate-500">{invoice.patient.phone}</p>
            </div>
          </div>
          {invoice.appointment && (
            <p className="text-sm text-slate-600 mt-4 pt-4 border-t border-slate-100">
              <b>Linked appointment:</b>{" "}
              {new Date(invoice.appointment.date).toLocaleDateString()}{" "}
              {invoice.appointment.slot} with{" "}
              {invoice.appointment.doctor.user.name}
            </p>
          )}
        </div>

        <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-xl p-5 text-white">
          <p className="text-xs text-brand-100 uppercase tracking-wider">
            Balance
          </p>
          <p className="text-3xl font-bold mt-1">₹{remaining.toFixed(2)}</p>
          <div className="mt-4 pt-4 border-t border-white/20 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-brand-100">Total</span>
              <span>₹{Number(invoice.total).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-100">Paid</span>
              <span>₹{(summary?.paid || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b bg-slate-50">
          <h3 className="font-semibold text-slate-900">Items</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Description</th>
              <th className="px-5 py-3 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.items.map((it) => (
              <tr key={it.id}>
                <td className="px-5 py-3">{it.label}</td>
                <td className="px-5 py-3 text-right">
                  ₹{Number(it.amount).toFixed(2)}
                </td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-semibold">
              <td className="px-5 py-3 text-right">Total</td>
              <td className="px-5 py-3 text-right">
                ₹{Number(invoice.total).toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Payments ledger */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b bg-slate-50 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Payment History</h3>
          <span className="text-xs text-slate-500">
            {payments.length} transaction(s)
          </span>
        </div>

        {payments.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            No payments recorded yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Method</th>
                <th className="px-5 py-3 font-medium">Received By</th>
                <th className="px-5 py-3 font-medium text-right">Amount</th>
                <th className="px-5 py-3 font-medium">Status</th>
                {canRefund && <th className="px-5 py-3"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-3 text-xs text-slate-600">
                    {new Date(p.paidAt).toLocaleString()}
                  </td>
                  <td className="px-5 py-3">
                    <Badge
                      variant={p.type === "REFUND" ? "danger" : "success"}
                      size="sm"
                    >
                      {p.type}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-slate-700">
                    {p.method.replace("_", " ")}
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {p.receivedBy?.name || "—"}
                  </td>
                  <td
                    className={`px-5 py-3 text-right font-medium ${p.type === "REFUND" ? "text-red-600" : "text-slate-900"}`}
                  >
                    {p.type === "REFUND" ? "-" : ""}₹
                    {Number(p.amount).toFixed(2)}
                  </td>
                  <td className="px-5 py-3">
                    <Badge
                      variant={
                        p.status === "SUCCESS"
                          ? "success"
                          : p.status === "REFUNDED"
                            ? "purple"
                            : p.status === "PARTIALLY_REFUNDED"
                              ? "info"
                              : "warning"
                      }
                      size="sm"
                    >
                      {p.status}
                    </Badge>
                  </td>
                  {canRefund && (
                    <td className="px-5 py-3 text-right">
                      {p.type === "PAYMENT" && p.status !== "REFUNDED" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={RotateCcw}
                          onClick={() => handleRefund(p)}
                          className="text-red-600 hover:bg-red-50"
                        >
                          Refund
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {invoice.notes && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 text-sm">
          <p className="font-medium mb-1">Notes</p>
          <p className="text-slate-700">{invoice.notes}</p>
        </div>
      )}

      <PaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        onSubmit={handlePayment}
        invoice={invoice}
      />
    </div>
  );
}
