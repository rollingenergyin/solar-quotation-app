'use client';

import QuotationHeader from '../QuotationHeader';
import QuotationFooter from '../QuotationFooter';

interface Props {
  quoteNumber: string;
  systemSizeKw: number;
  baseCost: number;
  gstAmount: number;
  totalCost: number;
  subsidyAmount: number;
  netCost: number;
  showSubsidy?: boolean;
  systemType?: 'DCR' | 'NON_DCR';
  siteType?: 'RESIDENTIAL' | 'SOCIETY' | 'COMMERCIAL' | 'INDUSTRIAL';
  pageNumber?: number;
  totalPages?: number;
}

const fmt = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

function siteLabel(siteType?: string) {
  if (siteType === 'SOCIETY') return 'Society / Housing Society';
  if (siteType === 'COMMERCIAL') return 'Commercial';
  if (siteType === 'INDUSTRIAL') return 'Industrial';
  return 'Residential';
}

function subsidySchemeLabel(siteType?: string) {
  if (siteType === 'SOCIETY') return 'PM Surya Ghar — Housing Society Subsidy';
  return 'PM Surya Ghar Muft Bijli Yojana — Residential Subsidy';
}

export default function CostBreakdown({
  quoteNumber, systemSizeKw, baseCost, gstAmount, totalCost, subsidyAmount, netCost,
  showSubsidy = true, systemType = 'DCR', siteType = 'RESIDENTIAL',
  pageNumber = 8, totalPages = 13,
}: Props) {
  const costPerWatt = baseCost / (systemSizeKw * 1000);
  const isDCR = systemType === 'DCR';

  const baseRows = [
    {
      label: 'Base System Cost (Materials + Labour)',
      desc: `${systemSizeKw} kW system — panels, inverter, structure, BOS, installation`,
      amount: baseCost,
      type: 'normal',
    },
    {
      label: 'GST @ 8.9%',
      desc: 'Goods & Services Tax on solar equipment and services',
      amount: gstAmount,
      type: 'tax',
    },
    {
      label: showSubsidy ? 'Total Cost (Pre-Subsidy)' : 'Total Cost (incl. GST)',
      desc: showSubsidy ? 'Gross payable amount before government subsidy' : 'Total payable amount including all taxes',
      amount: totalCost,
      type: 'subtotal',
    },
  ];

  const subsidyRow = showSubsidy ? [{
    label: `${subsidySchemeLabel(siteType)} (Less)`,
    desc: `Central / state government subsidy for ${siteLabel(siteType)} solar installations`,
    amount: -subsidyAmount,
    type: 'discount',
  }] : [];

  const totalRow = [{
    label: 'Net Payable Amount',
    desc: showSubsidy ? 'Final cost after all deductions — this is what you pay' : 'Total cost — this is what you pay',
    amount: netCost,
    type: 'total',
  }];

  const rows = [...baseRows, ...subsidyRow, ...totalRow];

  return (
    <div className="quotation-page flex flex-col" style={{ background: '#ffffff' }}>
      <QuotationHeader quoteNumber={quoteNumber} pageTitle="Offer & Cost Breakdown" pageNumber={pageNumber} totalPages={totalPages} />

      <div className="flex-1 px-12 py-6" style={{ paddingBottom: '36px' }}>
        <div className="mb-6">
          <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: '#6690cc' }}>
            Financial Offer
          </p>
          <h2
            className="text-2xl font-bold"
            style={{ color: '#161c34', fontFamily: 'Poppins, sans-serif' }}
          >
            Detailed Cost Breakdown
          </h2>
          <div className="mt-2 h-0.5 w-12" style={{ background: '#6690cc' }} />
        </div>

        {/* Badges row */}
        <div className="flex items-center gap-4 mb-6">
          <div
            className="rounded-xl px-5 py-3 flex items-center gap-3"
            style={{ background: '#eef3fb', border: '1px solid #d5e3f5' }}
          >
            <span style={{ fontSize: '24px' }}>⚡</span>
            <div>
              <p className="text-xs text-gray-500">Effective Cost per Watt</p>
              <p className="text-xl font-bold" style={{ color: '#161c34', fontFamily: 'Poppins, sans-serif' }}>
                ₹{costPerWatt.toFixed(1)} / Wp
              </p>
            </div>
          </div>
          <div
            className="rounded-xl px-5 py-3 flex items-center gap-3"
            style={{ background: '#eef3fb', border: '1px solid #d5e3f5' }}
          >
            <span style={{ fontSize: '24px' }}>📐</span>
            <div>
              <p className="text-xs text-gray-500">System Capacity</p>
              <p className="text-xl font-bold" style={{ color: '#161c34', fontFamily: 'Poppins, sans-serif' }}>
                {systemSizeKw} kW
              </p>
            </div>
          </div>
          {/* System type badge */}
          <div
            className="rounded-xl px-5 py-3 flex items-center gap-3"
            style={{
              background: isDCR ? '#dcfce7' : '#fef3c7',
              border: `1px solid ${isDCR ? '#bbf7d0' : '#fde68a'}`,
            }}
          >
            <span style={{ fontSize: '24px' }}>{isDCR ? '🏛️' : '🏭'}</span>
            <div>
              <p className="text-xs text-gray-500">System Type</p>
              <p className="text-sm font-bold" style={{ color: isDCR ? '#15803d' : '#92400e', fontFamily: 'Poppins, sans-serif' }}>
                {isDCR ? 'DCR System' : 'Non-DCR System'}
              </p>
              <p className="text-xs" style={{ color: isDCR ? '#16a34a' : '#b45309' }}>
                {siteLabel(siteType)}
              </p>
            </div>
          </div>
        </div>

        {/* Cost table */}
        <div className="quotation-no-break rounded-2xl overflow-hidden mb-6" style={{ border: '1px solid #e5e7eb' }}>
          {rows.map((row) => {
            const isTotal  = row.type === 'total';
            const isSubtot = row.type === 'subtotal';
            const isDisc   = row.type === 'discount';

            return (
              <div
                key={row.label}
                className="flex items-center justify-between px-6 py-4"
                style={{
                  background: isTotal   ? 'linear-gradient(135deg, #161c34, #2c4570)'
                             : isSubtot ? '#f0f4fb'
                             : isDisc   ? '#f0fdf4'
                             : '#ffffff',
                  borderBottom: isTotal ? 'none' : '1px solid #f3f4f6',
                }}
              >
                <div>
                  <p
                    className="text-sm font-semibold leading-tight"
                    style={{
                      color: isTotal ? '#ffffff' : isDisc ? '#16a34a' : '#161c34',
                      fontFamily: 'Poppins, sans-serif',
                    }}
                  >
                    {row.label}
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: isTotal ? 'rgba(255,255,255,0.6)' : '#9ca3af' }}
                  >
                    {row.desc}
                  </p>
                </div>
                <p
                  className="text-lg font-bold flex-shrink-0 ml-4"
                  style={{
                    color: isTotal   ? '#6690cc'
                         : isDisc    ? '#16a34a'
                         : isSubtot  ? '#161c34'
                         : '#374151',
                    fontFamily: 'Poppins, sans-serif',
                  }}
                >
                  {row.amount < 0 ? `− ${fmt(-row.amount)}` : fmt(row.amount)}
                </p>
              </div>
            );
          })}
        </div>

        {/* Conditional bottom note */}
        {showSubsidy ? (
          <div
            className="rounded-xl px-5 py-4 flex items-start gap-3"
            style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}
          >
            <span style={{ fontSize: '20px' }}>🏛️</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#15803d' }}>
                {subsidySchemeLabel(siteType)} — Eligibility
              </p>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                Your system qualifies for a government subsidy of{' '}
                <strong>{fmt(subsidyAmount)}</strong> directly disbursed to your bank account after commissioning.
                Rolling Energy handles all subsidy paperwork, DISCOM coordination, and documentation
                end-to-end at no additional charge.
              </p>
            </div>
          </div>
        ) : (
          <div
            className="rounded-xl px-5 py-4 flex items-start gap-3"
            style={{ background: '#fef3c7', border: '1px solid #fde68a' }}
          >
            <span style={{ fontSize: '20px' }}>💡</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#92400e' }}>
                {systemType === 'NON_DCR' ? 'Non-DCR System — No Government Subsidy' : 'Commercial Installation — No Direct Subsidy'}
              </p>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                {systemType === 'NON_DCR'
                  ? 'Non-DCR (non-domestic content requirement) systems do not qualify for PM Surya Ghar subsidies. However, this system may qualify for accelerated depreciation benefits — see the Depreciation page for details.'
                  : 'Commercial solar installations do not qualify for direct PM Surya Ghar subsidies. However, significant savings through net metering and potential depreciation benefits are available.'}
              </p>
            </div>
          </div>
        )}
      </div>

      <QuotationFooter quoteNumber={quoteNumber} pageNumber={pageNumber} />
    </div>
  );
}
