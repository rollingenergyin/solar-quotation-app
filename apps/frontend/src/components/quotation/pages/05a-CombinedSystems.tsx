'use client';

import QuotationHeader from '../QuotationHeader';
import QuotationFooter from '../QuotationFooter';
import ProposalNoteBlock from '../ProposalNoteBlock';
import type { CombinedSystemCalculated } from '@/constants/combined-quotation';
import type { ProposalNote } from '@/constants/proposal-note';

interface Props {
  quoteNumber: string;
  systems: CombinedSystemCalculated[];
  showSubsidy: boolean;
  pageNumber: number;
  totalPages: number;
  systemIndices?: number[];
  continuation?: boolean;
  proposalNote?: ProposalNote | null;
  showProposalNote?: boolean;
  singleCosting?: boolean;
}

const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fmtL = (n: number) => `₹${fmt(n)}`;

function MetricRow({
  label,
  value,
  highlight,
  accent,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm leading-snug">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span
        className={`font-semibold text-right tabular-nums ${highlight ? '' : ''}`}
        style={{ color: highlight ? '#6690cc' : accent ? '#161c34' : '#111827' }}
      >
        {value}
      </span>
    </div>
  );
}

function ColumnHeading({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <p
      className="text-xs font-bold uppercase tracking-wider mb-2 pb-1.5 border-b"
      style={{
        color: accent ? '#6690cc' : '#9ca3af',
        borderColor: accent ? 'rgba(102,144,204,0.25)' : '#f3f4f6',
      }}
    >
      {children}
    </p>
  );
}

function GenerationSavingsColumn({
  dailyProductionKwh,
  annualProductionKwh,
  annualSavings,
  breakevenYears,
  savings30YrRs,
  accent,
}: {
  dailyProductionKwh: number;
  annualProductionKwh: number;
  annualSavings: number;
  breakevenYears: number;
  savings30YrRs: number;
  accent?: boolean;
}) {
  return (
    <div>
      <ColumnHeading accent={accent}>Generation &amp; Savings</ColumnHeading>
      <MetricRow label="Daily Generation" value={`${dailyProductionKwh} kWh`} accent={accent} />
      <MetricRow label="Annual Generation" value={`${fmt(annualProductionKwh)} kWh`} accent={accent} />
      <div className="mt-2 pt-2 border-t" style={{ borderColor: accent ? 'rgba(102,144,204,0.2)' : '#f3f4f6' }}>
        <MetricRow label="Annual Savings" value={fmtL(annualSavings)} highlight accent={accent} />
        <MetricRow label="Breakeven Point" value={`${breakevenYears} Years`} accent={accent} />
        <MetricRow label="30-Year Savings" value={fmtL(savings30YrRs)} highlight accent={accent} />
      </div>
    </div>
  );
}

