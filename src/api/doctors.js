import { api } from "./axios";

export const fetchDoctors = async ({
  page = 1,
  limit = 10,
  search = "",
  specialization = "",
}) => {
  const { data } = await api.get("/doctors", {
    params: { page, limit, search, specialization },
  });
  return data;
};

export const fetchSpecializations = async () => {
  const { data } = await api.get("/doctors/specializations");
  return data.data;
};

export const fetchDoctor = async (id) => {
  const { data } = await api.get(`/doctors/${id}`);
  return data.data;
};

export const createDoctor = async (payload) => {
  const { data } = await api.post("/doctors", payload);
  return data.data;
};

export const updateDoctor = async (id, payload) => {
  const { data } = await api.put(`/doctors/${id}`, payload);
  return data.data;
};

export const deleteDoctor = async (id) => {
  const { data } = await api.delete(`/doctors/${id}`);
  return data;
};
