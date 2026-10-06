import { api } from "./axios";

export const fetchPayments = async (params) => {
  const { data } = await api.get("/payments", { params });
  return data;
};

export const fetchPayment = async (id) => {
  const { data } = await api.get(`/payments/${id}`);
  return data.data;
};

export const fetchPaymentsByInvoice = async (invoiceId) => {
  const { data } = await api.get(`/payments/by-invoice/${invoiceId}`);
  return data.data;
};

export const createPayment = async (payload) => {
  const { data } = await api.post("/payments", payload);
  return data.data;
};

export const refundPayment = async (id, payload) => {
  const { data } = await api.post(`/payments/${id}/refund`, payload);
  return data.data;
};

export const fetchPaymentStats = async (range = 7) => {
  const { data } = await api.get("/payments/stats", { params: { range } });
  return data.data;
};
