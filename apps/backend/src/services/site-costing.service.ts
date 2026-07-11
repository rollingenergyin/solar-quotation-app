/**
 * Site Costing Engine — automatic installation & material pricing from site assessment inputs.
 */

import {
  calcNumPanels,
  computeSupplementaryCosts,
  floorsFromBuildingHeight,
  resolvePanelWatt,
  type BuildingHeightOption,
  type MeterPhase,
  type PanelWattageOption,
} from './quick-quote-config.service.js';

export type ShadowFreeSpaceOption =
  | 'BELOW_300'
  | '300_500'
  | '500_800'
  | '800_1200'
  | 'CUSTOM';

export type SystemSizePreset = '1' | '2' | '3' | '5' | '10' | 'CUSTOM';

export type WiringComplexity = 'LOW' | 'MEDIUM' | 'HIGH';

export type WaterTankPosition =
  | 'NO_TANK'
  | 'ON_TANK'
  | 'BELOW_TANK'
  | 'ADJACENT';

export type StructureLayoutOption =
  | 'ONE_3X3'
  | 'TWO_3X3'
  | 'THREE_3X3'
  | 'ONE_2X2'
  | 'TWO_2X2'
  | 'ONE_3X3_ONE_2X2'
  | 'TWO_3X3_ONE_2X2'
  | 'CUSTOM';

export type SiteComplexityScore = 'EASY' | 'MODERATE' | 'COMPLEX';

export type StructureType = '2X2' | '3X3' | '6X6' | 'CUSTOM';

export type InstallationLocation =
  | 'ON_WATER_TANK'
  | 'ROOF_LEVEL'
  | 'ELEVATED_ROOF'
  | 'CUSTOM';

export type RaiseHeight =
  | 'STANDARD'
  | '2FT'
  | '4FT'
  | '6FT'
  | '7FT'
  | 'CUSTOM';

export interface StructureAllocationInput {
  id?: string;
  structureType: StructureType;
  customStructurePricePerWatt?: number | null;
  installationLocation: InstallationLocation;
  customInstallationLocation?: string | null;
  raiseHeight: RaiseHeight;
  customRaiseHeightFt?: number | null;
  numStructures: number;
  numPanels: number;
}

export interface StructureEntryCost {
  id: string;
  label: string;
  structureType: string;
  installationLocation: string;
  raiseHeight: string;
  numStructures: number;
  numPanels: number;
  capacityKw: number;
  fabricationCost: number;
  structureCost: number;
  raisedStructureCost: number;
  totalCost: number;
}

export interface StructureAllocationSummary {
  entries: StructureEntryCost[];
  totalFabricationCost: number;
  totalStructureCost: number;
  totalRaisedStructureCost: number;
  totalCost: number;
}

export interface SiteCostingInputs {
  buildingHeight: BuildingHeightOption;
  buildingHeightCustomFloors?: number | null;
  shadowFreeSpace: ShadowFreeSpaceOption;
  shadowFreeSpaceCustomSqft?: number | null;
  systemSizePreset: SystemSizePreset;
  systemSizeKwCustom?: number | null;
  terraceWiringComplexity: WiringComplexity;
  groundWiringComplexity: WiringComplexity;
  waterTankPosition: WaterTankPosition;
  structureLayout: StructureLayoutOption;
  customStructurePricePerWatt?: number | null;
  panelWattage: PanelWattageOption;
  panelWattageCustom?: number | null;
  raisedStructure: boolean;
  meterPhase: MeterPhase;
  structureAllocations?: StructureAllocationInput[];
}

export interface SiteCostingLineItem {
  key: string;
  label: string;
  amount: number;
  quantity?: number | null;
  unit?: string | null;
  rate?: number | null;
  category: 'material' | 'labour' | 'service' | 'other';
  editable: boolean;
}

export interface MaterialConsumptionRow {
  item: string;
  quantity: number;
  unit: string;
}

