import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserPlus, Mail, Lock, Phone } from "lucide-react";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email required"),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[a-z]/, "Must contain lowercase")
    .regex(/[0-9]/, "Must contain a number"),
  phone: z.string().min(7, "Phone required").max(15),
  role: z.enum(["ADMIN", "RECEPTIONIST", "LAB", "PHARMACY"]),
});

export default function StaffFormModal({ open, onClose, onSubmit }) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { role: "RECEPTIONIST" },
  });

  const password = watch("password", "");

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const submit = async (form) => {
    await onSubmit(form);
    reset();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Staff Member"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            type="submit"
            form="staff-form"
            loading={isSubmitting}
            icon={UserPlus}
          >
            Create Staff
          </Button>
        </>
      }
    >
      <form
        id="staff-form"
        onSubmit={handleSubmit(submit)}
        className="space-y-4"
      >
        <Input
          label="Full Name"
          placeholder="e.g. Priya Sharma"
          {...register("name")}
          error={errors.name?.message}
        />

        <Input
          label="Email (login)"
          type="email"
          placeholder="staff@medicare.test"
          icon={Mail}
          {...register("email")}
          error={errors.email?.message}
        />

        <Input
          label="Phone"
          placeholder="+91 98765 43210"
          icon={Phone}
          {...register("phone")}
          error={errors.phone?.message}
        />

        <div>
          <Input
            label="Password"
            type="password"
            placeholder="Min 8 chars"
            icon={Lock}
            {...register("password")}
            error={errors.password?.message}
          />
          <PasswordMeter value={password} />
        </div>

        <Select label="Role" {...register("role")} error={errors.role?.message}>
          <option value="RECEPTIONIST">Receptionist</option>
          <option value="LAB">Lab Technician</option>
          <option value="PHARMACY">Pharmacist</option>
          <option value="ADMIN">Administrator</option>
        </Select>

        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
          <b>Note:</b> The staff member can sign in immediately with the email
          and password above. To add a <b>Doctor</b>, use the Doctors page
          instead (it creates a doctor profile too).
        </div>
      </form>
    </Modal>
  );
}

function PasswordMeter({ value = "" }) {
  const checks = [
    { ok: value.length >= 8, label: "8+ characters" },
    { ok: /[A-Z]/.test(value), label: "Uppercase" },
    { ok: /[a-z]/.test(value), label: "Lowercase" },
    { ok: /[0-9]/.test(value), label: "Number" },
  ];
  const passed = checks.filter((c) => c.ok).length;
  const strength = passed <= 1 ? "weak" : passed <= 3 ? "medium" : "strong";
  const colors = {
    weak: "bg-red-500",
    medium: "bg-amber-500",
    strong: "bg-green-500",
  };

  if (!value) return null;

  return (
    <div className="mt-2">
      <div className="flex gap-1 h-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`flex-1 rounded-full transition-colors ${
              i < passed ? colors[strength] : "bg-slate-200"
            }`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {checks.map((c) => (
          <span
            key={c.label}
            className={`text-[10px] ${c.ok ? "text-green-600" : "text-slate-400"}`}
          >
            {c.ok ? "✓" : "○"} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}
