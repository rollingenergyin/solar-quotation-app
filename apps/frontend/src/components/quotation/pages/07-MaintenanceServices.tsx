'use client';

import QuotationHeader from '../QuotationHeader';
import QuotationFooter from '../QuotationFooter';
import ProposalNoteBlock from '../ProposalNoteBlock';
import type { TemplateConfig, TemplateService, TemplateWarranty } from '../../../types/quotation-template';
import { warrantyItemHasAlternatives } from '@/constants/warranty-items';
import type { ProposalNote } from '@/constants/proposal-note';

interface Props {
  quoteNumber: string;
  config?: TemplateConfig | null;
  pageNumber?: number;
  totalPages?: number;
  proposalNote?: ProposalNote | null;
}

const DEFAULT_SERVICES: TemplateService[] = [
  { icon: '🔍', title: 'Annual Inspection', desc: 'Full system inspection twice a year — panel torque checks, wiring integrity, inverter health diagnostics, and earthing resistance testing.' },
  { icon: '🧹', title: 'Panel Cleaning', coverage: 'optional', desc: 'Scheduled panel surface cleaning using deionised water and soft brushes to maintain >98% optical transmission. Soiling can reduce output by 15–25%.' },
  { icon: '📡', title: 'Remote Monitoring', desc: 'Cloud-based performance monitoring with real-time generation data, fault alerts via SMS/email, and monthly performance reports sent to your inbox.' },
  { icon: '⚙️', title: 'Inverter Service', desc: 'Firmware updates, fan replacement, and electrolytic capacitor checks at manufacturer-recommended intervals to maximise inverter life.' },
  { icon: '🔌', title: 'Electrical Safety Check', desc: 'Annual DCDB/ACDB inspection, MCB/MCCB testing, SPD functionality verification, and earthing loop impedance measurement per IS:3043.' },
  { icon: '🚨', title: 'Emergency Support', desc: '48-hour on-site response SLA for critical faults. Remote diagnosis within 4 hours. Priority spares dispatched same business day.' },
];

const DEFAULT_WARRANTIES: TemplateWarranty[] = [
  { item: 'Solar Module Performance', warranty: '{{panel_warranty_years}}-Year Linear Output Guarantee (≥80% at year {{panel_warranty_years}})' },
  { item: 'Solar Module Product', warranty: '12-Year Manufacturing Defect Warranty' },
  { item: 'Solar Inverter', warranty: '5-Year Standard (Extendable to 10 Years)' },
  { item: 'Mounting Structure', warranty: '10-Year Structural Integrity Warranty' },
  { item: 'Workmanship & Installation', warranty: '5-Year Rolling Energy Workmanship Warranty' },
  { item: 'DC/AC Cables & Connectors', warranty: 'Lifetime (as per IS specification)' },
];

function WarrantyInlineOr() {
  return (
    <span
      className="inline-flex items-center justify-center text-[8px] font-bold tracking-widest uppercase rounded-full px-1.5 py-0.5 my-0.5"
      style={{
        color: '#ffffff',
        background: 'linear-gradient(135deg, #161c34, #6690cc)',
        fontFamily: 'Poppins, sans-serif',
      }}
    >
      or
    </span>
  );
}

function WarrantyAlternativesStack({ values }: { values: string[] }) {
  const parts = values.map((v) => v.trim()).filter(Boolean);
  if (!parts.length) return <span className="text-gray-300">—</span>;
  if (parts.length === 1) return <span>{parts[0]}</span>;

  return (
    <div className="space-y-0.5">
      {parts.map((part, i) => (
        <div key={i} className="leading-snug">
          {i > 0 && <WarrantyInlineOr />}
          <div>{part}</div>
        </div>
      ))}
    </div>
  );
}

