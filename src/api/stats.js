import { api } from "./axios";

export const fetchAdminStats = async (range = 7) => {
  const { data } = await api.get("/stats/admin", { params: { range } });
  return data.data;
};

export const fetchDoctorStats = async () => {
  const { data } = await api.get("/stats/doctor");
  return data.data;
};

export const fetchPatientStats = async () => {
  const { data } = await api.get("/stats/patient");
  return data.data;
};
