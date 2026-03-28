/** Indian numbering amount in words for invoices (ASCII-safe for PDF engines). */
export function amountToWordsINR(num: number): string {
  const n = Math.floor(Math.round(num));
  if (n === 0) return 'Zero Rupees Only';
  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function twoDigit(x: number): string {
    if (x < 20) return ones[x];
    return tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '');
  }
  function section(n: number): string {
    if (n < 100) return twoDigit(n);
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigit(n % 100) : '');
    return String(n);
  }
  let s = '';
  let rem = n;
  if (rem >= 10000000) {
    const c = Math.floor(rem / 10000000);
    s += section(c) + ' Crore ';
    rem %= 10000000;
  }
  if (rem >= 100000) {
    const l = Math.floor(rem / 100000);
    s += section(l) + ' Lakh ';
    rem %= 100000;
  }
  if (rem >= 1000) {
    const t = Math.floor(rem / 1000);
    s += section(t) + ' Thousand ';
    rem %= 1000;
  }
  if (rem > 0) s += section(rem);
  return (s.trim() + ' Rupees Only').replace(/\s+/g, ' ');
}
