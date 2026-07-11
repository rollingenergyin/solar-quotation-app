/**
 * Combined (multi-system) quotation calculations for Quick Quote Phase 2.
 */

import { ROI_DAYS_PER_YEAR } from '../constants/roi-generation.js';

export type QuotationMode = 'SINGLE' | 'COMBINED';

export interface CombinedSystemInput {
  label: string;
  consumerNumber?: string;
  systemSizeKw: number;
  pricePerWatt: number;
  siteType?: string;
  meterPhase?: string;
  structureCategory?: string;
  structureOption?: string;
  sanctionedLoadKw?: number | null;
  sanctionedLoadIncreasedToKw?: number | null;
}

export interface CombinedSystemCalculated {
  index: number;
  label: string;
  consumerNumber: string;
  displayName: string;
  systemSizeKw: number;
  pricePerWatt: number;
  siteType: string;
  meterPhase: string;
  structureCategory: string;
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

const SITE_TYPE_LABELS: Record<string, string> = {
  RESIDENTIAL: 'Residential',
  SOCIETY: 'Society',
  COMMERCIAL: 'Commercial',
  INDUSTRIAL: 'Industrial',
};

const METER_PHASE_LABELS: Record<string, string> = {
  SINGLE: 'Single Phase',
  THREE: 'Three Phase',
};

const STRUCTURE_CATEGORY_LABELS: Record<string, string> = {
  TRAPEZOID: 'Trapezoid Structure',
  STANDARD: 'Standard Structure',
  RAISED: 'Raised Structure',
};

const STRUCTURE_OPTION_LABELS: Record<string, Record<string, string>> = {
  TRAPEZOID: { '0ft': '0 ft', '1ft': '1 ft' },
  STANDARD: { '1ft': 'Short leg 1 ft', '2ft': 'Short leg 2 ft', '3ft': 'Short leg 3 ft' },
  RAISED: { '6ft': 'Short leg 6 ft', '7ft': 'Short leg 7 ft', '8ft': 'Short leg 8 ft' },
};

function formatSiteTypeLabel(siteType: string): string {
  return SITE_TYPE_LABELS[siteType] ?? siteType;
}

function formatMeterPhaseLabel(meterPhase: string): string {
  return METER_PHASE_LABELS[meterPhase] ?? meterPhase;
}

function formatStructureLabel(category: string, option: string): string {
  const cat = STRUCTURE_CATEGORY_LABELS[category] ?? category;
  const opt = STRUCTURE_OPTION_LABELS[category]?.[option] ?? option;
  return `${cat} — ${opt}`;
}

function calcSubsidy(
  kw: number,
  systemType: string,
  siteType: string,
): number {
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

export function calculateCombinedSystems(
  systems: CombinedSystemInput[],
  params: {
    systemType: string;
    siteType: string;
    electricityRatePerUnit: number;
    peakSunHours: number;
    gridInflationPct?: number;
    singleCosting?: boolean;
    combinedPricePerWatt?: number;
  },
): { systems: CombinedSystemCalculated[]; combined: CombinedSummary } {
  if (params.singleCosting) {
    return calculateCombinedSystemsSingleCosting(systems, params);
  }

  const inflation = params.gridInflationPct ?? 3;
  const calculated = systems.map((s, i) => {
    const kw = s.systemSizeKw;
    const ppw = s.pricePerWatt;
    const siteType = s.siteType ?? params.siteType;
    const meterPhase = s.meterPhase ?? 'SINGLE';
    const structureCategory = s.structureCategory ?? 'STANDARD';
    const structureOption = s.structureOption ?? '1ft';
    const baseCost = Math.round(kw * 1000 * ppw);
    const gstAmount = Math.round(baseCost * GST_RATE);
    const grossCost = baseCost + gstAmount;
    const subsidyAmount = calcSubsidy(kw, params.systemType, siteType);
    const netCost = Math.max(0, grossCost - subsidyAmount);
    const dailyProductionKwh = Math.round(kw * params.peakSunHours * 10) / 10;
    const annualProductionKwh = Math.round(dailyProductionKwh * ROI_DAYS_PER_YEAR);
    const annualSavings = Math.round(annualProductionKwh * params.electricityRatePerUnit);
    const breakevenYears =
      annualSavings > 0 ? Math.round((netCost / annualSavings) * 10) / 10 : 0;
    const savings30YrRs = calc30YrSavings(annualSavings, inflation);

    return {
      index: i + 1,
      label: s.label || `System ${i + 1}`,
      consumerNumber: s.consumerNumber?.trim() ?? '',
      displayName: systemDisplayName(s.label || `System ${i + 1}`, s.consumerNumber),
      systemSizeKw: kw,
      pricePerWatt: ppw,
      siteType,
      meterPhase,
      structureCategory,
      structureOption,
      siteTypeLabel: formatSiteTypeLabel(siteType),
      meterPhaseLabel: formatMeterPhaseLabel(meterPhase),
      structureLabel: formatStructureLabel(structureCategory, structureOption),
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
      sanctionedLoadKw:
        s.sanctionedLoadKw != null && Number.isFinite(s.sanctionedLoadKw) ? s.sanctionedLoadKw : null,
      sanctionedLoadIncreasedToKw:
        s.sanctionedLoadIncreasedToKw != null && Number.isFinite(s.sanctionedLoadIncreasedToKw)
          ? s.sanctionedLoadIncreasedToKw
          : kw > 0
            ? kw
            : null,
    };
  });

  const combined: CombinedSummary = {
    systemSizeKw: calculated.reduce((s, x) => s + x.systemSizeKw, 0),
    baseCost: calculated.reduce((s, x) => s + x.baseCost, 0),
    gstAmount: calculated.reduce((s, x) => s + x.gstAmount, 0),
    grossCost: calculated.reduce((s, x) => s + x.grossCost, 0),
    subsidyAmount: calculated.reduce((s, x) => s + x.subsidyAmount, 0),
    netCost: calculated.reduce((s, x) => s + x.netCost, 0),
    dailyProductionKwh:
      Math.round(calculated.reduce((s, x) => s + x.dailyProductionKwh, 0) * 10) / 10,
    annualProductionKwh: calculated.reduce((s, x) => s + x.annualProductionKwh, 0),
    annualSavings: calculated.reduce((s, x) => s + x.annualSavings, 0),
    savings30YrRs: calculated.reduce((s, x) => s + x.savings30YrRs, 0),
    breakevenYears: 0,
    blendedPricePerWatt: 0,
  };

  combined.breakevenYears =
    combined.annualSavings > 0
      ? Math.round((combined.netCost / combined.annualSavings) * 10) / 10
      : 0;
  combined.blendedPricePerWatt =
    combined.systemSizeKw > 0
      ? combined.baseCost / (combined.systemSizeKw * 1000)
      : 0;

  return { systems: calculated, combined };
}

function calculateCombinedSystemsSingleCosting(
  systems: CombinedSystemInput[],
  params: {
    systemType: string;
    siteType: string;
    electricityRatePerUnit: number;
    peakSunHours: number;
    gridInflationPct?: number;
    combinedPricePerWatt?: number;
  },
): { systems: CombinedSystemCalculated[]; combined: CombinedSummary } {
  const inflation = params.gridInflationPct ?? 3;
  const combinedPricePerWatt = params.combinedPricePerWatt ?? 0;
  if (combinedPricePerWatt <= 0) {
    throw new Error('combinedPricePerWatt required for single costing mode');
  }

  const technical = systems.map((s, i) => {
    const kw = s.systemSizeKw;
    const siteType = s.siteType ?? params.siteType;
    const meterPhase = s.meterPhase ?? 'SINGLE';
    const structureCategory = s.structureCategory ?? 'STANDARD';
    const structureOption = s.structureOption ?? '1ft';
    const dailyProductionKwh = Math.round(kw * params.peakSunHours * 10) / 10;
    const annualProductionKwh = Math.round(dailyProductionKwh * ROI_DAYS_PER_YEAR);
    const annualSavings = Math.round(annualProductionKwh * params.electricityRatePerUnit);
    const savings30YrRs = calc30YrSavings(annualSavings, inflation);

    return {
      index: i + 1,
      label: s.label || `System ${i + 1}`,
      consumerNumber: s.consumerNumber?.trim() ?? '',
      displayName: systemDisplayName(s.label || `System ${i + 1}`, s.consumerNumber),
      systemSizeKw: kw,
      pricePerWatt: 0,
      siteType,
      meterPhase,
      structureCategory,
      structureOption,
      siteTypeLabel: formatSiteTypeLabel(siteType),
      meterPhaseLabel: formatMeterPhaseLabel(meterPhase),
      structureLabel: formatStructureLabel(structureCategory, structureOption),
      baseCost: 0,
      gstAmount: 0,
      grossCost: 0,
      subsidyAmount: 0,
      netCost: 0,
      dailyProductionKwh,
      annualProductionKwh,
      annualSavings,
      breakevenYears: 0,
      savings30YrRs,
      sanctionedLoadKw:
        s.sanctionedLoadKw != null && Number.isFinite(s.sanctionedLoadKw) ? s.sanctionedLoadKw : null,
      sanctionedLoadIncreasedToKw:
        s.sanctionedLoadIncreasedToKw != null && Number.isFinite(s.sanctionedLoadIncreasedToKw)
          ? s.sanctionedLoadIncreasedToKw
          : kw > 0
            ? kw
            : null,
    };
  });

  const totalKw = technical.reduce((sum, s) => sum + s.systemSizeKw, 0);
  const baseCost = Math.round(totalKw * 1000 * combinedPricePerWatt);
  const gstAmount = Math.round(baseCost * GST_RATE);
  const grossCost = baseCost + gstAmount;
  const subsidyAmount = systems.reduce((sum, s) => {
    const siteType = s.siteType ?? params.siteType;
    return sum + calcSubsidy(s.systemSizeKw, params.systemType, siteType);
  }, 0);
  const netCost = Math.max(0, grossCost - subsidyAmount);

  const systemsWithBreakeven = technical.map((s) => {
    const allocatedNetCost =
      totalKw > 0 ? Math.round(netCost * (s.systemSizeKw / totalKw)) : 0;
    const breakevenYears =
      s.annualSavings > 0
        ? Math.round((allocatedNetCost / s.annualSavings) * 10) / 10
        : 0;
    return { ...s, breakevenYears };
  });
  const dailyProductionKwh = Math.round(totalKw * params.peakSunHours * 10) / 10;
  const annualProductionKwh = Math.round(dailyProductionKwh * ROI_DAYS_PER_YEAR);
  const annualSavings = Math.round(annualProductionKwh * params.electricityRatePerUnit);
  const breakevenYears =
    annualSavings > 0 ? Math.round((netCost / annualSavings) * 10) / 10 : 0;
  const savings30YrRs = calc30YrSavings(annualSavings, inflation);

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

  return { systems: systemsWithBreakeven, combined };
}

/** Backfill per-system generation/savings for older single-costing quotes stored with zeros. */
export function enrichSingleCostingSystems(
  systems: CombinedSystemCalculated[] | undefined,
  combinedSummary: CombinedSummary | undefined,
  params: {
    electricityRatePerUnit: number;
    peakSunHours: number;
    gridInflationPct?: number;
  },
): CombinedSystemCalculated[] | undefined {
  if (!systems?.length) return systems;

  const needsEnrich = systems.some(
    (s) => s.systemSizeKw > 0 && s.dailyProductionKwh === 0 && s.annualSavings === 0,
  );
  if (!needsEnrich) return systems;

  const totalKw = combinedSummary?.systemSizeKw
    ?? systems.reduce((sum, s) => sum + s.systemSizeKw, 0);
  const netCost = combinedSummary?.netCost ?? 0;
  const inflation = params.gridInflationPct ?? 3;

  return systems.map((s) => {
    const dailyProductionKwh = Math.round(s.systemSizeKw * params.peakSunHours * 10) / 10;
    const annualProductionKwh = Math.round(dailyProductionKwh * ROI_DAYS_PER_YEAR);
    const annualSavings = Math.round(annualProductionKwh * params.electricityRatePerUnit);
    const savings30YrRs = calc30YrSavings(annualSavings, inflation);
    const allocatedNetCost =
      totalKw > 0 ? Math.round(netCost * (s.systemSizeKw / totalKw)) : 0;
    const breakevenYears =
      annualSavings > 0
        ? Math.round((allocatedNetCost / annualSavings) * 10) / 10
        : 0;

    return {
      ...s,
      dailyProductionKwh,
      annualProductionKwh,
      annualSavings,
      savings30YrRs,
      breakevenYears,
    };
  });
}

export function parseCombinedFromJson(quotationDataJson: unknown): {
  quotationMode?: QuotationMode;
  combinedSystems?: CombinedSystemCalculated[];
  combinedSummary?: CombinedSummary;
  combinedSingleCosting?: boolean;
} {
  if (!quotationDataJson || typeof quotationDataJson !== 'object') return {};
  const data = quotationDataJson as Record<string, unknown>;
  return {
    quotationMode: data.quotationMode as QuotationMode | undefined,
    combinedSystems: data.combinedSystems as CombinedSystemCalculated[] | undefined,
    combinedSummary: data.combinedSummary as CombinedSummary | undefined,
    combinedSingleCosting: Boolean(data.combinedSingleCosting),
  };
}
