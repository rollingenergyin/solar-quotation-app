'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS = [
  { key: 'jan', label: 'Jan' }, { key: 'feb', label: 'Feb' },
  { key: 'mar', label: 'Mar' }, { key: 'apr', label: 'Apr' },
  { key: 'may', label: 'May' }, { key: 'jun', label: 'Jun' },
  { key: 'jul', label: 'Jul' }, { key: 'aug', label: 'Aug' },
  { key: 'sep', label: 'Sep' }, { key: 'oct', label: 'Oct' },
  { key: 'nov', label: 'Nov' }, { key: 'dec', label: 'Dec' },
];

// ── Live calculation (client-side preview) ────────────────────────────────────

function calcSubsidyPreview(
  kw: number,
  systemType: string,
  siteType: string,
): number {
  if (systemType === 'NON_DCR' || siteType === 'COMMERCIAL' || siteType === 'INDUSTRIAL') return 0;
  if (siteType === 'SOCIETY') return Math.round(kw * 18000);
  if (kw <= 1) return 30000;
  if (kw <= 2) return 60000;
  return 78000;
}

interface LiveSummary {
  systemSizeKw: number;
  roofAreaSqft: number;
  dailyProductionKwh: number;
  annualProductionKwh: number;
  baseCost: number;
  gstAmount: number;
  grossCost: number;
  subsidyAmount: number;
  netCost: number;
  annualSavings: number;
  breakevenYears: number;
  pricePerWattEffective: number;
}

