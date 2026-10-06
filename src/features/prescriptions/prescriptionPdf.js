import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const downloadPrescriptionPdf = (presc) => {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(18);
  doc.text("Larqon Hospitals Hospital", 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("123 Health Street · +91 00000 00000", 14, 26);

  doc.setDrawColor(200);
  doc.line(14, 30, 196, 30);

  // Patient + doctor info
  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.text(`Patient: ${presc.patient.name}`, 14, 40);
  doc.text(`Phone: ${presc.patient.phone}`, 14, 46);
  doc.text(`Doctor: ${presc.appointment.doctor.user.name}`, 120, 40);
  doc.text(
    `Specialization: ${presc.appointment.doctor.specialization}`,
    120,
    46,
  );
  doc.text(`Date: ${new Date(presc.createdAt).toLocaleDateString()}`, 14, 52);
  if (presc.followUpDate) {
    doc.text(
      `Follow-up: ${new Date(presc.followUpDate).toLocaleDateString()}`,
      120,
      52,
    );
  }

  // Medicines table
  autoTable(doc, {
    startY: 62,
    head: [["Medicine", "Dosage", "Duration"]],
    body: presc.medicines.map((m) => [m.name, m.dosage, m.duration]),
    headStyles: { fillColor: [37, 99, 235] },
    theme: "grid",
  });

  // Notes
  if (presc.notes) {
    const y = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.text("Notes:", 14, y);
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(presc.notes, 180), 14, y + 6);
  }

  // Footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    "This is a computer-generated prescription. Valid without signature.",
    14,
    pageHeight - 12,
  );

  doc.save(`prescription-${presc.id.slice(0, 8)}.pdf`);
};