export interface SiteCostingResult {
  inputs: SiteCostingInputs;
  systemSizeKw: number;
  panelWattageWp: number;
  numPanels: number;
  lineItems: SiteCostingLineItem[];
  subtotal: number;
  profitMarginPct: number;
  marginAmount: number;
  subtotalWithMargin: number;
  gstPct: number;
  gstAmount: number;
  totalInclGst: number;
  pricePerWatt: number;
  complexityScore: SiteComplexityScore;
  estimatedInstallDays: string;
  recommendedMaxKw: number | null;
  roofLayoutSuggestion: string;
  leadQualificationScore: number;
  materialConsumption: MaterialConsumptionRow[];
  supplementaryCosts: ReturnType<typeof computeSupplementaryCosts>;
  structureSummary?: StructureAllocationSummary | null;
}

const GST_PCT = 8.9;
const DEFAULT_PANEL_PPW = 22;

const WIRING_MULT: Record<WiringComplexity, number> = {
  LOW: 1,
  MEDIUM: 1.2,
  HIGH: 1.45,
};

const TANK_MULT: Record<WaterTankPosition, number> = {
  NO_TANK: 1,
  ON_TANK: 1.25,
  BELOW_TANK: 1.15,
  ADJACENT: 1.1,
};

const STRUCTURE_LAYOUT_MULT: Record<Exclude<StructureLayoutOption, 'CUSTOM'>, number> = {
  ONE_3X3: 1,
  TWO_3X3: 1.9,
  THREE_3X3: 2.75,
  ONE_2X2: 0.7,
  TWO_2X2: 1.35,
  ONE_3X3_ONE_2X2: 1.55,
  TWO_3X3_ONE_2X2: 2.35,
};

const STRUCTURE_TYPE_BASE: Record<Exclude<StructureType, 'CUSTOM'>, number> = {
  '2X2': 7500,
  '3X3': 11000,
  '6X6': 20500,
};

const FABRICATION_PER_PANEL: Record<Exclude<StructureType, 'CUSTOM'>, number> = {
  '2X2': 450,
  '3X3': 520,
  '6X6': 680,
};

const LOCATION_MULT: Record<InstallationLocation, number> = {
  ON_WATER_TANK: 1.28,
  ROOF_LEVEL: 1,
  ELEVATED_ROOF: 1.12,
  CUSTOM: 1.15,
};

const RAISE_PREMIUM: Record<Exclude<RaiseHeight, 'STANDARD' | 'CUSTOM'>, number> = {
  '2FT': 0.06,
  '4FT': 0.1,
  '6FT': 0.14,
  '7FT': 0.18,
};

const RAISE_MULT: Record<Exclude<RaiseHeight, 'STANDARD' | 'CUSTOM'>, number> = {
  '2FT': 1.06,
  '4FT': 1.12,
  '6FT': 1.2,
  '7FT': 1.26,
};

const STRUCTURE_TYPE_LABELS: Record<StructureType, string> = {
  '2X2': '2×2 Fabrication',
  '3X3': '3×3 Fabrication',
  '6X6': '6×6 Fabrication',
  CUSTOM: 'Custom Fabrication',
};

const LOCATION_LABELS: Record<InstallationLocation, string> = {
  ON_WATER_TANK: 'On Water Tank',
  ROOF_LEVEL: 'Roof Level',
  ELEVATED_ROOF: 'Elevated Roof Area',
  CUSTOM: 'Custom Location',
};

const CUSTOM_LOCATION_LABELS: Record<string, string> = {
  TERRACE_EXTENSION: 'Terrace Extension',
  CAR_PARK_ROOF: 'Car Park Roof',
  ANNEX_BLOCK: 'Annex Block',
  COURTYARD: 'Courtyard',
};

const SHADOW_MAX_KW: Record<Exclude<ShadowFreeSpaceOption, 'CUSTOM'>, number> = {
  BELOW_300: 2,
  '300_500': 3,
  '500_800': 5,
  '800_1200': 8,
};

function resolveSystemKw(inputs: SiteCostingInputs): number {
  if (inputs.systemSizePreset === 'CUSTOM') {
    const kw = inputs.systemSizeKwCustom ?? 0;
    return kw > 0 ? kw : 0;
  }
  return parseFloat(inputs.systemSizePreset);
}

