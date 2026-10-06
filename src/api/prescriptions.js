import { api } from "./axios";

export const fetchPrescriptions = async (params) => {
  const { data } = await api.get("/prescriptions", { params });
  return data;
};

export const fetchPrescription = async (id) => {
  const { data } = await api.get(`/prescriptions/${id}`);
  return data.data;
};

export const fetchPrescriptionByAppointment = async (appointmentId) => {
  const { data } = await api.get(
    `/prescriptions/by-appointment/${appointmentId}`,
  );
  return data.data;
};

export const createPrescription = async (payload) => {
  const { data } = await api.post("/prescriptions", payload);
  return data.data;
};

export const updatePrescription = async (id, payload) => {
  const { data } = await api.put(`/prescriptions/${id}`, payload);
  return data.data;
};

export const deletePrescription = async (id) => {
  const { data } = await api.delete(`/prescriptions/${id}`);
  return data;
};
