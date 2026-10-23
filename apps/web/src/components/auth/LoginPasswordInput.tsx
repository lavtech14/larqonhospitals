"use client";

import { useState } from "react";
import type { InputHTMLAttributes } from "react";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "id" | "name"
> & {
  id: string;
  name: string;
  label: string;
};

export default function LoginPasswordInput({
  label,
  id,
  name,
  className = "",
  disabled,
  ...props
}: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="text-xs font-semibold text-slate-600">
        {label}
      </label>
      <div className="relative mt-2">
        <input
          {...props}
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          disabled={disabled}
          className={`block min-h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-white py-3 pr-20 pl-3 text-sm text-slate-900 focus:border-teal-700 focus:outline-2 focus:outline-offset-2 focus:outline-teal-700 disabled:cursor-wait disabled:bg-slate-50 ${className}`}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setVisible((current) => !current)}
          aria-controls={id}
          aria-pressed={visible}
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          className="absolute top-1 right-1 inline-flex min-h-10 min-w-16 cursor-pointer items-center justify-center rounded-lg px-2 text-xs font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-teal-700 disabled:cursor-wait disabled:opacity-50"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