function recommendedMaxKw(inputs: SiteCostingInputs): number | null {
  if (inputs.shadowFreeSpace === 'CUSTOM') {
    const sqft = inputs.shadowFreeSpaceCustomSqft;
    if (sqft == null || sqft <= 0) return null;
    return Math.round((sqft / 80) * 10) / 10;
  }
  return SHADOW_MAX_KW[inputs.shadowFreeSpace];
}

function wiringComplexityMult(inputs: SiteCostingInputs): number {
  const t = WIRING_MULT[inputs.terraceWiringComplexity];
  const g = WIRING_MULT[inputs.groundWiringComplexity];
  return (t + g) / 2;
}

function raiseHeightLabel(height: RaiseHeight, customFt?: number | null): string {
  if (height === 'STANDARD') return 'Standard Height';
  if (height === 'CUSTOM') {
    return customFt != null && customFt > 0 ? `${customFt} ft Raise` : 'Custom Raise';
  }
  const map: Record<string, string> = {
    '2FT': '2 ft Raise',
    '4FT': '4 ft Raise',
    '6FT': '6 ft Raise',
    '7FT': '7 ft Raise',
  };
  return map[height] ?? height;
}

function installationLocationLabel(
  loc: InstallationLocation,
  custom?: string | null,
): string {
  if (loc === 'CUSTOM') {
    return (custom && CUSTOM_LOCATION_LABELS[custom]) || 'Custom Location';
  }
  return LOCATION_LABELS[loc];
}

function resolveRaiseFactors(
  height: RaiseHeight,
  customFt?: number | null,
): { mult: number; premium: number } {
  if (height === 'STANDARD') return { mult: 1, premium: 0 };
  if (height === 'CUSTOM') {
    const ft = customFt != null && customFt > 0 ? customFt : 5;
    return { mult: 1 + ft * 0.035, premium: Math.min(0.22, ft * 0.025) };
  }
  return { mult: RAISE_MULT[height], premium: RAISE_PREMIUM[height] };
}

function normalizeStructureAllocations(
  raw: unknown,
): StructureAllocationInput[] {
  if (!Array.isArray(raw)) return [];
  const out: StructureAllocationInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const structureType = String(row.structureType ?? '3X3') as StructureType;
    const installationLocation = String(
      row.installationLocation ?? 'ROOF_LEVEL',
    ) as InstallationLocation;
    const raiseHeight = String(row.raiseHeight ?? 'STANDARD') as RaiseHeight;
    const numStructures = Math.max(0, Math.round(Number(row.numStructures) || 0));
    const numPanels = Math.max(0, Math.round(Number(row.numPanels) || 0));
    if (numStructures <= 0 && numPanels <= 0) continue;
    out.push({
      id: String(row.id ?? `sa-${numStructures}-${numPanels}`),
      structureType,
      customStructurePricePerWatt:
        row.customStructurePricePerWatt != null
          ? Number(row.customStructurePricePerWatt)
          : null,
      installationLocation,
      customInstallationLocation:
        row.customInstallationLocation != null
          ? String(row.customInstallationLocation)
          : null,
      raiseHeight,
      customRaiseHeightFt:
        row.customRaiseHeightFt != null ? Number(row.customRaiseHeightFt) : null,
      numStructures: Math.max(1, numStructures || 1),
      numPanels,
    });
  }
  return out;
}

function distributePanelsToAllocations(
  allocations: StructureAllocationInput[],
  totalPanels: number,
): StructureAllocationInput[] {
  const assigned = allocations.reduce((s, a) => s + a.numPanels, 0);
  if (assigned > 0 || totalPanels <= 0) return allocations;
  if (allocations.length === 1) {
    return [{ ...allocations[0], numPanels: totalPanels }];
  }
  const per = Math.floor(totalPanels / allocations.length);
  let rem = totalPanels - per * allocations.length;
  return allocations.map((a, i) => ({
    ...a,
    numPanels: per + (i < rem ? 1 : 0),
  }));
}

