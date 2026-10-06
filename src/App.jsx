import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthProvider";
import ProtectedRoute from "./routes/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import AppLayout from "./layouts/AppLayout";
import PublicLayout from "./layouts/PublicLayout";
import Home from "./pages/Home";
import Services from "./pages/Services";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Dashboard from "./features/dashboard/Dashboard";
import PatientsPage from "./features/patients/PatientsPage";
import PatientDetailPage from "./features/patients/PatientDetailPage";
import DoctorsPage from "./features/doctors/DoctorsPage";
import DoctorDetailPage from "./features/doctors/DoctorDetailPage";
import AppointmentsPage from "./features/appointments/AppointmentsPage";
import AppointmentDetailPage from "./features/appointments/AppointmentDetailPage";
import PrescriptionsPage from "./features/prescriptions/PrescriptionsPage";
import PrescriptionDetailPage from "./features/prescriptions/PrescriptionDetailPage";
import LabTestsPage from "./features/lab/LabTestsPage";
import LabTestDetailPage from "./features/lab/LabTestDetailPage";
import InvoicesPage from "./features/billing/InvoicesPage";
import InvoiceDetailPage from "./features/billing/InvoiceDetailPage";
import EMRPage from "./features/emr/EMRPage";
import PharmacyDashboard from "./features/pharmacy/PharmacyDashboard";
import MedicinesPage from "./features/pharmacy/MedicinesPage";
import DispensePage from "./features/pharmacy/DispensePage";
import DispensesListPage from "./features/pharmacy/DispensesListPage";
import StaffPage from "./features/staff/StaffPage";
import PaymentsListPage from "./features/billing/PaymentsListPage";
import NotificationsPage from "./features/notifications/NotificationsPage";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

const CLINICAL = ["ADMIN", "DOCTOR", "RECEPTIONIST", "LAB"];

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <Toaster position="top-right" />
            <Routes>
              {/* Public routes */}
              <Route element={<PublicLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/services" element={<Services />} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />
              </Route>

              {/* Login (standalone, inside public layout) */}
              <Route element={<PublicLayout />}>
                <Route path="/login" element={<Login />} />
              </Route>
              <Route path="/notifications" element={<NotificationsPage />} />
              {/* Protected app routes */}
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route
                  path="/payments"
                  element={
                    <ProtectedRoute roles={["ADMIN", "RECEPTIONIST", "DOCTOR"]}>
                      <PaymentsListPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/staff"
                  element={
                    <ProtectedRoute roles={["ADMIN"]}>
                      <StaffPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route
                  path="/patients"
                  element={
                    <ProtectedRoute roles={CLINICAL}>
                      <PatientsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patients/:id"
                  element={
                    <ProtectedRoute roles={CLINICAL}>
                      <PatientDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/patients/:id/emr"
                  element={
                    <ProtectedRoute roles={[...CLINICAL, "PATIENT"]}>
                      <EMRPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/doctors"
                  element={
                    <ProtectedRoute
                      roles={["ADMIN", "DOCTOR", "RECEPTIONIST", "PATIENT"]}
                    >
                      <DoctorsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/doctors/:id"
                  element={
                    <ProtectedRoute
                      roles={["ADMIN", "DOCTOR", "RECEPTIONIST", "PATIENT"]}
                    >
                      <DoctorDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/appointments"
                  element={
                    <ProtectedRoute
                      roles={["ADMIN", "DOCTOR", "RECEPTIONIST", "PATIENT"]}
                    >
                      <AppointmentsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/appointments/:id"
                  element={
                    <ProtectedRoute
                      roles={["ADMIN", "DOCTOR", "RECEPTIONIST", "PATIENT"]}
                    >
                      <AppointmentDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/prescriptions"
                  element={
                    <ProtectedRoute
                      roles={["ADMIN", "DOCTOR", "RECEPTIONIST", "PATIENT"]}
                    >
                      <PrescriptionsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/prescriptions/:id"
                  element={
                    <ProtectedRoute
                      roles={["ADMIN", "DOCTOR", "RECEPTIONIST", "PATIENT"]}
                    >
                      <PrescriptionDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/lab"
                  element={
                    <ProtectedRoute
                      roles={[
                        "ADMIN",
                        "DOCTOR",
                        "LAB",
                        "RECEPTIONIST",
                        "PATIENT",
                      ]}
                    >
                      <LabTestsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/lab/:id"
                  element={
                    <ProtectedRoute
                      roles={[
                        "ADMIN",
                        "DOCTOR",
                        "LAB",
                        "RECEPTIONIST",
                        "PATIENT",
                      ]}
                    >
                      <LabTestDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/invoices"
                  element={
                    <ProtectedRoute
                      roles={["ADMIN", "RECEPTIONIST", "DOCTOR", "PATIENT"]}
                    >
                      <InvoicesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/invoices/:id"
                  element={
                    <ProtectedRoute
                      roles={["ADMIN", "RECEPTIONIST", "DOCTOR", "PATIENT"]}
                    >
                      <InvoiceDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pharmacy"
                  element={
                    <ProtectedRoute roles={["ADMIN", "PHARMACY"]}>
                      <PharmacyDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pharmacy/medicines"
                  element={
                    <ProtectedRoute
                      roles={["ADMIN", "PHARMACY", "DOCTOR", "LAB"]}
                    >
                      <MedicinesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pharmacy/dispense/new"
                  element={
                    <ProtectedRoute roles={["ADMIN", "PHARMACY"]}>
                      <DispensePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pharmacy/dispenses"
                  element={
                    <ProtectedRoute roles={["ADMIN", "PHARMACY", "DOCTOR"]}>
                      <DispensesListPage />
                    </ProtectedRoute>
                  }
                />

                {/* 404 inside app */}
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
