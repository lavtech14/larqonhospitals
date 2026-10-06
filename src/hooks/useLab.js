import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchLabTests,
  fetchLabTest,
  createLabTest,
  updateLabStatus,
  uploadLabResult,
  deleteLabTest,
} from "../api/lab";

export const useLabTests = (params) =>
  useQuery({
    queryKey: ["lab", params],
    queryFn: () => fetchLabTests(params),
    placeholderData: (prev) => prev,
  });

export const useLabTest = (id) =>
  useQuery({
    queryKey: ["lab-test", id],
    queryFn: () => fetchLabTest(id),
    enabled: !!id,
  });

export const useCreateLabTest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createLabTest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lab"] });
      qc.invalidateQueries({ queryKey: ["emr"] });
    },
  });
};

export const useUpdateLabStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => updateLabStatus(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lab"] });
      qc.invalidateQueries({ queryKey: ["lab-test"] });
    },
  });
};

export const useUploadLabResult = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, formData }) => uploadLabResult(id, formData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lab"] });
      qc.invalidateQueries({ queryKey: ["lab-test"] });
      qc.invalidateQueries({ queryKey: ["emr"] });
    },
  });
};

export const useDeleteLabTest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteLabTest,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lab"] }),
  });
};
