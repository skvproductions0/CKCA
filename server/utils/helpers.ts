export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function formatCurrency(paise: number, symbol = '₹'): string {
  const rupees = paiseToRupees(paise);
  return `${symbol}${rupees.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function numberToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (num === 0) return 'Zero';

  function convert(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  }

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  let result = convert(rupees) + ' Rupees';
  if (paise > 0) result += ' and ' + convert(paise) + ' Paise';
  return result + ' Only';
}

export function calculateGrade(percentage: number, rules: { grade: string; minPercent: number; maxPercent: number }[]): string {
  for (const rule of rules.sort((a, b) => b.minPercent - a.minPercent)) {
    if (percentage >= rule.minPercent && percentage <= rule.maxPercent) {
      return rule.grade;
    }
  }
  return 'F';
}

export function calculatePercentage(obtained: number, max: number): number {
  if (max === 0) return 0;
  return Math.round((obtained / max) * 10000) / 100;
}

export function generateStudentId(year: number, counter: number): string {
  return `STU-${year}-${String(counter).padStart(4, '0')}`;
}

export function generateAdmissionNumber(year: number, counter: number): string {
  return `ADM-${year}-${String(counter).padStart(4, '0')}`;
}

export function generateReceiptNumber(year: number, counter: number): string {
  return `REC-${year}-${String(counter).padStart(5, '0')}`;
}

export function generateEmployeeId(counter: number): string {
  return `EMP-${String(counter).padStart(4, '0')}`;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes('Unique constraint')) {
      if (msg.includes('admissionNumber')) return 'This admission number already exists.';
      if (msg.includes('receiptNumber')) return 'This receipt number already exists.';
      if (msg.includes('username')) return 'This username already exists.';
      if (msg.includes('email')) return 'This email already exists.';
      if (msg.includes('employeeId')) return 'This employee ID already exists.';
      return 'A record with this information already exists.';
    }
    if (msg.includes('Foreign key constraint')) {
      return 'Cannot perform this action because related records exist.';
    }
    return msg;
  }
  return 'An unexpected error occurred.';
}
