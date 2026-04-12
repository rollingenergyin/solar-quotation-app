/**
 * Bulk invoice import: XLSX parsing, optional PDF text extraction, validation helpers.
 * Invoice creation uses the same payloads as POST /finance/invoices (handled in routes).
 */

import * as XLSX from 'xlsx';
import type { InvoiceMainKind, InvoiceSubtype } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type { SpgsInput } from './invoice-spgs.service.js';

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;

export function isValidGstin(s: string | null | undefined): boolean {
  if (!s || typeof s !== 'string') return false;
  const t = s.trim().toUpperCase();
  return t.length === 15 && GSTIN_REGEX.test(t);
}

function normHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[()]/g, '');
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map((h) => normHeader(h));
  for (const a of aliases) {
    const na = normHeader(a);
    const i = normalized.findIndex((h) => h === na || h.includes(na) || na.includes(h));
    if (i >= 0) return i;
  }
  return -1;
}

const COL = {
  documentNumber: [
    'document number',
    'invoice no',
    'invoice number',
    'document no',
    'doc no',
    'inv no',
  ],
  invoiceDate: ['invoice date', 'date', 'document date', 'bill date'],
  documentKind: [
    'document kind',
    'kind',
    'main kind',
    'document type',
    'tax / proforma',
  ],
  subtype: ['subtype', 'invoice subtype', 'sub type'],
  consumerName: ['consumer name', 'client', 'customer', 'customer name', 'name', 'bill to'],
  gstin: ['gstin', 'gst', 'gst no'],
  systemSize: [
    'total system size',
    'system size',
    'kw dc',
    'kw',
    'size kw',
    'capacity kw',
  ],
  /** Taxable / base amount excluding GST */
  amount: [
    'base amount',
    'base excl gst',
    'amount excl gst',
    'amount excluding gst',
    'taxable amount',
    'taxable',
    'base',
    'amount',
    'total',
    'total amount',
  ],
  /** Matches finance invoice templates (name or id); optional */
  template: [
    'invoice template',
    'template',
    'layout',
    'pdf template',
    'template name',
    'invoice category',
    'template category',
    'category',
  ],
  /** Client phone — maps to FinanceClient.contact; optional */
  phone: [
    'phone',
    'phone number',
    'mobile',
    'mobile number',
    'contact',
    'tel',
    'cell',
  ],
  /** Non-SPGS line item description; optional — blank cell = no description on invoice */
  lineDescription: [
    'line description',
    'item description',
    'remarks',
    'notes',
    'line remarks',
  ],
  /** SPGS site block — optional; blank = omitted on invoice */
  siteName: ['site name', 'installation site', 'project site', 'site'],
  siteAddress: ['site address', 'installation address', 'project address'],
};

function parseNumberFlexible(raw: string | number | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'number' && !Number.isNaN(raw)) return raw;
  const s = String(raw).trim();
  if (!s) return null;
  const cleaned = s.replace(/[₹,\s]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Parse Excel serial or DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD → YYYY-MM-DD or null */
export function parseFlexibleDateToIso(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  if (typeof raw === 'number' && !Number.isNaN(raw)) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + raw * 86400000);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
    return null;
  }
  const s = String(raw).trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
  }
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(s);
  if (m) {
    let d = Number(m[1]);
    let mo = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    if (mo > 12) {
      const t = d;
      d = mo;
      mo = t;
    }
    const dt = new Date(Date.UTC(y, mo - 1, d));
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
  }
  return null;
}

export function mapDocumentKind(raw: string | null | undefined): InvoiceMainKind | null {
  if (!raw || typeof raw !== 'string') return null;
  const u = raw.trim().toUpperCase().replace(/\s+/g, '_');
  if (u.includes('TAX') && u.includes('INVOICE')) return 'TAX_INVOICE';
  if (u === 'TAX' || u === 'TAX_INVOICE') return 'TAX_INVOICE';
  if (u.includes('PROFORMA')) return 'PROFORMA_INVOICE';
  if (u.includes('QUOTATION') || u === 'QUOTE' || u === 'QUOTATION') return 'QUOTATION';
  if (u.includes('EWAY') || u.includes('E-WAY')) return 'EWAY_BILL';
  const compact = raw.trim().toLowerCase();
  if (compact.includes('tax')) return 'TAX_INVOICE';
  if (compact.includes('proforma')) return 'PROFORMA_INVOICE';
  if (compact.includes('quot')) return 'QUOTATION';
  return null;
}

