/**
 * SPGS tax invoice as a strict HTML document (pure <table> layout for line items + GST).
 * Used with Puppeteer for PDF output — matches fixed row/column reference structure.
 */

import type { SpgsPdfInput } from '../invoice-pdf-spgs-types.js';
import type { SpgsEpcBreakdown } from '../invoice-spgs.service.js';
import { amountToWordsINR } from '../invoice-amount-words.js';
import type { InvoiceBrandConfig } from '../invoice-branding.js';
import type { InvoiceTemplateConfigV1 } from '../invoice-template-config.js';
import {
  formatSystemSizeLine,
  mainPerLabel,
  mergeInvoiceTemplateConfig,
  mergeSellerBranding,
  totalQtyUnitLabel,
} from '../invoice-template-config.js';

const DEFAULT_HSN = '995464';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtNum(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function roundOffDelta(total: number, base: number, gstTotal: number): number {
  return Math.round((total - base - gstTotal) * 100) / 100;
}

function epcDisplayRows(watts: number, perW: number, epc: SpgsEpcBreakdown) {
  const w1 = Math.round(watts * 0.7 * 100) / 100;
  const w2 = Math.round((watts - w1) * 100) / 100;
  const t1 = epc.portion70Taxable;
  const t2 = epc.portion30Taxable;
  const g1 = epc.gstAt5On70;
  const g2 = epc.gstAt18On30;
  const cgst1 = Math.round((g1 / 2) * 100) / 100;
  const sgst1 = Math.round((g1 - g1 / 2) * 100) / 100;
  const cgst2 = Math.round((g2 / 2) * 100) / 100;
  const sgst2 = Math.round((g2 - g2 / 2) * 100) / 100;
  return {
    cgst1,
    sgst1,
    cgst2,
    sgst2,
    g1,
    g2,
    t1,
    t2,
  };
}

export interface SpgsInvoiceHtmlContext {
  data: SpgsPdfInput;
  branding: InvoiceBrandConfig;
  /** Optional PNG data URL for logo (embedded in PDF HTML). */
  logoDataUrl?: string;
  /** Optional no-code template; omitted = legacy layout and labels. */
  templateConfig?: InvoiceTemplateConfigV1;
}

/** Collapses branding address into exactly two lines for the invoice header. */
function formatAddressTwoLines(addr: string): { line1: string; line2: string } {
  const raw = addr.trim();
  if (!raw) return { line1: '', line2: '' };
  const parts = raw.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 1) {
    const s = parts[0];
    if (s.length <= 52) return { line1: s, line2: '' };
    const mid = Math.floor(s.length / 2);
    const spaceBefore = s.lastIndexOf(' ', mid + 14);
    const spaceAfter = s.indexOf(' ', Math.max(0, mid - 14));
    const splitAt =
      spaceBefore > mid - 18 ? spaceBefore : spaceAfter > 0 ? spaceAfter : mid;
    return { line1: s.slice(0, splitAt).trim(), line2: s.slice(splitAt).trim() };
  }
  const mid = Math.ceil(parts.length / 2);
  return {
    line1: parts.slice(0, mid).join(', '),
    line2: parts.slice(mid).join(', '),
  };
}

