import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState } from "react";
import { UserPlus, Mail, Lock, Phone } from "lucide-react";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  specialization: z.string().min(2),
  fees: z.coerce.number().nonnegative(),
  bio: z.string().optional(),
});

const updateSchema = createSchema.extend({
  email: z.string().email().optional(),
  password: z.string().optional(),
});

export default function DoctorFormModal({ open, onClose, onSubmit, initial }) {
  const isEdit = !!initial;
  const schema = isEdit ? updateSchema : createSchema;

  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const password = watch("password", "");

  useEffect(() => {
    if (initial) {
      reset({
        name: initial.user?.name || "",
        email: initial.user?.email || "",
        password: "",
        phone: initial.user?.phone || "",
        specialization: initial.specialization || "",
        fees: initial.fees ?? 0,
        bio: initial.bio || "",
      });
    } else {
      reset({
        name: "",
        email: "",
        password: "",
        phone: "",
        specialization: "",
        fees: 0,
        bio: "",
      });
    }
  }, [initial, reset]);

  // Hide password whenever the modal closes
  useEffect(() => {
    if (!open) setShowPassword(false);
  }, [open]);

  if (!open) return null;

  const submit = (form) => {
    // Remove empty password/email on edit so backend doesn't choke
    const payload = { ...form };
    if (isEdit) {
      if (!payload.password) delete payload.password;
      delete payload.email; // email not editable for now
    }
    onSubmit(payload);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Doctor" : "Add Doctor"}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            type="submit"
            form="doctor-form"
            loading={isSubmitting}
            icon={UserPlus}
          >
            Save
          </Button>
        </>
      }
    >
      <form
        id="doctor-form"
        onSubmit={handleSubmit(submit)}
        className="space-y-4"
      >
        <Input
          label="Full Name"
          placeholder="Full name"
          {...register("name")}
          error={errors.name?.message}
        />

        <Input
          label="Email (login)"
          type="email"
          placeholder="Email (login)"
          icon={Mail}
          disabled={isEdit}
          {...register("email")}
          error={errors.email?.message}
        />

        {!isEdit && (
          <div>
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                placeholder="Password (min 6)"
                icon={Lock}
                {...register("password")}
                error={errors.password?.message}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-[38px] text-slate-500 hover:text-slate-700"
              >
                {showPassword ? (
                  // Eye-off icon
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </svg>
                ) : (
                  // Eye icon
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            <PasswordMeter value={password} />
          </div>
        )}

        <Input
          label="Phone"
          placeholder="Phone"
          icon={Phone}
          {...register("phone")}
          error={errors.phone?.message}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Specialization"
            placeholder="Specialization (e.g. Cardiology)"
            {...register("specialization")}
            error={errors.specialization?.message}
          />

          <Input
            label="Consultation Fees"
            type="number"
            step="0.01"
            placeholder="Consultation fees"
            {...register("fees")}
            error={errors.fees?.message}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">
            Short Bio
          </label>
          <textarea
            {...register("bio")}
            rows={3}
            placeholder="Short bio"
            className="w-full border rounded-lg px-4 py-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.bio && (
            <p className="text-red-500 text-xs mt-1">{errors.bio.message}</p>
          )}
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
            className={`text-[10px] ${
              c.ok ? "text-green-600" : "text-slate-400"
            }`}
          >
            {c.ok ? "✓" : "○"} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}
