'use client';

import QuotationHeader from '../QuotationHeader';
import QuotationFooter from '../QuotationFooter';
import type { TemplateConfig, TemplateStat, TemplateHighlight } from '../../../types/quotation-template';

interface Props { quoteNumber: string; config?: TemplateConfig | null }

const DEFAULT_PARAGRAPHS = [
  'Rolling Energy is a premier Solar EPC (Engineering, Procurement & Construction) company committed to delivering world-class rooftop and ground-mounted solar solutions across India. Founded by industry veterans, we bring decades of combined experience in power systems, project management, and renewable energy.',
  "We partner with India's leading panel and inverter manufacturers to source only Grade-A, BIS-certified equipment, ensuring every system we install delivers peak performance for 25+ years with minimal maintenance.",
  'From a single rooftop installation to large commercial arrays, our integrated approach covers every stage — site survey, system design, procurement, installation, net metering registration, and ongoing AMC — under one roof.',
];

const DEFAULT_MISSION = "To accelerate India's transition to clean, renewable energy by making solar power accessible, affordable, and reliable for every home and business.";

const DEFAULT_STATS: TemplateStat[] = [
  { label: 'Projects', value: '200+' },
  { label: 'MW Installed', value: '1.2+' },
  { label: 'States', value: '5+' },
  { label: 'Experience', value: '8 Yrs' },
];

const DEFAULT_HIGHLIGHTS: TemplateHighlight[] = [
  { icon: '🏅', title: 'MNRE Certified', desc: 'Government-registered solar installer under Ministry of New & Renewable Energy' },
  { icon: '⚡', title: 'End-to-End EPC', desc: 'Engineering, Procurement & Construction — complete turnkey solutions' },
  { icon: '☀', title: 'DCR Panels', desc: 'Domestic Content Requirement certified modules eligible for maximum subsidies' },
  { icon: '🔧', title: 'Expert Engineers', desc: 'Team of certified solar engineers with 100+ successful installations' },
  { icon: '📋', title: 'PM Surya Ghar', desc: 'Authorised installer for central subsidy scheme — we handle all paperwork' },
  { icon: '🌱', title: 'Green Commitment', desc: "Dedicated to accelerating India's clean energy transition" },
];

export default function AboutCompany({ quoteNumber, config }: Props) {
  const paragraphs  = config?.aboutParagraphs?.length  ? config.aboutParagraphs  : DEFAULT_PARAGRAPHS;
  const mission     = config?.aboutMission              ? config.aboutMission     : DEFAULT_MISSION;
  const stats       = config?.aboutStats?.length        ? config.aboutStats       : DEFAULT_STATS;
  const highlights  = config?.aboutHighlights?.length   ? config.aboutHighlights  : DEFAULT_HIGHLIGHTS;
  const companyName = config?.companyName ?? 'Rolling Energy';

  return (
    <div className="quotation-page flex flex-col" style={{ background: '#ffffff' }}>
      <QuotationHeader quoteNumber={quoteNumber} pageTitle={`About ${companyName}`} pageNumber={3} totalPages={13} />

      <div className="flex-1 px-12 py-6" style={{ paddingBottom: '36px' }}>

        {/* Section heading */}
        <div className="mb-8">
          <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: '#6690cc' }}>
            Who We Are
          </p>
          <h2
            className="text-2xl font-bold leading-tight"
            style={{ color: '#161c34', fontFamily: 'Poppins, sans-serif' }}
          >
            {companyName} — Your Trusted Solar Partner
          </h2>
          <div className="mt-2 h-0.5 w-12" style={{ background: '#6690cc' }} />
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            {paragraphs.map((para, i) => (
              <p key={i} className="text-sm text-gray-700 leading-relaxed mb-4">{para}</p>
            ))}
          </div>

          <div
            className="rounded-2xl p-6 flex flex-col justify-between"
            style={{ background: 'linear-gradient(135deg, #161c34, #2c4570)' }}
          >
            <p
              className="text-xs font-bold tracking-widest uppercase mb-4"
              style={{ color: '#6690cc' }}
            >
              Our Mission
            </p>
            <blockquote
              className="text-base font-medium leading-relaxed italic"
              style={{ color: '#ffffff', fontFamily: 'Poppins, sans-serif', fontSize: '14px' }}
            >
              "{mission}"
            </blockquote>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <p className="text-lg font-bold" style={{ color: '#6690cc', fontFamily: 'Poppins, sans-serif' }}>
                    {stat.value}
                  </p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Highlights grid */}
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: '#6690cc' }}>
            Why Clients Choose Us
          </p>
          <div className="grid grid-cols-3 gap-3">
            {highlights.map((h) => (
              <div
                key={h.title}
                className="rounded-xl p-4 border"
                style={{ borderColor: '#e5e7eb', background: '#f9fafb' }}
              >
                <span style={{ fontSize: '20px' }}>{h.icon}</span>
                <p className="text-xs font-semibold mt-2 mb-1" style={{ color: '#161c34' }}>{h.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{h.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <QuotationFooter quoteNumber={quoteNumber} pageNumber={3} />
    </div>
  );
}
