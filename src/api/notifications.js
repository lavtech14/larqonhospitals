import { api } from "./axios";

export const fetchNotifications = async (params) => {
  const { data } = await api.get("/notifications", { params });
  return data;
};

export const fetchUnreadCount = async () => {
  const { data } = await api.get("/notifications/unread-count");
  return data.data.count;
};

export const markAsRead = async (id) => {
  const { data } = await api.patch(`/notifications/${id}/read`);
  return data.data;
};

export const markAllAsRead = async () => {
  const { data } = await api.patch("/notifications/read-all");
  return data.data;
};

export const deleteNotification = async (id) => {
  const { data } = await api.delete(`/notifications/${id}`);
  return data;
};

export const clearAllNotifications = async () => {
  const { data } = await api.delete("/notifications/clear-all");
  return data.data;
};
