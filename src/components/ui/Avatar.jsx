const sizes = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
};

const colors = [
  "bg-brand-100 text-brand-700",
  "bg-purple-100 text-purple-700",
  "bg-green-100 text-green-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
];

export default function Avatar({
  name = "",
  size = "md",
  src,
  className = "",
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Deterministic color from name
  const colorIndex =
    name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`rounded-full object-cover ${sizes[size]} ${className}`}
      />
    );
  }

  return (
    <div
      className={`
        rounded-full flex items-center justify-center font-semibold shrink-0
        ${sizes[size]} ${colors[colorIndex]} ${className}
      `}
    >
      {initials || "?"}
    </div>
  );
}
