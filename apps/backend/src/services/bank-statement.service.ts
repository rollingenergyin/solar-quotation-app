import { PrismaClient, Prisma } from '@prisma/client';
import type { FinanceTransactionType, ExpenseCategory } from '@prisma/client';
import * as XLSX from 'xlsx';
import {
  processRow,
  findDuplicate,
  extractPartyAndDescription,
  type ProcessedTransaction,
} from './transaction-processor.service.js';
import { deleteBankTransactionBill } from './bank-transaction-bill.service.js';

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
  let sortOrder = 0;

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

    const row = await prisma.bankTransaction.create({
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
    // sort_order is not passed through Prisma create so uploads work even if the generated
    // client is stale (unknown `sortOrder`). Column must exist in DB (migration).
    await prisma.$executeRaw(
      Prisma.sql`UPDATE "finance_bank_transactions" SET "sort_order" = ${sortOrder} WHERE "id" = ${row.id}`
    );
    sortOrder += 1;
  }

  const count = await prisma.bankTransaction.count({
    where: { uploadId: uploadRecord.id, deletedAt: null },
  });
  return {
    uploadId: uploadRecord.id,
    transactionsCreated: count,
    totalRows: rawRows.length,
    duplicatesSkipped,
  };
}

async function resolveCategoryIdsFromNamesOrIds(list: string[]): Promise<string[]> {
  const catIds: string[] = [];
  for (const c of list) {
    const found = await prisma.transactionCategory.findFirst({
      where: { OR: [{ id: c.trim() }, { name: c.trim() }] },
      select: { id: true },
    });
    if (found) catIds.push(found.id);
  }
  return catIds;
}

/**
 * Get transactions (optionally filtered)
 */
