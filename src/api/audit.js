import { api } from "./axios";

export const fetchAuditLogs = async (params) => {
  const { data } = await api.get("/audit", { params });
  return data;
};
