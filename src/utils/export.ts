import ExcelJS from 'exceljs';

export async function exportToExcel(
  data: Record<string, unknown>[],
  columns: { header: string; key: string; width?: number }[],
  filename: string
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Data');

  sheet.columns = columns.map(c => ({ header: c.header, key: c.key, width: c.width || 15 }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };

  data.forEach(row => sheet.addRow(row));

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToCSV(
  data: Record<string, unknown>[],
  columns: { header: string; key: string }[],
  filename: string
) {
  const headers = columns.map(c => c.header).join(',');
  const rows = data.map(row =>
    columns.map(c => {
      const val = row[c.key];
      const str = val === null || val === undefined ? '' : String(val);
      return str.includes(',') ? `"${str}"` : str;
    }).join(',')
  );
  const csv = [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
