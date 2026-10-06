import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pill } from "lucide-react";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";

const schema = z.object({
  name: z.string().min(2, "Name required"),
  genericName: z.string().optional(),
  category: z.enum([
    "TABLET",
    "CAPSULE",
    "SYRUP",
    "INJECTION",
    "OINTMENT",
    "DROPS",
    "INHALER",
    "OTHER",
  ]),
  manufacturer: z.string().optional(),
  unit: z.string().min(1, "Unit required"),
  price: z.coerce.number().nonnegative("Must be ≥ 0"),
  reorderLevel: z.coerce.number().int().nonnegative(),
  description: z.string().optional(),
});

export default function MedicineFormModal({
  open,
  onClose,
  onSubmit,
  initial,
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      category: "TABLET",
      unit: "strip",
      price: 0,
      reorderLevel: 20,
    },
  });

  useEffect(() => {
    if (open) {
      if (initial) {
        reset({
          name: initial.name || "",
          genericName: initial.genericName || "",
          category: initial.category || "TABLET",
          manufacturer: initial.manufacturer || "",
          unit: initial.unit || "strip",
          price: initial.price ?? 0,
          reorderLevel: initial.reorderLevel ?? 20,
          description: initial.description || "",
        });
      } else {
        reset({
          name: "",
          genericName: "",
          category: "TABLET",
          manufacturer: "",
          unit: "strip",
          price: 0,
          reorderLevel: 20,
          description: "",
        });
      }
    }
  }, [open, initial, reset]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit Medicine" : "Add Medicine"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            type="submit"
            form="medicine-form"
            loading={isSubmitting}
            icon={Pill}
          >
            {initial ? "Save Changes" : "Add Medicine"}
          </Button>
        </>
      }
    >
      <form
        id="medicine-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Brand Name"
            {...register("name")}
            error={errors.name?.message}
          />
          <Input label="Generic Name" {...register("genericName")} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Select label="Category" {...register("category")}>
            {[
              "TABLET",
              "CAPSULE",
              "SYRUP",
              "INJECTION",
              "OINTMENT",
              "DROPS",
              "INHALER",
              "OTHER",
            ].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Input
            label="Unit"
            {...register("unit")}
            placeholder="strip / bottle / vial"
          />
          <Input label="Manufacturer" {...register("manufacturer")} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Price (₹)"
            type="number"
            step="0.01"
            {...register("price")}
            error={errors.price?.message}
          />
          <Input
            label="Reorder Level"
            type="number"
            {...register("reorderLevel")}
            hint="Alert when stock falls below this"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Description (optional)
          </label>
          <textarea
            {...register("description")}
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </form>
    </Modal>
  );
}
