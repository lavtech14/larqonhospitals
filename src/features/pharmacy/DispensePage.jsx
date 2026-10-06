import { useState } from "react";
import { PackageCheck } from "lucide-react";
import {
  usePendingPrescriptions,
  useCreateDispense,
  useMedicines,
} from "../../hooks/usePharmacy";
import { showSuccess, showError } from "../../utils/toast";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Avatar from "../../components/ui/Avatar";
import EmptyState from "../../components/ui/EmptyState";
import { SkeletonTable } from "../../components/Skeleton";
import DispenseModal from "./DispenseModal";

export default function DispensePage() {
  const [selected, setSelected] = useState(null);
  const { data: pending, isLoading } = usePendingPrescriptions();
  const { data: medicinesData } = useMedicines({ limit: 100 });
  const dispenseMut = useCreateDispense();

  const handleDispense = async (payload) => {
    try {
      await dispenseMut.mutateAsync(payload);
      showSuccess("Prescription dispensed");
      setSelected(null);
    } catch (e) {
      showError(e.response?.data?.message || "Failed");
      throw e;
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Dispense Prescriptions
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Fulfill pending doctor prescriptions by dispensing medicines from
          stock.
        </p>
      </div>

      {isLoading && <SkeletonTable rows={5} cols={5} />}

      {pending && pending.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState
            icon={PackageCheck}
            title="No pending prescriptions"
            subtitle="All prescriptions have been dispensed. ✅"
          />
        </div>
      )}

      {pending && pending.length > 0 && (
        <div className="space-y-3">
          {pending.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-xl border border-slate-200 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <Avatar name={p.patient.name} size="lg" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900">
                        {p.patient.name}
                      </h3>
                      <Badge variant="info" size="sm">
                        #{p.id.slice(0, 8)}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                      <span>📞 {p.patient.phone}</span>
                      <span>
                        📅 {new Date(p.appointment.date).toLocaleDateString()}
                      </span>
                      <span>👨‍⚕️ {p.appointment.doctor.user.name}</span>
                    </p>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {p.medicines.map((m) => (
                        <span
                          key={m.id}
                          className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded"
                        >
                          {m.name} · {m.dosage} · {m.duration}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <Button icon={PackageCheck} onClick={() => setSelected(p)}>
                  Dispense
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <DispenseModal
        open={!!selected}
        onClose={() => setSelected(null)}
        onSubmit={handleDispense}
        prescription={selected}
        medicines={medicinesData?.data || []}
      />
    </div>
  );
}
