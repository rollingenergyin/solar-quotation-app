import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type SystemType = 'DCR' | 'NON_DCR';
export type SiteType = 'RESIDENTIAL' | 'SOCIETY' | 'COMMERCIAL' | 'INDUSTRIAL';

/**
 * Select the best-matching quotation template for a given system type and site type.
 * Priority (most specific first):
 * 1. Exact match: systemType + siteType (e.g. DCR + RESIDENTIAL)
 * 2. Site-type only: systemType=ANY + siteType (e.g. Commercial, Industrial)
 * 3. Fallback: first active template with ANY+ANY (backward compatibility)
 */
export async function selectTemplateForQuotation(
  systemType: SystemType,
  siteType: SiteType
) {
  // Use raw SQL to avoid Prisma client schema sync issues with isDeleted
  const rows = await prisma.$queryRaw<
    Array<{ id: string; systemType: string; siteType: string }>
  >`
    SELECT id, "systemType", "siteType" FROM quotation_templates
    WHERE "isActive" = true AND "isDeleted" = false
    ORDER BY "updatedAt" DESC
  `;

  if (rows.length === 0) return null;

  // Filter to templates that match (systemType matches or template is ANY, same for siteType)
  const matching = rows.filter(
    (t) =>
      (t.systemType === systemType || t.systemType === 'ANY') &&
      (t.siteType === siteType || t.siteType === 'ANY')
  );

  const toPick = matching.length > 0 ? matching : rows;
  const score = (t: { systemType: string; siteType: string }) => {
    const sysExact = t.systemType === systemType ? 2 : 0;
    const siteExact = t.siteType === siteType ? 2 : 0;
    return sysExact + siteExact;
  };
  toPick.sort((a, b) => score(b) - score(a));
  const winner = toPick[0];
  if (!winner) return null;

  const full = await prisma.quotationTemplate.findUnique({ where: { id: winner.id } });
  return full;
}
