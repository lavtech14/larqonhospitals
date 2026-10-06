export default function KpiCard({ label, value, accent = "blue", icon }) {
  const accents = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    yellow: "bg-yellow-50 text-yellow-700",
    red: "bg-red-50 text-red-700",
    purple: "bg-purple-50 text-purple-700",
  };
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 uppercase tracking-wide">
          {label}
        </p>
        {icon && (
          <span
            className={`text-lg w-8 h-8 rounded-lg flex items-center justify-center ${accents[accent]}`}
          >
            {icon}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
