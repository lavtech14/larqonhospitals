import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAppointments,
  fetchAppointment,
  fetchAvailability,
  createAppointment,
  updateAppointmentStatus,
  deleteAppointment,
} from "../api/appointments";

export const useAppointments = (params) =>
  useQuery({
    queryKey: ["appointments", params],
    queryFn: () => fetchAppointments(params),
    placeholderData: (prev) => prev,
  });

export const useAppointment = (id) =>
  useQuery({
    queryKey: ["appointment", id],
    queryFn: () => fetchAppointment(id),
    enabled: !!id,
  });

export const useAvailability = (doctorId, date) =>
  useQuery({
    queryKey: ["availability", doctorId, date],
    queryFn: () => fetchAvailability(doctorId, date),
    enabled: !!doctorId && !!date,
  });

export const useCreateAppointment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAppointment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["availability"] });
    },
  });
};

export const useUpdateAppointmentStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => updateAppointmentStatus(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["appointment"] });
    },
  });
};

export const useDeleteAppointment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteAppointment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });
};
