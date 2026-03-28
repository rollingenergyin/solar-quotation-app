'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type InvoiceTemplateRow = {
  id: string;
  name: string;
  slug: string;
  subtype: string;
  config: Record<string, unknown>;
  updatedAt: string;
};

const SUBTYPE_TAB_ORDER = ['SPGS', 'SERVICE', 'PRODUCT'] as const;

function sortInvoiceTemplatesByType(rows: InvoiceTemplateRow[]): InvoiceTemplateRow[] {
  const rank = (t: string) => {
    const i = SUBTYPE_TAB_ORDER.indexOf(t as (typeof SUBTYPE_TAB_ORDER)[number]);
    return i === -1 ? 99 : i;
  };
  return [...rows].sort((a, b) => rank(a.subtype) - rank(b.subtype));
}

type StepId = 'header' | 'customer' | 'table' | 'gst' | 'bank' | 'footer';

const STEPS: { id: StepId; label: string }[] = [
  { id: 'header', label: 'Header' },
  { id: 'customer', label: 'Customer & site' },
  { id: 'table', label: 'Table' },
  { id: 'gst', label: 'GST' },
  { id: 'bank', label: 'Bank' },
  { id: 'footer', label: 'Footer' },
];

function setNested(base: Record<string, unknown>, path: string[], value: unknown): Record<string, unknown> {
  const next = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
  let cur: Record<string, unknown> = next;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    const v = cur[k];
    if (!v || typeof v !== 'object' || Array.isArray(v)) cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[path[path.length - 1]] = value as object;
  return next;
}

async function fetchPreviewHtml(config: unknown): Promise<string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch('/api/finance/invoice-templates/preview-html', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify({ config }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error || res.statusText);
  }
  return res.text();
}

const fieldClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500';
const labelClass = 'mb-1 block text-sm font-medium text-slate-700';

