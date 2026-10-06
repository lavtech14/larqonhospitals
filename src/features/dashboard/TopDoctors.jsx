export default function TopDoctors({ data }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className="font-semibold mb-3">Top doctors</h3>
      {data.length === 0 && (
        <p className="text-sm text-slate-500">No data yet</p>
      )}
      <div className="space-y-3">
        {data.map((d) => (
          <div key={d.name}>
            <div className="flex justify-between text-sm">
              <span className="font-medium">{d.name}</span>
              <span className="text-slate-500">{d.count}</span>
            </div>
            <p className="text-xs text-slate-400">{d.specialization}</p>
            <div className="w-full h-2 bg-slate-100 rounded mt-1 overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded"
                style={{ width: `${(d.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