export default function MaintenanceServices({
  quoteNumber, config, pageNumber = 7, totalPages = 13, proposalNote,
}: Props) {
  const warrantyYears = config?.panelWarrantyYears ?? 25;

  const services   = config?.maintenanceServices?.length ? config.maintenanceServices : DEFAULT_SERVICES;
  const rawWarranties = config?.warrantyItems?.length    ? config.warrantyItems       : DEFAULT_WARRANTIES;

  // Replace {{panel_warranty_years}} placeholder in warranty text
  const warranties = rawWarranties.map(w => ({
    ...w,
    warranty: w.warranty.replace(/\{\{panel_warranty_years\}\}/g, String(warrantyYears)),
    alternatives: w.alternatives?.map((alt) => ({
      warranty: alt.warranty.replace(/\{\{panel_warranty_years\}\}/g, String(warrantyYears)),
    })),
  }));

  const hasAlternatives = warranties.some(warrantyItemHasAlternatives);

  const isServiceOptional = (s: TemplateService) =>
    s.coverage === 'optional' || (s.coverage !== 'included' && s.title === 'Panel Cleaning');

  return (
    <div className="quotation-page flex flex-col" style={{ background: '#ffffff' }}>
      <QuotationHeader quoteNumber={quoteNumber} pageTitle="Maintenance & Services" pageNumber={pageNumber} totalPages={totalPages} />

      <div className="flex-1 px-12 py-7" style={{ paddingBottom: '36px' }}>
        <div className="mb-6">
          <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: '#6690cc' }}>
            After-Sales Support
          </p>
          <h2
            className="text-2xl font-bold"
            style={{ color: '#161c34', fontFamily: 'Poppins, sans-serif' }}
          >
            Maintenance, Services & Warranties
          </h2>
          <div className="mt-2 h-0.5 w-12" style={{ background: '#6690cc' }} />
        </div>

        {/* AMC header banner */}
        <div
          className="rounded-2xl px-6 py-4 mb-6 flex items-center gap-4"
          style={{ background: 'linear-gradient(135deg, #161c34, #2c4570)' }}
        >
          <span style={{ fontSize: '28px' }}>🛡️</span>
          <div>
            <p className="font-semibold text-sm" style={{ color: '#ffffff', fontFamily: 'Poppins, sans-serif' }}>
              Annual Maintenance Contract (AMC) — For 5 Years
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
              Comprehensive care programme covering included services below. Optional add-ons available on request.
            </p>
          </div>
        </div>

        {/* Services grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {services.map((s) => (
            <div
              key={s.title}
              className="rounded-xl p-4 border"
              style={{ borderColor: '#e5e7eb', background: '#f9fafb' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span style={{ fontSize: '18px' }}>{s.icon}</span>
                <p className="text-xs font-semibold" style={{ color: '#161c34' }}>{s.title}</p>
                {isServiceOptional(s) ? (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full ml-auto"
                    style={{ background: '#fef3c7', color: '#b45309' }}
                  >
                    Optional
                  </span>
                ) : (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full ml-auto"
                    style={{ background: '#dcfce7', color: '#16a34a' }}
                  >
                    ✓
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Warranty table */}
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#9ca3af' }}>
            Warranty Summary
          </p>
          <div className="rounded-xl overflow-hidden border" style={{ borderColor: '#e5e7eb' }}>
            <div
              className="grid text-xs font-semibold px-4 py-2"
              style={{
                gridTemplateColumns: '1fr 2fr',
                background: '#6690cc',
                color: '#ffffff',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              <div>Component</div>
              <div>Warranty Coverage</div>
            </div>
            {warranties.map((w, i) => {
              const coverageValues = [
                w.warranty,
                ...(w.alternatives?.map((alt) => alt.warranty) ?? []),
              ];

              return (
              <div
                key={`${w.item}-${i}`}
                className="grid px-4 py-2"
                style={{
                  gridTemplateColumns: '1fr 2fr',
                  background: i % 2 === 0 ? '#ffffff' : '#f9fafb',
                  borderBottom: '1px solid #f3f4f6',
                  fontSize: '11.5px',
                }}
              >
                <div className="font-medium" style={{ color: '#161c34' }}>{w.item}</div>
                <div className="text-gray-600">
                  <WarrantyAlternativesStack values={coverageValues} />
                </div>
              </div>
              );
            })}
          </div>
          {hasAlternatives && (
            <p className="text-xs text-gray-400 mt-2 italic">
              Where OR is shown, alternative warranty coverage is offered for the same component — final terms per selected equipment at order confirmation.
            </p>
          )}
        </div>

        <ProposalNoteBlock placement="maintenance_services" proposalNote={proposalNote} />
      </div>

      <QuotationFooter quoteNumber={quoteNumber} pageNumber={pageNumber} />
    </div>
  );
}
