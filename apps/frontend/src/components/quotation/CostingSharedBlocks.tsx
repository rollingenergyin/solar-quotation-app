'use client';

import type { TemplateConfig } from '@/types/quotation-template';
import { resolveBankDetails } from '@/types/quotation-template';
import type { CostingOptionCalculated } from '@/constants/costing-options';

const fmt = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

function siteLabel(siteType?: string) {
  if (siteType === 'SOCIETY') return 'Society / Housing Society';
  if (siteType === 'COMMERCIAL') return 'Commercial';
  if (siteType === 'INDUSTRIAL') return 'Industrial';
  return 'Residential';
}

export type CostingBlockLayout = 'normal' | 'compact' | 'paired';

/** Scale title block flex + typography from option title length. */
function getCostingTitleLayout(displayTitle: string, layout: CostingBlockLayout) {
  const len = displayTitle.length;

  if (layout === 'paired') {
    return {
      flexGrow: Math.min(6, Math.max(1.5, 1.1 + len * 0.12)),
      minWidthCh: Math.min(18, Math.max(8, len * 0.45 + 3.5)),
      titleFontClass: len > 26 ? 'text-base' : len > 16 ? 'text-lg' : 'text-xl',
    };
  }

  const compact = layout === 'compact';
  const flexGrow = Math.min(8, Math.max(2, 1.25 + len * 0.14));
  const minWidthCh = Math.min(compact ? 16 : 22, Math.max(compact ? 9 : 12, len * 0.52 + 4));

  let titleFontClass: string;
  if (layout === 'compact') {
    if (len > 30) titleFontClass = 'text-base';
    else if (len > 20) titleFontClass = 'text-lg';
    else titleFontClass = 'text-xl';
  } else {
    if (len > 38) titleFontClass = 'text-lg';
    else if (len > 26) titleFontClass = 'text-xl';
    else titleFontClass = 'text-2xl';
  }

  return { flexGrow, minWidthCh, titleFontClass };
}

const metricSideBoxStyle = (layout: CostingBlockLayout, minRem: number) => ({
  flex: layout === 'paired' ? '1 1 auto' : layout === 'compact' ? '1 1 auto' : '1 1 auto',
  minWidth:
    layout === 'paired'
      ? `${minRem}rem`
      : layout === 'compact'
        ? `${minRem * 0.85}rem`
        : `${minRem}rem`,
  maxWidth:
    layout === 'paired'
      ? `${minRem * 1.4}rem`
      : layout === 'compact'
        ? `${minRem * 1.35}rem`
        : `${minRem * 1.5}rem`,
});

const metricSideBoxCls = (layout: CostingBlockLayout) =>
  `rounded-xl flex items-center gap-2.5 shrink-0 ${
    layout === 'paired' ? 'px-4 py-3' : layout === 'compact' ? 'px-3.5 py-3' : 'px-5 py-4'
  }`;

export function subsidySchemeLabel(siteType?: string) {
  if (siteType === 'SOCIETY') return 'PM Surya Ghar — Housing Society Subsidy';
  return 'PM Surya Ghar Muft Bijli Yojana — Residential Subsidy';
}

export function getNoSubsidyBenefitsNote(opts: {
  systemType: string;
  siteType?: string;
}): {
  icon: string;
  title: string;
  body: string;
  positive: boolean;
} {
  const { systemType, siteType } = opts;
  const isCommercial = siteType === 'COMMERCIAL';
  const isIndustrial = siteType === 'INDUSTRIAL';

  if (isCommercial || isIndustrial) {
    return {
      icon: '⚡',
      title: isIndustrial ? 'Industrial-Scale Solar Advantage' : 'Strong Returns for Your Business',
      body: isIndustrial
        ? 'On-site solar lowers your per-unit energy cost and reduces exposure to rising industrial tariffs. Net metering credits surplus generation to your account, and accelerated depreciation can strengthen your payback — see the Depreciation page.'
        : 'Solar cuts operating costs from day one, with net metering turning surplus generation into bill credits. Accelerated depreciation can make your effective investment even more attractive — see the Depreciation page.',
      positive: true,
    };
  }

  return {
    icon: '💡',
    title: 'Non-DCR System — Depreciation Benefits',
    body:
      systemType === 'NON_DCR'
        ? 'While PM Surya Ghar subsidy does not apply to Non-DCR systems, accelerated depreciation benefits may apply for eligible use — see the Depreciation page for details.'
        : 'Accelerated depreciation and long-term energy savings can make this a strong financial decision — see the Depreciation page for indicative benefits.',
    positive: false,
  };
}

