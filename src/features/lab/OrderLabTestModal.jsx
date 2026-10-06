import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { usePatients } from "../../hooks/usePatients";

const schema = z.object({
  patientId: z.string().uuid("Select a patient"),
  testName: z.string().min(2, "Test name required"),
  testType: z.enum(["LAB", "IMAGING", "PATHOLOGY"]),
  notes: z.string().optional(),
});

const COMMON_TESTS = [
  "Complete Blood Count (CBC)",
  "Blood Sugar (Fasting)",
  "Lipid Profile",
  "Liver Function Test",
  "Kidney Function Test",
  "Urine Analysis",
  "X-Ray Chest",
  "MRI Brain",
  "CT Scan Abdomen",
  "ECG",
  "Thyroid Profile",
];

export default function OrderLabTestModal({
  open,
  onClose,
  onSubmit,
  fixedPatientId,
  fixedAppointmentId,
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const { data: patientsData } = usePatients({ page: 1, limit: 100 });

  useEffect(() => {
    if (open) {
      reset({
        patientId: fixedPatientId || "",
        testName: "",
        testType: "LAB",
        notes: "",
      });
    }
  }, [open, fixedPatientId, reset]);

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
        className="bg-white rounded-xl p-6 w-full max-w-lg space-y-4"
      >
        <h2 className="text-xl font-bold">Order Lab Test</h2>

        {!fixedPatientId && (
          <div>
            <select
              {...register("patientId")}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Select patient</option>
              {patientsData?.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.phone}
                </option>
              ))}
            </select>
            {errors.patientId && (
              <p className="text-red-500 text-xs mt-1">
                {errors.patientId.message}
              </p>
            )}
          </div>
        )}

        <div>
          <input
            list="common-tests"
            {...register("testName")}
            placeholder="Test name (e.g. Complete Blood Count)"
            className="w-full border rounded px-3 py-2"
          />
          <datalist id="common-tests">
            {COMMON_TESTS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          {errors.testName && (
            <p className="text-red-500 text-xs mt-1">
              {errors.testName.message}
            </p>
          )}
        </div>

        <select
          {...register("testType")}
          className="w-full border rounded px-3 py-2"
        >
          <option value="LAB">Lab</option>
          <option value="IMAGING">Imaging</option>
          <option value="PATHOLOGY">Pathology</option>
        </select>

        <textarea
          {...register("notes")}
          placeholder="Clinical notes (optional)"
          className="w-full border rounded px-3 py-2"
          rows={3}
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
            {isSubmitting ? "Ordering..." : "Order Test"}
          </button>
        </div>
      </form>
    </div>
  );
}
