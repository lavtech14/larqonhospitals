import { useState } from "react";
import {
  IndianRupee,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  Shield,
} from "lucide-react";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { showError } from "../../utils/toast";
import { usePaymentsByInvoice } from "../../hooks/usePayments";

const METHODS = [
  { value: "CASH", label: "Cash", icon: Banknote, color: "text-green-600" },
  { value: "CARD", label: "Card", icon: CreditCard, color: "text-blue-600" },
  { value: "UPI", label: "UPI", icon: Smartphone, color: "text-purple-600" },
  {
    value: "NET_BANKING",
    label: "Net Banking",
    icon: Building2,
    color: "text-indigo-600",
  },
  {
    value: "INSURANCE",
    label: "Insurance",
    icon: Shield,
    color: "text-amber-600",
  },
  {
    value: "OTHER",
    label: "Other",
    icon: IndianRupee,
    color: "text-slate-600",
  },
];

export default function PaymentModal({ open, onClose, onSubmit, invoice }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [transactionRef, setTransactionRef] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: paymentData } = usePaymentsByInvoice(invoice?.id);
  const summary = paymentData?.summary;
  const remaining = summary?.remaining ?? Number(invoice?.total || 0);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) return showError("Enter a valid amount");
    if (amt > remaining + 0.01)
      return showError(`Max payable: ₹${remaining.toFixed(2)}`);

    setBusy(true);
    try {
      await onSubmit({
        invoiceId: invoice.id,
        amount: amt,
        method,
        transactionRef: transactionRef || undefined,
        notes: notes || undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record Payment"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            type="submit"
            form="payment-form"
            loading={busy}
            variant="success"
            icon={IndianRupee}
          >
            Record Payment
          </Button>
        </>
      }
    >
      <form id="payment-form" onSubmit={submit} className="space-y-5">
        {/* Invoice summary */}
        <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Invoice</span>
            <span className="font-mono font-medium">{invoice?.invoiceNo}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Patient</span>
            <span className="font-medium">{invoice?.patient?.name}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <span className="text-slate-500">Total</span>
            <span className="font-medium">
              ₹{Number(invoice?.total || 0).toFixed(2)}
            </span>
          </div>
          {summary && summary.paid > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Already paid</span>
              <span className="font-medium">₹{summary.paid.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-brand-700 font-semibold text-base border-t border-slate-200 pt-2">
            <span>Remaining</span>
            <span>₹{remaining.toFixed(2)}</span>
          </div>
        </div>

        {/* Amount */}
        <div>
          <Input
            label="Amount (₹)"
            type="number"
            step="0.01"
            min="0"
            max={remaining}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => setAmount(remaining.toFixed(2))}
              className="text-xs px-2 py-1 rounded bg-brand-50 text-brand-700 hover:bg-brand-100"
            >
              Full ₹{remaining.toFixed(2)}
            </button>
            <button
              type="button"
              onClick={() => setAmount((remaining / 2).toFixed(2))}
              className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              Half
            </button>
          </div>
        </div>

        {/* Method */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Payment Method
          </label>
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map((m) => {
              const Icon = m.icon;
              const active = method === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                    active
                      ? "border-brand-500 bg-brand-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <Icon size={20} className={m.color} />
                  <span className="text-xs font-medium text-slate-700">
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Transaction ref (only for non-cash) */}
        {method !== "CASH" && (
          <Input
            label="Transaction Reference (optional)"
            value={transactionRef}
            onChange={(e) => setTransactionRef(e.target.value)}
            placeholder="e.g. UPI ID, bank ref, cheque no."
          />
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </form>
    </Modal>
  );
}
