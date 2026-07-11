'use client';

import QuotationHeader from '../QuotationHeader';
import QuotationFooter from '../QuotationFooter';
import ProposalNoteBlock from '../ProposalNoteBlock';
import type { CostingOptionCalculated } from '@/constants/costing-options';
import type { CostingPrintPageSlice } from '@/constants/costing-options';
import type { ProposalNote } from '@/constants/proposal-note';
import {
  OrSeparator,
  PmSuryaGharNote,
  CostingOptionBlock,
  type CostingBlockLayout,
} from '../CostingSharedBlocks';

interface Props {
  quoteNumber: string;
  options: CostingOptionCalculated[];
  slice: CostingPrintPageSlice;
  pageNumber: number;
  totalPages: number;
  proposalNote?: ProposalNote | null;
  showProposalNote?: boolean;
}

export default function CostingOptionsPage({
  quoteNumber,
  options,
  slice,
  pageNumber,
  totalPages,
  proposalNote,
  showProposalNote = true,
}: Props) {
  const pageOptions = slice.optionIndices.map((i) => options[i]).filter(Boolean);
  const footerOption = options[options.length - 1];
  const multiAlt = options.length > 1;
  const paired = multiAlt && pageOptions.length === 2;
  const optionLayout: CostingBlockLayout = paired
    ? 'paired'
    : multiAlt
      ? 'compact'
      : 'normal';

  const pageTitle = options.length > 1
    ? 'Alternative Costing Options'
    : 'Offer & Cost Breakdown';

  return (
    <div className="quotation-page flex flex-col" style={{ background: '#ffffff' }}>
      <QuotationHeader
        quoteNumber={quoteNumber}
        pageTitle={pageTitle}
        pageNumber={pageNumber}
        totalPages={totalPages}
      />

      <div
        className={`flex-1 flex flex-col ${
          paired ? 'px-12 py-5' : multiAlt ? 'px-10 py-4' : 'px-12 py-6'
        }`}
        style={{ paddingBottom: paired ? '36px' : multiAlt ? '32px' : '36px' }}
      >
        <div className={paired ? 'mb-5' : multiAlt ? 'mb-4' : 'mb-6'}>
          <p
            className="text-xs font-semibold tracking-widest uppercase mb-1"
            style={{ color: '#6690cc' }}
          >
            Financial Offer
          </p>
          {!multiAlt && (
            <h2
              className={`font-bold ${paired ? 'text-xl' : 'text-2xl'}`}
              style={{ color: '#161c34', fontFamily: 'Poppins, sans-serif' }}
            >
              Detailed Cost Breakdown
            </h2>
          )}
          <div className="mt-2 h-0.5 w-12" style={{ background: '#6690cc' }} />
        </div>

        <div className={paired ? 'flex-1 flex flex-col gap-3 min-h-0' : undefined}>
          {pageOptions.map((opt, idx) => (
            <div key={opt.index} className={paired ? 'flex flex-col' : undefined}>
              {idx > 0 && <OrSeparator layout={optionLayout} />}
              <CostingOptionBlock
                option={opt}
                layout={optionLayout}
                showOptionTitle={multiAlt}
              />
            </div>
          ))}
        </div>

        {slice.footerBundle === 'full' && footerOption && options.length <= 1 && (
          <div className="mt-6">
            <PmSuryaGharNote option={footerOption} />
          </div>
        )}

        {showProposalNote && (
          <ProposalNoteBlock placement="cost_breakdown" proposalNote={proposalNote} />
        )}
      </div>

      <QuotationFooter quoteNumber={quoteNumber} pageNumber={pageNumber} />
    </div>
  );
}
