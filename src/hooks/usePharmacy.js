import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMedicines,
  fetchMedicine,
  createMedicine,
  updateMedicine,
  deleteMedicine,
  addBatch,
  deleteBatch,
  fetchDispenses,
  fetchDispense,
  createDispense,
  fetchPendingPrescriptions,
  fetchPharmacyAlerts,
  fetchPharmacyStats,
} from "../api/pharmacy";

// ─── Medicines
export const useMedicines = (params) =>
  useQuery({
    queryKey: ["medicines", params],
    queryFn: () => fetchMedicines(params),
    placeholderData: (prev) => prev,
  });

export const useMedicine = (id) =>
  useQuery({
    queryKey: ["medicine", id],
    queryFn: () => fetchMedicine(id),
    enabled: !!id,
  });

export const useCreateMedicine = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createMedicine,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medicines"] });
      qc.invalidateQueries({ queryKey: ["pharmacy-alerts"] });
      qc.invalidateQueries({ queryKey: ["pharmacy-stats"] });
    },
  });
};

export const useUpdateMedicine = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => updateMedicine(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medicines"] });
      qc.invalidateQueries({ queryKey: ["medicine"] });
      qc.invalidateQueries({ queryKey: ["pharmacy-alerts"] });
    },
  });
};

export const useDeleteMedicine = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteMedicine,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medicines"] }),
  });
};

// ─── Batches
export const useAddBatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ medicineId, payload }) => addBatch(medicineId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medicines"] });
      qc.invalidateQueries({ queryKey: ["medicine"] });
      qc.invalidateQueries({ queryKey: ["pharmacy-alerts"] });
      qc.invalidateQueries({ queryKey: ["pharmacy-stats"] });
    },
  });
};

export const useDeleteBatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteBatch,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medicines"] });
      qc.invalidateQueries({ queryKey: ["medicine"] });
      qc.invalidateQueries({ queryKey: ["pharmacy-alerts"] });
    },
  });
};

// ─── Dispenses
export const useDispenses = (params) =>
  useQuery({
    queryKey: ["dispenses", params],
    queryFn: () => fetchDispenses(params),
    placeholderData: (prev) => prev,
  });

export const useDispense = (id) =>
  useQuery({
    queryKey: ["dispense", id],
    queryFn: () => fetchDispense(id),
    enabled: !!id,
  });

export const usePendingPrescriptions = () =>
  useQuery({
    queryKey: ["pending-prescriptions"],
    queryFn: fetchPendingPrescriptions,
  });

export const useCreateDispense = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createDispense,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dispenses"] });
      qc.invalidateQueries({ queryKey: ["pending-prescriptions"] });
      qc.invalidateQueries({ queryKey: ["medicines"] });
      qc.invalidateQueries({ queryKey: ["pharmacy-alerts"] });
      qc.invalidateQueries({ queryKey: ["pharmacy-stats"] });
    },
  });
};

// ─── Alerts + Stats
export const usePharmacyAlerts = () =>
  useQuery({ queryKey: ["pharmacy-alerts"], queryFn: fetchPharmacyAlerts });

export const usePharmacyStats = () =>
  useQuery({ queryKey: ["pharmacy-stats"], queryFn: fetchPharmacyStats });
