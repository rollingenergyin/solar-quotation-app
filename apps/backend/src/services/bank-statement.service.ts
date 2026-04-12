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
  /** When true, only rows with no project: non-split with siteId null, or any split line with siteId null */
  siteUnassignedOnly?: boolean;
  uncategorizedOnly?: boolean;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
  sortDate?: 'asc' | 'desc';
  /** When true, list only soft-deleted (recycle bin) rows */
  trash?: boolean;
  /** Filter by invoice tag */
  invoiceStatusFilter?: 'INV' | 'NO_INV' | 'unset' | 'all';
  /** Order: default = sort_order + date; inv_first / no_inv_first = group by tag then same */
  invoiceSort?: 'default' | 'inv_first' | 'no_inv_first';
  /** Filter by bill upload tag (independent of invoice) */
  billUploadStatusFilter?: 'UPLOADED' | 'NOT_UPLOADED' | 'unset' | 'all';
  billUploadSort?: 'default' | 'uploaded_first' | 'not_uploaded_first';
  /** Include only these FinanceSite ids (multi-select filter, like categories) */
  sites?: string[];
  /** Hide these FinanceSite ids (like excludeCategories) */
  excludeSites?: string[];
}) {
  const {
    uploadId,
    type,
    category,
    categories,
    excludeCategories,
    siteId,
    siteUnassignedOnly,
    uncategorizedOnly,
    from,
    to,
    limit = 100,
    offset = 0,
    sortDate = 'desc',
    trash = false,
    invoiceStatusFilter = 'all',
    invoiceSort = 'default',
    billUploadStatusFilter = 'all',
    billUploadSort = 'default',
    sites: sitesInclude,
    excludeSites,
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

  if (siteUnassignedOnly) {
    andParts.push({
      OR: [{ isSplit: false, siteId: null }, { isSplit: true, splits: { some: { siteId: null } } }],
    });
  } else if (sitesInclude && sitesInclude.length > 0) {
    andParts.push({
      OR: [
        { isSplit: false, siteId: { in: sitesInclude } },
        { isSplit: true, splits: { some: { siteId: { in: sitesInclude } } } },
      ],
    });
  } else if (excludeSites && excludeSites.length > 0) {
    andParts.push({
      OR: [
        {
          isSplit: false,
          OR: [{ siteId: null }, { siteId: { notIn: excludeSites } }],
        },
        { isSplit: true, splits: { some: { siteId: { notIn: excludeSites } } } },
      ],
    });
  } else if (siteId) {
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

  if (invoiceStatusFilter === 'INV') {
    andParts.push({
      OR: [
        { isSplit: false, invoiceStatus: 'INV' },
        { isSplit: true, splits: { some: { invoiceStatus: 'INV' } } },
      ],
    });
  } else if (invoiceStatusFilter === 'NO_INV') {
    andParts.push({
      OR: [
        { isSplit: false, invoiceStatus: 'NO_INV' },
        { isSplit: true, splits: { some: { invoiceStatus: 'NO_INV' } } },
      ],
    });
  } else if (invoiceStatusFilter === 'unset') {
    andParts.push({
      OR: [
        { isSplit: false, invoiceStatus: null },
        { isSplit: true, splits: { every: { invoiceStatus: null } } },
      ],
    });
  }

  if (billUploadStatusFilter === 'UPLOADED') {
    andParts.push({
      OR: [
        { isSplit: false, billUploadStatus: 'UPLOADED' },
        { isSplit: true, splits: { some: { billUploadStatus: 'UPLOADED' } } },
      ],
    });
  } else if (billUploadStatusFilter === 'NOT_UPLOADED') {
    andParts.push({
      OR: [
        { isSplit: false, billUploadStatus: 'NOT_UPLOADED' },
        { isSplit: true, splits: { some: { billUploadStatus: 'NOT_UPLOADED' } } },
      ],
    });
  } else if (billUploadStatusFilter === 'unset') {
    andParts.push({
      OR: [
        { isSplit: false, billUploadStatus: null },
        { isSplit: true, splits: { every: { billUploadStatus: null } } },
      ],
    });
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
  const orderByInvoice =
    invoiceSort === 'inv_first'
      ? Prisma.sql`CASE
      WHEN "isSplit" = false THEN CASE "invoice_status"::text WHEN 'INV' THEN 0 WHEN 'NO_INV' THEN 1 ELSE 2 END
      ELSE COALESCE(
        (SELECT MIN(CASE s.invoice_status::text WHEN 'INV' THEN 0 WHEN 'NO_INV' THEN 1 ELSE 2 END)
         FROM "finance_transaction_splits" s WHERE s."transactionId" = "finance_bank_transactions"."id"),
        2
      )
    END ASC, `
      : invoiceSort === 'no_inv_first'
        ? Prisma.sql`CASE
      WHEN "isSplit" = false THEN CASE "invoice_status"::text WHEN 'NO_INV' THEN 0 WHEN 'INV' THEN 1 ELSE 2 END
      ELSE COALESCE(
        (SELECT MIN(CASE s.invoice_status::text WHEN 'NO_INV' THEN 0 WHEN 'INV' THEN 1 ELSE 2 END)
         FROM "finance_transaction_splits" s WHERE s."transactionId" = "finance_bank_transactions"."id"),
        2
      )
    END ASC, `
        : Prisma.sql``;
  const orderByBillUpload =
    billUploadSort === 'uploaded_first'
      ? Prisma.sql`CASE
      WHEN "isSplit" = false THEN CASE "bill_upload_status"::text WHEN 'UPLOADED' THEN 0 WHEN 'NOT_UPLOADED' THEN 1 ELSE 2 END
      ELSE COALESCE(
        (SELECT MIN(CASE s.bill_upload_status::text WHEN 'UPLOADED' THEN 0 WHEN 'NOT_UPLOADED' THEN 1 ELSE 2 END)
         FROM "finance_transaction_splits" s WHERE s."transactionId" = "finance_bank_transactions"."id"),
        2
      )
    END ASC, `
      : billUploadSort === 'not_uploaded_first'
        ? Prisma.sql`CASE
      WHEN "isSplit" = false THEN CASE "bill_upload_status"::text WHEN 'NOT_UPLOADED' THEN 0 WHEN 'UPLOADED' THEN 1 ELSE 2 END
      ELSE COALESCE(
        (SELECT MIN(CASE s.bill_upload_status::text WHEN 'NOT_UPLOADED' THEN 0 WHEN 'UPLOADED' THEN 1 ELSE 2 END)
         FROM "finance_transaction_splits" s WHERE s."transactionId" = "finance_bank_transactions"."id"),
        2
      )
    END ASC, `
        : Prisma.sql``;
  /** Date order before manual sort_order so “Sort by date” is primary; drag order is tie-breaker. */
  const orderByDateAndManual = Prisma.sql`"transactionDate" ${Prisma.raw(dateDir)}, "sort_order" ASC`;
  const orderedIds = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      SELECT id FROM "finance_bank_transactions"
      WHERE id IN (${Prisma.join(idList.map((id) => Prisma.sql`${id}`))})
      ORDER BY ${orderByInvoice}${orderByBillUpload}${orderByDateAndManual}
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
    invoiceStatus?: 'INV' | 'NO_INV' | null;
    billUploadStatus?: 'UPLOADED' | 'NOT_UPLOADED' | null;
  }
) {
  const existing = await prisma.bankTransaction.findFirst({
    where: { id: transactionId },
    select: { isSplit: true },
  });
  if (!existing) throw new Error('Transaction not found');
  const updateData: Record<string, unknown> = { ...data, manualOverride: data.manualOverride ?? true };
  if (data.category !== undefined) updateData.categoryId = data.category;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  delete updateData.category;
  if (existing.isSplit) {
    delete updateData.categoryId;
    delete updateData.siteId;
    delete updateData.invoiceStatus;
    delete updateData.billUploadStatus;
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
 * Bulk update transactions (categoryId, site, isReviewed, invoiceStatus, billUploadStatus)
 */
export async function bulkUpdate(
  ids: string[],
  data: {
    category?: string | null;
    categoryId?: string | null;
    siteId?: string | null;
    isReviewed?: boolean;
    invoiceStatus?: 'INV' | 'NO_INV' | null;
    billUploadStatus?: 'UPLOADED' | 'NOT_UPLOADED' | null;
  }
) {
  if (data.invoiceStatus !== undefined || data.billUploadStatus !== undefined) {
    const rows = await prisma.bankTransaction.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, isSplit: true },
    });
    let updated = 0;
    const splitPatch: Partial<{
      invoiceStatus: 'INV' | 'NO_INV' | null;
      billUploadStatus: 'UPLOADED' | 'NOT_UPLOADED' | null;
    }> = {};
    if (data.invoiceStatus !== undefined) splitPatch.invoiceStatus = data.invoiceStatus;
    if (data.billUploadStatus !== undefined) splitPatch.billUploadStatus = data.billUploadStatus;
    for (const row of rows) {
      if (row.isSplit) {
        const r = await prisma.transactionSplit.updateMany({
          where: { transactionId: row.id },
          data: splitPatch,
        });
        updated += r.count > 0 ? 1 : 0;
      } else {
        await prisma.bankTransaction.update({
          where: { id: row.id },
          data: {
            ...(data.invoiceStatus !== undefined ? { invoiceStatus: data.invoiceStatus } : {}),
            ...(data.billUploadStatus !== undefined ? { billUploadStatus: data.billUploadStatus } : {}),
            manualOverride: true,
          },
        });
        updated += 1;
      }
    }
    return { updated };
  }
  const updateData: Record<string, unknown> = { manualOverride: true };
  if (data.category !== undefined) updateData.categoryId = data.category;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  if (data.siteId !== undefined) updateData.siteId = data.siteId;
  if (data.isReviewed !== undefined) updateData.isReviewed = data.isReviewed;
  /** No deletedAt guard: category/site/review can be set on recycle-bin rows before restore. */
  const result = await prisma.bankTransaction.updateMany({
    where: { id: { in: ids }, isSplit: false },
    data: updateData as Parameters<typeof prisma.bankTransaction.updateMany>[0]['data'],
  });
  return { updated: result.count };
}

/**
 * Persist manual row order within a bank statement upload (drag-drop).
 */
const AMOUNT_EPS = 0.02;

function roundMoney(n: number): number {
  return Math.round(Number(n) * 100) / 100;
}

export async function updateTransactionSplit(
  transactionId: string,
  splitId: string,
  data: {
    amount?: number;
    description?: string | null;
    categoryId?: string;
    siteId?: string | null;
    invoiceStatus?: 'INV' | 'NO_INV' | null;
    billUploadStatus?: 'UPLOADED' | 'NOT_UPLOADED' | null;
  }
) {
  const txn = await prisma.bankTransaction.findFirst({
    where: { id: transactionId },
    select: { id: true, amount: true, isSplit: true },
  });
  if (!txn || !txn.isSplit) throw new Error('Transaction is not split');
  const splits = await prisma.transactionSplit.findMany({ where: { transactionId } });
  const others = splits.filter((s) => s.id !== splitId);
  const target = splits.find((s) => s.id === splitId);
  if (!target) throw new Error('Split not found');

  const nextAmount = data.amount !== undefined ? roundMoney(Number(data.amount)) : roundMoney(Number(target.amount));
  const total = others.reduce((s, sp) => s + roundMoney(Number(sp.amount)), 0) + nextAmount;
  if (Math.abs(roundMoney(total) - roundMoney(Number(txn.amount))) > AMOUNT_EPS) {
    throw new Error('Split amounts must sum to transaction amount');
  }

  return prisma.transactionSplit.update({
    where: { id: splitId },
    data: {
      ...(data.amount !== undefined ? { amount: nextAmount } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
      ...(data.siteId !== undefined ? { siteId: data.siteId } : {}),
      ...(data.invoiceStatus !== undefined ? { invoiceStatus: data.invoiceStatus } : {}),
      ...(data.billUploadStatus !== undefined ? { billUploadStatus: data.billUploadStatus } : {}),
    },
    include: { site: true, category: true, purchaseBill: true, salesBill: true },
  });
}

/**
 * Update all split line amounts in one transaction (sums must equal parent txn amount).
 * Use this instead of POST /splits when only amounts change — preserves split ids and bill links.
 */
export async function updateTransactionSplitAmountsBatch(
  transactionId: string,
  items: { splitId: string; amount: number }[]
) {
  const txn = await prisma.bankTransaction.findFirst({
    where: { id: transactionId, deletedAt: null },
    select: { id: true, amount: true, isSplit: true },
  });
  if (!txn || !txn.isSplit) throw new Error('Transaction is not split or is in the recycle bin');
  const all = await prisma.transactionSplit.findMany({ where: { transactionId } });
  if (all.length === 0) throw new Error('No split lines');
  if (items.length !== all.length) {
    throw new Error('Provide an amount for every split line');
  }
  const idSet = new Set(all.map((s) => s.id));
  const override = new Map<string, number>();
  for (const it of items) {
    if (!idSet.has(it.splitId)) throw new Error('Unknown split id');
    override.set(it.splitId, roundMoney(Number(it.amount)));
  }
  for (const s of all) {
    if (!override.has(s.id)) throw new Error('Missing amount for a split line');
  }
  const sum = all.reduce((acc, s) => acc + (override.get(s.id) ?? 0), 0);
  if (Math.abs(roundMoney(sum) - roundMoney(Number(txn.amount))) > AMOUNT_EPS) {
    throw new Error('Split amounts must sum to transaction amount');
  }
  return prisma.$transaction(
    all.map((s) =>
      prisma.transactionSplit.update({
        where: { id: s.id },
        data: { amount: override.get(s.id)! },
        include: { site: true, category: true, purchaseBill: true, salesBill: true },
      })
    )
  );
}

export async function deleteTransactionSplit(transactionId: string, splitId: string) {
  const txn = await prisma.bankTransaction.findFirst({
    where: { id: transactionId, deletedAt: null },
    select: { id: true, amount: true, isSplit: true },
  });
  if (!txn || !txn.isSplit) throw new Error('Transaction is not split or is in the recycle bin');
  const all = await prisma.transactionSplit.findMany({
    where: { transactionId },
    orderBy: { id: 'asc' },
  });
  const target = all.find((s) => s.id === splitId);
  if (!target) throw new Error('Split not found');
  const others = all.filter((s) => s.id !== splitId);
  if (others.length < 1) {
    throw new Error('Use Clear splits on the transaction to remove splitting entirely');
  }
  const sumAll = all.reduce((s, sp) => s + roundMoney(Number(sp.amount)), 0);
  if (Math.abs(roundMoney(sumAll) - roundMoney(Number(txn.amount))) > AMOUNT_EPS) {
    throw new Error('Split amounts must sum to transaction amount');
  }
  /** Merge this line’s amount into the first remaining split (by id), then delete the row. */
  const absorbInto = others[0]!;
  const mergedAmount = roundMoney(Number(absorbInto.amount) + Number(target.amount));
  try {
    await deleteBankTransactionBill(transactionId, splitId);
  } catch (e) {
    console.warn('FINANCE: deleteBankTransactionBill before split delete skipped:', e);
  }
  await prisma.$transaction([
    prisma.transactionSplit.update({
      where: { id: absorbInto.id },
      data: { amount: mergedAmount },
    }),
    prisma.transactionSplit.delete({ where: { id: splitId } }),
  ]);
}

/**
 * Reassign sort_order 0..n-1 for all active rows in an upload so list order follows transaction date.
 * @param dateDir 'asc' = oldest first, 'desc' = newest first (matches UI "Sort by date")
 */
export async function reorderUploadByTransactionDate(uploadId: string, dateDir: 'asc' | 'desc'): Promise<void> {
  const rows = await prisma.bankTransaction.findMany({
    where: { uploadId, deletedAt: null },
    select: { id: true, transactionDate: true },
  });
  const order = dateDir === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    const d = a.transactionDate.getTime() - b.transactionDate.getTime();
    if (d !== 0) return order * d;
    return a.id.localeCompare(b.id);
  });
  await prisma.$transaction(
    rows.map((r, i) =>
      prisma.$executeRaw(
        Prisma.sql`UPDATE "finance_bank_transactions" SET "sort_order" = ${i} WHERE "id" = ${r.id} AND "uploadId" = ${uploadId}`
      )
    )
  );
}

