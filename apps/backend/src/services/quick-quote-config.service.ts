/**
 * Quick Quote system configuration — panel count, structure labels, and
 * supplementary site-cost estimates (does not alter core calculateQuotation totals).
 */

export const DEFAULT_PANEL_WATT = 575;

export type BuildingHeightOption =
  | 'G' | 'G+1' | 'G+2' | 'G+3' | 'G+4' | 'G+5' | 'CUSTOM';

export type MeterPhase = 'SINGLE' | 'THREE';

export type PanelWattageOption =
  | 'DEFAULT' | '540' | '550' | '575' | '590' | '600' | 'CUSTOM';

export type StructureCategory = 'TRAPEZOID' | 'STANDARD' | 'RAISED';

export interface QuickQuoteSystemConfig {
  buildingHeight: BuildingHeightOption;
  buildingHeightCustomFloors?: number | null;
  meterPhase: MeterPhase;
  panelWattage: PanelWattageOption;
  panelWattageCustom?: number | null;
  structureCategory: StructureCategory;
  structureOption: string;
}

export interface SupplementaryCosts {
  wiringCost: number;
  installationCost: number;
  structureCost: number;
  totalAddOn: number;
  dcCableMeters: number;
  acCableMeters: number;
}

export interface QuickQuoteDisplayConfig extends QuickQuoteSystemConfig {
  buildingHeightLabel: string;
  meterPhaseLabel: string;
  panelWattageWp: number;
  numModules: number;
  structureLabel: string;
  supplementaryCosts: SupplementaryCosts;
}

export function buildingHeightLabel(
  option: string,
  customFloors?: number | null,
): string {
  if (option === 'CUSTOM' && customFloors != null) return `Custom (${customFloors} floors)`;
  if (option === 'G') return 'Ground (G)';
  return option.replace('+', ' + ');
}

export function floorsFromBuildingHeight(
  option: string,
  customFloors?: number | null,
): number {
  if (option === 'G') return 0;
  if (option === 'CUSTOM') return Math.max(0, customFloors ?? 0);
  const match = /^G\+(\d+)$/.exec(option);
  return match ? parseInt(match[1]!, 10) : 0;
}

export function resolvePanelWatt(
  option: string,
  customWatt?: number | null,
): number {
  if (!option || option === 'DEFAULT') return DEFAULT_PANEL_WATT;
  if (option === 'CUSTOM') {
    const w = customWatt ?? 0;
    return w > 0 ? w : DEFAULT_PANEL_WATT;
  }
  const w = parseInt(option, 10);
  return w > 0 ? w : DEFAULT_PANEL_WATT;
}

export function calcNumPanels(systemKw: number, panelWatt: number): number {
  if (systemKw <= 0 || panelWatt <= 0) return 0;
  return Math.ceil((systemKw * 1000) / panelWatt);
}

const STRUCTURE_OPTIONS: Record<StructureCategory, { value: string; label: string }[]> = {
  TRAPEZOID: [
    { value: '0ft', label: '0 ft' },
    { value: '1ft', label: '1 ft' },
  ],
  STANDARD: [
    { value: '1ft', label: 'Short leg 1 ft' },
    { value: '2ft', label: 'Short leg 2 ft' },
    { value: '3ft', label: 'Short leg 3 ft' },
  ],
  RAISED: [
    { value: '6ft', label: 'Short leg 6 ft' },
    { value: '7ft', label: 'Short leg 7 ft' },
    { value: '8ft', label: 'Short leg 8 ft' },
  ],
};

export function structureOptionsForCategory(category: StructureCategory) {
  return STRUCTURE_OPTIONS[category] ?? STRUCTURE_OPTIONS.STANDARD;
}

export function structureLabel(category: string, option: string): string {
  const cat = category as StructureCategory;
  const opts = STRUCTURE_OPTIONS[cat];
  const found = opts?.find((o) => o.value === option);
  const prefix =
    cat === 'TRAPEZOID'
      ? 'Trapezoid Structure'
      : cat === 'RAISED'
        ? 'Raised Structure'
        : 'Standard Structure';
  return found ? `${prefix} (${found.label})` : prefix;
}

