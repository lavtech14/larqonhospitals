import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchNotifications,
  fetchUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
} from "../api/notifications";

export const useNotifications = (params) =>
  useQuery({
    queryKey: ["notifications", params],
    queryFn: () => fetchNotifications(params),
  });

export const useUnreadCount = () =>
  useQuery({
    queryKey: ["notifications-unread"],
    queryFn: fetchUnreadCount,
    refetchInterval: 30_000, // poll every 30s
    refetchIntervalInBackground: false,
  });

export const useMarkAsRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });
};

export const useMarkAllAsRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });
};

export const useDeleteNotification = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });
};

export const useClearAllNotifications = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clearAllNotifications,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });
};