export function mapSubtype(raw: string | null | undefined): InvoiceSubtype | null {
  if (!raw || typeof raw !== 'string') return null;
  const u = raw.trim().toUpperCase();
  if (u.includes('SPGS')) return 'SPGS';
  if (u.includes('SERVICE')) return 'SERVICE';
  if (u.includes('PRODUCT')) return 'PRODUCT';
  return null;
}

export type BulkNormalizedRow = {
  rowIndex: number;
  documentNumber: string | null;
  invoiceDate: string;
  mainKind: InvoiceMainKind;
  subtype: InvoiceSubtype;
  consumerName: string;
  /** Optional in bulk import — omit or leave column blank when unknown */
  gstin: string | null;
  systemSizeKw: number;
  /** Taxable value before GST (upload column). */
  baseExclGst: number;
  /** Optional: invoice layout — template id or name (resolved server-side). */
  templateId?: string | null;
  templateInput?: string | null;
  /** Saved on FinanceClient.contact when non-empty */
  clientPhone?: string | null;
  /** Non-SPGS line description; blank = none printed */
  lineDescription?: string | null;
  /** SPGS only; blank = omitted from invoice */
  siteName?: string | null;
  siteAddress?: string | null;
};

export type BulkParsedRow = {
  rowIndex: number;
  documentNumber: string | null;
  invoiceDate: string | null;
  documentKindRaw: string | null;
  subtypeRaw: string | null;
  consumerName: string | null;
  gstin: string | null;
  systemSizeKw: number | null;
  baseExclGst: number | null;
  /** Raw template/category cell (optional). */
  templateInput: string | null;
  clientPhone: string | null;
  lineDescription: string | null;
  siteName: string | null;
  siteAddress: string | null;
  errors: string[];
  /** Present when the row is valid — use for bulk create. */
  normalized?: BulkNormalizedRow;
};

function validateAndNormalizeRow(r: Omit<BulkParsedRow, 'errors' | 'normalized'>): BulkParsedRow {
  const errors: string[] = [];
  if (!r.consumerName?.trim()) errors.push('Missing consumer name');
  if (!r.invoiceDate) errors.push('Missing or invalid invoice date');
  if (!r.documentKindRaw?.trim()) errors.push('Missing document kind');
  if (!r.subtypeRaw?.trim()) errors.push('Missing subtype');
  const mainKind = mapDocumentKind(r.documentKindRaw);
  if (!mainKind) errors.push('Invalid document kind (use Tax / Proforma / Quotation)');
  const subtype = mapSubtype(r.subtypeRaw);
  if (!subtype) errors.push('Invalid subtype (use SPGS / Service / Product)');
  if (r.gstin?.trim() && !isValidGstin(r.gstin)) errors.push('Invalid GSTIN format');
  const amt = r.baseExclGst;
  if (amt === null || amt === undefined || Number.isNaN(amt) || amt <= 0) {
    errors.push('Missing or invalid base amount excl. GST (must be > 0)');
  }
  const kw = r.systemSizeKw;
  if (kw === null || kw === undefined || Number.isNaN(kw) || kw <= 0) {
    errors.push('Missing or invalid system size kW (must be > 0)');
  }
  if (r.documentNumber?.trim()) {
    if (!/^\d+$/.test(r.documentNumber.trim())) {
      errors.push('Document number must be digits only');
    }
  }
  return { ...r, errors };
}

function rowFromSheet(
  rowIndex: number,
  cells: (string | number | undefined)[],
  idx: Record<string, number>
): BulkParsedRow {
  const get = (key: keyof typeof COL) => {
    const i = idx[key];
    if (i === undefined || i < 0) return null;
    const v = cells[i];
    if (v === undefined || v === null) return null;
    return String(v).trim() || null;
  };

  const docNum = get('documentNumber');
  const dateRaw = cells[idx.invoiceDate] ?? null;
  const invoiceDate = parseFlexibleDateToIso(dateRaw);
  const documentKindRaw = get('documentKind');
  const subtypeRaw = get('subtype');
  const consumerName = get('consumerName');
  const gstinRaw = get('gstin');
  const gstin = gstinRaw ? gstinRaw.trim().toUpperCase() : null;
  const systemSizeKw = parseNumberFlexible(cells[idx.systemSize] as string | number);
  const baseExclGst = parseNumberFlexible(cells[idx.amount] as string | number);
  let templateInput: string | null = null;
  if (idx.template >= 0) {
    const tv = cells[idx.template];
    if (tv !== undefined && tv !== null && String(tv).trim()) {
      templateInput = String(tv).trim();
    }
  }
  const clientPhone = idx.phone >= 0 ? get('phone') : null;
  const lineDescription = idx.lineDescription >= 0 ? get('lineDescription') : null;
  const siteName = idx.siteName >= 0 ? get('siteName') : null;
  const siteAddress = idx.siteAddress >= 0 ? get('siteAddress') : null;

  const base: Omit<BulkParsedRow, 'errors'> = {
    rowIndex,
    documentNumber: docNum,
    invoiceDate,
    documentKindRaw,
    subtypeRaw,
    consumerName,
    gstin,
    systemSizeKw,
    baseExclGst,
    templateInput,
    clientPhone,
    lineDescription,
    siteName,
    siteAddress,
  };
  return attachNormalized(validateAndNormalizeRow(base));
}

