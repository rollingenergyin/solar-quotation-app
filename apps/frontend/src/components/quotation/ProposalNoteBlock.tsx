import type { ProposalNote, ProposalNotePlacement } from '@/constants/proposal-note';

interface Props {
  placement: ProposalNotePlacement;
  proposalNote?: ProposalNote | null;
}

export default function ProposalNoteBlock({ placement, proposalNote }: Props) {
  const text = proposalNote?.text?.trim();
  if (!text || proposalNote?.placement !== placement) return null;

  return (
    <div
      className="mt-4 rounded-lg border px-4 py-3 quotation-no-break"
      style={{ borderColor: '#fde68a', background: 'linear-gradient(135deg, #fffbeb, #ffffff)' }}
    >
      <p className="text-xs font-semibold tracking-widest uppercase mb-1.5" style={{ color: '#b45309' }}>
        Note
      </p>
      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#78350f' }}>
        {text}
      </p>
    </div>
  );
}
