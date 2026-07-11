'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import SiteCostingSummary from '@/components/site-costing/SiteCostingSummary';
import StructureAllocationEditor from '@/components/site-costing/StructureAllocationEditor';
import {
  BUILDING_HEIGHT_OPTIONS,
  DEFAULT_SITE_COSTING_FORM,
  METER_PHASE_OPTIONS,
  PANEL_WATTAGE_OPTIONS,
  SHADOW_FREE_SPACE_OPTIONS,
  SYSTEM_SIZE_PRESETS,
  WIRING_COMPLEXITY_OPTIONS,
  buildQuickQuoteHref,
  formStateToApiInputs,
  loadSiteCostingState,
  saveSiteCostingResult,
  saveSiteCostingState,
  type SiteCostingFormState,
  type SiteCostingResult,
} from '@/constants/site-costing';

const inputCls =
  'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white';

function FormCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
      {children}
    </label>
  );
}

function SelectGrid({
  options,
  value,
  onChange,
}: {
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
            value === o.value
              ? 'border-blue-400 bg-blue-50 text-blue-800'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function SiteCostingPage() {
  const router = useRouter();
  const [form, setForm] = useState<SiteCostingFormState>(() => loadSiteCostingState());
  const [result, setResult] = useState<SiteCostingResult | null>(null);
  const [loading, setLoading] = useState(false);

  const patch = useCallback((
    p: Partial<SiteCostingFormState> | ((prev: SiteCostingFormState) => Partial<SiteCostingFormState>),
  ) => {
    setForm((prev) => {
      const partial = typeof p === 'function' ? p(prev) : p;
      const next = { ...prev, ...partial };
      saveSiteCostingState(next);
      return next;
    });
  }, []);

  const recalculate = useCallback(async (state: SiteCostingFormState) => {
    setLoading(true);
    try {
      const data = await api<SiteCostingResult>('/site-costing/calculate', {
        method: 'POST',
        body: JSON.stringify({
          inputs: formStateToApiInputs(state),
          lineItemOverrides: state.lineItemOverrides,
          profitMarginPct: parseFloat(state.profitMarginPct) || 0,
        }),
      });
      setResult(data);
      saveSiteCostingResult(data);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => recalculate(form), 300);
    return () => clearTimeout(t);
  }, [form, recalculate]);

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/sales" className="text-gray-400 hover:text-gray-600 text-xl leading-none">←</Link>
          <div className="h-5 w-px bg-gray-200 hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏗️</span>
            <div>
              <h1 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Site Costing Engine
              </h1>
              <p className="text-xs text-gray-400">Automatic installation pricing from site assessment</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => router.push('/sales/site-costing/edit-pricing')}
            className="text-sm font-semibold px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700"
          >
            Edit Pricing
          </button>
          {result && result.systemSizeKw > 0 && (
            <Link
              href={buildQuickQuoteHref(form, result)}
              className="text-sm font-semibold px-4 py-2 rounded-lg text-white"
              style={{ background: '#6690cc' }}
            >
              Apply to Quick Quote →
            </Link>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 flex flex-col lg:flex-row gap-6 w-full">
        <div className="flex-1 space-y-5 min-w-0">
          <FormCard title="1. Building & Roof" icon="🏠">
            <div className="space-y-4">
              <div>
                <FieldLabel>Building Height</FieldLabel>
                <SelectGrid
                  options={BUILDING_HEIGHT_OPTIONS}
                  value={form.buildingHeight}
                  onChange={(v) => patch({ buildingHeight: v })}
                />
                {form.buildingHeight === 'CUSTOM' && (
                  <input
                    type="number"
                    min="0"
                    placeholder="Number of floors above ground"
                    value={form.buildingHeightCustomFloors}
                    onChange={(e) => patch({ buildingHeightCustomFloors: e.target.value })}
                    className={`${inputCls} mt-2 max-w-xs`}
                  />
                )}
              </div>
              <div>
                <FieldLabel>Shadow-Free Space Available</FieldLabel>
                <SelectGrid
                  options={SHADOW_FREE_SPACE_OPTIONS}
                  value={form.shadowFreeSpace}
                  onChange={(v) => patch({ shadowFreeSpace: v })}
                />
                {form.shadowFreeSpace === 'CUSTOM' && (
                  <input
                    type="number"
                    min="1"
                    placeholder="Sqft"
                    value={form.shadowFreeSpaceCustomSqft}
                    onChange={(e) => patch({ shadowFreeSpaceCustomSqft: e.target.value })}
                    className={`${inputCls} mt-2 max-w-xs`}
                  />
                )}
              </div>
            </div>
          </FormCard>

          <FormCard title="2. System Size" icon="⚡">
            <FieldLabel>Capacity</FieldLabel>
            <SelectGrid
              options={SYSTEM_SIZE_PRESETS}
              value={form.systemSizePreset}
              onChange={(v) => patch({ systemSizePreset: v })}
            />
            {form.systemSizePreset === 'CUSTOM' && (
              <input
                type="number"
                min="0.5"
                step="0.5"
                placeholder="kW"
                value={form.systemSizeKwCustom}
                onChange={(e) => patch({ systemSizeKwCustom: e.target.value })}
                className={`${inputCls} mt-2 max-w-xs text-right tabular-nums`}
              />
            )}
          </FormCard>

          <FormCard title="3. Wiring & Site Complexity" icon="🔌">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Terrace Wiring Complexity</FieldLabel>
                <SelectGrid
                  options={WIRING_COMPLEXITY_OPTIONS}
                  value={form.terraceWiringComplexity}
                  onChange={(v) => patch({ terraceWiringComplexity: v })}
                />
              </div>
              <div>
                <FieldLabel>Ground Wiring Complexity</FieldLabel>
                <SelectGrid
                  options={WIRING_COMPLEXITY_OPTIONS}
                  value={form.groundWiringComplexity}
                  onChange={(v) => patch({ groundWiringComplexity: v })}
                />
              </div>
            </div>
          </FormCard>

          <FormCard title="4. Margin & Photos" icon="📷">
            <div className="space-y-4">
              <div>
                <FieldLabel>Sales Margin ({form.profitMarginPct}%)</FieldLabel>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value={form.profitMarginPct}
                  onChange={(e) => patch({ profitMarginPct: e.target.value })}
                  className="w-full accent-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Applied to installation subtotal before GST</p>
              </div>
              <div>
                <FieldLabel>Site Survey Photos</FieldLabel>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="text-sm"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    files.forEach((file) => {
                      const reader = new FileReader();
                      reader.onload = () => {
                        const dataUrl = String(reader.result);
                        patch((prev) => ({
                          sitePhotos: [
                            ...prev.sitePhotos,
                            { name: file.name, url: dataUrl, dataUrl },
                          ],
                        }));
                      };
                      reader.readAsDataURL(file);
                    });
                    e.target.value = '';
                  }}
                />
                {form.sitePhotos.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {form.sitePhotos.map((p, i) => (
                      <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          className="absolute top-0 right-0 bg-red-500 text-white text-xs px-1"
                          onClick={() => patch({ sitePhotos: form.sitePhotos.filter((_, j) => j !== i) })}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </FormCard>

          <FormCard title="5. Structure Allocation" icon="📐">
            <StructureAllocationEditor
              entries={form.structureAllocations}
              panelWattageWp={result?.panelWattageWp ?? 540}
              totalPanels={result?.numPanels ?? 0}
              structureSummary={result?.structureSummary}
              onChange={(structureAllocations) => patch({ structureAllocations })}
            />
          </FormCard>

          <FormCard title="6. Equipment" icon="⚙️">
            <div className="space-y-4">
              <div>
                <FieldLabel>Panel Wattage</FieldLabel>
                <SelectGrid
                  options={PANEL_WATTAGE_OPTIONS}
                  value={form.panelWattage}
                  onChange={(v) => patch({ panelWattage: v })}
                />
                {form.panelWattage === 'CUSTOM' && (
                  <input
                    type="number"
                    min="100"
                    placeholder="Wp"
                    value={form.panelWattageCustom}
                    onChange={(e) => patch({ panelWattageCustom: e.target.value })}
                    className={`${inputCls} mt-2 max-w-xs`}
                  />
                )}
              </div>
              <div>
                <FieldLabel>Meter Phase</FieldLabel>
                <SelectGrid
                  options={METER_PHASE_OPTIONS}
                  value={form.meterPhase}
                  onChange={(v) => patch({ meterPhase: v })}
                />
              </div>
            </div>
          </FormCard>

          <p className="text-xs text-gray-400 px-1">
            Pricing updates automatically as you change options. Use <strong>Edit Pricing</strong> to adjust individual line items.
          </p>
        </div>

        <div className="w-full lg:w-80 shrink-0">
          <SiteCostingSummary result={result} loading={loading} />
        </div>
      </div>
    </div>
  );
}
