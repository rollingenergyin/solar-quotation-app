import {
  BUILDING_HEIGHT_OPTIONS,
  METER_PHASE_OPTIONS,
  PANEL_WATTAGE_OPTIONS,
} from '@/constants/quick-quote-options';
import {
  createDefaultStructureEntry,
  normalizeStructureAllocations,
  type StructureAllocationEntry,
  type StructureAllocationSummary,
} from '@/constants/structure-allocation';

export type { StructureAllocationEntry, StructureAllocationSummary };

export const SITE_COSTING_STORAGE_KEY = 'rolling-site-costing-state';
export const SITE_COSTING_RESULT_KEY = 'rolling-site-costing-result';

export function saveSiteCostingResult(result: SiteCostingResult): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SITE_COSTING_RESULT_KEY, JSON.stringify(result));
}

export function loadSiteCostingResult(): SiteCostingResult | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SITE_COSTING_RESULT_KEY);
    return raw ? (JSON.parse(raw) as SiteCostingResult) : null;
  } catch {
    return null;
  }
}

export const SHADOW_FREE_SPACE_OPTIONS = [
  { value: 'BELOW_300', label: 'Below 300 sqft' },
  { value: '300_500', label: '300–500 sqft' },
  { value: '500_800', label: '500–800 sqft' },
  { value: '800_1200', label: '800–1200 sqft' },
  { value: 'CUSTOM', label: 'Custom' },
] as const;

export const SYSTEM_SIZE_PRESETS = [
  { value: '1', label: '1 kW' },
  { value: '2', label: '2 kW' },
  { value: '3', label: '3 kW' },
  { value: '5', label: '5 kW' },
  { value: '10', label: '10 kW' },
  { value: 'CUSTOM', label: 'Custom' },
] as const;

export const WIRING_COMPLEXITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
] as const;

export const WATER_TANK_POSITION_OPTIONS = [
  { value: 'NO_TANK', label: 'No Tank' },
  { value: 'ON_TANK', label: 'On Tank' },
  { value: 'BELOW_TANK', label: 'Below Tank' },
  { value: 'ADJACENT', label: 'Adjacent to Tank' },
] as const;

export const STRUCTURE_LAYOUT_OPTIONS = [
  { value: 'ONE_3X3', label: 'One 3×3 Structure' },
  { value: 'TWO_3X3', label: 'Two 3×3 Structures' },
  { value: 'THREE_3X3', label: 'Three 3×3 Structures' },
  { value: 'ONE_2X2', label: 'One 2×2 Structure' },
  { value: 'TWO_2X2', label: 'Two 2×2 Structures' },
  { value: 'ONE_3X3_ONE_2X2', label: 'One 3×3 + One 2×2' },
  { value: 'TWO_3X3_ONE_2X2', label: 'Two 3×3 + One 2×2' },
  { value: 'CUSTOM', label: 'Custom Structure' },
] as const;

export { BUILDING_HEIGHT_OPTIONS, METER_PHASE_OPTIONS, PANEL_WATTAGE_OPTIONS };

export interface SiteCostingFormState {
  buildingHeight: string;
  buildingHeightCustomFloors: string;
  shadowFreeSpace: string;
  shadowFreeSpaceCustomSqft: string;
  systemSizePreset: string;
  systemSizeKwCustom: string;
  terraceWiringComplexity: string;
  groundWiringComplexity: string;
  waterTankPosition: string;
  structureLayout: string;
  customStructurePricePerWatt: string;
  panelWattage: string;
  panelWattageCustom: string;
  raisedStructure: boolean;
  meterPhase: string;
  lineItemOverrides: Record<string, number>;
  profitMarginPct: string;
  sitePhotos: { name: string; url: string; dataUrl?: string }[];
  structureAllocations: StructureAllocationEntry[];
}

export const DEFAULT_SITE_COSTING_FORM: SiteCostingFormState = {
  buildingHeight: 'G+1',
  buildingHeightCustomFloors: '',
  shadowFreeSpace: '500_800',
  shadowFreeSpaceCustomSqft: '',
  systemSizePreset: '3',
  systemSizeKwCustom: '',
  terraceWiringComplexity: 'LOW',
  groundWiringComplexity: 'MEDIUM',
  waterTankPosition: 'NO_TANK',
  structureLayout: 'TWO_3X3',
  customStructurePricePerWatt: '',
  panelWattage: 'DEFAULT',
  panelWattageCustom: '',
  raisedStructure: false,
  meterPhase: 'SINGLE',
  lineItemOverrides: {},
  profitMarginPct: '15',
  sitePhotos: [],
  structureAllocations: [createDefaultStructureEntry()],
};

export interface SiteCostingLineItem {
  key: string;
  label: string;
  amount: number;
  quantity?: number | null;
  unit?: string | null;
  rate?: number | null;
  category: string;
  editable: boolean;
}

export interface SiteCostingResult {
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
  complexityScore: 'EASY' | 'MODERATE' | 'COMPLEX';
  estimatedInstallDays: string;
  recommendedMaxKw: number | null;
  roofLayoutSuggestion: string;
  leadQualificationScore: number;
  materialConsumption: { item: string; quantity: number; unit: string }[];
  structureSummary?: StructureAllocationSummary | null;
  supplementaryCosts: {
    wiringCost: number;
    installationCost: number;
    structureCost: number;
    totalAddOn: number;
    dcCableMeters: number;
    acCableMeters: number;
  };
}

