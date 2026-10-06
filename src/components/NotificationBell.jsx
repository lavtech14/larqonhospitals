import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  Trash2,
  Calendar,
  FlaskConical,
  Pill,
  Receipt,
  AlertTriangle,
  Info,
  Check,
} from "lucide-react";
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
} from "../hooks/useNotifications";

import { showSuccess, showError } from "../utils/toast";

const TYPE_ICON = {
  APPOINTMENT_BOOKED: { icon: Calendar, color: "text-blue-600 bg-blue-50" },
  APPOINTMENT_CONFIRMED: { icon: Check, color: "text-blue-600 bg-blue-50" },
  APPOINTMENT_CANCELLED: { icon: Calendar, color: "text-red-600 bg-red-50" },
  APPOINTMENT_REMINDER: { icon: Calendar, color: "text-amber-600 bg-amber-50" },
  PRESCRIPTION_READY: { icon: Pill, color: "text-purple-600 bg-purple-50" },
  LAB_RESULT_READY: { icon: FlaskConical, color: "text-green-600 bg-green-50" },
  LAB_ORDERED: { icon: FlaskConical, color: "text-cyan-600 bg-cyan-50" },
  INVOICE_CREATED: { icon: Receipt, color: "text-indigo-600 bg-indigo-50" },
  PAYMENT_RECEIVED: { icon: Receipt, color: "text-emerald-600 bg-emerald-50" },
  LOW_STOCK: { icon: AlertTriangle, color: "text-amber-600 bg-amber-50" },
  EXPIRY_WARNING: { icon: AlertTriangle, color: "text-rose-600 bg-rose-50" },
  SYSTEM: { icon: Info, color: "text-slate-600 bg-slate-100" },
};

const timeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return "just now";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
};

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const { data: unreadData } = useUnreadCount();
  const { data, isLoading } = useNotifications({ limit: 15 });
  const markRead = useMarkAsRead();
  const markAllRead = useMarkAllAsRead();
  const deleteMut = useDeleteNotification();

  const unreadCount = unreadData?.count || 0;
  const notifications = data?.data || [];

  // Close when clicking outside
  useEffect(() => {
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const handleClick = async (n) => {
    if (!n.isRead) await markRead.mutateAsync(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  const handleMarkAll = async (e) => {
    e.stopPropagation();
    try {
      const res = await markAllRead.mutateAsync();
      showSuccess(`Marked ${res.updated} as read`);
    } catch {
      showError("Failed to mark all");
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    try {
      await deleteMut.mutateAsync(id);
    } catch {
      showError("Failed to delete");
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-fade-in-up">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-medium">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
              >
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading && (
              <div className="p-6 text-center text-sm text-slate-400">
                Loading...
              </div>
            )}

            {!isLoading && notifications.length === 0 && (
              <div className="p-10 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Bell size={20} className="text-slate-400" />
                </div>
                <p className="text-sm text-slate-500">No notifications yet</p>
              </div>
            )}

            {notifications.map((n) => {
              const meta = TYPE_ICON[n.type] || TYPE_ICON.SYSTEM;
              const Icon = meta.icon;
              return (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer group transition-colors ${
                    !n.isRead ? "bg-brand-50/40" : ""
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg ${meta.color} flex items-center justify-center shrink-0`}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-sm ${!n.isRead ? "font-semibold text-slate-900" : "font-medium text-slate-700"}`}
                      >
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span className="w-2 h-2 bg-brand-600 rounded-full shrink-0 mt-1.5" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                      {n.message}
                    </p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-slate-400">
                        {timeAgo(n.createdAt)}
                      </span>
                      <button
                        onClick={(e) => handleDelete(e, n.id)}
                        className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-center text-sm font-medium text-brand-600 hover:bg-brand-50 border-t border-slate-100"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
