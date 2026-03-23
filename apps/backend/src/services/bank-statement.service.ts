import { PrismaClient, type Prisma } from '@prisma/client';
import type { FinanceTransactionType, ExpenseCategory } from '@prisma/client';
import * as XLSX from 'xlsx';
import {
  processRow,
  findDuplicate,
  extractPartyAndDescription,
  type ProcessedTransaction,
} from './transaction-processor.service.js';

const prisma = new PrismaClient();

async function resolveCategoryId(name: string | null | undefined): Promise<string | null> {
  if (!name?.trim()) return null;
  const c = await prisma.transactionCategory.findUnique({ where: { name: name.trim() }, select: { id: true } });
  return c?.id ?? null;
}

/** Raw row from parsed file */
export interface ParsedRow {
  transactionDate: string;
  valueDate?: string;
  referenceNo?: string;
  description?: string;
  withdrawals?: string;
  deposits?: string;
  debit?: string;
  credit?: string;
  amount?: string;
  [key: string]: string | undefined;
}

/** Classified transaction ready for storage */
export interface ClassifiedTransaction {
  transactionDate: Date;
  valueDate?: Date;
  referenceNo?: string;
  description?: string;
  partyName?: string;
  amount: number;
  type: FinanceTransactionType;
  category?: ExpenseCategory;
}

/** Column mapping: normalized key -> possible header names */
const COLUMN_ALIASES: Record<string, string[]> = {
  transactionDate: ['transaction date', 'date', 'posting date', 'txn date', 'value date'],
  valueDate: ['value date', 'val date'],
  referenceNo: ['reference', 'ref no', 'reference no', 'chq/ref no', 'cheque no'],
  description: ['description', 'particulars', 'narration', 'remarks', 'details'],
  withdrawals: ['withdrawals', 'withdrawal', 'debit', 'dr', 'out'],
  deposits: ['deposits', 'deposit', 'credit', 'cr', 'in'],
  debit: ['debit', 'dr', 'withdrawals', 'withdrawal'],
  credit: ['credit', 'cr', 'deposits', 'deposit'],
  amount: ['amount', 'balance', 'transaction amount'],
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[_\s]+/g, ' ').trim();
}

function findColumnIndex(headers: string[], keys: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const key of keys) {
    const variants = COLUMN_ALIASES[key] ?? [key];
    const idx = normalized.findIndex((h) =>
      variants.some((v) => h.includes(v) || v.includes(h))
    );
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseDate(str: string): Date | null {
  if (!str?.trim()) return null;
  const s = str.trim();
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    if (!isNaN(date.getTime())) return date;
  }
  // YYYY-MM-DD
  const iso = new Date(s);
  if (!isNaN(iso.getTime())) return iso;
  return null;
}

