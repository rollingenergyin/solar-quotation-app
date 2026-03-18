'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

interface QuotationWithData {
  id: string;
  quoteNumber: string;
  version?: number;
  quotationDataJson?: {
    formData?: Record<string, unknown>;
    inputs?: Record<string, unknown>;
  } | null;
  customer: { name: string };
  site: { address?: string };
}

const val = (v: unknown): string => (v != null && v !== '' ? String(v) : '');

export default function EditQuotationPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [quotation, setQuotation] = useState<QuotationWithData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [pricePerWatt, setPricePerWatt] = useState('38');
  const [electricityRate, setElectricityRate] = useState('8');
  const [systemSizeKw, setSystemSizeKw] = useState('');
  const [inverterSizeKw, setInverterSizeKw] = useState('');
  const [profitPct, setProfitPct] = useState('15');
  const [gstPct, setGstPct] = useState('18');
  const [systemType, setSystemType] = useState<'DCR' | 'NON_DCR'>('DCR');
  const [siteType, setSiteType] = useState<'RESIDENTIAL' | 'SOCIETY' | 'COMMERCIAL' | 'INDUSTRIAL'>('RESIDENTIAL');
  const [sanctionedLoadKw, setSanctionedLoadKw] = useState('');
  const [gridInflation, setGridInflation] = useState('3');
  const [peakSunHours, setPeakSunHours] = useState('5');
  const [efficiency, setEfficiency] = useState('0.8');
  const [lifeYears, setLifeYears] = useState('25');
  const [emiRate, setEmiRate] = useState('9');

  const load = useCallback(async () => {
    try {
      const q = await api<QuotationWithData>(`/quotations/${id}`);
      setQuotation(q);
      const fd = (q.quotationDataJson as { formData?: Record<string, unknown> } | null)?.formData ?? {};
      setPricePerWatt(val(fd.pricePerWatt ?? fd.price_per_watt) || '38');
      setElectricityRate(val(fd.electricityRatePerUnit ?? fd.electricity_rate_per_unit) || '8');
      setSystemSizeKw(val(fd.systemSizeKw ?? fd.system_size_kw));
      setInverterSizeKw(val(fd.inverterSizeKw ?? fd.inverter_size_kw));
      setProfitPct(val(fd.profitMarginPct ?? fd.profit_margin_pct) || '15');
      setGstPct(val(fd.gstPct ?? fd.gst_pct) || '18');
      setSystemType((fd.systemType ?? fd.system_type ?? 'DCR') as 'DCR' | 'NON_DCR');
      setSiteType((fd.siteType ?? fd.site_type ?? 'RESIDENTIAL') as 'RESIDENTIAL' | 'SOCIETY' | 'COMMERCIAL' | 'INDUSTRIAL');
      setSanctionedLoadKw(val(fd.sanctionedLoadKw ?? fd.sanctioned_load_kw));
      setGridInflation(val(fd.gridInflationPct ?? fd.grid_inflation_pct) || '3');
      setPeakSunHours(val(fd.peakSunHours ?? fd.peak_sun_hours) || '5');
      setEfficiency(val(fd.systemEfficiency ?? fd.system_efficiency) || '0.8');
      setLifeYears(val(fd.systemLifeYears ?? fd.system_life_years) || '25');
      setEmiRate(val(fd.emiRatePct ?? fd.emi_rate_pct) || '9');
    } catch {
      setError('Failed to load quotation');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const formData: Record<string, unknown> = {
        pricePerWatt: parseFloat(pricePerWatt),
        electricityRatePerUnit: parseFloat(electricityRate),
        profitMarginPct: parseFloat(profitPct),
        gstPct: parseFloat(gstPct),
        gridInflationPct: parseFloat(gridInflation),
        peakSunHours: parseFloat(peakSunHours),
        systemEfficiency: parseFloat(efficiency),
        systemLifeYears: parseInt(lifeYears),
        emiRatePct: parseFloat(emiRate),
        systemType,
        siteType,
      };
      if (systemSizeKw) formData.systemSizeKw = parseFloat(systemSizeKw);
      if (inverterSizeKw) formData.inverterSizeKw = parseFloat(inverterSizeKw);
      else if (systemSizeKw) formData.inverterSizeKw = parseFloat(systemSizeKw);
      if (sanctionedLoadKw) formData.sanctionedLoadKw = parseFloat(sanctionedLoadKw);

      const res = await api<{ id: string; quoteNumber: string; version: number }>(
        `/quotations/${id}/create-version`,
        { method: 'POST', body: JSON.stringify({ formData }) }
      );
      router.push(`/sales/quotations/${res.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create version');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>;
  if (!quotation) return <div className="p-8 text-center text-red-500 text-sm">{error || 'Quotation not found'}</div>;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto w-full">
      <Link href="/sales/quotations" className="text-xs text-gray-400 hover:text-gray-600">← Saved Quotations</Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-1">{quotation.quoteNumber}{quotation.version && quotation.version > 1 ? ` v${quotation.version}` : ''}</h1>
      <p className="text-sm text-gray-500 mt-0.5">{quotation.customer.name} · {quotation.site.address || '—'}</p>
      <p className="text-xs text-amber-600 mt-1">Editing will create a new version. The original version is preserved.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Price per Watt (₹)" value={pricePerWatt} onChange={setPricePerWatt} type="number" step="0.5" />
          <Field label="Electricity Tariff (₹/kWh)" value={electricityRate} onChange={setElectricityRate} type="number" step="0.5" />
          <Field label="System Size (kWp)" value={systemSizeKw} onChange={setSystemSizeKw} type="number" step="0.5" placeholder="Auto" />
          <Field label="Inverter Size (kW)" value={inverterSizeKw} onChange={setInverterSizeKw} type="number" step="0.5" placeholder="Same as system" />
        </div>

        <div className="pt-2">
          <label className="text-xs text-gray-600 font-medium block mb-1.5">System Type</label>
          <div className="flex gap-2">
            {(['DCR', 'NON_DCR'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setSystemType(t)}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  systemType === t ? 'bg-green-500 text-white border-green-500' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2">
          <label className="text-xs text-gray-600 font-medium block mb-1.5">Site Type</label>
          <div className="flex gap-2">
            {(['RESIDENTIAL', 'SOCIETY', 'COMMERCIAL', 'INDUSTRIAL'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setSiteType(t)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  siteType === t ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Profit Margin (%)" value={profitPct} onChange={setProfitPct} type="number" />
          <Field label="GST (%)" value={gstPct} onChange={setGstPct} type="number" />
          <Field label="Sanctioned Load (kW)" value={sanctionedLoadKw} onChange={setSanctionedLoadKw} type="number" placeholder="Optional" />
          <Field label="Grid Inflation (%/yr)" value={gridInflation} onChange={setGridInflation} type="number" />
          <Field label="Peak Sun Hours" value={peakSunHours} onChange={setPeakSunHours} type="number" />
          <Field label="System Efficiency" value={efficiency} onChange={setEfficiency} type="number" step="0.05" />
          <Field label="System Life (years)" value={lifeYears} onChange={setLifeYears} type="number" />
          <Field label="EMI Rate (%)" value={emiRate} onChange={setEmiRate} type="number" />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3 pt-4">
          <button type="submit" disabled={submitting}
            className="px-6 py-2.5 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors">
            {submitting ? 'Creating version…' : 'Create new version'}
          </button>
          <Link href="/sales/quotations" className="px-6 py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium rounded-lg text-sm transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', step, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; step?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs text-gray-600 font-medium block mb-0.5">{label}</label>
      <input type={type} step={step} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400" />
    </div>
  );
}
