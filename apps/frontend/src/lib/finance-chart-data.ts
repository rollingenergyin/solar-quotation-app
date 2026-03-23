/**
 * Generate mock chart data for cashflow and expense/income charts.
 * Backend can later provide real time-series data via /finance/dashboard/chart-data
 */

import type { CashflowDataPoint } from '@/components/finance/CashflowChart';
import type { ExpenseIncomeDataPoint } from '@/components/finance/ExpenseIncomeChart';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getMonthsForPeriod(period: 'daily' | 'monthly' | 'yearly'): string[] {
  const now = new Date();
  const count = period === 'yearly' ? 12 : period === 'monthly' ? 6 : 7;
  const result: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(`${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`);
  }
  return result;
}

export function generateCashflowChartData(
  period: 'daily' | 'monthly' | 'yearly',
  totals: { inflows: number; outflows: number; openingBalance?: number }
): CashflowDataPoint[] {
  const months = getMonthsForPeriod(period);
  const n = months.length;
  const inflowPerMonth = totals.inflows / n;
  const outflowPerMonth = totals.outflows / n;
  const variation = 0.3; // ±30% variation

  let balance = totals.openingBalance ?? 0;

  return months.map((month, i) => {
    const varFactor = 1 + (Math.sin(i * 1.2) * variation);
    const inflows = Math.round(inflowPerMonth * varFactor * (0.85 + (i % 5) * 0.03));
    const outflows = Math.round(outflowPerMonth * varFactor * (0.9 + (i % 4) * 0.02));
    const net = inflows - outflows;
    balance += net;

    return {
      month,
      inflows,
      outflows,
      net,
      balance,
    };
  });
}

export function generateExpenseIncomeChartData(
  period: 'daily' | 'monthly' | 'yearly',
  totals: { revenue: number; expenses: number }
): ExpenseIncomeDataPoint[] {
  const months = getMonthsForPeriod(period);
  const n = months.length;
  const revPerMonth = totals.revenue / Math.max(n, 1);
  const expPerMonth = totals.expenses / Math.max(n, 1);
  const variation = 0.25;

  return months.map((month, i) => {
    const varFactor = 1 + (Math.cos(i * 0.8) * variation);
    return {
      month,
      income: Math.round(revPerMonth * varFactor * (0.9 + (i % 6) * 0.02)),
      expense: Math.round(expPerMonth * varFactor * (0.85 + (i % 5) * 0.03)),
    };
  });
}
