import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { useMedicines } from "../../hooks/usePharmacy"; // ← adjust path to where this file lives
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";

const schema = z.object({
  notes: z.string().optional(),
  followUpDate: z.string().optional(),
  medicines: z
    .array(
      z.object({
        name: z.string().min(1, "Medicine required"),
        dosage: z.string().min(1, "Dosage required"),
        duration: z.string().min(1, "Duration required"),
      }),
    )
    .min(1, "Add at least one medicine"),
});

const emptyMed = { name: "", dosage: "", duration: "" };

export default function PrescriptionFormModal({
  open,
  onClose,
  onSubmit,
  appointmentId,
  initial,
}) {
  // Fetch full medicine catalog (limit high enough to cover it)
  const { data: medData, isLoading: loadingMeds } = useMedicines({
    limit: 100,
  });
  const medicines = medData?.data ?? [];

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { notes: "", followUpDate: "", medicines: [emptyMed] },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "medicines",
  });

  useEffect(() => {
    if (initial) {
      reset({
        notes: initial.notes || "",
        followUpDate: initial.followUpDate
          ? initial.followUpDate.slice(0, 10)
          : "",
        medicines: initial.medicines?.length ? initial.medicines : [emptyMed],
      });
    } else {
      reset({ notes: "", followUpDate: "", medicines: [emptyMed] });
    }
  }, [initial, reset]);

  if (!open) return null;

  const submit = (form) => {
    const payload = {
      appointmentId,
      notes: form.notes || undefined,
      followUpDate: form.followUpDate || null,
      medicines: form.medicines,
    };
    onSubmit(payload);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit Prescription" : "Write Prescription"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" form="presc-form" loading={isSubmitting}>
            Save Prescription
          </Button>
        </>
      }
    >
      <form
        id="presc-form"
        onSubmit={handleSubmit(submit)}
        className="space-y-4"
      >
        <div>
          <label className="text-sm font-medium">Medicines</label>
          <div className="space-y-2 mt-2">
            {fields.map((f, i) => {
              const currentName = initial?.medicines?.[i]?.name;
              const notInCatalog =
                currentName && !medicines.some((m) => m.name === currentName);

              return (
                <div key={f.id} className="grid grid-cols-12 gap-2">
                  {/* Medicine dropdown */}
                  <select
                    {...register(`medicines.${i}.name`)}
                    disabled={loadingMeds}
                    className="col-span-5 border rounded px-3 py-2 bg-white"
                  >
                    <option value="">
                      {loadingMeds ? "Loading..." : "Select medicine"}
                    </option>
                    {medicines.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name}
                        {m.genericName ? ` (${m.genericName})` : ""}
                      </option>
                    ))}
                    {/* Preserve legacy/custom value on edit */}
                    {notInCatalog && (
                      <option value={currentName}>{currentName}</option>
                    )}
                  </select>

                  <input
                    {...register(`medicines.${i}.dosage`)}
                    placeholder="Dosage (e.g. 1-0-1)"
                    className="col-span-3 border rounded px-3 py-2"
                  />
                  <input
                    {...register(`medicines.${i}.duration`)}
                    placeholder="Duration (e.g. 5 days)"
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

                  {errors.medicines?.[i]?.name && (
                    <p className="col-span-12 text-red-500 text-xs">
                      {errors.medicines[i].name.message}
                    </p>
                  )}
                  {errors.medicines?.[i]?.dosage && (
                    <p className="col-span-12 text-red-500 text-xs">
                      {errors.medicines[i].dosage.message}
                    </p>
                  )}
                  {errors.medicines?.[i]?.duration && (
                    <p className="col-span-12 text-red-500 text-xs">
                      {errors.medicines[i].duration.message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {errors.medicines?.root?.message && (
            <p className="text-red-500 text-xs mt-1">
              {errors.medicines.root.message}
            </p>
          )}

          <button
            type="button"
            onClick={() => append(emptyMed)}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            + Add medicine
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Follow-up date</label>
            <input
              type="date"
              {...register("followUpDate")}
              className="w-full border rounded px-3 py-2 mt-1"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Notes</label>
          <textarea
            {...register("notes")}
            placeholder="Additional instructions..."
            className="w-full border rounded px-3 py-2 mt-1"
            rows={3}
          />
        </div>
      </form>
    </Modal>
  );
}