/** Separate title box for a costing option (distinct from Effective Cost per Watt). */
export function CostingOptionTitleBox({
  index,
  title,
  layout = 'normal',
  className = '',
}: {
  index: number;
  title: string;
  layout?: CostingBlockLayout;
  className?: string;
}) {
  const displayTitle = title.trim() || `Option ${index}`;
  const { flexGrow, minWidthCh, titleFontClass } = getCostingTitleLayout(displayTitle, layout);

  return (
    <div
      className={`rounded-xl flex items-center gap-2.5 quotation-no-break ${
        layout === 'paired' ? 'px-5 py-3' : layout === 'compact' ? 'px-4 py-2.5' : 'px-6 py-4'
      } ${className}`}
      style={{
        background: 'linear-gradient(135deg, #161c34, #2c4570)',
        border: '1px solid #1e2f4d',
        flex: `${flexGrow} 1 auto`,
        minWidth: `${minWidthCh}ch`,
        maxWidth: '100%',
      }}
    >
      <span
        className="shrink-0"
        style={{ fontSize: layout === 'paired' ? '24px' : layout === 'compact' ? '24px' : '28px' }}
      >
        🏷️
      </span>
      <div className="min-w-0">
        <p
          className="whitespace-nowrap text-sm"
          style={{ color: 'rgba(255,255,255,0.65)' }}
        >
          Costing Option {index}
        </p>
        <p
          className={`font-bold whitespace-nowrap ${titleFontClass}`}
          style={{ color: '#ffffff', fontFamily: 'Poppins, sans-serif' }}
        >
          {displayTitle}
        </p>
      </div>
    </div>
  );
}

export function OrSeparator({ layout = 'normal' }: { layout?: CostingBlockLayout }) {
  const circleCls =
    layout === 'paired'
      ? 'w-16 h-16 text-xl mx-5'
      : layout === 'compact'
        ? 'w-14 h-14 text-xl mx-4'
        : 'w-20 h-20 text-2xl mx-6';

  return (
    <div
      className={`quotation-no-break flex items-center justify-center ${
        layout === 'normal' ? 'my-4' : 'mt-2 mb-4'
      }`}
      aria-label="Alternative option separator"
    >
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, #6690cc)' }} />
      <div
        className={`flex items-center justify-center rounded-full font-bold tracking-widest ${circleCls}`}
        style={{
          color: '#ffffff',
          background: 'linear-gradient(135deg, #161c34, #6690cc)',
          fontFamily: 'Poppins, sans-serif',
          boxShadow: '0 4px 14px rgba(102,144,204,0.35)',
        }}
      >
        OR
      </div>
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #6690cc, transparent)' }} />
    </div>
  );
}

export function PmSuryaGharNote({
  option,
  compact = false,
}: {
  option: CostingOptionCalculated;
  compact?: boolean;
}) {
  if (option.showSubsidy) {
    return (
      <div
        className={`rounded-xl flex items-start gap-3 quotation-no-break ${compact ? 'px-4 py-3' : 'px-5 py-4'}`}
        style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}
      >
        <span style={{ fontSize: compact ? '16px' : '20px' }}>🏛️</span>
        <div>
          <p className={`font-semibold ${compact ? 'text-xs' : 'text-sm'}`} style={{ color: '#15803d' }}>
            {subsidySchemeLabel(option.siteType)} — Eligibility
          </p>
          <p className={`text-gray-600 mt-1 leading-relaxed ${compact ? 'text-[10px]' : 'text-xs'}`}>
            Your system qualifies for a government subsidy of{' '}
            <strong>{fmt(option.subsidyAmount)}</strong> directly disbursed to your bank account after commissioning.
            Rolling Energy handles all subsidy paperwork, DISCOM coordination, and documentation
            end-to-end at no additional charge.
          </p>
          {!compact && (
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">
              The subsidy shown is based on the current scheme. At the time of commissioning, Rolling Energy
              will facilitate the subsidy application process for whichever government subsidy scheme is
              available and applicable, subject to prevailing regulations and eligibility.
            </p>
          )}
        </div>
      </div>
    );
  }

  const note = getNoSubsidyBenefitsNote({
    systemType: option.systemType,
    siteType: option.siteType,
  });

  return (
    <div
      className={`rounded-xl flex items-start gap-3 quotation-no-break ${compact ? 'px-4 py-3' : 'px-5 py-4'}`}
      style={
        note.positive
          ? { background: '#eef3fb', border: '1px solid #d5e3f5' }
          : { background: '#fef3c7', border: '1px solid #fde68a' }
      }
    >
      <span style={{ fontSize: compact ? '16px' : '20px' }}>{note.icon}</span>
      <div>
        <p
          className={`font-semibold ${compact ? 'text-xs' : 'text-sm'}`}
          style={{ color: note.positive ? '#2c4570' : '#92400e' }}
        >
          {note.title}
        </p>
        <p className={`text-gray-600 mt-1 leading-relaxed ${compact ? 'text-[10px]' : 'text-xs'}`}>
          {note.body}
        </p>
      </div>
    </div>
  );
}

