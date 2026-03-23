/**
 * Transaction Processing Engine
 * - Party name extraction (slash-based + fallbacks)
 * - Data cleaning
 * - Auto-category suggestion (keyword-based)
 * - Rule engine
 * - Duplicate detection
 */

import { PrismaClient, type ExpenseCategory } from '@prisma/client';
import type { ParsedRow } from './bank-statement.service.js';

const prisma = new PrismaClient();

export interface ProcessedTransaction {
  transactionDate: Date;
  valueDate?: Date;
  referenceNo?: string;
  rawDescription: string;
  cleanedDescription: string;
  partyName: string;
  amount: number;
  type: 'debit' | 'credit'; // debit = EXPENSE, credit = INCOME
  category?: ExpenseCategory;
  suggestedCategory?: ExpenseCategory;
}

/** Keyword-based auto-category mapping */
const CATEGORY_KEYWORDS: { keywords: RegExp[]; category: ExpenseCategory }[] = [
  { keywords: [/\bfabrication\b/i, /\bmaterial\b/i, /\bpanel\b/i, /\binverter\b/i, /\binstallation\b/i, /\bsite\b/i, /\bproject\b/i, /\bsolar\b/i, /\bequipment\b/i], category: 'SITE_EXPENSE' },
  { keywords: [/\bcommercial\b/i, /\bclient\b/i, /\bsales\b/i, /\bsubsidy\b/i], category: 'COMMERCIAL_EXPENSE' },
  { keywords: [/\bsuryaghar\b/i, /\bloan\b/i, /\bemi\b/i, /\bkisan\b/i], category: 'SURYAGHAR_LOANS' },
  { keywords: [/\bsalary\b/i, /\bsalaries\b/i, /\bsal\b/i, /\bwages\b/i, /\bconveyance\b/i, /\bconvences\b/i], category: 'ALLOWANCES' },
  { keywords: [/\ballowance\b/i, /\bbonus\b/i], category: 'ALLOWANCES' },
  { keywords: [/\bhotel\b/i, /\bfood\b/i, /\baccommodation\b/i, /\blodging\b/i], category: 'FOOD_ACCOMMODATION' },
  { keywords: [/\bmarketing\b/i, /\bads\b/i, /\badvertisement\b/i, /\bbrochure\b/i], category: 'MARKETING' },
  { keywords: [/\bbank\s+charges\b/i, /\boverhead\b/i, /\boffice\b/i, /\brent\b/i, /\butility\b/i, /\bconsultancy\b/i, /\blegal\b/i, /\bplatform\s+fees\b/i], category: 'OVERHEADS' },
  { keywords: [/\bdonation\b/i], category: 'MISC' },
];

/**
 * Extract party name and cleaned description from raw description.
 * Logic: "IMPS/.../ KOTAK MAHINDRA BANK LIMITED/ Tushar Mane/ Fabrication advance"
 * - Split by "/"
 * - Trim values
 * - Second last → party name
 * - Last → description
 * Fallback: mark as "Unknown"
 */
export function extractPartyAndDescription(raw: string): { partyName: string; cleanedDescription: string } {
  if (!raw?.trim()) {
    return { partyName: 'Unknown', cleanedDescription: '' };
  }

  const parts = raw
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    const partyName = parts[parts.length - 2];
    const cleanedDescription = parts[parts.length - 1];
    return {
      partyName: partyName || 'Unknown',
      cleanedDescription: cleanedDescription || raw,
    };
  }

  if (parts.length === 1) {
    const p = parts[0];
    if (p.length >= 2 && /[a-zA-Z]/.test(p)) {
      return { partyName: p, cleanedDescription: p };
    }
  }

  return { partyName: 'Unknown', cleanedDescription: raw.trim() };
}

/**
 * Suggest category from description using keyword-based logic
 */
export function suggestCategoryFromKeywords(description: string, partyName: string): ExpenseCategory | undefined {
  const text = `${description} ${partyName}`.toLowerCase();

  for (const { keywords, category } of CATEGORY_KEYWORDS) {
    if (keywords.some((k) => k.test(text))) {
      return category;
    }
  }

  return undefined;
}

export interface RuleMatch {
  category?: ExpenseCategory;
  siteId?: string;
}

