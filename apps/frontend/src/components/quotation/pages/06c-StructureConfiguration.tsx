'use client';

import QuotationHeader from '../QuotationHeader';
import QuotationFooter from '../QuotationFooter';
import type { StructureAllocationSummary } from '@/constants/structure-allocation';

interface Props {
  quoteNumber: string;
  structureSummary: StructureAllocationSummary;
  pageNumber: number;
  totalPages: number;
}

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

export default function StructureConfigurationPage({
  quoteNumber,
  structureSummary,
  pageNumber,
  totalPages,
}: Props) {
  return (
    <div className="quotation-page flex flex-col" style={{ background: '#ffffff' }}>
      <QuotationHeader
        quoteNumber={quoteNumber}
        pageTitle="Structure Configuration"
        pageNumber={pageNumber}
        totalPages={totalPages}
      />

      <div className="flex-1 px-10 py-5" style={{ paddingBottom: '44px' }}>
        <h2
          className="text-xl font-bold mb-1"
          style={{ color: '#161c34', fontFamily: 'Poppins, sans-serif' }}
        >
          Structure Configuration Summary
        </h2>
        <div className="h-0.5 w-10 mb-5" style={{ background: '#6690cc' }} />

        <div className="space-y-4 mb-6">
          {structureSummary.entries.map((entry, index) => (
            <div
              key={entry.id}
              className="rounded-lg border border-gray-100 px-4 py-3"
              style={{ background: '#f8fafc' }}
            >
              <p className="text-sm font-semibold mb-1" style={{ color: '#161c34' }}>
                {index + 1}. {entry.label}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-600 mt-2">
                <div>
                  <span className="text-gray-400 block">Structures</span>
                  <span className="font-medium">{entry.numStructures}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Panels</span>
                  <span className="font-medium">{entry.numPanels}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Capacity</span>
                  <span className="font-medium">{entry.capacityKw} kW</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Cost</span>
                  <span className="font-medium">{fmt(entry.totalCost)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div
          className="rounded-lg px-5 py-4 text-sm"
          style={{ background: 'linear-gradient(135deg, #161c34, #1e2f4d)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#6690cc' }}>
            Combined Structure Costs
          </p>
          <div className="space-y-2 text-white/90">
            <div className="flex justify-between">
              <span>Total Fabrication Cost</span>
              <span className="font-semibold">{fmt(structureSummary.totalFabricationCost)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Structure Cost</span>
              <span className="font-semibold">{fmt(structureSummary.totalStructureCost)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Raised Structure Cost</span>
              <span className="font-semibold">{fmt(structureSummary.totalRaisedStructureCost)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-white/20 text-base">
              <span className="font-bold">Combined Total</span>
              <span className="font-bold">{fmt(structureSummary.totalCost)}</span>
            </div>
          </div>
        </div>
      </div>

      <QuotationFooter quoteNumber={quoteNumber} pageNumber={pageNumber} />
    </div>
  );
}
