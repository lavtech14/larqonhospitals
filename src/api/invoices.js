import { api } from "./axios";

export const fetchInvoices = async (params) => {
  const { data } = await api.get("/invoices", { params });
  return data;
};

export const fetchInvoice = async (id) => {
  const { data } = await api.get(`/invoices/${id}`);
  return data.data;
};

export const fetchInvoiceByAppointment = async (appointmentId) => {
  const { data } = await api.get(`/invoices/by-appointment/${appointmentId}`);
  return data.data;
};

export const createInvoice = async (payload) => {
  const { data } = await api.post("/invoices", payload);
  return data.data;
};

export const updateInvoice = async (id, payload) => {
  const { data } = await api.put(`/invoices/${id}`, payload);
  return data.data;
};

export const payInvoice = async (id, payload) => {
  const { data } = await api.patch(`/invoices/${id}/pay`, payload);
  return data.data;
};

export const deleteInvoice = async (id) => {
  const { data } = await api.delete(`/invoices/${id}`);
  return data;
};
