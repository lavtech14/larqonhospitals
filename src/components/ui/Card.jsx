export function Card({ children, className = "", hover = false }) {
  return (
    <div
      className={`
        bg-white rounded-xl border border-slate-200 shadow-sm
        ${hover ? "transition-shadow hover:shadow-md" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }) {
  return (
    <div className={`px-5 py-4 border-b border-slate-100 ${className}`}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = "" }) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}
