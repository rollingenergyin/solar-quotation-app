export interface BomItemAlternative {
  specification: string;
  make: string;
}

export interface BomItemResolved {
  srNo: number;
  name: string;
  specification: string;
  make: string;
  quantity?: number | null;
  unit?: string;
  alternatives?: BomItemAlternative[];
}

const MAX_ALTERNATIVES = 4;

function normalizeAlternative(raw: unknown): BomItemAlternative | null {
  if (!raw || typeof raw !== 'object') return null;
  const alt = raw as Record<string, unknown>;
  const specification = String(alt.specification ?? '').trim();
  const make = String(alt.make ?? '').trim();
  if (!specification && !make) return null;
  return { specification, make };
}

function normalizeItem(raw: unknown, srNo: number): BomItemResolved | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const name = String(item.name ?? '').trim();
  if (!name) return null;

  const alternatives = Array.isArray(item.alternatives)
    ? item.alternatives
        .map(normalizeAlternative)
        .filter(Boolean)
        .slice(0, MAX_ALTERNATIVES) as BomItemAlternative[]
    : [];

  return {
    srNo,
    name,
    specification: String(item.specification ?? ''),
    make: String(item.make ?? ''),
    quantity: item.quantity != null ? Number(item.quantity) : null,
    unit: item.unit != null ? String(item.unit) : undefined,
    ...(alternatives.length ? { alternatives } : {}),
  };
}

function itemsFromLegacyBomOptions(raw: unknown): BomItemResolved[] | undefined {
  if (!Array.isArray(raw) || !raw.length) return undefined;
  const first = raw[0] as Record<string, unknown> | undefined;
  if (!first || !Array.isArray(first.items)) return undefined;
  const items = first.items
    .map((row, i) => normalizeItem(row, i + 1))
    .filter(Boolean) as BomItemResolved[];
  return items.length ? items : undefined;
}

export function parseBomItemsFromJson(quotationDataJson: unknown): BomItemResolved[] | undefined {
  if (!quotationDataJson || typeof quotationDataJson !== 'object') return undefined;
  const data = quotationDataJson as Record<string, unknown>;

  const overrides = data.templateOverrides as Record<string, unknown> | undefined;
  const overrideItems = overrides?.bomItems;
  if (Array.isArray(overrideItems) && overrideItems.length) {
    const items = overrideItems
      .map((row, i) => normalizeItem(row, i + 1))
      .filter(Boolean) as BomItemResolved[];
    if (items.length) return items;
  }

  const legacyOptions = itemsFromLegacyBomOptions(data.bomOptions);
  if (legacyOptions?.length) return legacyOptions;

  return undefined;
}

export function parseBomItemsFromBody(body: unknown): BomItemResolved[] | undefined {
  if (!Array.isArray(body) || !body.length) return undefined;
  const items = body
    .map((row, i) => normalizeItem(row, i + 1))
    .filter(Boolean) as BomItemResolved[];
  return items.length ? items : undefined;
}

export function serializeBomItemsForStorage(items: BomItemResolved[]): BomItemResolved[] {
  return items.map((item, idx) => {
    const alternatives = (item.alternatives ?? [])
      .map((alt) => ({
        specification: alt.specification.trim(),
        make: alt.make.trim(),
      }))
      .filter((alt) => alt.specification || alt.make)
      .slice(0, MAX_ALTERNATIVES);

    return {
      srNo: idx + 1,
      name: item.name.trim(),
      specification: item.specification.trim(),
      make: item.make.trim(),
      quantity: item.quantity ?? null,
      unit: item.unit,
      ...(alternatives.length ? { alternatives } : {}),
    };
  });
}