export function parseBulkInvoiceXlsx(buffer: Buffer): {
  rows: BulkParsedRow[];
  sheetName: string | null;
} {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = wb.SheetNames[0] ?? null;
  if (!sheetName) return { rows: [], sheetName: null };
  const sheet = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json<(string | number | undefined)[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
  }) as (string | number | undefined)[][];
  if (!data.length) return { rows: [], sheetName };

  const headerRow = data[0]?.map((c) => String(c ?? '')) ?? [];
  const idx = {
    documentNumber: findColumnIndex(headerRow, COL.documentNumber),
    invoiceDate: findColumnIndex(headerRow, COL.invoiceDate),
    documentKind: findColumnIndex(headerRow, COL.documentKind),
    subtype: findColumnIndex(headerRow, COL.subtype),
    consumerName: findColumnIndex(headerRow, COL.consumerName),
    gstin: findColumnIndex(headerRow, COL.gstin),
    systemSize: findColumnIndex(headerRow, COL.systemSize),
    amount: findColumnIndex(headerRow, COL.amount),
    template: findColumnIndex(headerRow, COL.template),
    phone: findColumnIndex(headerRow, COL.phone),
    lineDescription: findColumnIndex(headerRow, COL.lineDescription),
    siteName: findColumnIndex(headerRow, COL.siteName),
    siteAddress: findColumnIndex(headerRow, COL.siteAddress),
  };

  const required = ['invoiceDate', 'documentKind', 'subtype', 'consumerName', 'systemSize', 'amount'] as const;
  const missingCols = required.filter((k) => idx[k] < 0);
  const rows: BulkParsedRow[] = [];
  if (missingCols.length > 0) {
    rows.push({
      rowIndex: 0,
      documentNumber: null,
      invoiceDate: null,
      documentKindRaw: null,
      subtypeRaw: null,
      consumerName: null,
      gstin: null,
      systemSizeKw: null,
      baseExclGst: null,
      templateInput: null,
      clientPhone: null,
      lineDescription: null,
      siteName: null,
      siteAddress: null,
      errors: [
        `Missing required column(s): ${missingCols.join(', ')}. Use headers: Document number, Invoice Date, Document kind, Subtype, Consumer Name, Total system size, Base amount (excl. GST). Optional: GSTIN, Phone, Invoice template, Line description, Site name/address.`,
      ],
    });
    return { rows, sheetName };
  }

  const colPositions = Object.values(idx).filter((n) => n >= 0);
  const maxCol = colPositions.length ? Math.max(...colPositions) : 0;

  for (let i = 1; i < data.length; i++) {
    const line = data[i];
    if (!line || !line.some((c) => String(c ?? '').trim() !== '')) continue;
    const cells = line.map((c) => c);
    while (cells.length < maxCol + 1) cells.push('');
    const parsed = rowFromSheet(i + 1, cells as (string | number | undefined)[], idx);
    rows.push(parsed);
  }

  return { rows, sheetName };
}

export type PdfParseResult = {
  rows: BulkParsedRow[];
  pdfNeedsManualMapping: boolean;
  pdfNote: string | null;
  textPreview: string | null;
};

