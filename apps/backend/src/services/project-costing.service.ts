/**
 * Project Costing Service
 * Aggregates expenses, receivables, bills, stock usage by project
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ProjectCostingSummary {
  project: {
    id: string;
    name: string;
    code: string | null;
    status: string | null;
  };
  expenses: {
    total: number;
    count: number;
    items: { id: string; amount: number; category: string; description: string | null; createdAt: Date }[];
  };
  receivables: {
    total: number;
    count: number;
    items: { id: string; amount: number; category: string | null; description: string | null; createdAt: Date }[];
  };
  purchaseBills: {
    total: number;
    count: number;
    items: { id: string; invoiceNo: string; totalAmount: number; vendor: { name: string }; createdAt: Date }[];
  };
  salesBills: {
    total: number;
    count: number;
    items: { id: string; invoiceNo: string; totalAmount: number; client: { name: string }; createdAt: Date }[];
  };
  stockUsage: {
    totalCost: number;
    count: number;
    items: { id: string; product: { name: string }; quantity: number; unitPrice: number | null; cost: number }[];
  };
  totals: {
    totalCost: number;
    totalRevenue: number;
    profit: number;
  };
}

export async function getProjectCostingSummary(projectId: string): Promise<ProjectCostingSummary | null> {
  const project = await prisma.financeProject.findUnique({
    where: { id: projectId },
  });
  if (!project) return null;

  const [expenses, incomes, purchaseBills, salesBills, stockMovements] = await Promise.all([
    prisma.expense.findMany({
      where: { projectId },
      include: { vendor: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.income.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.purchaseBill.findMany({
      where: { projectId },
      include: { vendor: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.salesBill.findMany({
      where: { projectId },
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.stockMovement.findMany({
      where: { projectId, type: 'USAGE' },
      include: { product: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const receivablesTotal = incomes.reduce((s, i) => s + i.amount, 0);
  const purchaseBillsTotal = purchaseBills.reduce((s, b) => s + b.totalAmount, 0);
  const salesBillsTotal = salesBills.reduce((s, b) => s + b.totalAmount, 0);

  const stockUsageItems = stockMovements.map((m) => {
    const cost = (m.quantity || 0) * (m.unitPrice || 0);
    return {
      id: m.id,
      product: m.product,
      quantity: m.quantity,
      unitPrice: m.unitPrice,
      cost: Math.abs(cost),
    };
  });
  const stockUsageTotal = stockUsageItems.reduce((s, i) => s + i.cost, 0);

  const totalCost = expenseTotal + purchaseBillsTotal + stockUsageTotal;
  const totalRevenue = receivablesTotal + salesBillsTotal;
  const profit = totalRevenue - totalCost;

  return {
    project: {
      id: project.id,
      name: project.name,
      code: project.code,
      status: project.status,
    },
    expenses: {
      total: expenseTotal,
      count: expenses.length,
      items: expenses.map((e) => ({
        id: e.id,
        amount: e.amount,
        category: e.category,
        description: e.description,
        createdAt: e.createdAt,
      })),
    },
    receivables: {
      total: receivablesTotal,
      count: incomes.length,
      items: incomes.map((i) => ({
        id: i.id,
        amount: i.amount,
        category: i.category,
        description: i.description,
        createdAt: i.createdAt,
      })),
    },
    purchaseBills: {
      total: purchaseBillsTotal,
      count: purchaseBills.length,
      items: purchaseBills.map((b) => ({
        id: b.id,
        invoiceNo: b.invoiceNo,
        totalAmount: b.totalAmount,
        vendor: b.vendor,
        createdAt: b.createdAt,
      })),
    },
    salesBills: {
      total: salesBillsTotal,
      count: salesBills.length,
      items: salesBills.map((b) => ({
        id: b.id,
        invoiceNo: b.invoiceNo,
        totalAmount: b.totalAmount,
        client: b.client,
        createdAt: b.createdAt,
      })),
    },
    stockUsage: {
      totalCost: stockUsageTotal,
      count: stockMovements.length,
      items: stockUsageItems,
    },
    totals: {
      totalCost,
      totalRevenue,
      profit,
    },
  };
}

export interface ProjectListSummary {
  id: string;
  name: string;
  code: string | null;
  status: string | null;
  totalCost: number;
  totalRevenue: number;
  profit: number;
}

export async function getProjectsSummary(): Promise<ProjectListSummary[]> {
  const projects = await prisma.financeProject.findMany({
    orderBy: { name: 'asc' },
  });

  const summaries: ProjectListSummary[] = [];

  for (const p of projects) {
    const summary = await getProjectCostingSummary(p.id);
    if (!summary) continue;
    summaries.push({
      id: p.id,
      name: p.name,
      code: p.code,
      status: p.status,
      totalCost: summary.totals.totalCost,
      totalRevenue: summary.totals.totalRevenue,
      profit: summary.totals.profit,
    });
  }

  return summaries;
}
