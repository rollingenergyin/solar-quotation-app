'use client';

import type { Dispatch, SetStateAction } from 'react';
import { SectionCard } from './SectionCard';

const SPGS_COMPONENTS = [
  'Solar Modules (Inclusive)',
  'Inverter (Inclusive)',
  'BOS & Structure (Inclusive)',
  'Installation (Inclusive)',
  'Commissioning (Inclusive)',
  'Labour (Inclusive)',
];

export type SpgsPricingMode = 'perWatt' | 'totalInclGst' | 'baseExclGst';
export type SpgsGstMode = 'blended' | 'split' | 'epc';

export interface SpgsFormState {
  siteName: string;
  siteAddress: string;
  systemSizeKw: number;
  panelWattage: number;
  panelSerialText: string;
  pricingMode: SpgsPricingMode;
  perWatt: number;
  totalInclGst: number;
  baseExclGst: number;
  gstMode: SpgsGstMode;
  blendedGstPercent: number;
  splitPortion12: number;
  splitPortion18: number;
}

export interface SpgsPreview {
  baseExclGst: number;
  gstAmount: number;
  totalInclGst: number;
  perWattDerived: number;
  gstBreakdownLines: { label: string; amount: number }[];
}

interface AnnexItem {
  label: string;
  fileName: string;
  fileUrl: string;
}

interface Props {
  spgs: SpgsFormState;
  setSpgs: Dispatch<SetStateAction<SpgsFormState>>;
  spgsPreview: SpgsPreview;
  annexureDraft: { label: string; file: File | null };
  setAnnexureDraft: Dispatch<SetStateAction<{ label: string; file: File | null }>>;
  annexures: AnnexItem[];
  setAnnexures: Dispatch<SetStateAction<AnnexItem[]>>;
  uploadingAnnex: boolean;
  onAddAnnexure: () => void | Promise<void>;
}

