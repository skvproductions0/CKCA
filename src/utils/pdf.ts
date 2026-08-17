import jsPDF from "jspdf";
import "jspdf-autotable";
import { formatCurrency, formatDate, numberToWords } from "./helpers";

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

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(schoolName.toUpperCase(), 105, 20, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (settings?.address)
    doc.text(settings.address as string, 105, 28, { align: "center" });
  if (settings?.phone)
    doc.text(`Phone: ${settings.phone}`, 105, 34, { align: "center" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("FEE PAYMENT RECEIPT", 105, 48, { align: "center" });

  doc.setDrawColor(200);
  doc.line(20, 52, 190, 52);

  let y = 62;
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
  doc.line(20, y, 190, y);
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.text("Authorized Signature", 150, y);

  if (settings?.receiptFooter) {
    doc.setFontSize(8);
    doc.text(settings.receiptFooter as string, 105, 280, { align: "center" });
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

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(schoolName.toUpperCase(), 105, 15, { align: "center" });
  doc.setFontSize(12);
  doc.text("REPORT CARD", 105, 24, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  let y = 35;
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
    headStyles: { fillColor: [37, 99, 235] },
  });

  y =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 10;
  doc.text(`Total: ${summary.totalObtained}/${summary.totalMax}`, 20, y);
  doc.text(`Percentage: ${summary.percentage}%`, 20, y + 7);
  doc.text(`Grade: ${summary.grade}`, 20, y + 14);
  doc.text(`Result: ${summary.result}`, 20, y + 21);

  y += 30;
  doc.text(
    `Attendance: ${attendance.present}/${attendance.workingDays} (${attendance.percentage}%)`,
    20,
    y,
  );

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
