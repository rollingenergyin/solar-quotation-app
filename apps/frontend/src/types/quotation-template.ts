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
export interface TemplateService { icon: string; title: string; desc: string }
export interface TemplateWarranty { item: string; warranty: string }
export interface TemplatePaymentMilestone { step: string; title: string; pct: number; desc: string; icon: string }
export interface TemplatePaymentMode { icon: string; label: string }
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
  whyReasons: TemplateReason[];
  testimonials: TemplateTestimonial[];
  certifications: string[];
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
  inverterSizeKw: number;
  areaSquareFt: number;
  sanctionedLoadKw: number | null;

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
}
