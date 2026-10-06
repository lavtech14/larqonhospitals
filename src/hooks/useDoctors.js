import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchDoctors,
  fetchSpecializations,
  fetchDoctor,
  createDoctor,
  updateDoctor,
  deleteDoctor,
} from "../api/doctors";

export const useDoctors = (params) =>
  useQuery({
    queryKey: ["doctors", params],
    queryFn: () => fetchDoctors(params),
    placeholderData: (prev) => prev,
  });

export const useSpecializations = () =>
  useQuery({
    queryKey: ["specializations"],
    queryFn: fetchSpecializations,
    staleTime: 5 * 60 * 1000,
  });

export const useDoctor = (id) =>
  useQuery({
    queryKey: ["doctor", id],
    queryFn: () => fetchDoctor(id),
    enabled: !!id,
  });

export const useCreateDoctor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createDoctor,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctors"] });
      qc.invalidateQueries({ queryKey: ["specializations"] });
    },
  });
};

export const useUpdateDoctor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => updateDoctor(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctors"] });
      qc.invalidateQueries({ queryKey: ["doctor"] });
      qc.invalidateQueries({ queryKey: ["specializations"] });
    },
  });
};

export const useDeleteDoctor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteDoctor,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["doctors"] }),
  });
};