export function formStateToApiInputs(form: SiteCostingFormState): Record<string, unknown> {
  return {
    buildingHeight: form.buildingHeight,
    buildingHeightCustomFloors:
      form.buildingHeight === 'CUSTOM' && form.buildingHeightCustomFloors.trim()
        ? parseFloat(form.buildingHeightCustomFloors)
        : null,
    shadowFreeSpace: form.shadowFreeSpace,
    shadowFreeSpaceCustomSqft:
      form.shadowFreeSpace === 'CUSTOM' && form.shadowFreeSpaceCustomSqft.trim()
        ? parseFloat(form.shadowFreeSpaceCustomSqft)
        : null,
    systemSizePreset: form.systemSizePreset,
    systemSizeKwCustom:
      form.systemSizePreset === 'CUSTOM' && form.systemSizeKwCustom.trim()
        ? parseFloat(form.systemSizeKwCustom)
        : null,
    terraceWiringComplexity: form.terraceWiringComplexity,
    groundWiringComplexity: form.groundWiringComplexity,
    waterTankPosition: form.waterTankPosition,
    structureLayout: form.structureLayout,
    customStructurePricePerWatt:
      form.structureLayout === 'CUSTOM' && form.customStructurePricePerWatt.trim()
        ? parseFloat(form.customStructurePricePerWatt)
        : null,
    panelWattage: form.panelWattage,
    panelWattageCustom:
      form.panelWattage === 'CUSTOM' && form.panelWattageCustom.trim()
        ? parseFloat(form.panelWattageCustom)
        : null,
    raisedStructure: form.raisedStructure,
    meterPhase: form.meterPhase,
    structureAllocations: form.structureAllocations.map((entry) => ({
      id: entry.id,
      structureType: entry.structureType,
      customStructurePricePerWatt:
        entry.structureType === 'CUSTOM' && entry.customStructurePricePerWatt.trim()
          ? parseFloat(entry.customStructurePricePerWatt)
          : null,
      installationLocation: entry.installationLocation,
      customInstallationLocation:
        entry.installationLocation === 'CUSTOM' ? entry.customInstallationLocation : null,
      raiseHeight: entry.raiseHeight,
      customRaiseHeightFt:
        entry.raiseHeight === 'CUSTOM' && entry.customRaiseHeightFt.trim()
          ? parseFloat(entry.customRaiseHeightFt)
          : null,
      numStructures: Math.max(1, parseInt(entry.numStructures, 10) || 1),
      numPanels: Math.max(0, parseInt(entry.numPanels, 10) || 0),
    })),
  };
}

export function loadSiteCostingState(): SiteCostingFormState {
  if (typeof window === 'undefined') return { ...DEFAULT_SITE_COSTING_FORM, lineItemOverrides: {} };
  try {
    const raw = sessionStorage.getItem(SITE_COSTING_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SITE_COSTING_FORM, lineItemOverrides: {} };
    const parsed = JSON.parse(raw) as Partial<SiteCostingFormState>;
    return {
      ...DEFAULT_SITE_COSTING_FORM,
      ...parsed,
      structureAllocations: normalizeStructureAllocations(
        parsed.structureAllocations?.length
          ? parsed.structureAllocations
          : DEFAULT_SITE_COSTING_FORM.structureAllocations,
      ),
    };
  } catch {
    return { ...DEFAULT_SITE_COSTING_FORM, lineItemOverrides: {} };
  }
}

export function saveSiteCostingState(form: SiteCostingFormState): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SITE_COSTING_STORAGE_KEY, JSON.stringify(form));
}

export function buildQuickQuoteHref(form: SiteCostingFormState, result: SiteCostingResult | null): string {
  const params = new URLSearchParams();
  params.set('fromSiteCosting', '1');
  if (result?.systemSizeKw) params.set('systemKw', String(result.systemSizeKw));
  if (result?.pricePerWatt) params.set('pricePerWatt', String(result.pricePerWatt));
  params.set('buildingHeight', form.buildingHeight);
  if (form.buildingHeight === 'CUSTOM' && form.buildingHeightCustomFloors) {
    params.set('buildingHeightCustomFloors', form.buildingHeightCustomFloors);
  }
  params.set('meterPhase', form.meterPhase);
  params.set('panelWattage', form.panelWattage);
  if (form.panelWattage === 'CUSTOM' && form.panelWattageCustom) {
    params.set('panelWattageCustom', form.panelWattageCustom);
  }
  params.set('structureCategory', form.raisedStructure ? 'RAISED' : 'STANDARD');
  params.set('structureOption', form.raisedStructure ? '6ft' : '1ft');
  const q = params.toString();
  return `/sales/quick-quotation${q ? `?${q}` : ''}`;
}

export const COMPLEXITY_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  EASY: { label: 'Easy Site', color: '#166534', bg: '#f0fdf4' },
  MODERATE: { label: 'Moderate Site', color: '#92400e', bg: '#fffbeb' },
  COMPLEX: { label: 'Complex Site', color: '#991b1b', bg: '#fef2f2' },
};
