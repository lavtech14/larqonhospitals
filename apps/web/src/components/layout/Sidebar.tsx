import Link from "next/link";
import StaffNavigation from "./StaffNavigation";
import StaffProfile from "./StaffProfile";

export default function Sidebar() {
  return (
    <aside className="sidebar" aria-label="Hospital workspace">
      <Link className="brand" href="/">
        <span className="brand-icon" aria-hidden="true">
          +
        </span>

        <span>
          Larqon Hospitals
          <small>Hospital workspace</small>
        </span>
      </Link>

      <p className="sidebar-label">STAFF WORKSPACE</p>

      <nav aria-label="Main navigation">
        <StaffNavigation />
      </nav>

      <div className="sidebar-note">
        <strong>Workspace preview</strong>
        <p>Patients, appointments, laboratory and pharmacy are coming next.</p>
      </div>

      <StaffProfile />
    </aside>
  );
}
