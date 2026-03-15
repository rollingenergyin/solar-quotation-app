import { PrismaClient } from '@prisma/client';
import { evaluateExpression } from './formula.service.js';

const prisma = new PrismaClient();

// ─── Subsidy calculation — driven by template config ─────────────────────────
interface SubsidyConfig {
  subsidyResidential1kw: number;
  subsidyResidential2kw: number;
  subsidyResidential3to10kw: number;
  subsidySocietyPerKw: number;
}

function calcSubsidy(
  systemKw: number,
  systemType: 'DCR' | 'NON_DCR',
  siteType: 'RESIDENTIAL' | 'SOCIETY' | 'COMMERCIAL' | 'INDUSTRIAL',
  cfg?: Partial<SubsidyConfig>,
): number {
  // Non-DCR, Commercial, and Industrial always get 0 subsidy
  if (systemType === 'NON_DCR' || siteType === 'COMMERCIAL' || siteType === 'INDUSTRIAL') return 0;

  if (siteType === 'SOCIETY') {
    const perKw = cfg?.subsidySocietyPerKw ?? 18_000;
    return Math.round(systemKw * perKw);
  }

  // RESIDENTIAL
  if (systemKw <= 1) return cfg?.subsidyResidential1kw ?? 30_000;
  if (systemKw <= 2) return cfg?.subsidyResidential2kw ?? 60_000;
  return cfg?.subsidyResidential3to10kw ?? 78_000;
}

// ─── EMI (reducing balance formula) ────────────────────────────────────────────
// EMI = P × r × (1+r)^n / ((1+r)^n − 1)
// P = loan amount, r = monthly rate (annual/12/100), n = months
// total_payable = emi × n, total_interest = total_payable − P
const LOAN_FRACTION = 0.8;

