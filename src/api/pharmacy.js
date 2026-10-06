import { api } from "./axios";

// Medicines
export const fetchMedicines = async (params) => {
  const { data } = await api.get("/pharmacy/medicines", { params });
  return data;
};
export const fetchMedicine = async (id) => {
  const { data } = await api.get(`/pharmacy/medicines/${id}`);
  return data.data;
};
export const createMedicine = async (payload) => {
  const { data } = await api.post("/pharmacy/medicines", payload);
  return data.data;
};
export const updateMedicine = async (id, payload) => {
  const { data } = await api.put(`/pharmacy/medicines/${id}`, payload);
  return data.data;
};
export const deleteMedicine = async (id) => {
  const { data } = await api.delete(`/pharmacy/medicines/${id}`);
  return data;
};

// Batches
export const addBatch = async (medicineId, payload) => {
  const { data } = await api.post(
    `/pharmacy/medicines/${medicineId}/batches`,
    payload,
  );
  return data.data;
};
export const deleteBatch = async (batchId) => {
  const { data } = await api.delete(`/pharmacy/batches/${batchId}`);
  return data;
};

// Dispenses
export const fetchDispenses = async (params) => {
  const { data } = await api.get("/pharmacy/dispenses", { params });
  return data;
};
export const fetchDispense = async (id) => {
  const { data } = await api.get(`/pharmacy/dispenses/${id}`);
  return data.data;
};
export const createDispense = async (payload) => {
  const { data } = await api.post("/pharmacy/dispenses", payload);
  return data.data;
};
export const fetchPendingPrescriptions = async () => {
  const { data } = await api.get("/pharmacy/pending-prescriptions");
  return data.data;
};

// Alerts + stats
export const fetchPharmacyAlerts = async () => {
  const { data } = await api.get("/pharmacy/alerts");
  return data.data;
};
export const fetchPharmacyStats = async () => {
  const { data } = await api.get("/pharmacy/stats");
  return data.data;
};
