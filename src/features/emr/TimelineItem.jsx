export default function TimelineItem({ icon, title, subtitle, children }) {
  return (
    <div className="relative pl-10 pb-8 border-l-2 border-slate-200 last:border-0 last:pb-0">
      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">
        {icon}
      </div>
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">{title}</h3>
          {subtitle && (
            <span className="text-xs text-slate-500">{subtitle}</span>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
