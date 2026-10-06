import { useQuery } from "@tanstack/react-query";
import {
  fetchAdminStats,
  fetchDoctorStats,
  fetchPatientStats,
} from "../api/stats";

export const useAdminStats = (range = 7) =>
  useQuery({
    queryKey: ["stats-admin", range],
    queryFn: () => fetchAdminStats(range),
  });

export const useDoctorStats = () =>
  useQuery({ queryKey: ["stats-doctor"], queryFn: fetchDoctorStats });

export const usePatientStats = () =>
  useQuery({ queryKey: ["stats-patient"], queryFn: fetchPatientStats });
