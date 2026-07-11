export type ProposalNotePlacement =
  | 'introduction_letter'
  | 'our_process'
  | 'executive_summary'
  | 'bill_of_materials'
  | 'maintenance_services'
  | 'combined_systems'
  | 'cost_breakdown'
  | 'depreciation'
  | 'payment_terms'
  | 'loan_emi'
  | 'roi_analysis'
  | 'why_choose_us';

export interface ProposalNote {
  text: string;
  placement: ProposalNotePlacement;
}

export const PROPOSAL_NOTE_PLACEMENT_OPTIONS: {
  value: ProposalNotePlacement;
  label: string;
  combinedOnly?: boolean;
  depreciationOnly?: boolean;
}[] = [
  { value: 'introduction_letter', label: 'Introduction Letter' },
  { value: 'our_process', label: 'Our Process' },
  { value: 'executive_summary', label: 'Executive Summary' },
  { value: 'bill_of_materials', label: 'Bill of Materials' },
  { value: 'maintenance_services', label: 'Maintenance & Services' },
  { value: 'combined_systems', label: 'Combined Systems', combinedOnly: true },
  { value: 'cost_breakdown', label: 'Offer & Cost Breakdown' },
  { value: 'depreciation', label: 'Depreciation', depreciationOnly: true },
  { value: 'payment_terms', label: 'Payment Terms' },
  { value: 'loan_emi', label: 'Loan & EMI' },
  { value: 'roi_analysis', label: 'ROI Analysis' },
  { value: 'why_choose_us', label: 'Why Choose Us' },
];

export function filterProposalNotePlacementOptions(opts: {
  quotationMode?: 'SINGLE' | 'COMBINED';
  showDepreciation?: boolean;
}): typeof PROPOSAL_NOTE_PLACEMENT_OPTIONS {
  return PROPOSAL_NOTE_PLACEMENT_OPTIONS.filter((opt) => {
    if (opt.combinedOnly && opts.quotationMode !== 'COMBINED') return false;
    if (opt.depreciationOnly && !opts.showDepreciation) return false;
    return true;
  });
}
