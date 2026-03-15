'use client';

import QuotationHeader from '../QuotationHeader';
import QuotationFooter from '../QuotationFooter';
import type { TemplateDepreciationRow } from '../../../types/quotation-template';

interface Props {
  quoteNumber: string;
  netCost: number;
  depreciationTable: TemplateDepreciationRow[];
  depreciationNote: string;
  pageNumber?: number;
  totalPages?: number;
}

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

const DEFAULT_TABLE: TemplateDepreciationRow[] = [
  { year: 'Year 1', rate: '40%',   note: 'WDV accelerated depreciation (40% on full asset value)' },
  { year: 'Year 2', rate: '24%',   note: '40% on remaining 60% of value' },
  { year: 'Year 3', rate: '14.4%', note: '40% on remaining 36% of value' },
  { year: 'Year 4+', rate: '8.6%', note: 'Diminishing balance continues' },
];

export default function DepreciationPage({
  quoteNumber, netCost,
  depreciationTable,
  depreciationNote,
  pageNumber = 9,
  totalPages = 14,
}: Props) {
  const table = depreciationTable?.length ? depreciationTable : DEFAULT_TABLE;

  // Calculate indicative depreciation amounts for each year
  const enriched = table.map((row) => {
    const pct = parseFloat(row.rate.replace('%', '')) / 100;
    const amount = isNaN(pct) ? null : Math.round(netCost * pct);
    return { ...row, amount };
  });

  // Year 1 tax benefit estimate at 30% corporate tax (indicative)
  const yr1Row = enriched[0];
  const taxBenefit30 = yr1Row?.amount ? Math.round(yr1Row.amount * 0.30) : null;
  const taxBenefit25 = yr1Row?.amount ? Math.round(yr1Row.amount * 0.25) : null;

  return (
    <div className="quotation-page flex flex-col" style={{ background: '#ffffff' }}>
      <QuotationHeader quoteNumber={quoteNumber} pageTitle="Depreciation Benefits" pageNumber={pageNumber} totalPages={totalPages} />

      <div className="flex-1 px-12 py-6" style={{ paddingBottom: '36px' }}>

        {/* Heading */}
        <div className="mb-6">
          <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: '#6690cc' }}>
            Tax & Financial Benefits
          </p>
          <h2 className="text-2xl font-bold" style={{ color: '#161c34', fontFamily: 'Poppins, sans-serif' }}>
            Accelerated Depreciation Benefits
          </h2>
          <div className="mt-2 h-0.5 w-12" style={{ background: '#6690cc' }} />
        </div>

        {/* Header explanation banner */}
        <div
          className="rounded-2xl px-6 py-5 mb-6 flex items-start gap-4"
          style={{ background: 'linear-gradient(135deg, #161c34, #2c4570)' }}
        >
          <span style={{ fontSize: '36px' }}>📊</span>
          <div>
            <p className="text-sm font-semibold mb-1.5" style={{ color: '#ffffff', fontFamily: 'Poppins, sans-serif' }}>
              Solar Plant as a Business Asset
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
              Under the Income Tax Act (Section 32), solar energy generating equipment qualifies for
              <strong style={{ color: '#6690cc' }}> 40% accelerated depreciation</strong> on a Written Down Value (WDV) basis.
              This allows businesses to claim the solar plant as a business expense over its life,
              significantly reducing taxable income in the early years of operation.
            </p>
          </div>
        </div>

        {/* Key benefit stats */}
        {yr1Row?.amount && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="rounded-xl p-4 text-center" style={{ background: '#eef3fb', border: '1px solid #d5e3f5' }}>
              <p className="text-xs text-gray-500 mb-1">Year 1 Depreciation</p>
              <p className="text-xl font-bold" style={{ color: '#161c34', fontFamily: 'Poppins, sans-serif' }}>
                {fmt(yr1Row.amount)}
              </p>
              <p className="text-xs text-gray-400">40% of {fmt(netCost)}</p>
            </div>
            <div className="rounded-xl p-4 text-center" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <p className="text-xs text-gray-500 mb-1">Tax Saving @ 30% bracket</p>
              <p className="text-xl font-bold" style={{ color: '#15803d', fontFamily: 'Poppins, sans-serif' }}>
                {taxBenefit30 ? fmt(taxBenefit30) : '—'}
              </p>
              <p className="text-xs text-gray-400">Indicative (Year 1)</p>
            </div>
            <div className="rounded-xl p-4 text-center" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
              <p className="text-xs text-gray-500 mb-1">Tax Saving @ 25% bracket</p>
              <p className="text-xl font-bold" style={{ color: '#92400e', fontFamily: 'Poppins, sans-serif' }}>
                {taxBenefit25 ? fmt(taxBenefit25) : '—'}
              </p>
              <p className="text-xs text-gray-400">Indicative (Year 1)</p>
            </div>
          </div>
        )}

        {/* Depreciation table */}
        <div className="mb-6">
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#9ca3af' }}>
            Year-Wise Depreciation Schedule
          </p>
          <div className="rounded-xl overflow-hidden border" style={{ borderColor: '#e5e7eb' }}>
            <div
              className="grid text-xs font-semibold px-5 py-3"
              style={{
                gridTemplateColumns: '1fr 1fr 1.5fr 2fr',
                background: '#6690cc',
                color: '#ffffff',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              <div>Year</div>
              <div>Rate</div>
              <div>Depreciation Amount</div>
              <div>Notes</div>
            </div>
            {enriched.map((row, i) => (
              <div
                key={row.year}
                className="grid px-5 py-3 items-center"
                style={{
                  gridTemplateColumns: '1fr 1fr 1.5fr 2fr',
                  background: i % 2 === 0 ? '#ffffff' : '#f9fafb',
                  borderBottom: i < enriched.length - 1 ? '1px solid #f3f4f6' : 'none',
                  fontSize: '12px',
                }}
              >
                <div className="font-semibold" style={{ color: '#161c34' }}>{row.year}</div>
                <div className="font-bold" style={{ color: '#6690cc' }}>{row.rate}</div>
                <div className="font-semibold" style={{ color: '#374151' }}>
                  {row.amount ? fmt(row.amount) : '—'}
                </div>
                <div className="text-gray-500">{row.note}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Note */}
        <div
          className="rounded-xl px-5 py-4 flex items-start gap-3"
          style={{ background: '#fffbeb', border: '1px solid #fde68a' }}
        >
          <span style={{ fontSize: '18px' }}>⚠️</span>
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: '#92400e' }}>Important Note</p>
            <p className="text-xs leading-relaxed text-gray-600">
              {depreciationNote || 'This solar installation may qualify for accelerated depreciation benefits under applicable tax rules.'}
              {' '}Actual tax benefits depend on your tax bracket, applicable regulations, and the advice of your chartered accountant.
              The figures shown above are indicative only and not to be treated as professional tax advice.
            </p>
          </div>
        </div>
      </div>

      <QuotationFooter quoteNumber={quoteNumber} pageNumber={pageNumber} />
    </div>
  );
}
