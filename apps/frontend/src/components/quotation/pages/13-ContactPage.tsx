'use client';

import RollingEnergyLogo from '../RollingEnergyLogo';
import type { TemplateConfig } from '../../../types/quotation-template';

interface Props { quoteNumber: string; config?: TemplateConfig | null; pageNumber?: number; totalPages?: number }

export default function ContactPage({ quoteNumber, config, pageNumber = 13, totalPages = 13 }: Props) {
  const companyName    = config?.companyName    ?? 'Rolling Energy';
  const companyPhone   = config?.companyPhone   ?? '+91 98765 43210';
  const companyEmail   = config?.companyEmail   ?? 'info@rollingenergy.in';
  const companyWebsite = config?.companyWebsite ?? 'www.rollingenergy.in';
  const companyAddress = config?.companyAddress ?? '2nd Floor, Solar Plaza, Baner Road, Pune 411045, Maharashtra';
  const certifications = config?.certifications?.length ? config.certifications : [
    '✅ MNRE Empanelled Installer',
    '✅ BIS Certified Products',
    '✅ DCR Panel Compliant',
    '✅ ISO Certified Process',
    '✅ DISCOM Registered',
  ];

  const contactDetails = [
    { icon: '📞', label: 'Phone',          value: companyPhone,   link: `tel:${companyPhone.replace(/\s/g, '')}` },
    { icon: '📧', label: 'Email',          value: companyEmail,   link: `mailto:${companyEmail}` },
    { icon: '🌐', label: 'Website',        value: companyWebsite, link: `https://${companyWebsite}` },
    { icon: '📍', label: 'Office Address', value: companyAddress, link: null },
  ];

  return (
    <div
      className="quotation-page flex flex-col"
      style={{
        background: 'linear-gradient(155deg, #0d1020 0%, #161c34 40%, #1e2f4d 75%, #2c4570 100%)',
      }}
    >
      {/* Top accent */}
      <div className="flex-shrink-0 h-1 w-full" style={{ background: 'linear-gradient(90deg, #6690cc, #85a8e0, #6690cc)' }} />

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-16 text-center py-12">

        {/* Logo */}
        <RollingEnergyLogo variant="dark" size="xl" className="mb-10 justify-center" />

        {/* Heading */}
        <p
          className="text-xs font-semibold tracking-widest uppercase mb-2"
          style={{ color: '#6690cc' }}
        >
          Get In Touch
        </p>
        <h2
          className="text-2xl font-bold mb-2"
          style={{ color: '#ffffff', fontFamily: 'Poppins, sans-serif' }}
        >
          Ready to Go Solar?
        </h2>
        <p className="text-sm mb-10" style={{ color: 'rgba(255,255,255,0.6)', maxWidth: '380px' }}>
          Our solar specialists are available 6 days a week to answer your questions,
          arrange a site visit, or finalise your order.
        </p>

        {/* Contact cards */}
        <div className="grid grid-cols-2 gap-4 w-full max-w-lg mb-8">
          {contactDetails.map((c) => (
            <div
              key={c.label}
              className="rounded-2xl p-5 text-left"
              style={{
                background: 'rgba(102,144,204,0.1)',
                border: '1px solid rgba(102,144,204,0.25)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span style={{ fontSize: '18px' }}>{c.icon}</span>
                <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#6690cc' }}>
                  {c.label}
                </p>
              </div>
              <p className="text-sm font-medium" style={{ color: '#ffffff' }}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-6 w-full max-w-xs">
          <div className="flex-1 h-px" style={{ background: 'rgba(102,144,204,0.3)' }} />
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#6690cc' }} />
          <div className="flex-1 h-px" style={{ background: 'rgba(102,144,204,0.3)' }} />
        </div>

        {/* Certifications */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {certifications.map((c) => (
            <span
              key={c}
              className="text-xs px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(102,144,204,0.15)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(102,144,204,0.2)' }}
            >
              {c}
            </span>
          ))}
        </div>

        {/* Quote reference */}
        <div
          className="rounded-xl px-6 py-3"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(102,144,204,0.15)' }}
        >
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Quote Reference: <span style={{ color: '#6690cc' }}>{quoteNumber}</span>
            <span className="mx-3" style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
            This proposal is valid for <strong style={{ color: 'rgba(255,255,255,0.8)' }}>30 days</strong> from the date of issue
          </p>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="flex-shrink-0 px-10 py-4 flex items-center justify-between text-xs"
        style={{ background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(102,144,204,0.15)' }}
      >
        <span style={{ color: 'rgba(255,255,255,0.35)' }}>© {new Date().getFullYear()} {companyName}. All rights reserved.</span>
        <span style={{ color: '#6690cc' }}>Powered by Clean Energy ☀</span>
      </div>
    </div>
  );
}
