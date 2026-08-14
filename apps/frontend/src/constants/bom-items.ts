import type {
  BomItemAlternative,
  QuotationBomOption,
  TemplateBomItem,
} from '@/types/quotation-template';

export const MAX_BOM_ITEM_ALTERNATIVES = 4;
export const MAX_QUOTATION_BOM_OPTIONS = 2;

export function createBomItem(
  srNo: number,
  partial?: Partial<TemplateBomItem>,
): TemplateBomItem {
  return {
    srNo,
    name: partial?.name ?? '',
    specification: partial?.specification ?? '',
    make: partial?.make ?? '',
    quantity: partial?.quantity ?? null,
    unit: partial?.unit ?? undefined,
    alternatives: partial?.alternatives?.length ? [...partial.alternatives] : undefined,
  };
}

function normalizeAlternative(raw: unknown): BomItemAlternative | null {
  if (!raw || typeof raw !== 'object') return null;
  const alt = raw as Record<string, unknown>;
  const specification = String(alt.specification ?? '').trim();
  const make = String(alt.make ?? '').trim();
  if (!specification && !make) return null;
  return { specification, make };
}

export function normalizeBomItem(raw: unknown, srNo: number): TemplateBomItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const name = String(item.name ?? '').trim();
  if (!name) return null;

  const alternatives = Array.isArray(item.alternatives)
    ? item.alternatives
        .map(normalizeAlternative)
        .filter(Boolean)
        .slice(0, MAX_BOM_ITEM_ALTERNATIVES) as BomItemAlternative[]
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

/** Read bomItems from template/quote JSON, migrating legacy full-BOM `bomOptions` if present. */
export function bomItemsFromStored(
  bomItems: unknown,
  legacyBomOptions?: unknown,
): TemplateBomItem[] {
  if (Array.isArray(bomItems) && bomItems.length) {
    return bomItems
      .map((row, i) => normalizeBomItem(row, i + 1))
      .filter(Boolean) as TemplateBomItem[];
  }

  if (Array.isArray(legacyBomOptions) && legacyBomOptions.length) {
    const first = legacyBomOptions[0] as Record<string, unknown> | undefined;
    if (first && Array.isArray(first.items)) {
      return (first.items as unknown[])
        .map((row, i) => normalizeBomItem(row, i + 1))
        .filter(Boolean) as TemplateBomItem[];
    }
  }

  return [];
}

export function createQuotationBomOption(
  index: number,
  items: TemplateBomItem[],
  template?: { id?: string | null; name?: string; title?: string },
): QuotationBomOption {
  return {
    id: `quote-bom-${Date.now()}-${index}`,
    templateId: template?.id ?? null,
    templateName: template?.name ?? (index === 1 ? 'Default BOM' : 'Custom BOM'),
    title:
      template?.title?.trim()
      || (index === 1
        ? 'Option 1 – Standard Components'
        : 'Option 2 – Value Engineering Option'),
    items: items.map((item, itemIndex) => ({ ...item, srNo: itemIndex + 1 })),
  };
}

export function quotationBomOptionsFromStored(
  stored: unknown,
  fallbackItems: TemplateBomItem[],
): QuotationBomOption[] {
  if (!Array.isArray(stored) || !stored.length) {
    return [createQuotationBomOption(1, fallbackItems, { id: 'default', name: 'Default BOM' })];
  }

  const options = stored
    .slice(0, MAX_QUOTATION_BOM_OPTIONS)
    .map((raw, index) => {
      if (!raw || typeof raw !== 'object') return null;
      const row = raw as Record<string, unknown>;
      const items = bomItemsFromStored(row.items);
      if (!items.length) return null;
      return createQuotationBomOption(index + 1, items, {
        id: typeof row.templateId === 'string' ? row.templateId : null,
        name: String(row.templateName ?? (index === 0 ? 'Default BOM' : 'Custom BOM')),
        title: String(
          row.title
          ?? (index === 0
            ? 'Option 1 – Standard Components'
            : 'Option 2 – Value Engineering Option'),
        ),
      });
    })
    .filter((option): option is QuotationBomOption => option !== null);

  return options.length
    ? options
    : [createQuotationBomOption(1, fallbackItems, { id: 'default', name: 'Default BOM' })];
}

export function serializeQuotationBomOptions(
  options: QuotationBomOption[],
): QuotationBomOption[] {
  return options
    .slice(0, MAX_QUOTATION_BOM_OPTIONS)
    .map((option, index) => ({
      id: option.id,
      templateId: option.templateId,
      templateName: option.templateName.trim() || (index === 0 ? 'Default BOM' : 'Custom BOM'),
      title:
        option.title.trim()
        || (index === 0
          ? 'Option 1 – Standard Components'
          : 'Option 2 – Value Engineering Option'),
      items: serializeBomItems(option.items),
    }))
    .filter((option) => option.items.length > 0);
}

export function serializeBomItems(items: TemplateBomItem[]): TemplateBomItem[] {
  return items
    .filter((item) => item.name.trim())
    .map((item, idx) => {
      const alternatives = (item.alternatives ?? [])
        .map((alt) => ({
          specification: alt.specification.trim(),
          make: alt.make.trim(),
        }))
        .filter((alt) => alt.specification || alt.make)
        .slice(0, MAX_BOM_ITEM_ALTERNATIVES);

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

export function bomItemHasAlternatives(item: TemplateBomItem): boolean {
  return Boolean(item.alternatives?.some((alt) => alt.specification.trim() || alt.make.trim()));
}
