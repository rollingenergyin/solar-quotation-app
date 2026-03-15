'use client';

import QuotationHeader from '../QuotationHeader';
import QuotationFooter from '../QuotationFooter';
import type { TemplateConfig } from '../../../types/quotation-template';

interface Props {
  clientName: string;
  clientAddress: string;
  contactPerson: string;
  date: string;
  systemSizeKw: number;
  quoteNumber: string;
  config?: TemplateConfig | null;
}

const DEFAULT_BODY = [
  'We are delighted to present this detailed proposal for the installation of a {{system_size}} kW Grid-Connected Rooftop Solar Power System at your premises. At Rolling Energy, we specialize in delivering turnkey solar solutions that combine cutting-edge technology, premium materials, and expert engineering to maximize your return on investment.',
  'This proposal has been prepared after careful consideration of your energy consumption patterns, roof space availability, and local grid conditions. The system outlined herein is designed to significantly reduce your electricity bills, contribute to a cleaner environment, and deliver a strong financial return over its 25-year operational life.',
  'The proposal includes a complete Bill of Materials, detailed cost breakdown, government subsidy calculations under the PM Surya Ghar Muft Bijli Yojana scheme, and a comprehensive ROI analysis with EMI financing options tailored to your needs.',
  'We invite you to review this proposal and welcome any queries or clarifications you may have. Our technical team is available for a detailed walkthrough at your convenience.',
  'We look forward to partnering with you on your journey towards energy independence and sustainable savings.',
];

export default function IntroductionLetter({
  clientName, clientAddress, contactPerson, date, systemSizeKw, quoteNumber, config,
}: Props) {
  const body = config?.introLetterBody?.length ? config.introLetterBody : DEFAULT_BODY;
  const companyName = config?.companyName ?? 'Rolling Energy';
  const companyTagline = config?.companyTagline ?? 'Solar EPC Company';
  const companyWebsite = config?.companyWebsite ?? 'rollingenergy.in';

  // Replace template placeholders
  const resolvedBody = body.map((para) =>
    para
      .replace(/\{\{client_name\}\}/g, clientName)
      .replace(/\{\{system_size\}\}/g, String(systemSizeKw))
  );

  return (
    <div className="quotation-page flex flex-col" style={{ background: '#ffffff' }}>
      <QuotationHeader quoteNumber={quoteNumber} pageTitle="Introduction Letter" pageNumber={2} totalPages={13} />

      <div className="flex-1 px-12 py-6" style={{ paddingBottom: '36px' }}>
        {/* Date & Address block */}
        <div className="mb-8">
          <p className="text-sm text-gray-500 mb-6">{date}</p>

          <div className="mb-6">
            <p className="text-sm font-semibold text-gray-900">{clientName}</p>
            {contactPerson && contactPerson !== clientName && (
              <p className="text-sm text-gray-600">Attn: {contactPerson}</p>
            )}
            <p className="text-sm text-gray-600 whitespace-pre-line">{clientAddress}</p>
          </div>

          <p className="text-sm font-medium text-gray-700">
            Ref: Quotation for {systemSizeKw} kW Rooftop Solar Power System
          </p>
        </div>

        {/* Salutation */}
        <p className="text-sm text-gray-800 mb-6">
          Dear {contactPerson || clientName},
        </p>

        {/* Body paragraphs */}
        <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
          {resolvedBody.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>

        {/* Closing */}
        <div className="mt-10">
          <p className="text-sm text-gray-700">Warm regards,</p>
          <div
            className="mt-6 pt-6 border-t"
            style={{ borderColor: '#e5e7eb', maxWidth: '220px' }}
          >
            <p className="text-sm font-bold" style={{ color: '#161c34', fontFamily: 'Poppins, sans-serif' }}>
              {companyName}
            </p>
            <p className="text-xs text-gray-500">{companyTagline}</p>
            <p className="text-xs mt-1" style={{ color: '#6690cc' }}>{companyWebsite}</p>
          </div>
        </div>

        {/* Blue accent bar (hidden in PDF to prevent dark column artifact) */}
        <div
          className="no-pdf-accent absolute right-0 top-0 bottom-0 w-1.5"
          style={{ background: 'linear-gradient(180deg, #6690cc 0%, #161c34 100%)', opacity: 0.15 }}
        />
      </div>

      <QuotationFooter quoteNumber={quoteNumber} pageNumber={2} />
    </div>
  );
}