export function BankDetailsBlock({
  config,
  compact = false,
  className = '',
}: {
  config?: TemplateConfig | null;
  compact?: boolean;
  className?: string;
}) {
  const bank = resolveBankDetails(config);
  const labelCls = compact ? 'text-[10px]' : 'text-[11px]';
  const valueCls = `font-semibold leading-snug ${compact ? 'text-[11px]' : 'text-xs'}`;
  const fieldGap = 'space-y-1.5';

  const Field = ({ label, value, tabular = false }: { label: string; value: string; tabular?: boolean }) => (
    <div>
      <p className={`${labelCls} text-gray-500 mb-0.5`}>{label}</p>
      <p
        className={`${valueCls}${tabular ? ' tabular-nums' : ''}`}
        style={{ color: '#161c34' }}
      >
        {value}
      </p>
    </div>
  );

  return (
    <div
      className={`rounded-lg border quotation-no-break ${compact ? 'px-3 py-2' : 'px-4 py-2'} ${className}`}
      style={{ borderColor: '#6690cc', background: 'linear-gradient(135deg, #f0f4ff, #ffffff)' }}
    >
      <p
        className={`font-semibold tracking-widest uppercase ${compact ? 'text-[10px] mb-1' : 'text-xs mb-1.5'}`}
        style={{ color: '#6690cc' }}
      >
        Bank Details
      </p>

      <div className={`grid grid-cols-[minmax(0,7fr)_minmax(0,3fr)] gap-x-5 items-start`}>
        <div className={fieldGap}>
          <Field label="Account Name" value={bank.accountName} />
          <Field label="Account Number" value={bank.accountNumber} tabular />
          <Field label="Bank Name" value={bank.bankName} />
        </div>
        <div className={fieldGap}>
          <Field label="Account Type" value={bank.accountType} />
          <Field label="IFSC Code" value={bank.ifscCode} tabular />
        </div>
      </div>
    </div>
  );
}

