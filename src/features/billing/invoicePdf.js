import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const downloadInvoicePdf = (inv) => {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.setTextColor(37, 99, 235);
  doc.text("Larqon Hospitals Hospital", 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("123 Health Street, Medical City", 14, 26);
  doc.text("+91 00000 00000 · billing@Larqon Hospitals.test", 14, 31);

  doc.setDrawColor(200);
  doc.line(14, 36, 196, 36);

  // Invoice meta
  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.text("INVOICE", 14, 46);

  doc.setFontSize(10);
  doc.text(`Invoice #: ${inv.invoiceNo}`, 14, 54);
  doc.text(`Date: ${new Date(inv.createdAt).toLocaleDateString()}`, 14, 60);
  doc.text(
    `Status: ${inv.status}${inv.method ? ` (${inv.method})` : ""}`,
    14,
    66,
  );

  // Patient
  doc.text("Billed To:", 120, 54);
  doc.setFontSize(11);
  doc.text(inv.patient.name, 120, 60);
  doc.text(inv.patient.phone || "", 120, 66);

  // Items table
  autoTable(doc, {
    startY: 76,
    head: [["#", "Description", "Amount"]],
    body: inv.items.map((it, idx) => [
      idx + 1,
      it.label,
      `Rs. ${Number(it.amount).toFixed(2)}`,
    ]),
    theme: "grid",
    headStyles: { fillColor: [37, 99, 235] },
  });

  // Total
  const y = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Total:", 140, y);
  doc.text(`Rs. ${Number(inv.total).toFixed(2)}`, 175, y, { align: "right" });

  // Notes
  if (inv.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Notes:", 14, y + 12);
    doc.text(doc.splitTextToSize(inv.notes, 180), 14, y + 18);
  }

  // Footer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    "This is a computer-generated invoice. Thank you for choosing Larqon Hospitals.",
    14,
    pageHeight - 12,
  );

  doc.save(`${inv.invoiceNo}.pdf`);
};
