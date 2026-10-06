import { useState } from "react";
import { PackageCheck, AlertTriangle } from "lucide-react";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";

import { useMedicines } from "../../hooks/usePharmacy";
import { showError } from "../../utils/toast";

export default function DispenseModal({
  open,
  onClose,
  onSubmit,
  prescription,
}) {
  const [items, setItems] = useState([{ medicineId: "", quantity: 1 }]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: medicinesData } = useMedicines({ limit: 100 });
  const medicines = medicinesData?.data || [];

  //   useEffect(() => {
  //     if (open) {
  //       // Pre-fill with prescription medicines if they match by name
  //       setItems([{ medicineId: "", quantity: 1 }]);
  //       setNotes("");
  //     }
  //   }, [open]);

  if (!open) return null;

  const addRow = () => setItems([...items, { medicineId: "", quantity: 1 }]);
  const removeRow = (i) => setItems(items.filter((_, idx) => idx !== i));
  const updateRow = (i, field, value) =>
    setItems(
      items.map((item, idx) =>
        idx === i ? { ...item, [field]: value } : item,
      ),
    );

  const submit = async (e) => {
    e.preventDefault();
    const validItems = items.filter((i) => i.medicineId && i.quantity > 0);
    if (!validItems.length) return showError("Add at least one medicine");

    setBusy(true);
    try {
      await onSubmit({
        prescriptionId: prescription.id,
        items: validItems,
        notes,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Dispense Medicines"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            type="submit"
            form="dispense-form"
            loading={busy}
            icon={PackageCheck}
          >
            Confirm Dispense
          </Button>
        </>
      }
    >
      <form id="dispense-form" onSubmit={submit} className="space-y-5">
        {/* Patient info */}
        <div className="bg-slate-50 rounded-lg p-3 text-sm">
          <p>
            <b>Patient:</b> {prescription.patient.name} ·{" "}
            {prescription.patient.phone}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            <b>Prescribed:</b>{" "}
            {prescription.medicines.map((m) => m.name).join(", ")}
          </p>
        </div>

        {/* Items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-700">
              Medicines to dispense
            </label>
            <button
              type="button"
              onClick={addRow}
              className="text-sm text-brand-600 hover:underline"
            >
              + Add row
            </button>
          </div>

          <div className="space-y-2">
            {items.map((item, i) => {
              const selected = medicines.find((m) => m.id === item.medicineId);
              const lowStock = selected && selected.totalStock < item.quantity;
              return (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-7">
                    <select
                      value={item.medicineId}
                      onChange={(e) =>
                        updateRow(i, "medicineId", e.target.value)
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Select medicine</option>
                      {medicines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} — ₹{Number(m.price).toFixed(2)} (stock:{" "}
                          {m.totalStock})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        updateRow(i, "quantity", Number(e.target.value))
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder="Qty"
                    />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      disabled={items.length === 1}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </div>
                  {lowStock && (
                    <div className="col-span-12 flex items-center gap-1.5 text-xs text-amber-600 -mt-1">
                      <AlertTriangle size={12} />
                      Only {selected.totalStock} in stock
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

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
