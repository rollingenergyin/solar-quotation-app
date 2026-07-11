import { ROI_DAYS_PER_YEAR } from '@/constants/roi-generation';
import {
  formatMeterPhaseLabel,
  formatSiteTypeLabel,
  formatStructureLabel,
} from '@/constants/quick-quote-options';

export type QuotationMode = 'SINGLE' | 'COMBINED';
export type CombinedSiteType = 'RESIDENTIAL' | 'SOCIETY' | 'COMMERCIAL' | 'INDUSTRIAL';
export type CombinedConnectionType = 'RESIDENTIAL' | 'COMMERCIAL';

export const COMBINED_CONNECTION_OPTIONS = [
  { value: 'RESIDENTIAL' as const, label: 'Residential' },
  { value: 'COMMERCIAL' as const, label: 'Commercial' },
];
export type CombinedMeterPhase = 'SINGLE' | 'THREE';
export type CombinedStructureCategory = 'TRAPEZOID' | 'STANDARD' | 'RAISED';

export const QUOTATION_MODE_OPTIONS = [
  { value: 'SINGLE', label: 'Single System', hint: 'One system per quotation (current behaviour)' },
  { value: 'COMBINED', label: 'Combined Systems', hint: 'Multiple systems in one quotation' },
] as const;

export const MIN_COMBINED_SYSTEMS = 2;
export const MAX_COMBINED_SYSTEMS = 6;

/** System pricing cards per combined-systems print page (two-column layout fits 3 comfortably). */
export const COMBINED_SYSTEMS_PER_PRINT_PAGE = 3;

export interface CombinedSystemRow {
  id: string;
  label: string;
  consumerNumber: string;
  capacityKw: string;
  pricePerWatt: string;
  totalBaseAmount: string;
  totalCostInclGst: string;
  siteType: CombinedSiteType;
  meterPhase: CombinedMeterPhase;
  structureCategory: CombinedStructureCategory;
  structureOption: string;
  sanctionedLoadKw: string;
  sanctionedLoadIncreasedToKw: string;
  sanctionedLoadIncreasedToManual?: boolean;
}

export interface CombinedSystemCalculated {
  index: number;
  label: string;
  consumerNumber: string;
  displayName: string;
  systemSizeKw: number;
  pricePerWatt: number;
  siteType: CombinedSiteType;
  meterPhase: CombinedMeterPhase;
  structureCategory: CombinedStructureCategory;
  structureOption: string;
  siteTypeLabel: string;
  meterPhaseLabel: string;
  structureLabel: string;
  baseCost: number;
  gstAmount: number;
  grossCost: number;
  subsidyAmount: number;
  netCost: number;
  dailyProductionKwh: number;
  annualProductionKwh: number;
  annualSavings: number;
  breakevenYears: number;
  savings30YrRs: number;
  sanctionedLoadKw: number | null;
  sanctionedLoadIncreasedToKw: number | null;
}

export interface CombinedSummary {
  systemSizeKw: number;
  baseCost: number;
  gstAmount: number;
  grossCost: number;
  subsidyAmount: number;
  netCost: number;
  dailyProductionKwh: number;
  annualProductionKwh: number;
  annualSavings: number;
  breakevenYears: number;
  savings30YrRs: number;
  blendedPricePerWatt: number;
}

const GST_RATE = 0.089;

export function createCombinedSystemRow(
  index: number,
  defaults?: Partial<Pick<CombinedSystemRow, 'siteType' | 'meterPhase' | 'structureCategory' | 'structureOption'>>,
): CombinedSystemRow {
  const structureCategory = defaults?.structureCategory ?? 'STANDARD';
  return {
    id: `sys-${Date.now()}-${index}`,
    label: `System ${index}`,
    consumerNumber: '',
    capacityKw: '',
    pricePerWatt: '55',
    totalBaseAmount: '',
    totalCostInclGst: '',
    siteType: defaults?.siteType ?? 'RESIDENTIAL',
    meterPhase: defaults?.meterPhase ?? 'SINGLE',
    structureCategory,
    structureOption: defaults?.structureOption ?? '1ft',
    sanctionedLoadKw: '',
    sanctionedLoadIncreasedToKw: '',
    sanctionedLoadIncreasedToManual: false,
  };
}

