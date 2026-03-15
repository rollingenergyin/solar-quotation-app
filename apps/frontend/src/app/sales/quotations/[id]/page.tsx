'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

interface CalcResult {
  avgMonthlyKwh: number;
  recommendedSystemKw: number;
  totalWatts: number;
  baseCost: number;
  profitAmount: number;
  preTaxCost: number;
  gstAmount: number;
  grossCost: number;
  subsidyAmount: number;
  netCost: number;
  annualGenKwh: number;
  annualSavings: number;
  lifetimeSavings: number;
  yearlySavings: number[];
  simplePaybackYears: number;
  paybackWithInflationYears: number;
  roiPct: number;
  emi: {
    tenure3yr: { emi: number; totalPayable: number; totalInterest: number };
    tenure5yr: { emi: number; totalPayable: number; totalInterest: number };
    tenure7yr: { emi: number; totalPayable: number; totalInterest: number };
  };
  inputs: {
    systemSizeKw: number;
    pricePerWatt: number;
    profitMarginPct: number;
    gstPct: number;
    electricityRatePerUnit: number;
    gridInflationPct: number;
    peakSunHours: number;
    systemEfficiency: number;
    systemLifeYears: number;
    emiRatePct: number;
  };
}

interface QuotationInfo {
  id: string;
  quoteNumber: string;
  status: string;
  version?: number;
  notes?: string;
  inverterSizeKw?: number | null;
  generatedPdfPath?: string | null;
  customer: { name: string };
  site: { name?: string; address: string };
  createdBy: { name: string };
  result?: { roiYears: number; roiPercentage: number; emiMonthly: number };
}

const fmt = (n: number) => n.toLocaleString('en-IN');
const fmtK = (n: number) => n >= 100_000 ? `₹${(n / 100_000).toFixed(2)}L` : `₹${fmt(n)}`;

