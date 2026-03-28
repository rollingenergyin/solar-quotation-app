/**
 * pdf-lib StandardFonts use WinAnsi encoding; many Unicode chars (e.g. rupee sign U+20B9) throw at drawText.
 * Normalize text for safe embedding; user-facing currency uses "Rs." which is universally readable.
 */

export function pdfSafeText(input: string): string {
  let s = input
    .replace(/\u20b9/gi, 'Rs.')
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/\u2022/g, '*')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, ' ');

  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp === 10 || cp === 13) {
      out += ch;
      continue;
    }
    if (cp >= 32 && cp <= 126) {
      out += ch;
      continue;
    }
    if (cp >= 160 && cp <= 255) {
      out += ch;
      continue;
    }
    out += ' ';
  }
  return out.replace(/ +/g, ' ');
}

/** Currency prefix safe for Helvetica WinAnsi */
export function fmtInrAmount(n: number): string {
  const num = n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `Rs. ${num}`;
}
