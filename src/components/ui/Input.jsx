import { forwardRef } from "react";

const Input = forwardRef(
  ({ label, error, hint, icon: Icon, className = "", ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {Icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <Icon size={16} />
            </div>
          )}
          <input
            ref={ref}
            className={`
              w-full rounded-lg border bg-white px-3 py-2 text-sm
              transition-colors
              placeholder:text-slate-400
              focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
              disabled:bg-slate-50 disabled:text-slate-500
              ${Icon ? "pl-9" : ""}
              ${error ? "border-red-500 focus:ring-red-500 focus:border-red-500" : "border-slate-300"}
              ${className}
            `}
            {...props}
          />
        </div>
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        {hint && !error && (
          <p className="text-slate-500 text-xs mt-1">{hint}</p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
export default Input;
