'use client';

import { useEffect, useState } from 'react';
import type {
  TemplatePaymentMilestone,
  TemplatePaymentMode,
  TemplateWarranty,
  TemplateBomItem,
} from '@/types/quotation-template';
import BomItemsEditor from './BomItemsEditor';
import WarrantyItemsEditor from './WarrantyItemsEditor';
import {
  filterProposalNotePlacementOptions,
  type ProposalNotePlacement,
} from '@/constants/proposal-note';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">{children}</label>;
}

type SectionKey = 'warranties' | 'bom' | 'payment' | 'terms' | 'note';

function CollapsibleSubSection({
  icon,
  title,
  open,
  onToggle,
  children,
}: {
  icon: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden mb-2 last:mb-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50/60 hover:bg-gray-50 text-left transition-colors"
      >
        <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <span>{icon}</span>
          {title}
        </span>
        <span className="text-[10px] text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 py-4 border-t border-gray-100 bg-white">
          {children}
        </div>
      )}
    </div>
  );
}

const inputCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300';

interface Props {
  sectionNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panelWarrantyYears: string;
  onPanelWarrantyYearsChange: (v: string) => void;
  warrantyItems: TemplateWarranty[];
  onWarrantyItemsChange: (items: TemplateWarranty[]) => void;
  bomItems: TemplateBomItem[];
  onBomItemsChange: (items: TemplateBomItem[]) => void;
  paymentMilestones: TemplatePaymentMilestone[];
  onPaymentMilestonesChange: (items: TemplatePaymentMilestone[]) => void;
  paymentModes: TemplatePaymentMode[];
  onPaymentModesChange: (items: TemplatePaymentMode[]) => void;
  paymentTermsBullets: string[];
  onPaymentTermsBulletsChange: (items: string[]) => void;
  quotationMode: 'SINGLE' | 'COMBINED';
  showDepreciation: boolean;
  proposalNoteText: string;
  onProposalNoteTextChange: (v: string) => void;
  proposalNotePlacement: ProposalNotePlacement;
  onProposalNotePlacementChange: (v: ProposalNotePlacement) => void;
}

