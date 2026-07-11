export interface WarrantyAlternative {
  warranty: string;
}

export interface WarrantyItemResolved {
  item: string;
  warranty: string;
  alternatives?: WarrantyAlternative[];
}

const MAX_ALTERNATIVES = 4;

function normalizeAlternative(raw: unknown): WarrantyAlternative | null {
  if (!raw || typeof raw !== 'object') return null;
  const alt = raw as Record<string, unknown>;
  const warranty = String(alt.warranty ?? '').trim();
  if (!warranty) return null;
  return { warranty };
}

function normalizeItem(raw: unknown): WarrantyItemResolved | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const item = String(row.item ?? '').trim();
  if (!item) return null;

  const alternatives = Array.isArray(row.alternatives)
    ? row.alternatives
        .map(normalizeAlternative)
        .filter(Boolean)
        .slice(0, MAX_ALTERNATIVES) as WarrantyAlternative[]
    : [];

  return {
    item,
    warranty: String(row.warranty ?? ''),
    ...(alternatives.length ? { alternatives } : {}),
  };
}

export function parseWarrantyItemsFromBody(body: unknown): WarrantyItemResolved[] | undefined {
  if (!Array.isArray(body) || !body.length) return undefined;
  const items = body
    .map((row) => normalizeItem(row))
    .filter(Boolean) as WarrantyItemResolved[];
  return items.length ? items : undefined;
}

export function serializeWarrantyItemsForStorage(items: WarrantyItemResolved[]): WarrantyItemResolved[] {
  return items.map((row) => {
    const alternatives = (row.alternatives ?? [])
      .map((alt) => ({ warranty: alt.warranty.trim() }))
      .filter((alt) => alt.warranty)
      .slice(0, MAX_ALTERNATIVES);

    return {
      item: row.item.trim(),
      warranty: row.warranty.trim(),
      ...(alternatives.length ? { alternatives } : {}),
    };
  });
}
