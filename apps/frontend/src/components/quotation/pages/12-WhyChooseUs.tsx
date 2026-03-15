'use client';

import QuotationHeader from '../QuotationHeader';
import QuotationFooter from '../QuotationFooter';
import type { TemplateConfig, TemplateReason, TemplateTestimonial } from '../../../types/quotation-template';

interface Props { quoteNumber: string; config?: TemplateConfig | null; pageNumber?: number; totalPages?: number }

const DEFAULT_REASONS: TemplateReason[] = [
  { icon: '🏅', title: 'MNRE Certified Installer', desc: 'Officially empanelled with the Ministry of New & Renewable Energy. Our installations meet all government standards and qualify for central subsidies.' },
  { icon: '🔬', title: 'Grade-A DCR Equipment', desc: 'We source only BIS/DCR certified Tier-1 solar panels and MNRE-listed inverters. No compromises on quality — ever.' },
  { icon: '📋', title: 'Subsidy Specialists', desc: 'Our team handles every step of PM Surya Ghar subsidy — from application to disbursement — at zero additional cost to you.' },
  { icon: '🔧', title: 'Certified Installation Team', desc: 'All our engineers are certified solar installers with hands-on training from NISE/TERI. Safety-first approach on every project.' },
  { icon: '📊', title: 'Transparent Pricing', desc: 'No hidden charges. Detailed BOM and cost breakdown provided upfront. What you see in this proposal is exactly what you pay.' },
  { icon: '🛡️', title: '5-Year Workmanship Warranty', desc: 'We back our installations with a comprehensive 5-year workmanship warranty in addition to manufacturer warranties on all equipment.' },
  { icon: '📡', title: 'Remote Monitoring Included', desc: 'Real-time performance monitoring via cloud dashboard from day one. Track generation, savings, and carbon offset from your phone.' },
  { icon: '🤝', title: 'Dedicated Project Manager', desc: 'A dedicated project manager is assigned to every client — single point of contact from survey to commissioning and beyond.' },
  { icon: '⚡', title: 'Fast Turnaround', desc: "From signed agreement to commissioned system in just 10–18 working days. India's fastest certified solar installation programme." },
];

const DEFAULT_TESTIMONIALS: TemplateTestimonial[] = [
  { name: 'Prakash M.', location: 'Pune, Maharashtra', text: '"Rolling Energy installed our 5 kW system in just 12 days. Subsidy received within a month. Excellent service!"' },
  { name: 'Sanjay K.', location: 'Ahmedabad, Gujarat', text: '"Transparent pricing, premium panels, and the remote monitoring app is brilliant. Electricity bill dropped by 85%."' },
];

const CARD_COLORS = ['#fef3c7','#dbeafe','#dcfce7','#ede9fe','#fce7f3','#fff7ed','#ecfeff','#f0fdf4','#eef3fb'];

export default function WhyChooseUs({ quoteNumber, config, pageNumber = 12, totalPages = 13 }: Props) {
  const reasons      = config?.whyReasons?.length    ? config.whyReasons    : DEFAULT_REASONS;
  const testimonials = config?.testimonials?.length  ? config.testimonials  : DEFAULT_TESTIMONIALS;
  const companyName  = config?.companyName           ?? 'Rolling Energy';

  return (
    <div className="quotation-page flex flex-col" style={{ background: '#ffffff' }}>
      <QuotationHeader quoteNumber={quoteNumber} pageTitle="Why Choose Us" pageNumber={pageNumber} totalPages={totalPages} />

      <div className="flex-1 px-12 py-7" style={{ paddingBottom: '36px' }}>
        <div className="mb-6">
          <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: '#6690cc' }}>
            The {companyName} Advantage
          </p>
          <h2
            className="text-2xl font-bold"
            style={{ color: '#161c34', fontFamily: 'Poppins, sans-serif' }}
          >
            {reasons.length} Reasons to Choose {companyName}
          </h2>
          <div className="mt-2 h-0.5 w-12" style={{ background: '#6690cc' }} />
        </div>

        {/* Reasons grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {reasons.map((r, i) => (
            <div
              key={r.title}
              className="rounded-xl p-4 border"
              style={{ borderColor: '#f3f4f6', background: '#fafafa' }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 text-lg"
                style={{ background: CARD_COLORS[i % CARD_COLORS.length] }}
              >
                {r.icon}
              </div>
              <p className="text-xs font-semibold mb-1.5" style={{ color: '#161c34', fontFamily: 'Poppins, sans-serif' }}>
                {r.title}
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="grid grid-cols-2 gap-4">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="rounded-xl p-5"
              style={{ background: 'linear-gradient(135deg, #eef3fb, #f9fafb)', border: '1px solid #d5e3f5' }}
            >
              <p className="text-xs italic text-gray-600 leading-relaxed mb-3">{t.text}</p>
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: '#6690cc', color: '#ffffff' }}
                >
                  {t.name[0]}
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: '#161c34' }}>{t.name}</p>
                  <p className="text-xs text-gray-400">{t.location}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <QuotationFooter quoteNumber={quoteNumber} pageNumber={pageNumber} />
    </div>
  );
}
