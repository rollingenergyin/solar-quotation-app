'use client';

import QuotationHeader from '../QuotationHeader';
import QuotationFooter from '../QuotationFooter';

interface Props {
  quoteNumber: string;
  systemSizeKw: number;
  inverterSizeKw: number;
  numModules: number;
  areaSquareFt: number;
  dailyProductionKwh: number;
  monthlyProductionKwh: number;
  annualProductionKwh: number;
  monthlySavingsRs: number;
  annualSavingsRs: number;
  savings30YrRs: number;
  breakevenYears: number;
  netCost: number;
  sanctionedLoadKw?: number | null;
}

const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

const Card = ({
  label, value, unit, accent = false
}: { label: string; value: string; unit?: string; accent?: boolean }) => (
  <div
    className="rounded-xl p-4 flex flex-col justify-between"
    style={{
      background: accent
        ? 'linear-gradient(135deg, #6690cc, #3c5e94)'
        : 'linear-gradient(135deg, #f9fafb, #f3f4f6)',
      border: accent ? 'none' : '1px solid #e5e7eb',
    }}
  >
    <p className="text-xs font-medium mb-2 leading-tight" style={{ color: accent ? 'rgba(255,255,255,0.75)' : '#6b7280' }}>
      {label}
    </p>
    <p
      className="font-bold leading-none"
      style={{
        color: accent ? '#ffffff' : '#161c34',
        fontFamily: 'Poppins, sans-serif',
        fontSize: '22px',
      }}
    >
      {value}
      {unit && (
        <span className="text-sm font-medium ml-1" style={{ color: accent ? 'rgba(255,255,255,0.7)' : '#6b7280' }}>
          {unit}
        </span>
      )}
    </p>
  </div>
);

export default function ExecutiveSummary({
  quoteNumber, systemSizeKw, inverterSizeKw, numModules, areaSquareFt, dailyProductionKwh,
  monthlyProductionKwh, annualProductionKwh, monthlySavingsRs, annualSavingsRs,
  savings30YrRs, breakevenYears, netCost, sanctionedLoadKw,
}: Props) {
  const loadSufficient = sanctionedLoadKw != null ? systemSizeKw <= sanctionedLoadKw : null;
  return (
    <div className="quotation-page flex flex-col" style={{ background: '#ffffff' }}>
      <QuotationHeader quoteNumber={quoteNumber} pageTitle="Executive Summary" pageNumber={5} totalPages={13} />

      <div className="flex-1 px-12 py-6" style={{ paddingBottom: '36px' }}>
        <div className="mb-6">
          <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: '#6690cc' }}>
            At a Glance
          </p>
          <h2
            className="text-2xl font-bold"
            style={{ color: '#161c34', fontFamily: 'Poppins, sans-serif' }}
          >
            {systemSizeKw} kW System — Key Metrics
          </h2>
          <div className="mt-2 h-0.5 w-12" style={{ background: '#6690cc' }} />
        </div>

        {/* System specs */}
        <div className="mb-5">
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#9ca3af' }}>
            System Configuration
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            <Card label="Proposed Solar Plant Capacity" value={String(systemSizeKw)} unit="kW" accent />
            <Card label="Proposed Inverter Capacity" value={String(inverterSizeKw)} unit="kW" />
            <Card label="Solar Modules" value={String(numModules)} unit="Panels" />
            <Card label="Roof Area Required" value={fmt(areaSquareFt)} unit="sq.ft" />
            <Card label="Net System Cost" value={`₹${fmt(netCost)}`} />
          </div>
        </div>

        {/* Production */}
        <div className="mb-5">
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#9ca3af' }}>
            Energy Production (Estimated)
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Card label="Daily Generation" value={String(dailyProductionKwh)} unit="kWh/day" />
            <Card label="Monthly Generation" value={fmt(monthlyProductionKwh)} unit="kWh/mo" accent />
            <Card label="Annual Generation" value={fmt(annualProductionKwh)} unit="kWh/yr" />
          </div>
        </div>

        {/* Savings & ROI */}
        <div className="mb-5">
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#9ca3af' }}>
            Financial Benefits
          </p>
          <div className="grid grid-cols-4 gap-3">
            <Card label="Monthly Savings" value={`₹${fmt(monthlySavingsRs)}`} />
            <Card label="Annual Savings" value={`₹${fmt(annualSavingsRs)}`} accent />
            <Card label="Breakeven Period" value={String(breakevenYears)} unit="Years" />
            <Card label="30-Year Savings" value={`₹${fmt(savings30YrRs)}`} />
          </div>
        </div>

        {/* Sanctioned Load Assessment */}
        {sanctionedLoadKw != null && (
          <div
            className="mb-4 rounded-xl px-5 py-3 flex items-start gap-3"
            style={{
              background: loadSufficient ? '#f0fdf4' : '#fffbeb',
              border: `1px solid ${loadSufficient ? '#bbf7d0' : '#fde68a'}`,
            }}
          >
            <span className="text-lg mt-0.5">{loadSufficient ? '✅' : '⚠️'}</span>
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: loadSufficient ? '#166534' : '#92400e' }}>
                Sanctioned Load Assessment
              </p>
              <div className="grid grid-cols-2 gap-x-8 text-xs" style={{ color: loadSufficient ? '#14532d' : '#78350f' }}>
                <p>Present Sanctioned Load: <strong>{sanctionedLoadKw} kW</strong></p>
                <p>Proposed Solar System: <strong>{systemSizeKw} kW</strong></p>
              </div>
              <p className="text-xs mt-1 font-medium" style={{ color: loadSufficient ? '#15803d' : '#b45309' }}>
                {loadSufficient
                  ? 'The present sanctioned load is sufficient for the proposed solar installation.'
                  : 'The present sanctioned load may need to be increased to support the proposed solar installation.'}
              </p>
            </div>
          </div>
        )}

        {/* Environmental */}
        <div
          className="rounded-2xl px-6 py-4 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #161c34, #1e2f4d)' }}
        >
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: '#6690cc' }}>
              Environmental Impact (Annual)
            </p>
            <p className="text-sm font-medium" style={{ color: '#ffffff' }}>
              CO₂ offset: ~{(annualProductionKwh * 0.82 / 1000).toFixed(2)} tonnes &nbsp;·&nbsp;
              Trees equivalent: ~{Math.round(annualProductionKwh * 0.82 / 21.8)}
            </p>
          </div>
          <span style={{ fontSize: '36px' }}>🌿</span>
        </div>
      </div>

      <QuotationFooter quoteNumber={quoteNumber} pageNumber={5} />
    </div>
  );
}
