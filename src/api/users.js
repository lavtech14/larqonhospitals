import { api } from "./axios";

export const fetchUsers = async (params) => {
  const { data } = await api.get("/users", { params });
  return data;
};

export const createStaffUser = async (payload) => {
  const { data } = await api.post("/users", payload);
  return data.data;
};

export const toggleUserActive = async (id) => {
  const { data } = await api.patch(`/users/${id}/toggle-active`);
  return data.data;
};