export function parseOptionalSanctionedLoadKw(value: string): number | null {
  const v = parseFloat(value);
  return value.trim() !== '' && Number.isFinite(v) && v >= 0 ? v : null;
}

function calcSubsidy(kw: number, systemType: string, siteType: string): number {
  if (systemType === 'NON_DCR' || siteType === 'COMMERCIAL' || siteType === 'INDUSTRIAL') return 0;
  if (siteType === 'SOCIETY') return Math.round(kw * 18000);
  if (kw <= 1) return 30000;
  if (kw <= 2) return 60000;
  return 78000;
}

function calc30YrSavings(annualYr1: number, inflationPct = 3): number {
  let total = 0;
  for (let y = 0; y < 30; y++) {
    total += Math.round(annualYr1 * Math.pow(1 + inflationPct / 100, y));
  }
  return total;
}

export function systemDisplayName(label: string, consumerNumber?: string): string {
  const cn = consumerNumber?.trim();
  return cn ? `${label} – Consumer No. ${cn}` : label;
}

export function effectivePricePerWattForRow(
  row: CombinedSystemRow,
  gstRate = GST_RATE,
): number {
  const kw = parseFloat(row.capacityKw);
  const ppw = parseFloat(row.pricePerWatt);
  if (ppw > 0) return ppw;
  const base = parseFloat(row.totalBaseAmount);
  if (base > 0 && kw > 0) return base / (kw * 1000);
  const gross = parseFloat(row.totalCostInclGst);
  if (gross > 0 && kw > 0) {
    const estimatedBase = Math.round(gross / (1 + gstRate));
    return estimatedBase / (kw * 1000);
  }
  return 0;
}

export interface CombinedPreviewOptions {
  singleCosting?: boolean;
  combinedPricePerWatt?: number;
}

