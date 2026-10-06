import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPatients,
  createPatient,
  updatePatient,
  deletePatient,
} from "../api/patients";

export const usePatients = (params) =>
  useQuery({
    queryKey: ["patients", params],
    queryFn: () => fetchPatients(params),
    keepPreviousData: true,
  });

export const useCreatePatient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createPatient,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patients"] }),
  });
};

export const useUpdatePatient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => updatePatient(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patients"] }),
  });
};

export const useDeletePatient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deletePatient,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patients"] }),
  });
};
