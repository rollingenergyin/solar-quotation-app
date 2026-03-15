'use client';

interface Props {
  quoteNumber: string;
  pageNumber: number;
}

export default function QuotationFooter({ quoteNumber, pageNumber }: Props) {
  return (
    <footer
      className="absolute bottom-0 left-0 right-0 w-full flex items-center justify-between px-10 py-3 text-xs flex-shrink-0"
      style={{ background: '#161c34', color: 'rgba(255,255,255,0.6)' }}
    >
      <span style={{ color: '#6690cc' }} className="font-semibold">Rolling Energy — Solar EPC Company</span>
      <span>CONFIDENTIAL · Quotation {quoteNumber}</span>
      <span>
        <span style={{ color: '#6690cc' }}>●</span> Page {pageNumber}
      </span>
    </footer>
  );
}