function calcEmi(totalCostPreSubsidy: number, annualRatePct: number, tenureMonths: number) {
  const P = Math.round(totalCostPreSubsidy * LOAN_FRACTION);
  if (P <= 0) return { emi: 0, totalPayable: 0, totalInterest: 0 };
  const r = annualRatePct / (12 * 100); // monthly rate: 9% → 0.0075
  const n = tenureMonths;
  const emi = r === 0 ? P / n : (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const emiRounded = Math.round(emi);
  const totalPayable = emiRounded * n;
  const totalInterest = totalPayable - P;
  return { emi: emiRounded, totalPayable, totalInterest };
}

// ─── Yearly savings with grid-inflation ───────────────────────────────────────
function buildYearlySavings(
  annualGenKwh: number,
  electricityRatePerUnit: number,
  gridInflationPct: number,
  years: number,
): number[] {
  const result: number[] = [];
  for (let y = 1; y <= years; y++) {
    const rate = electricityRatePerUnit * Math.pow(1 + gridInflationPct / 100, y - 1);
    result.push(Math.round(annualGenKwh * rate));
  }
  return result;
}

// ─── Payback period ───────────────────────────────────────────────────────────
function calcPayback(netCost: number, yearlySavings: number[]): number {
  let cumulative = 0;
  for (let i = 0; i < yearlySavings.length; i++) {
    cumulative += yearlySavings[i];
    if (cumulative >= netCost) {
      const prev = cumulative - yearlySavings[i];
      return i + (netCost - prev) / yearlySavings[i];
    }
  }
  return yearlySavings.length;
}

// ─── Main calculation input ───────────────────────────────────────────────────
export interface CalcInput {
  systemSizeKw?: number;
  pricePerWatt: number;
  profitMarginPct?: number;
  gstPct?: number;
  subsidyAmountOverride?: number;
  electricityRatePerUnit: number;
  gridInflationPct?: number;
  peakSunHours?: number;
  systemEfficiency?: number;
  systemLifeYears?: number;
  emiRatePct?: number;
  notes?: string;
  /** DCR or Non-DCR */
  systemType?: 'DCR' | 'NON_DCR';
  /** Residential, Society, or Commercial */
  siteType?: 'RESIDENTIAL' | 'SOCIETY' | 'COMMERCIAL' | 'INDUSTRIAL';
}

export interface CalcResult {
  avgMonthlyKwh: number;
  recommendedSystemKw: number;
  totalWatts: number;
  baseCost: number;
  profitAmount: number;
  preTaxCost: number;
  gstAmount: number;
  grossCost: number;
  subsidyAmount: number;
  netCost: number;
  annualGenKwh: number;
  annualSavings: number;
  lifetimeSavings: number;
  yearlySavings: number[];
  simplePaybackYears: number;
  paybackWithInflationYears: number;
  roiPct: number;
  emi: {
    tenure3yr: { emi: number; totalPayable: number; totalInterest: number };
    tenure5yr: { emi: number; totalPayable: number; totalInterest: number };
    tenure7yr: { emi: number; totalPayable: number; totalInterest: number };
  };
  inputs: {
    systemSizeKw: number;
    pricePerWatt: number;
    profitMarginPct: number;
    gstPct: number;
    electricityRatePerUnit: number;
    gridInflationPct: number;
    peakSunHours: number;
    systemEfficiency: number;
    systemLifeYears: number;
    emiRatePct: number;
    systemType: string;
    siteType: string;
  };
}

/** Load system default parameters from the DB (admin-configurable via Formulas page) */
async function loadSystemDefaults(): Promise<Record<string, number>> {
  try {
    const params = await prisma.systemParam.findMany();
    return Object.fromEntries(params.map(p => [p.key, p.value]));
  } catch {
    return {};
  }
}

export async function calculateQuotation(
  quotationId: string,
  input: CalcInput,
  userId: string,
): Promise<CalcResult> {
  // Load admin-configurable defaults from SystemParam table
  const sysDefaults = await loadSystemDefaults();

  // Resolve each param: explicit input → DB system param → hardcoded fallback
  const profitMarginPct  = input.profitMarginPct  ?? sysDefaults['profit_pct']          ?? 15;
  const gstPct           = input.gstPct           ?? sysDefaults['gst_pct']             ?? 8.9;
  const gridInflationPct = input.gridInflationPct  ?? sysDefaults['grid_inflation_pct'] ?? 3;
  const peakSunHours     = input.peakSunHours      ?? sysDefaults['peak_sun_hours']     ?? 5;
  const systemEfficiency = input.systemEfficiency  ?? (sysDefaults['system_efficiency'] != null ? sysDefaults['system_efficiency'] / 100 : 0.8);
  const systemLifeYears  = input.systemLifeYears   ?? sysDefaults['system_life_years']  ?? 25;
  const emiRatePct       = input.emiRatePct        ?? sysDefaults['emi_rate_pct']       ?? 9;
  const systemType       = input.systemType        ?? 'DCR';
  const siteType         = (input.siteType ?? 'RESIDENTIAL') as 'RESIDENTIAL' | 'SOCIETY' | 'COMMERCIAL' | 'INDUSTRIAL';

  // ── Load quotation & bills ────────────────────────────────────────────────
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: {
      site: { include: { electricityBills: { orderBy: [{ year: 'desc' }, { month: 'desc' }] } } },
    },
  });
  const { selectTemplateForQuotation } = await import('./template-selection.service.js');
  const activeTemplate = await selectTemplateForQuotation(systemType, siteType);
  if (!quotation) throw new Error('Quotation not found');

  const bills = quotation.site.electricityBills;
  const avgMonthlyKwh = bills.length
    ? Math.round(bills.reduce((s, b) => s + b.unitsKwh, 0) / bills.length)
    : 0;

  // ── System sizing ─────────────────────────────────────────────────────────
  let systemSizeKw = input.systemSizeKw;
  if (!systemSizeKw || systemSizeKw <= 0) {
    const dailyKwh = avgMonthlyKwh / 30;
    const rawKw = dailyKwh / (peakSunHours * systemEfficiency);
    systemSizeKw = Math.max(1, Math.ceil(rawKw * 2) / 2);
  }
  const totalWatts = Math.round(systemSizeKw * 1000);

  // ── Cost calculation ──────────────────────────────────────────────────────
  const baseCost     = Math.round(totalWatts * input.pricePerWatt);
  const profitAmount = Math.round(baseCost * profitMarginPct / 100);
  const preTaxCost   = baseCost + profitAmount;
  const gstAmount    = Math.round(preTaxCost * gstPct / 100);
  const grossCost    = preTaxCost + gstAmount;

  // Subsidy: use override if explicitly provided, else calculate from rules
  // For Non-DCR, Commercial, or Industrial: subsidy is always 0 (ignore override)
  let subsidyAmount: number;
  if (systemType === 'NON_DCR' || siteType === 'COMMERCIAL' || siteType === 'INDUSTRIAL') {
    subsidyAmount = 0;
  } else if (input.subsidyAmountOverride !== undefined) {
    subsidyAmount = input.subsidyAmountOverride;
  } else {
    subsidyAmount = calcSubsidy(systemSizeKw, systemType, siteType, activeTemplate ?? undefined);
  }

  const netCost = Math.max(0, grossCost - subsidyAmount);

  // ── Generation & savings ──────────────────────────────────────────────────
  const annualGenKwh    = Math.round(systemSizeKw * peakSunHours * 365 * systemEfficiency);
  const annualSavings   = Math.round(annualGenKwh * input.electricityRatePerUnit);
  const yearlySavings   = buildYearlySavings(annualGenKwh, input.electricityRatePerUnit, gridInflationPct, systemLifeYears);
  const lifetimeSavings = yearlySavings.reduce((s, v) => s + v, 0);

  // ── ROI ───────────────────────────────────────────────────────────────────
  const simplePaybackYears = annualSavings > 0
    ? Math.round((netCost / annualSavings) * 10) / 10 : 0;
  const paybackWithInflationYears = annualSavings > 0
    ? Math.round(calcPayback(netCost, yearlySavings) * 10) / 10 : 0;
  const netProfit = lifetimeSavings - netCost;
  const roiPct = netCost > 0
    ? Math.round((netProfit / netCost / systemLifeYears) * 100 * 100) / 100 : 0;

  // ── EMI (on total cost pre-subsidy) ────────────────────────────────────────
  const emi = {
    tenure3yr: calcEmi(grossCost, emiRatePct, 36),
    tenure5yr: calcEmi(grossCost, emiRatePct, 60),
    tenure7yr: calcEmi(grossCost, emiRatePct, 84),
  };

  const result: CalcResult = {
    avgMonthlyKwh,
    recommendedSystemKw: systemSizeKw,
    totalWatts,
    baseCost, profitAmount, preTaxCost, gstAmount, grossCost, subsidyAmount, netCost,
    annualGenKwh, annualSavings, lifetimeSavings, yearlySavings,
    simplePaybackYears, paybackWithInflationYears, roiPct,
    emi,
    inputs: {
      systemSizeKw, pricePerWatt: input.pricePerWatt,
      profitMarginPct, gstPct, electricityRatePerUnit: input.electricityRatePerUnit,
      gridInflationPct, peakSunHours, systemEfficiency, systemLifeYears, emiRatePct,
      systemType, siteType,
    },
  };

  try {
    evaluateExpression('totalAmount / (annualSavings > 0 ? annualSavings : 1)', {
      totalAmount: netCost, annualSavings,
    });
  } catch { /* non-blocking */ }

  await prisma.$transaction([
    prisma.quotation.update({
      where: { id: quotationId },
      data: {
        totalWattage: totalWatts,
        totalAmount:  netCost,
        systemType,
        siteType,
      },
    }),
    prisma.quotationResult.upsert({
      where: { quotationId },
      update: {
        roiYears:            paybackWithInflationYears,
        roiPercentage:       roiPct,
        emiMonthly:          emi.tenure5yr.emi,
        emiTenureMonths:     60,
        totalSavings:        lifetimeSavings,
        paybackPeriodMonths: Math.round(paybackWithInflationYears * 12),
        breakdown: {
          yearlySavings,
          emi,
          costBreakdown: { baseCost, profitAmount, preTaxCost, gstAmount, grossCost, subsidyAmount, netCost },
          inputs: result.inputs,
        },
        notes: input.notes ?? null,
        calculatedAt: new Date(),
        updatedAt: new Date(),
      },
      create: {
        quotationId,
        roiYears:            paybackWithInflationYears,
        roiPercentage:       roiPct,
        emiMonthly:          emi.tenure5yr.emi,
        emiTenureMonths:     60,
        totalSavings:        lifetimeSavings,
        paybackPeriodMonths: Math.round(paybackWithInflationYears * 12),
        breakdown: {
          yearlySavings,
          emi,
          costBreakdown: { baseCost, profitAmount, preTaxCost, gstAmount, grossCost, subsidyAmount, netCost },
          inputs: result.inputs,
        },
        notes: input.notes ?? null,
      },
    }),
  ]);

  return result;
}
