import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPayments,
  fetchPayment,
  fetchPaymentsByInvoice,
  createPayment,
  refundPayment,
  fetchPaymentStats,
} from "../api/payments";

export const usePayments = (params) =>
  useQuery({
    queryKey: ["payments", params],
    queryFn: () => fetchPayments(params),
    placeholderData: (prev) => prev,
  });

export const usePayment = (id) =>
  useQuery({
    queryKey: ["payment", id],
    queryFn: () => fetchPayment(id),
    enabled: !!id,
  });

export const usePaymentsByInvoice = (invoiceId) =>
  useQuery({
    queryKey: ["payments-by-invoice", invoiceId],
    queryFn: () => fetchPaymentsByInvoice(invoiceId),
    enabled: !!invoiceId,
  });

export const useCreatePayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createPayment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["payments-by-invoice"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice"] });
      qc.invalidateQueries({ queryKey: ["payment-stats"] });
      qc.invalidateQueries({ queryKey: ["stats-admin"] });
    },
  });
};

export const useRefundPayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => refundPayment(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["payments-by-invoice"] });
      qc.invalidateQueries({ queryKey: ["payment"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["payment-stats"] });
    },
  });
};

export const usePaymentStats = (range = 7) =>
  useQuery({
    queryKey: ["payment-stats", range],
    queryFn: () => fetchPaymentStats(range),
  });
