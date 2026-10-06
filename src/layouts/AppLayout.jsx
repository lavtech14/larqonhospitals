import { useState } from "react";

import {
  NavLink,
  Outlet,
  useNavigate,
  useLocation,
  Link,
} from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  Calendar,
  FlaskConical,
  Receipt,
  Pill,
  LogOut,
  Menu,
  Bell,
  X,
  ChevronRight,
  PackageCheck,
  Search,
  Wallet,
  UserCog,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { showSuccess } from "../utils/toast";
import Avatar from "../components/ui/Avatar";
import NotificationBell from "../components/NotificationBell";

const NAV = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["ADMIN", "DOCTOR", "RECEPTIONIST", "LAB", "PHARMACY", "PATIENT"],
  },
  {
    to: "/notifications",
    label: "Notifications",
    icon: Bell,
    roles: ["ADMIN", "DOCTOR", "PATIENT", "RECEPTIONIST", "LAB", "PHARMACY"],
  },
  {
    to: "/payments",
    label: "Payments",
    icon: Wallet,
    roles: ["ADMIN", "RECEPTIONIST", "DOCTOR"],
  },
  {
    to: "/patients",
    label: "Patients",
    icon: Users,
    roles: ["ADMIN", "DOCTOR", "RECEPTIONIST", "LAB"],
  },
  {
    to: "/doctors",
    label: "Doctors",
    icon: Stethoscope,
    roles: ["ADMIN", "DOCTOR", "RECEPTIONIST", "PATIENT"],
  },
  {
    to: "/appointments",
    label: "Appointments",
    icon: Calendar,
    roles: ["ADMIN", "DOCTOR", "RECEPTIONIST", "PATIENT"],
  },
  { to: "/staff", label: "Staff", icon: UserCog, roles: ["ADMIN"] },
  {
    to: "/prescriptions",
    label: "Prescriptions",
    icon: Pill,
    roles: ["ADMIN", "DOCTOR", "RECEPTIONIST", "PATIENT"],
  },
  {
    to: "/lab",
    label: "Lab Tests",
    icon: FlaskConical,
    roles: ["ADMIN", "DOCTOR", "LAB", "RECEPTIONIST", "PATIENT"],
  },
  {
    to: "/invoices",
    label: "Invoices",
    icon: Receipt,
    roles: ["ADMIN", "RECEPTIONIST", "DOCTOR", "PATIENT"],
  },
  {
    to: "/pharmacy",
    label: "Pharmacy",
    icon: Pill,
    roles: ["ADMIN", "PHARMACY"],
  },
  {
    to: "/pharmacy/medicines",
    label: "Medicines",
    icon: Pill,
    roles: ["ADMIN", "PHARMACY", "DOCTOR", "LAB"],
  },
  {
    to: "/pharmacy/dispense/new",
    label: "Dispense",
    icon: PackageCheck,
    roles: ["ADMIN", "PHARMACY"],
  },
  {
    to: "/pharmacy/dispenses",
    label: "Dispenses",
    icon: PackageCheck,
    roles: ["ADMIN", "PHARMACY", "DOCTOR"],
  },
];

const pageTitles = {
  "/dashboard": "Dashboard",
  "/patients": "Patients",
  "/doctors": "Doctors",
  "/appointments": "Appointments",
  "/prescriptions": "Prescriptions",
  "/lab": "Lab Tests",
  "/invoices": "Invoices",
  "/notifications": "Notifications",
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const links = NAV.filter((n) => n.roles.includes(user?.role));

  // Derive page title from path (first segment)
  const segment = "/" + location.pathname.split("/")[1];
  const title = pageTitles[segment] || "Larqon Hospitals";

  const handleLogout = async () => {
    await logout();
    showSuccess("Logged out");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-0 z-50 h-screen w-64 bg-white border-r border-slate-200
          flex flex-col
          transition-transform duration-200
          ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-100 shrink-0">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg flex items-center justify-center text-white text-lg shadow-sm">
              🏥
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 leading-tight">
                Larqon Hospitals
              </div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wide">
                Hospital
              </div>
            </div>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          <div className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Menu
          </div>
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                  ${
                    isActive
                      ? "bg-brand-50 text-brand-700 shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      size={18}
                      className={
                        isActive
                          ? "text-brand-600"
                          : "text-slate-400 group-hover:text-slate-600"
                      }
                    />
                    <span className="flex-1">{link.label}</span>
                    {isActive && (
                      <ChevronRight size={14} className="text-brand-600" />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-slate-100 shrink-0">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
            <Avatar name={user?.name || ""} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {user?.name}
              </p>
              <p className="text-xs text-slate-500">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-white/80 backdrop-blur border-b border-slate-200 flex items-center px-4 lg:px-6 gap-4 sticky top-0 z-30">
          <button
            onClick={() => setOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
          >
            <Menu size={20} />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-slate-900 truncate">
              {title}
            </h1>
          </div>

          {/* Search (decorative for now) */}
          <div className="hidden md:flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 w-64">
            <Search size={16} className="text-slate-400" />
            <input
              placeholder="Search..."
              className="bg-transparent border-none outline-none text-sm flex-1 placeholder:text-slate-400"
            />
          </div>

          {/* Notification bell */}
          <NotificationBell />

          {/* User chip */}
          <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200">
            <Avatar name={user?.name || ""} size="sm" />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 min-w-0 animate-fade-in-up">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
