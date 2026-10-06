import { Link } from "react-router-dom";

export default function RecentActivity({ items }) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="font-semibold mb-3">Recent appointments</h3>
      <div className="divide-y">
        {items.map((a) => (
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
              {a.doctor} · <span className="font-medium">{a.status}</span>
            </p>
          </Link>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-slate-500 py-2">No appointments yet</p>
        )}
      </div>
    </div>
  );
}
