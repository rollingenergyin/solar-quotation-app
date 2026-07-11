import type { ProposalNote } from '@/constants/proposal-note';
import type { StructureAllocationSummary } from '@/constants/structure-allocation';

export interface SiteCostingLineItemPrint {
  key: string;
  label: string;
  amount: number;
  quantity?: number | null;
  unit?: string | null;
}

export interface SiteCostingPrintData {
  systemSizeKw: number;
  numPanels: number;
  lineItems: SiteCostingLineItemPrint[];
  subtotal: number;
  profitMarginPct: number;
  marginAmount: number;
  gstPct: number;
  gstAmount: number;
  totalInclGst: number;
  complexityScore: string;
  estimatedInstallDays: string;
  roofLayoutSuggestion?: string;
  leadQualificationScore?: number;
  structureSummary?: StructureAllocationSummary | null;
}

export interface QuotationSitePhoto {
  name: string;
  url: string;
}

export interface QuotationMaterial {
  srNo: number;
  name: string;
  specification: string;
  make: string;
  quantity: number;
  unit: string;
}

export interface RoiDataPoint {
  year: number;
  investment: number;
  cumulativeSavings: number;
}

// ── Editable Template Config (mirrors the DB model) ──────────────────────────
export interface TemplateStat    { label: string; value: string }
export interface TemplateHighlight { icon: string; title: string; desc: string }
export interface TemplateProcessStep {
  step: string; title: string; subtitle: string; desc: string; icon: string; duration: string;
}

export interface ProcessTimelineRange {
  minKw: number;
  maxKw: number | null;
  timelineText: string;
}
export interface TemplateService {
  icon: string;
  title: string;
  desc: string;
  /** `optional` = add-on, not included in standard AMC year 1 */
  coverage?: 'included' | 'optional';
}
export interface TemplateWarranty {
  item: string;
  warranty: string;
  /** Alternative coverage for the same component — shown inline with OR in print */
  alternatives?: WarrantyAlternative[];
}

export interface WarrantyAlternative {
  warranty: string;
}
export interface TemplatePaymentMilestone { step: string; title: string; pct: number; desc: string; icon: string }
export interface TemplatePaymentMode { icon: string; label: string }
export interface TemplateBankDetails {
  accountName: string;
  accountNumber: string;
  bankName: string;
  accountType: string;
  ifscCode: string;
}

export const DEFAULT_BANK_DETAILS: TemplateBankDetails = {
  accountName: 'ROLLING ENERGY (OPC) PRIVATE LIMITED',
  accountNumber: '041263400006460',
  bankName: 'YES BANK LTD.',
  accountType: 'Current Account',
  ifscCode: 'YESB0000412',
};
export interface TemplateReason  { icon: string; title: string; desc: string }
export interface TemplateTestimonial { name: string; location: string; text: string }

export interface TemplateDepreciationRow { year: string; rate: string; note: string }

export interface TemplateBomItem {
  srNo: number;
  name: string;
  specification: string;
  make: string;
  quantity?: number | null;
  unit?: string;
  /** Alternative spec/make for the same product — shown inline with OR in print */
  alternatives?: BomItemAlternative[];
}

export interface BomItemAlternative {
  specification: string;
  make: string;
}

export interface TemplateConfig {
  id: string;
  version: number;
  name: string;
  isActive: boolean;
  // Template selection conditions
  systemType?: string;  // DCR | NON_DCR | ANY
  siteType?: string;    // RESIDENTIAL | SOCIETY | COMMERCIAL | INDUSTRIAL | ANY
  // Company
  companyName: string;
  companyTagline: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  companyWebsite: string | null;
  // Warranty
  panelWarrantyYears: number;
  // BOM configuration (admin-controlled)
  bomShowQty:  boolean;
  bomShowUnit: boolean;
  bomItems:    TemplateBomItem[] | null;
  // Subsidy config (admin-editable)
  subsidyResidential1kw: number;
  subsidyResidential2kw: number;
  subsidyResidential3to10kw: number;
  subsidySocietyPerKw: number;
  // Depreciation config (admin-editable)
  depreciationNote: string;
  depreciationTable: TemplateDepreciationRow[];
  // Page content
  introLetterBody: string[];
  aboutParagraphs: string[];
  aboutMission: string;
  aboutStats: TemplateStat[];
  aboutHighlights: TemplateHighlight[];
  processSteps: TemplateProcessStep[];
  processTimelineText: string;
  maintenanceServices: TemplateService[];
  warrantyItems: TemplateWarranty[];
  paymentMilestones: TemplatePaymentMilestone[];
  paymentTermsBullets: string[];
  paymentModes: TemplatePaymentMode[];
  bankDetails?: TemplateBankDetails | null;
  whyReasons: TemplateReason[];
  testimonials: TemplateTestimonial[];
  certifications: string[];
}