function parseAmount(str: string | number): number {
  if (str === undefined || str === null) return 0;
  if (typeof str === 'number') return isNaN(str) ? 0 : str;
  const cleaned = String(str).replace(/[,\s₹$]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/** Excel serial date to JS Date */
function excelDateToJs(serial: number): Date {
  const utc_days = Math.floor(serial - 25569);
  return new Date(utc_days * 86400 * 1000);
}

function toDateStr(val: unknown): string {
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === 'number' && val > 25569) return excelDateToJs(val).toISOString().slice(0, 10);
  return String(val ?? '');
}

/** Extract party name (backward compat) */
export function extractPartyName(description: string): string | null {
  const { partyName } = extractPartyAndDescription(description);
  return partyName === 'Unknown' ? null : partyName;
}

/**
 * Parse CSV text into rows with flexible column mapping
 */
function parseCsv(buffer: Buffer): ParsedRow[] {
  const text = buffer.toString('utf-8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const headerLine = lines[0] ?? '';
  const headers = headerLine.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((h) => h.replace(/^"|"$/g, '').trim());

  const dateIdx = findColumnIndex(headers, ['transactionDate']) >= 0
    ? findColumnIndex(headers, ['transactionDate'])
    : findColumnIndex(headers, ['valueDate']);
  const valueDateIdx = findColumnIndex(headers, ['valueDate']);
  const refIdx = findColumnIndex(headers, ['referenceNo']);
  const descIdx = findColumnIndex(headers, ['description']);
  const withIdx = findColumnIndex(headers, ['withdrawals', 'debit']);
  const depIdx = findColumnIndex(headers, ['deposits', 'credit']);
  const amtIdx = findColumnIndex(headers, ['amount']);

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    const get = (idx: number) => (idx >= 0 ? parts[idx]?.replace(/^"|"$/g, '').trim() : undefined);

    const dateVal = get(dateIdx >= 0 ? dateIdx : 0);
    const valueDateVal = valueDateIdx >= 0 ? get(valueDateIdx) : undefined;
    const refVal = refIdx >= 0 ? get(refIdx) : undefined;
    const descVal = descIdx >= 0 ? get(descIdx) : undefined;
    const withVal = withIdx >= 0 ? get(withIdx) : undefined;
    const depVal = depIdx >= 0 ? get(depIdx) : undefined;
    const amtVal = amtIdx >= 0 ? get(amtIdx) : undefined;

    const withdrawals = parseAmount(withVal ?? '');
    const deposits = parseAmount(depVal ?? '');
    let amount = withdrawals || deposits;
    if (amount === 0 && amtVal) {
      const a = parseAmount(amtVal);
      amount = Math.abs(a);
    }

    rows.push({
      transactionDate: dateVal ?? '',
      valueDate: valueDateVal,
      referenceNo: refVal,
      description: descVal,
      withdrawals: withVal ?? (withdrawals > 0 ? String(withdrawals) : undefined),
      deposits: depVal ?? (deposits > 0 ? String(deposits) : undefined),
      debit: withVal,
      credit: depVal,
      amount: amount > 0 ? String(amount) : amtVal,
    });
  }
  return rows;
}

/**
 * Parse Excel (xlsx, xls) into rows
 */
function parseExcel(buffer: Buffer): ParsedRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 }) as string[][];
  if (data.length < 2) return [];

  const headers = (data[0] ?? []).map((h) => String(h ?? '').trim());
  const dateIdx = headers.findIndex((h) => /date|transaction|posting|txn/i.test(h));
  const valueDateIdx = headers.findIndex((h) => /value\s*date|val\s*date/i.test(h));
  const refIdx = headers.findIndex((h) => /reference|ref|chq|cheque/i.test(h));
  const descIdx = headers.findIndex((h) => /description|particulars|narration|remarks/i.test(h));
  const withIdx = headers.findIndex((h) => /withdrawal|debit|dr\b/i.test(h));
  const depIdx = headers.findIndex((h) => /deposit|credit|cr\b/i.test(h));
  const amtIdx = headers.findIndex((h) => /amount|balance/i.test(h));

  const rows: ParsedRow[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i] ?? [];
    const get = (idx: number) => (idx >= 0 ? String(row[idx] ?? '').trim() : undefined);
    const getRaw = (idx: number) => (idx >= 0 ? row[idx] : undefined);
    const dateCol = dateIdx >= 0 ? dateIdx : valueDateIdx >= 0 ? valueDateIdx : 0;
    const dateVal = dateCol >= 0 ? toDateStr(getRaw(dateCol) ?? '') : '';
    const valueDateVal = valueDateIdx >= 0 ? toDateStr(getRaw(valueDateIdx) ?? '') : undefined;
    const refVal = refIdx >= 0 ? get(refIdx) : undefined;
    const descVal = descIdx >= 0 ? get(descIdx) : undefined;
    const withVal = withIdx >= 0 ? get(withIdx) : undefined;
    const depVal = depIdx >= 0 ? get(depIdx) : undefined;
    const amtVal = amtIdx >= 0 ? get(amtIdx) : undefined;

    const withdrawals = parseAmount(withVal ?? '');
    const deposits = parseAmount(depVal ?? '');
    let amount = withdrawals || deposits;
    if (amount === 0 && amtVal) amount = Math.abs(parseAmount(amtVal));

    // Skip summary/continuation rows with no date and no amount
    if (!dateVal && amount === 0) continue;
    if (dateVal && amount === 0) continue;

    rows.push({
      transactionDate: dateVal ?? '',
      valueDate: valueDateVal,
      referenceNo: refVal,
      description: descVal,
      withdrawals: withVal ?? (withdrawals > 0 ? String(withdrawals) : undefined),
      deposits: depVal ?? (deposits > 0 ? String(deposits) : undefined),
      debit: withVal,
      credit: depVal,
      amount: amount > 0 ? String(amount) : amtVal,
    });
  }
  return rows;
}