export async function parseBulkInvoicePdf(buffer: Buffer): Promise<PdfParseResult> {
  const pdfParse = (await import('pdf-parse')).default as (b: Buffer) => Promise<{ text: string }>;
  let text = '';
  try {
    const res = await pdfParse(buffer);
    text = res.text ?? '';
  } catch {
    return {
      rows: [],
      pdfNeedsManualMapping: true,
      pdfNote: 'Could not read PDF text. Use XLSX for bulk import.',
      textPreview: null,
    };
  }
  const preview = text.slice(0, 2500).replace(/\s+/g, ' ').trim();
  const gstinMatches = text.match(/[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}/gi) ?? [];
  const uniqueGst = [...new Set(gstinMatches.map((g) => g.toUpperCase()))];

  if (uniqueGst.length === 0) {
    return {
      rows: [],
      pdfNeedsManualMapping: true,
      pdfNote:
        'No GSTIN patterns found in PDF. Structured bulk import needs XLSX. You can copy data into the template and upload the spreadsheet.',
      textPreview: preview || null,
    };
  }

  const rows: BulkParsedRow[] = uniqueGst.map((gstin, i) =>
    attachNormalized(
      validateAndNormalizeRow({
        rowIndex: i + 1,
        documentNumber: null,
        invoiceDate: null,
        documentKindRaw: null,
        subtypeRaw: null,
        consumerName: null,
        gstin,
        systemSizeKw: null,
        baseExclGst: null,
        templateInput: null,
        clientPhone: null,
        lineDescription: null,
        siteName: null,
        siteAddress: null,
      })
    )
  );

  return {
    rows,
    pdfNeedsManualMapping: true,
    pdfNote:
      'PDF does not provide a full table. Only GSTIN-like strings were detected; other fields must be filled manually or use XLSX.',
    textPreview: preview || null,
  };
}

export async function findOrCreateFinanceClient(
  prisma: PrismaClient,
  name: string,
  gstin: string | null | undefined,
  contact?: string | null
): Promise<string> {
  const phone = contact?.trim() || null;
  const g = gstin?.trim() ? gstin.trim().toUpperCase() : null;

  if (g) {
    const existingGst = await prisma.financeClient.findFirst({ where: { gstin: g } });
    if (existingGst) {
      if (phone) {
        await prisma.financeClient.update({
          where: { id: existingGst.id },
          data: { contact: phone },
        });
      }
      return existingGst.id;
    }
  }

  const n = name.trim();
  const existingName = await prisma.financeClient.findFirst({
    where: { name: { equals: n, mode: 'insensitive' } },
  });
  if (existingName) {
    const data: { gstin?: string | null; contact?: string } = {};
    if (g && !existingName.gstin) data.gstin = g;
    if (phone) data.contact = phone;
    if (Object.keys(data).length) {
      await prisma.financeClient.update({ where: { id: existingName.id }, data });
    }
    return existingName.id;
  }
  const c = await prisma.financeClient.create({
    data: {
      name: n,
      gstin: g,
      ...(phone ? { contact: phone } : {}),
    },
  });
  return c.id;
}

export function buildSpgsPayloadForBulk(row: BulkNormalizedRow): SpgsInput {
  const base: SpgsInput = {
    systemSizeKw: row.systemSizeKw,
    panelWattage: 550,
    panelSerials: [],
    pricingMode: 'baseExclGst',
    baseExclGst: row.baseExclGst,
    gstMode: 'epc',
  };
  const siteName = row.siteName?.trim();
  const siteAddress = row.siteAddress?.trim();
  if (!siteName && !siteAddress) return base;
  return {
    ...base,
    ...(siteName ? { siteName } : {}),
    ...(siteAddress ? { siteAddress } : {}),
  } as SpgsInput;
}

export function buildNonSpgsLineItems(row: BulkNormalizedRow): {
  lineItems: {
    name: string;
    description?: string;
    qty: number;
    rate: number;
    amount: number;
    gstAmount: number;
  }[];
  totalAmount: number;
} {
  const taxable = Math.round(row.baseExclGst * 100) / 100;
  const gst = Math.round(taxable * 0.18 * 100) / 100;
  const total = Math.round((taxable + gst) * 100) / 100;
  const label = row.subtype === 'SERVICE' ? 'Service' : 'Product';
  const desc = row.lineDescription?.trim();
  return {
    lineItems: [
      {
        name: label,
        ...(desc ? { description: desc } : {}),
        qty: 1,
        rate: taxable,
        amount: taxable,
        gstAmount: gst,
      },
    ],
    totalAmount: total,
  };
}

export function parsedRowsToNormalized(row: BulkParsedRow): BulkNormalizedRow | null {
  if (row.errors.length > 0) return null;
  const mainKind = mapDocumentKind(row.documentKindRaw);
  const subtype = mapSubtype(row.subtypeRaw);
  if (!mainKind || !subtype || !row.invoiceDate || !row.consumerName?.trim()) return null;
  const kw = row.systemSizeKw;
  const amt = row.baseExclGst;
  if (kw === null || kw === undefined || kw <= 0 || amt === null || amt === undefined || amt <= 0) return null;
  if (row.gstin?.trim() && !isValidGstin(row.gstin)) return null;
  const ti = row.templateInput?.trim() || null;
  const clientPhone = row.clientPhone?.trim() || null;
  const lineDescription = row.lineDescription?.trim() || null;
  const siteName = row.siteName?.trim() || null;
  const siteAddress = row.siteAddress?.trim() || null;
  return {
    rowIndex: row.rowIndex,
    documentNumber: row.documentNumber?.trim() ? row.documentNumber.trim() : null,
    invoiceDate: row.invoiceDate,
    mainKind,
    subtype,
    consumerName: row.consumerName.trim(),
    gstin: row.gstin?.trim() ? row.gstin.trim().toUpperCase() : null,
    systemSizeKw: kw,
    baseExclGst: amt,
    templateId: null,
    templateInput: ti,
    clientPhone,
    lineDescription,
    siteName,
    siteAddress,
  };
}

