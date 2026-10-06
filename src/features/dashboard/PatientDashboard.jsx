import { Link } from "react-router-dom";
import { usePatientStats } from "../../hooks/useStats";
import KpiCard from "./KpiCard";

export default function PatientDashboard() {
  const { data, isLoading, isError } = usePatientStats();

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (isError)
    return (
      <div className="p-6 text-slate-600">
        No patient record linked to this account. Contact reception.
      </div>
    );

  const { kpis, upcoming } = data;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">Welcome back 👋</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Past visits"
          value={kpis.pastVisits}
          icon="🏥"
          accent="blue"
        />
        <KpiCard
          label="Prescriptions"
          value={kpis.prescriptions}
          icon="💊"
          accent="purple"
        />
        <KpiCard
          label="Lab tests"
          value={kpis.labTests}
          icon="🧪"
          accent="yellow"
        />
        <KpiCard
          label="Unpaid bills"
          value={kpis.unpaidInvoices}
          icon="💸"
          accent="red"
        />
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold mb-3">Upcoming appointments</h3>
        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-500">No upcoming appointments.</p>
        ) : (
          <div className="divide-y">
            {upcoming.map((a) => (
              <Link
                key={a.id}
                to={`/appointments/${a.id}`}
                className="block py-2 hover:bg-slate-50 -mx-2 px-2 rounded"
              >
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{a.doctor}</span>
                  <span className="text-slate-400 text-xs">
                    {new Date(a.date).toLocaleDateString()} · {a.slot}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {a.specialization} · {a.status}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
