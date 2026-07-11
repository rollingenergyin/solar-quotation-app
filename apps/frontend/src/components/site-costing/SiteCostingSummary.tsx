'use client';

import type { SiteCostingResult } from '@/constants/site-costing';
import { COMPLEXITY_LABELS } from '@/constants/site-costing';

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

interface Props {
  result: SiteCostingResult | null;
  loading?: boolean;
}

export default function SiteCostingSummary({ result, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-sm text-gray-400">
        Calculating…
      </div>
    );
  }

  if (!result || result.systemSizeKw <= 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-sm text-gray-400">
        Select site options to see automatic installation pricing.
      </div>
    );
  }

  const cx = COMPLEXITY_LABELS[result.complexityScore] ?? COMPLEXITY_LABELS.MODERATE;

  return (
    <div className="space-y-4 lg:sticky lg:top-24">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50" style={{ background: 'linear-gradient(135deg, #161c34, #1e2f4d)' }}>
          <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#6690cc' }}>
            Auto Cost Summary
          </p>
          <p className="text-2xl font-bold text-white mt-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
            {fmt(result.totalInclGst)}
          </p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
            incl. GST ({result.gstPct}%) · ₹{result.pricePerWatt}/W base
          </p>
        </div>

        <div className="px-5 py-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">System Size</span>
            <span className="font-semibold">{result.systemSizeKw} kW</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Panels</span>
            <span className="font-semibold">{result.numPanels} × {result.panelWattageWp} W</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Subtotal (ex GST)</span>
            <span className="font-semibold">{fmt(result.subtotal)}</span>
          </div>
          {result.marginAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Margin ({result.profitMarginPct}%)</span>
              <span className="font-semibold">{fmt(result.marginAmount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">GST</span>
            <span className="font-semibold">{fmt(result.gstAmount)}</span>
          </div>

          <div
            className="rounded-lg px-3 py-2 text-xs font-semibold text-center"
            style={{ color: cx.color, background: cx.bg }}
          >
            {cx.label}
          </div>

          <div className="text-xs text-gray-500 border-t border-gray-100 pt-3 space-y-1">
            <p>Est. install: <strong className="text-gray-700">{result.estimatedInstallDays}</strong></p>
            {result.roofLayoutSuggestion && (
              <p><strong>Layout:</strong> {result.roofLayoutSuggestion}</p>
            )}
            {result.recommendedMaxKw != null && (
              <p>Roof capacity hint: ~<strong className="text-gray-700">{result.recommendedMaxKw} kW</strong></p>
            )}
            <p>Lead score: <strong className="text-gray-700">{result.leadQualificationScore}/100</strong></p>
          </div>
        </div>
      </div>

      {result.structureSummary && result.structureSummary.entries.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Structure Allocation
          </p>
          <ol className="space-y-2 text-xs text-gray-600 list-decimal list-inside">
            {result.structureSummary.entries.map((e) => (
              <li key={e.id} className="leading-snug">
                {e.label}
              </li>
            ))}
          </ol>
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Fabrication</span>
              <span>{fmt(result.structureSummary.totalFabricationCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Structure</span>
              <span>{fmt(result.structureSummary.totalStructureCost)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Combined</span>
              <span>{fmt(result.structureSummary.totalCost)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Line Items</p>
        <div className="space-y-1.5 max-h-64 overflow-y-auto text-sm">
          {result.lineItems.map((item) => (
            <div key={item.key} className="flex justify-between gap-2">
              <span className="text-gray-600 truncate">{item.label}</span>
              <span className="font-medium tabular-nums shrink-0">{fmt(item.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