export function CostingOptionBlock({
  option,
  layout = 'normal',
  showOptionTitle = false,
}: {
  option: CostingOptionCalculated;
  layout?: CostingBlockLayout;
  showOptionTitle?: boolean;
}) {
  const costPerWatt = option.baseCost / (option.systemSizeKw * 1000);

  const baseRows = [
    {
      label: 'Base System Cost (Materials + Labour)',
      desc: `Cost per watt — ₹${costPerWatt.toFixed(1)} / Wp`,
      amount: option.baseCost,
      type: 'normal',
    },
    {
      label: 'GST @ 8.9%',
      desc: 'Goods & Services Tax on solar equipment and services',
      amount: option.gstAmount,
      type: 'tax',
    },
    {
      label: option.showSubsidy ? 'Total Cost (Pre-Subsidy)' : 'Total Cost (incl. GST)',
      desc: option.showSubsidy
        ? 'Amount payable to Rolling Energy'
        : 'Total payable amount including all taxes',
      amount: option.grossCost,
      type: 'payable',
    },
  ];

  const subsidyRow = option.showSubsidy
    ? [{
        label: `${subsidySchemeLabel(option.siteType)} (Less)`,
        desc: `Central / state government subsidy for ${siteLabel(option.siteType)} solar installations`,
        amount: -option.subsidyAmount,
        type: 'discount',
      }]
    : [];

  const effectiveRow = option.showSubsidy
    ? [{
        label: 'Effective Cost (After Subsidy)',
        desc: 'Your net cost once the government subsidy is credited to your bank account',
        amount: option.netCost,
        type: 'effective',
      }]
    : [];

  const rows = [...baseRows, ...subsidyRow, ...effectiveRow];
  const showRowDesc = layout === 'normal' || layout === 'paired';

  return (
    <div className={`quotation-no-break ${layout === 'paired' ? 'flex flex-col flex-1 min-h-0' : ''}`}>
      <div
        className={`flex items-stretch flex-nowrap gap-2.5 ${
          layout === 'paired' ? 'mb-2' : layout === 'compact' ? 'mb-2' : 'mb-5 gap-3'
        }`}
      >
        {showOptionTitle && (
          <CostingOptionTitleBox
            index={option.index}
            title={option.title}
            layout={layout}
          />
        )}
        <div
          className={metricSideBoxCls(layout)}
          style={{
            background: '#eef3fb',
            border: '1px solid #d5e3f5',
            ...(showOptionTitle
              ? metricSideBoxStyle(layout, layout === 'paired' ? 7.5 : layout === 'compact' ? 8.5 : 8.5)
              : { flex: '0 0 auto' }),
          }}
        >
          <span
            className="shrink-0"
            style={{ fontSize: layout === 'paired' ? '24px' : layout === 'compact' ? '24px' : '28px' }}
          >
            📐
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-gray-500 leading-tight text-sm">
              {showOptionTitle ? 'Capacity' : 'System Capacity'}
            </p>
            <p
              className={`font-bold leading-tight whitespace-nowrap ${
                layout === 'paired' ? 'text-xl' : layout === 'compact' ? 'text-lg' : 'text-xl'
              }`}
              style={{ color: '#161c34', fontFamily: 'Poppins, sans-serif' }}
            >
              {option.systemSizeKw} kW
            </p>
          </div>
        </div>
      </div>

      <div
        className={`quotation-no-break rounded-2xl overflow-hidden ${
          layout === 'paired' ? 'flex flex-col flex-1' : layout === 'compact' ? 'mb-3' : 'mb-5'
        }`}
        style={{ border: '1px solid #e5e7eb' }}
      >
        {rows.map((row, idx) => {
          const isPayable = row.type === 'payable';
          const isEffective = row.type === 'effective';
          const isDisc = row.type === 'discount';
          const isLast = idx === rows.length - 1;

          return (
            <div
              key={row.label}
              className={`flex items-center justify-between ${
                layout === 'paired'
                  ? 'flex-1 px-5 py-3'
                  : layout === 'compact'
                    ? 'px-4 py-2.5'
                    : 'px-6 py-4'
              }`}
              style={{
                background: isPayable ? '#eef3fb' : isDisc ? '#f0fdf4' : isEffective ? '#f9fafb' : '#ffffff',
                borderBottom: isLast ? 'none' : '1px solid #f3f4f6',
                borderTop: isPayable ? '2px solid #6690cc' : undefined,
              }}
            >
              <div className="min-w-0 pr-3">
                <p
                  className="font-semibold leading-tight text-sm"
                  style={{
                    color: isDisc ? '#16a34a' : isPayable ? '#2c4570' : '#161c34',
                    fontFamily: 'Poppins, sans-serif',
                  }}
                >
                  {row.label}
                </p>
                {showRowDesc && (
                  <p
                    className="mt-0.5 leading-snug text-xs"
                    style={{ color: '#9ca3af' }}
                  >
                    {row.desc}
                  </p>
                )}
              </div>
              <p
                className={`font-bold flex-shrink-0 ${
                  layout === 'paired' ? 'text-lg' : layout === 'compact' ? 'text-base' : 'text-lg'
                }`}
                style={{
                  color: isPayable ? '#6690cc' : isDisc ? '#16a34a' : '#161c34',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                {row.amount < 0 ? `− ${fmt(-row.amount)}` : fmt(row.amount)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
