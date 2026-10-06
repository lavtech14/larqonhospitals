import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PackagePlus } from "lucide-react";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";

const schema = z.object({
  batchNo: z.string().min(1, "Batch number required"),
  quantity: z.coerce.number().int().positive("Must be > 0"),
  expiryDate: z.string().min(1, "Expiry date required"),
  supplier: z.string().optional(),
});

export default function AddStockModal({ open, onClose, onSubmit, medicine }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Add Stock — ${medicine?.name || ""}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            type="submit"
            form="stock-form"
            loading={isSubmitting}
            icon={PackagePlus}
          >
            Add Stock
          </Button>
        </>
      }
    >
      <form
        id="stock-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
      >
        <Input
          label="Batch Number"
          {...register("batchNo")}
          error={errors.batchNo?.message}
          placeholder="e.g. BATCH-A001"
        />
        <Input
          label="Quantity"
          type="number"
          {...register("quantity")}
          error={errors.quantity?.message}
        />
        <Input
          label="Expiry Date"
          type="date"
          {...register("expiryDate")}
          error={errors.expiryDate?.message}
        />
        <Input label="Supplier (optional)" {...register("supplier")} />
      </form>
    </Modal>
  );
}