export function calculateCombinedSystemsPreview(
  rows: CombinedSystemRow[],
  systemType: string,
  defaultSiteType: string,
  electricityRate: number,
  peakSunHours: number,
  options?: CombinedPreviewOptions,
): { systems: CombinedSystemCalculated[]; combined: CombinedSummary } | null {
  if (options?.singleCosting) {
    return calculateCombinedSystemsPreviewSingleCosting(
      rows,
      systemType,
      defaultSiteType,
      electricityRate,
      peakSunHours,
      options.combinedPricePerWatt ?? 0,
    );
  }
  const inputs = rows
    .map((row, i) => {
      const kw = parseFloat(row.capacityKw);
      const ppw = effectivePricePerWattForRow(row);
      if (kw <= 0 || ppw <= 0) return null;
      const siteType = row.siteType || defaultSiteType;
      return {
        label: row.label || `System ${i + 1}`,
        consumerNumber: row.consumerNumber,
        systemSizeKw: kw,
        pricePerWatt: ppw,
        siteType,
        meterPhase: row.meterPhase,
        structureCategory: row.structureCategory,
        structureOption: row.structureOption,
        sanctionedLoadKw: parseOptionalSanctionedLoadKw(row.sanctionedLoadKw),
        sanctionedLoadIncreasedToKw: (() => {
          const manual = parseOptionalSanctionedLoadKw(row.sanctionedLoadIncreasedToKw);
          if (manual != null) return manual;
          return kw > 0 ? kw : null;
        })(),
      };
    })
    .filter(Boolean) as {
      label: string;
      consumerNumber: string;
      systemSizeKw: number;
      pricePerWatt: number;
      siteType: CombinedSiteType;
      meterPhase: CombinedMeterPhase;
      structureCategory: CombinedStructureCategory;
      structureOption: string;
      sanctionedLoadKw: number | null;
      sanctionedLoadIncreasedToKw: number | null;
    }[];

  if (inputs.length < 2) return null;

  const calculated = inputs.map((s, i) => {
    const baseCost = Math.round(s.systemSizeKw * 1000 * s.pricePerWatt);
    const gstAmount = Math.round(baseCost * GST_RATE);
    const grossCost = baseCost + gstAmount;
    const subsidyAmount = calcSubsidy(s.systemSizeKw, systemType, s.siteType);
    const netCost = Math.max(0, grossCost - subsidyAmount);
    const dailyProductionKwh = Math.round(s.systemSizeKw * peakSunHours * 10) / 10;
    const annualProductionKwh = Math.round(dailyProductionKwh * ROI_DAYS_PER_YEAR);
    const annualSavings = Math.round(annualProductionKwh * electricityRate);
    const breakevenYears =
      annualSavings > 0 ? Math.round((netCost / annualSavings) * 10) / 10 : 0;

    return {
      index: i + 1,
      label: s.label,
      consumerNumber: s.consumerNumber?.trim() ?? '',
      displayName: systemDisplayName(s.label, s.consumerNumber),
      systemSizeKw: s.systemSizeKw,
      pricePerWatt: s.pricePerWatt,
      siteType: s.siteType,
      meterPhase: s.meterPhase,
      structureCategory: s.structureCategory,
      structureOption: s.structureOption,
      siteTypeLabel: formatSiteTypeLabel(s.siteType),
      meterPhaseLabel: formatMeterPhaseLabel(s.meterPhase),
      structureLabel: formatStructureLabel(s.structureCategory, s.structureOption),
      baseCost,
      gstAmount,
      grossCost,
      subsidyAmount,
      netCost,
      dailyProductionKwh,
      annualProductionKwh,
      annualSavings,
      breakevenYears,
      savings30YrRs: calc30YrSavings(annualSavings),
      sanctionedLoadKw: s.sanctionedLoadKw,
      sanctionedLoadIncreasedToKw: s.sanctionedLoadIncreasedToKw,
    };
  });

  const combined: CombinedSummary = {
    systemSizeKw: calculated.reduce((sum, x) => sum + x.systemSizeKw, 0),
    baseCost: calculated.reduce((sum, x) => sum + x.baseCost, 0),
    gstAmount: calculated.reduce((sum, x) => sum + x.gstAmount, 0),
    grossCost: calculated.reduce((sum, x) => sum + x.grossCost, 0),
    subsidyAmount: calculated.reduce((sum, x) => sum + x.subsidyAmount, 0),
    netCost: calculated.reduce((sum, x) => sum + x.netCost, 0),
    dailyProductionKwh:
      Math.round(calculated.reduce((sum, x) => sum + x.dailyProductionKwh, 0) * 10) / 10,
    annualProductionKwh: calculated.reduce((sum, x) => sum + x.annualProductionKwh, 0),
    annualSavings: calculated.reduce((sum, x) => sum + x.annualSavings, 0),
    savings30YrRs: calculated.reduce((sum, x) => sum + x.savings30YrRs, 0),
    breakevenYears: 0,
    blendedPricePerWatt: 0,
  };
  combined.breakevenYears =
    combined.annualSavings > 0
      ? Math.round((combined.netCost / combined.annualSavings) * 10) / 10
      : 0;
  combined.blendedPricePerWatt =
    combined.systemSizeKw > 0 ? combined.baseCost / (combined.systemSizeKw * 1000) : 0;

  return { systems: calculated, combined };
}

