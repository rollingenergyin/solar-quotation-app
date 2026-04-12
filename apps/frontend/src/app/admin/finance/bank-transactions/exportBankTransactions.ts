import * as XLSX from 'xlsx';
import type { BankTx, TxSplit } from './BankTransactionsTable';
import {
  displayProjectSiteLabel,
  type FinanceProjectRow,
  type SiteRow,
} from './projectSiteSelect';

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

function catName(name: string | undefined): string {
  return (name ?? '—').replace(/_/g, ' ');
}

function billLabel(b?: { fileUrl: string | null; invoiceNo: string } | null): string {
  if (!b) return '—';
  if (b.invoiceNo?.trim()) return b.invoiceNo.trim();
  if (b.fileUrl) {
    const seg = b.fileUrl.split('/').pop() ?? 'file';
    return seg.length > 28 ? `…${seg.slice(-24)}` : seg;
  }
  return '—';
}

function splitBill(sp: TxSplit): string {
  return billLabel(sp.purchaseBill ?? sp.salesBill ?? null);
}

function invLabel(s: 'INV' | 'NO_INV' | null | undefined): string {
  if (s === 'INV') return 'INV';
  if (s === 'NO_INV') return 'NO INV';
  return '—';
}

function upLabel(s: 'UPLOADED' | 'NOT_UPLOADED' | null | undefined): string {
  if (s === 'UPLOADED') return 'UP';
  if (s === 'NOT_UPLOADED') return 'NO UP';
  return '—';
}

/**
 * Rows for PDF/Excel: Date, Party, Description, Debit, Credit, Category, Project, Inv, Up, Bill, Split
 * Split child lines follow each parent, mirroring the on-screen table.
 */
export function buildBankTransactionExportRows(
  transactions: BankTx[],
  sites: SiteRow[] = [],
  projects: FinanceProjectRow[] = []
): string[][] {
  const header = [
    'Sr.',
    'Date',
    'Party',
    'Description',
    'Debit',
    'Credit',
    'Category',
    'Project',
    'Inv',
    'Up',
    'Bill',
    'Split',
  ];
  const rows: string[][] = [header];

  let sr = 0;
  for (const t of transactions) {
    sr += 1;
    const debit = t.type === 'EXPENSE' ? fmt(t.amount) : '—';
    const credit = t.type === 'INCOME' ? fmt(t.amount) : '—';
    const cat = t.isSplit ? '—' : catName(t.category?.name);
    const proj = t.isSplit
      ? '—'
      : displayProjectSiteLabel(t.site?.id ?? t.siteId, t.site, sites, projects);
    const bill = t.isSplit ? '—' : billLabel(t.purchaseBill ?? t.salesBill ?? null);
    const splitCol = t.isSplit ? `Split (${t.splits?.length ?? 0} lines)` : '—';
    const inv = t.isSplit ? '—' : invLabel(t.invoiceStatus);
    const up = t.isSplit ? '—' : upLabel(t.billUploadStatus);

    rows.push([
      String(sr),
      fmtDate(t.transactionDate),
      t.partyName ?? '—',
      t.description ?? '—',
      debit,
      credit,
      cat,
      proj,
      inv,
      up,
      bill,
      splitCol,
    ]);

    if (t.isSplit && t.splits?.length) {
      const n = t.splits.length;
      for (let i = 0; i < n; i++) {
        const sp = t.splits[i];
        const d = t.type === 'EXPENSE' ? fmt(sp.amount) : '—';
        const c = t.type === 'INCOME' ? fmt(sp.amount) : '—';
        const desc = sp.description?.trim() ? `Split · ${sp.description}` : 'Split line';
        rows.push([
          '',
          '',
          '',
          desc,
          d,
          c,
          catName(sp.category?.name),
          displayProjectSiteLabel(sp.siteId, sp.site, sites, projects),
          invLabel(sp.invoiceStatus),
          upLabel(sp.billUploadStatus),
          splitBill(sp),
          `Line ${i + 1} of ${n}`,
        ]);
      }
    }
  }

  let totalDebit = 0;
  let totalCredit = 0;
  for (const t of transactions) {
    if (t.type === 'EXPENSE') totalDebit += t.amount;
    else if (t.type === 'INCOME') totalCredit += t.amount;
  }
  const net = totalCredit - totalDebit;
  rows.push([
    '',
    '',
    '',
    'Totals',
    totalDebit > 0 ? fmt(totalDebit) : '—',
    totalCredit > 0 ? fmt(totalCredit) : '—',
    '',
    '',
    '',
    '',
    '',
    '',
    `Net: ${fmt(net)}`,
  ]);

  return rows;
}

function sanitizeFilename(s: string): string {
  return s.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, ' ').trim() || 'bank-transactions';
}

export function downloadBankTransactionsExcel(
  transactions: BankTx[],
  baseName: string,
  sites?: SiteRow[],
  projects?: FinanceProjectRow[]
): void {
  const rows = buildBankTransactionExportRows(transactions, sites, projects);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
  const name = sanitizeFilename(baseName);
  XLSX.writeFile(wb, `${name}.xlsx`);
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function downloadBankTransactionsPdf(
  transactions: BankTx[],
  baseName: string,
  sites?: SiteRow[],
  projects?: FinanceProjectRow[]
): Promise<void> {
  const rows = buildBankTransactionExportRows(transactions, sites, projects);
  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, sans-serif; font-size: 9px; color: #111;">
      <table style="border-collapse: collapse; width: 100%; border: 1px solid #ccc;">
        <thead>
          <tr style="background: #f3f4f6;">
            ${rows[0].map((c) => `<th style="border:0.5px solid #ccc;padding:4px 6px;text-align:left;font-weight:600;">${escHtml(c)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows
            .slice(1)
            .map(
              (r) =>
                `<tr>${r
                  .map((c, i) => {
                    const align = i >= 4 && i <= 5 ? 'right' : 'left';
                    return `<td style="border:0.5px solid #ccc;padding:4px 6px;text-align:${align};">${escHtml(c)}</td>`;
                  })
                  .join('')}</tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;

  const container = document.createElement('div');
  container.style.cssText = 'position:absolute;left:-10000px;top:0;width:800px;padding:12px;background:#fff;';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const html2pdf = (await import('html2pdf.js')).default;
    await html2pdf()
      .set({
        margin: [10, 10, 10, 10],
        filename: `${sanitizeFilename(baseName)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      })
      .from(container)
      .save();
  } finally {
    document.body.removeChild(container);
  }
}
