/**
 * Alternative costing options (1–4 per quotation).
 */

export type CostingSystemType = 'DCR' | 'NON_DCR';
export type CostingSiteType = 'RESIDENTIAL' | 'SOCIETY' | 'COMMERCIAL' | 'INDUSTRIAL';

export interface CostingOptionInput {
  title: string;
  systemType: CostingSystemType;
  siteType: CostingSiteType;
  pricePerWatt: number;
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

function calcSubsidy(kw: number, systemType: string, siteType: string): number {
  if (systemType === 'NON_DCR' || siteType === 'COMMERCIAL' || siteType === 'INDUSTRIAL') return 0;
  if (siteType === 'SOCIETY') return Math.round(kw * 18000);
  if (kw <= 1) return 30000;
  if (kw <= 2) return 60000;
  return 78000;
}

export function calculateCostingOptions(
  inputs: CostingOptionInput[],
  systemSizeKw: number,
): CostingOptionCalculated[] {
  if (systemSizeKw <= 0) return [];

  const multipleOptions = inputs.length > 1;

  return inputs
    .map((input, i) => {
      const title = input.title?.trim() ?? '';
      const ppw = input.pricePerWatt;
      if (multipleOptions && !title) return null;
      if (!Number.isFinite(ppw) || ppw < 1) return null;

      const baseCost = Math.round(systemSizeKw * 1000 * ppw);
      const gstAmount = Math.round(baseCost * GST_RATE);
      const grossCost = baseCost + gstAmount;
      const showSubsidy =
        input.systemType === 'DCR' &&
        input.siteType !== 'COMMERCIAL' &&
        input.siteType !== 'INDUSTRIAL';
      const subsidyAmount = showSubsidy
        ? calcSubsidy(systemSizeKw, input.systemType, input.siteType)
        : 0;
      const netCost = Math.max(0, grossCost - subsidyAmount);

      return {
        index: i + 1,
        title: title || '',
        systemType: input.systemType,
        siteType: input.siteType,
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

export function parseCostingOptionsFromJson(quotationDataJson: unknown): CostingOptionCalculated[] | undefined {
  if (!quotationDataJson || typeof quotationDataJson !== 'object') return undefined;
  const data = quotationDataJson as Record<string, unknown>;
  const opts = data.costingOptions;
  if (!Array.isArray(opts) || opts.length === 0) return undefined;
  return opts as CostingOptionCalculated[];
}
