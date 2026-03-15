'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface SystemParam {
  id: string;
  key: string;
  label: string;
  value: number;
  unit: string | null;
  description: string | null;
  category: string;
}

interface FormulaVersion {
  id: string;
  expression: string;
  variables: string[] | unknown;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

interface Formula {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  versions: FormulaVersion[];
}

// Human-readable labels and example values for ALL variables used in the system
const VAR_META: Record<string, { label: string; example: number }> = {
  // Units & sizing
  yearly_units:      { label: 'Yearly Units (kWh)',        example: 3600     },
  total_units:       { label: 'Total Units (kWh)',          example: 3600     },
  months_count:      { label: 'Number of Months',           example: 12       },
  system_kw:         { label: 'System Size (kW)',           example: 10       },
  // Production
  peak_sun_hours:    { label: 'Peak Sun Hours / Day',       example: 5        },
  system_efficiency: { label: 'System Efficiency (0–1)',    example: 0.8      },
  annual_gen_kwh:    { label: 'Annual Generation (kWh)',    example: 14600    },
  // Cable / civil
  building_height:   { label: 'Building Height (m)',        example: 15       },
  floor_height:      { label: 'Floor Height (m)',           example: 3        },
  num_floors:        { label: 'Number of Floors',           example: 5        },
  // Cost
  price_per_watt:    { label: 'Price per Watt (₹)',         example: 55       },
  profit_pct:        { label: 'Profit %',                   example: 15       },
  gst_pct:           { label: 'GST %',                      example: 8.9      },
  base_cost:         { label: 'Base Cost (₹)',              example: 550000   },
  total_cost:        { label: 'Total Cost (₹)',             example: 598450   },
  // Savings / ROI
  electricity_rate:  { label: 'Electricity Rate (₹/kWh)',   example: 8        },
  totalAmount:       { label: 'Net Payable (₹)',            example: 472450   },
  annualSavings:     { label: 'Annual Savings (₹)',         example: 58400    },
  // EMI
  P:                 { label: 'Principal (₹)',              example: 472450   },
  r:                 { label: 'Monthly Interest Rate',      example: 0.0075   },
  n:                 { label: 'Tenure (months)',            example: 60       },
};

const CATEGORY_ORDER = ['general', 'financial', 'sizing'];
const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  general:   { label: 'General',            icon: '⚙️' },
  financial: { label: 'Financial & Pricing', icon: '💰' },
  sizing:    { label: 'System Sizing & Cable', icon: '📐' },
};

