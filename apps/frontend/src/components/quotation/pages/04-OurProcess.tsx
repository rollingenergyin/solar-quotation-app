'use client';

import QuotationHeader from '../QuotationHeader';
import QuotationFooter from '../QuotationFooter';
import type { TemplateConfig, TemplateProcessStep } from '../../../types/quotation-template';

interface Props { quoteNumber: string; config?: TemplateConfig | null }

const DEFAULT_STEPS: TemplateProcessStep[] = [
  { step: '01', title: 'Site Survey', subtitle: 'Assessment & Planning', desc: 'Our certified engineers visit the site to assess roof structure, orientation, shading analysis, electrical load, and grid connection feasibility. A detailed site report is prepared as the foundation for system design.', icon: '📍', duration: '1–2 Days' },
  { step: '02', title: 'System Design', subtitle: 'Engineering & Yield Analysis', desc: 'Using advanced solar simulation software, we design an optimised system layout — panel placement, string configuration, inverter sizing, and cable routing — with shadow-free maximum yield calculations.', icon: '📐', duration: '2–3 Days' },
  { step: '03', title: 'Proposal', subtitle: 'Quotation & Approvals', desc: 'We present a transparent, detailed quotation with complete BOM, cost breakdown, subsidy calculations, ROI analysis, and EMI options. We assist with any approvals or DISCOM applications required.', icon: '📋', duration: '1 Day' },
  { step: '04', title: 'Installation', subtitle: 'Civil & Electrical Work', desc: 'Our trained installation team handles all civil work (mounting structure), panel installation, inverter and ACDB/DCDB wiring, grid connection, and earthing — strictly following MNRE/BIS standards.', icon: '🔧', duration: '2–5 Days' },
  { step: '05', title: 'Commissioning', subtitle: 'Testing & Net Metering', desc: 'Comprehensive system testing is followed by grid synchronisation and net meter registration with your DISCOM. We handle all paperwork end-to-end so the system is live and billing-optimised from day one.', icon: '⚡', duration: '3–7 Days' },
  { step: '06', title: 'Monitoring & AMC', subtitle: 'Lifetime Support', desc: 'Remote monitoring via cloud dashboard tracks real-time generation, consumption, and alerts. Our AMC programme ensures proactive maintenance, panel cleaning, and inverter health checks throughout the system life.', icon: '📊', duration: 'Ongoing' },
];

export default function OurProcess({ quoteNumber, config }: Props) {
  const steps        = config?.processSteps?.length ? config.processSteps : DEFAULT_STEPS;
  const timelineText = config?.processTimelineText   ?? 'Total Timeline: 10–18 Working Days';

  return (
    <div className="quotation-page flex flex-col" style={{ background: '#ffffff' }}>
      <QuotationHeader quoteNumber={quoteNumber} pageTitle="Our Process" pageNumber={4} totalPages={13} />

      <div className="flex-1 px-12 py-6" style={{ paddingBottom: '36px' }}>
        <div className="mb-8">
          <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: '#6690cc' }}>
            Step by Step
          </p>
          <h2
            className="text-2xl font-bold"
            style={{ color: '#161c34', fontFamily: 'Poppins, sans-serif' }}
          >
            From Survey to Savings in {steps.length} Steps
          </h2>
          <div className="mt-2 h-0.5 w-12" style={{ background: '#6690cc' }} />
        </div>

        {/* Timeline */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
          {steps.map((step, idx) => (
            <div key={step.step} className="flex gap-4">
              {/* Number badge */}
              <div className="flex-shrink-0 flex flex-col items-center">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{
                    background: idx % 2 === 0
                      ? 'linear-gradient(135deg, #6690cc, #3c5e94)'
                      : 'linear-gradient(135deg, #161c34, #2c4570)',
                    color: '#ffffff',
                    fontFamily: 'Poppins, sans-serif',
                  }}
                >
                  {step.step}
                </div>
                {idx < steps.length - 2 && (
                  <div className="w-px flex-1 mt-2" style={{ background: '#e5e7eb', minHeight: '12px' }} />
                )}
              </div>

              {/* Content */}
              <div className="pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ fontSize: '16px' }}>{step.icon}</span>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: '#161c34', fontFamily: 'Poppins, sans-serif' }}
                  >
                    {step.title}
                  </p>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: '#eef3fb', color: '#3c5e94' }}
                  >
                    {step.duration}
                  </span>
                </div>
                <p className="text-xs font-medium mb-1" style={{ color: '#6690cc' }}>{step.subtitle}</p>
                <p className="text-xs text-gray-600 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom banner */}
        <div
          className="mt-6 rounded-2xl px-6 py-4 flex items-center gap-4"
          style={{ background: 'linear-gradient(135deg, #161c34, #2c4570)' }}
        >
          <span style={{ fontSize: '28px' }}>🏆</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#ffffff', fontFamily: 'Poppins, sans-serif' }}>
              {timelineText}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
              From signed agreement to a fully commissioned, grid-connected solar system
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs" style={{ color: '#6690cc' }}>Hassle-free</p>
            <p className="text-xs" style={{ color: '#6690cc' }}>End-to-End</p>
          </div>
        </div>
      </div>

      <QuotationFooter quoteNumber={quoteNumber} pageNumber={4} />
    </div>
  );
}
