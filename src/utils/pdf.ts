import jsPDF from "jspdf";
import "jspdf-autotable";
import { formatCurrency, formatDate, numberToWords } from "./helpers";

function hexToRgb(hex?: string): [number, number, number] {
  if (!hex || !hex.startsWith('#')) return [37, 99, 235];
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return [r, g, b];
  }
  return [37, 99, 235];
}

export async function generateReceiptPDF(
  payment: Record<string, unknown>,
  settings: Record<string, string | boolean | null> | null,
) {
  const doc = new jsPDF();
  const student = payment.student as {
    name: string;
    admissionNumber: string;
    class?: { name: string };
    section?: { name: string };
  };
  const schoolName = (settings?.schoolName as string) || "CK CAREER ACADEMY";
  const amountRupees = (payment.amountPaise as number) / 100;
  const primaryRgb = hexToRgb(settings?.primaryColor as string);

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.text(schoolName.toUpperCase(), 105, 18, { align: "center" });

  doc.setTextColor(80, 80, 80);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  let subY = 24;

  if (settings?.reportHeader) {
    doc.text(settings.reportHeader as string, 105, subY, { align: "center" });
    subY += 5;
  }
  if (settings?.address) {
    doc.text(settings.address as string, 105, subY, { align: "center" });
    subY += 5;
  }
  const contactParts: string[] = [];
  if (settings?.phone) contactParts.push(`Phone: ${settings.phone}`);
  if (settings?.email) contactParts.push(`Email: ${settings.email}`);
  if (settings?.affiliationNumber) contactParts.push(`${settings.board || 'Affiliation'}: ${settings.affiliationNumber}`);
  if (contactParts.length > 0) {
    doc.text(contactParts.join(' | '), 105, subY, { align: "center" });
    subY += 5;
  }

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("FEE PAYMENT RECEIPT", 105, subY + 6, { align: "center" });

  doc.setDrawColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.setLineWidth(0.8);
  doc.line(20, subY + 10, 190, subY + 10);

  let y = subY + 18;
  const leftCol = 25;
  const rightCol = 120;

  const addRow = (label: string, value: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(label, leftCol, y);
    doc.setFont("helvetica", "bold");
    doc.text(value, rightCol, y);
    y += 8;
  };

  addRow("Receipt No:", payment.receiptNumber as string);
  addRow("Date:", formatDate(payment.paymentDate as string));
  addRow("Student:", student?.name || "");
  addRow("Admission No:", student?.admissionNumber || "");
  addRow(
    "Class:",
    `${student?.class?.name || ""}-${student?.section?.name || ""}`,
  );
  y += 4;
  addRow("Amount Paid:", formatCurrency(payment.amountPaise as number));
  addRow("Payment Method:", payment.paymentMethod as string);
  addRow("Previous Due:", formatCurrency(payment.previousDuePaise as number));
  addRow("Current Due:", formatCurrency(payment.currentDuePaise as number));

  y += 6;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text(`Amount in words: ${numberToWords(amountRupees)}`, leftCol, y);

  y += 20;
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(20, y, 190, y);
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.text("Authorized Signature", 150, y);
  if (settings?.principalName) {
    doc.setFontSize(8);
    doc.text(`Principal: ${settings.principalName}`, 25, y);
  }

  const footerText = (settings?.reportFooter as string) || (settings?.receiptFooter as string);
  if (footerText) {
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(footerText, 105, 280, { align: "center" });
  }

  doc.save(`receipt-${payment.receiptNumber}.pdf`);
}

export async function generateReportCardPDF(
  student: Record<string, unknown>,
  results: Record<string, unknown>[],
  summary: Record<string, unknown>,
  attendance: Record<string, number>,
  settings: Record<string, string | boolean | null> | null,
) {
  const doc = new jsPDF();
  const schoolName = (settings?.schoolName as string) || "CK CAREER ACADEMY";
  const cls = student.class as { name: string } | undefined;
  const sec = student.section as { name: string } | undefined;
  const primaryRgb = hexToRgb(settings?.primaryColor as string);

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.text(schoolName.toUpperCase(), 105, 15, { align: "center" });

  let curY = 21;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  if (settings?.reportHeader) {
    doc.text(settings.reportHeader as string, 105, curY, { align: "center" });
    curY += 5;
  }
  if (settings?.address) {
    doc.text(settings.address as string, 105, curY, { align: "center" });
    curY += 5;
  }

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("REPORT CARD", 105, curY + 4, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  let y = curY + 14;
  doc.text(`Name: ${student.name}`, 20, y);
  doc.text(`Admission No: ${student.admissionNumber}`, 120, y);
  y += 7;
  doc.text(`Class: ${cls?.name}-${sec?.name}`, 20, y);
  doc.text(`Roll No: ${student.rollNumber}`, 120, y);

  const tableData = results.map((r) => {
    const subject = r.subject as { name: string };
    return [
      subject?.name || "",
      String(r.maxMarks),
      String(r.marksObtained),
      r.grade as string,
    ];
  });

  (
    doc as unknown as { autoTable: (opts: Record<string, unknown>) => void }
  ).autoTable({
    startY: y + 10,
    head: [["Subject", "Max Marks", "Obtained", "Grade"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: primaryRgb },
  });

  y =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 10;
  doc.text(`Total: ${summary.totalObtained}/${summary.totalMax}`, 20, y);
  doc.text(`Percentage: ${summary.percentage}%`, 20, y + 7);
  doc.text(`Grade: ${summary.grade}`, 20, y + 14);
  doc.text(`Result: ${summary.result}`, 20, y + 21);

  y += 25;
  doc.text(
    `Attendance: ${attendance.present}/${attendance.workingDays} (${attendance.percentage}%)`,
    20,
    y,
  );

  y += 15;
  doc.setFontSize(9);
  doc.text(`Principal: ${settings?.principalName || 'Principal'}`, 20, y);
  doc.text("Class Teacher Signature", 140, y);

  const footerText = (settings?.reportFooter as string) || (settings?.reportCardFooter as string);
  if (footerText) {
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(footerText, 105, 280, { align: "center" });
  }

  doc.save(`report-card-${student.admissionNumber}.pdf`);
}

export function printElement(elementId: string) {
  const element = document.getElementById(elementId);
  if (!element) return;
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(
    `<html><head><title>Print</title><style>body{font-family:Arial,sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}</style></head><body>${element.innerHTML}</body></html>`,
  );
  printWindow.document.close();
  printWindow.print();
}