function calculateCombinedSystemsPreviewSingleCosting(
  rows: CombinedSystemRow[],
  systemType: string,
  defaultSiteType: string,
  electricityRate: number,
  peakSunHours: number,
  combinedPricePerWatt: number,
): { systems: CombinedSystemCalculated[]; combined: CombinedSummary } | null {
  const inputs = rows
    .map((row, i) => {
      const kw = parseFloat(row.capacityKw);
      if (kw <= 0) return null;
      const siteType = row.siteType || defaultSiteType;
      return {
        label: row.label || `System ${i + 1}`,
        consumerNumber: row.consumerNumber,
        systemSizeKw: kw,
        siteType,
        meterPhase: row.meterPhase,
        structureCategory: row.structureCategory,
        structureOption: row.structureOption,
        sanctionedLoadKw: parseOptionalSanctionedLoadKw(row.sanctionedLoadKw),
        sanctionedLoadIncreasedToKw: (() => {
          const manual = parseOptionalSanctionedLoadKw(row.sanctionedLoadIncreasedToKw);
          if (manual != null) return manual;
          return kw > 0 ? kw : null;
        })(),
      };
    })
    .filter(Boolean) as {
      label: string;
      consumerNumber: string;
      systemSizeKw: number;
      siteType: CombinedSiteType;
      meterPhase: CombinedMeterPhase;
      structureCategory: CombinedStructureCategory;
      structureOption: string;
      sanctionedLoadKw: number | null;
      sanctionedLoadIncreasedToKw: number | null;
    }[];

  if (inputs.length < 2 || combinedPricePerWatt <= 0) return null;

  const totalKw = inputs.reduce((sum, s) => sum + s.systemSizeKw, 0);
  const baseCost = Math.round(totalKw * 1000 * combinedPricePerWatt);
  const gstAmount = Math.round(baseCost * GST_RATE);
  const grossCost = baseCost + gstAmount;
  const subsidyAmount = inputs.reduce(
    (sum, s) => sum + calcSubsidy(s.systemSizeKw, systemType, s.siteType),
    0,
  );
  const netCost = Math.max(0, grossCost - subsidyAmount);
  const dailyProductionKwh = Math.round(totalKw * peakSunHours * 10) / 10;
  const annualProductionKwh = Math.round(dailyProductionKwh * ROI_DAYS_PER_YEAR);
  const annualSavings = Math.round(annualProductionKwh * electricityRate);
  const breakevenYears =
    annualSavings > 0 ? Math.round((netCost / annualSavings) * 10) / 10 : 0;
  const savings30YrRs = calc30YrSavings(annualSavings);

  const systems: CombinedSystemCalculated[] = inputs.map((s, i) => {
    const dailyProductionKwh = Math.round(s.systemSizeKw * peakSunHours * 10) / 10;
    const annualProductionKwh = Math.round(dailyProductionKwh * ROI_DAYS_PER_YEAR);
    const annualSavings = Math.round(annualProductionKwh * electricityRate);
    const savings30YrRs = calc30YrSavings(annualSavings);
    const allocatedNetCost =
      totalKw > 0 ? Math.round(netCost * (s.systemSizeKw / totalKw)) : 0;
    const breakevenYears =
      annualSavings > 0 ? Math.round((allocatedNetCost / annualSavings) * 10) / 10 : 0;

    return {
      index: i + 1,
      label: s.label,
      consumerNumber: s.consumerNumber?.trim() ?? '',
      displayName: systemDisplayName(s.label, s.consumerNumber),
      systemSizeKw: s.systemSizeKw,
      pricePerWatt: 0,
      siteType: s.siteType,
      meterPhase: s.meterPhase,
      structureCategory: s.structureCategory,
      structureOption: s.structureOption,
      siteTypeLabel: formatSiteTypeLabel(s.siteType),
      meterPhaseLabel: formatMeterPhaseLabel(s.meterPhase),
      structureLabel: formatStructureLabel(s.structureCategory, s.structureOption),
      baseCost: 0,
      gstAmount: 0,
      grossCost: 0,
      subsidyAmount: 0,
      netCost: 0,
      dailyProductionKwh,
      annualProductionKwh,
      annualSavings,
      breakevenYears,
      savings30YrRs,
      sanctionedLoadKw: s.sanctionedLoadKw,
      sanctionedLoadIncreasedToKw: s.sanctionedLoadIncreasedToKw,
    };
  });

  const combined: CombinedSummary = {
    systemSizeKw: totalKw,
    baseCost,
    gstAmount,
    grossCost,
    subsidyAmount,
    netCost,
    dailyProductionKwh,
    annualProductionKwh,
    annualSavings,
    breakevenYears,
    savings30YrRs,
    blendedPricePerWatt: combinedPricePerWatt,
  };

  return { systems, combined };
}
