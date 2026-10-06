import { api } from "./axios";

export const fetchPatients = async ({ page = 1, limit = 10, search = "" }) => {
  const { data } = await api.get("/patients", {
    params: { page, limit, search },
  });
  return data;
};

export const fetchPatient = async (id) => {
  const { data } = await api.get(`/patients/${id}`);
  return data.data;
};

export const createPatient = async (payload) => {
  const { data } = await api.post("/patients", payload);
  return data.data;
};

export const updatePatient = async (id, payload) => {
  const { data } = await api.put(`/patients/${id}`, payload);
  return data.data;
};

export const deletePatient = async (id) => {
  const { data } = await api.delete(`/patients/${id}`);
  return data;
};