export function meterPhaseLabel(phase: string): string {
  return phase === 'THREE' ? 'Three Phase' : 'Single Phase';
}

/** Height in metres (~3 m per floor above ground) for cable-length formulas. */
function heightMetres(floors: number): number {
  return Math.max(3, 3 + floors * 3);
}

export function computeSupplementaryCosts(
  systemKw: number,
  config: QuickQuoteSystemConfig,
): SupplementaryCosts {
  const floors = floorsFromBuildingHeight(
    config.buildingHeight,
    config.buildingHeightCustomFloors,
  );
  const heightM = heightMetres(floors);

  const dcCableMeters = Math.round(heightM * 2);
  const acCableMeters = Math.round(heightM * 1.15);

  let wiringCost = Math.round(systemKw * 500 + (dcCableMeters + acCableMeters) * 45);
  if (config.meterPhase === 'THREE') wiringCost = Math.round(wiringCost * 1.25);

  const installationCost = Math.round(systemKw * 800 * (1 + floors * 0.08));

  let structureCost = Math.round(systemKw * 1200);
  if (config.structureCategory === 'TRAPEZOID') {
    structureCost = Math.round(structureCost * (config.structureOption === '1ft' ? 1.1 : 1));
  } else if (config.structureCategory === 'STANDARD') {
    const mult =
      config.structureOption === '3ft' ? 1.2 : config.structureOption === '2ft' ? 1.1 : 1;
    structureCost = Math.round(structureCost * mult);
  } else if (config.structureCategory === 'RAISED') {
    const mult =
      config.structureOption === '8ft' ? 1.45 : config.structureOption === '7ft' ? 1.35 : 1.25;
    structureCost = Math.round(structureCost * mult);
  }

  return {
    wiringCost,
    installationCost,
    structureCost,
    totalAddOn: wiringCost + installationCost + structureCost,
    dcCableMeters,
    acCableMeters,
  };
}

export function buildQuickQuoteDisplayConfig(
  systemKw: number,
  raw: Partial<QuickQuoteSystemConfig>,
): QuickQuoteDisplayConfig {
  const config: QuickQuoteSystemConfig = {
    buildingHeight: (raw.buildingHeight as BuildingHeightOption) ?? 'G',
    buildingHeightCustomFloors: raw.buildingHeightCustomFloors ?? null,
    meterPhase: (raw.meterPhase as MeterPhase) ?? 'SINGLE',
    panelWattage: (raw.panelWattage as PanelWattageOption) ?? 'DEFAULT',
    panelWattageCustom: raw.panelWattageCustom ?? null,
    structureCategory: (raw.structureCategory as StructureCategory) ?? 'STANDARD',
    structureOption: raw.structureOption ?? '1ft',
  };

  const panelWattageWp = resolvePanelWatt(config.panelWattage, config.panelWattageCustom);
  const numModules = calcNumPanels(systemKw, panelWattageWp);

  return {
    ...config,
    buildingHeightLabel: buildingHeightLabel(
      config.buildingHeight,
      config.buildingHeightCustomFloors,
    ),
    meterPhaseLabel: meterPhaseLabel(config.meterPhase),
    panelWattageWp,
    numModules,
    structureLabel: structureLabel(config.structureCategory, config.structureOption),
    supplementaryCosts: computeSupplementaryCosts(systemKw, config),
  };
}

export interface QuickQuoteProposalNote {
  text: string;
  placement: string;
}

export interface QuickQuoteTemplateOverrides {
  bomItems?: {
    srNo: number;
    name: string;
    specification: string;
    make: string;
    quantity?: number | null;
    unit?: string;
    alternatives?: { specification: string; make: string }[];
  }[];
  paymentMilestones?: {
    step: string;
    title: string;
    pct: number;
    desc: string;
    icon: string;
  }[];
  paymentModes?: { icon: string; label: string }[];
  paymentTermsBullets?: string[];
}