export default function QuotationDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const [quotation, setQuotation] = useState<QuotationInfo | null>(null);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');

  // ── Form state ──────────────────────────────────────────────────────────
  const [systemType, setSystemType]     = useState<'DCR' | 'NON_DCR'>('DCR');
  const [siteType, setSiteType]         = useState<'RESIDENTIAL' | 'SOCIETY' | 'COMMERCIAL' | 'INDUSTRIAL'>('RESIDENTIAL');
  const [pricePerWatt, setPricePerWatt] = useState('38');
  const [electricityRate, setElectricityRate] = useState('8');
  const [systemSizeKw, setSystemSizeKw] = useState('');
  const [inverterSizeKw, setInverterSizeKw] = useState('');
  const [inverterManuallyEdited, setInverterManuallyEdited] = useState(false);
  const [profitPct, setProfitPct] = useState('15');
  const [gstPct, setGstPct] = useState('18');
  const [subsidyOverride, setSubsidyOverride] = useState('');
  const [gridInflation, setGridInflation] = useState('3');
  const [peakSunHours, setPeakSunHours] = useState('5');
  const [efficiency, setEfficiency] = useState('0.8');
  const [lifeYears, setLifeYears] = useState('25');
  const [emiRate, setEmiRate] = useState('9');
  const [sanctionedLoadKw, setSanctionedLoadKw] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ── Active EMI tab ──────────────────────────────────────────────────────
  const [emiTab, setEmiTab] = useState<'3yr' | '5yr' | '7yr'>('5yr');

  const loadQuotation = useCallback(async () => {
    try {
      const q = await api<QuotationInfo>(`/quotations/${id}`);
      setQuotation(q);
      if (q.inverterSizeKw != null) setInverterSizeKw(String(q.inverterSizeKw));
    } catch { setError('Failed to load quotation'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { loadQuotation(); }, [loadQuotation]);

  // Auto-fill inverter size when system size changes (unless user has manually edited inverter)
  useEffect(() => {
    if (!inverterManuallyEdited && systemSizeKw) {
      const sys = parseFloat(systemSizeKw);
      if (!isNaN(sys) && sys > 0) setInverterSizeKw(systemSizeKw);
    }
  }, [systemSizeKw]); // eslint-disable-line react-hooks/exhaustive-deps

  const calculate = async () => {
    setCalculating(true);
    setError('');
    try {
      const body: Record<string, number | string | undefined> = {
        pricePerWatt:            parseFloat(pricePerWatt),
        electricityRatePerUnit:  parseFloat(electricityRate),
        profitMarginPct:         parseFloat(profitPct),
        gstPct:                  parseFloat(gstPct),
        gridInflationPct:        parseFloat(gridInflation),
        peakSunHours:            parseFloat(peakSunHours),
        systemEfficiency:        parseFloat(efficiency),
        systemLifeYears:         parseInt(lifeYears),
        emiRatePct:              parseFloat(emiRate),
        systemType,
        siteType,
      };
      if (systemSizeKw)    body.systemSizeKw           = parseFloat(systemSizeKw);
      if (inverterSizeKw)  body.inverterSizeKw         = parseFloat(inverterSizeKw);
      else if (systemSizeKw) body.inverterSizeKw       = parseFloat(systemSizeKw); // Default to system size
      if (subsidyOverride && systemType === 'DCR' && siteType !== 'COMMERCIAL')
        body.subsidyAmountOverride = parseFloat(subsidyOverride);
      if (sanctionedLoadKw) body.sanctionedLoadKw = parseFloat(sanctionedLoadKw);

      const r = await api<CalcResult>(`/quotations/${id}/calculate`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setResult(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Calculation failed');
    } finally { setCalculating(false); }
  };


  // ── Savings chart data (every 5th year for readability) ──────────────────
  const chartData = result
    ? result.yearlySavings.map((v, i) => ({
        year: `Yr ${i + 1}`,
        savings: v,
        cumulative: result.yearlySavings.slice(0, i + 1).reduce((s, x) => s + x, 0),
      })).filter((_, i) => i % 1 === 0) // all years
    : [];

  if (loading) return <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>;
  if (!quotation) return <div className="p-8 text-center text-red-500 text-sm">{error || 'Quotation not found'}</div>;

  const emiData = result && {
    '3yr': result.emi.tenure3yr,
    '5yr': result.emi.tenure5yr,
    '7yr': result.emi.tenure7yr,
  }[emiTab];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/sales" className="text-xs text-gray-400 hover:text-gray-600">← Sales Dashboard</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{quotation.quoteNumber}</h1>
          <p className="text-sm text-gray-500">
            {quotation.customer.name} · {quotation.site.name || quotation.site.address}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${
            quotation.status === 'ACCEPTED' ? 'bg-green-100 text-green-700' :
            quotation.status === 'SENT'     ? 'bg-blue-100 text-blue-700' :
            quotation.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-600'
          }`}>{quotation.status}</span>

          <div className="flex flex-wrap items-center gap-2">
            {result && (
              <Link
                href={`/quotation/${id}/print`}
                target="_blank"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors text-white"
                style={{ background: '#6690cc' }}
              >
                📄 View Proposal
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* ── Left: Input form ── */}
        <div className="col-span-1 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Calculation Inputs</h2>

            <div className="space-y-3">
              {/* System Type */}
              <Field label="System Type" hint="Affects subsidy eligibility">
                <div className="grid grid-cols-2 gap-1.5">
                  {(['DCR', 'NON_DCR'] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setSystemType(t)}
                      className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${
                        systemType === t
                          ? t === 'DCR'
                            ? 'bg-green-500 text-white border-green-500'
                            : 'bg-amber-500 text-white border-amber-500'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}>
                      {t === 'DCR' ? '🏛️ DCR' : '🏭 Non-DCR'}
                    </button>
                  ))}
                </div>
                {systemType === 'NON_DCR' && (
                  <p className="text-[10px] text-amber-600 mt-1">⚠ No PM Surya Ghar subsidy — depreciation benefits apply</p>
                )}
              </Field>

              {/* Site Type */}
              <Field label="Site Type" hint="Determines subsidy amount">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {([
                    { val: 'RESIDENTIAL', label: '🏠 Residential' },
                    { val: 'SOCIETY',     label: '🏢 Society' },
                    { val: 'COMMERCIAL',  label: '🏭 Commercial' },
                    { val: 'INDUSTRIAL',  label: '🏭 Industrial' },
                  ] as const).map((s) => (
                    <button key={s.val} type="button" onClick={() => setSiteType(s.val)}
                      className={`py-1.5 rounded-lg text-[10px] font-semibold border transition-colors ${
                        siteType === s.val
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}>
                      {s.label}
                    </button>
                  ))}
                </div>
                {siteType === 'COMMERCIAL' && systemType === 'DCR' && (
                  <p className="text-[10px] text-gray-500 mt-1">Commercial — no direct subsidy</p>
                )}
              </Field>

              {/* Subsidy info preview */}
              {systemType === 'DCR' && (
                <div className="rounded-lg px-3 py-2 text-[10px]" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <span className="font-semibold text-green-700">Expected Subsidy: </span>
                  <span className="text-green-700">
                    {siteType === 'COMMERCIAL' ? 'None' :
                     siteType === 'SOCIETY'    ? '₹18,000 × system kW' :
                                                '₹30k (1kW) / ₹60k (2kW) / ₹78k (3kW+)'}
                  </span>
                </div>
              )}

              <Field label="Price per Watt (₹)" hint="All-in base rate">
                <input type="number" step="0.5" min="0" value={pricePerWatt}
                  onChange={(e) => setPricePerWatt(e.target.value)}
                  className="input" />
              </Field>
              <Field label="Electricity Tariff (₹/kWh)" hint="Current rate paid">
                <input type="number" step="0.5" min="0" value={electricityRate}
                  onChange={(e) => setElectricityRate(e.target.value)}
                  className="input" />
              </Field>
              <Field label="System Size (kWp)" hint="Leave blank to auto-size from bills">
                <input type="number" step="0.5" min="0.5" placeholder="Auto"
                  value={systemSizeKw} onChange={(e) => setSystemSizeKw(e.target.value)}
                  className="input" />
              </Field>
              <Field label="Inverter Size (kW)" hint="Defaults to system size. Edit to undersize or oversize inverter.">
                <input type="number" step="0.5" min="0.5" placeholder="Same as system"
                  value={inverterSizeKw}
                  onChange={(e) => { setInverterSizeKw(e.target.value); setInverterManuallyEdited(true); }}
                  className="input" />
              </Field>

            <Field label="Sanctioned Load (kW)" hint="Present load — optional">
              <input type="number" step="0.5" min="0" placeholder="e.g. 5"
                value={sanctionedLoadKw} onChange={(e) => setSanctionedLoadKw(e.target.value)}
                className="input" />
            </Field>

            {/* Advanced toggle */}
            <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-yellow-600 hover:text-yellow-700 font-medium w-full text-left">
              {showAdvanced ? '▲ Hide advanced' : '▼ Advanced options'}
            </button>

              {showAdvanced && (
                <div className="space-y-3 border-t border-gray-100 pt-3">
                  <Field label="Profit Margin (%)" hint="">
                    <input type="number" step="1" min="0" max="100" value={profitPct}
                      onChange={(e) => setProfitPct(e.target.value)} className="input" />
                  </Field>
                  <Field label="GST (%)" hint="">
                    <input type="number" step="1" min="0" max="100" value={gstPct}
                      onChange={(e) => setGstPct(e.target.value)} className="input" />
                  </Field>
                  {systemType === 'DCR' && siteType !== 'COMMERCIAL' && (
                    <Field label="Subsidy Override (₹)" hint="Blank = PM Surya Ghar auto">
                      <input type="number" step="1000" min="0" placeholder="Auto"
                        value={subsidyOverride} onChange={(e) => setSubsidyOverride(e.target.value)}
                        className="input" />
                    </Field>
                  )}
                  <Field label="Grid Inflation (%/yr)" hint="">
                    <input type="number" step="0.5" min="0" value={gridInflation}
                      onChange={(e) => setGridInflation(e.target.value)} className="input" />
                  </Field>
                  <Field label="Peak Sun Hours/Day" hint="">
                    <input type="number" step="0.5" min="1" max="12" value={peakSunHours}
                      onChange={(e) => setPeakSunHours(e.target.value)} className="input" />
                  </Field>
                  <Field label="System Efficiency" hint="0–1 (typical 0.75–0.85)">
                    <input type="number" step="0.05" min="0.1" max="1" value={efficiency}
                      onChange={(e) => setEfficiency(e.target.value)} className="input" />
                  </Field>
                  <Field label="System Life (years)" hint="">
                    <input type="number" step="1" min="1" max="50" value={lifeYears}
                      onChange={(e) => setLifeYears(e.target.value)} className="input" />
                  </Field>
                  <Field label="EMI Interest Rate (%)" hint="">
                    <input type="number" step="0.5" min="0" max="50" value={emiRate}
                      onChange={(e) => setEmiRate(e.target.value)} className="input" />
                  </Field>
                </div>
              )}
            </div>

            {error && <p className="text-xs text-red-500 mt-3">{error}</p>}

            <button onClick={calculate} disabled={calculating}
              className="mt-5 w-full bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50
                         text-white font-semibold py-2.5 rounded-lg transition-colors text-sm">
              {calculating ? 'Calculating…' : result ? '↺ Recalculate' : '⚡ Calculate'}
            </button>
          </div>
        </div>

        {/* ── Right: Results ── */}
        <div className="col-span-2 space-y-4">
          {!result ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="text-4xl mb-3">⚡</div>
              <p className="text-gray-500 text-sm">Fill in the inputs and click Calculate to generate the quotation.</p>
            </div>
          ) : (
            <>
              {/* ── Sizing ── */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">System Sizing</h3>
                <div className="grid grid-cols-3 gap-4">
                  <Stat label="Avg Monthly Consumption" value={`${fmt(result.avgMonthlyKwh)} kWh`} />
                  <Stat label="Recommended System" value={`${result.recommendedSystemKw} kWp`} highlight />
                  <Stat label="Total Watts" value={`${fmt(result.totalWatts)} W`} />
                  <Stat label="Annual Generation" value={`${fmt(result.annualGenKwh)} kWh`} />
                  <Stat label="Peak Sun Hours" value={`${result.inputs.peakSunHours} hrs/day`} />
                  <Stat label="System Efficiency" value={`${(result.inputs.systemEfficiency * 100).toFixed(0)}%`} />
                </div>
              </div>

              {/* ── Cost Breakdown ── */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Cost Breakdown</h3>
                <div className="space-y-2 text-sm">
                  <CostRow label={`Base Cost (₹${result.inputs.pricePerWatt}/W × ${fmt(result.totalWatts)} W)`}
                    value={result.baseCost} />
                  <CostRow label={`Profit Margin (${result.inputs.profitMarginPct}%)`}
                    value={result.profitAmount} sub />
                  <CostRow label="Pre-tax Cost" value={result.preTaxCost} bold />
                  <CostRow label={`GST (${result.inputs.gstPct}%)`} value={result.gstAmount} sub />
                  <CostRow label="Gross Cost (incl. GST)" value={result.grossCost} bold />
                  {result.subsidyAmount > 0 && (
                    <CostRow label="PM Surya Ghar Subsidy" value={-result.subsidyAmount}
                      className="text-green-600" />
                  )}
                  {result.subsidyAmount === 0 && systemType === 'NON_DCR' && (
                    <div className="text-xs text-amber-600 pl-3">⚡ Non-DCR: Depreciation benefits apply (see proposal)</div>
                  )}
                  <div className="border-t border-gray-200 pt-2 mt-1">
                    <div className="flex justify-between font-bold text-base text-gray-900">
                      <span>Net Customer Cost</span>
                      <span className="text-yellow-600">{fmtK(result.netCost)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── ROI & Payback ── */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">ROI & Savings</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <Stat label="Year-1 Annual Savings" value={fmtK(result.annualSavings)} highlight />
                  <Stat label="Lifetime Savings (25 yr)" value={fmtK(result.lifetimeSavings)} highlight />
                  <Stat label="Simple Payback" value={`${result.simplePaybackYears} yrs`} />
                  <Stat label="Payback (with inflation)" value={`${result.paybackWithInflationYears} yrs`} />
                  <Stat label={`Annualised ROI (${result.inputs.systemLifeYears} yr)`}
                    value={`${result.roiPct}%`} />
                  <Stat label="Grid Inflation Assumed" value={`${result.inputs.gridInflationPct}%/yr`} />
                </div>

                {/* Savings chart */}
                <div className="h-52 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.filter((_, i) => i < 25)} barSize={8}
                      margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="year" tick={{ fontSize: 9 }}
                        interval={4} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false}
                        tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number | undefined) => [v != null ? `₹${fmt(v)}` : '', '']}
                        contentStyle={{ fontSize: 11 }} />
                      <Bar dataKey="savings" fill="#fbbf24" name="Annual Savings" radius={[2, 2, 0, 0]} />
                      <ReferenceLine y={result.netCost / result.inputs.systemLifeYears}
                        stroke="#ef4444" strokeDasharray="4 3"
                        label={{ value: 'Avg cost/yr', fontSize: 9, fill: '#ef4444' }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ── EMI ── */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
                  EMI Options · {result.inputs.emiRatePct}% p.a.
                </h3>
                <div className="flex gap-2 mb-4">
                  {(['3yr', '5yr', '7yr'] as const).map((t) => (
                    <button key={t} onClick={() => setEmiTab(t)}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors
                        ${emiTab === t
                          ? 'bg-yellow-500 text-white border-yellow-500'
                          : 'border-gray-200 text-gray-600 hover:border-yellow-300'}`}>
                      {t === '3yr' ? '3 Years' : t === '5yr' ? '5 Years' : '7 Years'}
                    </button>
                  ))}
                </div>
                {emiData && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-xl bg-yellow-50 border border-yellow-100 p-4 text-center">
                      <p className="text-xs text-gray-500 mb-1">Monthly EMI</p>
                      <p className="text-2xl font-bold text-yellow-600">{fmtK(emiData.emi)}</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 text-center">
                      <p className="text-xs text-gray-500 mb-1">Total Payable</p>
                      <p className="text-xl font-bold text-gray-800">{fmtK(emiData.totalPayable)}</p>
                    </div>
                    <div className="rounded-xl bg-red-50 border border-red-100 p-4 text-center">
                      <p className="text-xs text-gray-500 mb-1">Total Interest</p>
                      <p className="text-xl font-bold text-red-500">{fmtK(emiData.totalInterest)}</p>
                    </div>
                  </div>
                )}

                {/* Side-by-side comparison */}
                <div className="mt-4 overflow-hidden rounded-lg border border-gray-100">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Tenure', 'Monthly EMI', 'Total Payable', 'Total Interest'].map((h) => (
                          <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(
                        [
                          ['3 Years (36 mo)', result.emi.tenure3yr],
                          ['5 Years (60 mo)', result.emi.tenure5yr],
                          ['7 Years (84 mo)', result.emi.tenure7yr],
                        ] as [string, { emi: number; totalPayable: number; totalInterest: number }][]
                      ).map(([label, e]) => (
                        <tr key={label} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-medium text-gray-700">{label}</td>
                          <td className="px-4 py-2.5 font-bold text-yellow-600">{fmtK(e.emi)}</td>
                          <td className="px-4 py-2.5 text-gray-700">{fmtK(e.totalPayable)}</td>
                          <td className="px-4 py-2.5 text-red-500">{fmtK(e.totalInterest)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Small helper components ───────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-gray-600 font-medium block mb-0.5">{label}</label>
      {hint && <p className="text-[10px] text-gray-400 mb-1">{hint}</p>}
      {children}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${highlight ? 'bg-yellow-50 border border-yellow-100' : 'bg-gray-50'}`}>
      <p className="text-[10px] text-gray-500 mb-0.5">{label}</p>
      <p className={`text-base font-bold ${highlight ? 'text-yellow-600' : 'text-gray-800'}`}>{value}</p>
    </div>
  );
}

function CostRow({ label, value, sub, bold, className }: {
  label: string; value: number; sub?: boolean; bold?: boolean; className?: string;
}) {
  return (
    <div className={`flex justify-between ${sub ? 'pl-3 text-gray-500 text-xs' : ''} ${bold ? 'font-semibold' : ''}`}>
      <span className={className}>{label}</span>
      <span className={className ?? (value < 0 ? 'text-green-600' : '')}>
        {value < 0 ? `−₹${fmt(-value)}` : `₹${fmt(value)}`}
      </span>
    </div>
  );
}
