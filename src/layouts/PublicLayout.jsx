import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const NAV = [
  { to: "/", label: "Home", exact: true },
  { to: "/services", label: "Services" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export default function PublicLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">🏥</span>
            <span className="text-lg font-bold text-blue-700">
              Larqon Hospitals
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={({ isActive }) =>
                  `px-3 py-2 text-sm rounded-md transition ${
                    isActive
                      ? "text-blue-700 font-medium"
                      : "text-slate-700 hover:text-blue-700 hover:bg-slate-50"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <Link
                to="/dashboard"
                className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Go to Dashboard →
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm text-slate-700 px-3 py-2 rounded-md hover:bg-slate-50"
                >
                  Sign in
                </Link>
                <Link
                  to="/login"
                  className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Book Appointment
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setOpen((v) => !v)}
            className="md:hidden p-2 rounded hover:bg-slate-100"
            aria-label="Menu"
          >
            ☰
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden border-t bg-white px-4 py-3 space-y-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded text-sm ${
                    isActive
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-slate-700"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <div className="pt-2 border-t mt-2">
              {user ? (
                <Link
                  to="/dashboard"
                  onClick={() => setOpen(false)}
                  className="block bg-blue-600 text-white text-center py-2 rounded-lg text-sm"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="block bg-blue-600 text-white text-center py-2 rounded-lg text-sm"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-12 grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🏥</span>
              <span className="text-lg font-bold text-white">
                Larqon Hospitals
              </span>
            </div>
            <p className="text-sm text-slate-400">
              Compassionate care, modern medicine. Serving the community since
              1995.
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">
              Quick Links
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/services" className="hover:text-white">
                  Services
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-white">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white">
                  Contact
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-white">
                  Patient Portal
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">
              Departments
            </h4>
            <ul className="space-y-2 text-sm">
              <li>Cardiology</li>
              <li>Neurology</li>
              <li>Orthopedics</li>
              <li>Pediatrics</li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">
              Contact
            </h4>
            <ul className="space-y-2 text-sm">
              <li>📍 123 Health Street, Medical City</li>
              <li>📞 +91 00000 00000</li>
              <li>✉️ hello@Larqon Hospitals.test</li>
              <li>🕐 Open 24 / 7</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 py-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Larqon Hospitals Hospital. All rights
          reserved.
        </div>
      </footer>
    </div>
  );
}