/** Apply user-defined rules. Pass pre-fetched rules for batch processing. */
export function applyRulesSync(
  partyName: string,
  description: string,
  rules: { conditions: unknown; category: ExpenseCategory | null; siteId: string | null }[]
): RuleMatch | null {
  for (const rule of rules) {
    const conditions = rule.conditions as Record<string, unknown>;
    if (!conditions) continue;

    let matches = true;

    if (typeof conditions.partyName === 'string' && conditions.partyName.trim()) {
      if (partyName.toLowerCase() !== conditions.partyName.toLowerCase()) {
        matches = false;
      }
    }
    if (typeof conditions.partyNameContains === 'string' && conditions.partyNameContains.trim()) {
      if (!partyName.toLowerCase().includes(conditions.partyNameContains.toLowerCase())) {
        matches = false;
      }
    }
    if (typeof conditions.descriptionContains === 'string' && conditions.descriptionContains.trim()) {
      const desc = (description || '').toLowerCase();
      if (!desc.includes(conditions.descriptionContains.toLowerCase())) {
        matches = false;
      }
    }

    if (matches) {
      return {
        category: rule.category ?? undefined,
        siteId: rule.siteId ?? undefined,
      };
    }
  }

  return null;
}

/** Fetch rules and apply (for single-row use) */
export async function applyRules(
  partyName: string,
  description: string
): Promise<RuleMatch | null> {
  const rules = await prisma.transactionRule.findMany({
    where: { isActive: true },
    orderBy: { priority: 'desc' },
    select: { conditions: true, category: true, siteId: true },
  });
  return applyRulesSync(partyName, description, rules);
}

/**
 * Detect duplicate: same date + amount + referenceNo (within upload or globally)
 */
export async function findDuplicate(
  uploadId: string,
  transactionDate: Date,
  amount: number,
  referenceNo: string | null
): Promise<string | null> {
  const where: Parameters<typeof prisma.bankTransaction.findFirst>[0]['where'] = {
    uploadId,
    transactionDate,
    amount,
    duplicateOfId: null,
  };

  if (referenceNo?.trim()) {
    where.referenceNo = referenceNo.trim();
  } else {
    where.referenceNo = null;
  }

  const existing = await prisma.bankTransaction.findFirst({
    where,
    select: { id: true },
  });

  return existing?.id ?? null;
}

/**
 * Process a single parsed row into a ProcessedTransaction (sync, pass rules for batch)
 */
export function processRow(
  row: ParsedRow,
  rules?: { conditions: unknown; category: ExpenseCategory | null; siteId: string | null }[]
): ProcessedTransaction | null {
  const withdrawal = parseAmount(row.withdrawals ?? row.debit ?? '');
  const deposit = parseAmount(row.deposits ?? row.credit ?? '');

  let amount = 0;
  let type: 'debit' | 'credit' | null = null;

  if (withdrawal > 0 && deposit === 0) {
    amount = withdrawal;
    type = 'debit';
  } else if (deposit > 0 && withdrawal === 0) {
    amount = deposit;
    type = 'credit';
  } else if (withdrawal > 0 && deposit > 0) {
    amount = withdrawal;
    type = 'debit';
  } else if (row.amount) {
    const amt = parseAmount(row.amount);
    if (amt < 0) {
      amount = Math.abs(amt);
      type = 'debit';
    } else if (amt > 0) {
      amount = amt;
      type = 'credit';
    }
  }

  if (!type || amount <= 0) return null;

  const date = parseDate(row.transactionDate ?? '');
  if (!date) return null;

  const rawDescription = (row.description ?? '').trim() || '';
  const { partyName, cleanedDescription } = extractPartyAndDescription(rawDescription);

  const referenceNo = (row.referenceNo ?? '').trim() || undefined;

  let category: ExpenseCategory | undefined;
  if (rules?.length) {
    const ruleResult = applyRulesSync(partyName, cleanedDescription || rawDescription, rules);
    if (ruleResult?.category) category = ruleResult.category;
  }
  if (!category) {
    category = suggestCategoryFromKeywords(cleanedDescription || rawDescription, partyName);
  }

  return {
    transactionDate: date,
    valueDate: row.valueDate ? parseDate(row.valueDate) ?? undefined : undefined,
    referenceNo,
    rawDescription,
    cleanedDescription,
    partyName: partyName || 'Unknown',
    amount,
    type,
    category,
    suggestedCategory: category,
  };
}

function parseAmount(str: string | number): number {
  if (str === undefined || str === null) return 0;
  if (typeof str === 'number') return isNaN(str) ? 0 : str;
  const cleaned = String(str).replace(/[,\s₹$]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function parseDate(str: string): Date | null {
  if (!str?.trim()) return null;
  const s = str.trim();
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    if (!isNaN(date.getTime())) return date;
  }
  const iso = new Date(s);
  if (!isNaN(iso.getTime())) return iso;
  return null;
}

export const transactionProcessorService = {
  extractPartyAndDescription,
  suggestCategoryFromKeywords,
  applyRules,
  applyRulesSync,
  findDuplicate,
  processRow,
};
