export const SkeletonLine = ({ className = "" }) => (
  <div className={`shimmer rounded h-4 ${className}`} />
);

export const SkeletonTable = ({ rows = 5, cols = 5 }) => (
  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
    <div className="bg-slate-50 h-12 border-b" />
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="flex gap-4 p-4 border-b last:border-0">
        {Array.from({ length: cols }).map((_, c) => (
          <SkeletonLine key={c} className="flex-1" />
        ))}
      </div>
    ))}
  </div>
);

export const SkeletonCard = ({ className = "" }) => (
  <div
    className={`bg-white rounded-xl border border-slate-200 p-5 ${className}`}
  >
    <SkeletonLine className="w-1/3 mb-3" />
    <SkeletonLine className="w-1/2 h-6" />
  </div>
);
