import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useDoctors } from "../../hooks/useDoctors";
import { usePatients } from "../../hooks/usePatients";
import { useAvailability } from "../../hooks/useAppointments";

const schema = z.object({
  patientId: z.string().uuid("Select a patient"),
  doctorId: z.string().uuid("Select a doctor"),
  date: z.string().min(1, "Pick a date"),
  slot: z.string().min(1, "Pick a slot"),
  notes: z.string().optional(),
});

const SLOTS = (() => {
  const s = [];
  for (let h = 9; h < 17; h++) {
    s.push(`${String(h).padStart(2, "0")}:00`);
    s.push(`${String(h).padStart(2, "0")}:30`);
  }
  return s;
})();

export default function AppointmentFormModal({ open, onClose, onSubmit }) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const doctorId = watch("doctorId");
  const date = watch("date");

  const { data: doctorsData } = useDoctors({ page: 1, limit: 100 });
  const { data: patientsData } = usePatients({ page: 1, limit: 100 });
  const { data: bookedSlots = [] } = useAvailability(doctorId, date);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white rounded-xl p-6 w-full max-w-lg space-y-4"
      >
        <h2 className="text-xl font-bold">Book Appointment</h2>

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
          <p className="text-red-500 text-xs">{errors.patientId.message}</p>
        )}

        <select
          {...register("doctorId")}
          className="w-full border rounded px-3 py-2"
        >
          <option value="">Select doctor</option>
          {doctorsData?.data?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.user.name} — {d.specialization} (₹{Number(d.fees)})
            </option>
          ))}
        </select>
        {errors.doctorId && (
          <p className="text-red-500 text-xs">{errors.doctorId.message}</p>
        )}

        <input
          type="date"
          {...register("date")}
          className="w-full border rounded px-3 py-2"
        />
        {errors.date && (
          <p className="text-red-500 text-xs">{errors.date.message}</p>
        )}

        <select
          {...register("slot")}
          disabled={!doctorId || !date}
          className="w-full border rounded px-3 py-2 disabled:bg-slate-100"
        >
          <option value="">Select slot</option>
          {SLOTS.map((s) => (
            <option key={s} value={s} disabled={bookedSlots.includes(s)}>
              {s} {bookedSlots.includes(s) ? "— booked" : ""}
            </option>
          ))}
        </select>
        {errors.slot && (
          <p className="text-red-500 text-xs">{errors.slot.message}</p>
        )}

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
            {isSubmitting ? "Booking..." : "Book"}
          </button>
        </div>
      </form>
    </div>
  );
}
