'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { TemplateConfig, TemplateBomItem } from '@/types/quotation-template';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// ── Reusable field components ─────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">{children}</label>;
}
function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
    />
  );
}
function TextArea({ value, onChange, rows = 3, placeholder }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-vertical"
    />
  );
}

// Editable list of strings
function StringListEditor({ items, onChange, addLabel = '+ Add item', placeholder = 'Enter text…' }: {
  items: string[];
  onChange: (items: string[]) => void;
  addLabel?: string;
  placeholder?: string;
}) {
  const update = (i: number, v: string) => { const n = [...items]; n[i] = v; onChange(n); };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add    = () => onChange([...items, '']);
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <TextInput value={item} onChange={(v) => update(i, v)} placeholder={placeholder} />
          <button onClick={() => remove(i)} className="text-red-400 hover:text-red-600 text-lg px-1">×</button>
        </div>
      ))}
      <button onClick={add} className="text-sm text-blue-600 hover:text-blue-800 font-medium">{addLabel}</button>
    </div>
  );
}

// Generic object array editor
function ObjectListEditor<T extends Record<string, string | number>>({
  items, onChange, fields, addLabel = '+ Add', defaultItem,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  fields: { key: keyof T; label: string; type?: 'text' | 'number' | 'textarea'; placeholder?: string }[];
  addLabel?: string;
  defaultItem: T;
}) {
  const update = (i: number, key: keyof T, v: string | number) => {
    const n = [...items] as T[];
    n[i] = { ...n[i], [key]: v };
    onChange(n);
  };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add    = () => onChange([...items, { ...defaultItem }]);

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="border border-gray-100 rounded-xl p-4 bg-gray-50 relative">
          <button
            onClick={() => remove(i)}
            className="absolute top-2 right-2 text-gray-400 hover:text-red-500 text-lg"
          >
            ×
          </button>
          <div className="grid grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={String(f.key)} className={f.type === 'textarea' ? 'col-span-2' : ''}>
                <FieldLabel>{f.label}</FieldLabel>
                {f.type === 'textarea' ? (
                  <TextArea
                    value={String(item[f.key] ?? '')}
                    onChange={(v) => update(i, f.key, v)}
                    rows={2}
                    placeholder={f.placeholder}
                  />
                ) : f.type === 'number' ? (
                  <input
                    type="number"
                    value={Number(item[f.key] ?? 0)}
                    onChange={(e) => update(i, f.key, Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                ) : (
                  <TextInput value={String(item[f.key] ?? '')} onChange={(v) => update(i, f.key, v)} placeholder={f.placeholder} />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      <button onClick={add} className="text-sm text-blue-600 hover:text-blue-800 font-medium">{addLabel}</button>
    </div>
  );
}

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  { id: 'company',     label: 'Company Info' },
  { id: 'bom',         label: '📦 BOM Config' },
  { id: 'subsidy',     label: '💰 Subsidy & Depreciation' },
  { id: 'intro',       label: 'Intro Letter' },
  { id: 'about',       label: 'About Company' },
  { id: 'process',     label: 'Our Process' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'payment',     label: 'Payment Terms' },
  { id: 'why',         label: 'Why Choose Us' },
  { id: 'contact',     label: 'Contact' },
];

// ── Main editor page ──────────────────────────────────────────────────────────
export default function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew  = id === 'new';

  const [template, setTemplate] = useState<Partial<TemplateConfig> | null>(null);
  const [loading,  setLoading]  = useState(!isNew);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [saved,    setSaved]    = useState(false);
  const [activeTab, setActiveTab] = useState('company');

  // For new template: load active template as base
  const loadTemplate = useCallback(async (templateId: string) => {
    try {
      const url = templateId === 'new' ? `${API}/templates/active` : `${API}/templates/${templateId}`;
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to load template');
      const data = await res.json();
      setTemplate(isNew ? { ...data, id: undefined, name: `${data.name} (New Version)` } : data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  }, [isNew]);

  useEffect(() => {
    loadTemplate(id);
  }, [id, loadTemplate]);

  const save = async () => {
    if (!template) return;
    setSaving(true);
    setError('');
    try {
      let res: Response;
      if (isNew) {
        res = await fetch(`${API}/templates`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(template),
        });
      } else {
        res = await fetch(`${API}/templates/${id}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify(template),
        });
      }
      if (!res.ok) throw new Error(await res.text());
      const saved_data = await res.json();
      if (isNew) {
        router.push(`/admin/templates/${saved_data.id}`);
      } else {
        setTemplate(saved_data);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const set = <K extends keyof TemplateConfig>(key: K, val: TemplateConfig[K]) => {
    setTemplate((prev) => prev ? { ...prev, [key]: val } : prev);
  };

  if (loading) return <div className="p-8 text-gray-500">Loading template…</div>;
  if (!template) return <div className="p-8 text-red-500">Template not found.</div>;

  const t = template as TemplateConfig;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{isNew ? 'New Template' : `Edit: ${t.name}`}</h1>
            {!isNew && (
              <p className="text-xs text-gray-400">
                v{(template as TemplateConfig).version} · {(template as TemplateConfig).isActive ? '✓ Active' : 'Inactive'}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-600 font-medium">✓ Saved</span>}
          {error  && <span className="text-sm text-red-500">{error}</span>}
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: '#6690cc' }}
          >
            {saving ? 'Saving…' : isNew ? 'Create Template' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-8 flex gap-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 px-8 py-6 max-w-4xl mx-auto w-full">

        {/* ── Company Info ──────────────────────────────────────────────── */}
        {activeTab === 'company' && (
          <Section title="Company Information" desc="These details appear throughout the proposal — cover page, header, footer, and contact page.">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>Company Name</FieldLabel>
                <TextInput value={t.companyName ?? ''} onChange={(v) => set('companyName', v)} placeholder="Rolling Energy" />
              </div>
              <div>
                <FieldLabel>Tagline</FieldLabel>
                <TextInput value={t.companyTagline ?? ''} onChange={(v) => set('companyTagline', v)} placeholder="Solar EPC Company" />
              </div>
              <div className="col-span-2">
                <FieldLabel>Office Address</FieldLabel>
                <TextInput value={t.companyAddress ?? ''} onChange={(v) => set('companyAddress', v)} placeholder="Full office address" />
              </div>
              <div>
                <FieldLabel>Phone</FieldLabel>
                <TextInput value={t.companyPhone ?? ''} onChange={(v) => set('companyPhone', v)} placeholder="+91 98765 43210" />
              </div>
              <div>
                <FieldLabel>Email</FieldLabel>
                <TextInput value={t.companyEmail ?? ''} onChange={(v) => set('companyEmail', v)} placeholder="info@rollingenergy.in" />
              </div>
              <div>
                <FieldLabel>Website</FieldLabel>
                <TextInput value={t.companyWebsite ?? ''} onChange={(v) => set('companyWebsite', v)} placeholder="www.rollingenergy.in" />
              </div>
              <div>
                <FieldLabel>Template Name (internal)</FieldLabel>
                <TextInput value={t.name ?? ''} onChange={(v) => set('name', v as never)} placeholder="Default Template" />
              </div>
              <div className="col-span-2 border-t border-gray-100 pt-4 mt-2">
                <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Template Assignment (when this template is used)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>System Type</FieldLabel>
                    <select
                      value={t.systemType ?? 'ANY'}
                      onChange={(e) => set('systemType', e.target.value as never)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      <option value="ANY">Any (Commercial/Industrial)</option>
                      <option value="DCR">DCR</option>
                      <option value="NON_DCR">Non-DCR</option>
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Site Type</FieldLabel>
                    <select
                      value={t.siteType ?? 'ANY'}
                      onChange={(e) => set('siteType', e.target.value as never)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      <option value="ANY">Any (fallback)</option>
                      <option value="RESIDENTIAL">Residential</option>
                      <option value="SOCIETY">Society</option>
                      <option value="COMMERCIAL">Commercial</option>
                      <option value="INDUSTRIAL">Industrial</option>
                    </select>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">Example: DCR + Residential → used for DCR residential quotes</p>
              </div>
              <div>
                <FieldLabel>Panel Warranty Years</FieldLabel>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={t.panelWarrantyYears ?? 25}
                  onChange={(e) => set('panelWarrantyYears', Number(e.target.value) as never)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Used in warranty table as <code className="bg-gray-100 px-1 rounded">{'{{panel_warranty_years}}'}</code> — update warranty items text to use this placeholder.
                </p>
              </div>
            </div>
          </Section>
        )}

        {/* ── BOM Configuration ─────────────────────────────────────────── */}
        {activeTab === 'bom' && (
          <div className="space-y-6">
            <Section
              title="Column Visibility"
              desc="Control which columns are shown in the Bill of Materials table on the quotation. By default, Quantity and Unit are hidden for a clean customer presentation."
            >
              <div className="flex flex-col gap-4">
                <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Show Quantity Column</p>
                    <p className="text-xs text-gray-400 mt-0.5">Display the quantity numbers (e.g. 18 panels)</p>
                  </div>
                  <div className="relative inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={t.bomShowQty ?? false}
                      onChange={e => set('bomShowQty', e.target.checked as never)}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 cursor-pointer"
                    />
                  </div>
                </label>
                <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Show Unit Column</p>
                    <p className="text-xs text-gray-400 mt-0.5">Display the unit labels (e.g. Nos., Lot, Metres)</p>
                  </div>
                  <div className="relative inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={t.bomShowUnit ?? false}
                      onChange={e => set('bomShowUnit', e.target.checked as never)}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 cursor-pointer"
                    />
                  </div>
                </label>
              </div>
            </Section>

            <Section
              title="BOM Items"
              desc="Customize the items listed in the Bill of Materials. Use Move Up/Down to reorder — the order here is the exact order shown in the quotation PDF. Leave empty to use the system default."
            >
              <div className="space-y-3">
                {((t.bomItems ?? []) as TemplateBomItem[]).map((item, idx) => {
                  const items = (t.bomItems ?? []) as TemplateBomItem[];
                  const moveUp = () => {
                    if (idx <= 0) return;
                    const updated = [...items];
                    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
                    set('bomItems', updated.map((it, i) => ({ ...it, srNo: i + 1 })) as never);
                  };
                  const moveDown = () => {
                    if (idx >= items.length - 1) return;
                    const updated = [...items];
                    [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
                    set('bomItems', updated.map((it, i) => ({ ...it, srNo: i + 1 })) as never);
                  };
                  return (
                  <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 w-6 text-center">{item.srNo}</span>
                      <div className="flex gap-1" title="Reorder">
                        <button
                          type="button"
                          onClick={moveUp}
                          disabled={idx === 0}
                          className="p-1.5 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-gray-500 hover:text-gray-700"
                          aria-label="Move up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={moveDown}
                          disabled={idx === items.length - 1}
                          className="p-1.5 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-gray-500 hover:text-gray-700"
                          aria-label="Move down"
                        >
                          ↓
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Item Name (e.g. Solar Panels)"
                        value={item.name}
                        onChange={e => {
                          const updated = [...(t.bomItems as TemplateBomItem[])];
                          updated[idx] = { ...updated[idx], name: e.target.value };
                          set('bomItems', updated as never);
                        }}
                        className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (t.bomItems as TemplateBomItem[]).filter((_, i) => i !== idx)
                            .map((it, i) => ({ ...it, srNo: i + 1 }));
                          set('bomItems', updated as never);
                        }}
                        className="text-red-400 hover:text-red-600 text-xs font-semibold px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Specification (e.g. 575 Wp Mono PERC, DCR Certified)"
                      value={item.specification}
                      onChange={e => {
                        const updated = [...(t.bomItems as TemplateBomItem[])];
                        updated[idx] = { ...updated[idx], specification: e.target.value };
                        set('bomItems', updated as never);
                      }}
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                    <input
                      type="text"
                      placeholder="Make / Brand (e.g. Tier-1 Make — Adani / Waaree)"
                      value={item.make}
                      onChange={e => {
                        const updated = [...(t.bomItems as TemplateBomItem[])];
                        updated[idx] = { ...updated[idx], make: e.target.value };
                        set('bomItems', updated as never);
                      }}
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    const current = (t.bomItems ?? []) as TemplateBomItem[];
                    set('bomItems', [
                      ...current,
                      { srNo: current.length + 1, name: '', specification: '', make: '' },
                    ] as never);
                  }}
                  className="w-full py-2 text-sm font-semibold text-blue-600 border-2 border-dashed border-blue-200 rounded-lg hover:bg-blue-50"
                >
                  + Add BOM Item
                </button>
                {(t.bomItems as TemplateBomItem[] | null)?.length ? (
                  <button
                    type="button"
                    onClick={() => set('bomItems', null as never)}
                    className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Reset to system default
                  </button>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-2">
                    No custom items — system default BOM will be used (auto-calculated from system size).
                  </p>
                )}
              </div>
            </Section>
          </div>
        )}

        {/* ── Subsidy & Depreciation Config ────────────────────────────── */}
        {activeTab === 'subsidy' && (
          <div className="space-y-8">
            {/* Subsidy values */}
            <Section
              title="Subsidy Values (DCR Systems Only)"
              desc="Configure the PM Surya Ghar subsidy amounts. These are used automatically based on system size and site type."
            >
              <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-xs text-green-800">
                <strong>Logic:</strong> DCR + Residential → uses values below &nbsp;|&nbsp;
                DCR + Society → ₹X per kW &nbsp;|&nbsp;
                DCR + Commercial → ₹0 &nbsp;|&nbsp;
                Non-DCR → ₹0 (depreciation applies)
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Residential — 1 kW Subsidy (₹)</FieldLabel>
                  <input type="number" min="0" step="1000"
                    value={t.subsidyResidential1kw ?? 30000}
                    onChange={(e) => set('subsidyResidential1kw', Number(e.target.value) as never)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div>
                  <FieldLabel>Residential — 2 kW Subsidy (₹)</FieldLabel>
                  <input type="number" min="0" step="1000"
                    value={t.subsidyResidential2kw ?? 60000}
                    onChange={(e) => set('subsidyResidential2kw', Number(e.target.value) as never)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div>
                  <FieldLabel>Residential — 3 kW to 10 kW Subsidy (₹, fixed cap)</FieldLabel>
                  <input type="number" min="0" step="1000"
                    value={t.subsidyResidential3to10kw ?? 78000}
                    onChange={(e) => set('subsidyResidential3to10kw', Number(e.target.value) as never)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div>
                  <FieldLabel>Society — Subsidy per kW (₹/kW)</FieldLabel>
                  <input type="number" min="0" step="1000"
                    value={t.subsidySocietyPerKw ?? 18000}
                    onChange={(e) => set('subsidySocietyPerKw', Number(e.target.value) as never)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                  <p className="text-xs text-gray-400 mt-1">Total = this value × system size in kW</p>
                </div>
              </div>
            </Section>

            {/* Depreciation config */}
            <Section
              title="Depreciation Configuration (Non-DCR Systems)"
              desc="This section appears in the proposal only for Non-DCR systems. Configure the depreciation table and explanatory note."
            >
              <div className="mb-6">
                <FieldLabel>Depreciation Disclaimer / Note</FieldLabel>
                <TextArea
                  value={t.depreciationNote ?? ''}
                  onChange={(v) => set('depreciationNote', v as never)}
                  rows={3}
                  placeholder="This solar installation may qualify for accelerated depreciation benefits..."
                />
              </div>

              <div>
                <FieldLabel>Depreciation Table Rows</FieldLabel>
                <p className="text-xs text-gray-400 mb-3">Each row shown in the year-wise depreciation schedule in the proposal.</p>
                <ObjectListEditor
                  items={t.depreciationTable ?? []}
                  onChange={(v) => set('depreciationTable', v as never)}
                  fields={[
                    { key: 'year', label: 'Year',          placeholder: 'Year 1' },
                    { key: 'rate', label: 'Depreciation %', placeholder: '40%' },
                    { key: 'note', label: 'Notes',          placeholder: 'WDV accelerated depreciation', type: 'textarea' },
                  ]}
                  addLabel="+ Add row"
                  defaultItem={{ year: '', rate: '', note: '' }}
                />
              </div>
            </Section>
          </div>
        )}

        {/* ── Intro Letter ─────────────────────────────────────────────── */}
        {activeTab === 'intro' && (
          <Section title="Introduction Letter (Page 2)" desc="The body paragraphs of the cover letter. Use {{client_name}} and {{system_size}} as dynamic placeholders.">
            <StringListEditor
              items={t.introLetterBody ?? []}
              onChange={(v) => set('introLetterBody', v)}
              addLabel="+ Add paragraph"
              placeholder="Enter paragraph text… (use {{client_name}}, {{system_size}})"
            />
            <div className="mt-4 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <strong>Placeholders:</strong> <code className="bg-amber-100 px-1 rounded">{'{{client_name}}'}</code> → replaced with the client's name,{' '}
              <code className="bg-amber-100 px-1 rounded">{'{{system_size}}'}</code> → replaced with the system size in kW.
            </div>
          </Section>
        )}

        {/* ── About Company ────────────────────────────────────────────── */}
        {activeTab === 'about' && (
          <div className="space-y-8">
            <Section title="About Company — Description (Page 3)" desc="The main company description paragraphs shown on the left column.">
              <StringListEditor
                items={t.aboutParagraphs ?? []}
                onChange={(v) => set('aboutParagraphs', v)}
                addLabel="+ Add paragraph"
              />
            </Section>

            <Section title="Mission Statement" desc="Shown in the dark card on the right side of the About page.">
              <TextArea
                value={t.aboutMission ?? ''}
                onChange={(v) => set('aboutMission', v)}
                rows={3}
                placeholder="Our mission statement…"
              />
            </Section>

            <Section title="Company Stats" desc="4 stats shown in the dark card (e.g. Projects: 200+).">
              <ObjectListEditor
                items={t.aboutStats ?? []}
                onChange={(v) => set('aboutStats', v)}
                fields={[
                  { key: 'label', label: 'Label', placeholder: 'Projects' },
                  { key: 'value', label: 'Value', placeholder: '200+' },
                ]}
                addLabel="+ Add stat"
                defaultItem={{ label: '', value: '' }}
              />
            </Section>

            <Section title="Highlights Grid" desc="6 feature highlights shown at the bottom of the About page.">
              <ObjectListEditor
                items={t.aboutHighlights ?? []}
                onChange={(v) => set('aboutHighlights', v)}
                fields={[
                  { key: 'icon',  label: 'Icon (emoji)', placeholder: '🏅' },
                  { key: 'title', label: 'Title',        placeholder: 'MNRE Certified' },
                  { key: 'desc',  label: 'Description',  type: 'textarea', placeholder: 'Short description…' },
                ]}
                addLabel="+ Add highlight"
                defaultItem={{ icon: '⭐', title: '', desc: '' }}
              />
            </Section>
          </div>
        )}

        {/* ── Our Process ──────────────────────────────────────────────── */}
        {activeTab === 'process' && (
          <div className="space-y-8">
            <Section title="Process Steps (Page 4)" desc="Each step in the installation process timeline.">
              <ObjectListEditor
                items={t.processSteps ?? []}
                onChange={(v) => set('processSteps', v)}
                fields={[
                  { key: 'step',     label: 'Step No.',  placeholder: '01' },
                  { key: 'icon',     label: 'Icon',      placeholder: '📍' },
                  { key: 'title',    label: 'Title',     placeholder: 'Site Survey' },
                  { key: 'subtitle', label: 'Subtitle',  placeholder: 'Assessment & Planning' },
                  { key: 'duration', label: 'Duration',  placeholder: '1–2 Days' },
                  { key: 'desc',     label: 'Description', type: 'textarea', placeholder: 'Step description…' },
                ]}
                addLabel="+ Add step"
                defaultItem={{ step: '07', icon: '🔹', title: '', subtitle: '', desc: '', duration: '' }}
              />
            </Section>

            <Section title="Timeline Banner Text" desc="The text shown in the dark banner at the bottom of the process page.">
              <TextInput
                value={t.processTimelineText ?? ''}
                onChange={(v) => set('processTimelineText', v)}
                placeholder="Total Timeline: 10–18 Working Days"
              />
            </Section>
          </div>
        )}

        {/* ── Maintenance & Services ────────────────────────────────────── */}
        {activeTab === 'maintenance' && (
          <div className="space-y-8">
            <Section title="AMC Services (Page 7)" desc="The 6 maintenance service cards.">
              <ObjectListEditor
                items={t.maintenanceServices ?? []}
                onChange={(v) => set('maintenanceServices', v)}
                fields={[
                  { key: 'icon',  label: 'Icon',  placeholder: '🔍' },
                  { key: 'title', label: 'Title', placeholder: 'Annual Inspection' },
                  { key: 'desc',  label: 'Description', type: 'textarea', placeholder: 'Service description…' },
                ]}
                addLabel="+ Add service"
                defaultItem={{ icon: '🔧', title: '', desc: '' }}
              />
            </Section>

            <Section title="Warranty Table" desc="Rows in the warranty summary table.">
              <ObjectListEditor
                items={t.warrantyItems ?? []}
                onChange={(v) => set('warrantyItems', v)}
                fields={[
                  { key: 'item',     label: 'Component',        placeholder: 'Solar Module' },
                  { key: 'warranty', label: 'Warranty Coverage', placeholder: '25-Year Performance Guarantee' },
                ]}
                addLabel="+ Add warranty row"
                defaultItem={{ item: '', warranty: '' }}
              />
            </Section>
          </div>
        )}

        {/* ── Payment Terms ────────────────────────────────────────────── */}
        {activeTab === 'payment' && (
          <div className="space-y-8">
            <Section title="Payment Milestones (Page 9)" desc="The payment stages. Percentages must add up to 100.">
              <ObjectListEditor
                items={t.paymentMilestones ?? []}
                onChange={(v) => set('paymentMilestones', v)}
                fields={[
                  { key: 'step',  label: 'Step No.', placeholder: '01' },
                  { key: 'icon',  label: 'Icon',     placeholder: '✅' },
                  { key: 'title', label: 'Title',    placeholder: 'Order Confirmation' },
                  { key: 'pct',   label: '% of Total', type: 'number' },
                  { key: 'desc',  label: 'Description', type: 'textarea' },
                ]}
                addLabel="+ Add milestone"
                defaultItem={{ step: '04', icon: '💰', title: '', pct: 0, desc: '' }}
              />
            </Section>

            <Section title="Payment Modes" desc="Accepted payment methods shown in the grid.">
              <ObjectListEditor
                items={t.paymentModes ?? []}
                onChange={(v) => set('paymentModes', v)}
                fields={[
                  { key: 'icon',  label: 'Icon',  placeholder: '🏦' },
                  { key: 'label', label: 'Label', placeholder: 'Bank Transfer (NEFT/RTGS)' },
                ]}
                addLabel="+ Add payment mode"
                defaultItem={{ icon: '💳', label: '' }}
              />
            </Section>

            <Section title="Terms & Conditions Bullets" desc="The bullet points shown at the bottom of the payment page.">
              <StringListEditor
                items={t.paymentTermsBullets ?? []}
                onChange={(v) => set('paymentTermsBullets', v)}
                addLabel="+ Add bullet"
                placeholder="Enter a T&C point…"
              />
            </Section>
          </div>
        )}

        {/* ── Why Choose Us ─────────────────────────────────────────────── */}
        {activeTab === 'why' && (
          <div className="space-y-8">
            <Section title="Why Choose Us — Reasons (Page 12)" desc="Cards explaining why clients should choose you.">
              <ObjectListEditor
                items={t.whyReasons ?? []}
                onChange={(v) => set('whyReasons', v)}
                fields={[
                  { key: 'icon',  label: 'Icon',  placeholder: '🏅' },
                  { key: 'title', label: 'Title', placeholder: 'MNRE Certified' },
                  { key: 'desc',  label: 'Description', type: 'textarea' },
                ]}
                addLabel="+ Add reason"
                defaultItem={{ icon: '⭐', title: '', desc: '' }}
              />
            </Section>

            <Section title="Customer Testimonials" desc="Shown at the bottom of the Why Choose Us page.">
              <ObjectListEditor
                items={t.testimonials ?? []}
                onChange={(v) => set('testimonials', v)}
                fields={[
                  { key: 'name',     label: 'Customer Name',  placeholder: 'Prakash M.' },
                  { key: 'location', label: 'Location',       placeholder: 'Pune, Maharashtra' },
                  { key: 'text',     label: 'Testimonial',    type: 'textarea', placeholder: '"Great service…"' },
                ]}
                addLabel="+ Add testimonial"
                defaultItem={{ name: '', location: '', text: '' }}
              />
            </Section>
          </div>
        )}

        {/* ── Contact ──────────────────────────────────────────────────── */}
        {activeTab === 'contact' && (
          <Section
            title="Contact Page — Certifications (Page 13)"
            desc="Company contact details are pulled from the Company Info tab. Only certifications/badges are editable here."
          >
            <StringListEditor
              items={t.certifications ?? []}
              onChange={(v) => set('certifications', v)}
              addLabel="+ Add certification badge"
              placeholder="✅ Certification name"
            />
          </Section>
        )}

      </div>
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-800">{title}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        {children}
      </div>
    </div>
  );
}
