import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
  useClearAllNotifications,
} from "../../hooks/useNotifications";
import { showSuccess, showError } from "../../utils/toast";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import EmptyState from "../../components/ui/EmptyState";
import { SkeletonTable } from "../../components/Skeleton";
import ConfirmModal from "../../components/ConfirmModal";

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

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("all"); // all | unread
  const [confirmClear, setConfirmClear] = useState(false);

  const { data, isLoading } = useNotifications({
    page,
    limit: 20,
    unreadOnly: filter === "unread" ? "true" : undefined,
  });
  const markRead = useMarkAsRead();
  const markAllRead = useMarkAllAsRead();
  const deleteMut = useDeleteNotification();
  const clearMut = useClearAllNotifications();

  const unreadCount = data?.unreadCount || 0;

  const handleClick = async (n) => {
    if (!n.isRead) await markRead.mutateAsync(n.id);
    if (n.link) navigate(n.link);
  };

  const handleClearAll = async () => {
    try {
      const res = await clearMut.mutateAsync();
      showSuccess(`Cleared ${res.deleted} notifications`);
      setConfirmClear(false);
    } catch {
      showError("Failed to clear");
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button
              variant="secondary"
              icon={CheckCheck}
              onClick={() =>
                markAllRead
                  .mutateAsync()
                  .then((r) => showSuccess(`Marked ${r.updated} as read`))
              }
            >
              Mark all read
            </Button>
          )}
          <Button
            variant="secondary"
            icon={Trash2}
            onClick={() => setConfirmClear(true)}
            className="text-red-600"
          >
            Clear all
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => {
            setFilter("all");
            setPage(1);
          }}
          className={`px-3 py-1.5 text-sm rounded-lg border ${
            filter === "all"
              ? "bg-brand-600 text-white border-brand-600"
              : "bg-white border-slate-300 hover:bg-slate-50"
          }`}
        >
          All
        </button>
        <button
          onClick={() => {
            setFilter("unread");
            setPage(1);
          }}
          className={`px-3 py-1.5 text-sm rounded-lg border inline-flex items-center gap-1.5 ${
            filter === "unread"
              ? "bg-brand-600 text-white border-brand-600"
              : "bg-white border-slate-300 hover:bg-slate-50"
          }`}
        >
          Unread
          {unreadCount > 0 && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full ${
                filter === "unread"
                  ? "bg-white/20"
                  : "bg-brand-100 text-brand-700"
              }`}
            >
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {isLoading && <SkeletonTable rows={6} cols={3} />}

      {data && data.data.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200">
          <EmptyState
            icon={Bell}
            title={
              filter === "unread"
                ? "No unread notifications"
                : "No notifications yet"
            }
            subtitle="When something happens, you'll see it here."
          />
        </div>
      )}

      {data && data.data.length > 0 && (
        <>
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {data.data.map((n) => {
              const meta = TYPE_ICON[n.type] || TYPE_ICON.SYSTEM;
              const Icon = meta.icon;
              return (
                <div
                  key={n.id}
                  className={`flex gap-4 p-5 hover:bg-slate-50 cursor-pointer group transition-colors ${
                    !n.isRead ? "bg-brand-50/30" : ""
                  }`}
                  onClick={() => handleClick(n)}
                >
                  <div
                    className={`w-11 h-11 rounded-xl ${meta.color} flex items-center justify-center shrink-0`}
                  >
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p
                          className={`${!n.isRead ? "font-semibold text-slate-900" : "font-medium text-slate-700"}`}
                        >
                          {n.title}
                          {!n.isRead && (
                            <span className="ml-2 inline-block w-2 h-2 bg-brand-600 rounded-full align-middle" />
                          )}
                        </p>
                        <p className="text-sm text-slate-600 mt-1">
                          {n.message}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <Badge variant="default" size="sm">
                        {n.type.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMut
                        .mutateAsync(n.id)
                        .then(() => showSuccess("Deleted"));
                    }}
                    className="self-start p-1.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Page {data.pagination.page} of {data.pagination.totalPages} ·{" "}
              {data.pagination.total} total
            </p>
            <div className="space-x-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <ConfirmModal
        open={confirmClear}
        title="Clear all notifications?"
        message="This will permanently delete every notification for your account. This cannot be undone."
        confirmLabel="Clear All"
        danger
        onConfirm={handleClearAll}
        onCancel={() => setConfirmClear(false)}
        busy={clearMut.isPending}
      />
    </div>
  );
}