function slugify(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function getVars(version: FormulaVersion): string[] {
  if (Array.isArray(version.variables)) return version.variables as string[];
  return [];
}

// ── New Formula form state ─────────────────────────────────────────────────────
interface NewFormulaForm {
  name: string;
  slug: string;
  description: string;
  expression: string;
  variablesRaw: string;  // comma-separated
}

const EMPTY_NEW: NewFormulaForm = {
  name: '', slug: '', description: '', expression: '', variablesRaw: '',
};

export default function FormulasPage() {
  const [params, setParams]     = useState<SystemParam[]>([]);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [loading, setLoading]   = useState(true);

  // Param editing state
  const [editingParam, setEditingParam]   = useState<string | null>(null);
  const [paramDraft, setParamDraft]       = useState<Record<string, string>>({});
  const [savingParam, setSavingParam]     = useState<string | null>(null);

  // Formula editing state
  const [editingFormula, setEditingFormula]   = useState<string | null>(null);
  const [formulaDraft, setFormulaDraft]       = useState<Record<string, string>>({});
  const [testInputs, setTestInputs]           = useState<Record<string, Record<string, string>>>({});
  const [testResults, setTestResults]         = useState<Record<string, { value: string; isError: boolean }>>({});
  const [validations, setValidations]         = useState<Record<string, { valid: boolean; error?: string }>>({});
  const [savingFormula, setSavingFormula]     = useState<string | null>(null);

  // Add Formula form state
  const [showAddForm, setShowAddForm]       = useState(false);
  const [newFormula, setNewFormula]         = useState<NewFormulaForm>(EMPTY_NEW);
  const [addValidation, setAddValidation]   = useState<{ valid: boolean; error?: string } | null>(null);
  const [addTestResult, setAddTestResult]   = useState<{ value: string; isError: boolean } | null>(null);
  const [addTestInputs, setAddTestInputs]   = useState<Record<string, string>>({});
  const [savingNew, setSavingNew]           = useState(false);
  const [addError, setAddError]             = useState('');

  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const loadData = useCallback(async () => {
    try {
      const [paramsData, formulasRaw] = await Promise.all([
        api<SystemParam[]>('/params').catch(() => [] as SystemParam[]),
        api<Formula[]>('/formulas').catch(() => [] as Formula[]),
      ]);

      const detailed = await Promise.all(
        formulasRaw.map(f => api<Formula>(`/formulas/${f.slug}`).catch(() => f))
      );

      setParams(paramsData);
      setFormulas(detailed);

      const pDraft: Record<string, string> = {};
      paramsData.forEach(p => { pDraft[p.key] = String(p.value); });
      setParamDraft(pDraft);

      const fDraft: Record<string, string> = {};
      detailed.forEach(f => {
        const active = f.versions?.find(v => v.isActive) ?? f.versions?.[0];
        if (active) fDraft[f.id] = active.expression;
      });
      setFormulaDraft(fDraft);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Parameter actions ─────────────────────────────────────────────────────

  const saveParam = async (key: string) => {
    const param = params.find(p => p.key === key);
    if (!param) return;
    setSavingParam(key);
    try {
      await api(`/params/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value: parseFloat(paramDraft[key]) }),
      });
      setEditingParam(null);
      showToast(`"${param.label}" updated to ${paramDraft[key]} ${param.unit ?? ''}`);
      await loadData();
    } catch {
      showToast('Failed to save — please try again.');
    } finally {
      setSavingParam(null);
    }
  };

  // ── Formula editing actions ───────────────────────────────────────────────

  const validateFormula = async (formulaId: string) => {
    const expr = formulaDraft[formulaId];
    if (!expr?.trim()) return;
    const result = await api<{ valid: boolean; error?: string }>('/formulas/validate', {
      method: 'POST',
      body: JSON.stringify({ expression: expr }),
    }).catch(e => ({ valid: false, error: e instanceof Error ? e.message : 'Error' }));
    setValidations(prev => ({ ...prev, [formulaId]: result }));
  };

  const testFormula = async (formula: Formula) => {
    const activeVer = formula.versions?.find(v => v.isActive) ?? formula.versions?.[0];
    const vars = getVars(activeVer!);
    const inputs = testInputs[formula.id] ?? {};
    const variables: Record<string, number> = {};
    vars.forEach(v => {
      const raw = inputs[v] ?? String(VAR_META[v]?.example ?? 0);
      variables[v] = parseFloat(raw) || 0;
    });
    try {
      const res = await api<{ result: number }>(`/formulas/${formula.slug}/evaluate`, {
        method: 'POST',
        body: JSON.stringify({ variables }),
      });
      setTestResults(prev => ({ ...prev, [formula.id]: { value: String(res.result), isError: false } }));
    } catch (e) {
      setTestResults(prev => ({
        ...prev,
        [formula.id]: { value: e instanceof Error ? e.message : 'Error', isError: true },
      }));
    }
  };

  const saveFormula = async (formula: Formula) => {
    setSavingFormula(formula.id);
    const activeVer = formula.versions?.find(v => v.isActive) ?? formula.versions?.[0];
    const variables = getVars(activeVer!);
    try {
      await api(`/formulas/${formula.id}/versions`, {
        method: 'POST',
        body: JSON.stringify({
          expression: formulaDraft[formula.id],
          variables,
          description: 'Updated via admin panel',
        }),
      });
      setEditingFormula(null);
      setValidations(prev => { const n = { ...prev }; delete n[formula.id]; return n; });
      setTestResults(prev => { const n = { ...prev }; delete n[formula.id]; return n; });
      showToast(`"${formula.name}" updated successfully`);
      await loadData();
    } catch {
      showToast('Failed to save formula — please try again.');
    } finally {
      setSavingFormula(null);
    }
  };

  const openFormulaEdit = (formula: Formula) => {
    const active = formula.versions?.find(v => v.isActive) ?? formula.versions?.[0];
    setFormulaDraft(prev => ({ ...prev, [formula.id]: active?.expression ?? '' }));
    setEditingFormula(formula.id);
    setValidations(prev => { const n = { ...prev }; delete n[formula.id]; return n; });
    setTestResults(prev => { const n = { ...prev }; delete n[formula.id]; return n; });
  };

  // ── Add Formula actions ───────────────────────────────────────────────────

  const handleNewNameChange = (name: string) => {
    setNewFormula(prev => ({
      ...prev,
      name,
      slug: prev.slug === '' || prev.slug === slugify(prev.name) ? slugify(name) : prev.slug,
    }));
    setAddValidation(null);
    setAddError('');
  };

  const validateNewFormula = async () => {
    if (!newFormula.expression.trim()) return;
    const result = await api<{ valid: boolean; error?: string }>('/formulas/validate', {
      method: 'POST',
      body: JSON.stringify({ expression: newFormula.expression }),
    }).catch(e => ({ valid: false, error: e instanceof Error ? e.message : 'Error' }));
    setAddValidation(result);
  };

  const testNewFormula = async () => {
    const vars = newFormula.variablesRaw.split(',').map(v => v.trim()).filter(Boolean);
    const variables: Record<string, number> = {};
    vars.forEach(v => {
      const raw = addTestInputs[v] ?? String(VAR_META[v]?.example ?? 0);
      variables[v] = parseFloat(raw) || 0;
    });
    // Use validate endpoint to evaluate locally (no slug yet)
    try {
      // Temporarily create a slug to test, using the slug field
      const slug = newFormula.slug || 'new-formula';
      // We can't test easily without a slug — use validate only as proxy
      const validation = await api<{ valid: boolean; error?: string }>('/formulas/validate', {
        method: 'POST',
        body: JSON.stringify({ expression: newFormula.expression }),
      });
      if (!validation.valid) {
        setAddTestResult({ value: validation.error ?? 'Invalid expression', isError: true });
        return;
      }
      // If valid, show a placeholder result message
      setAddTestResult({ value: 'Syntax valid — save and use Edit to test with values', isError: false });
    } catch (e) {
      setAddTestResult({ value: e instanceof Error ? e.message : 'Error', isError: true });
    }
  };

  const saveNewFormula = async () => {
    setAddError('');
    if (!newFormula.name.trim()) { setAddError('Formula name is required.'); return; }
    if (!newFormula.slug.trim()) { setAddError('Slug is required.'); return; }
    if (!newFormula.expression.trim()) { setAddError('Expression is required.'); return; }
    if (addValidation?.valid === false) { setAddError('Fix the formula syntax before saving.'); return; }

    const variables = newFormula.variablesRaw.split(',').map(v => v.trim()).filter(Boolean);
    setSavingNew(true);
    try {
      await api('/formulas', {
        method: 'POST',
        body: JSON.stringify({
          name: newFormula.name.trim(),
          slug: newFormula.slug.trim(),
          description: newFormula.description.trim(),
          expression: newFormula.expression.trim(),
          variables,
        }),
      });
      setShowAddForm(false);
      setNewFormula(EMPTY_NEW);
      setAddValidation(null);
      setAddTestResult(null);
      setAddTestInputs({});
      showToast(`"${newFormula.name}" formula created successfully`);
      await loadData();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Failed to create formula.');
    } finally {
      setSavingNew(false);
    }
  };

  // ── Group params by category ──────────────────────────────────────────────
  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    const items = params.filter(p => p.category === cat);
    if (items.length) acc.push({ cat, items });
    return acc;
  }, [] as { cat: string; items: SystemParam[] }[]);

  const newVars = newFormula.variablesRaw.split(',').map(v => v.trim()).filter(Boolean);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3 text-gray-400">
        <div className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-yellow-500 animate-spin" />
        Loading formula settings…
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Formula Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage default values and calculation rules used across all quotations.
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div className="mb-6 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 px-4 py-3 rounded-xl">
          <span className="text-base">✓</span> {toast}
        </div>
      )}

      {/* ── Section 1: Default Parameters ───────────────────────────────────── */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-9 w-9 rounded-xl bg-yellow-100 flex items-center justify-center text-xl">⚙️</div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Default Parameters</h2>
            <p className="text-xs text-gray-500">
              Change these values to instantly update calculations across all new quotations.
            </p>
          </div>
        </div>

        {grouped.length === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 py-10 text-center text-gray-400 text-sm">
            No parameters found. Run <code className="font-mono bg-gray-100 px-1 rounded">npm run seed</code> to populate them.
          </div>
        )}

        <div className="space-y-5">
          {grouped.map(({ cat, items }) => {
            const meta = CATEGORY_LABELS[cat] ?? { label: cat, icon: '•' };
            return (
              <div key={cat}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  {meta.icon} {meta.label}
                </p>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {items.map((param, i) => (
                    <div
                      key={param.key}
                      className={`flex items-center gap-4 px-5 py-4 transition-colors ${
                        editingParam === param.key ? 'bg-yellow-50' : i > 0 ? 'border-t border-gray-50' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{param.label}</p>
                        {param.description && (
                          <p className="text-xs text-gray-400 mt-0.5 leading-snug">{param.description}</p>
                        )}
                      </div>

                      {editingParam === param.key ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="number"
                            step="0.1"
                            value={paramDraft[param.key] ?? ''}
                            onChange={e => setParamDraft(prev => ({ ...prev, [param.key]: e.target.value }))}
                            className="w-24 border border-yellow-300 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-yellow-400 tabular-nums"
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') saveParam(param.key); if (e.key === 'Escape') setEditingParam(null); }}
                          />
                          {param.unit && <span className="text-sm text-gray-400 w-10 shrink-0">{param.unit}</span>}
                          <button onClick={() => saveParam(param.key)} disabled={savingParam === param.key}
                            className="text-xs bg-yellow-500 hover:bg-yellow-600 text-white font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 shrink-0">
                            {savingParam === param.key ? 'Saving…' : 'Save'}
                          </button>
                          <button onClick={() => { setEditingParam(null); setParamDraft(prev => ({ ...prev, [param.key]: String(param.value) })); }}
                            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 shrink-0">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-base font-bold text-gray-800 tabular-nums min-w-[40px] text-right">{param.value}</span>
                          {param.unit && <span className="text-sm text-gray-400 w-12">{param.unit}</span>}
                          <button onClick={() => setEditingParam(param.key)}
                            className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 px-3 py-1.5 rounded-lg transition-colors shrink-0">
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Section 2: Calculation Formulas ─────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center text-xl">📐</div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Calculation Formulas</h2>
              <p className="text-xs text-gray-500">
                Mathematical rules used in quotation calculations. Click Edit to modify any formula.
              </p>
            </div>
          </div>
          <button
            onClick={() => { setShowAddForm(v => !v); setAddError(''); setAddValidation(null); setAddTestResult(null); }}
            className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border transition-colors ${
              showAddForm
                ? 'bg-gray-100 text-gray-600 border-gray-200'
                : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
            }`}
          >
            {showAddForm ? '✕ Cancel' : '+ Add Formula'}
          </button>
        </div>

        {/* ── Add Formula Panel ────────────────────────────────────────────── */}
        {showAddForm && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-4">
            <p className="text-sm font-semibold text-blue-800">New Formula</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Formula Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Custom Savings Boost"
                  value={newFormula.name}
                  onChange={e => handleNewNameChange(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Slug (auto) *</label>
                <input
                  type="text"
                  placeholder="e.g. custom-savings-boost"
                  value={newFormula.slug}
                  onChange={e => setNewFormula(prev => ({ ...prev, slug: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Description</label>
              <input
                type="text"
                placeholder="What does this formula calculate?"
                value={newFormula.description}
                onChange={e => setNewFormula(prev => ({ ...prev, description: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Expression *</label>
              <input
                type="text"
                placeholder="e.g. base_cost * profit_pct / 100"
                value={newFormula.expression}
                onChange={e => { setNewFormula(prev => ({ ...prev, expression: e.target.value })); setAddValidation(null); }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              />
              <p className="text-xs text-gray-400 mt-1">
                Supported: +, -, *, /, pow(), sqrt(), abs(), min(), max(), comparisons (&gt;, &lt;, etc.)
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">
                Variables used <span className="font-normal text-gray-400">(comma-separated)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. base_cost, profit_pct"
                value={newFormula.variablesRaw}
                onChange={e => setNewFormula(prev => ({ ...prev, variablesRaw: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              />
            </div>

            {/* Validation feedback */}
            {addValidation && (
              <div className={`text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 ${
                addValidation.valid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
              }`}>
                <span>{addValidation.valid ? '✓' : '✗'}</span>
                {addValidation.valid ? 'Formula syntax is valid' : addValidation.error}
              </div>
            )}

            {/* Quick test */}
            {newVars.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-semibold text-gray-500 mb-3">Quick Test</p>
                <div className="flex flex-wrap gap-3 items-end">
                  {newVars.map(v => (
                    <div key={v} className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500">{VAR_META[v]?.label ?? v}</label>
                      <input
                        type="number"
                        step="any"
                        defaultValue={VAR_META[v]?.example ?? 0}
                        onChange={e => setAddTestInputs(prev => ({ ...prev, [v]: e.target.value }))}
                        className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>
                  ))}
                  <button onClick={testNewFormula}
                    className="border border-gray-200 bg-white hover:bg-gray-50 text-xs text-gray-700 px-3 py-2 rounded-lg transition-colors">
                    Validate →
                  </button>
                  {addTestResult && (
                    <div className={`text-sm font-mono font-bold px-3 py-2 rounded-lg ${
                      addTestResult.isError ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
                    }`}>
                      {addTestResult.value}
                    </div>
                  )}
                </div>
              </div>
            )}

            {addError && (
              <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{addError}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={validateNewFormula}
                className="text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 px-4 py-1.5 rounded-lg transition-colors">
                Validate Syntax
              </button>
              <button
                onClick={saveNewFormula}
                disabled={savingNew || addValidation?.valid === false}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {savingNew ? 'Creating…' : 'Create Formula'}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewFormula(EMPTY_NEW); setAddError(''); setAddValidation(null); }}
                className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Formula list ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {formulas.length === 0 && (
            <div className="py-12 text-center text-gray-400 text-sm">
              No formulas found. Run <code className="font-mono bg-gray-100 px-1 rounded">npm run seed</code> to populate them.
            </div>
          )}

          {formulas.map((formula, i) => {
            const activeVer  = formula.versions?.find(v => v.isActive) ?? formula.versions?.[0];
            const vars       = getVars(activeVer!);
            const isEditing  = editingFormula === formula.id;
            const validation = validations[formula.id];
            const testResult = testResults[formula.id];

            return (
              <div key={formula.id}>
                {/* ── Formula row ─────────────────────────────────── */}
                <div
                  className={`flex items-start gap-4 px-5 py-4 transition-colors ${
                    isEditing ? 'bg-blue-50' : i > 0 ? 'border-t border-gray-50 hover:bg-gray-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{formula.name}</p>
                    {formula.description && (
                      <p className="text-xs text-gray-400 mt-0.5">{formula.description}</p>
                    )}
                    <code className="mt-1.5 inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono break-all">
                      {activeVer?.expression ?? '—'}
                    </code>
                  </div>
                  <div className="shrink-0 pt-0.5">
                    {isEditing ? (
                      <button onClick={() => setEditingFormula(null)}
                        className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg">
                        Close
                      </button>
                    ) : (
                      <button onClick={() => openFormulaEdit(formula)}
                        className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 px-3 py-1.5 rounded-lg transition-colors">
                        Edit
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Inline editor ──────────────────────────────── */}
                {isEditing && (
                  <div className="px-5 pb-5 bg-blue-50 border-t border-blue-100">
                    <div className="bg-white rounded-xl border border-blue-100 p-5 space-y-4">

                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Calculation Rule</label>
                        <input
                          type="text"
                          value={formulaDraft[formula.id] ?? ''}
                          onChange={e => {
                            setFormulaDraft(prev => ({ ...prev, [formula.id]: e.target.value }));
                            setValidations(prev => { const n = { ...prev }; delete n[formula.id]; return n; });
                          }}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                          placeholder="Enter formula expression…"
                        />
                        {vars.length > 0 && (
                          <p className="text-xs text-gray-400 mt-1">
                            Variables: <span className="font-mono">{vars.map(v => VAR_META[v]?.label ?? v).join(', ')}</span>
                          </p>
                        )}
                      </div>

                      {validation && (
                        <div className={`text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 ${
                          validation.valid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                        }`}>
                          <span>{validation.valid ? '✓' : '✗'}</span>
                          {validation.valid ? 'Formula syntax is valid' : validation.error}
                        </div>
                      )}

                      {vars.length > 0 && (
                        <div className="bg-gray-50 rounded-xl p-4">
                          <p className="text-xs font-semibold text-gray-500 mb-3">Quick Test</p>
                          <div className="flex flex-wrap gap-3 items-end">
                            {vars.map(v => {
                              const meta = VAR_META[v];
                              return (
                                <div key={v} className="flex flex-col gap-1">
                                  <label className="text-xs text-gray-500">{meta?.label ?? v}</label>
                                  <input
                                    type="number"
                                    step="any"
                                    defaultValue={meta?.example ?? 0}
                                    onChange={e => setTestInputs(prev => ({
                                      ...prev,
                                      [formula.id]: { ...(prev[formula.id] ?? {}), [v]: e.target.value },
                                    }))}
                                    className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-300 tabular-nums"
                                  />
                                </div>
                              );
                            })}
                            <button onClick={() => testFormula(formula)}
                              className="border border-gray-200 bg-white hover:bg-gray-50 text-xs text-gray-700 px-3 py-2 rounded-lg transition-colors">
                              Calculate →
                            </button>
                            {testResult && (
                              <div className={`text-sm font-mono font-bold px-3 py-2 rounded-lg ${
                                testResult.isError ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
                              }`}>
                                = {testResult.value}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-1">
                        <button onClick={() => validateFormula(formula.id)}
                          className="text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 px-4 py-1.5 rounded-lg transition-colors">
                          Validate
                        </button>
                        <button
                          onClick={() => saveFormula(formula)}
                          disabled={savingFormula === formula.id || validation?.valid === false}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {savingFormula === formula.id ? 'Saving…' : 'Save Changes'}
                        </button>
                        <button onClick={() => setEditingFormula(null)}
                          className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5">
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 mt-3 text-center">
          {formulas.length} formula{formulas.length !== 1 ? 's' : ''} loaded
        </p>
      </section>
    </div>
  );
}
