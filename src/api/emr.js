import { api } from "./axios";

export const fetchPatientEMR = async (patientId) => {
  const { data } = await api.get(`/emr/patient/${patientId}`);
  return data.data;
};

export const uploadAttachment = async (patientId, formData) => {
  const { data } = await api.post(
    `/emr/patient/${patientId}/attachments`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data.data;
};

export const deleteAttachment = async (id) => {
  const { data } = await api.delete(`/emr/attachments/${id}`);
  return data;
};
