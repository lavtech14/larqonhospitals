import { Link } from "react-router-dom";
import {
  Pill,
  Package,
  PackageCheck,
  AlertTriangle,
  Calendar,
  ArrowRight,
} from "lucide-react";
import { usePharmacyStats, usePharmacyAlerts } from "../../hooks/usePharmacy";
import KpiCard from "../dashboard/KpiCard";

export default function PharmacyDashboard() {
  const { data: stats } = usePharmacyStats();
  const { data: alerts } = usePharmacyAlerts();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Pharmacy Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Inventory, dispensing, and stock alerts
          </p>
        </div>
        <Link
          to="/pharmacy/medicines"
          className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          Manage Inventory <ArrowRight size={14} />
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total medicines"
          value={stats?.totalMedicines ?? "—"}
          icon="💊"
          accent="blue"
        />
        <KpiCard
          label="Dispensed today"
          value={stats?.totalDispensedToday ?? "—"}
          icon="✅"
          accent="green"
        />
        <KpiCard
          label="Pending Rx"
          value={stats?.pendingPrescriptions ?? "—"}
          icon="⏳"
          accent="yellow"
        />
        <KpiCard
          label="Low stock"
          value={stats?.lowStockCount ?? "—"}
          icon="⚠️"
          accent="red"
        />
      </div>

      {/* Alerts */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Low stock */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              <h3 className="font-semibold">Low Stock</h3>
            </div>
            <Link
              to="/pharmacy/medicines?lowStock=true"
              className="text-xs text-brand-600 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="p-2 max-h-64 overflow-y-auto">
            {alerts?.lowStock?.length === 0 && (
              <p className="text-sm text-slate-400 p-4">
                All medicines well stocked ✅
              </p>
            )}
            {alerts?.lowStock?.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between px-3 py-2 rounded hover:bg-slate-50"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{m.name}</p>
                  <p className="text-xs text-slate-500">
                    Reorder at {m.reorderLevel}
                  </p>
                </div>
                <span className="text-sm font-bold text-amber-600">
                  {m.stock} left
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Expiring soon */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b flex items-center gap-2">
            <Calendar size={16} className="text-rose-500" />
            <h3 className="font-semibold">Expiring in 30 Days</h3>
          </div>
          <div className="p-2 max-h-64 overflow-y-auto">
            {alerts?.expiringSoon?.length === 0 && (
              <p className="text-sm text-slate-400 p-4">
                No batches expiring soon ✅
              </p>
            )}
            {alerts?.expiringSoon?.map((b, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2 rounded hover:bg-slate-50"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{b.name}</p>
                  <p className="text-xs text-slate-500 font-mono">
                    Batch {b.batchNo}
                  </p>
                </div>
                <span className="text-xs text-rose-600 font-medium">
                  {new Date(b.expiryDate).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid md:grid-cols-3 gap-4">
        <QuickLink
          to="/pharmacy/medicines"
          icon={Pill}
          title="Medicines"
          desc="Browse catalog & add stock"
          color="text-blue-600 bg-blue-50"
        />
        <QuickLink
          to="/pharmacy/dispenses"
          icon={PackageCheck}
          title="Dispenses"
          desc="Fulfilled prescriptions"
          color="text-green-600 bg-green-50"
        />
        <QuickLink
          to="/pharmacy/dispense/new"
          icon={Package}
          title="Dispense Rx"
          desc="Fulfill pending prescriptions"
          color="text-purple-600 bg-purple-50"
        />
      </div>
    </div>
  );
}

function QuickLink({ to, icon: Icon, title, desc, color }) {
  return (
    <Link
      to={to}
      className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-brand-300 transition-all group"
    >
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${color}`}
      >
        <Icon size={20} />
      </div>
      <p className="font-semibold text-slate-900 group-hover:text-brand-700">
        {title}
      </p>
      <p className="text-xs text-slate-500 mt-1">{desc}</p>
    </Link>
  );
}
