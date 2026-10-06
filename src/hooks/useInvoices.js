import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchInvoices,
  fetchInvoice,
  fetchInvoiceByAppointment,
  createInvoice,
  updateInvoice,
  payInvoice,
  deleteInvoice,
} from "../api/invoices";

export const useInvoices = (params) =>
  useQuery({
    queryKey: ["invoices", params],
    queryFn: () => fetchInvoices(params),
    placeholderData: (prev) => prev,
  });

export const useInvoice = (id) =>
  useQuery({
    queryKey: ["invoice", id],
    queryFn: () => fetchInvoice(id),
    enabled: !!id,
  });

export const useInvoiceByAppointment = (appointmentId) =>
  useQuery({
    queryKey: ["invoice-by-appt", appointmentId],
    queryFn: () => fetchInvoiceByAppointment(appointmentId),
    enabled: !!appointmentId,
  });

export const useCreateInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createInvoice,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice-by-appt"] });
      qc.invalidateQueries({ queryKey: ["emr"] });
    },
  });
};

export const useUpdateInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => updateInvoice(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice"] });
    },
  });
};

export const usePayInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => payInvoice(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice"] });
      qc.invalidateQueries({ queryKey: ["invoice-by-appt"] });
    },
  });
};

export const useDeleteInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteInvoice,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
};
