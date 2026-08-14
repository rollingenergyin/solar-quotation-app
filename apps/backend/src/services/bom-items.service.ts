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

export interface QuotationBomOptionResolved {
  id: string;
  templateId: string | null;
  templateName: string;
  title: string;
  items: BomItemResolved[];
}

const MAX_ALTERNATIVES = 4;
const MAX_QUOTATION_BOM_OPTIONS = 2;

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
interface JsonObject {
  [key: string]: JsonValue;
}

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

export function parseQuotationBomOptionsFromBody(
  body: unknown,
): QuotationBomOptionResolved[] | undefined {
  if (!Array.isArray(body) || !body.length) return undefined;

  const options = body
    .slice(0, MAX_QUOTATION_BOM_OPTIONS)
    .map((raw, index) => {
      if (!raw || typeof raw !== 'object') return null;
      const option = raw as Record<string, unknown>;
      const items = parseBomItemsFromBody(option.items);
      if (!items?.length) return null;

      return {
        id: String(option.id ?? `quote-bom-${index + 1}`),
        templateId:
          typeof option.templateId === 'string' && option.templateId.trim()
            ? option.templateId.trim()
            : null,
        templateName:
          String(option.templateName ?? '').trim()
          || (index === 0 ? 'Default BOM' : 'Custom BOM'),
        title:
          String(option.title ?? '').trim()
          || (index === 0
            ? 'Option 1 – Standard Components'
            : 'Option 2 – Value Engineering Option'),
        items: serializeBomItemsForStorage(items),
      };
    })
    .filter((option): option is QuotationBomOptionResolved => option !== null);

  return options.length ? options : undefined;
}

export function parseQuotationBomOptionsFromJson(
  quotationDataJson: unknown,
): QuotationBomOptionResolved[] | undefined {
  if (!quotationDataJson || typeof quotationDataJson !== 'object') return undefined;
  const data = quotationDataJson as Record<string, unknown>;
  return parseQuotationBomOptionsFromBody(data.bomOptions);
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

/** Prisma-compatible JSON objects with undefined properties omitted. */
export function serializeBomItemsForJsonStorage(items: BomItemResolved[]): JsonObject[] {
  return serializeBomItemsForStorage(items).map((item) => ({
    srNo: item.srNo,
    name: item.name,
    specification: item.specification,
    make: item.make,
    quantity: item.quantity ?? null,
    ...(item.unit ? { unit: item.unit } : {}),
    ...(item.alternatives?.length
      ? {
          alternatives: item.alternatives.map((alternative) => ({
            specification: alternative.specification,
            make: alternative.make,
          })),
        }
      : {}),
  }));
}
