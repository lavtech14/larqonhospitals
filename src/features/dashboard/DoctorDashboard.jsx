import { Link } from "react-router-dom";
import { useDoctorStats } from "../../hooks/useStats";
import { SkeletonLine } from "../../components/Skeleton";
import KpiCard from "./KpiCard";
import LineTrend from "./LineTrend";

export default function DoctorDashboard() {
  const { data, isLoading, isError } = useDoctorStats();

  if (isLoading)
    return (
      <div className="p-6 space-y-4">
        <SkeletonLine className="w-40 h-7" />
        <SkeletonLine className="h-32" />
      </div>
    );

  if (isError) return <div className="p-6 text-red-600">Failed to load</div>;

  const { kpis, trend, recentAppointments } = data;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">My Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Today"
          value={kpis.todayCount}
          icon="📅"
          accent="blue"
        />
        <KpiCard
          label="Pending"
          value={kpis.pendingCount}
          icon="⏳"
          accent="yellow"
        />
        <KpiCard
          label="Completed"
          value={kpis.completedCount}
          icon="✅"
          accent="green"
        />
        <KpiCard
          label="All time"
          value={kpis.totalCount}
          icon="📊"
          accent="purple"
        />
      </div>

      <LineTrend data={trend} label="Appointments (last 7 days)" />

      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold mb-3">Recent appointments</h3>
        <div className="divide-y">
          {recentAppointments.map((a) => (
            <Link
              key={a.id}
              to={`/appointments/${a.id}`}
              className="block py-2 hover:bg-slate-50 -mx-2 px-2 rounded"
            >
              <div className="flex justify-between text-sm">
                <span className="font-medium">{a.patient}</span>
                <span className="text-slate-400 text-xs">
                  {new Date(a.date).toLocaleDateString()} · {a.slot}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {a.phone} · {a.status}
              </p>
            </Link>
          ))}
          {recentAppointments.length === 0 && (
            <p className="text-sm text-slate-500 py-2">No appointments yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