export async function getTransactions(options: {
  uploadId?: string;
  type?: FinanceTransactionType;
  category?: string | null; // categoryId or category name; null = uncategorized only
  categories?: string[]; // include only these (category ids or names, comma-separated)
  excludeCategories?: string[]; // hide these categories
  siteId?: string;
  uncategorizedOnly?: boolean;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
  sortDate?: 'asc' | 'desc';
  /** When true, list only soft-deleted (recycle bin) rows */
  trash?: boolean;
}) {
  const {
    uploadId,
    type,
    category,
    categories,
    excludeCategories,
    siteId,
    uncategorizedOnly,
    from,
    to,
    limit = 100,
    offset = 0,
    sortDate = 'desc',
    trash = false,
  } = options;

  const andParts: Prisma.BankTransactionWhereInput[] = [
    { duplicateOfId: null },
    trash ? { deletedAt: { not: null } } : { deletedAt: null },
  ];

  if (uploadId) andParts.push({ uploadId });
  if (type) andParts.push({ type });

  if (uncategorizedOnly || category === null) {
    andParts.push({ isSplit: false, categoryId: null });
  } else if (categories && categories.length > 0) {
    const catIds = await resolveCategoryIdsFromNamesOrIds(categories);
    if (catIds.length === 0) {
      andParts.push({ id: { in: [] } });
    } else {
      andParts.push({
        OR: [
          { isSplit: false, categoryId: { in: catIds } },
          { isSplit: true, splits: { some: { categoryId: { in: catIds } } } },
        ],
      });
    }
  } else if (excludeCategories && excludeCategories.length > 0) {
    const catIds = await resolveCategoryIdsFromNamesOrIds(excludeCategories);
    if (catIds.length > 0) {
      andParts.push({
        OR: [
          { isSplit: false, OR: [{ categoryId: null }, { categoryId: { notIn: catIds } }] },
          { isSplit: true, splits: { some: { categoryId: { notIn: catIds } } } },
        ],
      });
    }
  } else if (category) {
    const c = await prisma.transactionCategory.findFirst({
      where: { OR: [{ id: category }, { name: category }] },
      select: { id: true },
    });
    if (!c) {
      andParts.push({ id: { in: [] } });
    } else {
      andParts.push({
        OR: [
          { isSplit: false, categoryId: c.id },
          { isSplit: true, splits: { some: { categoryId: c.id } } },
        ],
      });
    }
  }

  if (siteId) {
    andParts.push({
      OR: [{ isSplit: false, siteId }, { isSplit: true, splits: { some: { siteId } } }],
    });
  }

  if (from || to) {
    const td: { gte?: Date; lte?: Date } = {};
    if (from) td.gte = from;
    if (to) td.lte = to;
    andParts.push({ transactionDate: td });
  }

  const where: Prisma.BankTransactionWhereInput =
    andParts.length === 1 ? andParts[0]! : { AND: andParts };

  const [idMatches, total] = await Promise.all([
    prisma.bankTransaction.findMany({
      where,
      select: { id: true },
    }),
    prisma.bankTransaction.count({ where }),
  ]);

  if (idMatches.length === 0) {
    return { transactions: [], total };
  }

  const idList = idMatches.map((r) => r.id);
  const dateDir = sortDate === 'asc' ? 'ASC' : 'DESC';
  const orderedIds = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      SELECT id FROM "finance_bank_transactions"
      WHERE id IN (${Prisma.join(idList.map((id) => Prisma.sql`${id}`))})
      ORDER BY "sort_order" ASC, "transactionDate" ${Prisma.raw(dateDir)}
    `
  );
  const pageIds = orderedIds.slice(offset, offset + limit);

  const rows = await prisma.bankTransaction.findMany({
    where: { id: { in: pageIds.map((p) => p.id) } },
    include: {
      upload: true,
      site: true,
      category: true,
      purchaseBill: true,
      salesBill: true,
      splits: {
        include: { category: true, site: true, purchaseBill: true, salesBill: true },
        orderBy: { id: 'asc' },
      },
    },
  });
  const orderIndex = new Map(pageIds.map((p, i) => [p.id, i]));
  const transactions = [...rows].sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0));

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
  const existing = await prisma.bankTransaction.findFirst({
    where: { id: transactionId, deletedAt: null },
    select: { isSplit: true },
  });
  if (!existing) throw new Error('Transaction not found or is in the recycle bin');
  const updateData: Record<string, unknown> = { ...data, manualOverride: data.manualOverride ?? true };
  if (data.category !== undefined) updateData.categoryId = data.category;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  delete updateData.category;
  if (existing.isSplit) {
    delete updateData.categoryId;
    delete updateData.siteId;
  }
  return prisma.bankTransaction.update({
    where: { id: transactionId },
    data: updateData as Parameters<typeof prisma.bankTransaction.update>[0]['data'],
    include: {
      site: true,
      category: true,
      purchaseBill: true,
      salesBill: true,
      splits: {
        include: { category: true, site: true, purchaseBill: true, salesBill: true },
        orderBy: { id: 'asc' },
      },
    },
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
    where: { id: { in: ids }, isSplit: false, deletedAt: null },
    data: updateData as Parameters<typeof prisma.bankTransaction.updateMany>[0]['data'],
  });
  return { updated: result.count };
}

/**
 * Persist manual row order within a bank statement upload (drag-drop).
 */
const AMOUNT_EPS = 0.02;

export async function updateTransactionSplit(
  transactionId: string,
  splitId: string,
  data: { amount?: number; description?: string | null; categoryId?: string; siteId?: string | null }
) {
  const txn = await prisma.bankTransaction.findFirst({
    where: { id: transactionId, deletedAt: null },
    select: { id: true, amount: true, isSplit: true },
  });
  if (!txn || !txn.isSplit) throw new Error('Transaction is not split or is in the recycle bin');
  const splits = await prisma.transactionSplit.findMany({ where: { transactionId } });
  const others = splits.filter((s) => s.id !== splitId);
  const target = splits.find((s) => s.id === splitId);
  if (!target) throw new Error('Split not found');

  const nextAmount = data.amount !== undefined ? Number(data.amount) : target.amount;
  const total = others.reduce((s, sp) => s + sp.amount, 0) + nextAmount;
  if (Math.abs(total - txn.amount) > AMOUNT_EPS) {
    throw new Error('Split amounts must sum to transaction amount');
  }

  return prisma.transactionSplit.update({
    where: { id: splitId },
    data: {
      ...(data.amount !== undefined ? { amount: nextAmount } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
      ...(data.siteId !== undefined ? { siteId: data.siteId } : {}),
    },
    include: { site: true, category: true },
  });
}

export async function deleteTransactionSplit(transactionId: string, splitId: string) {
  const txn = await prisma.bankTransaction.findFirst({
    where: { id: transactionId, deletedAt: null },
    select: { id: true, amount: true, isSplit: true },
  });
  if (!txn || !txn.isSplit) throw new Error('Transaction is not split or is in the recycle bin');
  const all = await prisma.transactionSplit.findMany({ where: { transactionId } });
  const others = all.filter((s) => s.id !== splitId);
  if (others.length < 1) {
    throw new Error('Use Clear splits on the transaction to remove splitting entirely');
  }
  const sumOthers = others.reduce((s, sp) => s + sp.amount, 0);
  if (Math.abs(sumOthers - txn.amount) > AMOUNT_EPS) {
    throw new Error('Adjust amounts so remaining splits sum to the transaction total before removing this row');
  }
  try {
    await deleteBankTransactionBill(transactionId, splitId);
  } catch (e) {
    console.warn('FINANCE: deleteBankTransactionBill before split delete skipped:', e);
  }
  await prisma.transactionSplit.delete({ where: { id: splitId } });
}

export async function reorderTransactions(uploadId: string, orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return;
  const rows = await prisma.bankTransaction.findMany({
    where: { uploadId, id: { in: orderedIds }, deletedAt: null },
    select: { id: true },
  });
  if (rows.length !== orderedIds.length) {
    throw new Error('Invalid transaction ids for this upload');
  }
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.$executeRaw(
        Prisma.sql`UPDATE "finance_bank_transactions" SET "sort_order" = ${index} WHERE "id" = ${id} AND "uploadId" = ${uploadId} AND "deleted_at" IS NULL`
      )
    )
  );
}

export async function bulkSoftDelete(uploadId: string, ids: string[]): Promise<{ updated: number }> {
  if (ids.length === 0) return { updated: 0 };
  const r = await prisma.bankTransaction.updateMany({
    where: { uploadId, id: { in: ids }, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  return { updated: r.count };
}

export async function bulkRestore(uploadId: string, ids: string[]): Promise<{ updated: number }> {
  if (ids.length === 0) return { updated: 0 };
  const r = await prisma.bankTransaction.updateMany({
    where: { uploadId, id: { in: ids }, deletedAt: { not: null } },
    data: { deletedAt: null },
  });
  return { updated: r.count };
}

export async function bulkHardDelete(uploadId: string, ids: string[]): Promise<{ deleted: number }> {
  const rows = await prisma.bankTransaction.findMany({
    where: { uploadId, id: { in: ids }, deletedAt: { not: null } },
    select: { id: true },
  });
  const foundIds = rows.map((r) => r.id);
  for (const id of foundIds) {
    const splits = await prisma.transactionSplit.findMany({
      where: { transactionId: id },
      select: { id: true },
    });
    for (const s of splits) {
      try {
        await deleteBankTransactionBill(id, s.id);
      } catch (e) {
        console.warn('bulkHardDelete: split bill cleanup', e);
      }
    }
    try {
      await deleteBankTransactionBill(id, undefined);
    } catch (e) {
      console.warn('bulkHardDelete: txn bill cleanup', e);
    }
    await prisma.bankTransaction.delete({ where: { id } });
  }
  return { deleted: foundIds.length };
}

export const bankStatementService = {
  parseFile,
  classifyRows,
  extractPartyName,
  uploadAndProcess,
  getTransactions,
  updateClassification,
  bulkUpdate,
  reorderTransactions,
  updateTransactionSplit,
  deleteTransactionSplit,
  bulkSoftDelete,
  bulkRestore,
  bulkHardDelete,
};
