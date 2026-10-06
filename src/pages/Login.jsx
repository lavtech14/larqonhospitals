import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { showSuccess, showError } from "../utils/toast";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await login(form.email, form.password);
      showSuccess(`Welcome, ${u.name}`);
      navigate("/dashboard");
    } catch (err) {
      showError(err.response?.data?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 bg-slate-50">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Left: form */}
        <div className="p-8 lg:p-12">
          <Link to="/" className="text-sm text-slate-500 hover:text-blue-600">
            ← Back to home
          </Link>

          <h1 className="text-3xl font-bold text-slate-900 mt-6">
            Welcome back
          </h1>
          <p className="text-slate-500 mt-2">
            Sign in to access your dashboard and appointments.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full border rounded-lg px-4 py-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full border rounded-lg px-4 py-2.5 pr-11 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700"
                >
                  {showPassword ? (
                    // Eye-off icon
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  ) : (
                    // Eye icon
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        {/* Right: marketing panel */}
        <div className="hidden lg:flex flex-col justify-center bg-gradient-to-br from-blue-600 to-blue-800 text-white p-12">
          <div className="text-6xl mb-6">🏥</div>
          <h2 className="text-2xl font-bold">
            Larqon Hospitals Patient Portal
          </h2>
          <p className="mt-3 text-blue-100">
            Manage appointments, view prescriptions, access lab reports, and
            stay on top of your health — all in one place.
          </p>

          <ul className="mt-8 space-y-3 text-sm">
            {[
              "Book appointments 24/7",
              "View prescriptions & reports",
              "Pay bills securely online",
              "Track your medical history",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="bg-white/20 rounded-full w-5 h-5 flex items-center justify-center text-xs">
                  ✓
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
