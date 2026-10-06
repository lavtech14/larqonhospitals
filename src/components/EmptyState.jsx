export default function EmptyState({
  title = "Nothing here",
  subtitle,
  action,
}) {
  return (
    <div className="text-center py-12">
      <p className="text-4xl mb-2">📭</p>
      <p className="text-slate-700 font-medium">{title}</p>
      {subtitle && <p className="text-slate-500 text-sm mt-1">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
