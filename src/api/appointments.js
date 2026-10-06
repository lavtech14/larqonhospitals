import { api } from "./axios";

export const fetchAppointments = async (params) => {
  const { data } = await api.get("/appointments", { params });
  return data;
};

export const fetchAppointment = async (id) => {
  const { data } = await api.get(`/appointments/${id}`);
  return data.data;
};

export const fetchAvailability = async (doctorId, date) => {
  const { data } = await api.get("/appointments/availability", {
    params: { doctorId, date },
  });
  return data.data.bookedSlots;
};

export const createAppointment = async (payload) => {
  const { data } = await api.post("/appointments", payload);
  return data.data;
};

export const updateAppointmentStatus = async (id, payload) => {
  const { data } = await api.patch(`/appointments/${id}/status`, payload);
  return data.data;
};

export const deleteAppointment = async (id) => {
  const { data } = await api.delete(`/appointments/${id}`);
  return data;
};
