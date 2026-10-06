import { api } from "./axios";

export const fetchLabTests = async (params) => {
  const { data } = await api.get("/lab", { params });
  return data;
};

export const fetchLabTest = async (id) => {
  const { data } = await api.get(`/lab/${id}`);
  return data.data;
};

export const createLabTest = async (payload) => {
  const { data } = await api.post("/lab", payload);
  return data.data;
};

export const updateLabStatus = async (id, payload) => {
  const { data } = await api.patch(`/lab/${id}/status`, payload);
  return data.data;
};

export const uploadLabResult = async (id, formData) => {
  const { data } = await api.post(`/lab/${id}/result`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data;
};

export const deleteLabTest = async (id) => {
  const { data } = await api.delete(`/lab/${id}`);
  return data;
};
