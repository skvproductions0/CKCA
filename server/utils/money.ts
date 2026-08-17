export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
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

  function convertHundreds(n: number): string {
    let result = '';
    if (n >= 100) {
      result += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      result += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      result += ones[n] + ' ';
    }
    return result;
  }

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);

  let words = '';

  if (rupees >= 10000000) {
    words += convertHundreds(Math.floor(rupees / 10000000)) + 'Crore ';
    num = rupees % 10000000;
  } else {
    num = rupees;
  }

  if (num >= 100000) {
    words += convertHundreds(Math.floor(num / 100000)) + 'Lakh ';
    num %= 100000;
  }

  if (num >= 1000) {
    words += convertHundreds(Math.floor(num / 1000)) + 'Thousand ';
    num %= 1000;
  }

  if (num > 0) {
    words += convertHundreds(num);
  }

  words = words.trim() + ' Rupees';

  if (paise > 0) {
    words += ' and ' + convertHundreds(paise).trim() + ' Paise';
  }

  return words + ' Only';
}