function SystemDetailBlock({ sys }: { sys: CombinedSystemCalculated }) {
  return (
    <div
      className="rounded-lg border quotation-no-break px-5 py-4 mb-3.5"
      style={{ borderColor: '#e5e7eb', background: '#ffffff' }}
    >
      <h3
        className="text-sm font-bold mb-2.5 leading-tight"
        style={{ color: '#374151', fontFamily: 'Poppins, sans-serif' }}
      >
        Section {sys.index} — {sys.displayName}
      </h3>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <ColumnHeading>System Details</ColumnHeading>
          <MetricRow label="Capacity" value={`${sys.systemSizeKw} kW`} accent />
          {sys.consumerNumber && (
            <MetricRow label="Consumer No." value={sys.consumerNumber} accent />
          )}
          <div className="grid grid-cols-1 gap-y-1 text-sm mt-1">
            <span className="text-gray-500 text-[11px]">
              Connection: <strong className="text-gray-800">{sys.siteTypeLabel}</strong>
            </span>
            <span className="text-gray-500 text-[11px]">
              Meter Phase: <strong className="text-gray-800">{sys.meterPhaseLabel}</strong>
            </span>
          </div>

          {(sys.sanctionedLoadKw != null || sys.sanctionedLoadIncreasedToKw != null) && (
            <div
              className="mt-2.5 rounded-lg px-3 py-2 border text-[11px] leading-snug"
              style={{
                borderColor:
                  sys.sanctionedLoadKw != null && sys.systemSizeKw > sys.sanctionedLoadKw ? '#fde68a' : '#bbf7d0',
                background:
                  sys.sanctionedLoadKw != null && sys.systemSizeKw > sys.sanctionedLoadKw ? '#fffbeb' : '#f0fdf4',
              }}
            >
              <p className="font-semibold mb-1" style={{ color: '#334155' }}>Sanctioned Load</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-gray-600">
                {sys.sanctionedLoadKw != null && (
                  <span>
                    Present: <strong className="text-gray-800">{sys.sanctionedLoadKw} kW</strong>
                  </span>
                )}
                <span>
                  Proposed: <strong className="text-gray-800">{sys.systemSizeKw} kW</strong>
                </span>
                {sys.sanctionedLoadIncreasedToKw != null && (
                  <span className="col-span-2">
                    To be increased to:{' '}
                    <strong className="text-gray-800">{sys.sanctionedLoadIncreasedToKw} kW</strong>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <GenerationSavingsColumn
          dailyProductionKwh={sys.dailyProductionKwh}
          annualProductionKwh={sys.annualProductionKwh}
          annualSavings={sys.annualSavings}
          breakevenYears={sys.breakevenYears}
          savings30YrRs={sys.savings30YrRs}
        />
      </div>
    </div>
  );
}

function PricingBlock({
  title,
  systemSizeKw,
  pricePerWatt,
  baseCost,
  gstAmount,
  grossCost,
  subsidyAmount,
  netCost,
  dailyProductionKwh,
  annualProductionKwh,
  annualSavings,
  breakevenYears,
  savings30YrRs,
  showSubsidy,
  siteTypeLabel,
  meterPhaseLabel,
  sanctionedLoadKw,
  sanctionedLoadIncreasedToKw,
  accent,
}: {
  title: string;
  systemSizeKw: number;
  pricePerWatt: number;
  baseCost: number;
  gstAmount: number;
  grossCost: number;
  subsidyAmount: number;
  netCost: number;
  dailyProductionKwh: number;
  annualProductionKwh: number;
  annualSavings: number;
  breakevenYears: number;
  savings30YrRs: number;
  showSubsidy: boolean;
  siteTypeLabel?: string;
  meterPhaseLabel?: string;
  sanctionedLoadKw?: number | null;
  sanctionedLoadIncreasedToKw?: number | null;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-lg border quotation-no-break px-5 py-4 mb-3.5"
      style={{
        borderColor: accent ? '#6690cc' : '#e5e7eb',
        background: accent ? 'linear-gradient(135deg, #f0f4ff, #ffffff)' : '#ffffff',
      }}
    >
      <h3
        className="text-sm font-bold mb-2.5 leading-tight"
        style={{ color: accent ? '#161c34' : '#374151', fontFamily: 'Poppins, sans-serif' }}
      >
        {title}
      </h3>

      {siteTypeLabel && meterPhaseLabel && (
        <div className="mb-2.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] leading-snug">
          <span className="text-gray-500">
            Connection: <strong className="text-gray-800">{siteTypeLabel}</strong>
          </span>
          <span className="text-gray-500">
            Meter Phase: <strong className="text-gray-800">{meterPhaseLabel}</strong>
          </span>
        </div>
      )}

      {(sanctionedLoadKw != null || sanctionedLoadIncreasedToKw != null) && (
        <div
          className="mb-2.5 rounded-lg px-3 py-2 border text-[11px] leading-snug"
          style={{
            borderColor:
              sanctionedLoadKw != null && systemSizeKw > sanctionedLoadKw ? '#fde68a' : '#bbf7d0',
            background:
              sanctionedLoadKw != null && systemSizeKw > sanctionedLoadKw ? '#fffbeb' : '#f0fdf4',
          }}
        >
          <p className="font-semibold mb-1" style={{ color: '#334155' }}>
            Sanctioned Load
            {sanctionedLoadKw != null && (
              <span className="ml-1.5">{systemSizeKw > sanctionedLoadKw ? '⚠️' : '✅'}</span>
            )}
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-gray-600">
            {sanctionedLoadKw != null && (
              <span>
                Present: <strong className="text-gray-800">{sanctionedLoadKw} kW</strong>
              </span>
            )}
            <span>
              Proposed: <strong className="text-gray-800">{systemSizeKw} kW</strong>
            </span>
            {sanctionedLoadIncreasedToKw != null && (
              <span className="col-span-2">
                To be increased to:{' '}
                <strong className="text-gray-800">{sanctionedLoadIncreasedToKw} kW</strong>
              </span>
            )}
          </div>
          {sanctionedLoadKw != null && (
            <p
              className="mt-1 font-medium"
              style={{ color: systemSizeKw > sanctionedLoadKw ? '#b45309' : '#15803d' }}
            >
              {systemSizeKw > sanctionedLoadKw
                ? 'Present sanctioned load may need to be increased for this system.'
                : 'Present sanctioned load is sufficient for this system.'}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Left: pricing & subsidy */}
        <div>
          <ColumnHeading accent={accent}>Pricing &amp; Subsidy</ColumnHeading>
          <MetricRow label="Capacity" value={`${systemSizeKw} kW`} accent={accent} />
          <MetricRow label="Price / W" value={`₹${pricePerWatt.toFixed(2)}`} accent={accent} />
          <MetricRow label="Base Cost" value={fmtL(baseCost)} accent={accent} />
          <MetricRow label="GST (8.9%)" value={fmtL(gstAmount)} accent={accent} />
          <MetricRow
            label={showSubsidy ? 'Total Cost (Pre-Subsidy)' : 'Total Cost (incl. GST)'}
            value={fmtL(grossCost)}
            highlight
            accent={accent}
          />
          {showSubsidy && (
            <>
              <MetricRow label="Subsidy (Less)" value={`− ${fmtL(subsidyAmount)}`} accent={accent} />
              <div className="mt-2 pt-2 border-t" style={{ borderColor: accent ? 'rgba(102,144,204,0.2)' : '#f3f4f6' }}>
                <MetricRow
                  label="Effective Cost (After Subsidy)"
                  value={fmtL(netCost)}
                  accent={accent}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1 leading-snug">
                Payable to Rolling Energy: total pre-subsidy amount. Subsidy is disbursed to you after commissioning.
              </p>
            </>
          )}
        </div>

        {/* Right: generation & savings */}
        <GenerationSavingsColumn
          dailyProductionKwh={dailyProductionKwh}
          annualProductionKwh={annualProductionKwh}
          annualSavings={annualSavings}
          breakevenYears={breakevenYears}
          savings30YrRs={savings30YrRs}
          accent={accent}
        />
      </div>
    </div>
  );
}

export default function CombinedSystemsPage({
  quoteNumber,
  systems,
  showSubsidy,
  pageNumber,
  totalPages,
  systemIndices,
  continuation = false,
  proposalNote,
  showProposalNote = true,
  singleCosting = false,
}: Props) {
  const indices = systemIndices ?? systems.map((_, i) => i);
  const pageSystems = indices.map((i) => systems[i]).filter(Boolean);

  const pageTitle = singleCosting
    ? 'System Details'
    : continuation
      ? 'Combined Systems (continued)'
      : 'Combined Systems';

  return (
    <div className="quotation-page flex flex-col" style={{ background: '#ffffff' }}>
      <QuotationHeader
        quoteNumber={quoteNumber}
        pageTitle={pageTitle}
        pageNumber={pageNumber}
        totalPages={totalPages}
      />

      <div className="flex-1 px-10 py-5" style={{ paddingBottom: '44px' }}>
        {!continuation && (
          <div className="mb-4">
            <h2 className="text-xl font-bold leading-tight" style={{ color: '#161c34', fontFamily: 'Poppins, sans-serif' }}>
              {singleCosting ? 'System Details' : 'Combined System-wise Pricing'}
            </h2>
            <div className="mt-1.5 h-0.5 w-10" style={{ background: '#6690cc' }} />
            {singleCosting && (
              <p className="text-xs text-gray-500 mt-2">
                Multiple systems documented separately with generation and savings per system. Commercial pricing is shown on the Cost Breakdown page.
              </p>
            )}
          </div>
        )}

        {continuation && (
          <p className="text-xs text-gray-500 mb-2">
            {singleCosting ? 'System details (continued)' : 'Combined systems pricing (continued)'}
          </p>
        )}

        {singleCosting ? (
          pageSystems.map((sys) => <SystemDetailBlock key={sys.index} sys={sys} />)
        ) : (
          pageSystems.map((sys) => (
            <PricingBlock
              key={sys.index}
              title={`Section ${sys.index} — ${sys.displayName}`}
              systemSizeKw={sys.systemSizeKw}
              pricePerWatt={sys.pricePerWatt}
              baseCost={sys.baseCost}
              gstAmount={sys.gstAmount}
              grossCost={sys.grossCost}
              subsidyAmount={sys.subsidyAmount}
              netCost={sys.netCost}
              dailyProductionKwh={sys.dailyProductionKwh}
              annualProductionKwh={sys.annualProductionKwh}
              annualSavings={sys.annualSavings}
              breakevenYears={sys.breakevenYears}
              savings30YrRs={sys.savings30YrRs}
              showSubsidy={showSubsidy}
              siteTypeLabel={sys.siteTypeLabel}
              meterPhaseLabel={sys.meterPhaseLabel}
              sanctionedLoadKw={sys.sanctionedLoadKw}
              sanctionedLoadIncreasedToKw={sys.sanctionedLoadIncreasedToKw}
            />
          ))
        )}

        {showProposalNote && (
          <ProposalNoteBlock placement="combined_systems" proposalNote={proposalNote} />
        )}
      </div>

      <QuotationFooter quoteNumber={quoteNumber} pageNumber={pageNumber} />
    </div>
  );
}
