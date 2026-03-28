import type { InvoiceMainKind, PrismaClient } from '@prisma/client';

const DEFAULT_PREFIX: Record<InvoiceMainKind, string> = {
  TAX_INVOICE: '',
  PROFORMA_INVOICE: '',
  QUOTATION: '',
  EWAY_BILL: '',
};

const SEED_ORDER: InvoiceMainKind[] = ['TAX_INVOICE', 'PROFORMA_INVOICE', 'QUOTATION', 'EWAY_BILL'];

export async function ensureFinanceInvoiceSequences(prisma: PrismaClient): Promise<void> {
  for (const mainKind of SEED_ORDER) {
    await prisma.financeInvoiceSequence.upsert({
      where: { mainKind },
      create: { mainKind, prefix: DEFAULT_PREFIX[mainKind], lastNumber: 0 },
      update: {},
    });
  }
}

/** Preview next number without consuming (digits only when prefix empty). */
export async function peekNextInvoiceNumber(
  prisma: PrismaClient,
  mainKind: InvoiceMainKind
): Promise<{ next: string; lastNumber: number }> {
  await ensureFinanceInvoiceSequences(prisma);
  const row = await prisma.financeInvoiceSequence.findUnique({ where: { mainKind } });
  const nextNum = (row?.lastNumber ?? 0) + 1;
  const p = row?.prefix ?? DEFAULT_PREFIX[mainKind];
  const next = p ? `${p}${String(nextNum)}` : String(nextNum);
  return { next, lastNumber: nextNum };
}

/** Allocate and persist next number for a main kind. */
export async function allocateNextInvoiceNumber(
  prisma: PrismaClient,
  mainKind: InvoiceMainKind
): Promise<string> {
  await ensureFinanceInvoiceSequences(prisma);
  return prisma.$transaction(async (tx) => {
    const row = await tx.financeInvoiceSequence.findUnique({ where: { mainKind } });
    const nextNum = (row?.lastNumber ?? 0) + 1;
    const p = row?.prefix ?? DEFAULT_PREFIX[mainKind];
    await tx.financeInvoiceSequence.update({
      where: { mainKind },
      data: { lastNumber: nextNum },
    });
    return p ? `${p}${String(nextNum)}` : String(nextNum);
  });
}