export function resolveBankDetails(config?: TemplateConfig | null): TemplateBankDetails {
  const b = config?.bankDetails;
  if (b?.accountName?.trim() && b?.accountNumber?.trim()) {
    return {
      accountName: b.accountName.trim(),
      accountNumber: b.accountNumber.trim(),
      bankName: b.bankName?.trim() || DEFAULT_BANK_DETAILS.bankName,
      accountType: b.accountType?.trim() || DEFAULT_BANK_DETAILS.accountType,
      ifscCode: b.ifscCode?.trim() || DEFAULT_BANK_DETAILS.ifscCode,
    };
  }
  return DEFAULT_BANK_DETAILS;
}

export interface QuotationTemplateData {
  // Quote meta
  quoteNumber: string;
  date: string;
  validUntil: string | null;
  status: string;

  // Client
  clientName: string;
  clientAddress: string;
  clientPhone: string | null;
  clientEmail: string | null;
  contactPerson: string;

  // System
  systemSizeKw: number;
  systemSizeWatts: number;
  numModules: number;
  panelWattageWp?: number;
  inverterSizeKw: number;
  areaSquareFt: number;
  sanctionedLoadKw: number | null;
  /** Target sanctioned load after increase (optional; e.g. aligned with proposed system kW). */
  sanctionedLoadIncreasedToKw?: number | null;
  buildingHeight?: string | null;
  meterPhase?: string | null;
  structureType?: string | null;
  supplementaryCosts?: {
    wiringCost: number;
    installationCost: number;
    structureCost: number;
    totalAddOn: number;
    dcCableMeters: number;
    acCableMeters: number;
  } | null;

  // Production
  dailyProductionKwh: number;
  monthlyProductionKwh: number;
  annualProductionKwh: number;

  // Savings
  monthlySavingsRs: number;
  annualSavingsRs: number;
  savings30YrRs: number;

  // ROI
  breakevenYears: number;
  tariffPerUnit: number;
  gridInflationPct: number;

  // Costs
  baseCost: number;
  gstAmount: number;
  totalCost: number;
  subsidyAmount: number;
  netCost: number;

  // EMI
  emi3Yr: number;
  emi5Yr: number;
  emi7Yr: number;
  emi3YrTotalPayable: number;
  emi3YrTotalInterest: number;
  emi5YrTotalPayable: number;
  emi5YrTotalInterest: number;
  emi7YrTotalPayable: number;
  emi7YrTotalInterest: number;

  // Materials
  materials: QuotationMaterial[];

  // System/site type
  systemType: 'DCR' | 'NON_DCR';
  siteType:   'RESIDENTIAL' | 'SOCIETY' | 'COMMERCIAL' | 'INDUSTRIAL';
  showSubsidy:      boolean;
  showDepreciation: boolean;

  // Depreciation data (for Non-DCR systems)
  depreciationTable: TemplateDepreciationRow[];
  depreciationNote:  string;

  // Active template config — injected by backend
  templateConfig: TemplateConfig | null;

  /** Optional custom note from quick-quote deep edit */
  proposalNote?: ProposalNote | null;

  /** Site Costing Engine breakdown (Phase 3–5) */
  siteCosting?: SiteCostingPrintData | null;
  sitePhotos?: QuotationSitePhoto[];

  // Combined quotation (Phase 2)
  quotationMode?: 'SINGLE' | 'COMBINED';
  combinedSystems?: import('@/constants/combined-quotation').CombinedSystemCalculated[];
  combinedSummary?: import('@/constants/combined-quotation').CombinedSummary;
  combinedSingleCosting?: boolean;

  /** Alternative costing options (1–4) for print comparison */
  costingOptions?: import('@/constants/costing-options').CostingOptionCalculated[];
}