export default function InvoiceTemplatesPage() {
  const [templates, setTemplates] = useState<InvoiceTemplateRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [step, setStep] = useState<StepId>('header');
  const [previewHtml, setPreviewHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const loadList = useCallback(() => {
    setListError(null);
    return api<InvoiceTemplateRow[]>('/finance/invoice-templates')
      .then((rows) => {
        setTemplates(rows);
        setSelectedId((prev) => {
          if (prev && rows.some((t) => t.id === prev)) return prev;
          const sorted = sortInvoiceTemplatesByType(rows);
          return sorted[0]?.id ?? null;
        });
      })
      .catch((e) => {
        setTemplates([]);
        setSelectedId(null);
        setListError(e instanceof Error ? e.message : 'Could not load templates');
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    loadList().finally(() => setLoading(false));
  }, [loadList]);

  const sortedTemplates = useMemo(() => sortInvoiceTemplatesByType(templates), [templates]);

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId]
  );

  useEffect(() => {
    if (!selected) {
      setDraft({});
      setJsonText('{}');
      return;
    }
    const c = selected.config;
    setDraft(c);
    setJsonText(JSON.stringify(c, null, 2));
  }, [selected]);

  const patch = useCallback((path: string[], value: unknown) => {
    setDraft((d) => setNested(d, path, value));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (advancedOpen) {
        try {
          const parsed = JSON.parse(jsonText) as Record<string, unknown>;
          fetchPreviewHtml(parsed).then(setPreviewHtml).catch(() => setPreviewHtml(''));
        } catch {
          /* invalid JSON while typing */
        }
      } else {
        fetchPreviewHtml(draft).then(setPreviewHtml).catch(() => setPreviewHtml(''));
      }
    }, 380);
    return () => clearTimeout(t);
  }, [draft, jsonText, advancedOpen]);

  const save = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      const config = advancedOpen ? (JSON.parse(jsonText) as Record<string, unknown>) : draft;
      await api<InvoiceTemplateRow>(`/finance/invoice-templates/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify({ config }),
      });
      await loadList();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const seller = (draft.seller as Record<string, unknown> | undefined) ?? {};
  const branding = (draft.branding as Record<string, unknown> | undefined) ?? {};
  const colors = (branding.colors as Record<string, unknown> | undefined) ?? {};
  const visibility = (draft.visibility as Record<string, unknown> | undefined) ?? {};
  const tableVis = (visibility.table as Record<string, unknown> | undefined) ?? {};
  const grid = (draft.labels as Record<string, unknown> | undefined)?.grid as Record<string, unknown> | undefined;
  const lineItems = (draft.labels as Record<string, unknown> | undefined)?.lineItems as Record<string, unknown> | undefined;
  const footer = (draft.labels as Record<string, unknown> | undefined)?.footer as Record<string, unknown> | undefined;
  const extraRows = (draft.extraTableRows as { id: string; label: string; enabled: boolean }[] | undefined) ?? [];

  const onLogoFile = (file: File | null) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const url = typeof r.result === 'string' ? r.result : '';
      patch(['branding', 'logoDataUrl'], url || null);
    };
    r.readAsDataURL(file);
  };

  const addCustomRow = () => {
    const rows = [...extraRows];
    rows.push({ id: `row-${Date.now()}`, label: 'New line', enabled: true });
    patch(['extraTableRows'], rows);
  };

  const updateExtraRow = (id: string, upd: Partial<{ label: string; enabled: boolean }>) => {
    patch(
      ['extraTableRows'],
      extraRows.map((r) => (r.id === id ? { ...r, ...upd } : r))
    );
  };

  const removeExtraRow = (id: string) => {
    patch(
      ['extraTableRows'],
      extraRows.filter((r) => r.id !== id)
    );
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-slate-50/80 lg:min-h-screen">
      <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 lg:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Finance</p>
            <h1 className="text-xl font-semibold text-slate-900">Invoice layout</h1>
            <p className="mt-1 max-w-xl text-sm text-slate-600">
              Adjust how your tax invoice looks. Changes update the preview on the right — like editing a document.
            </p>
          </div>
          <div className="relative z-20 flex flex-wrap items-center gap-2 isolate">
            <button
              type="button"
              onClick={save}
              disabled={!selectedId || saving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <Link href="/admin/finance/invoices" className="text-sm font-medium text-emerald-700 hover:underline">
              ← Back to invoices
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-4 max-w-[1600px] px-4 lg:px-8">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Layout by subtype (Tax / Proforma / Quotation use the same layout; only the document title changes)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {sortedTemplates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  selectedId === t.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <nav className="mx-auto mt-6 flex max-w-[1600px] flex-wrap gap-1 border-b border-slate-100 pb-px">
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
                step === s.id
                  ? 'bg-white text-emerald-800 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </header>

      {(error || listError) && (
        <div className="mx-auto mt-4 max-w-[1600px] space-y-1 px-4 text-sm text-red-700 lg:px-8">
          {listError && <div>{listError}</div>}
          {error && <div>{error}</div>}
        </div>
      )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center p-12 text-slate-500">Loading…</div>
      ) : (
        <div className="mx-auto grid min-h-0 flex-1 w-full max-w-[1600px] grid-cols-1 gap-0 xl:grid-cols-[minmax(0,1fr)_420px]">
          <main className="min-h-0 overflow-y-auto border-b border-slate-200 bg-white px-4 py-8 lg:border-b-0 lg:px-10 xl:max-h-[calc(100vh-12rem)]">
            {!selectedId && sortedTemplates.length > 0 && (
              <p className="text-slate-600">Select an invoice type above to start editing.</p>
            )}

            {selectedId && step === 'header' && (
              <div className="max-w-lg space-y-6">
                <h2 className="text-lg font-semibold text-slate-900">Letterhead</h2>
                <p className="text-sm text-slate-600">What appears at the top of every invoice from your company.</p>

                <div>
                  <span className={labelClass}>Logo</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-emerald-800"
                    onChange={(e) => onLogoFile(e.target.files?.[0] ?? null)}
                  />
                  <p className="mt-1 text-xs text-slate-500">PNG or JPG. Shown next to your company name.</p>
                </div>

                <div>
                  <label className={labelClass} htmlFor="co-name">
                    Company name
                  </label>
                  <input
                    id="co-name"
                    className={fieldClass}
                    value={String(seller.companyName ?? '')}
                    onChange={(e) => patch(['seller', 'companyName'], e.target.value)}
                    placeholder="Rolling Energy"
                  />
                </div>

                <div>
                  <label className={labelClass}>Address — line 1</label>
                  <input
                    className={fieldClass}
                    value={String(seller.addressLine1 ?? '')}
                    onChange={(e) => patch(['seller', 'addressLine1'], e.target.value)}
                    placeholder="Building, street"
                  />
                </div>
                <div>
                  <label className={labelClass}>Address — line 2</label>
                  <input
                    className={fieldClass}
                    value={String(seller.addressLine2 ?? '')}
                    onChange={(e) => patch(['seller', 'addressLine2'], e.target.value)}
                    placeholder="City, state, PIN"
                  />
                </div>

                <div>
                  <label className={labelClass}>Your GSTIN</label>
                  <input
                    className={fieldClass}
                    value={String(seller.gstin ?? '')}
                    onChange={(e) => patch(['seller', 'gstin'], e.target.value)}
                    placeholder="15-character GST number"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Phone</label>
                    <input
                      className={fieldClass}
                      value={String(seller.phone ?? '')}
                      onChange={(e) => patch(['seller', 'phone'], e.target.value)}
                      placeholder="+91 …"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Email</label>
                    <input
                      type="email"
                      className={fieldClass}
                      value={String(seller.email ?? '')}
                      onChange={(e) => patch(['seller', 'email'], e.target.value)}
                      placeholder="accounts@…"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Title colour</label>
                    <input
                      type="text"
                      className={fieldClass + ' font-mono text-xs'}
                      value={String(colors.primary ?? '#161c34')}
                      onChange={(e) => patch(['branding', 'colors', 'primary'], e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Accent colour</label>
                    <input
                      type="text"
                      className={fieldClass + ' font-mono text-xs'}
                      value={String(colors.accent ?? '#6690cc')}
                      onChange={(e) => patch(['branding', 'colors', 'accent'], e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {selectedId && step === 'customer' && (
              <div className="max-w-lg space-y-6">
                <h2 className="text-lg font-semibold text-slate-900">Customer &amp; site block</h2>
                <p className="text-sm text-slate-600">Labels and what to show for the buyer’s details.</p>

                <div>
                  <label className={labelClass}>Heading — customer column</label>
                  <input
                    className={fieldClass}
                    value={String(grid?.customerTitle ?? '')}
                    onChange={(e) => patch(['labels', 'grid', 'customerTitle'], e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Heading — invoice column</label>
                  <input
                    className={fieldClass}
                    value={String(grid?.invoiceTitle ?? '')}
                    onChange={(e) => patch(['labels', 'grid', 'invoiceTitle'], e.target.value)}
                  />
                </div>

                <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                  <p className="text-sm font-medium text-slate-800">Visibility</p>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                      checked={Boolean(visibility.showSellerGstinInStrip ?? true)}
                      onChange={(e) => patch(['visibility', 'showSellerGstinInStrip'], e.target.checked)}
                    />
                    <span className="text-sm text-slate-700">Show your company GSTIN in the blue bar</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                      checked={Boolean(visibility.showBuyerGstinInGrid ?? true)}
                      onChange={(e) => patch(['visibility', 'showBuyerGstinInGrid'], e.target.checked)}
                    />
                    <span className="text-sm text-slate-700">Show customer GSTIN</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                      checked={Boolean(visibility.showBuyerPhoneInGrid ?? true)}
                      onChange={(e) => patch(['visibility', 'showBuyerPhoneInGrid'], e.target.checked)}
                    />
                    <span className="text-sm text-slate-700">Show customer phone</span>
                  </label>
                </div>
              </div>
            )}

            {selectedId && step === 'table' && (
              <div className="max-w-xl space-y-6">
                <h2 className="text-lg font-semibold text-slate-900">Product table</h2>
                <p className="text-sm text-slate-600">
                  Rename lines and turn optional rows on or off. The table shape stays the same — only labels and which
                  rows appear change.
                </p>

                <div className="space-y-4">
                  {(
                    [
                      ['mainSystemLine', 'Main product line', 'mainDescription'],
                      ['solarPanels', 'Solar panels', 'solarPanels'],
                      ['inverter', 'Inverter', 'inverter'],
                      ['bos', 'BOS & structure', 'bos'],
                      ['installation', 'Installation', 'installation'],
                      ['commissioning', 'Commissioning', 'commissioning'],
                      ['labour', 'Labour', 'labour'],
                    ] as const
                  ).map(([key, title, labelKey]) => (
                    <div
                      key={key}
                      className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <label className="flex cursor-pointer items-center gap-3 sm:min-w-[140px]">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                          checked={Boolean(tableVis[key] ?? true)}
                          onChange={(e) => patch(['visibility', 'table', key], e.target.checked)}
                        />
                        <span className="text-sm font-medium text-slate-800">Show</span>
                      </label>
                      <div className="flex-1">
                        <label className="sr-only" htmlFor={`ln-${key}`}>
                          {title}
                        </label>
                        <input
                          id={`ln-${key}`}
                          className={fieldClass}
                          value={String(lineItems?.[labelKey] ?? '')}
                          onChange={(e) => patch(['labels', 'lineItems', labelKey], e.target.value)}
                          placeholder={title}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                      checked={Boolean(tableVis.panelSerials ?? true)}
                      onChange={(e) => patch(['visibility', 'table', 'panelSerials'], e.target.checked)}
                    />
                    <span className="text-sm text-slate-700">Show panel serial numbers row</span>
                  </label>
                  <label className="mt-2 flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                      checked={Boolean(tableVis.inverterSerials ?? true)}
                      onChange={(e) => patch(['visibility', 'table', 'inverterSerials'], e.target.checked)}
                    />
                    <span className="text-sm text-slate-700">Show inverter serial numbers row</span>
                  </label>
                </div>

                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800">Extra lines</h3>
                    <button
                      type="button"
                      onClick={addCustomRow}
                      className="text-sm font-medium text-emerald-700 hover:underline"
                    >
                      + Add line
                    </button>
                  </div>
                  <p className="mb-3 text-xs text-slate-500">Optional extra description rows before the sub-total.</p>
                  <ul className="space-y-2">
                    {extraRows.map((row) => (
                      <li key={row.id} className="flex flex-wrap items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                          checked={row.enabled}
                          onChange={(e) => updateExtraRow(row.id, { enabled: e.target.checked })}
                        />
                        <input
                          className={`${fieldClass} flex-1 min-w-[200px]`}
                          value={row.label}
                          onChange={(e) => updateExtraRow(row.id, { label: e.target.value })}
                        />
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:underline"
                          onClick={() => removeExtraRow(row.id)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {selectedId && step === 'gst' && (
              <div className="max-w-lg space-y-6">
                <h2 className="text-lg font-semibold text-slate-900">GST on the invoice</h2>
                <p className="text-sm text-slate-600">This controls how tax is shown in the preview. Real invoices still use the rates from each sale.</p>

                <fieldset className="space-y-3">
                  <legend className="sr-only">GST style</legend>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <input
                      type="radio"
                      name="gststyle"
                      className="mt-1"
                      checked={(draft.gstPreviewStyle ?? 'spgs_epc') === 'standard'}
                      onChange={() => patch(['gstPreviewStyle'], 'standard')}
                    />
                    <div>
                      <div className="font-medium text-slate-900">Standard GST</div>
                      <div className="text-sm text-slate-600">One tax summary block (typical goods &amp; services).</div>
                    </div>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <input
                      type="radio"
                      name="gststyle"
                      className="mt-1"
                      checked={(draft.gstPreviewStyle ?? 'spgs_epc') === 'spgs_epc'}
                      onChange={() => patch(['gstPreviewStyle'], 'spgs_epc')}
                    />
                    <div>
                      <div className="font-medium text-slate-900">Solar (SPGS) GST split</div>
                      <div className="text-sm text-slate-600">
                        Shows the two-part split used for solar EPC: part of the value at 5% GST and part at 18% GST
                        (shown as central + state tax in the table).
                      </div>
                    </div>
                  </label>
                </fieldset>

                {(draft.gstPreviewStyle ?? 'spgs_epc') === 'spgs_epc' && (
                  <div className="rounded-xl bg-emerald-50/80 p-4 text-sm text-emerald-900 ring-1 ring-emerald-100">
                    <p className="font-medium">What you’ll see</p>
                    <p className="mt-2 leading-relaxed">
                      The preview uses sample amounts. On real invoices, tax is calculated automatically from your
                      pricing — this layout only changes how the breakdown appears on paper.
                    </p>
                  </div>
                )}

                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                    checked={Boolean(visibility.gstBreakdown ?? true)}
                    onChange={(e) => patch(['visibility', 'gstBreakdown'], e.target.checked)}
                  />
                  <span className="text-sm text-slate-700">Show the detailed GST table inside the line items</span>
                </label>
              </div>
            )}

            {selectedId && step === 'bank' && (
              <div className="max-w-lg space-y-6">
                <h2 className="text-lg font-semibold text-slate-900">Bank details on the invoice</h2>
                <p className="text-sm text-slate-600">Printed in the footer so customers know where to pay.</p>

                <div>
                  <label className={labelClass}>Bank name</label>
                  <input
                    className={fieldClass}
                    value={String(seller.bankName ?? '')}
                    onChange={(e) => patch(['seller', 'bankName'], e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Account number</label>
                  <input
                    className={fieldClass}
                    value={String(seller.bankAccount ?? '')}
                    onChange={(e) => patch(['seller', 'bankAccount'], e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>IFSC</label>
                  <input
                    className={fieldClass}
                    value={String(seller.bankIfsc ?? '')}
                    onChange={(e) => patch(['seller', 'bankIfsc'], e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Branch (optional)</label>
                  <input
                    className={fieldClass}
                    value={String(seller.bankBranch ?? '')}
                    onChange={(e) => patch(['seller', 'bankBranch'], e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Account name (optional)</label>
                  <input
                    className={fieldClass}
                    value={String(seller.bankAccountName ?? '')}
                    onChange={(e) => patch(['seller', 'bankAccountName'], e.target.value)}
                  />
                </div>
              </div>
            )}

            {selectedId && step === 'footer' && (
              <div className="max-w-lg space-y-6">
                <h2 className="text-lg font-semibold text-slate-900">Footer &amp; signature</h2>
                <p className="text-sm text-slate-600">Declaration and sign-off wording.</p>

                <div>
                  <label className={labelClass}>Declaration</label>
                  <textarea
                    className={fieldClass + ' min-h-[88px]'}
                    value={String(footer?.certified ?? '')}
                    onChange={(e) => patch(['labels', 'footer', 'certified'], e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Signature line</label>
                  <input
                    className={fieldClass}
                    value={String(footer?.authorisedSignatory ?? '')}
                    onChange={(e) => patch(['labels', 'footer', 'authorisedSignatory'], e.target.value)}
                  />
                </div>
              </div>
            )}

            {selectedId && (
              <details
                className="mt-10 max-w-xl rounded-xl border border-slate-200 bg-slate-50 p-4"
                open={advancedOpen}
                onToggle={(e) => {
                  const el = e.currentTarget;
                  const open = el.open;
                  setAdvancedOpen(open);
                  if (open) setJsonText(JSON.stringify(draftRef.current, null, 2));
                }}
              >
                <summary className="cursor-pointer text-sm font-medium text-slate-800">Advanced settings</summary>
                <p className="mt-2 text-xs text-slate-500">
                  Raw template data for power users. Invalid JSON will not update the preview until it parses.
                </p>
                <textarea
                  className="mt-3 w-full min-h-[200px] rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs text-slate-800"
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                />
                <button
                  type="button"
                  className="mt-2 text-sm text-emerald-700 hover:underline"
                  onClick={() => {
                    try {
                      setDraft(JSON.parse(jsonText) as Record<string, unknown>);
                    } catch {
                      setError('JSON could not be read. Fix the text and try again.');
                    }
                  }}
                >
                  Apply JSON to form
                </button>
              </details>
            )}
          </main>

          <aside className="flex min-h-[50vh] flex-col border-slate-200 bg-slate-100/90 xl:sticky xl:top-0 xl:max-h-screen xl:border-l">
            <div className="border-b border-slate-200 bg-white/90 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Live preview</p>
              <p className="text-xs text-slate-500">Updates as you type</p>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden p-3">
              {previewHtml ? (
                <iframe
                  title="Invoice preview"
                  className="h-full min-h-[520px] w-full rounded-lg border border-slate-200 bg-white shadow-inner"
                  srcDoc={previewHtml}
                  sandbox="allow-same-origin"
                />
              ) : (
                <div className="flex h-64 items-center justify-center text-sm text-slate-500">Pick a template to see the preview</div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
