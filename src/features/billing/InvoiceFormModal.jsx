import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { usePatients } from "../../hooks/usePatients";

const schema = z.object({
  patientId: z.string().uuid("Select a patient"),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        label: z.string().min(1, "Required"),
        amount: z.coerce.number().nonnegative(),
      }),
    )
    .min(1, "Add at least one item"),
});

const emptyItem = { label: "", amount: 0 };

export default function InvoiceFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  fixedPatientId,
  fixedAppointmentId,
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { patientId: "", notes: "", items: [emptyItem] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = watch("items");
  const total = items?.reduce((s, i) => s + (Number(i.amount) || 0), 0) || 0;

  const { data: patientsData } = usePatients({ page: 1, limit: 100 });

  useEffect(() => {
    if (open) {
      if (initial) {
        reset({
          patientId: initial.patientId,
          notes: initial.notes || "",
          items: initial.items?.length ? initial.items : [emptyItem],
        });
      } else {
        reset({
          patientId: fixedPatientId || "",
          notes: "",
          items: [emptyItem],
        });
      }
    }
  }, [open, initial, fixedPatientId, reset]);

  if (!open) return null;

  const submit = (form) => {
    onSubmit({
      ...form,
      ...(fixedAppointmentId && { appointmentId: fixedAppointmentId }),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <form
        onSubmit={handleSubmit(submit)}
        className="bg-white rounded-xl p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-xl font-bold">
          {initial ? "Edit Invoice" : "Create Invoice"}
        </h2>

        {!fixedPatientId && (
          <div>
            <label className="text-sm font-medium">Patient</label>
            <select
              {...register("patientId")}
              className="w-full border rounded px-3 py-2 mt-1"
            >
              <option value="">Select patient</option>
              {patientsData?.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.phone}
                </option>
              ))}
            </select>
            {errors.patientId && (
              <p className="text-red-500 text-xs">{errors.patientId.message}</p>
            )}
          </div>
        )}

        <div>
          <label className="text-sm font-medium">Items</label>
          <div className="space-y-2 mt-2">
            {fields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-12 gap-2">
                <input
                  {...register(`items.${i}.label`)}
                  placeholder="Service / item"
                  className="col-span-8 border rounded px-3 py-2"
                />
                <input
                  type="number"
                  step="0.01"
                  {...register(`items.${i}.amount`)}
                  placeholder="Amount"
                  className="col-span-3 border rounded px-3 py-2"
                />
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={fields.length === 1}
                  className="col-span-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-30"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {errors.items && (
            <p className="text-red-500 text-xs mt-1">
              {errors.items.message || errors.items.root?.message}
            </p>
          )}
          <button
            type="button"
            onClick={() => append(emptyItem)}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            + Add item
          </button>
        </div>

        <div className="bg-slate-50 rounded p-3 flex justify-between font-medium">
          <span>Total</span>
          <span>₹{total.toFixed(2)}</span>
        </div>

        <textarea
          {...register("notes")}
          placeholder="Notes (optional)"
          className="w-full border rounded px-3 py-2"
          rows={2}
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded border"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Save Invoice"}
          </button>
        </div>
      </form>
    </div>
  );
}
