/**
 * Builds template data for quotation PDF/print.
 * Shared by template-data API and PDF generation.
 */

import { PrismaClient } from '@prisma/client';
import { selectTemplateForQuotation } from './template-selection.service.js';

const prisma = new PrismaClient();

export interface QuotationTemplateData {
  quoteNumber: string;
  date: string;
  clientName: string;
  clientAddress: string;
  contactPerson: string;
  systemSizeKw: number;
  systemSizeWatts: number;
  numModules: number;
  inverterSizeKw: number;
  areaSquareFt: number;
  dailyProductionKwh: number;
  monthlyProductionKwh: number;
  annualProductionKwh: number;
  monthlySavingsRs: number;
  annualSavingsRs: number;
  savings30YrRs: number;
  breakevenYears: number;
  baseCost: number;
  gstAmount: number;
  totalCost: number;
  subsidyAmount: number;
  netCost: number;
  [key: string]: unknown;
}

export async function getQuotationTemplateData(quotationId: string): Promise<QuotationTemplateData | null> {
  const q = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: {
      customer: true,
      site: true,
      result: true,
      materials: {
        include: { material: { select: { name: true, unit: true, specs: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!q || !q.result) return null;

  const breakdown = (q.result.breakdown as Record<string, unknown>) ?? {};
  const inputs = (breakdown.inputs as Record<string, number>) ?? {};
  const costBreak = (breakdown.costBreakdown as Record<string, number>) ?? {};
  const emiData = (breakdown.emi as Record<string, Record<string, number>>) ?? {};

  const systemKw = inputs.systemSizeKw ?? (q.totalWattage ? q.totalWattage / 1000 : 0);
  const totalWatts = Math.round(systemKw * 1000);
  const panelWatt = 575;
  const numPanels = Math.ceil(totalWatts / panelWatt);

  const peakSun = inputs.peakSunHours ?? 5;
  const efficiency = inputs.systemEfficiency ?? 0.8;
  const inflation = inputs.gridInflationPct ?? 3;
  const tariff = inputs.electricityRatePerUnit ?? 8;

  const annualGenKwh = Math.round(systemKw * peakSun * 365 * efficiency);
  const annualSavYr1 = Math.round(annualGenKwh * tariff);

  let savings30Yr = 0;
  for (let y = 0; y < 30; y++) {
    savings30Yr += Math.round(annualSavYr1 * Math.pow(1 + inflation / 100, y));
  }

  const netCost = costBreak.netCost ?? q.totalAmount ?? 0;
  const baseCost = costBreak.baseCost ?? 0;
  const gstAmount = costBreak.gstAmount ?? 0;
  const grossCost = costBreak.grossCost ?? 0;
  const subsidy = costBreak.subsidyAmount ?? 0;

  const emi3Yr = emiData.tenure3yr?.emi ?? 0;
  const emi5Yr = emiData.tenure5yr?.emi ?? 0;
  const emi7Yr = emiData.tenure7yr?.emi ?? 0;
  const emi3YrTotalPayable = emiData.tenure3yr?.totalPayable ?? emi3Yr * 36;
  const emi3YrTotalInterest = emiData.tenure3yr?.totalInterest ?? emi3Yr * 36 - Math.round(grossCost * 0.8);
  const emi5YrTotalPayable = emiData.tenure5yr?.totalPayable ?? emi5Yr * 60;
  const emi5YrTotalInterest = emiData.tenure5yr?.totalInterest ?? emi5Yr * 60 - Math.round(grossCost * 0.8);
  const emi7YrTotalPayable = emiData.tenure7yr?.totalPayable ?? emi7Yr * 84;
  const emi7YrTotalInterest = emiData.tenure7yr?.totalInterest ?? emi7Yr * 84 - Math.round(grossCost * 0.8);

  const now = new Date();
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dateStr = `${now.getDate().toString().padStart(2, '0')} ${months[now.getMonth()]} ${now.getFullYear()}`;

  const sysType = (q.systemType ?? 'DCR') as 'DCR' | 'NON_DCR';
  const sitType = (q.siteType ?? 'RESIDENTIAL') as 'RESIDENTIAL' | 'SOCIETY' | 'COMMERCIAL' | 'INDUSTRIAL';
  const activeTemplate = await selectTemplateForQuotation(sysType, sitType);

  const materials = q.materials.map((qm, i) => ({
    srNo: i + 1,
    name: qm.material.name,
    specification: (qm.material.specs as string | null) ?? '',
    make: '',
    quantity: qm.quantity,
    unit: qm.material.unit,
  }));

  return {
    quoteNumber: q.quoteNumber,
    date: dateStr,
    validUntil: q.validUntil ? q.validUntil.toISOString().split('T')[0] : null,
    status: q.status,
    clientName: q.customer.name,
    clientAddress: q.site.address || q.customer.address || '',
    clientPhone: q.customer.phone ?? null,
    clientEmail: q.customer.email ?? null,
    contactPerson: q.customer.name,
    systemSizeKw: systemKw,
    systemSizeWatts: totalWatts,
    numModules: numPanels,
    inverterSizeKw: q.inverterSizeKw ?? systemKw,
    areaSquareFt: Math.round(systemKw * 80),
    dailyProductionKwh: Math.round((annualGenKwh / 365) * 10) / 10,
    monthlyProductionKwh: Math.round(annualGenKwh / 12),
    annualProductionKwh: annualGenKwh,
    monthlySavingsRs: Math.round(annualSavYr1 / 12),
    annualSavingsRs: annualSavYr1,
    savings30YrRs: savings30Yr,
    breakevenYears: q.result.roiYears ? Math.round(q.result.roiYears * 10) / 10 : 0,
    tariffPerUnit: tariff,
    gridInflationPct: inflation,
    baseCost,
    gstAmount,
    totalCost: grossCost,
    subsidyAmount: subsidy,
    netCost,
    emi3Yr,
    emi5Yr,
    emi7Yr,
    emi3YrTotalPayable,
    emi3YrTotalInterest,
    emi5YrTotalPayable,
    emi5YrTotalInterest,
    emi7YrTotalPayable,
    emi7YrTotalInterest,
    materials,
    systemType: q.systemType,
    siteType: q.siteType,
    showSubsidy: q.systemType !== 'NON_DCR' && (q.siteType === 'RESIDENTIAL' || q.siteType === 'SOCIETY'),
    showDepreciation: q.systemType === 'NON_DCR' && (q.siteType === 'COMMERCIAL' || q.siteType === 'INDUSTRIAL'),
    sanctionedLoadKw: q.sanctionedLoadKw ?? null,
    depreciationTable: activeTemplate?.depreciationTable ?? [
      { year: 'Year 1', rate: '40%', note: 'WDV accelerated depreciation' },
      { year: 'Year 2', rate: '24%', note: '40% on remaining 60%' },
      { year: 'Year 3', rate: '14.4%', note: '40% on remaining 36%' },
      { year: 'Year 4+', rate: '8.6%', note: 'Diminishing balance' },
    ],
    depreciationNote: activeTemplate?.depreciationNote ?? 'This solar installation may qualify for accelerated depreciation benefits under applicable tax rules.',
    templateConfig: activeTemplate ?? null,
  };
}
