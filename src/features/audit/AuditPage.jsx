import { useState } from "react";
import { useAuditLogs } from "../../hooks/useAudit";
import { SkeletonTable } from "../../components/Skeleton";
import EmptyState from "../../components/EmptyState";

const ACTION_COLORS = {
  CREATE: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
  LOGIN: "bg-slate-100 text-slate-700",
  LOGOUT: "bg-slate-100 text-slate-700",
  PAY: "bg-emerald-100 text-emerald-800",
  UPLOAD: "bg-purple-100 text-purple-800",
};

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [expanded, setExpanded] = useState(null);

  const { data, isLoading, isError } = useAuditLogs({
    page,
    limit: 25,
    entity,
    action,
  });

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Audit Logs</h1>

      <div className="flex flex-wrap gap-3">
        <select
          value={entity}
          onChange={(e) => {
            setEntity(e.target.value);
            setPage(1);
          }}
          className="border rounded px-3 py-2"
        >
          <option value="">All entities</option>
          {[
            "User",
            "Patient",
            "Doctor",
            "Appointment",
            "Prescription",
            "Invoice",
            "LabTest",
            "Attachment",
          ].map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>

        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="border rounded px-3 py-2"
        >
          <option value="">All actions</option>
          {[
            "CREATE",
            "UPDATE",
            "DELETE",
            "LOGIN",
            "LOGOUT",
            "PAY",
            "UPLOAD",
          ].map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <SkeletonTable rows={10} cols={6} />}
      {isError && <p className="text-red-600">Failed to load</p>}

      {data && (
        <>
          <div className="overflow-x-auto bg-white rounded-xl shadow">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="p-3">When</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Entity</th>
                  <th className="p-3">IP</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((log) => (
                  <>
                    <tr key={log.id} className="border-t">
                      <td className="p-3 text-xs">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <div>{log.userEmail || "—"}</div>
                        <div className="text-xs text-slate-400">
                          {log.userRole}
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded text-xs ${ACTION_COLORS[log.action] || "bg-slate-100"}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3">
                        {log.entity}
                        {log.entityId && (
                          <span className="text-xs text-slate-400 font-mono ml-1">
                            #{log.entityId.slice(0, 8)}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-xs">{log.ipAddress || "—"}</td>
                      <td className="p-3">
                        {log.meta && (
                          <button
                            onClick={() =>
                              setExpanded(expanded === log.id ? null : log.id)
                            }
                            className="text-blue-600 hover:underline text-xs"
                          >
                            {expanded === log.id ? "Hide" : "Details"}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expanded === log.id && (
                      <tr className="bg-slate-50">
                        <td colSpan={6} className="p-3">
                          <pre className="text-xs whitespace-pre-wrap">
                            {JSON.stringify(log.meta, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState title="No audit logs" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Page {data.pagination.page} of {data.pagination.totalPages} ·{" "}
              {data.pagination.total} total
            </p>
            <div className="space-x-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 border rounded disabled:opacity-40"
              >
                Prev
              </button>
              <button
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 border rounded disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
