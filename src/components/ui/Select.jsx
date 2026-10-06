import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";

const Select = forwardRef(
  ({ label, error, children, className = "", ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          className={`
            w-full appearance-none rounded-lg border bg-white px-3 py-2 pr-9 text-sm
            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
            disabled:bg-slate-50
            ${error ? "border-red-500" : "border-slate-300"}
            ${className}
          `}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  ),
);

Select.displayName = "Select";
export default Select;
