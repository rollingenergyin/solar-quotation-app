export type CostingSystemType = 'DCR' | 'NON_DCR';
export type CostingSiteType = 'RESIDENTIAL' | 'SOCIETY' | 'COMMERCIAL' | 'INDUSTRIAL';

export const MAX_COSTING_OPTIONS = 4;
export const MIN_COSTING_OPTIONS = 1;

export interface CostingOptionRow {
  id: string;
  title: string;
  systemType: CostingSystemType;
  siteType: CostingSiteType;
  pricePerWatt: string;
  totalBaseAmount: string;
  totalCostInclGst: string;
}

export interface CostingOptionCalculated {
  index: number;
  title: string;
  systemType: CostingSystemType;
  siteType: CostingSiteType;
  systemSizeKw: number;
  pricePerWatt: number;
  baseCost: number;
  gstAmount: number;
  grossCost: number;
  subsidyAmount: number;
  netCost: number;
  showSubsidy: boolean;
}

const GST_RATE = 0.089;

export function createCostingOptionRow(
  index: number,
  defaults?: Partial<Pick<CostingOptionRow, 'systemType' | 'siteType' | 'pricePerWatt' | 'title'>>,
): CostingOptionRow {
  return {
    id: `cost-opt-${Date.now()}-${index}`,
    title: defaults?.title ?? (index === 1 ? '' : `Option ${index}`),
    systemType: defaults?.systemType ?? 'DCR',
    siteType: defaults?.siteType ?? 'RESIDENTIAL',
    pricePerWatt: defaults?.pricePerWatt ?? '55',
    totalBaseAmount: '',
    totalCostInclGst: '',
  };
}

function calcSubsidy(kw: number, systemType: string, siteType: string): number {
  if (systemType === 'NON_DCR' || siteType === 'COMMERCIAL' || siteType === 'INDUSTRIAL') return 0;
  if (siteType === 'SOCIETY') return Math.round(kw * 18000);
  if (kw <= 1) return 30000;
  if (kw <= 2) return 60000;
  return 78000;
}

export function totalInclGstFromBase(base: number): number {
  return base + Math.round(base * GST_RATE);
}

export function baseFromTotalInclGst(gross: number): number {
  return Math.round(gross / (1 + GST_RATE));
}

export function effectivePricePerWattForOption(
  row: CostingOptionRow,
  systemSizeKw: number,
  gstRate = GST_RATE,
): number {
  const ppw = parseFloat(row.pricePerWatt);
  if (ppw > 0) return ppw;
  const base = parseFloat(row.totalBaseAmount);
  if (base > 0 && systemSizeKw > 0) return base / (systemSizeKw * 1000);
  const gross = parseFloat(row.totalCostInclGst);
  if (gross > 0 && systemSizeKw > 0) {
    const estimatedBase = Math.round(gross / (1 + gstRate));
    return estimatedBase / (systemSizeKw * 1000);
  }
  return 0;
}

export function calculateCostingOptions(
  rows: CostingOptionRow[],
  systemSizeKw: number,
): CostingOptionCalculated[] {
  if (systemSizeKw <= 0) return [];

  const multipleOptions = rows.length > 1;

  return rows
    .map((row, i) => {
      const title = row.title.trim();
      if (multipleOptions && !title) return null;
      const ppw = effectivePricePerWattForOption(row, systemSizeKw);
      if (ppw <= 0) return null;

      const baseCost = Math.round(systemSizeKw * 1000 * ppw);
      const gstAmount = Math.round(baseCost * GST_RATE);
      const grossCost = baseCost + gstAmount;
      const showSubsidy =
        row.systemType === 'DCR' &&
        row.siteType !== 'COMMERCIAL' &&
        row.siteType !== 'INDUSTRIAL';
      const subsidyAmount = showSubsidy
        ? calcSubsidy(systemSizeKw, row.systemType, row.siteType)
        : 0;
      const netCost = Math.max(0, grossCost - subsidyAmount);

      return {
        index: i + 1,
        title: title || '',
        systemType: row.systemType,
        siteType: row.siteType,
        systemSizeKw,
        pricePerWatt: ppw,
        baseCost,
        gstAmount,
        grossCost,
        subsidyAmount,
        netCost,
        showSubsidy,
      };
    })
    .filter(Boolean) as CostingOptionCalculated[];
}

export type CostingFooterBundle = 'none' | 'full';

export interface CostingPrintPageSlice {
  optionIndices: number[];
  footerBundle?: CostingFooterBundle;
}

export function getCostingOptionCount(data: {
  costingOptions?: CostingOptionCalculated[];
}): number {
  return Math.max(1, data.costingOptions?.length ?? 0);
}

const OPTIONS_PER_COSTING_PAGE = 2;

function chunkOptionIndices(optionCount: number): number[][] {
  const chunks: number[][] = [];
  for (let i = 0; i < optionCount; i += OPTIONS_PER_COSTING_PAGE) {
    chunks.push(
      Array.from(
        { length: Math.min(OPTIONS_PER_COSTING_PAGE, optionCount - i) },
        (_, j) => i + j,
      ),
    );
  }
  return chunks;
}

/** Plan costing option pages only — payment schedule is always a separate print page. */
export function planCostingPrintPages(optionCount: number): CostingPrintPageSlice[] {
  const n = Math.max(1, Math.min(MAX_COSTING_OPTIONS, optionCount));

  if (n <= 1) {
    return [{ optionIndices: [0], footerBundle: 'full' }];
  }

  return chunkOptionIndices(n).map((chunk) => ({
    optionIndices: chunk,
    footerBundle: 'none' as const,
  }));
}

export function countCostingSectionPages(optionCount: number): number {
  return planCostingPrintPages(optionCount).length;
}

/** PM Surya Ghar eligibility note moves to Executive Summary when comparing alternatives. */
export function shouldShowPmSuryaGharOnKeyMetrics(optionCount: number): boolean {
  return optionCount >= 2;
}