/**
 * Parse file buffer (CSV or Excel) into normalized rows
 */
export function parseFile(buffer: Buffer, mimeType?: string, fileName?: string): ParsedRow[] {
  const fn = (fileName ?? '').toLowerCase();
  const isExcel = /\.(xlsx|xls|xlsm)$/.test(fn) ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel';

  if (isExcel) return parseExcel(buffer);
  return parseCsv(buffer);
}

/**
 * Convert parsed rows into classified transactions (uses transaction processor)
 */
export function classifyRows(rawRows: ParsedRow[], rules?: { conditions: unknown; category: ExpenseCategory | null; siteId: string | null }[]): ProcessedTransaction[] {
  const result: ProcessedTransaction[] = [];

  for (const row of rawRows) {
    const processed = processRow(row, rules);
    if (processed) result.push(processed);
  }

  return result;
}

/**
 * Upload file, parse, classify, and store transactions
 */
export async function uploadAndProcess(
  buffer: Buffer,
  fileName: string,
  mimeType?: string
): Promise<{ uploadId: string; transactionsCreated: number; totalRows: number; duplicatesSkipped: number }> {
  const rawRows = parseFile(buffer, mimeType, fileName);
  const rawData = JSON.parse(JSON.stringify(rawRows)) as Prisma.InputJsonValue;

  const uploadRecord = await prisma.bankStatementUpload.create({
    data: { fileName, rawData },
  });

  const rules = await prisma.transactionRule.findMany({
    where: { isActive: true },
    orderBy: { priority: 'desc' },
    select: { conditions: true, category: true, siteId: true },
  });

  const classified = classifyRows(rawRows, rules);
  let duplicatesSkipped = 0;

  for (const t of classified) {
    const dupId = await findDuplicate(
      uploadRecord.id,
      t.transactionDate,
      t.amount,
      t.referenceNo ?? null
    );
    if (dupId) {
      duplicatesSkipped++;
      continue;
    }
    const categoryId = t.category ? await resolveCategoryId(t.category) : null;

    await prisma.bankTransaction.create({
      data: {
        uploadId: uploadRecord.id,
        transactionDate: t.transactionDate,
        valueDate: t.valueDate ?? null,
        referenceNo: t.referenceNo ?? null,
        rawDescription: t.rawDescription || null,
        description: t.cleanedDescription || null,
        partyName: t.partyName || null,
        amount: t.amount,
        type: t.type === 'debit' ? 'EXPENSE' : 'INCOME',
        categoryId,
        siteId: null,
      },
    });
  }

  const count = await prisma.bankTransaction.count({ where: { uploadId: uploadRecord.id } });
  return {
    uploadId: uploadRecord.id,
    transactionsCreated: count,
    totalRows: rawRows.length,
    duplicatesSkipped,
  };
}

/**
 * Get transactions (optionally filtered)
 */
