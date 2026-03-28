import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const BANK_BILL_DIR = join(process.cwd(), 'uploads', 'bank-transaction-bills');
const PUBLIC_PREFIX = '/api/finance/bank-transaction-bills';

const BANK_IMPORT_VENDOR = 'Bank statement import';
const BANK_IMPORT_CLIENT = 'Bank statement import';

const ALLOWED_EXT = new Set(['.pdf', '.png', '.jpeg', '.jpg', '.heic', '.heif']);

function extFromName(name: string): string {
  const m = /\.[^.]+$/i.exec(name.trim());
  return m ? m[0].toLowerCase() : '';
}

function mimeFromExt(ext: string): string {
  switch (ext) {
    case '.pdf':
      return 'application/pdf';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.heic':
    case '.heif':
      return 'image/heic';
    default:
      return 'application/octet-stream';
  }
}

export function assertAllowedBankBillFile(originalName: string): { ext: string; mime: string } {
  const ext = extFromName(originalName);
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error('Allowed types: PDF, PNG, JPEG, JPG, HEIC');
  }
  return { ext, mime: mimeFromExt(ext) };
}

export function bankBillFileUrl(storedName: string): string {
  return `${PUBLIC_PREFIX}/${storedName}`;
}

export function deleteStoredBankBillFile(fileUrl: string | null | undefined): void {
  if (!fileUrl?.includes('/bank-transaction-bills/')) return;
  const name = fileUrl.split('/').pop()?.replace(/[^a-f0-9._-]/gi, '') ?? '';
  if (!name) return;
  const base = resolve(BANK_BILL_DIR);
  const full = resolve(base, name);
  if (full.startsWith(base) && existsSync(full)) {
    try {
      unlinkSync(full);
    } catch {
      // ignore
    }
  }
}

async function ensureVendorBankImport(): Promise<string> {
  const v = await prisma.vendor.findFirst({ where: { name: BANK_IMPORT_VENDOR } });
  if (v) return v.id;
  const created = await prisma.vendor.create({ data: { name: BANK_IMPORT_VENDOR } });
  return created.id;
}

async function ensureClientBankImport(): Promise<string> {
  const c = await prisma.financeClient.findFirst({ where: { name: BANK_IMPORT_CLIENT } });
  if (c) return c.id;
  const created = await prisma.financeClient.create({ data: { name: BANK_IMPORT_CLIENT } });
  return created.id;
}

async function resolveProjectIdFromSiteId(siteId: string | null | undefined): Promise<string | null> {
  if (!siteId) return null;
  const p = await prisma.financeProject.findFirst({
    where: { financeSiteId: siteId },
    select: { id: true },
  });
  return p?.id ?? null;
}

/**
 * Upload a bill file for a bank transaction row (parent) or a split row; creates PurchaseBill (debit) or SalesBill (credit).
 */
export async function uploadBankTransactionBill(params: {
  transactionId: string;
  splitId?: string | null;
  buffer: Buffer;
  originalName: string;
}): Promise<{
  fileUrl: string;
  fileName: string;
  purchaseBill: import('@prisma/client').PurchaseBill | null;
  salesBill: import('@prisma/client').SalesBill | null;
}> {
  const { transactionId, splitId, buffer, originalName } = params;
  const { ext } = assertAllowedBankBillFile(originalName);

  const txn = await prisma.bankTransaction.findFirst({
    where: { id: transactionId, deletedAt: null },
    include: { splits: true },
  });
  if (!txn) throw new Error('Transaction not found or is in the recycle bin');

  if (splitId) {
    const sp = txn.splits.find((s) => s.id === splitId);
    if (!sp) throw new Error('Split not found for this transaction');
  }

  const amount = splitId ? txn.splits.find((s) => s.id === splitId)!.amount : txn.amount;
  const siteId = splitId ? txn.splits.find((s) => s.id === splitId)!.siteId : txn.siteId;
  const projectId = await resolveProjectIdFromSiteId(siteId);

  const invoiceNo = `BANK-${splitId ? splitId.slice(-12) : transactionId.slice(-12)}-${Date.now().toString(36)}`;

  if (!existsSync(BANK_BILL_DIR)) mkdirSync(BANK_BILL_DIR, { recursive: true });
  const safe = (originalName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  const storedName = `${randomBytes(12).toString('hex')}${ext}`;
  writeFileSync(join(BANK_BILL_DIR, storedName), buffer);
  const fileUrl = bankBillFileUrl(storedName);

  const existingPurchase = splitId
    ? await prisma.purchaseBill.findFirst({ where: { transactionSplitId: splitId } })
    : await prisma.purchaseBill.findFirst({ where: { bankTransactionId: transactionId } });
  const existingSales = splitId
    ? await prisma.salesBill.findFirst({ where: { transactionSplitId: splitId } })
    : await prisma.salesBill.findFirst({ where: { bankTransactionId: transactionId } });

  if (existingPurchase) {
    deleteStoredBankBillFile(existingPurchase.fileUrl);
    await prisma.purchaseBill.delete({ where: { id: existingPurchase.id } });
  }
  if (existingSales) {
    deleteStoredBankBillFile(existingSales.fileUrl);
    await prisma.salesBill.delete({ where: { id: existingSales.id } });
  }

  if (txn.type === 'EXPENSE') {
    const vendorId = await ensureVendorBankImport();
    const bill = await prisma.purchaseBill.create({
      data: {
        vendorId,
        projectId,
        invoiceNo,
        baseAmount: amount,
        gstAmount: 0,
        totalAmount: amount,
        fileUrl,
        bankTransactionId: splitId ? null : transactionId,
        transactionSplitId: splitId ?? null,
      },
    });
    return { fileUrl, fileName: originalName, purchaseBill: bill, salesBill: null };
  }

  const clientId = await ensureClientBankImport();
  const bill = await prisma.salesBill.create({
    data: {
      clientId,
      projectId,
      invoiceNo,
      baseAmount: amount,
      gstAmount: 0,
      totalAmount: amount,
      fileUrl,
      bankTransactionId: splitId ? null : transactionId,
      transactionSplitId: splitId ?? null,
    },
  });
  return { fileUrl, fileName: originalName, purchaseBill: null, salesBill: bill };
}

export async function deleteBankTransactionBill(transactionId: string, splitId?: string | null): Promise<void> {
  const txn = await prisma.bankTransaction.findUnique({ where: { id: transactionId } });
  if (!txn) throw new Error('Transaction not found');

  if (splitId) {
    const pb = await prisma.purchaseBill.findFirst({ where: { transactionSplitId: splitId } });
    const sb = await prisma.salesBill.findFirst({ where: { transactionSplitId: splitId } });
    if (pb) {
      deleteStoredBankBillFile(pb.fileUrl);
      await prisma.purchaseBill.delete({ where: { id: pb.id } });
    }
    if (sb) {
      deleteStoredBankBillFile(sb.fileUrl);
      await prisma.salesBill.delete({ where: { id: sb.id } });
    }
    return;
  }

  const pb = await prisma.purchaseBill.findFirst({ where: { bankTransactionId: transactionId } });
  const sb = await prisma.salesBill.findFirst({ where: { bankTransactionId: transactionId } });
  if (pb) {
    deleteStoredBankBillFile(pb.fileUrl);
    await prisma.purchaseBill.delete({ where: { id: pb.id } });
  }
  if (sb) {
    deleteStoredBankBillFile(sb.fileUrl);
    await prisma.salesBill.delete({ where: { id: sb.id } });
  }
}

export function contentTypeForBankBillFile(name: string): string {
  return mimeFromExt(extFromName(name));
}
