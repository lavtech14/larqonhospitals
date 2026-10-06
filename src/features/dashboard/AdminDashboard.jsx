import { useState } from "react";
import { useAdminStats } from "../../hooks/useStats";
import { SkeletonLine } from "../../components/Skeleton";
import KpiCard from "./KpiCard";
import LineTrend from "./LineTrend";
import BarStatus from "./BarStatus";
import RevenueTrend from "./RevenueTrend";
import TopDoctors from "./TopDoctors";
import RecentActivity from "./RecentActivity";

const RANGES = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
];

export default function AdminDashboard() {
  const [range, setRange] = useState(7);
  const { data, isLoading, isError } = useAdminStats(range);

  if (isLoading)
    return (
      <div className="p-6 space-y-4">
        <SkeletonLine className="w-40 h-7" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonLine key={i} className="h-24" />
          ))}
        </div>
      </div>
    );

  if (isError) return <div className="p-6 text-red-600">Failed to load</div>;

  const {
    kpis,
    trend,
    statusBreakdown,
    revenueTrend,
    topDoctors,
    recentAppointments,
  } = data;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-3 py-1.5 text-sm rounded border ${
                range === r.value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white hover:bg-slate-50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Patients"
          value={kpis.totalPatients}
          icon="🧑"
          accent="blue"
        />
        <KpiCard
          label="Doctors"
          value={kpis.totalDoctors}
          icon="👨‍⚕️"
          accent="purple"
        />
        <KpiCard
          label="Today's appointments"
          value={kpis.todayAppointments}
          icon="📅"
          accent="yellow"
        />
        <KpiCard
          label="Pending"
          value={kpis.pendingAppointments}
          icon="⏳"
          accent="yellow"
        />
        <KpiCard
          label="Unpaid invoices"
          value={kpis.unpaidInvoices}
          icon="💸"
          accent="red"
        />
        <KpiCard
          label="Paid invoices"
          value={kpis.paidInvoices}
          icon="✅"
          accent="green"
        />
        <KpiCard
          label="Lab pending"
          value={kpis.labPending}
          icon="🧪"
          accent="blue"
        />
        <KpiCard
          label={`Revenue (${range}d)`}
          value={`₹${kpis.revenue.toFixed(0)}`}
          icon="💰"
          accent="green"
        />
      </div>

      {/* Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LineTrend
          data={trend}
          label={`Appointments (last ${range} days)`}
          color="#2563eb"
        />
        <RevenueTrend data={revenueTrend} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BarStatus data={statusBreakdown} />
        <TopDoctors data={topDoctors} />
      </div>

      <RecentActivity items={recentAppointments} />
    </div>
  );
}
