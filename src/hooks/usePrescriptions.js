import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPrescriptions,
  fetchPrescription,
  fetchPrescriptionByAppointment,
  createPrescription,
  updatePrescription,
  deletePrescription,
} from "../api/prescriptions";

export const usePrescriptions = (params) =>
  useQuery({
    queryKey: ["prescriptions", params],
    queryFn: () => fetchPrescriptions(params),
    placeholderData: (prev) => prev,
  });

export const usePrescription = (id) =>
  useQuery({
    queryKey: ["prescription", id],
    queryFn: () => fetchPrescription(id),
    enabled: !!id,
  });

export const usePrescriptionByAppointment = (appointmentId) =>
  useQuery({
    queryKey: ["prescription-by-appt", appointmentId],
    queryFn: () => fetchPrescriptionByAppointment(appointmentId),
    enabled: !!appointmentId,
  });

export const useCreatePrescription = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createPrescription,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prescriptions"] });
      qc.invalidateQueries({ queryKey: ["prescription-by-appt"] });
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["appointment"] });
    },
  });
};

export const useUpdatePrescription = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => updatePrescription(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prescriptions"] });
      qc.invalidateQueries({ queryKey: ["prescription"] });
      qc.invalidateQueries({ queryKey: ["prescription-by-appt"] });
    },
  });
};

export const useDeletePrescription = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deletePrescription,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prescriptions"] }),
  });
};
