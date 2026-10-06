const variants = {
  default: "bg-slate-100 text-slate-700",
  success: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
  brand: "bg-brand-100 text-brand-700",
};

const sizes = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-xs",
};

export default function Badge({
  children,
  variant = "default",
  size = "md",
  className = "",
}) {
  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap
        ${variants[variant]} ${sizes[size]} ${className}
      `}
    >
      {children}
    </span>
  );
}