export function mergeQuickQuoteTemplateConfig(
  activeTemplate: Record<string, unknown> | null,
  warrantyOverrides?: {
    panelWarrantyYears?: number;
    warrantyItems?: {
      item: string;
      warranty: string;
      alternatives?: { warranty: string }[];
    }[];
  },
  templateOverrides?: QuickQuoteTemplateOverrides,
): Record<string, unknown> | null {
  if (!activeTemplate) return null;

  let merged: Record<string, unknown> = { ...activeTemplate };

  if (warrantyOverrides) {
    if (warrantyOverrides.panelWarrantyYears != null) {
      merged.panelWarrantyYears = warrantyOverrides.panelWarrantyYears;
    }
    if (warrantyOverrides.warrantyItems?.length) {
      merged.warrantyItems = warrantyOverrides.warrantyItems;
    }
  }

  if (templateOverrides) {
    if (templateOverrides.bomItems?.length) {
      merged.bomItems = templateOverrides.bomItems;
    }
    if (templateOverrides.paymentMilestones?.length) {
      merged.paymentMilestones = templateOverrides.paymentMilestones;
    }
    if (templateOverrides.paymentModes?.length) {
      merged.paymentModes = templateOverrides.paymentModes;
    }
    if (templateOverrides.paymentTermsBullets?.length) {
      merged.paymentTermsBullets = templateOverrides.paymentTermsBullets;
    }
  }

  return merged;
}

/** @deprecated use mergeQuickQuoteTemplateConfig */
export function mergeTemplateConfigWithWarrantyOverrides(
  activeTemplate: Record<string, unknown> | null,
  warrantyOverrides?: {
    panelWarrantyYears?: number;
    warrantyItems?: {
      item: string;
      warranty: string;
      alternatives?: { warranty: string }[];
    }[];
  },
): Record<string, unknown> | null {
  return mergeQuickQuoteTemplateConfig(activeTemplate, warrantyOverrides);
}

export function hasQuickQuoteConfig(quotationDataJson: unknown): boolean {
  if (!quotationDataJson || typeof quotationDataJson !== 'object') return false;
  const data = quotationDataJson as Record<string, unknown>;
  if (data.systemConfig) return true;
  const form = data.formData as Record<string, unknown> | undefined;
  return Boolean(
    form?.buildingHeight ||
    form?.meterPhase ||
    form?.panelWattage ||
    form?.structureCategory,
  );
}

export function enrichTemplatePayload(
  payload: Record<string, unknown>,
  systemKw: number,
  quotationDataJson: unknown,
  activeTemplate: Record<string, unknown> | null,
): Record<string, unknown> {
  const parsed = parseQuickQuoteFromJson(quotationDataJson);
  const templateConfig = mergeQuickQuoteTemplateConfig(
    activeTemplate,
    parsed.warrantyOverrides,
    parsed.templateOverrides,
  );

  const proposalNote = normalizeProposalNote(parsed.proposalNote);
  const siteCosting = parseSiteCostingFromJson(quotationDataJson);
  const sitePhotos = parseSitePhotosFromJson(quotationDataJson);

  if (!hasQuickQuoteConfig(quotationDataJson)) {
    return {
      ...payload,
      templateConfig,
      ...(proposalNote ? { proposalNote } : {}),
      ...(siteCosting ? { siteCosting } : {}),
      ...(sitePhotos?.length ? { sitePhotos } : {}),
    };
  }

  const stored = (quotationDataJson as Record<string, unknown> | null)?.systemConfig as
    | QuickQuoteDisplayConfig
    | undefined;
  const display =
    stored ?? buildQuickQuoteDisplayConfig(systemKw, parsed);

  return {
    ...payload,
    numModules: display.numModules,
    panelWattageWp: display.panelWattageWp,
    buildingHeight: display.buildingHeightLabel,
    meterPhase: display.meterPhaseLabel,
    structureType: display.structureLabel,
    supplementaryCosts: display.supplementaryCosts,
    systemConfig: display,
    templateConfig,
    ...(proposalNote ? { proposalNote } : {}),
    ...(siteCosting ? { siteCosting } : {}),
    ...(sitePhotos?.length ? { sitePhotos } : {}),
  };
}

