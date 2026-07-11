'use client';

import QuotationHeader from '../QuotationHeader';
import QuotationFooter from '../QuotationFooter';
import ProposalNoteBlock from '../ProposalNoteBlock';
import type { TemplateConfig } from '../../../types/quotation-template';
import { getNoSubsidyBenefitsNote } from '../CostingSharedBlocks';
import type { ProposalNote } from '@/constants/proposal-note';

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
  config?: TemplateConfig | null;
  pageNumber?: number;
  totalPages?: number;
  proposalNote?: ProposalNote | null;
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
  showSubsidy = true, systemType = 'DCR', siteType = 'RESIDENTIAL', config,
  pageNumber = 8, totalPages = 13, proposalNote,
}: Props) {
  const costPerWatt = baseCost / (systemSizeKw * 1000);
  const noSubsidyNote = !showSubsidy
    ? getNoSubsidyBenefitsNote({ systemType, siteType })
    : null;

  const baseRows = [
    {
      label: 'Base System Cost (Materials + Labour)',
      desc: `Cost per watt — ₹${costPerWatt.toFixed(1)} / Wp`,
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
      desc: showSubsidy
        ? 'Amount payable to Rolling Energy'
        : 'Total payable amount including all taxes',
      amount: totalCost,
      type: 'payable',
    },
  ];

  const subsidyRow = showSubsidy ? [{
    label: `${subsidySchemeLabel(siteType)} (Less)`,
    desc: `Central / state government subsidy for ${siteLabel(siteType)} solar installations`,
    amount: -subsidyAmount,
    type: 'discount',
  }] : [];

  const effectiveRow = showSubsidy ? [{
    label: 'Effective Cost (After Subsidy)',
    desc: 'Your net cost once the government subsidy is credited to your bank account',
    amount: netCost,
    type: 'effective',
  }] : [];

  const rows = [...baseRows, ...subsidyRow, ...effectiveRow];

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
            <span style={{ fontSize: '24px' }}>📐</span>
            <div>
              <p className="text-xs text-gray-500">System Capacity</p>
              <p className="text-xl font-bold" style={{ color: '#161c34', fontFamily: 'Poppins, sans-serif' }}>
                {systemSizeKw} kW
              </p>
            </div>
          </div>
        </div>

        {/* Cost table */}
        <div className="quotation-no-break rounded-2xl overflow-hidden mb-6" style={{ border: '1px solid #e5e7eb' }}>
          {rows.map((row, idx) => {
            const isPayable   = row.type === 'payable';
            const isEffective = row.type === 'effective';
            const isDisc      = row.type === 'discount';
            const isLast      = idx === rows.length - 1;

            return (
              <div
                key={row.label}
                className="flex items-center justify-between px-6 py-4"
                style={{
                  background: isPayable   ? '#eef3fb'
                             : isDisc    ? '#f0fdf4'
                             : isEffective ? '#f9fafb'
                             : '#ffffff',
                  borderBottom: isLast ? 'none' : '1px solid #f3f4f6',
                  borderTop: isPayable ? '2px solid #6690cc' : undefined,
                }}
              >
                <div>
                  <p
                    className="text-sm font-semibold leading-tight"
                    style={{
                      color: isDisc ? '#16a34a' : isPayable ? '#2c4570' : '#161c34',
                      fontFamily: 'Poppins, sans-serif',
                    }}
                  >
                    {row.label}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                    {row.desc}
                  </p>
                </div>
                <p
                  className="text-lg font-bold flex-shrink-0 ml-4"
                  style={{
                    color: isPayable ? '#6690cc'
                         : isDisc    ? '#16a34a'
                         : '#161c34',
                    fontFamily: 'Poppins, sans-serif',
                    fontSize: isPayable ? '20px' : undefined,
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
              <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                The subsidy shown is based on the current scheme. At the time of commissioning, Rolling Energy
                will facilitate the subsidy application process for whichever government subsidy scheme is
                available and applicable, subject to prevailing regulations and eligibility.
              </p>
            </div>
          </div>
        ) : noSubsidyNote ? (
          <div
            className="rounded-xl px-5 py-4 flex items-start gap-3"
            style={
              noSubsidyNote.positive
                ? { background: '#eef3fb', border: '1px solid #d5e3f5' }
                : { background: '#fef3c7', border: '1px solid #fde68a' }
            }
          >
            <span style={{ fontSize: '20px' }}>{noSubsidyNote.icon}</span>
            <div>
              <p
                className="text-sm font-semibold"
                style={{ color: noSubsidyNote.positive ? '#2c4570' : '#92400e' }}
              >
                {noSubsidyNote.title}
              </p>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">{noSubsidyNote.body}</p>
            </div>
          </div>
        ) : null}

        <ProposalNoteBlock placement="cost_breakdown" proposalNote={proposalNote} />
      </div>

      <QuotationFooter quoteNumber={quoteNumber} pageNumber={pageNumber} />
    </div>
  );
}
