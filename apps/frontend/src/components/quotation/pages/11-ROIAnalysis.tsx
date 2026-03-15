'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts';
import QuotationHeader from '../QuotationHeader';
import QuotationFooter from '../QuotationFooter';

interface Props {
  quoteNumber: string;
  netCost: number;
  annualSavingsRs: number;
  savings30YrRs: number;
  breakevenYears: number;
  gridInflationPct: number;
  pageNumber?: number;
  totalPages?: number;
}

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

const fmtK = (n: number) => {
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg shadow-lg px-4 py-3 text-xs"
      style={{ background: '#161c34', border: '1px solid rgba(102,144,204,0.3)' }}
    >
      <p className="font-semibold mb-2" style={{ color: '#6690cc' }}>Year {label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {fmtK(p.value)}
        </p>
      ))}
    </div>
  );
};

export default function ROIAnalysis({
  quoteNumber, netCost, annualSavingsRs, savings30YrRs, breakevenYears, gridInflationPct,
  pageNumber = 11, totalPages = 13,
}: Props) {
  // Generate 30-year cumulative data
  const chartData = Array.from({ length: 31 }, (_, year) => {
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

  const profitAt30 = savings30YrRs - netCost;

  return (
    <div className="quotation-page flex flex-col" style={{ background: '#ffffff' }}>
      <QuotationHeader quoteNumber={quoteNumber} pageTitle="ROI Analysis" pageNumber={pageNumber} totalPages={totalPages} />

      <div className="flex-1 px-12 py-7" style={{ paddingBottom: '36px' }}>
        <div className="mb-5">
          <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: '#6690cc' }}>
            Return on Investment
          </p>
          <h2
            className="text-2xl font-bold"
            style={{ color: '#161c34', fontFamily: 'Poppins, sans-serif' }}
          >
            30-Year Financial Analysis
          </h2>
          <div className="mt-2 h-0.5 w-12" style={{ background: '#6690cc' }} />
        </div>

        {/* Key metrics row */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Investment', value: fmt(netCost), sub: 'One-time cost (net)', accent: false },
            { label: 'Annual Savings (Yr 1)', value: fmt(annualSavingsRs), sub: `@ ${gridInflationPct}% grid inflation`, accent: false },
            { label: 'Breakeven Point', value: `${breakevenYears} yrs`, sub: 'Full ROI recovery', accent: true },
            { label: '30-Year Savings', value: fmt(savings30YrRs), sub: `Net profit: ${fmt(profitAt30)}`, accent: false },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-xl p-4 text-center"
              style={{
                background: m.accent
                  ? 'linear-gradient(135deg, #6690cc, #3c5e94)'
                  : '#f9fafb',
                border: m.accent ? 'none' : '1px solid #e5e7eb',
              }}
            >
              <p className="text-xs mb-1" style={{ color: m.accent ? 'rgba(255,255,255,0.7)' : '#9ca3af' }}>
                {m.label}
              </p>
              <p
                className="text-lg font-bold leading-tight"
                style={{
                  color: m.accent ? '#ffffff' : '#161c34',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                {m.value}
              </p>
              <p className="text-xs mt-1" style={{ color: m.accent ? 'rgba(255,255,255,0.55)' : '#9ca3af' }}>
                {m.sub}
              </p>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div
          className="rounded-2xl p-4 mb-5"
          style={{ background: '#f9fafb', border: '1px solid #e5e7eb', height: '200px' }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6690cc" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6690cc" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="investGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#161c34" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#161c34" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                label={{ value: 'Years', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#9ca3af' }}
              />
              <YAxis
                tick={{ fontSize: 9, fill: '#9ca3af' }}
                tickFormatter={fmtK}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <ReferenceLine
                x={breakevenYears}
                stroke="#16a34a"
                strokeDasharray="4 4"
                label={{ value: `Breakeven Yr ${breakevenYears}`, position: 'top', fontSize: 10, fill: '#16a34a' }}
              />
              <Area
                type="monotone"
                dataKey="Investment"
                stroke="#161c34"
                fill="url(#investGrad)"
                strokeWidth={2}
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="Cumulative Savings"
                stroke="#6690cc"
                fill="url(#savingsGrad)"
                strokeWidth={2.5}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Highlight boxes */}
        <div className="grid grid-cols-2 gap-4">
          <div
            className="rounded-2xl px-5 py-4 flex items-center gap-4"
            style={{ background: 'linear-gradient(135deg, #161c34, #2c4570)' }}
          >
            <span style={{ fontSize: '32px' }}>🎯</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#ffffff', fontFamily: 'Poppins, sans-serif' }}>
                Breakeven in {breakevenYears} Years
              </p>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                After this point, 100% of savings is pure profit for the remaining {30 - breakevenYears} years of system life.
              </p>
            </div>
          </div>
          <div
            className="rounded-2xl px-5 py-4 flex items-center gap-4"
            style={{ background: 'linear-gradient(135deg, #6690cc, #3c5e94)' }}
          >
            <span style={{ fontSize: '32px' }}>💰</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#ffffff', fontFamily: 'Poppins, sans-serif' }}>
                {fmt(savings30YrRs)} Over 30 Years
              </p>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
                Total cumulative savings over the system lifetime, assuming {gridInflationPct}% annual grid tariff increase.
              </p>
            </div>
          </div>
        </div>
      </div>

      <QuotationFooter quoteNumber={quoteNumber} pageNumber={pageNumber} />
    </div>
  );
}
