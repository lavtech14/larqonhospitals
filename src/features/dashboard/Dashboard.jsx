import { useAuth } from "../../hooks/useAuth";
import AdminDashboard from "./AdminDashboard";
import DoctorDashboard from "./DoctorDashboard";
import PatientDashboard from "./PatientDashboard";
import PharmacyDashboard from "../pharmacy/PharmacyDashboard";

export default function Dashboard() {
  const { user } = useAuth();

  if (user?.role === "ADMIN") return <AdminDashboard />;
  if (user?.role === "DOCTOR") return <DoctorDashboard />;
  if (user?.role === "PATIENT") return <PatientDashboard />;
  if (user?.role === "PHARMACY") return <PharmacyDashboard />;

  // Receptionist / LAB / PHARMACY → simple admin view for now
  return <AdminDashboard />;
}
