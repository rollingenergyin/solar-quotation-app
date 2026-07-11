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

export interface StructureAllocationEntry {
  id: string;
  structureType: StructureType;
  /** Used when structureType is CUSTOM — ₹/W for panels on this structure */
  customStructurePricePerWatt: string;
  installationLocation: InstallationLocation;
  /** Preset when installationLocation is CUSTOM */
  customInstallationLocation: string;
  raiseHeight: RaiseHeight;
  /** Preset feet when raiseHeight is CUSTOM */
  customRaiseHeightFt: string;
  numStructures: string;
  numPanels: string;
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

/** Panel capacity per single structure unit (2×2 = 4, 3×3 = 9, 6×6 = 36). */
export const PANELS_PER_STRUCTURE_TYPE: Record<Exclude<StructureType, 'CUSTOM'>, number> = {
  '2X2': 4,
  '3X3': 9,
  '6X6': 36,
};

export const STRUCTURE_TYPE_OPTIONS = [
  { value: '2X2', label: '2×2 Fabrication' },
  { value: '3X3', label: '3×3 Fabrication' },
  { value: '6X6', label: '6×6 Fabrication' },
  { value: 'CUSTOM', label: 'Custom' },
] as const;

export function isFixedStructureType(type: StructureType): boolean {
  return type !== 'CUSTOM';
}

/** Full panel count for fixed structure types (per unit × quantity). */
export function defaultPanelsForEntry(entry: StructureAllocationEntry): number | null {
  if (!isFixedStructureType(entry.structureType)) return null;
  const per = PANELS_PER_STRUCTURE_TYPE[entry.structureType as Exclude<StructureType, 'CUSTOM'>];
  const count = Math.max(1, parseInt(entry.numStructures, 10) || 1);
  return per * count;
}

export function normalizeStructureAllocations(
  entries: StructureAllocationEntry[],
): StructureAllocationEntry[] {
  return entries.map((entry) => {
    const defaultPanels = defaultPanelsForEntry(entry);
    if (defaultPanels == null) return entry;
    const current = parseInt(entry.numPanels, 10);
    if (!entry.numPanels.trim() || !Number.isFinite(current) || current <= 0) {
      return { ...entry, numPanels: String(defaultPanels) };
    }
    return entry;
  });
}

export function applyStructureEntryDefaults(
  entry: StructureAllocationEntry,
  patch: Partial<StructureAllocationEntry>,
): StructureAllocationEntry {
  const next = { ...entry, ...patch };
  const typeOrQtyChanged =
    patch.structureType != null || patch.numStructures != null;
  if (!typeOrQtyChanged) return next;
  const defaultPanels = defaultPanelsForEntry(next);
  if (defaultPanels != null) {
    return { ...next, numPanels: String(defaultPanels) };
  }
  return next;
}

export const INSTALLATION_LOCATION_OPTIONS = [
  { value: 'ON_WATER_TANK', label: 'On Water Tank' },
  { value: 'ROOF_LEVEL', label: 'Roof Level' },
  { value: 'ELEVATED_ROOF', label: 'Elevated Roof Area' },
  { value: 'CUSTOM', label: 'Custom' },
] as const;

export const CUSTOM_INSTALLATION_LOCATION_OPTIONS = [
  { value: 'TERRACE_EXTENSION', label: 'Terrace Extension' },
  { value: 'CAR_PARK_ROOF', label: 'Car Park Roof' },
  { value: 'ANNEX_BLOCK', label: 'Annex Block' },
  { value: 'COURTYARD', label: 'Courtyard' },
] as const;

export const RAISE_HEIGHT_OPTIONS = [
  { value: 'STANDARD', label: 'Standard' },
  { value: '2FT', label: '2 ft' },
  { value: '4FT', label: '4 ft' },
  { value: '6FT', label: '6 ft' },
  { value: '7FT', label: '7 ft' },
  { value: 'CUSTOM', label: 'Custom' },
] as const;

export const CUSTOM_RAISE_HEIGHT_OPTIONS = [
  { value: '3', label: '3 ft' },
  { value: '5', label: '5 ft' },
  { value: '8', label: '8 ft' },
  { value: '10', label: '10 ft' },
] as const;

export function createDefaultStructureEntry(): StructureAllocationEntry {
  const entry: StructureAllocationEntry = {
    id: `sa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    structureType: '3X3',
    customStructurePricePerWatt: '',
    installationLocation: 'ROOF_LEVEL',
    customInstallationLocation: 'TERRACE_EXTENSION',
    raiseHeight: 'STANDARD',
    customRaiseHeightFt: '5',
    numStructures: '1',
    numPanels: '',
  };
  const panels = defaultPanelsForEntry(entry);
  return { ...entry, numPanels: panels != null ? String(panels) : '' };
}

export function structureTypeLabel(type: StructureType): string {
  return STRUCTURE_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

export function installationLocationLabel(
  loc: InstallationLocation,
  custom?: string,
): string {
  if (loc === 'CUSTOM') {
    const preset = CUSTOM_INSTALLATION_LOCATION_OPTIONS.find((o) => o.value === custom);
    return preset?.label ?? 'Custom Location';
  }
  return INSTALLATION_LOCATION_OPTIONS.find((o) => o.value === loc)?.label ?? loc;
}

export function raiseHeightLabel(height: RaiseHeight, customFt?: string): string {
  if (height === 'CUSTOM') {
    const ft = customFt?.trim();
    return ft ? `${ft} ft Raise` : 'Custom Raise';
  }
  const opt = RAISE_HEIGHT_OPTIONS.find((o) => o.value === height);
  if (!opt) return height;
  return height === 'STANDARD' ? 'Standard Height' : `${opt.label} Raise`;
}

export function formatStructureEntryLabel(entry: StructureAllocationEntry, panelWattageWp: number): string {
  const panels = parseInt(entry.numPanels, 10) || 0;
  const type = structureTypeLabel(entry.structureType);
  const loc = installationLocationLabel(entry.installationLocation, entry.customInstallationLocation);
  const raise = raiseHeightLabel(entry.raiseHeight, entry.customRaiseHeightFt);
  const cap =
    panels > 0 && panelWattageWp > 0
      ? ` · ${((panels * panelWattageWp) / 1000).toFixed(2)} kW`
      : '';
  return `${type} | ${loc} | ${raise} | ${panels} Panels${cap}`;
}

export function calcEntryCapacityKw(numPanels: number, panelWattageWp: number): number {
  if (numPanels <= 0 || panelWattageWp <= 0) return 0;
  return Math.round(((numPanels * panelWattageWp) / 1000) * 100) / 100;
}