export default function ProposalContentEditors({
  sectionNumber,
  open,
  onOpenChange,
  panelWarrantyYears,
  onPanelWarrantyYearsChange,
  warrantyItems,
  onWarrantyItemsChange,
  bomItems,
  onBomItemsChange,
  paymentMilestones,
  onPaymentMilestonesChange,
  paymentModes,
  onPaymentModesChange,
  paymentTermsBullets,
  onPaymentTermsBulletsChange,
  quotationMode,
  showDepreciation,
  proposalNoteText,
  onProposalNoteTextChange,
  proposalNotePlacement,
  onProposalNotePlacementChange,
}: Props) {
  const [sectionsOpen, setSectionsOpen] = useState<Record<SectionKey, boolean>>({
    warranties: false,
    bom: false,
    payment: false,
    terms: false,
    note: false,
  });

  const notePlacementOptions = filterProposalNotePlacementOptions({
    quotationMode,
    showDepreciation,
  });

  useEffect(() => {
    if (!open) {
      setSectionsOpen({ warranties: false, bom: false, payment: false, terms: false, note: false });
    }
  }, [open]);

  useEffect(() => {
    if (!notePlacementOptions.some((opt) => opt.value === proposalNotePlacement)) {
      onProposalNotePlacementChange(notePlacementOptions[0]?.value ?? 'executive_summary');
    }
  }, [notePlacementOptions, proposalNotePlacement, onProposalNotePlacementChange]);

  const toggleSection = (key: SectionKey) => {
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">✏️</span>
          <h3 className="text-sm font-semibold text-gray-700">{sectionNumber}. Proposal Deep Edit</h3>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 flex items-center gap-1.5"
        >
          Edit Deeply
          <span className="text-[10px] opacity-70">{open ? '▲' : '▼'}</span>
        </button>
      </div>

      {!open && (
        <div className="px-5 py-3 text-xs text-gray-400">
          Default proposal content from the active template applies. Open <strong>Edit Deeply</strong> to
          customise warranties, BOM, payment terms, terms &amp; conditions, and an optional proposal note before generating.
        </div>
      )}

      {open && (
        <div className="px-5 py-4">
          <CollapsibleSubSection
            icon="🛡️"
            title="Warranties"
            open={sectionsOpen.warranties}
            onToggle={() => toggleSection('warranties')}
          >
            <WarrantyItemsEditor
              items={warrantyItems}
              onChange={onWarrantyItemsChange}
              panelWarrantyYears={panelWarrantyYears}
              onPanelWarrantyYearsChange={onPanelWarrantyYearsChange}
            />
          </CollapsibleSubSection>

          <CollapsibleSubSection
            icon="📦"
            title="Bill of Materials"
            open={sectionsOpen.bom}
            onToggle={() => toggleSection('bom')}
          >
            <BomItemsEditor items={bomItems} onChange={onBomItemsChange} />
          </CollapsibleSubSection>

          <CollapsibleSubSection
            icon="💳"
            title="Payment Terms"
            open={sectionsOpen.payment}
            onToggle={() => toggleSection('payment')}
          >
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Payment Milestones</p>
            <div className="space-y-3 mb-4">
              {paymentMilestones.map((m, i) => (
                <div key={i} className="p-3 rounded-xl bg-gray-50 border border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <FieldLabel>Step</FieldLabel>
                    <input
                      type="text"
                      value={m.step}
                      onChange={(e) => {
                        const next = [...paymentMilestones];
                        next[i] = { ...next[i]!, step: e.target.value };
                        onPaymentMilestonesChange(next);
                      }}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <FieldLabel>Icon</FieldLabel>
                    <input
                      type="text"
                      value={m.icon}
                      onChange={(e) => {
                        const next = [...paymentMilestones];
                        next[i] = { ...next[i]!, icon: e.target.value };
                        onPaymentMilestonesChange(next);
                      }}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <FieldLabel>Title</FieldLabel>
                    <input
                      type="text"
                      value={m.title}
                      onChange={(e) => {
                        const next = [...paymentMilestones];
                        next[i] = { ...next[i]!, title: e.target.value };
                        onPaymentMilestonesChange(next);
                      }}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <FieldLabel>Share (%)</FieldLabel>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={m.pct}
                      onChange={(e) => {
                        const next = [...paymentMilestones];
                        next[i] = { ...next[i]!, pct: Number(e.target.value) };
                        onPaymentMilestonesChange(next);
                      }}
                      className={inputCls}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <FieldLabel>Description</FieldLabel>
                    <textarea
                      value={m.desc}
                      onChange={(e) => {
                        const next = [...paymentMilestones];
                        next[i] = { ...next[i]!, desc: e.target.value };
                        onPaymentMilestonesChange(next);
                      }}
                      rows={2}
                      className={`${inputCls} resize-vertical`}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onPaymentMilestonesChange([
                ...paymentMilestones,
                {
                  step: String(paymentMilestones.length + 1).padStart(2, '0'),
                  title: '',
                  pct: 0,
                  desc: '',
                  icon: '💳',
                },
              ])}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium mb-6 block"
            >
              + Add milestone
            </button>

            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Accepted Payment Modes</p>
            <div className="space-y-2">
              {paymentModes.map((mode, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={mode.icon}
                    onChange={(e) => {
                      const next = [...paymentModes];
                      next[i] = { ...next[i]!, icon: e.target.value };
                      onPaymentModesChange(next);
                    }}
                    className="w-16 border border-gray-200 rounded-lg px-2 py-2 text-sm text-center"
                    placeholder="🏦"
                  />
                  <input
                    type="text"
                    value={mode.label}
                    onChange={(e) => {
                      const next = [...paymentModes];
                      next[i] = { ...next[i]!, label: e.target.value };
                      onPaymentModesChange(next);
                    }}
                    className={`${inputCls} flex-1`}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onPaymentModesChange([...paymentModes, { icon: '💳', label: '' }])}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium mt-2"
            >
              + Add payment mode
            </button>
          </CollapsibleSubSection>

          <CollapsibleSubSection
            icon="📝"
            title="Add Note"
            open={sectionsOpen.note}
            onToggle={() => toggleSection('note')}
          >
            <p className="text-xs text-gray-500 mb-3">
              Leave blank to show no note on the proposal. When filled, the note appears on the page you select below.
            </p>
            <div className="space-y-3">
              <div>
                <FieldLabel>Note text</FieldLabel>
                <textarea
                  value={proposalNoteText}
                  onChange={(e) => onProposalNoteTextChange(e.target.value)}
                  rows={4}
                  placeholder="e.g. Installation timeline subject to DISCOM approval…"
                  className={`${inputCls} resize-vertical`}
                />
              </div>
              <div>
                <FieldLabel>Show note on page</FieldLabel>
                <select
                  value={proposalNotePlacement}
                  onChange={(e) => onProposalNotePlacementChange(e.target.value as ProposalNotePlacement)}
                  className={inputCls}
                  disabled={!proposalNoteText.trim()}
                >
                  {notePlacementOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {!proposalNoteText.trim() && (
                  <p className="text-xs text-gray-400 mt-1">Enter note text to choose a page.</p>
                )}
              </div>
            </div>
          </CollapsibleSubSection>

          <CollapsibleSubSection
            icon="📋"
            title="Terms & Conditions"
            open={sectionsOpen.terms}
            onToggle={() => toggleSection('terms')}
          >
            <div className="space-y-2">
              {paymentTermsBullets.map((bullet, i) => (
                <div key={i} className="flex gap-2">
                  <textarea
                    value={bullet}
                    onChange={(e) => {
                      const next = [...paymentTermsBullets];
                      next[i] = e.target.value;
                      onPaymentTermsBulletsChange(next);
                    }}
                    rows={2}
                    className={`${inputCls} resize-vertical flex-1`}
                  />
                  <button
                    type="button"
                    onClick={() => onPaymentTermsBulletsChange(paymentTermsBullets.filter((_, idx) => idx !== i))}
                    className="text-red-400 hover:text-red-600 text-lg px-1 self-start"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onPaymentTermsBulletsChange([...paymentTermsBullets, ''])}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium mt-2"
            >
              + Add term
            </button>
          </CollapsibleSubSection>
        </div>
      )}
    </div>
  );
}
