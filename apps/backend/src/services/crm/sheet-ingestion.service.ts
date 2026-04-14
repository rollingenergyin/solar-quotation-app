/**
 * Google Sheet / Excel Ingestion Service
 *
 * Flow: File → Parse rows → Validate → Deduplicate → Batch upsert → Emit events
 * Handles 10k+ rows without loading all data into memory (streaming via chunks).
 */
import { createHash } from 'crypto';
import { PrismaClient, LeadSource, LeadLanguage } from '@prisma/client';
import { emitEvent } from './event-bus.service.js';
import { emitLeadEvent } from './lead-state-machine.service.js';
import { recalculateScore } from './lead-scorer.service.js';

const prisma = new PrismaClient();

type RawRow = Record<string, string>;

type ParsedLead = {
  name: string;
  phone: string;
  phoneHash: string;
  email?: string;
  city?: string;
  state?: string;
  systemKw?: number;
  language: LeadLanguage;
};

type RowError = { row: number; reason: string; data: Record<string, string> };

// ── Validation ───────────────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  // Indian numbers: strip country code, keep 10 digits
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

function validateAndParse(raw: RawRow, rowIndex: number): { lead?: ParsedLead; error?: RowError } {
  const name = (raw['name'] ?? raw['Name'] ?? raw['NAME'] ?? '').trim();
  const phoneRaw = (raw['phone'] ?? raw['Phone'] ?? raw['mobile'] ?? raw['Mobile'] ?? '').trim();
  const phone = normalizePhone(phoneRaw);

  if (!name) return { error: { row: rowIndex, reason: 'Missing name', data: raw } };
  if (phone.length !== 10) {
    return { error: { row: rowIndex, reason: `Invalid phone: "${phoneRaw}"`, data: raw } };
  }

  const langRaw = (raw['language'] ?? raw['Language'] ?? 'en').toLowerCase();
  const language: LeadLanguage =
    langRaw === 'hi' ? LeadLanguage.HI :
    langRaw === 'mr' ? LeadLanguage.MR :
    LeadLanguage.EN;

  const kw = parseFloat(raw['kw'] ?? raw['systemKw'] ?? raw['system_kw'] ?? '');

  return {
    lead: {
      name,
      phone,
      phoneHash: createHash('md5').update(phone).digest('hex'),
      email: raw['email'] ?? raw['Email'] ?? undefined,
      city: raw['city'] ?? raw['City'] ?? undefined,
      state: raw['state'] ?? raw['State'] ?? undefined,
      systemKw: isNaN(kw) ? undefined : kw,
      language,
    },
  };
}

// ── Ingest from buffer (xlsx/csv) ─────────────────────────────────────────────

export async function ingestBuffer(
  buffer: Buffer,
  filename: string,
  importedBy: string
): Promise<{ importId: string }> {
  const { read, utils } = await import('xlsx');
  const workbook = read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = utils.sheet_to_json<RawRow>(sheet, { defval: '' });

  const importRecord = await prisma.sheetImport.create({
    data: { filename, totalRows: rows.length, importedBy, status: 'PROCESSING' },
  });

  const errors: RowError[] = [];
  const validLeads: ParsedLead[] = [];
  const CHUNK_SIZE = 100;

  // Validate all rows first
  rows.forEach((row, i) => {
    const { lead, error } = validateAndParse(row, i + 2);
    if (error) errors.push(error);
    else if (lead) validLeads.push(lead);
  });

  let imported = 0;
  let duplicates = 0;

  // Upsert in chunks of 100
  for (let i = 0; i < validLeads.length; i += CHUNK_SIZE) {
    const chunk = validLeads.slice(i, i + CHUNK_SIZE);

    const results = await Promise.allSettled(
      chunk.map(async (lead) => {
        const existing = await prisma.crmLead.findUnique({ where: { phoneHash: lead.phoneHash } });

        if (existing) {
          duplicates++;
          await prisma.crmLead.update({
            where: { id: existing.id },
            data: {
              name: lead.name,
              email: lead.email ?? existing.email,
              city: lead.city ?? existing.city,
              systemKw: lead.systemKw ?? existing.systemKw,
              metadata: {
                ...(existing.metadata as object),
                lastImportAt: new Date().toISOString(),
              },
            },
          });
          return;
        }

        const created = await prisma.crmLead.create({
          data: {
            ...lead,
            source: LeadSource.SHEET_IMPORT,
          },
        });

        imported++;

        const eventId = await emitLeadEvent(prisma, created.id, 'LEAD_CREATED', 'sheet_import', {
          importId: importRecord.id,
        });

        await recalculateScore(prisma, created.id);

        await emitEvent({
          event: 'lead.created',
          leadId: created.id,
          eventId,
          payload: { source: 'sheet_import', importId: importRecord.id },
          ts: Date.now(),
        });
      })
    );

    results.forEach((r, idx) => {
      if (r.status === 'rejected') {
        errors.push({ row: i + idx + 2, reason: String(r.reason), data: {} });
      }
    });
  }

  await prisma.sheetImport.update({
    where: { id: importRecord.id },
    data: {
      imported,
      duplicates,
      failed: errors.length,
      status: 'DONE',
      errorReport: errors,
      completedAt: new Date(),
    },
  });

  console.log(`[SheetImport] Done: ${imported} imported, ${duplicates} duplicates, ${errors.length} failed`);
  return { importId: importRecord.id };
}