function costStructureEntry(
  entry: StructureAllocationInput,
  panelWattageWp: number,
): StructureEntryCost {
  const panels = entry.numPanels;
  const locMult = LOCATION_MULT[entry.installationLocation] ?? 1;
  const { mult: raiseMult, premium } = resolveRaiseFactors(
    entry.raiseHeight,
    entry.customRaiseHeightFt,
  );
  const capacityKw =
    panels > 0 && panelWattageWp > 0
      ? Math.round(((panels * panelWattageWp) / 1000) * 100) / 100
      : 0;

  let structureCost = 0;
  let fabricationCost = 0;

  if (entry.structureType === 'CUSTOM') {
    const ppw = entry.customStructurePricePerWatt ?? 12;
    const watts = panels * panelWattageWp;
    structureCost = Math.round(watts * ppw * locMult * raiseMult);
    fabricationCost = Math.round(panels * panelWattageWp * 0.008 * locMult);
  } else {
    const base = STRUCTURE_TYPE_BASE[entry.structureType];
    const fabPerPanel = FABRICATION_PER_PANEL[entry.structureType];
    structureCost = Math.round(
      entry.numStructures * base * locMult * raiseMult,
    );
    fabricationCost = Math.round(panels * fabPerPanel * locMult);
  }

  const raisedStructureCost = Math.round(
    (structureCost + fabricationCost) * premium,
  );
  const totalCost = structureCost + fabricationCost + raisedStructureCost;

  const label = [
    STRUCTURE_TYPE_LABELS[entry.structureType],
    installationLocationLabel(
      entry.installationLocation,
      entry.customInstallationLocation,
    ),
    raiseHeightLabel(entry.raiseHeight, entry.customRaiseHeightFt),
    `${panels} Panels`,
  ].join(' | ');

  return {
    id: entry.id ?? label,
    label,
    structureType: STRUCTURE_TYPE_LABELS[entry.structureType],
    installationLocation: installationLocationLabel(
      entry.installationLocation,
      entry.customInstallationLocation,
    ),
    raiseHeight: raiseHeightLabel(entry.raiseHeight, entry.customRaiseHeightFt),
    numStructures: entry.numStructures,
    numPanels: panels,
    capacityKw,
    fabricationCost,
    structureCost,
    raisedStructureCost,
    totalCost,
  };
}

function buildStructureSummary(
  allocations: StructureAllocationInput[],
  panelWattageWp: number,
  totalPanels: number,
): StructureAllocationSummary | null {
  if (!allocations.length) return null;
  const resolved = distributePanelsToAllocations(allocations, totalPanels);
  const entries = resolved.map((e) => costStructureEntry(e, panelWattageWp));
  return {
    entries,
    totalFabricationCost: entries.reduce((s, e) => s + e.fabricationCost, 0),
    totalStructureCost: entries.reduce((s, e) => s + e.structureCost, 0),
    totalRaisedStructureCost: entries.reduce((s, e) => s + e.raisedStructureCost, 0),
    totalCost: entries.reduce((s, e) => s + e.totalCost, 0),
  };
}

function hasRaisedAllocations(allocations: StructureAllocationInput[]): boolean {
  return allocations.some(
    (a) => a.raiseHeight !== 'STANDARD',
  );
}

function hasTankAllocations(allocations: StructureAllocationInput[]): boolean {
  return allocations.some((a) => a.installationLocation === 'ON_WATER_TANK');
}

function structureCost(
  systemKw: number,
  inputs: SiteCostingInputs,
  raised: boolean,
): number {
  if (inputs.structureLayout === 'CUSTOM') {
    const ppw = inputs.customStructurePricePerWatt ?? 0;
    if (ppw > 0) return Math.round(systemKw * 1000 * ppw);
    return Math.round(systemKw * 1200);
  }
  const mult = STRUCTURE_LAYOUT_MULT[inputs.structureLayout];
  let cost = Math.round(systemKw * 1200 * mult);
  if (raised) cost = Math.round(cost * 1.12);
  return cost;
}

