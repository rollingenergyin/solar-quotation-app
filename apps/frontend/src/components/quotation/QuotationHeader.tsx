'use client';

import RollingEnergyLogo from './RollingEnergyLogo';

interface Props {
  quoteNumber: string;
  pageTitle: string;
  pageNumber: number;
  totalPages: number;
}

export default function QuotationHeader({ quoteNumber, pageTitle, pageNumber, totalPages }: Props) {
  return (
    <header className="flex items-center justify-between px-10 py-5 border-b-2 flex-shrink-0" style={{ borderColor: '#6690cc', margin: 0 }}>
      <RollingEnergyLogo variant="light" size="sm" className="flex-shrink-0" />

      <div className="text-center">
        <div
          className="text-base font-semibold tracking-wide"
          style={{ color: '#161c34', fontFamily: 'Poppins, sans-serif' }}
        >
          {pageTitle}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">Ref: {quoteNumber}</div>
      </div>

      <div className="text-right">
        <div
          className="text-xs font-medium px-3 py-1 rounded-full"
          style={{ background: '#eef3fb', color: '#3c5e94' }}
        >
          Page {pageNumber} / {totalPages}
        </div>
      </div>
    </header>
  );
}
