import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPatientEMR,
  uploadAttachment,
  deleteAttachment,
} from "../api/emr";

export const usePatientEMR = (patientId) =>
  useQuery({
    queryKey: ["emr", patientId],
    queryFn: () => fetchPatientEMR(patientId),
    enabled: !!patientId,
  });

export const useUploadAttachment = (patientId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData) => uploadAttachment(patientId, formData),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["emr", patientId] }),
  });
};

export const useDeleteAttachment = (patientId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteAttachment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["emr", patientId] }),
  });
};