export interface CreateManualTransactionInput {
  uploadId: string;
  transactionDate: Date;
  partyName?: string | null;
  description?: string | null;
  amount: number;
  type: FinanceTransactionType;
  categoryId?: string | null;
  siteId?: string | null;
  /** Match UI sort so new row appears in correct chronological position */
  listSortDate: 'asc' | 'desc';
  splits?: { categoryId: string; siteId?: string | null; amount: number; description?: string | null }[];
}

/**
 * Manually add a bank transaction to an existing upload; reorders rows by date within the upload.
 */
export async function createManualTransaction(input: CreateManualTransactionInput) {
  const {
    uploadId,
    transactionDate,
    partyName,
    description,
    amount,
    type,
    categoryId,
    siteId,
    listSortDate,
    splits,
  } = input;

  const upload = await prisma.bankStatementUpload.findUnique({ where: { id: uploadId }, select: { id: true } });
  if (!upload) throw new Error('Upload not found');

  const abs = Math.abs(Number(amount));
  if (!Number.isFinite(abs) || abs <= 0) throw new Error('Amount must be a positive number');

  const useSplits = Array.isArray(splits) && splits.length >= 2;
  if (useSplits) {
    const totalSplit = splits!.reduce((s, sp) => s + roundMoney(Number(sp.amount)), 0);
    if (Math.abs(roundMoney(totalSplit) - roundMoney(abs)) > AMOUNT_EPS) {
      throw new Error('Split amounts must sum to the transaction amount');
    }
  }

  const row = await prisma.bankTransaction.create({
    data: {
      uploadId,
      transactionDate,
      valueDate: null,
      referenceNo: null,
      rawDescription: null,
      description: description?.trim() || null,
      partyName: partyName?.trim() || null,
      amount: abs,
      type,
      categoryId: useSplits ? null : categoryId ?? null,
      siteId: useSplits ? null : siteId ?? null,
      isSplit: false,
      manualOverride: true,
      processed: true,
    },
  });

  if (useSplits) {
    await prisma.$transaction(
      splits!.map((sp) =>
        prisma.transactionSplit.create({
          data: {
            transactionId: row.id,
            categoryId: sp.categoryId,
            siteId: sp.siteId ?? null,
            amount: Number(sp.amount),
            description: sp.description?.trim() || null,
          },
        })
      )
    );
    await prisma.bankTransaction.update({
      where: { id: row.id },
      data: { isSplit: true, categoryId: null, siteId: null },
    });
  }

  await reorderUploadByTransactionDate(uploadId, listSortDate);

  return prisma.bankTransaction.findFirst({
    where: { id: row.id },
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

export interface BankTransactionSummaryResult {
  /** Category display name → net (income allocated − expense allocated). All categories included. */
  byCategory: Record<string, number>;
  uncategorizedCount: number;
  /** Net cash effect of uncategorized non-split transactions (income − expense). */
  uncategorizedNet: number;
  totalIncome: number;
  totalExpense: number;
  /** Project (FinanceSite) name → income total */
  incomeByProject: Record<string, number>;
  /** Project name → expense total */
  expenseByProject: Record<string, number>;
  unassignedProjectIncome: number;
  unassignedProjectExpense: number;
}

/**
 * Category-wise net = sum(INCOME amounts) − sum(EXPENSE amounts) allocated to that category.
 * Refunds as INCOME in the same category increase net; no duplicate category rows.
 */
export async function getTransactionSummary(options: {
  uploadId?: string;
  from?: Date;
  to?: Date;
}): Promise<BankTransactionSummaryResult> {
  const where: Prisma.BankTransactionWhereInput = {
    duplicateOfId: null,
    deletedAt: null,
  };
  if (options.uploadId) where.uploadId = options.uploadId;
  if (options.from || options.to) {
    where.transactionDate = {};
    if (options.from) (where.transactionDate as { gte?: Date }).gte = options.from;
    if (options.to) (where.transactionDate as { lte?: Date }).lte = options.to;
  }

  const [allTx, allCategories, allSites, uncategorizedCount] = await Promise.all([
    prisma.bankTransaction.findMany({
      where,
      select: {
        type: true,
        amount: true,
        isSplit: true,
        categoryId: true,
        siteId: true,
        splits: { select: { amount: true, categoryId: true, siteId: true } },
      },
    }),
    prisma.transactionCategory.findMany({ orderBy: { name: 'asc' } }),
    prisma.financeSite.findMany({ orderBy: { name: 'asc' } }),
    prisma.bankTransaction.count({ where: { ...where, isSplit: false, categoryId: null } }),
  ]);

  const netByCategoryId = new Map<string, number>();
  const incomeBySiteId = new Map<string, number>();
  const expenseBySiteId = new Map<string, number>();
  let unassignedProjectIncome = 0;
  let unassignedProjectExpense = 0;
  let uncategorizedNet = 0;
  let totalIncome = 0;
  let totalExpense = 0;

  for (const t of allTx) {
    const cashAmount = roundMoney(Number(t.amount));
    if (t.type === 'INCOME') totalIncome += cashAmount;
    else totalExpense += cashAmount;

    if (t.isSplit && (t.splits?.length ?? 0) > 0) {
      const sign = t.type === 'INCOME' ? 1 : -1;
      for (const s of t.splits!) {
        const prev = netByCategoryId.get(s.categoryId) ?? 0;
        netByCategoryId.set(s.categoryId, prev + sign * s.amount);
        if (s.siteId) {
          if (t.type === 'INCOME') {
            incomeBySiteId.set(s.siteId, (incomeBySiteId.get(s.siteId) ?? 0) + s.amount);
          } else {
            expenseBySiteId.set(s.siteId, (expenseBySiteId.get(s.siteId) ?? 0) + s.amount);
          }
        } else {
          if (t.type === 'INCOME') unassignedProjectIncome += s.amount;
          else unassignedProjectExpense += s.amount;
        }
      }
    } else if (!t.isSplit) {
      const sign = t.type === 'INCOME' ? 1 : -1;
      if (t.categoryId) {
        const prev = netByCategoryId.get(t.categoryId) ?? 0;
        netByCategoryId.set(t.categoryId, prev + sign * t.amount);
      } else {
        uncategorizedNet += sign * t.amount;
      }
      if (t.siteId) {
        if (t.type === 'INCOME') {
          incomeBySiteId.set(t.siteId, (incomeBySiteId.get(t.siteId) ?? 0) + t.amount);
        } else {
          expenseBySiteId.set(t.siteId, (expenseBySiteId.get(t.siteId) ?? 0) + t.amount);
        }
      } else {
        if (t.type === 'INCOME') unassignedProjectIncome += t.amount;
        else unassignedProjectExpense += t.amount;
      }
    } else {
      uncategorizedNet += t.type === 'INCOME' ? t.amount : -t.amount;
    }
  }

  const byCategory: Record<string, number> = {};
  for (const c of allCategories) {
    byCategory[c.name] = netByCategoryId.get(c.id) ?? 0;
  }

  const incomeByProject: Record<string, number> = {};
  const expenseByProject: Record<string, number> = {};
  for (const s of allSites) {
    incomeByProject[s.name] = incomeBySiteId.get(s.id) ?? 0;
    expenseByProject[s.name] = expenseBySiteId.get(s.id) ?? 0;
  }

  return {
    byCategory,
    uncategorizedCount,
    uncategorizedNet,
    totalIncome,
    totalExpense,
    incomeByProject,
    expenseByProject,
    unassignedProjectIncome,
    unassignedProjectExpense,
  };
}

function nfLabel(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

function isEmptyProjectLabel(raw: string): boolean {
  const t = nfLabel(raw);
  if (!t) return true;
  return t === '—' || t === '-' || t === '–' || t === '--';
}

function labelForFinanceSiteRow(s: { name: string; client: { name: string } | null }): string {
  const c = s.client?.name?.trim();
  return c ? `${c} · ${s.name}` : s.name;
}

function labelForFinanceProjectRow(p: {
  name: string;
  financeSite: { name: string; client: { name: string } | null } | null;
}): string {
  const c = p.financeSite?.client?.name?.trim();
  const site = p.financeSite?.name?.trim();
  const parts = [c, site, p.name].filter(Boolean);
  return parts.join(' · ');
}

/** Lowercased normalized label → FinanceSite id (existing records only). */
async function buildFinanceSiteLabelMap(): Promise<Map<string, string>> {
  const sites = await prisma.financeSite.findMany({ include: { client: true } });
  const projects = await prisma.financeProject.findMany({
    where: { financeSiteId: { not: null } },
    include: { financeSite: { include: { client: true } } },
  });
  const map = new Map<string, string>();
  const put = (label: string, siteId: string) => {
    const k = nfLabel(label).toLowerCase();
    if (!k) return;
    if (!map.has(k)) map.set(k, siteId);
  };
  for (const s of sites) {
    put(labelForFinanceSiteRow(s), s.id);
    put(s.name, s.id);
  }
  for (const p of projects) {
    if (!p.financeSiteId || !p.financeSite) continue;
    put(labelForFinanceProjectRow(p), p.financeSiteId);
  }
  return map;
}

function resolveSiteIdFromProjectLabel(
  raw: string,
  labelToSiteId: Map<string, string>
): string | null {
  if (isEmptyProjectLabel(raw)) return null;
  const k = nfLabel(raw).toLowerCase();
  const direct = labelToSiteId.get(k);
  if (direct) return direct;
  return null;
}

/**
 * Assign FinanceSite from an ordered list of display labels.
 * Ordering: oldest first (sortDate asc), default invoice/bill sort, all types/categories.
 *
 * **Split transactions:** the parent row is not a project target (UI disables it). Only each
 * **split line** consumes one pasted line, in split `id` order. Non-split transactions use one
 * line for the parent row.
 */
export async function applyProjectLabelsByRowOrder(params: {
  uploadId: string;
  toDateInclusive: string;
  names: string[];
}): Promise<{
  rowCount: number;
  nameCount: number;
  /** Lines that map to a normal (non-split) transaction’s project cell */
  nonSplitTransactionLines: number;
  /** Lines that map to split sub-rows only (parent rows are never counted) */
  splitLineTargets: number;
  applied: number;
  cleared: number;
  unmatched: { index: number; label: string }[];
}> {
  const { uploadId, toDateInclusive, names } = params;
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(toDateInclusive.trim());
  if (!dm) throw new Error('toDateInclusive must be YYYY-MM-DD');
  const y = Number(dm[1]);
  const mo = Number(dm[2]);
  const d = Number(dm[3]);
  const toEnd = new Date(Date.UTC(y, mo - 1, d, 23, 59, 59, 999));

  const allTxs: Awaited<ReturnType<typeof getTransactions>>['transactions'] = [];
  let offset = 0;
  const page = 500;
  while (true) {
    const { transactions, total } = await getTransactions({
      uploadId,
      sortDate: 'asc',
      limit: page,
      offset,
      to: toEnd,
      trash: false,
    });
    allTxs.push(...transactions);
    if (allTxs.length >= total || transactions.length === 0) break;
    offset += page;
  }

  type Target =
    | { kind: 'parent'; transactionId: string }
    | { kind: 'split'; transactionId: string; splitId: string };
  const targets: Target[] = [];
  let nonSplitTransactionLines = 0;
  let splitLineTargets = 0;
  for (const t of allTxs) {
    if (t.isSplit && t.splits && t.splits.length > 0) {
      for (const sp of t.splits) {
        targets.push({ kind: 'split', transactionId: t.id, splitId: sp.id });
        splitLineTargets += 1;
      }
    } else {
      targets.push({ kind: 'parent', transactionId: t.id });
      nonSplitTransactionLines += 1;
    }
  }

  const rowCount = targets.length;
  const nameCount = names.length;
  if (rowCount !== nameCount) {
    throw new Error(
      `Pasted line count (${nameCount}) does not match project targets (${rowCount}). ` +
        `Rules: oldest first, through end date, no filters. ` +
        `For a split transaction, do not paste a line for the main/parent row — only one line per split sub-row (in order). ` +
        `For a non-split transaction, paste one line for that row. ` +
        `(This upload: ${nonSplitTransactionLines} non-split rows + ${splitLineTargets} split lines = ${rowCount} targets.)`
    );
  }

  const labelMap = await buildFinanceSiteLabelMap();
  const unmatched: { index: number; label: string }[] = [];
  let applied = 0;
  let cleared = 0;

  for (let i = 0; i < targets.length; i++) {
    const raw = names[i] ?? '';
    const siteId = resolveSiteIdFromProjectLabel(raw, labelMap);
    if (!isEmptyProjectLabel(raw) && siteId === null) {
      unmatched.push({ index: i, label: nfLabel(raw) });
      continue;
    }
    const target = targets[i]!;
    if (target.kind === 'parent') {
      await updateClassification(target.transactionId, { siteId });
    } else {
      await updateTransactionSplit(target.transactionId, target.splitId, { siteId: siteId ?? null });
    }
    if (siteId) applied += 1;
    else cleared += 1;
  }

  return {
    rowCount,
    nameCount,
    nonSplitTransactionLines,
    splitLineTargets,
    applied,
    cleared,
    unmatched,
  };
}

export const bankStatementService = {
  parseFile,
  classifyRows,
  extractPartyName,
  uploadAndProcess,
  getTransactions,
  createManualTransaction,
  reorderUploadByTransactionDate,
  getTransactionSummary,
  updateClassification,
  bulkUpdate,
  reorderTransactions,
  updateTransactionSplit,
  updateTransactionSplitAmountsBatch,
  deleteTransactionSplit,
  bulkSoftDelete,
  bulkRestore,
  bulkHardDelete,
  applyProjectLabelsByRowOrder,
};
