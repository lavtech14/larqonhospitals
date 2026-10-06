import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAppointment } from "../../hooks/useAppointments";
import OrderLabTestModal from "../lab/OrderLabTestModal";
import { useCreateLabTest } from "../../hooks/useLab";
import InvoiceFormModal from "../billing/InvoiceFormModal";
import {
  useInvoiceByAppointment,
  useCreateInvoice,
} from "../../hooks/useInvoices";

import {
  usePrescriptionByAppointment,
  useCreatePrescription,
  useUpdatePrescription,
} from "../../hooks/usePrescriptions";
import { useAuth } from "../../hooks/useAuth";
import { showSuccess, showError } from "../../utils/toast";
import PrescriptionFormModal from "../prescriptions/PrescriptionFormModal";
import PrescriptionCard from "../prescriptions/PrescriptionCard";

export default function AppointmentDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: appt, isLoading, isError } = useAppointment(id);
  const { data: presc } = usePrescriptionByAppointment(id);
  const createMut = useCreatePrescription();
  const updateMut = useUpdatePrescription();
  const [labOpen, setLabOpen] = useState(false);
  const labMut = useCreateLabTest();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const { data: invoice } = useInvoiceByAppointment(id);
  const invoiceMut = useCreateInvoice();

  const canBill = ["ADMIN", "RECEPTIONIST"].includes(user?.role);

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (isError) return <div className="p-6 text-red-600">Failed to load</div>;

  const isDoctor = user?.role === "DOCTOR";
  const isAdmin = user?.role === "ADMIN";
  const canWrite = isDoctor || isAdmin;

  const handleCreateInvoice = async (form) => {
    try {
      await invoiceMut.mutateAsync({
        ...form,
        patientId: appt.patient.id,
        appointmentId: appt.id,
      });
      showSuccess("Invoice created");
      setInvoiceOpen(false);
    } catch (e) {
      showError(e.response?.data?.message || "Failed");
    }
  };

  const handleOrderLab = async (form) => {
    try {
      await labMut.mutateAsync({
        ...form,
        patientId: appt.patient.id,
        appointmentId: appt.id,
      });
      showSuccess("Lab test ordered");
      setLabOpen(false);
    } catch (e) {
      showError(e.response?.data?.message || "Failed");
    }
  };

  const handleSubmit = async (payload) => {
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, payload });
        showSuccess("Prescription updated");
      } else {
        await createMut.mutateAsync(payload);
        showSuccess("Prescription saved");
      }
      setModalOpen(false);
      setEditing(null);
    } catch (e) {
      showError(e.response?.data?.message || "Failed");
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <Link to="/appointments" className="text-blue-600 hover:underline">
        ← Back
      </Link>
      <h1 className="text-2xl font-bold">Appointment Details</h1>

      <div className="bg-white rounded-xl shadow p-6 grid grid-cols-2 gap-4 text-sm">
        <p>
          <b>Date:</b> {new Date(appt.date).toLocaleDateString()}
        </p>
        <p>
          <b>Slot:</b> {appt.slot}
        </p>
        <p>
          <b>Status:</b> {appt.status}
        </p>
        <p>
          <b>Patient:</b> {appt.patient.name} ({appt.patient.phone})
        </p>
        <p>
          <b>Doctor:</b> {appt.doctor.user.name}
        </p>
        <p>
          <b>Specialization:</b> {appt.doctor.specialization}
        </p>
        <p className="col-span-2">
          <b>Notes:</b> {appt.notes || "-"}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Prescription</h2>
        {canWrite && !presc && (
          <button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            + Write Prescription
          </button>
        )}
        {canWrite && presc && (
          <button
            onClick={() => {
              setEditing(presc);
              setModalOpen(true);
            }}
            className="border px-4 py-2 rounded hover:bg-slate-50"
          >
            Edit Prescription
          </button>
        )}
      </div>

      {!presc && (
        <p className="text-slate-500 text-sm bg-white rounded-xl shadow p-6">
          No prescription written yet.
        </p>
      )}

      {presc && <PrescriptionCard prescription={presc} showActions={false} />}

      <PrescriptionFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
        appointmentId={id}
        initial={editing}
      />

      {canWrite && (
        <button
          onClick={() => setLabOpen(true)}
          className="border px-4 py-2 rounded hover:bg-slate-50"
        >
          + Order Lab Test
        </button>
      )}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Invoice</h2>
        {canBill && !invoice && (
          <button
            onClick={() => setInvoiceOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            + Generate Invoice
          </button>
        )}
      </div>

      {!invoice && (
        <p className="text-slate-500 text-sm bg-white rounded-xl shadow p-6">
          No invoice generated yet.
        </p>
      )}

      {invoice && (
        <div className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
          <div>
            <p className="font-medium">
              {invoice.invoiceNo} · ₹{Number(invoice.total).toFixed(2)}
            </p>
            <p className="text-xs text-slate-500">{invoice.status}</p>
          </div>
          <Link
            to={`/invoices/${invoice.id}`}
            className="text-blue-600 text-sm hover:underline"
          >
            View Invoice →
          </Link>
        </div>
      )}

      <InvoiceFormModal
        open={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
        onSubmit={handleCreateInvoice}
        fixedPatientId={appt.patient.id}
        fixedAppointmentId={appt.id}
      />
      <OrderLabTestModal
        open={labOpen}
        onClose={() => setLabOpen(false)}
        onSubmit={handleOrderLab}
        fixedPatientId={appt.patient.id}
        fixedAppointmentId={appt.id}
      />
    </div>
  );
}