function parseSiteCostingFromJson(quotationDataJson: unknown): Record<string, unknown> | undefined {
  if (!quotationDataJson || typeof quotationDataJson !== 'object') return undefined;
  const data = quotationDataJson as Record<string, unknown>;
  const sc = data.siteCosting;
  if (!sc || typeof sc !== 'object') return undefined;
  const raw = sc as Record<string, unknown>;
  if (!Array.isArray(raw.lineItems)) return undefined;
  return {
    systemSizeKw: Number(raw.systemSizeKw) || 0,
    numPanels: Number(raw.numPanels) || 0,
    lineItems: raw.lineItems,
    subtotal: Number(raw.subtotal) || 0,
    profitMarginPct: Number(raw.profitMarginPct) || 0,
    marginAmount: Number(raw.marginAmount) || 0,
    gstPct: Number(raw.gstPct) || 8.9,
    gstAmount: Number(raw.gstAmount) || 0,
    totalInclGst: Number(raw.totalInclGst) || 0,
    complexityScore: String(raw.complexityScore ?? 'MODERATE'),
    estimatedInstallDays: String(raw.estimatedInstallDays ?? ''),
    roofLayoutSuggestion: raw.roofLayoutSuggestion ? String(raw.roofLayoutSuggestion) : undefined,
    leadQualificationScore: raw.leadQualificationScore != null ? Number(raw.leadQualificationScore) : undefined,
    structureSummary: raw.structureSummary && typeof raw.structureSummary === 'object'
      ? raw.structureSummary
      : undefined,
  };
}

function parseSitePhotosFromJson(quotationDataJson: unknown): { name: string; url: string }[] | undefined {
  if (!quotationDataJson || typeof quotationDataJson !== 'object') return undefined;
  const photos = (quotationDataJson as Record<string, unknown>).sitePhotos;
  if (!Array.isArray(photos)) return undefined;
  return photos
    .filter((p) => p && typeof p === 'object' && (p as { url?: string }).url)
    .map((p) => ({
      name: String((p as { name?: string }).name ?? 'Site photo'),
      url: String((p as { url: string }).url),
    }));
}

function normalizeProposalNote(note: unknown): QuickQuoteProposalNote | undefined {
  if (!note || typeof note !== 'object') return undefined;
  const data = note as Record<string, unknown>;
  const text = typeof data.text === 'string' ? data.text.trim() : '';
  const placement = typeof data.placement === 'string' ? data.placement.trim() : '';
  if (!text || !placement) return undefined;
  return { text, placement };
}

export function parseQuickQuoteFromJson(
  quotationDataJson: unknown,
): Partial<QuickQuoteSystemConfig> & {
  warrantyOverrides?: {
    panelWarrantyYears?: number;
    warrantyItems?: {
      item: string;
      warranty: string;
      alternatives?: { warranty: string }[];
    }[];
  };
  templateOverrides?: QuickQuoteTemplateOverrides;
  proposalNote?: QuickQuoteProposalNote;
} {
  if (!quotationDataJson || typeof quotationDataJson !== 'object') return {};
  const data = quotationDataJson as Record<string, unknown>;
  const form = (data.formData as Record<string, unknown>) ?? {};
  return {
    buildingHeight: form.buildingHeight as BuildingHeightOption | undefined,
    buildingHeightCustomFloors: form.buildingHeightCustomFloors as number | null | undefined,
    meterPhase: form.meterPhase as MeterPhase | undefined,
    panelWattage: form.panelWattage as PanelWattageOption | undefined,
    panelWattageCustom: form.panelWattageCustom as number | null | undefined,
    structureCategory: form.structureCategory as StructureCategory | undefined,
    structureOption: form.structureOption as string | undefined,
    warrantyOverrides: data.warrantyOverrides as {
      panelWarrantyYears?: number;
      warrantyItems?: {
        item: string;
        warranty: string;
        alternatives?: { warranty: string }[];
      }[];
    } | undefined,
    templateOverrides: data.templateOverrides as QuickQuoteTemplateOverrides | undefined,
    proposalNote: normalizeProposalNote(data.proposalNote),
  };
}