function complexityScore(inputs: SiteCostingInputs, systemKw: number): SiteComplexityScore {
  let score = 0;
  const floors = floorsFromBuildingHeight(
    inputs.buildingHeight,
    inputs.buildingHeightCustomFloors,
  );
  const allocations = inputs.structureAllocations ?? [];
  if (floors >= 3) score += 2;
  else if (floors >= 1) score += 1;
  if (inputs.terraceWiringComplexity === 'HIGH') score += 2;
  else if (inputs.terraceWiringComplexity === 'MEDIUM') score += 1;
  if (inputs.groundWiringComplexity === 'HIGH') score += 2;
  else if (inputs.groundWiringComplexity === 'MEDIUM') score += 1;
  if (allocations.length) {
    if (hasTankAllocations(allocations)) score += 2;
    if (hasRaisedAllocations(allocations)) score += 1;
    if (allocations.length >= 3) score += 1;
  } else if (inputs.waterTankPosition === 'ON_TANK') score += 2;
  else if (inputs.waterTankPosition !== 'NO_TANK') score += 1;
  if (!allocations.length && inputs.raisedStructure) score += 1;
  if (systemKw >= 10) score += 1;
  const maxKw = recommendedMaxKw(inputs);
  if (maxKw != null && systemKw > maxKw) score += 2;
  if (score >= 6) return 'COMPLEX';
  if (score >= 3) return 'MODERATE';
  return 'EASY';
}

function estimatedInstallDays(inputs: SiteCostingInputs, systemKw: number): string {
  const floors = floorsFromBuildingHeight(
    inputs.buildingHeight,
    inputs.buildingHeightCustomFloors,
  );
  const allocations = inputs.structureAllocations ?? [];
  let days = 2 + Math.ceil(systemKw * 0.35) + Math.floor(floors * 0.5);
  if (inputs.terraceWiringComplexity === 'HIGH') days += 1;
  if (inputs.groundWiringComplexity === 'HIGH') days += 1;
  if (allocations.length) {
    if (hasTankAllocations(allocations)) days += 1;
    if (allocations.length >= 2) days += 1;
  } else if (inputs.waterTankPosition === 'ON_TANK') days += 1;
  const max = days + 2;
  return `${days}–${max} working days`;
}

function suggestRoofLayout(
  numPanels: number,
  structureSummary?: StructureAllocationSummary | null,
): string {
  if (structureSummary?.entries.length) {
    return structureSummary.entries
      .map(
        (e, i) =>
          `${i + 1}. ${e.structureType} · ${e.installationLocation} · ${e.raiseHeight} · ${e.numPanels} panels`,
      )
      .join(' | ');
  }
  if (numPanels <= 0) return 'Enter system size to suggest layout';
  const blocks3x3 = Math.floor(numPanels / 9);
  const rem = numPanels % 9;
  const blocks2x2 = Math.floor(rem / 4);
  const leftover = rem % 4;
  const parts: string[] = [];
  if (blocks3x3) parts.push(`${blocks3x3}× 3×3 (${blocks3x3 * 9} panels)`);
  if (blocks2x2) parts.push(`${blocks2x2}× 2×2 (${blocks2x2 * 4} panels)`);
  if (leftover) parts.push(`${leftover} panel(s) in filler row`);
  return parts.join(' + ') || `${numPanels} panels in single block`;
}

function leadQualificationScore(
  inputs: SiteCostingInputs,
  systemKw: number,
  complexity: SiteComplexityScore,
): number {
  let score = 50;
  const maxKw = recommendedMaxKw(inputs);
  if (maxKw != null) {
    if (systemKw <= maxKw) score += 20;
    else if (systemKw <= maxKw * 1.15) score += 5;
    else score -= 15;
  }
  if (inputs.meterPhase === 'THREE') score += 5;
  if (inputs.shadowFreeSpace === '800_1200' || inputs.shadowFreeSpace === '500_800') score += 10;
  if (complexity === 'EASY') score += 15;
  else if (complexity === 'MODERATE') score += 5;
  else score -= 10;
  if (inputs.waterTankPosition === 'NO_TANK') score += 5;
  return Math.max(0, Math.min(100, score));
}

