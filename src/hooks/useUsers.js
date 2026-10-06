import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchUsers, createStaffUser, toggleUserActive } from "../api/users";

export const useUsers = (params) =>
  useQuery({
    queryKey: ["users", params],
    queryFn: () => fetchUsers(params),
    placeholderData: (prev) => prev,
  });

export const useCreateStaff = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createStaffUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
};

export const useToggleUserActive = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: toggleUserActive,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
};