function attachNormalized(parsed: BulkParsedRow): BulkParsedRow {
  const normalized = parsedRowsToNormalized(parsed);
  return normalized ? { ...parsed, normalized } : parsed;
}

/** Server-side validation for JSON body rows (bulk create). */
export function validateBulkNormalizedRow(row: BulkNormalizedRow): string[] {
  const errs: string[] = [];
  if (!row.consumerName?.trim()) errs.push('Missing consumer name');
  if (!row.invoiceDate || !/^\d{4}-\d{2}-\d{2}$/.test(row.invoiceDate)) errs.push('Invalid invoice date');
  if (row.gstin?.trim() && !isValidGstin(row.gstin)) errs.push('Invalid GSTIN');
  if (!row.baseExclGst || row.baseExclGst <= 0) errs.push('Invalid base amount excl. GST');
  if (!row.systemSizeKw || row.systemSizeKw <= 0) errs.push('Invalid system size');
  const validMain: InvoiceMainKind[] = ['TAX_INVOICE', 'PROFORMA_INVOICE', 'QUOTATION', 'EWAY_BILL'];
  const validSub: InvoiceSubtype[] = ['SPGS', 'SERVICE', 'PRODUCT'];
  if (!validMain.includes(row.mainKind)) errs.push('Invalid main kind');
  if (!validSub.includes(row.subtype)) errs.push('Invalid subtype');
  if (row.documentNumber?.trim() && !/^\d+$/.test(row.documentNumber.trim())) {
    errs.push('Document number must be digits only');
  }
  return errs;
}

export function normalizeBulkCreateRowFromBody(raw: unknown): BulkNormalizedRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const rowIndex = typeof o.rowIndex === 'number' && Number.isFinite(o.rowIndex) ? o.rowIndex : 0;
  const invoiceDate = typeof o.invoiceDate === 'string' ? o.invoiceDate.trim() : '';
  const mainKind = o.mainKind as InvoiceMainKind;
  const subtype = o.subtype as InvoiceSubtype;
  const consumerName = typeof o.consumerName === 'string' ? o.consumerName : '';
  const gstinRaw = o.gstin;
  const gstin =
    gstinRaw === null || gstinRaw === undefined
      ? null
      : typeof gstinRaw === 'string'
        ? gstinRaw.trim().toUpperCase() || null
        : null;
  const systemSizeKw = typeof o.systemSizeKw === 'number' ? o.systemSizeKw : Number(o.systemSizeKw);
  const baseExclGst =
    typeof o.baseExclGst === 'number' ? o.baseExclGst : Number(o.baseExclGst ?? NaN);
  const documentNumber =
    o.documentNumber === null || o.documentNumber === undefined
      ? null
      : typeof o.documentNumber === 'string'
        ? o.documentNumber.trim() || null
        : null;
  if (!invoiceDate || !consumerName.trim()) return null;
  if (!Number.isFinite(systemSizeKw) || !Number.isFinite(baseExclGst)) return null;
  const templateId =
    o.templateId === null || o.templateId === undefined
      ? null
      : typeof o.templateId === 'string'
        ? o.templateId.trim() || null
        : null;
  const templateInput =
    o.templateInput === null || o.templateInput === undefined
      ? null
      : typeof o.templateInput === 'string'
        ? o.templateInput.trim() || null
        : null;
  const optStr = (k: string) => {
    const v = (o as Record<string, unknown>)[k];
    if (v === null || v === undefined) return null;
    if (typeof v !== 'string') return null;
    const t = v.trim();
    return t || null;
  };
  return {
    rowIndex,
    documentNumber,
    invoiceDate,
    mainKind,
    subtype,
    consumerName: consumerName.trim(),
    gstin,
    systemSizeKw,
    baseExclGst,
    templateId,
    templateInput,
    clientPhone: optStr('clientPhone') ?? optStr('phone'),
    lineDescription: optStr('lineDescription'),
    siteName: optStr('siteName'),
    siteAddress: optStr('siteAddress'),
  };
}