export function calculateSiteCosting(
  raw: Partial<SiteCostingInputs>,
  lineItemOverrides?: Record<string, number>,
  options?: { profitMarginPct?: number },
): SiteCostingResult {
  const inputs: SiteCostingInputs = {
    buildingHeight: (raw.buildingHeight as BuildingHeightOption) ?? 'G',
    buildingHeightCustomFloors: raw.buildingHeightCustomFloors ?? null,
    shadowFreeSpace: (raw.shadowFreeSpace as ShadowFreeSpaceOption) ?? '500_800',
    shadowFreeSpaceCustomSqft: raw.shadowFreeSpaceCustomSqft ?? null,
    systemSizePreset: (raw.systemSizePreset as SystemSizePreset) ?? '3',
    systemSizeKwCustom: raw.systemSizeKwCustom ?? null,
    terraceWiringComplexity: (raw.terraceWiringComplexity as WiringComplexity) ?? 'LOW',
    groundWiringComplexity: (raw.groundWiringComplexity as WiringComplexity) ?? 'MEDIUM',
    waterTankPosition: (raw.waterTankPosition as WaterTankPosition) ?? 'NO_TANK',
    structureLayout: (raw.structureLayout as StructureLayoutOption) ?? 'TWO_3X3',
    customStructurePricePerWatt: raw.customStructurePricePerWatt ?? null,
    panelWattage: (raw.panelWattage as PanelWattageOption) ?? 'DEFAULT',
    panelWattageCustom: raw.panelWattageCustom ?? null,
    raisedStructure: Boolean(raw.raisedStructure),
    meterPhase: (raw.meterPhase as MeterPhase) ?? 'SINGLE',
    structureAllocations: normalizeStructureAllocations(raw.structureAllocations),
  };

  const systemSizeKw = resolveSystemKw(inputs);
  const panelWattageWp = resolvePanelWatt(inputs.panelWattage, inputs.panelWattageCustom);
  const numPanels = calcNumPanels(systemSizeKw, panelWattageWp);

  const structureSummary = buildStructureSummary(
    inputs.structureAllocations ?? [],
    panelWattageWp,
    numPanels,
  );
  const useAllocations = Boolean(structureSummary?.entries.length);
  const anyRaised = useAllocations
    ? hasRaisedAllocations(inputs.structureAllocations ?? [])
    : inputs.raisedStructure;

  const supplementary = computeSupplementaryCosts(systemSizeKw, {
    buildingHeight: inputs.buildingHeight,
    buildingHeightCustomFloors: inputs.buildingHeightCustomFloors,
    meterPhase: inputs.meterPhase,
    panelWattage: inputs.panelWattage,
    panelWattageCustom: inputs.panelWattageCustom,
    structureCategory: anyRaised ? 'RAISED' : 'STANDARD',
    structureOption: anyRaised ? '6ft' : '1ft',
  });

  const wireMult = wiringComplexityMult(inputs);
  const tankMult = useAllocations
    ? (hasTankAllocations(inputs.structureAllocations ?? []) ? TANK_MULT.ON_TANK : 1)
    : TANK_MULT[inputs.waterTankPosition];
  const floors = floorsFromBuildingHeight(
    inputs.buildingHeight,
    inputs.buildingHeightCustomFloors,
  );

  const panelsCost = Math.round(systemSizeKw * 1000 * DEFAULT_PANEL_PPW);
  const inverterCost = Math.round(systemSizeKw * 3800);
  const structureCostAmt = useAllocations && structureSummary
    ? structureSummary.totalCost
    : structureCost(systemSizeKw, inputs, inputs.raisedStructure);
  const dcCableCost = Math.round(supplementary.dcCableMeters * 85);
  const acCableCost = Math.round(supplementary.acCableMeters * 120);
  const mc4Cost = Math.round(numPanels * 4 * 45);
  const conduitMeters = Math.round((supplementary.dcCableMeters + supplementary.acCableMeters) * 0.85);
  const conduitCost = Math.round(conduitMeters * 65);
  const earthingCost = Math.round(8500 + floors * 1200);
  const lightningCost = anyRaised ? 4500 : 0;
  const labourCost = Math.round(
    systemSizeKw * 600 * wireMult * tankMult * (inputs.meterPhase === 'THREE' ? 1.1 : 1),
  );
  const installationCost = Math.round(supplementary.installationCost * wireMult * tankMult);
  const netMeteringCost = Math.round(12000 + (inputs.meterPhase === 'THREE' ? 4000 : 0));
  const transportCost = Math.round(systemSizeKw * 250 + (inputs.shadowFreeSpace === 'BELOW_300' ? 2000 : 0));
  const miscCost = Math.round(systemSizeKw * 180);

  const baseItems: SiteCostingLineItem[] = [
    { key: 'panels', label: 'Solar Panels', amount: panelsCost, quantity: numPanels, unit: 'nos', rate: panelWattageWp, category: 'material', editable: true },
    { key: 'inverter', label: 'Inverter', amount: inverterCost, quantity: systemSizeKw, unit: 'kW', category: 'material', editable: true },
    { key: 'structure', label: 'Mounting Structure', amount: structureCostAmt, category: 'material', editable: true },
    { key: 'dc_cable', label: 'DC Cable', amount: dcCableCost, quantity: supplementary.dcCableMeters, unit: 'm', rate: 85, category: 'material', editable: true },
    { key: 'ac_cable', label: 'AC Cable', amount: acCableCost, quantity: supplementary.acCableMeters, unit: 'm', rate: 120, category: 'material', editable: true },
    { key: 'mc4', label: 'MC4 Connectors', amount: mc4Cost, quantity: numPanels * 4, unit: 'pairs', category: 'material', editable: true },
    { key: 'conduit', label: 'Conduit / Trunking', amount: conduitCost, quantity: conduitMeters, unit: 'm', rate: 65, category: 'material', editable: true },
    { key: 'earthing', label: 'Earthing & Grounding', amount: earthingCost, category: 'material', editable: true },
    { key: 'lightning_arrestor', label: 'Lightning Arrestor', amount: lightningCost, category: 'material', editable: true },
    { key: 'labour', label: 'Labour', amount: labourCost, category: 'labour', editable: true },
    { key: 'installation', label: 'Installation & Commissioning', amount: installationCost, category: 'labour', editable: true },
    { key: 'net_metering', label: 'Net Metering & DISCOM', amount: netMeteringCost, category: 'service', editable: true },
    { key: 'transport', label: 'Transport & Logistics', amount: transportCost, category: 'other', editable: true },
    { key: 'miscellaneous', label: 'Miscellaneous', amount: miscCost, category: 'other', editable: true },
  ];

  const lineItems = baseItems.map((item) => {
    const override = lineItemOverrides?.[item.key];
    if (override != null && Number.isFinite(override) && override >= 0) {
      return { ...item, amount: Math.round(override) };
    }
    return item;
  });

  const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);
  const profitMarginPct = Math.max(0, Math.min(50, options?.profitMarginPct ?? 0));
  const marginAmount = Math.round(subtotal * (profitMarginPct / 100));
  const subtotalWithMargin = subtotal + marginAmount;
  const gstAmount = Math.round(subtotalWithMargin * (GST_PCT / 100));
  const totalInclGst = subtotalWithMargin + gstAmount;
  const pricePerWatt =
    systemSizeKw > 0
      ? Math.round((subtotalWithMargin / (systemSizeKw * 1000)) * 100) / 100
      : 0;

  const cx = complexityScore(inputs, systemSizeKw);

  const materialConsumption: MaterialConsumptionRow[] = [
    { item: 'Solar Panels', quantity: numPanels, unit: 'nos' },
    { item: 'DC Cable', quantity: supplementary.dcCableMeters, unit: 'm' },
    { item: 'AC Cable', quantity: supplementary.acCableMeters, unit: 'm' },
    { item: 'MC4 Pairs', quantity: numPanels * 4, unit: 'pairs' },
    { item: 'Conduit', quantity: conduitMeters, unit: 'm' },
    { item: 'Structure Clamps', quantity: Math.ceil(numPanels / 2), unit: 'nos' },
  ];

  return {
    inputs,
    systemSizeKw,
    panelWattageWp,
    numPanels,
    lineItems,
    subtotal,
    profitMarginPct,
    marginAmount,
    subtotalWithMargin,
    gstPct: GST_PCT,
    gstAmount,
    totalInclGst,
    pricePerWatt,
    complexityScore: cx,
    estimatedInstallDays: estimatedInstallDays(inputs, systemSizeKw),
    recommendedMaxKw: recommendedMaxKw(inputs),
    roofLayoutSuggestion: suggestRoofLayout(numPanels, structureSummary),
    leadQualificationScore: leadQualificationScore(inputs, systemSizeKw, cx),
    materialConsumption,
    supplementaryCosts: supplementary,
    structureSummary: structureSummary ?? null,
  };
}
