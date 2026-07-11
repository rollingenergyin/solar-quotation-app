'use client';

import QuotationHeader from '../QuotationHeader';
import QuotationFooter from '../QuotationFooter';
import ProposalNoteBlock from '../ProposalNoteBlock';
import type {
  TemplateConfig,
  TemplatePaymentMilestone,
  TemplatePaymentMode,
} from '../../../types/quotation-template';
import type { ProposalNote } from '@/constants/proposal-note';
import { BankDetailsBlock } from '../CostingSharedBlocks';

interface Props {
  quoteNumber: string;
  netCost?: number;
  config?: TemplateConfig | null;
  pageNumber?: number;
  totalPages?: number;
  proposalNote?: ProposalNote | null;
}

const DEFAULT_MILESTONES: TemplatePaymentMilestone[] = [
  { step: '01', title: 'Order Confirmation', pct: 50, desc: 'Token advance upon signing of agreement. Enables procurement of all equipment and scheduling of installation team.', icon: '✅' },
  { step: '02', title: 'Material Delivery', pct: 40, desc: 'Payment before delivery of all equipment to site. Modules, inverter, mounting structure and BOS components.', icon: '📦' },
  { step: '03', title: 'After Commissioning', pct: 10, desc: 'Final payment post successful installation, testing, and handover with commissioning certificate.', icon: '⚡' },
];

const DEFAULT_MODES: TemplatePaymentMode[] = [
  { icon: '🏦', label: 'Bank Transfer (NEFT/RTGS)' },
  { icon: '📱', label: 'UPI / Mobile Payment' },
  { icon: '💳', label: 'Demand Draft / Cheque' },
  { icon: '🏢', label: 'EMI via Bank Loan (see next page)' },
];

const DEFAULT_BULLETS = [
  'Prices subject to revision if material costs change significantly (>5%) before order confirmation.',
  'PM Surya Ghar subsidy is subject to DISCOM approval and government policy at time of commissioning.',
  "Bank loan/EMI arrangements are as per the lending institution's terms and discretion.",
];

const EXCLUDED_PAYMENT_BULLET = /DISCOM\/net metering charges are additional/i;

function filterPaymentBullets(items: string[]): string[] {
  return items.filter((b) => b?.trim() && !EXCLUDED_PAYMENT_BULLET.test(b));
}

export default function PaymentTerms({
  quoteNumber, config, pageNumber = 9, totalPages = 13, proposalNote,
}: Props) {
  const milestones = config?.paymentMilestones?.length ? config.paymentMilestones : DEFAULT_MILESTONES;
  const modes   = config?.paymentModes?.length       ? config.paymentModes       : DEFAULT_MODES;
  const bullets = filterPaymentBullets(
    config?.paymentTermsBullets?.length ? config.paymentTermsBullets : DEFAULT_BULLETS,
  );

  return (
    <div className="quotation-page flex flex-col" style={{ background: '#ffffff' }}>
      <QuotationHeader quoteNumber={quoteNumber} pageTitle="Payment Schedule" pageNumber={pageNumber} totalPages={totalPages} />

      <div className="flex-1 px-12 py-5" style={{ paddingBottom: '36px' }}>
        <div className="mb-4">
          <h2
            className="text-2xl font-bold"
            style={{ color: '#161c34', fontFamily: 'Poppins, sans-serif' }}
          >
            Payment Schedule
          </h2>
          <div className="mt-2 h-0.5 w-12" style={{ background: '#6690cc' }} />
        </div>

        {/* Milestone cards */}
        <div className="space-y-2.5 mb-4">
          {milestones.map((m, idx) => (
            <div
              key={m.step}
              className="flex items-start gap-5 rounded-2xl p-5"
              style={{
                background: idx === 0
                  ? 'linear-gradient(135deg, #161c34, #2c4570)'
                  : idx === 1
                  ? 'linear-gradient(135deg, #1e2f4d, #3c5e94)'
                  : '#f9fafb',
                border: idx === 2 ? '1px solid #e5e7eb' : 'none',
              }}
            >
              {/* Progress circle */}
              <div
                className="flex-shrink-0 w-12 h-12 rounded-full flex flex-col items-center justify-center text-sm font-bold"
                style={{
                  background: idx < 2 ? 'rgba(255,255,255,0.15)' : '#6690cc',
                  color: '#ffffff',
                  border: idx < 2 ? '2px solid rgba(255,255,255,0.3)' : 'none',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                {m.step}
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span>{m.icon}</span>
                  <p
                    className="text-sm font-semibold"
                    style={{
                      color: idx < 2 ? '#ffffff' : '#161c34',
                      fontFamily: 'Poppins, sans-serif',
                    }}
                  >
                    {m.title}
                  </p>
                </div>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: idx < 2 ? 'rgba(255,255,255,0.7)' : '#6b7280' }}
                >
                  {m.desc}
                </p>
              </div>

              {/* Share of project value (percentage only) */}
              <div className="text-right flex-shrink-0">
                <p
                  className="text-xl font-bold tabular-nums"
                  style={{
                    color: idx < 2 ? '#6690cc' : '#161c34',
                    fontFamily: 'Poppins, sans-serif',
                  }}
                >
                  {m.pct}%
                </p>
                <p
                  className="text-xs"
                  style={{ color: idx < 2 ? 'rgba(255,255,255,0.5)' : '#9ca3af' }}
                >
                  of project value
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Payment modes */}
        <div className="mb-3">
          <p className="text-xs font-semibold tracking-widest uppercase mb-1.5" style={{ color: '#9ca3af' }}>
            Accepted Payment Modes
          </p>
          <div className="grid grid-cols-4 gap-2">
            {modes.map((p) => (
              <div
                key={p.label}
                className="rounded-lg p-3 text-center border"
                style={{ borderColor: '#e5e7eb', background: '#f9fafb' }}
              >
                <span style={{ fontSize: '20px' }}>{p.icon}</span>
                <p className="text-[11px] text-gray-600 mt-1.5 font-medium leading-tight">{p.label}</p>
              </div>
            ))}
          </div>
        </div>

        <BankDetailsBlock config={config} className="mb-3" />

        {/* Terms */}
        <div className="rounded-lg px-4 py-3 border quotation-no-break" style={{ borderColor: '#e5e7eb', background: '#f9fafb' }}>
          <p className="text-xs font-semibold mb-1.5" style={{ color: '#161c34' }}>Terms & Conditions</p>
          <ul className="space-y-0.5 text-[11px] leading-snug text-gray-500">
            {bullets.map((b, i) => (
              <li key={i}>• {b}</li>
            ))}
          </ul>
        </div>

        <ProposalNoteBlock placement="payment_terms" proposalNote={proposalNote} />
      </div>

      <QuotationFooter quoteNumber={quoteNumber} pageNumber={pageNumber} />
    </div>
  );
}
