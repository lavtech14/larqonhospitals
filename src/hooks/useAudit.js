import { useQuery } from "@tanstack/react-query";
import { fetchAuditLogs } from "../api/audit";

export const useAuditLogs = (params) =>
  useQuery({
    queryKey: ["audit", params],
    queryFn: () => fetchAuditLogs(params),
    placeholderData: (prev) => prev,
  });