export function SpgsInvoiceEditor({
  spgs,
  setSpgs,
  spgsPreview,
  annexureDraft,
  setAnnexureDraft,
  annexures,
  setAnnexures,
  uploadingAnnex,
  onAddAnnexure,
}: Props) {
  const inputClass =
    'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

  return (
    <div className="space-y-6">
      <SectionCard
        eyebrow="Turnkey SPGS"
        title="Site & system"
        description="Where the plant is installed and rated capacity — mirrors the PDF site block."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Site / project name</span>
            <input
              className={inputClass}
              value={spgs.siteName}
              onChange={(e) => setSpgs((s) => ({ ...s, siteName: e.target.value }))}
              placeholder="e.g. Park 59 — Block C"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Site location</span>
            <input
              className={inputClass}
              value={spgs.siteAddress}
              onChange={(e) => setSpgs((s) => ({ ...s, siteAddress: e.target.value }))}
              placeholder="Full address"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Total system size (kW DC) *</span>
            <input
              type="number"
              min={0}
              step={0.01}
              className={inputClass}
              value={spgs.systemSizeKw || ''}
              onChange={(e) => setSpgs((s) => ({ ...s, systemSizeKw: Number(e.target.value) || 0 }))}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Panel wattage (Wp)</span>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={spgs.panelWattage || ''}
              onChange={(e) => setSpgs((s) => ({ ...s, panelWattage: Number(e.target.value) || 0 }))}
            />
          </label>
        </div>
        <label className="mt-4 block text-sm">
          <span className="font-medium text-slate-700">Panel serial numbers</span>
          <textarea
            className={`${inputClass} min-h-[88px] resize-y`}
            value={spgs.panelSerialText}
            onChange={(e) => setSpgs((s) => ({ ...s, panelSerialText: e.target.value }))}
            placeholder="Comma or newline separated"
          />
        </label>
      </SectionCard>

      <SectionCard
        eyebrow="Scope"
        title="What the PDF describes"
        description="Fixed narrative for turnkey SPGS — components listed for transparency only."
      >
        <p className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm leading-relaxed text-slate-700">
          Supply, installation and commissioning of grid-connected solar photovoltaic (SPGS) system on turnkey
          basis.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {SPGS_COMPONENTS.map((c) => (
            <span
              key={c}
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
            >
              {c}
            </span>
          ))}
        </div>
        <p className="mt-4 text-sm font-semibold text-emerald-700">System is all-inclusive.</p>
      </SectionCard>

      <SectionCard
        eyebrow="Pricing"
        title="Single commercial summary"
        description="Enter one price basis — we derive the rest to match the server PDF."
      >
        <p className="mb-4 text-sm text-slate-500">Choose exactly one pricing input.</p>
        <div className="flex flex-wrap gap-4 text-sm">
          {(
            [
              ['perWatt', 'Rs. / W'],
              ['totalInclGst', 'Total (incl. GST)'],
              ['baseExclGst', 'Taxable base'],
            ] as const
          ).map(([mode, label]) => (
            <label
              key={mode}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 ${
                spgs.pricingMode === mode
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="pm"
                checked={spgs.pricingMode === mode}
                onChange={() => setSpgs((s) => ({ ...s, pricingMode: mode }))}
                className="text-blue-600"
              />
              <span className="font-medium text-slate-800">{label}</span>
            </label>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {spgs.pricingMode === 'perWatt' && (
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Rs. per watt</span>
              <input
                type="number"
                min={0}
                step={0.01}
                className={inputClass}
                value={spgs.perWatt || ''}
                onChange={(e) => setSpgs((s) => ({ ...s, perWatt: Number(e.target.value) || 0 }))}
              />
            </label>
          )}
          {spgs.pricingMode === 'totalInclGst' && (
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Total incl. GST</span>
              <input
                type="number"
                min={0}
                step={0.01}
                className={inputClass}
                value={spgs.totalInclGst || ''}
                onChange={(e) => setSpgs((s) => ({ ...s, totalInclGst: Number(e.target.value) || 0 }))}
              />
            </label>
          )}
          {spgs.pricingMode === 'baseExclGst' && (
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Taxable value</span>
              <input
                type="number"
                min={0}
                step={0.01}
                className={inputClass}
                value={spgs.baseExclGst || ''}
                onChange={(e) => setSpgs((s) => ({ ...s, baseExclGst: Number(e.target.value) || 0 }))}
              />
            </label>
          )}
        </div>

        <div className="mt-8 border-t border-slate-100 pt-6">
          <span className="text-sm font-semibold text-slate-800">GST (EPC structure)</span>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Taxable value is split as <strong>70%</strong> assessed at <strong>5% GST</strong> and{' '}
            <strong>30%</strong> at <strong>18% GST</strong> (typical EPC treatment). CGST and SGST each equal half
            of the total GST. Effective rate on the full taxable value is approximately <strong>8.9%</strong>.
          </p>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">Live preview</p>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between border-b border-white/10 pb-2">
              <span className="text-slate-300">System size</span>
              <span className="font-medium">{spgs.systemSizeKw || '—'} kW</span>
            </div>
            <div className="flex justify-between border-b border-white/10 pb-2">
              <span className="text-slate-300">Rs./W</span>
              <span>Rs. {spgsPreview.perWattDerived.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-b border-white/10 pb-2">
              <span className="text-slate-300">Taxable value</span>
              <span>Rs. {spgsPreview.baseExclGst.toLocaleString('en-IN')}</span>
            </div>
            {spgsPreview.gstBreakdownLines.map((line, i) => (
              <div key={i} className="flex justify-between text-slate-200">
                <span className="max-w-[65%] text-xs">{line.label}</span>
                <span>Rs. {line.amount.toLocaleString('en-IN')}</span>
              </div>
            ))}
            <div className="mt-2 flex items-end justify-between border-t border-white/20 pt-4">
              <span className="text-lg font-semibold">Amount payable</span>
              <span className="text-2xl font-bold tracking-tight text-blue-300">
                Rs. {spgsPreview.totalInclGst.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard eyebrow="Records" title="Annexures" description="DCR, warranties — summarized in the PDF footer when attached.">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="font-medium text-slate-700">Type</span>
            <select
              className={`${inputClass} mt-1`}
              value={annexureDraft.label}
              onChange={(e) => setAnnexureDraft((d) => ({ ...d, label: e.target.value }))}
            >
              <option value="DCR certificate">DCR certificate</option>
              <option value="Warranty documents">Warranty documents</option>
              <option value="BOS warranty">BOS warranty</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium text-slate-700">File</span>
            <input
              type="file"
              className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium"
              onChange={(e) => setAnnexureDraft((d) => ({ ...d, file: e.target.files?.[0] ?? null }))}
            />
          </label>
          <button
            type="button"
            disabled={uploadingAnnex}
            onClick={() => void onAddAnnexure()}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-slate-800 disabled:opacity-50"
          >
            {uploadingAnnex ? 'Uploading…' : 'Add to invoice'}
          </button>
        </div>
        {annexures.length > 0 && (
          <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
            {annexures.map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <span className="text-slate-700">
                  {a.label} <span className="text-slate-400">· {a.fileName}</span>
                </span>
                <button
                  type="button"
                  className="text-xs font-medium text-rose-600 hover:text-rose-700"
                  onClick={() => setAnnexures((prev) => prev.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