function computeLive(
  systemSizeKw: number,
  pricePerWatt: number,
  electricityRate: number,
  peakSunHours: number,
  systemType: string,
  siteType: string,
): LiveSummary | null {
  if (systemSizeKw <= 0 || pricePerWatt <= 0) return null;

  const roofAreaSqft         = Math.round(systemSizeKw * 80);
  const dailyProductionKwh   = Math.round(systemSizeKw * peakSunHours * 10) / 10;
  const annualProductionKwh  = Math.round(dailyProductionKwh * 365);

  // Quick Quotation: no profit addition — the entered base cost is the total price
  const baseCost      = Math.round(systemSizeKw * 1000 * pricePerWatt);
  const gstAmount     = Math.round(baseCost * 0.089);
  const grossCost     = baseCost + gstAmount;
  const subsidyAmount = calcSubsidyPreview(systemSizeKw, systemType, siteType);
  const netCost       = Math.max(0, grossCost - subsidyAmount);
  const annualSavings = Math.round(annualProductionKwh * electricityRate);
  const breakevenYears = annualSavings > 0 ? Math.round((netCost / annualSavings) * 10) / 10 : 0;

  return {
    systemSizeKw, roofAreaSqft, dailyProductionKwh, annualProductionKwh,
    baseCost, gstAmount, grossCost, subsidyAmount, netCost,
    annualSavings, breakevenYears,
    pricePerWattEffective: pricePerWatt,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fmtL = (n: number) =>
  n >= 100_000 ? `₹${(n / 100_000).toFixed(2)}L` : `₹${fmt(n)}`;

// ── Component ─────────────────────────────────────────────────────────────────

export default function QuickQuotationPage() {
  const router = useRouter();

  // ── Customer
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress]           = useState('');
  const [city, setCity]                 = useState('');
  const [phone, setPhone]               = useState('');
  const [email, setEmail]               = useState('');

  // ── System
  const [systemType, setSystemType] = useState<'DCR' | 'NON_DCR'>('DCR');
  const [siteType, setSiteType]     = useState<'RESIDENTIAL' | 'SOCIETY' | 'COMMERCIAL' | 'INDUSTRIAL'>('RESIDENTIAL');

  // ── Sizing
  const [sizingMode, setSizingMode]       = useState<'monthly' | 'direct'>('monthly');
  const [monthlyUnits, setMonthlyUnits]   = useState<Record<string, string>>({});
  const [directKw, setDirectKw]           = useState('');
  const [inverterSizeKw, setInverterSizeKw] = useState('');
  const [inverterManuallyEdited, setInverterManuallyEdited] = useState(false);

  // ── Pricing
  const [pricePerWatt, setPricePerWatt]       = useState('55');
  const [totalBaseAmount, setTotalBaseAmount] = useState('');

  // ── Params
  const [electricityRate, setElectricityRate]     = useState('8');
  const [peakSunHours, setPeakSunHours]           = useState('5');
  const [sanctionedLoadKw, setSanctionedLoadKw]   = useState('');

  // ── Form state
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState('');

  // ── Derived system size ───────────────────────────────────────────────────

  const derivedSystemKw = useMemo(() => {
    if (sizingMode === 'direct') {
      const v = parseFloat(directKw);
      return v > 0 ? v : 0;
    }
    const valid = Object.values(monthlyUnits)
      .map(v => parseFloat(v))
      .filter(v => !isNaN(v) && v > 0);
    if (valid.length === 0) return 0;
    const avg = valid.reduce((s, v) => s + v, 0) / valid.length;
    // Formula: (avg_monthly / 100), rounded to nearest 0.5 kW
    return Math.max(1, Math.ceil((avg / 100) * 2) / 2);
  }, [sizingMode, directKw, monthlyUnits]);

  // ── Effective price per watt ──────────────────────────────────────────────

  const effectivePricePerWatt = useMemo(() => {
    const ppw = parseFloat(pricePerWatt);
    if (ppw > 0) return ppw;
    const total = parseFloat(totalBaseAmount);
    if (total > 0 && derivedSystemKw > 0) return total / (derivedSystemKw * 1000);
    return 0;
  }, [pricePerWatt, totalBaseAmount, derivedSystemKw]);

  // ── Auto-sync pricing fields ──────────────────────────────────────────────

  const handlePricePerWattChange = (v: string) => {
    setPricePerWatt(v);
    const ppw = parseFloat(v);
    if (ppw > 0 && derivedSystemKw > 0) {
      setTotalBaseAmount(String(Math.round(derivedSystemKw * 1000 * ppw)));
    } else {
      setTotalBaseAmount('');
    }
  };

  const handleTotalBaseAmountChange = (v: string) => {
    setTotalBaseAmount(v);
    const total = parseFloat(v);
    if (total > 0 && derivedSystemKw > 0) {
      setPricePerWatt((total / (derivedSystemKw * 1000)).toFixed(2));
    } else {
      setPricePerWatt('');
    }
  };

  // When system size changes, re-sync total base amount from price per watt
  useEffect(() => {
    const ppw = parseFloat(pricePerWatt);
    if (ppw > 0 && derivedSystemKw > 0) {
      setTotalBaseAmount(String(Math.round(derivedSystemKw * 1000 * ppw)));
    }
  }, [derivedSystemKw]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill inverter size when system size changes (unless manually edited)
  useEffect(() => {
    if (!inverterManuallyEdited && derivedSystemKw > 0) {
      setInverterSizeKw(String(derivedSystemKw));
    }
  }, [derivedSystemKw]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Live summary ─────────────────────────────────────────────────────────

  const summary = useMemo(() => computeLive(
    derivedSystemKw,
    effectivePricePerWatt,
    parseFloat(electricityRate) || 8,
    parseFloat(peakSunHours) || 5,
    systemType,
    siteType,
  ), [derivedSystemKw, effectivePricePerWatt, electricityRate, peakSunHours, systemType, siteType]);

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setFormError('');

    if (!customerName.trim()) { setFormError('Customer name is required.'); return; }
    if (!address.trim())      { setFormError('Address is required.'); return; }
    if (derivedSystemKw <= 0) { setFormError('Please enter monthly units or a system size.'); return; }
    if (effectivePricePerWatt <= 0) { setFormError('Please enter a price per watt or total base amount.'); return; }
    if (!(parseFloat(electricityRate) > 0)) { setFormError('Enter a valid electricity rate.'); return; }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        customerName: customerName.trim(),
        address: address.trim(),
        city: city.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        systemType,
        siteType,
        systemSizeKw: derivedSystemKw,
        inverterSizeKw: inverterSizeKw ? parseFloat(inverterSizeKw) : derivedSystemKw,
        pricePerWatt: effectivePricePerWatt,
        electricityRatePerUnit: parseFloat(electricityRate) || 8,
        peakSunHours: parseFloat(peakSunHours) || 5,
        sanctionedLoadKw: sanctionedLoadKw ? parseFloat(sanctionedLoadKw) : undefined,
      };

      const res = await api<{ quotationId: string; quoteNumber: string }>('/quotations/quick', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      router.push(`/quotation/${res.quotationId}/print`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to generate quotation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/sales" className="text-gray-400 hover:text-gray-600 text-xl leading-none">←</Link>
          <div className="h-5 w-px bg-gray-200" />
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <div>
              <h1 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Quick Quotation
              </h1>
              <p className="text-xs text-gray-400">Generate a professional solar proposal in minutes</p>
            </div>
          </div>
        </div>
        <Link
          href="/sales/customers/new"
          className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg"
        >
          Need detailed workflow? → Full Quotation
        </Link>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6">

        {/* ── LEFT: Form ──────────────────────────────────────────────────── */}
        <div className="flex-1 space-y-5 min-w-0">

          {/* ── Section 1: Customer Info ─────────────────────────────────── */}
          <FormCard title="1. Customer Information" icon="👤">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <FieldLabel required>Customer Name</FieldLabel>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Sharma / ABC Pvt. Ltd."
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="col-span-2">
                <FieldLabel required>Address / Location</FieldLabel>
                <input
                  type="text"
                  placeholder="Plot / flat, street, area"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <FieldLabel>City</FieldLabel>
                <input type="text" placeholder="Pune" value={city} onChange={e => setCity(e.target.value)} className={inputCls} />
              </div>
              <div>
                <FieldLabel>Phone</FieldLabel>
                <input type="tel" placeholder="+91 98765 43210" value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} />
              </div>
              <div className="col-span-2">
                <FieldLabel>Email</FieldLabel>
                <input type="email" placeholder="customer@email.com" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
              </div>
            </div>
          </FormCard>

          {/* ── Section 2: System Type ──────────────────────────────────── */}
          <FormCard title="2. System Configuration" icon="⚙️">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>System Type</FieldLabel>
                <ToggleGroup
                  options={[
                    { value: 'DCR',     label: 'DCR',     hint: 'Eligible for subsidy' },
                    { value: 'NON_DCR', label: 'Non-DCR', hint: 'Depreciation benefits' },
                  ]}
                  value={systemType}
                  onChange={v => setSystemType(v as 'DCR' | 'NON_DCR')}
                  accent="#6690cc"
                />
              </div>
              <div>
                <FieldLabel>Site Type</FieldLabel>
                <ToggleGroup
                  options={[
                    { value: 'RESIDENTIAL', label: 'Residential', hint: '' },
                    { value: 'SOCIETY',     label: 'Society',     hint: '' },
                    { value: 'COMMERCIAL',  label: 'Commercial',  hint: '' },
                    { value: 'INDUSTRIAL',  label: 'Industrial',  hint: '' },
                  ]}
                  value={siteType}
                  onChange={v => setSiteType(v as 'RESIDENTIAL' | 'SOCIETY' | 'COMMERCIAL' | 'INDUSTRIAL')}
                  accent="#6690cc"
                />
              </div>
            </div>
          </FormCard>

          {/* ── Section 3: Electricity / System Size ───────────────────── */}
          <FormCard title="3. System Sizing" icon="☀️">
            {/* Mode toggle */}
            <div className="flex gap-2 mb-4">
              {[
                { id: 'monthly', label: '📊 Enter Monthly Units' },
                { id: 'direct',  label: '⚡ Enter System Size Directly' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setSizingMode(opt.id as 'monthly' | 'direct')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                    sizingMode === opt.id
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {sizingMode === 'monthly' ? (
              <div>
                <p className="text-xs text-gray-500 mb-3">
                  Enter the units consumed each month. You can leave months blank — average is calculated from filled months only.
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {MONTHS.map(m => (
                    <div key={m.key}>
                      <label className="text-xs text-gray-500 mb-1 block">{m.label}</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="—"
                        value={monthlyUnits[m.key] ?? ''}
                        onChange={e => setMonthlyUnits(prev => ({ ...prev, [m.key]: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>
                  ))}
                </div>
                {derivedSystemKw > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                    <span>📐</span>
                    <span>Recommended system size based on usage: <strong>{derivedSystemKw} kW</strong></span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <FieldLabel required>System Size (kW)</FieldLabel>
                  <div className="flex items-center">
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      placeholder="e.g. 5"
                      value={directKw}
                      onChange={e => setDirectKw(e.target.value)}
                      className={`${inputCls} text-right tabular-nums`}
                    />
                    <span className="ml-2 text-sm font-medium text-gray-500 whitespace-nowrap">kW</span>
                  </div>
                </div>
                {derivedSystemKw > 0 && (
                  <div className="flex-1 bg-gray-50 rounded-xl px-4 py-2.5">
                    <p className="text-xs text-gray-500">Roof area required</p>
                    <p className="text-lg font-bold text-gray-800 tabular-nums">{derivedSystemKw * 80} <span className="text-sm font-normal text-gray-400">sqft</span></p>
                  </div>
                )}
              </div>
            )}

            {derivedSystemKw > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <FieldLabel>Inverter Size (kW)</FieldLabel>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  placeholder={`${derivedSystemKw} (same as system)`}
                  value={inverterSizeKw}
                  onChange={e => { setInverterSizeKw(e.target.value); setInverterManuallyEdited(true); }}
                  className="w-32 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <p className="text-xs text-gray-400 mt-1">Defaults to system size. Edit to undersize or oversize inverter.</p>
              </div>
            )}
          </FormCard>

          {/* ── Section 4: Pricing ─────────────────────────────────────── */}
          <FormCard title="4. Pricing" icon="💰">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel required>Base Price per Watt (₹/W)</FieldLabel>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">₹</span>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    placeholder="55"
                    value={pricePerWatt}
                    onChange={e => handlePricePerWattChange(e.target.value)}
                    className={`${inputCls} text-right tabular-nums`}
                  />
                  <span className="text-sm text-gray-400 whitespace-nowrap">/ watt</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Changes total base amount automatically</p>
              </div>
              <div>
                <FieldLabel>Total Base Amount (₹)</FieldLabel>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="auto-calculated"
                    value={totalBaseAmount}
                    onChange={e => handleTotalBaseAmountChange(e.target.value)}
                    className={`${inputCls} text-right tabular-nums`}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Changes price per watt automatically</p>
              </div>
            </div>
          </FormCard>

          {/* ── Section 5: Quick Parameters ────────────────────────────── */}
          <FormCard title="5. Quick Parameters" icon="🔧">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>Electricity Rate (₹ per unit)</FieldLabel>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={electricityRate}
                    onChange={e => setElectricityRate(e.target.value)}
                    className={`${inputCls} text-right tabular-nums`}
                  />
                  <span className="text-sm text-gray-400 whitespace-nowrap">₹/kWh</span>
                </div>
              </div>
              <div>
                <FieldLabel>Peak Sun Hours per Day</FieldLabel>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="12"
                    step="0.5"
                    value={peakSunHours}
                    onChange={e => setPeakSunHours(e.target.value)}
                    className={`${inputCls} text-right tabular-nums`}
                  />
                  <span className="text-sm text-gray-400 whitespace-nowrap">hrs/day</span>
                </div>
              </div>
              <div>
                <FieldLabel>Present Sanctioned Load (kW)</FieldLabel>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="e.g. 5"
                    value={sanctionedLoadKw}
                    onChange={e => setSanctionedLoadKw(e.target.value)}
                    className={`${inputCls} text-right tabular-nums`}
                  />
                  <span className="text-sm text-gray-400 whitespace-nowrap">kW</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Optional — used to assess load sufficiency</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Note: Quick Quotation uses <strong>Direct Production</strong> (system size × sun hours) without derating. For detailed efficiency analysis, use the full quotation workflow.
            </p>
          </FormCard>

          {/* ── Sanctioned Load Note (live preview) ─────────────────── */}
          {sanctionedLoadKw && parseFloat(sanctionedLoadKw) > 0 && derivedSystemKw > 0 && (
            <div
              className="rounded-2xl px-5 py-4 border"
              style={{
                background: derivedSystemKw > parseFloat(sanctionedLoadKw) ? '#fffbeb' : '#f0fdf4',
                borderColor: derivedSystemKw > parseFloat(sanctionedLoadKw) ? '#fde68a' : '#bbf7d0',
              }}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">{derivedSystemKw > parseFloat(sanctionedLoadKw) ? '⚠️' : '✅'}</span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: derivedSystemKw > parseFloat(sanctionedLoadKw) ? '#92400e' : '#166534' }}>
                    Sanctioned Load Assessment
                  </p>
                  <div className="text-xs mt-1 space-y-0.5" style={{ color: derivedSystemKw > parseFloat(sanctionedLoadKw) ? '#78350f' : '#14532d' }}>
                    <p>Present Sanctioned Load: <strong>{sanctionedLoadKw} kW</strong></p>
                    <p>Proposed Solar System: <strong>{derivedSystemKw} kW</strong></p>
                    <p className="mt-1 font-medium">
                      {derivedSystemKw > parseFloat(sanctionedLoadKw)
                        ? 'The present sanctioned load may need to be increased to support the proposed solar installation.'
                        : 'The present sanctioned load is sufficient for the proposed solar installation.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Error ──────────────────────────────────────────────────── */}
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
              <span>✗</span> {formError}
            </div>
          )}
        </div>

        {/* ── RIGHT: Live Summary ──────────────────────────────────────────── */}
        <div className="w-80 shrink-0">
          <div className="sticky top-[73px] space-y-3">

            {/* Summary card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div
                className="px-5 py-4 flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #161c34, #2c4570)' }}
              >
                <span className="text-xl">📊</span>
                <div>
                  <p className="text-sm font-semibold text-white">Live Estimate</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Updates as you type</p>
                </div>
              </div>

              {summary ? (
                <div className="p-5 space-y-4">
                  {/* System */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">System</p>
                    <div className="space-y-1.5">
                      <SummaryRow label="System Size" value={`${summary.systemSizeKw} kW`} accent />
                      <SummaryRow label="Roof Area Required" value={`${fmt(summary.roofAreaSqft)} sq.ft`} />
                      <SummaryRow label="Daily Production" value={`${summary.dailyProductionKwh} kWh`} />
                      <SummaryRow label="Annual Production" value={`${fmt(summary.annualProductionKwh)} kWh`} />
                    </div>
                  </div>

                  <div className="h-px bg-gray-100" />

                  {/* Cost */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Cost Breakdown</p>
                    <div className="space-y-1.5">
                      <SummaryRow label="Base Cost (incl. all)" value={fmtL(summary.baseCost)} />
                      <SummaryRow label="GST (8.9%)" value={`+ ${fmtL(summary.gstAmount)}`} />
                      <SummaryRow label="Total Cost" value={fmtL(summary.grossCost)} />
                      {summary.subsidyAmount > 0 && (
                        <SummaryRow label="PM Surya Ghar Subsidy" value={`− ${fmtL(summary.subsidyAmount)}`} highlight="green" />
                      )}
                    </div>
                    <div className="mt-2 px-3 py-2.5 rounded-xl" style={{ background: '#f0f4ff' }}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold" style={{ color: '#161c34' }}>Net Payable</span>
                        <span className="text-lg font-bold" style={{ color: '#6690cc', fontFamily: 'Poppins, sans-serif' }}>
                          {fmtL(summary.netCost)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-gray-100" />

                  {/* ROI */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Returns</p>
                    <div className="space-y-1.5">
                      <SummaryRow label="Annual Savings" value={`₹${fmt(summary.annualSavings)}`} />
                      <SummaryRow label="Breakeven" value={`~${summary.breakevenYears} years`} accent />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-gray-400 text-sm">Enter system size and pricing to see live estimate</p>
                </div>
              )}
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={submitting || !summary}
              className="w-full py-4 rounded-2xl text-base font-bold text-white transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: submitting || !summary
                  ? '#9ca3af'
                  : 'linear-gradient(135deg, #6690cc, #3c5e94)',
              }}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Generating Quote…
                </span>
              ) : (
                '⚡ Generate Quotation'
              )}
            </button>

            <p className="text-xs text-gray-400 text-center px-2">
              Creates customer record & generates professional PDF-ready proposal instantly
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small reusable sub-components ────────────────────────────────────────────

const inputCls =
  'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white';

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
      {children}
      {required && <span className="ml-1 text-red-400">*</span>}
    </label>
  );
}

function FormCard({
  title, icon, children,
}: { title: string; icon: string; children: React.ReactNode }) {
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

interface ToggleOption { value: string; label: string; hint?: string }
function ToggleGroup({
  options, value, onChange, accent = '#6690cc',
}: { options: ToggleOption[]; value: string; onChange: (v: string) => void; accent?: string }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          title={opt.hint}
          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
            value === opt.value ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
          }`}
          style={value === opt.value ? { background: accent, borderColor: accent } : {}}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SummaryRow({
  label, value, accent, highlight,
}: { label: string; value: string; accent?: boolean; highlight?: 'green' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span
        className="text-sm font-semibold tabular-nums"
        style={{
          color: highlight === 'green' ? '#16a34a' : accent ? '#6690cc' : '#161c34',
        }}
      >
        {value}
      </span>
    </div>
  );
}
