import type { QuotationTemplateData } from '@/types/quotation-template';
import { COMBINED_SYSTEMS_PER_PRINT_PAGE } from '@/constants/combined-quotation';
import {
  countCostingSectionPages,
  getCostingOptionCount,
  planCostingPrintPages,
} from '@/constants/costing-options';

export type { CostingPrintPageSlice } from '@/constants/costing-options';
export { planCostingPrintPages };

export interface CombinedSystemsPageSlice {
  /** 0-based indices into combinedSystems */
  systemIndices: number[];
  continuation: boolean;
}

/** Split combined-system pricing across print pages (per-system only; totals on Executive Summary & Cost Breakdown). */
export function planCombinedSystemsPrintPages(
  systemCount: number,
  singleCosting = false,
): CombinedSystemsPageSlice[] {
  if (systemCount < 2) return [];

  if (singleCosting) {
    const pages: CombinedSystemsPageSlice[] = [];
    for (let i = 0; i < systemCount; i += COMBINED_SYSTEMS_PER_PRINT_PAGE) {
      const chunk = Array.from(
        { length: Math.min(COMBINED_SYSTEMS_PER_PRINT_PAGE, systemCount - i) },
        (_, j) => i + j,
      );
      pages.push({
        systemIndices: chunk,
        continuation: i > 0,
      });
    }
    return pages;
  }

  const pages: CombinedSystemsPageSlice[] = [];

  for (let i = 0; i < systemCount; i += COMBINED_SYSTEMS_PER_PRINT_PAGE) {
    const chunk = Array.from(
      { length: Math.min(COMBINED_SYSTEMS_PER_PRINT_PAGE, systemCount - i) },
      (_, j) => i + j,
    );
    pages.push({
      systemIndices: chunk,
      continuation: i > 0,
    });
  }

  return pages;
}

export function countCombinedSystemsPrintPages(data: QuotationTemplateData): number {
  if (data.quotationMode !== 'COMBINED') return 0;
  const n = data.combinedSystems?.length ?? 0;
  return planCombinedSystemsPrintPages(n, Boolean(data.combinedSingleCosting)).length;
}

export function countRoiPages(data: QuotationTemplateData): number {
  return buildRoiPrintPages(data).length;
}

export function hasSiteCostingPage(data: QuotationTemplateData): boolean {
  return Boolean(data.siteCosting?.lineItems?.length);
}

export function hasStructureConfigPage(data: QuotationTemplateData): boolean {
  return Boolean(data.siteCosting?.structureSummary?.entries?.length);
}

export function getTotalQuotationPages(data: QuotationTemplateData): number {
  const base = data.showDepreciation ? 14 : 13;
  const combinedPages = countCombinedSystemsPrintPages(data);
  const roiPages = countRoiPages(data);
  const roiExtra = roiPages - 1;
  const siteCostingExtra = hasSiteCostingPage(data) ? 1 : 0;
  const structureConfigExtra = hasStructureConfigPage(data) ? 1 : 0;
  const costingOptionCount = getCostingOptionCount(data);
  const costingSectionPages = countCostingSectionPages(costingOptionCount);
  const costingAdjustment = costingSectionPages - 2;
  return base + combinedPages + roiExtra + siteCostingExtra + structureConfigExtra + costingAdjustment;
}

export interface RoiPageSpec {
  netCost: number;
  annualSavingsRs: number;
  savings30YrRs: number;
  breakevenYears: number;
  analysisTitle: string;
  analysisSubtitle?: string;
  isCombinedRoi?: boolean;
}

export interface RoiPrintPage {
  specs: RoiPageSpec[];
}

export function buildRoiPageSpecs(data: QuotationTemplateData): RoiPageSpec[] {
  if (data.quotationMode === 'COMBINED' && data.combinedSystems?.length) {
    const c = data.combinedSummary;
    return [{
      netCost: c?.netCost ?? data.netCost,
      annualSavingsRs: c?.annualSavings ?? data.annualSavingsRs,
      savings30YrRs: c?.savings30YrRs ?? data.savings30YrRs,
      breakevenYears: c?.breakevenYears ?? data.breakevenYears,
      analysisTitle: 'Combined ROI — All Systems',
      analysisSubtitle: c ? `${c.systemSizeKw} kW total capacity` : undefined,
      isCombinedRoi: true,
    }];
  }

  return [{
    netCost: data.netCost,
    annualSavingsRs: data.annualSavingsRs,
    savings30YrRs: data.savings30YrRs,
    breakevenYears: data.breakevenYears,
    analysisTitle: '30-Year Financial Analysis',
  }];
}

/** One ROI page per quotation (combined total for multi-system quotes). */
export function buildRoiPrintPages(data: QuotationTemplateData): RoiPrintPage[] {
  return [{ specs: buildRoiPageSpecs(data) }];
}
