export const DEFAULT_PANEL_WATT = 575;

export const BUILDING_HEIGHT_OPTIONS = [
  { value: 'G', label: 'Ground (G)' },
  { value: 'G+1', label: 'G + 1' },
  { value: 'G+2', label: 'G + 2' },
  { value: 'G+3', label: 'G + 3' },
  { value: 'G+4', label: 'G + 4' },
  { value: 'G+5', label: 'G + 5' },
  { value: 'CUSTOM', label: 'Custom' },
] as const;

export const METER_PHASE_OPTIONS = [
  { value: 'SINGLE', label: 'Single Phase' },
  { value: 'THREE', label: 'Three Phase' },
] as const;

export const PANEL_WATTAGE_OPTIONS = [
  { value: 'DEFAULT', label: 'Use Default (575 W)' },
  { value: '540', label: '540 W' },
  { value: '550', label: '550 W' },
  { value: '575', label: '575 W' },
  { value: '590', label: '590 W' },
  { value: '600', label: '600 W' },
  { value: 'CUSTOM', label: 'Custom' },
] as const;

export const STRUCTURE_CATEGORIES = [
  { value: 'TRAPEZOID', label: 'Trapezoid Structure' },
  { value: 'STANDARD', label: 'Standard Structure' },
  { value: 'RAISED', label: 'Raised Structure' },
] as const;

export const STRUCTURE_OPTIONS: Record<string, { value: string; label: string }[]> = {
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

export const DEFAULT_WARRANTY_ITEMS = [
  { item: 'Solar Module Performance', warranty: '{{panel_warranty_years}}-Year Linear Output Guarantee (≥80% at year {{panel_warranty_years}})' },
  { item: 'Solar Module Product', warranty: '12-Year Manufacturing Defect Warranty' },
  { item: 'Solar Inverter', warranty: '5-Year Standard (Extendable to 10 Years)' },
  { item: 'Mounting Structure', warranty: '10-Year Structural Integrity Warranty' },
  { item: 'Workmanship & Installation', warranty: '5-Year Rolling Energy Workmanship Warranty' },
  { item: 'DC/AC Cables & Connectors', warranty: 'Lifetime (as per IS specification)' },
];

export function resolvePanelWatt(option: string, customWatt?: number | null): number {
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

export const SITE_TYPE_OPTIONS = [
  { value: 'RESIDENTIAL', label: 'Residential' },
  { value: 'SOCIETY', label: 'Society' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'INDUSTRIAL', label: 'Industrial' },
] as const;

export function formatSiteTypeLabel(siteType: string): string {
  return SITE_TYPE_OPTIONS.find((o) => o.value === siteType)?.label ?? siteType;
}

export function formatMeterPhaseLabel(meterPhase: string): string {
  return METER_PHASE_OPTIONS.find((o) => o.value === meterPhase)?.label ?? meterPhase;
}

export function formatStructureLabel(category: string, option: string): string {
  const cat = STRUCTURE_CATEGORIES.find((c) => c.value === category)?.label ?? category;
  const opt = STRUCTURE_OPTIONS[category]?.find((o) => o.value === option)?.label ?? option;
  return `${cat} — ${opt}`;
}

export function floorsFromBuildingHeight(option: string, customFloors?: number | null): number {
  if (option === 'G') return 0;
  if (option === 'CUSTOM') return Math.max(0, customFloors ?? 0);
  const match = /^G\+(\d+)$/.exec(option);
  return match ? parseInt(match[1]!, 10) : 0;
}

export function computeSupplementaryCostsPreview(
  systemKw: number,
  buildingHeight: string,
  buildingHeightCustomFloors: number | null,
  meterPhase: string,
  structureCategory: string,
  structureOption: string,
) {
  const floors = floorsFromBuildingHeight(buildingHeight, buildingHeightCustomFloors);
  const heightM = Math.max(3, 3 + floors * 3);
  const dcCableMeters = Math.round(heightM * 2);
  const acCableMeters = Math.round(heightM * 1.15);

  let wiringCost = Math.round(systemKw * 500 + (dcCableMeters + acCableMeters) * 45);
  if (meterPhase === 'THREE') wiringCost = Math.round(wiringCost * 1.25);

  const installationCost = Math.round(systemKw * 800 * (1 + floors * 0.08));

  let structureCost = Math.round(systemKw * 1200);
  if (structureCategory === 'TRAPEZOID') {
    structureCost = Math.round(structureCost * (structureOption === '1ft' ? 1.1 : 1));
  } else if (structureCategory === 'STANDARD') {
    const mult = structureOption === '3ft' ? 1.2 : structureOption === '2ft' ? 1.1 : 1;
    structureCost = Math.round(structureCost * mult);
  } else if (structureCategory === 'RAISED') {
    const mult = structureOption === '8ft' ? 1.45 : structureOption === '7ft' ? 1.35 : 1.25;
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