export function buildSpgsInvoiceHtmlDocument(ctx: SpgsInvoiceHtmlContext): string {
  const { data, branding: b, logoDataUrl } = ctx;
  const tm = mergeInvoiceTemplateConfig(ctx.templateConfig);
  const bEff = mergeSellerBranding(b, tm);
  const prim = tm.branding.colors.primary;
  const acc = tm.branding.colors.accent;
  const L = tm.labels;
  const V = tm.visibility;
  const Tv = tm.visibility.table;
  const effectiveLogo =
    logoDataUrl ?? (tm.branding.logoDataUrl?.trim() ? tm.branding.logoDataUrl : undefined);
  const base = data.computed.baseExclGst;
  const cgst = data.computed.cgst;
  const sgst = data.computed.sgst;
  const gstTotal = data.computed.gstAmount;
  const total = data.computed.totalInclGst;
  const watts = data.computed.watts;
  const ratePerW = data.computed.perWattDerived;
  const epc = data.computed.epc;
  const hsn = data.hsnSac?.trim() || DEFAULT_HSN;
  const kw = data.systemSizeKw;
  const roundOff = roundOffDelta(total, base, gstTotal);
  const panelMake = data.panelMake?.trim();
  const inverterMake = data.inverterMake?.trim();

  const panelSerialLines = (data.panelSerials ?? []).length
    ? escapeHtml((data.panelSerials ?? []).join(', '))
    : '—';
  const inverterSerialLines = (data.inverterSerials ?? []).length
    ? escapeHtml((data.inverterSerials ?? []).join(', '))
    : '—';

  const nameForContact = bEff.contactName?.trim() || bEff.companyName;
  const billName = data.companyName?.trim() || data.clientName;
  const companyNameDisplay =
    tm.branding.companyNameFormat === 'as_is'
      ? escapeHtml(bEff.companyName.trim())
      : escapeHtml(bEff.companyName.trim().toUpperCase());
  const addrTwo =
    tm.seller?.addressLine1 !== undefined || tm.seller?.addressLine2 !== undefined
      ? {
          line1: tm.seller?.addressLine1?.trim() || '',
          line2: tm.seller?.addressLine2?.trim() || '',
        }
      : formatAddressTwoLines(bEff.address || '');
  const systemSizeText = formatSystemSizeLine(tm.units, kw, watts);
  const showBuyerPhone = V.showBuyerPhoneInGrid !== false;
  const showBuyerGst = V.showBuyerGstinInGrid !== false;
  const showSellerStripGst = V.showSellerGstinInStrip !== false;

  const isEpc = data.gstMode === 'epc' && epc;
  const epcR = isEpc && epc ? epcDisplayRows(watts, ratePerW, epc) : null;

  const mainRate = fmtNum(base);
  const mainAmt = fmtNum(base);

  /** 8 columns: Sr | Description | HSN/SAC | Qty | Rate | per | Discount (%) | Amount */
  let bodyRows = '';
  const perMain = escapeHtml(mainPerLabel(tm.units));
  const totalUnitEsc = escapeHtml(totalQtyUnitLabel(tm.units));
  const G = tm.gstDisplay;
  const GT = L.gstTable;

  if (Tv.mainSystemLine) {
    bodyRows += `<tr>
    <td class="cen"></td>
    <td class="desc"><strong>${escapeHtml(L.lineItems.mainDescription)}</strong></td>
    <td class="cen">${escapeHtml(hsn)}</td>
    <td class="cen">1</td>
    <td class="num">${mainRate}</td>
    <td class="cen">${perMain}</td>
    <td class="num">—</td>
    <td class="num"><strong>${mainAmt}</strong></td>
  </tr>`;
  }

  if (Tv.solarPanels) {
    bodyRows += `<tr>
    <td class="cen">1</td>
    <td class="desc desc-sub"><strong><u>${escapeHtml(L.lineItems.solarPanels)}</u></strong></td>
    <td class="cen"></td>
    <td class="cen"></td>
    <td class="num"></td>
    <td class="cen"></td>
    <td class="num"></td>
    <td class="num"></td>
  </tr>`;

    const showPanelMake = Tv.panelMakeOnlyIfValue ? Boolean(panelMake) : true;
    if (showPanelMake) {
      const displayMake = panelMake ? escapeHtml(panelMake) : '—';
      bodyRows += `<tr>
      <td class="cen"></td>
      <td class="desc">${escapeHtml(L.lineItems.makePrefix)} ${displayMake}</td>
      <td class="cen"></td>
      <td class="cen"></td>
      <td class="num"></td>
      <td class="cen"></td>
      <td class="num"></td>
      <td class="num"></td>
    </tr>`;
    }

    if (Tv.panelSerials) {
      bodyRows += `<tr>
    <td class="cen"></td>
    <td class="desc">${escapeHtml(L.lineItems.serialPrefix)} ${panelSerialLines}</td>
    <td class="cen"></td>
    <td class="cen"></td>
    <td class="num"></td>
    <td class="cen"></td>
    <td class="num"></td>
    <td class="num"></td>
  </tr>`;
    }
  }

  if (Tv.inverter) {
    bodyRows += `<tr>
    <td class="cen">2</td>
    <td class="desc desc-sub"><strong><u>${escapeHtml(L.lineItems.inverter)}</u></strong></td>
    <td class="cen"></td>
    <td class="cen"></td>
    <td class="num"></td>
    <td class="cen"></td>
    <td class="num"></td>
    <td class="num"></td>
  </tr>`;

    const showInvMake = Tv.inverterMakeOnlyIfValue ? Boolean(inverterMake) : true;
    if (showInvMake) {
      const displayInv = inverterMake ? escapeHtml(inverterMake) : '—';
      bodyRows += `<tr>
      <td class="cen"></td>
      <td class="desc">${escapeHtml(L.lineItems.makePrefix)} ${displayInv}</td>
      <td class="cen"></td>
      <td class="cen"></td>
      <td class="num"></td>
      <td class="cen"></td>
      <td class="num"></td>
      <td class="num"></td>
    </tr>`;
    }

    if (Tv.inverterSerials) {
      bodyRows += `<tr>
    <td class="cen"></td>
    <td class="desc">${escapeHtml(L.lineItems.serialPrefix)} ${inverterSerialLines}</td>
    <td class="cen"></td>
    <td class="cen"></td>
    <td class="num"></td>
    <td class="cen"></td>
    <td class="num"></td>
    <td class="num"></td>
  </tr>`;
    }
  }

  if (Tv.bos) {
    bodyRows += `<tr>
    <td class="cen">3</td>
    <td class="desc desc-sub"><strong>${escapeHtml(L.lineItems.bos)}</strong></td>
    <td class="cen"></td>
    <td class="cen"></td>
    <td class="num"></td>
    <td class="cen"></td>
    <td class="num"></td>
    <td class="num"></td>
  </tr>`;
  }

  if (Tv.installation) {
    bodyRows += `<tr>
    <td class="cen">4</td>
    <td class="desc desc-sub"><strong>${escapeHtml(L.lineItems.installation)}</strong></td>
    <td class="cen"></td>
    <td class="cen"></td>
    <td class="num"></td>
    <td class="cen"></td>
    <td class="num"></td>
    <td class="num"></td>
  </tr>`;
  }

  if (Tv.commissioning) {
    bodyRows += `<tr>
    <td class="cen">5</td>
    <td class="desc desc-sub"><strong>${escapeHtml(L.lineItems.commissioning)}</strong></td>
    <td class="cen"></td>
    <td class="cen"></td>
    <td class="num"></td>
    <td class="cen"></td>
    <td class="num"></td>
    <td class="num"></td>
  </tr>`;
  }

  if (Tv.labour) {
    bodyRows += `<tr>
    <td class="cen">6</td>
    <td class="desc desc-sub"><strong>${escapeHtml(L.lineItems.labour)}</strong></td>
    <td class="cen"></td>
    <td class="cen"></td>
    <td class="num"></td>
    <td class="cen"></td>
    <td class="num"></td>
    <td class="num"></td>
  </tr>`;
  }

  for (const ex of tm.extraTableRows ?? []) {
    if (!ex.enabled || !String(ex.label ?? '').trim()) continue;
    bodyRows += `<tr>
    <td class="cen"></td>
    <td class="desc desc-sub"><strong>${escapeHtml(String(ex.label).trim())}</strong></td>
    <td class="cen"></td>
    <td class="cen"></td>
    <td class="num"></td>
    <td class="cen"></td>
    <td class="num"></td>
    <td class="num"></td>
  </tr>`;
  }

  bodyRows += `<tr>
    <td colspan="7" class="num bold" style="text-align:right">${escapeHtml(L.lineItems.subTotal)}</td>
    <td class="num bold">${fmtNum(base)}</td>
  </tr>`;

  let taxSummaryInner = '';
  if (V.gstBreakdown) {
    if (isEpc && epcR && epc) {
      const portion70 = epc.portion70Taxable;
      const portion30 = epc.portion30Taxable;
      taxSummaryInner = `<table class="inv inv-tax-summary" cellspacing="0" cellpadding="0">
  <colgroup>
    <col style="width:12%" />
    <col style="width:16%" />
    <col style="width:10%" />
    <col style="width:14%" />
    <col style="width:10%" />
    <col style="width:14%" />
    <col style="width:14%" />
  </colgroup>
  <thead>
    <tr>
      <th rowspan="2">${escapeHtml(GT.hsnSac)}</th>
      <th rowspan="2">${escapeHtml(GT.taxableValue)}</th>
      <th colspan="2">${escapeHtml(GT.centralTax)}</th>
      <th colspan="2">${escapeHtml(GT.stateTax)}</th>
      <th rowspan="2">${escapeHtml(GT.totalTaxAmount)}</th>
    </tr>
    <tr>
      <th>${escapeHtml(GT.rate)}</th>
      <th>${escapeHtml(GT.amount)}</th>
      <th>${escapeHtml(GT.rate)}</th>
      <th>${escapeHtml(GT.amount)}</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="cen">${escapeHtml(hsn)}</td>
      <td class="num">${fmtNum(portion70)}</td>
      <td class="cen">${escapeHtml(G.epc.cgstRate1)}</td>
      <td class="num">${fmtNum(epcR.cgst1)}</td>
      <td class="cen">${escapeHtml(G.epc.sgstRate1)}</td>
      <td class="num">${fmtNum(epcR.sgst1)}</td>
      <td class="num">${fmtNum(epcR.g1)}</td>
    </tr>
    <tr>
      <td class="cen">${escapeHtml(hsn)}</td>
      <td class="num">${fmtNum(portion30)}</td>
      <td class="cen">${escapeHtml(G.epc.cgstRate2)}</td>
      <td class="num">${fmtNum(epcR.cgst2)}</td>
      <td class="cen">${escapeHtml(G.epc.sgstRate2)}</td>
      <td class="num">${fmtNum(epcR.sgst2)}</td>
      <td class="num">${fmtNum(epcR.g2)}</td>
    </tr>
    <tr class="tax-total-row">
      <td colspan="6" class="num bold" style="text-align:right">${escapeHtml(GT.totalGstAmount)}</td>
      <td class="num bold">${fmtNum(gstTotal)}</td>
    </tr>
  </tbody>
</table>`;
    } else {
      taxSummaryInner = `<table class="inv inv-tax-summary" cellspacing="0" cellpadding="0">
  <colgroup>
    <col style="width:12%" />
    <col style="width:16%" />
    <col style="width:10%" />
    <col style="width:14%" />
    <col style="width:10%" />
    <col style="width:14%" />
    <col style="width:14%" />
  </colgroup>
  <thead>
    <tr>
      <th rowspan="2">${escapeHtml(GT.hsnSac)}</th>
      <th rowspan="2">${escapeHtml(GT.taxableValue)}</th>
      <th colspan="2">${escapeHtml(GT.centralTax)}</th>
      <th colspan="2">${escapeHtml(GT.stateTax)}</th>
      <th rowspan="2">${escapeHtml(GT.totalTaxAmount)}</th>
    </tr>
    <tr>
      <th>${escapeHtml(GT.rate)}</th>
      <th>${escapeHtml(GT.amount)}</th>
      <th>${escapeHtml(GT.rate)}</th>
      <th>${escapeHtml(GT.amount)}</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="cen">${escapeHtml(hsn)}</td>
      <td class="num">${fmtNum(base)}</td>
      <td class="cen">${base > 0 ? `${((cgst / base) * 100).toFixed(2)}%` : '—'}</td>
      <td class="num">${fmtNum(cgst)}</td>
      <td class="cen">${base > 0 ? `${((sgst / base) * 100).toFixed(2)}%` : '—'}</td>
      <td class="num">${fmtNum(sgst)}</td>
      <td class="num">${fmtNum(gstTotal)}</td>
    </tr>
    <tr class="tax-total-row">
      <td colspan="6" class="num bold" style="text-align:right">${escapeHtml(GT.totalGstAmount)}</td>
      <td class="num bold">${fmtNum(gstTotal)}</td>
    </tr>
  </tbody>
</table>`;
    }
  }

  if (V.gstBreakdown && taxSummaryInner) {
    bodyRows += `<tr class="tax-summary-wrap">
    <td colspan="8">${taxSummaryInner}</td>
  </tr>`;
  }

  bodyRows += `<tr>
    <td colspan="7" class="num bold" style="text-align:right">${escapeHtml(L.lineItems.roundOff)}</td>
    <td class="num">${fmtNum(roundOff)}</td>
  </tr>`;

  bodyRows += `<tr>
    <td colspan="4" class="cen bold">${escapeHtml(L.lineItems.totalEquals)}</td>
    <td class="cen bold">1</td>
    <td class="cen bold">${totalUnitEsc}</td>
    <td class="cen"></td>
    <td class="num bold">${fmtNum(total)}</td>
  </tr>`;

  /** `amountToWordsINR` already ends with "Rupees Only" — do not append another "Only". */
  const wordsLine = escapeHtml(amountToWordsINR(total).toUpperCase());
  const cssFont =
    tm.branding.fontFamily.replace(/[;{}<>]/g, '').trim() || 'Arial, Helvetica, sans-serif';
  const FG = L.footer;
  const TH = L.tableHead;

  let customerGridRows = '';
  if (data.address) {
    customerGridRows += `<tr><td class="lab">${escapeHtml(L.grid.address)}</td><td>${escapeHtml(data.address)}</td><td class="lab lab-nowrap">${escapeHtml(L.grid.invoiceDate)}</td><td class="grid-date-val">${escapeHtml(data.date)}</td></tr>`;
    if (showBuyerPhone) {
      customerGridRows += `<tr>
        <td class="lab">${escapeHtml(L.grid.phone)}</td><td>${escapeHtml(data.contact?.trim() || '—')}</td>
        <td class="lab lab-nowrap">${escapeHtml(L.grid.dueDate)}</td><td class="grid-date-val">${escapeHtml(data.dueDate ?? '—')}</td>
      </tr>`;
    } else {
      customerGridRows += `<tr>
        <td colspan="2"></td>
        <td class="lab lab-nowrap">${escapeHtml(L.grid.dueDate)}</td><td class="grid-date-val">${escapeHtml(data.dueDate ?? '—')}</td>
      </tr>`;
    }
    if (showBuyerGst) {
      customerGridRows += `<tr>
        <td class="lab">${escapeHtml(L.grid.gstin)}</td><td>${escapeHtml(data.gstin?.trim() || '—')}</td>
        <td class="lab">${escapeHtml(L.grid.transport)}</td><td>${escapeHtml(data.transport ?? '—')}</td>
      </tr>`;
    } else {
      customerGridRows += `<tr>
        <td colspan="2"></td>
        <td class="lab">${escapeHtml(L.grid.transport)}</td><td>${escapeHtml(data.transport ?? '—')}</td>
      </tr>`;
    }
    customerGridRows += `<tr>
        <td class="lab">${escapeHtml(L.grid.placeOfSupply)}</td><td>${escapeHtml(data.placeOfSupply ?? '—')}</td>
        <td></td><td></td>
      </tr>
      <tr>
        <td class="lab">${escapeHtml(L.grid.siteName)}</td><td>${escapeHtml(data.siteName?.trim() || '—')}</td>
        <td class="lab">${escapeHtml(L.grid.systemSize)}</td><td>${systemSizeText}</td>
      </tr>`;
  } else {
    if (showBuyerPhone) {
      customerGridRows += `<tr>
        <td class="lab">${escapeHtml(L.grid.phone)}</td><td>${escapeHtml(data.contact?.trim() || '—')}</td>
        <td class="lab lab-nowrap">${escapeHtml(L.grid.invoiceDate)}</td><td class="grid-date-val">${escapeHtml(data.date)}</td>
      </tr>`;
    } else {
      customerGridRows += `<tr>
        <td colspan="2"></td>
        <td class="lab lab-nowrap">${escapeHtml(L.grid.invoiceDate)}</td><td class="grid-date-val">${escapeHtml(data.date)}</td>
      </tr>`;
    }
    if (showBuyerGst) {
      customerGridRows += `<tr>
        <td class="lab">${escapeHtml(L.grid.gstin)}</td><td>${escapeHtml(data.gstin?.trim() || '—')}</td>
        <td class="lab lab-nowrap">${escapeHtml(L.grid.dueDate)}</td><td class="grid-date-val">${escapeHtml(data.dueDate ?? '—')}</td>
      </tr>`;
    } else {
      customerGridRows += `<tr>
        <td colspan="2"></td>
        <td class="lab lab-nowrap">${escapeHtml(L.grid.dueDate)}</td><td class="grid-date-val">${escapeHtml(data.dueDate ?? '—')}</td>
      </tr>`;
    }
    customerGridRows += `<tr>
        <td class="lab">${escapeHtml(L.grid.placeOfSupply)}</td><td>${escapeHtml(data.placeOfSupply ?? '—')}</td>
        <td class="lab">${escapeHtml(L.grid.transport)}</td><td>${escapeHtml(data.transport ?? '—')}</td>
      </tr>
      <tr>
        <td class="lab">${escapeHtml(L.grid.siteName)}</td><td>${escapeHtml(data.siteName?.trim() || '—')}</td>
        <td class="lab">${escapeHtml(L.grid.systemSize)}</td><td>${systemSizeText}</td>
      </tr>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Tax Invoice ${escapeHtml(data.invoiceNo)}</title>
  <style>
    * { box-sizing: border-box; }
    :root {
      --inv-line: ${acc};
      --inv-line-thin: 0.75px solid ${acc};
    }
    body {
      font-family: ${cssFont};
      font-size: 10px;
      color: #000;
      margin: 0;
      padding: 6px 8px;
      line-height: 1.3;
    }
    .page-wrap { max-width: 210mm; margin: 0 auto; }
    .invoice-header {
      margin: 0 0 0 0;
      padding: 0 0 6px 0;
      border-bottom: var(--inv-line-thin);
    }
    .top-tbl { width: 100%; border-collapse: collapse; }
    .top-tbl td { vertical-align: top; padding: 0; border: none; }
    .header-left { border-collapse: collapse; }
    .header-left td { border: none; padding: 0; vertical-align: top; }
    .header-logo-cell { width: 132px; padding-right: 14px; text-align: center; }
    .header-logo-img { display: block; max-width: 120px; width: 120px; height: auto; margin: 0 auto; }
    .co-name-allcaps {
      font-size: 13px;
      font-weight: 700;
      line-height: 1.22;
      color: #000;
      letter-spacing: 0.02em;
    }
    .co-addr-block { margin-top: 4px; max-width: 42em; }
    .co-addr-line {
      font-size: 10px;
      font-weight: 400;
      line-height: 1.4;
      margin-top: 3px;
      color: #1a1a1a;
      text-align: left;
      letter-spacing: 0.01em;
    }
    .co-addr-line:first-child { margin-top: 0; }
    .header-contact {
      line-height: 1.4;
      padding-top: 0;
    }
    .header-contact div { margin-bottom: 3px; font-size: 10px; color: #1a1a1a; }
    .header-contact strong { font-weight: 700; }
    .outer { border: 2px solid var(--inv-line); padding: 8px; }
    .strip-tbl {
      width: 100%;
      border-collapse: collapse;
      border-top: var(--inv-line-thin);
      border-bottom: var(--inv-line-thin);
      background: #f5f8fc;
      margin-bottom: 4px;
    }
    .strip-tbl td { padding: 5px 6px; border: none; }
    .grid2 {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 4px;
      border: var(--inv-line-thin);
      table-layout: fixed;
    }
    .grid2 col.col-inv-v { width: 40%; }
    .grid2 col.col-inv-l { width: 18%; }
    .grid2 col.col-cust-v { width: 26%; }
    .grid2 col.col-cust-l { width: 16%; }
    .grid2 td { border: var(--inv-line-thin); padding: 4px 6px; vertical-align: top; }
    .grid2 .lab { font-weight: 600; }
    .grid2 td.grid-date-val,
    .grid2 td.lab-nowrap {
      white-space: nowrap;
    }
    table.inv {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin: 4px 0 2px;
      border: var(--inv-line-thin);
    }
    table.inv th, table.inv td {
      border: var(--inv-line-thin);
      padding: 3px 4px;
      vertical-align: top;
      word-wrap: break-word;
    }
    table.inv thead th {
      font-weight: 700;
      text-align: center;
      background: #eef4fb;
      color: ${prim};
    }
    .desc { text-align: left; }
    .cen { text-align: center; }
    .num { text-align: right; }
    .bold { font-weight: 700; }
    td.desc-sub { padding-left: 14px; }
    tr.tax-summary-wrap td {
      padding: 0;
      vertical-align: top;
      border: var(--inv-line-thin);
    }
    table.inv-tax-summary {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin: 0;
      font-size: 9px;
    }
    table.inv-tax-summary th,
    table.inv-tax-summary td {
      border: var(--inv-line-thin);
      padding: 3px 4px;
      vertical-align: middle;
    }
    table.inv-tax-summary thead th {
      font-weight: 700;
      text-align: center;
      background: #eef4fb;
      color: ${prim};
    }
    table.inv-tax-summary .num { text-align: right; }
    table.inv-tax-summary .cen { text-align: center; }
    tr.tax-total-row td { font-size: 10px; }
    .footer-block {
      margin-top: 4px;
    }
    .footer-2col {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      border: var(--inv-line-thin);
    }
    .footer-2col > tbody > tr > td {
      border: var(--inv-line-thin);
      vertical-align: top;
      padding: 0;
    }
    .footer-2col-left { width: 64%; }
    .footer-2col-right { width: 36%; }
    .footer-section-keep {
      page-break-inside: avoid;
      break-inside: avoid;
      border: var(--inv-line-thin);
    }
    .footer-section-keep + .footer-section-keep {
      margin-top: -1px;
    }
    .footer-sign-block-keep {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .footer-left-stack {
      width: 100%;
      border-collapse: collapse;
    }
    .footer-left-stack th.footer-section-h {
      background: #eef4fb;
      color: ${prim};
      font-weight: 700;
      text-align: center;
      font-size: 10px;
      padding: 5px 8px;
      border-bottom: var(--inv-line-thin);
    }
    .footer-left-stack td.footer-section-c {
      padding: 6px 10px;
      font-size: 10px;
      border-bottom: none;
      vertical-align: top;
    }
    .footer-words {
      text-align: center;
      line-height: 1.35;
      letter-spacing: 0.03em;
    }
    table.bank-inner {
      width: 100%;
      border-collapse: collapse;
    }
    table.bank-inner td {
      padding: 4px 0;
      font-size: 10px;
      vertical-align: top;
      border: none;
    }
    .bank-inner .bank-lab {
      font-weight: 700;
      width: 30%;
      padding-right: 10px;
      white-space: nowrap;
    }
    .bank-inner .bank-val {
      text-align: left;
      line-height: 1.4;
    }
    .footer-pt-list {
      margin: 0;
      padding-left: 20px;
      line-height: 1.55;
      text-align: left;
    }
    .footer-pt-list li { margin: 0 0 3px 0; padding-left: 2px; }
    @media print {
      .footer-section-keep,
      .footer-sign-block-keep {
        page-break-inside: avoid;
        break-inside: avoid;
      }
    }
    .footer-right-inner {
      padding: 6px 10px 8px;
      font-size: 10px;
    }
    .sum-line {
      width: 100%;
      border-collapse: collapse;
    }
    .sum-line td {
      padding: 3px 0;
      font-size: 11px;
      border: none;
    }
    .sum-line td:first-child { text-align: left; font-weight: 400; }
    .sum-line td:last-child {
      text-align: right;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .sum-line tr.sum-grand td {
      padding-top: 6px;
      border-top: var(--inv-line-thin);
      font-size: 12px;
      font-weight: 700;
    }
    .sum-line tr.sum-grand td:last-child { font-size: 13px; }
    .footer-eoe {
      text-align: right;
      font-size: 10px;
      margin-top: 4px;
      padding-right: 2px;
    }
    .footer-cert {
      text-align: center;
      font-size: 9px;
      line-height: 1.35;
      margin-top: 6px;
      padding: 0 4px;
    }
    .footer-for {
      text-align: center;
      font-weight: 700;
      margin-top: 8px;
      font-size: 10px;
    }
    .footer-sig-space {
      min-height: 12mm;
      margin-top: 4px;
      border-bottom: var(--inv-line-thin);
    }
    .footer-signatory {
      text-align: center;
      font-weight: 700;
      font-size: 10px;
      margin-top: 4px;
    }
    .footer-system-gen {
      text-align: center;
      font-size: 9px;
      color: #333;
      margin-top: 4px;
      line-height: 1.3;
    }
  </style>
</head>
<body>
  <div class="page-wrap">
    ${
      V.header
        ? `<header class="invoice-header">
      <table class="top-tbl" cellspacing="0" cellpadding="0" width="100%">
        <tr>
          <td style="width:62%">
            ${
              effectiveLogo
                ? `<table class="header-left" cellspacing="0" cellpadding="0">
              <tr>
                <td class="header-logo-cell">
                  <img src="${effectiveLogo}" alt="" class="header-logo-img" />
                </td>
                <td>
                  <div class="co-name-allcaps">${companyNameDisplay}</div>
                  ${
                    addrTwo.line1 || addrTwo.line2
                      ? `<div class="co-addr-block">
                    ${addrTwo.line1 ? `<div class="co-addr-line">${escapeHtml(addrTwo.line1)}</div>` : ''}
                    ${addrTwo.line2 ? `<div class="co-addr-line">${escapeHtml(addrTwo.line2)}</div>` : ''}
                  </div>`
                      : ''
                  }
                </td>
              </tr>
            </table>`
                : `<div>
                  <div class="co-name-allcaps">${companyNameDisplay}</div>
                  ${
                    addrTwo.line1 || addrTwo.line2
                      ? `<div class="co-addr-block">
                    ${addrTwo.line1 ? `<div class="co-addr-line">${escapeHtml(addrTwo.line1)}</div>` : ''}
                    ${addrTwo.line2 ? `<div class="co-addr-line">${escapeHtml(addrTwo.line2)}</div>` : ''}
                  </div>`
                      : ''
                  }
                </div>`
            }
          </td>
          <td style="width:38%; text-align:right" class="header-contact">
            <div><strong>${escapeHtml(L.contact.namePrefix)}</strong> ${escapeHtml(nameForContact)}</div>
            <div><strong>${escapeHtml(L.contact.phonePrefix)}</strong> ${escapeHtml(bEff.phone)}</div>
            <div><strong>${escapeHtml(L.contact.emailPrefix)}</strong> ${escapeHtml(bEff.email)}</div>
          </td>
        </tr>
      </table>
    </header>`
        : ''
    }

    <div class="outer">
    ${
      V.strip
        ? `<table class="strip-tbl" cellspacing="0" cellpadding="0">
      <tr>
        <td style="width:28%; font-weight:700">${
          showSellerStripGst
            ? `${escapeHtml(L.strip.gstinPrefix)} ${escapeHtml(bEff.gstin || '—')}`
            : '&nbsp;'
        }</td>
        <td style="width:44%; text-align:center; font-size:14px; font-weight:700; color:${prim}">${escapeHtml(L.strip.taxInvoice)}</td>
        <td style="width:28%; text-align:right; font-weight:700; color:${prim}; font-size:10px">${escapeHtml(L.strip.originalForRecipient)}</td>
      </tr>
    </table>`
        : ''
    }

    ${
      V.customerGrid
        ? `<table class="grid2" cellspacing="0" cellpadding="0">
      <colgroup>
        <col class="col-cust-l" />
        <col class="col-cust-v" />
        <col class="col-inv-l" />
        <col class="col-inv-v" />
      </colgroup>
      <tr>
        <td colspan="2" style="font-weight:600">${escapeHtml(L.grid.customerTitle)}</td>
        <td colspan="2" style="font-weight:600">${escapeHtml(L.grid.invoiceTitle)}</td>
      </tr>
      <tr>
        <td class="lab">${escapeHtml(L.grid.ms)}</td><td>${escapeHtml(billName)}</td>
        <td class="lab">${escapeHtml(L.grid.invoiceNo)}</td><td>${escapeHtml(data.invoiceNo)}</td>
      </tr>
      ${customerGridRows}
    </table>`
        : ''
    }

    <table class="inv" cellspacing="0" cellpadding="0">
      <colgroup>
        <col style="width:5%" />
        <col style="width:28%" />
        <col style="width:10%" />
        <col style="width:8%" />
        <col style="width:11%" />
        <col style="width:8%" />
        <col style="width:10%" />
        <col style="width:20%" />
      </colgroup>
      <thead>
        <tr>
          <th>${escapeHtml(TH.srNo)}</th>
          <th>${escapeHtml(TH.description)}</th>
          <th>${escapeHtml(TH.hsnSac)}</th>
          <th>${escapeHtml(TH.quantity)}</th>
          <th>${escapeHtml(TH.rate)}</th>
          <th>${escapeHtml(TH.per)}</th>
          <th>${escapeHtml(TH.discount)}</th>
          <th>${escapeHtml(TH.amount)}</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>

    <div class="footer-block">
      <table class="footer-2col" cellspacing="0" cellpadding="0" width="100%">
        <tr>
          <td class="footer-2col-left" colspan="${V.rightSummary ? 1 : 2}">
            ${
              V.totalInWords
                ? `<div class="footer-section-keep">
              <table class="footer-left-stack" cellspacing="0" cellpadding="0" width="100%">
                <tr>
                  <th class="footer-section-h">${escapeHtml(FG.totalInWords)}</th>
                </tr>
                <tr>
                  <td class="footer-section-c footer-words">
                    <strong>${escapeHtml(L.sumLineInrPrefix)}</strong> ${wordsLine}
                  </td>
                </tr>
              </table>
            </div>`
                : ''
            }
            ${
              V.bankDetails
                ? `<div class="footer-section-keep">
              <table class="footer-left-stack" cellspacing="0" cellpadding="0" width="100%">
                <tr>
                  <th class="footer-section-h">${escapeHtml(FG.bankDetails)}</th>
                </tr>
                <tr>
                  <td class="footer-section-c">
                    <table class="bank-inner" cellspacing="0" cellpadding="0">
                      <tr>
                        <td class="bank-lab">${escapeHtml(FG.bankName)}</td>
                        <td class="bank-val">${escapeHtml(bEff.bankName)}</td>
                      </tr>
                      <tr>
                        <td class="bank-lab">${escapeHtml(FG.bankBranch)}</td>
                        <td class="bank-val">${escapeHtml(bEff.bankBranch)}</td>
                      </tr>
                      <tr>
                        <td class="bank-lab">${escapeHtml(FG.bankAccName)}</td>
                        <td class="bank-val">${escapeHtml(bEff.bankAccountName)}</td>
                      </tr>
                      <tr>
                        <td class="bank-lab">${escapeHtml(FG.bankAccNo)}</td>
                        <td class="bank-val">${escapeHtml(bEff.bankAccount)}</td>
                      </tr>
                      <tr>
                        <td class="bank-lab">${escapeHtml(FG.bankIfsc)}</td>
                        <td class="bank-val">${escapeHtml(bEff.bankIfsc)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </div>`
                : ''
            }
            ${
              V.paymentTerms
                ? `<div class="footer-section-keep">
              <table class="footer-left-stack" cellspacing="0" cellpadding="0" width="100%">
                <tr>
                  <th class="footer-section-h">${escapeHtml(FG.paymentTerms)}</th>
                </tr>
                <tr>
                  <td class="footer-section-c">
                    <ol class="footer-pt-list">
                      ${bEff.paymentTermsBullets.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
                    </ol>
                  </td>
                </tr>
              </table>
            </div>`
                : ''
            }
          </td>
          ${
            V.rightSummary
              ? `<td class="footer-2col-right">
            <div class="footer-right-inner">
              <table class="sum-line" cellspacing="0" cellpadding="0" width="100%">
                <tr><td>${escapeHtml(FG.taxableAmount)}</td><td>${fmtNum(base)}</td></tr>
                <tr><td>${escapeHtml(FG.addCgst)}</td><td>${fmtNum(cgst)}</td></tr>
                <tr><td>${escapeHtml(FG.addSgst)}</td><td>${fmtNum(sgst)}</td></tr>
                <tr><td>${escapeHtml(FG.totalTax)}</td><td>${fmtNum(gstTotal)}</td></tr>
                <tr class="sum-grand">
                  <td>${escapeHtml(FG.totalAfterTax)}</td>
                  <td>₹${fmtNum(total)}</td>
                </tr>
              </table>
              <div class="footer-eoe">${escapeHtml(FG.eoe)}</div>
              <div class="footer-cert">${escapeHtml(FG.certified)}</div>
              <div class="footer-sign-block-keep">
                <div class="footer-for">${escapeHtml(FG.forPrefix)} ${escapeHtml(bEff.companyName)}</div>
                <div class="footer-sig-space"></div>
                <div class="footer-signatory">${escapeHtml(FG.authorisedSignatory)}</div>
                <div class="footer-system-gen">${escapeHtml(FG.systemGenerated)}</div>
              </div>
            </div>
          </td>`
              : ''
          }
        </tr>
      </table>
    </div>
    </div>
  </div>
</body>
</html>`;
}
