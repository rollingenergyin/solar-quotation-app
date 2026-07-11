'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import SiteCostingPricingEditor from '@/components/site-costing/SiteCostingPricingEditor';
import {
  formStateToApiInputs,
  loadSiteCostingState,
  saveSiteCostingState,
  type SiteCostingFormState,
  type SiteCostingResult,
} from '@/constants/site-costing';

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

export default function SiteCostingEditPricingPage() {
  const router = useRouter();
  const [form, setForm] = useState<SiteCostingFormState>(() => loadSiteCostingState());
  const [result, setResult] = useState<SiteCostingResult | null>(null);
  const [draftAmounts, setDraftAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchResult = useCallback(async (state: SiteCostingFormState) => {
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
      const amounts: Record<string, string> = {};
      data.lineItems.forEach((item) => {
        amounts[item.key] = String(item.amount);
      });
      setDraftAmounts(amounts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResult(form);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAmountChange = (key: string, value: string) => {
    setDraftAmounts((prev) => ({ ...prev, [key]: value }));
  };

  const applyLive = async () => {
    const overrides: Record<string, number> = {};
    Object.entries(draftAmounts).forEach(([key, val]) => {
      const n = parseFloat(val);
      if (Number.isFinite(n) && n >= 0) overrides[key] = Math.round(n);
    });
    const nextForm = { ...form, lineItemOverrides: overrides };
    setForm(nextForm);
    saveSiteCostingState(nextForm);
    await fetchResult(nextForm);
  };

  const handleSaveAndReturn = async () => {
    await applyLive();
    router.push('/sales/site-costing');
  };

  const subtotal = result?.lineItems.reduce((s, i) => {
    const draft = draftAmounts[i.key];
    const n = draft != null ? parseFloat(draft) : i.amount;
    return s + (Number.isFinite(n) ? n : 0);
  }, 0) ?? 0;

  const gst = Math.round(subtotal * ((result?.gstPct ?? 8.9) / 100));

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/sales/site-costing" className="text-gray-400 hover:text-gray-600 text-xl leading-none">←</Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Edit Pricing
            </h1>
            <p className="text-xs text-gray-400">Adjust individual costing components</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={applyLive}
            className="text-sm font-semibold px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            Recalculate
          </button>
          <button
            type="button"
            onClick={handleSaveAndReturn}
            className="text-sm font-semibold px-4 py-2 rounded-lg text-white"
            style={{ background: '#6690cc' }}
          >
            Save & Return
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6">
        {loading && !result ? (
          <p className="text-sm text-gray-400">Loading pricing…</p>
        ) : (
          <>
            <div className="mb-4">
              <SiteCostingPricingEditor
                lineItems={result?.lineItems ?? []}
                draftAmounts={draftAmounts}
                systemSizeKw={result?.systemSizeKw ?? 0}
                onAmountChange={handleAmountChange}
              />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal (ex GST)</span>
                <span className="font-semibold">{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">GST ({result?.gstPct ?? 8.9}%)</span>
                <span className="font-semibold">{fmt(gst)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-100 text-base">
                <span className="font-semibold text-gray-800">Total incl. GST</span>
                <span className="font-bold" style={{ color: '#161c34' }}>{fmt(subtotal + gst)}</span>
              </div>
              {result && result.systemSizeKw > 0 && (
                <p className="text-xs text-gray-400 pt-1">
                  Effective ₹/W (ex GST): ₹{(subtotal / (result.systemSizeKw * 1000)).toFixed(2)}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
