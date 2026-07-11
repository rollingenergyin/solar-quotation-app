import type { TemplateWarranty, WarrantyAlternative } from '@/types/quotation-template';

export const MAX_WARRANTY_ITEM_ALTERNATIVES = 4;

export function createWarrantyItem(partial?: Partial<TemplateWarranty>): TemplateWarranty {
  return {
    item: partial?.item ?? '',
    warranty: partial?.warranty ?? '',
    alternatives: partial?.alternatives?.length ? [...partial.alternatives] : undefined,
  };
}

function normalizeAlternative(raw: unknown): WarrantyAlternative | null {
  if (!raw || typeof raw !== 'object') return null;
  const alt = raw as Record<string, unknown>;
  const warranty = String(alt.warranty ?? '').trim();
  if (!warranty) return null;
  return { warranty };
}

export function normalizeWarrantyItem(raw: unknown): TemplateWarranty | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const item = String(row.item ?? '').trim();
  if (!item) return null;

  const alternatives = Array.isArray(row.alternatives)
    ? row.alternatives
        .map(normalizeAlternative)
        .filter(Boolean)
        .slice(0, MAX_WARRANTY_ITEM_ALTERNATIVES) as WarrantyAlternative[]
    : [];

  return {
    item,
    warranty: String(row.warranty ?? ''),
    ...(alternatives.length ? { alternatives } : {}),
  };
}

export function warrantyItemsFromStored(stored: unknown): TemplateWarranty[] {
  if (!Array.isArray(stored) || !stored.length) return [];
  return stored
    .map((row) => normalizeWarrantyItem(row))
    .filter(Boolean) as TemplateWarranty[];
}

export function serializeWarrantyItems(items: TemplateWarranty[]): TemplateWarranty[] {
  return items
    .filter((row) => row.item.trim())
    .map((row) => {
      const alternatives = (row.alternatives ?? [])
        .map((alt) => ({ warranty: alt.warranty.trim() }))
        .filter((alt) => alt.warranty)
        .slice(0, MAX_WARRANTY_ITEM_ALTERNATIVES);

      return {
        item: row.item.trim(),
        warranty: row.warranty.trim(),
        ...(alternatives.length ? { alternatives } : {}),
      };
    });
}

export function warrantyItemHasAlternatives(item: TemplateWarranty): boolean {
  return Boolean(item.alternatives?.some((alt) => alt.warranty.trim()));
}
