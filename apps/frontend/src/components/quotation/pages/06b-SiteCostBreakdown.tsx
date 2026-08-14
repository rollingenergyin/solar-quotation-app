'use client';

import QuotationHeader from '../QuotationHeader';
import QuotationFooter from '../QuotationFooter';
import type { SiteCostingPrintData } from '@/types/quotation-template';

interface Props {
  quoteNumber: string;
  siteCosting: SiteCostingPrintData;
  pageNumber: number;
  totalPages: number;
  sitePhotos?: { name: string; url: string }[];
}

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

const COMPLEXITY_STYLE: Record<string, { label: string; color: string }> = {
  EASY: { label: 'Easy Site', color: '#166534' },
  MODERATE: { label: 'Moderate Site', color: '#92400e' },
  COMPLEX: { label: 'Complex Site', color: '#991b1b' },
};

export default function SiteCostBreakdownPage({
  quoteNumber,
  siteCosting,
  pageNumber,
  totalPages,
  sitePhotos,
}: Props) {
  const cx = COMPLEXITY_STYLE[siteCosting.complexityScore] ?? COMPLEXITY_STYLE.MODERATE;

  return (
    <div className="quotation-page flex flex-col" style={{ background: '#ffffff' }}>
      <QuotationHeader
        quoteNumber={quoteNumber}
        pageTitle="Site Cost Breakdown"
        pageNumber={pageNumber}
        totalPages={totalPages}
      />

      <div className="flex-1 px-10 py-5" style={{ paddingBottom: '44px' }}>
        <h2
          className="text-xl font-bold mb-1"
          style={{ color: '#161c34', fontFamily: 'Poppins, sans-serif' }}
        >
          Installation Costing Engine
        </h2>
        <div className="h-0.5 w-10 mb-4" style={{ background: '#6690cc' }} />

        <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
          <div className="rounded-lg border px-3 py-2" style={{ borderColor: '#e5e7eb' }}>
            <p className="text-gray-500">System</p>
            <p className="font-bold text-gray-800">{siteCosting.systemSizeKw} kW · {siteCosting.numPanels} panels</p>
          </div>
          <div className="rounded-lg border px-3 py-2" style={{ borderColor: '#e5e7eb' }}>
            <p className="text-gray-500">Install Time</p>
            <p className="font-bold text-gray-800">{siteCosting.estimatedInstallDays}</p>
          </div>
          <div className="rounded-lg border px-3 py-2" style={{ borderColor: cx!.color }}>
            <p className="text-gray-500">Complexity</p>
            <p className="font-bold" style={{ color: cx!.color }}>{cx!.label}</p>
          </div>
        </div>

        {siteCosting.roofLayoutSuggestion && (
          <p className="text-xs text-gray-600 mb-3">
            <strong>Suggested layout:</strong> {siteCosting.roofLayoutSuggestion}
          </p>
        )}

        <div className="rounded-lg border overflow-hidden mb-4" style={{ borderColor: '#e5e7eb' }}>
          <div
            className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-wide"
            style={{ background: '#f8fafc', color: '#64748b' }}
          >
            <div className="col-span-6">Component</div>
            <div className="col-span-2 text-right">Qty</div>
            <div className="col-span-4 text-right">Amount</div>
          </div>
          {siteCosting.lineItems.map((item) => (
            <div
              key={item.key}
              className="grid grid-cols-12 gap-2 px-4 py-2 text-xs border-t"
              style={{ borderColor: '#f3f4f6' }}
            >
              <div className="col-span-6 font-medium text-gray-800">{item.label}</div>
              <div className="col-span-2 text-right text-gray-500 tabular-nums">
                {item.quantity != null ? `${item.quantity} ${item.unit ?? ''}` : '—'}
              </div>
              <div className="col-span-4 text-right font-semibold tabular-nums">{fmt(item.amount)}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{fmt(siteCosting.subtotal)}</span></div>
            {siteCosting.marginAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Margin ({siteCosting.profitMarginPct}%)</span>
                <span>{fmt(siteCosting.marginAmount)}</span>
              </div>
            )}
            <div className="flex justify-between"><span className="text-gray-500">GST ({siteCosting.gstPct}%)</span><span>{fmt(siteCosting.gstAmount)}</span></div>
            <div className="flex justify-between font-bold pt-1 border-t" style={{ borderColor: '#e5e7eb' }}>
              <span>Total</span><span style={{ color: '#6690cc' }}>{fmt(siteCosting.totalInclGst)}</span>
            </div>
          </div>
          <div className="rounded-lg px-3 py-2 text-xs" style={{ background: '#f0f4ff', border: '1px solid rgba(102,144,204,0.25)' }}>
            <p className="font-semibold mb-1" style={{ color: '#161c34' }}>Why Solar vs Grid?</p>
            <ul className="space-y-0.5 text-gray-600 list-disc pl-4">
              <li>30-year generation with near-zero running cost</li>
              <li>Protection from rising electricity tariffs</li>
              <li>PM Surya Ghar subsidy where applicable</li>
              <li>Increased property value & sustainability</li>
            </ul>
            {(siteCosting.leadQualificationScore ?? 0) > 0 && (
              <p className="mt-2 font-medium" style={{ color: '#6690cc' }}>
                Lead qualification score: {siteCosting.leadQualificationScore}/100
              </p>
            )}
          </div>
        </div>

        {sitePhotos && sitePhotos.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Site Survey Photos</p>
            <div className="grid grid-cols-3 gap-2">
              {sitePhotos.slice(0, 3).map((p, i) => (
                <div key={i} className="rounded-lg overflow-hidden border border-gray-200 aspect-[4/3] bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <QuotationFooter quoteNumber={quoteNumber} pageNumber={pageNumber} />
    </div>
  );
}
