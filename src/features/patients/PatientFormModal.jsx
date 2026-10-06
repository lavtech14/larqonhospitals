import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  dob: z.string().min(1, "DOB required"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  bloodGroup: z.string().optional(),
  phone: z.string().min(7, "Phone required"),
  address: z.string().optional(),
});

export default function PatientFormModal({ open, onClose, onSubmit, initial }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (initial) {
      reset({
        ...initial,
        dob: initial.dob ? initial.dob.slice(0, 10) : "",
      });
    } else {
      reset({
        name: "",
        dob: "",
        gender: "MALE",
        bloodGroup: "",
        phone: "",
        address: "",
      });
    }
  }, [initial, reset]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white rounded-xl p-6 w-full max-w-lg space-y-4"
      >
        <h2 className="text-xl font-bold">
          {initial ? "Edit Patient" : "Add Patient"}
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <input
              {...register("name")}
              placeholder="Full name"
              className="w-full border rounded px-3 py-2"
            />
            {errors.name && (
              <p className="text-red-500 text-xs">{errors.name.message}</p>
            )}
          </div>

          <input
            type="date"
            {...register("dob")}
            className="border rounded px-3 py-2"
          />
          <select {...register("gender")} className="border rounded px-3 py-2">
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>

          <select
            {...register("bloodGroup")}
            className="border rounded px-3 py-2"
          >
            <option value="">Blood group</option>
            {[
              "A_POS",
              "A_NEG",
              "B_POS",
              "B_NEG",
              "AB_POS",
              "AB_NEG",
              "O_POS",
              "O_NEG",
            ].map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <input
            {...register("phone")}
            placeholder="Phone"
            className="border rounded px-3 py-2"
          />

          <textarea
            {...register("address")}
            placeholder="Address"
            className="col-span-2 border rounded px-3 py-2"
            rows={2}
          />
        </div>

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
            {isSubmitting ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
