/**
 * SPGS turnkey invoice: pricing triangulation and GST.
 * EPC standard: 70% of taxable value @ 5% GST + 30% @ 18% GST (effective ~8.9%).
 */

export type SpgsGstMode = 'blended' | 'split' | 'epc';
export type SpgsPricingMode = 'perWatt' | 'totalInclGst' | 'baseExclGst';

/** EPC split constants (Indian solar EPC GST treatment) */
const EPC_PORTION_70 = 0.7;
const EPC_PORTION_30 = 0.3;
const EPC_GST_ON_70 = 0.05;
const EPC_GST_ON_30 = 0.18;
/** Effective combined GST rate on full taxable value: 0.7*5% + 0.3*18% = 8.9% */
const EPC_EFFECTIVE_RATE = EPC_PORTION_70 * EPC_GST_ON_70 + EPC_PORTION_30 * EPC_GST_ON_30;

export interface SpgsEpcBreakdown {
  portion70Taxable: number;
  portion30Taxable: number;
  gstAt5On70: number;
  gstAt18On30: number;
  effectiveGstPercent: number;
  /** CGST as % of full taxable value (for table display) */
  cgstPercentOnTotal: number;
  sgstPercentOnTotal: number;
}

export interface SpgsComputed {
  watts: number;
  baseExclGst: number;
  gstAmount: number;
  totalInclGst: number;
  perWattDerived: number;
  cgst: number;
  sgst: number;
  gstBreakdownLines: { label: string; amount: number }[];
  /** Present when gstMode is epc */
  epc?: SpgsEpcBreakdown;
}

export interface SpgsInput {
  systemSizeKw: number;
  panelWattage: number;
  panelSerials: string[];
  pricingMode: SpgsPricingMode;
  /** Rs per Watt (DC) */
  perWatt?: number;
  /** Invoice total including GST */
  totalInclGst?: number;
  /** Taxable value before GST */
  baseExclGst?: number;
  gstMode: SpgsGstMode;
  /** Default ~8.9% blended effective GST on taxable value (legacy blended mode) */
  blendedGstPercent?: number;
  /** Fraction of taxable value taxed at 12% (0-1) — legacy split mode */
  splitPortion12?: number;
  /** Fraction of taxable value taxed at 18% (0-1) — legacy split mode */
  splitPortion18?: number;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function effectiveSplitRate(p12: number, p18: number) {
  const a = Math.min(1, Math.max(0, p12));
  const b = Math.min(1, Math.max(0, p18));
  const sum = a + b;
  const n12 = sum > 0 ? a / sum : 0.5;
  const n18 = sum > 0 ? b / sum : 0.5;
  return n12 * 0.12 + n18 * 0.18;
}

function computeEpcGst(baseExclGst: number): {
  gstAmount: number;
  cgst: number;
  sgst: number;
  lines: { label: string; amount: number }[];
  epc: SpgsEpcBreakdown;
} {
  const X = baseExclGst;
  let portion70 = round2(X * EPC_PORTION_70);
  let portion30 = round2(X - portion70);

  const gstAt5On70 = round2(portion70 * EPC_GST_ON_70);
  const gstAt18On30 = round2(portion30 * EPC_GST_ON_30);
  const gstAmount = round2(gstAt5On70 + gstAt18On30);

  const cgst = round2(gstAmount / 2);
  const sgst = round2(gstAmount - cgst);

  const lines: { label: string; amount: number }[] = [
    { label: '70% of taxable value @ 5% GST', amount: gstAt5On70 },
    { label: '30% of taxable value @ 18% GST', amount: gstAt18On30 },
  ];

  const effectiveGstPercent = X > 0 ? round2((gstAmount / X) * 10000) / 100 : 0;
  const cgstPercentOnTotal = X > 0 ? round2((cgst / X) * 10000) / 100 : 0;
  const sgstPercentOnTotal = X > 0 ? round2((sgst / X) * 10000) / 100 : 0;

  const epc: SpgsEpcBreakdown = {
    portion70Taxable: portion70,
    portion30Taxable: portion30,
    gstAt5On70,
    gstAt18On30,
    effectiveGstPercent,
    cgstPercentOnTotal,
    sgstPercentOnTotal,
  };

  return { gstAmount, cgst, sgst, lines, epc };
}

export function computeSpgsTotals(input: SpgsInput): SpgsComputed {
  const watts = Math.max(0, input.systemSizeKw * 1000);
  const blended = input.blendedGstPercent ?? 8.9;
  const p12 = input.splitPortion12 ?? 0.4;
  const p18 = input.splitPortion18 ?? 0.6;

  let baseExclGst = 0;

  if (input.pricingMode === 'perWatt') {
    const pw = input.perWatt ?? 0;
    baseExclGst = round2(pw * watts);
  } else if (input.pricingMode === 'baseExclGst') {
    baseExclGst = round2(input.baseExclGst ?? 0);
  } else {
    const total = input.totalInclGst ?? 0;
    if (input.gstMode === 'epc') {
      baseExclGst = round2(total / (1 + EPC_EFFECTIVE_RATE));
    } else if (input.gstMode === 'blended') {
      const r = blended / 100;
      baseExclGst = round2(total / (1 + r));
    } else {
      const eff = effectiveSplitRate(p12, p18);
      baseExclGst = round2(total / (1 + eff));
    }
  }

  let gstAmount = 0;
  const gstBreakdownLines: { label: string; amount: number }[] = [];
  let cgst = 0;
  let sgst = 0;
  let epc: SpgsEpcBreakdown | undefined;

  if (input.gstMode === 'epc') {
    const e = computeEpcGst(baseExclGst);
    gstAmount = e.gstAmount;
    cgst = e.cgst;
    sgst = e.sgst;
    gstBreakdownLines.push(...e.lines);
    epc = e.epc;
  } else if (input.gstMode === 'blended') {
    const r = blended / 100;
    gstAmount = round2(baseExclGst * r);
    gstBreakdownLines.push({ label: `Integrated GST (blended @ ${blended}%)`, amount: gstAmount });
    const half = round2(gstAmount / 2);
    cgst = half;
    sgst = round2(gstAmount - half);
  } else {
    const sum = p12 + p18;
    const n12 = sum > 0 ? p12 / sum : 0.5;
    const n18 = sum > 0 ? p18 / sum : 0.5;
    const base12 = round2(baseExclGst * n12);
    const base18 = round2(baseExclGst * n18);
    const g12 = round2(base12 * 0.12);
    const g18 = round2(base18 * 0.18);
    gstAmount = round2(g12 + g18);
    gstBreakdownLines.push({ label: `GST @ 12% on ${(n12 * 100).toFixed(0)}% of value`, amount: g12 });
    gstBreakdownLines.push({ label: `GST @ 18% on ${(n18 * 100).toFixed(0)}% of value`, amount: g18 });
    const half = round2(gstAmount / 2);
    cgst = half;
    sgst = round2(gstAmount - half);
  }

  const totalInclGst = round2(baseExclGst + gstAmount);
  const perWattDerived = watts > 0 ? round2(baseExclGst / watts) : 0;

  return {
    watts,
    baseExclGst,
    gstAmount,
    totalInclGst,
    perWattDerived,
    cgst,
    sgst,
    gstBreakdownLines,
    epc,
  };
}
