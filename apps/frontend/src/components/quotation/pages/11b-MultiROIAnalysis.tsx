'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';
import QuotationHeader from '../QuotationHeader';
import QuotationFooter from '../QuotationFooter';
import ProposalNoteBlock from '../ProposalNoteBlock';
import type { RoiPageSpec } from '../quotation-page-plan';
import type { ProposalNote } from '@/constants/proposal-note';

interface Props {
  quoteNumber: string;
  specs: RoiPageSpec[];
  gridInflationPct: number;
  pageNumber: number;
  totalPages: number;
  proposalNote?: ProposalNote | null;
}

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

const fmtK = (n: number) => {
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
};

function buildChartData(netCost: number, annualSavingsRs: number, gridInflationPct: number) {
  return Array.from({ length: 31 }, (_, year) => {
    let cumulativeSavings = 0;
    for (let y = 0; y < year; y++) {
      cumulativeSavings += annualSavingsRs * Math.pow(1 + gridInflationPct / 100, y);
    }
    return {
      year,
      Investment: netCost,
      'Cumulative Savings': Math.round(cumulativeSavings),
    };
  });
}

function RoiBlock({
  spec,
  gridInflationPct,
  chartId,
  compact,
}: {
  spec: RoiPageSpec;
  gridInflationPct: number;
  chartId: string;
  compact: boolean;
}) {
  const chartData = buildChartData(spec.netCost, spec.annualSavingsRs, gridInflationPct);
  const profitAt30 = spec.savings30YrRs - spec.netCost;
  const chartHeight = compact ? 140 : 220;

  return (
    <div className="quotation-no-break">
      <div className={compact ? 'mb-2' : 'mb-3'}>
        <h3
          className={`font-bold leading-snug ${compact ? 'text-base' : 'text-lg'}`}
          style={{ color: '#161c34', fontFamily: 'Poppins, sans-serif' }}
        >
          {spec.analysisTitle}
        </h3>
        {spec.analysisSubtitle && (
          <p className="text-sm text-gray-500 mt-1">{spec.analysisSubtitle}</p>
        )}
      </div>

      <div className={`grid grid-cols-4 gap-3 ${compact ? 'mb-2' : 'mb-3'}`}>
        {[
          { label: 'Investment', value: fmt(spec.netCost) },
          { label: 'Yr 1 Savings', value: fmt(spec.annualSavingsRs) },
          { label: 'Breakeven', value: `${spec.breakevenYears} yrs`, accent: true },
          { label: '30-Yr Savings', value: fmt(spec.savings30YrRs) },
        ].map((m) => (
          <div
            key={m.label}
            className={`rounded-xl text-center ${compact ? 'p-2.5' : 'p-3'}`}
            style={{
              background: m.accent ? 'linear-gradient(135deg, #6690cc, #3c5e94)' : '#f9fafb',
              border: m.accent ? 'none' : '1px solid #e5e7eb',
            }}
          >
            <p className="text-xs mb-1" style={{ color: m.accent ? 'rgba(255,255,255,0.75)' : '#9ca3af' }}>
              {m.label}
            </p>
            <p
              className={`font-bold leading-tight ${compact ? 'text-sm' : 'text-base'}`}
              style={{ color: m.accent ? '#ffffff' : '#161c34', fontFamily: 'Poppins, sans-serif' }}
            >
              {m.value}
            </p>
          </div>
        ))}
      </div>

      <div
        className={`rounded-xl p-3 ${compact ? 'mb-2' : 'mb-3'}`}
        style={{ background: '#f9fafb', border: '1px solid #e5e7eb', height: `${chartHeight}px` }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 6, right: 12, left: 4, bottom: 16 }}>
            <defs>
              <linearGradient id={`${chartId}-savings`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6690cc" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6690cc" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id={`${chartId}-invest`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#161c34" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#161c34" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={fmtK} width={48} />
            <Tooltip
              formatter={(v) => fmtK(Number(v ?? 0))}
              labelFormatter={(l) => `Year ${l}`}
              contentStyle={{ fontSize: 12 }}
            />
            <ReferenceLine x={spec.breakevenYears} stroke="#16a34a" strokeDasharray="4 4" />
            <Area type="monotone" dataKey="Investment" stroke="#161c34" fill={`url(#${chartId}-invest)`} strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="Cumulative Savings" stroke="#6690cc" fill={`url(#${chartId}-savings)`} strokeWidth={2.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="text-sm text-gray-500">
        Breakeven in {spec.breakevenYears} years · 30-year net profit {fmt(profitAt30)}
      </p>
    </div>
  );
}

export default function MultiROIAnalysis({
  quoteNumber, specs, gridInflationPct, pageNumber, totalPages, proposalNote,
}: Props) {
  const compact = specs.length >= 3;

  return (
    <div className="quotation-page flex flex-col" style={{ background: '#ffffff' }}>
      <QuotationHeader quoteNumber={quoteNumber} pageTitle="ROI Analysis" pageNumber={pageNumber} totalPages={totalPages} />

      <div className="flex-1 px-12 py-6" style={{ paddingBottom: '44px' }}>
        <div className={compact ? 'mb-4' : 'mb-5'}>
          <p className="text-xs font-semibold tracking-widest uppercase mb-1.5" style={{ color: '#6690cc' }}>
            Return on Investment
          </p>
          <h2 className="text-2xl font-bold" style={{ color: '#161c34', fontFamily: 'Poppins, sans-serif' }}>
            Individual System Analysis
          </h2>
          <div className="mt-2 h-0.5 w-12" style={{ background: '#6690cc' }} />
        </div>

        {specs.map((spec, idx) => (
          <div key={`${spec.analysisTitle}-${idx}`}>
            {idx > 0 && <div className={`border-t border-gray-200 ${compact ? 'my-4' : 'my-5'}`} />}
            <RoiBlock
              spec={spec}
              gridInflationPct={gridInflationPct}
              chartId={`roi-${pageNumber}-${idx}`}
              compact={compact}
            />
          </div>
        ))}

        <ProposalNoteBlock placement="roi_analysis" proposalNote={proposalNote} />
      </div>

      <QuotationFooter quoteNumber={quoteNumber} pageNumber={pageNumber} />
    </div>
  );
}