export async function getTransactions(options: {
  uploadId?: string;
  type?: FinanceTransactionType;
  category?: string | null;  // categoryId or category name; null = uncategorized only
  categories?: string[];    // include only these (category ids or names, comma-separated)
  excludeCategories?: string[];  // hide these categories
  siteId?: string;
  uncategorizedOnly?: boolean;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
  sortDate?: 'asc' | 'desc';
}) {
  const { uploadId, type, category, categories, excludeCategories, siteId, uncategorizedOnly, from, to, limit = 100, offset = 0, sortDate = 'desc' } = options;
  const where: Parameters<typeof prisma.bankTransaction.findMany>[0]['where'] = { duplicateOfId: null };

  if (uploadId) where.uploadId = uploadId;
  if (type) where.type = type;
  if (uncategorizedOnly || category === null) {
    where.categoryId = null;
  } else if (categories && categories.length > 0) {
    const catIds: string[] = [];
    for (const c of categories) {
      const found = await prisma.transactionCategory.findFirst({ where: { OR: [{ id: c.trim() }, { name: c.trim() }] }, select: { id: true } });
      if (found) catIds.push(found.id);
    }
    where.categoryId = catIds.length > 0 ? { in: catIds } : 'none';
  } else if (excludeCategories && excludeCategories.length > 0) {
    const catIds: string[] = [];
    for (const c of excludeCategories) {
      const found = await prisma.transactionCategory.findFirst({ where: { OR: [{ id: c.trim() }, { name: c.trim() }] }, select: { id: true } });
      if (found) catIds.push(found.id);
    }
    if (catIds.length > 0) {
      where.OR = [{ categoryId: null }, { categoryId: { notIn: catIds } }];
    }
  } else if (category) {
    const c = await prisma.transactionCategory.findFirst({ where: { OR: [{ id: category }, { name: category }] }, select: { id: true } });
    where.categoryId = c?.id ?? 'none';
  }
  if (siteId) where.siteId = siteId;
  if (from || to) {
    where.transactionDate = {};
    if (from) (where.transactionDate as { gte?: Date }).gte = from;
    if (to) (where.transactionDate as { lte?: Date }).lte = to;
  }

  const [transactions, total] = await Promise.all([
    prisma.bankTransaction.findMany({
      where,
      include: { upload: true, site: true, category: true },
      orderBy: { transactionDate: sortDate },
      take: limit,
      skip: offset,
    }),
    prisma.bankTransaction.count({ where }),
  ]);

  return { transactions, total };
}

/**
 * Update classification for a single transaction
 */
export async function updateClassification(
  transactionId: string,
  data: {
    type?: FinanceTransactionType;
    category?: string | null;  // categoryId
    categoryId?: string | null;
    siteId?: string | null;
    partyName?: string | null;
    description?: string | null;
    referenceNo?: string | null;
    isReviewed?: boolean;
    manualOverride?: boolean;
  }
) {
  const updateData: Record<string, unknown> = { ...data, manualOverride: data.manualOverride ?? true };
  if (data.category !== undefined) updateData.categoryId = data.category;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  delete updateData.category;
  return prisma.bankTransaction.update({
    where: { id: transactionId },
    data: updateData as Parameters<typeof prisma.bankTransaction.update>[0]['data'],
    include: { site: true, category: true },
  });
}

/**
 * Bulk update transactions (categoryId, site, isReviewed)
 */
export async function bulkUpdate(
  ids: string[],
  data: { category?: string | null; categoryId?: string | null; siteId?: string | null; isReviewed?: boolean }
) {
  const updateData: Record<string, unknown> = { manualOverride: true };
  if (data.category !== undefined) updateData.categoryId = data.category;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  if (data.siteId !== undefined) updateData.siteId = data.siteId;
  if (data.isReviewed !== undefined) updateData.isReviewed = data.isReviewed;
  const result = await prisma.bankTransaction.updateMany({
    where: { id: { in: ids } },
    data: updateData as Parameters<typeof prisma.bankTransaction.updateMany>[0]['data'],
  });
  return { updated: result.count };
}

export const bankStatementService = {
  parseFile,
  classifyRows,
  extractPartyName,
  uploadAndProcess,
  getTransactions,
  updateClassification,
  bulkUpdate,
};
