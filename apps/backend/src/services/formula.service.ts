import { PrismaClient } from '@prisma/client';
import { Parser } from 'expr-eval';

const prisma = new PrismaClient();
const parser = new Parser();

/** Pricing units supported by the formula engine */
export const PRICING_UNITS = ['WATT', 'METER', 'PIECE', 'KW', 'SET', 'LUMP'] as const;
export type PricingUnit = (typeof PRICING_UNITS)[number];

/** Allowed variable names for formula evaluation (whitelist for safety) */
const ALLOWED_VARIABLES = new Set([
  // Material pricing
  'totalWattage', 'totalMeters', 'totalPieces', 'totalKw',
  'pricePerWatt', 'pricePerMeter', 'pricePerPiece', 'pricePerKw',
  'quantity', 'unitPrice', 'area', 'unitsKwh',
  // Financial
  'totalAmount', 'annualSavings', 'baseCost', 'base_cost', 'totalCost', 'total_cost',
  'netCost', 'net_cost', 'preGstCost', 'pre_gst_cost',
  'profitPct', 'profit_pct', 'gstPct', 'gst_pct',
  'P', 'r', 'n', 'tenureMonths', 'interestRate',
  // System sizing
  'yearlyUnits', 'yearly_units', 'monthlyUnits', 'monthly_units',
  'totalUnits', 'total_units', 'monthsCount', 'months_count',
  'systemKw', 'system_kw', 'systemWatts', 'system_watts',
  'peakSunHours', 'peak_sun_hours', 'systemEfficiency', 'system_efficiency',
  // Cable / civil
  'buildingHeight', 'building_height', 'floorHeight', 'floor_height',
  'numFloors', 'num_floors', 'floors', 'cableExtraPct', 'cable_extra_pct',
  // Misc
  'dailyUnits', 'daily_units', 'wattageWp', 'wattage_wp',
]);

/** Safely evaluate a formula expression with given variables */
export function evaluateExpression(
  expression: string,
  variables: Record<string, number>
): number {
  const sanitized: Record<string, number> = {};
  for (const [key, value] of Object.entries(variables)) {
    if (ALLOWED_VARIABLES.has(key) && typeof value === 'number' && !Number.isNaN(value)) {
      sanitized[key] = value;
    }
  }

  try {
    const expr = parser.parse(expression);
    const result = expr.evaluate(sanitized);
    if (typeof result !== 'number' || !Number.isFinite(result)) {
      throw new Error('Formula produced invalid result');
    }
    return Math.round(result * 100) / 100; // 2 decimal places
  } catch (err) {
    throw new Error(
      err instanceof Error ? err.message : 'Formula evaluation failed'
    );
  }
}

/** Validate expression syntax without evaluating */
export function validateExpression(expression: string): { valid: boolean; error?: string } {
  try {
    parser.parse(expression);
    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Invalid expression',
    };
  }
}

/** Compute price by unit type (watt, meter, piece) */
export function computePriceByUnit(
  unit: PricingUnit,
  quantity: number,
  unitPrice: number
): number {
  switch (unit.toUpperCase()) {
    case 'WATT':
    case 'KW':
      return quantity * unitPrice;
    case 'METER':
    case 'PIECE':
    case 'SET':
    case 'LUMP':
    default:
      return quantity * unitPrice;
  }
}

export async function listFormulas() {
  return prisma.formula.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      versions: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
}

export async function getFormulaBySlug(slug: string) {
  const formula = await prisma.formula.findUnique({
    where: { slug },
    include: {
      versions: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!formula) {
    throw new Error('Formula not found');
  }
  return formula;
}

export async function getActiveVersion(formulaId: string) {
  const version = await prisma.formulaVersion.findFirst({
    where: { formulaId, isActive: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!version) {
    throw new Error('No active version found');
  }
  return version;
}

export async function createFormula(data: {
  name: string;
  slug: string;
  description?: string;
  expression: string;
  variables: string[];
  createdById: string;
}) {
  const { expression, variables, createdById, ...rest } = data;
  const validation = validateExpression(expression);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  return prisma.$transaction(async (tx) => {
    const formula = await tx.formula.create({ data: rest });
    await tx.formulaVersion.create({
      data: {
        formulaId: formula.id,
        expression,
        variables,
        description: data.description,
        isActive: true,
        createdById,
      },
    });
    return prisma.formula.findUnique({
      where: { id: formula.id },
      include: { versions: true },
    });
  });
}

export async function updateFormula(
  id: string,
  data: { name?: string; description?: string; isActive?: boolean }
) {
  return prisma.formula.update({
    where: { id },
    data,
  });
}

export async function createFormulaVersion(data: {
  formulaId: string;
  expression: string;
  variables: string[];
  description?: string;
  createdById: string;
}) {
  const validation = validateExpression(data.expression);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  return prisma.$transaction(async (tx) => {
    await tx.formulaVersion.updateMany({
      where: { formulaId: data.formulaId },
      data: { isActive: false },
    });
    return tx.formulaVersion.create({
      data: {
        formulaId: data.formulaId,
        expression: data.expression,
        variables: data.variables,
        description: data.description,
        isActive: true,
        createdById: data.createdById,
      },
    });
  });
}

export async function setActiveVersion(formulaId: string, versionId: string) {
  const version = await prisma.formulaVersion.findFirst({
    where: { id: versionId, formulaId },
  });
  if (!version) {
    throw new Error('Version not found');
  }

  return prisma.$transaction([
    prisma.formulaVersion.updateMany({
      where: { formulaId },
      data: { isActive: false },
    }),
    prisma.formulaVersion.update({
      where: { id: versionId },
      data: { isActive: true },
    }),
  ]);
}

export async function evaluateFormula(
  slug: string,
  variables: Record<string, number>
): Promise<number> {
  const formula = await getFormulaBySlug(slug);
  const version = await getActiveVersion(formula.id);
  const varsArray = version.variables as unknown;
  const varNames = Array.isArray(varsArray) ? varsArray : Object.keys(variables);
  const sanitized: Record<string, number> = {};
  for (const name of varNames) {
    if (typeof variables[name] === 'number') {
      sanitized[name] = variables[name];
    }
  }
  return evaluateExpression(version.expression, sanitized);
}
