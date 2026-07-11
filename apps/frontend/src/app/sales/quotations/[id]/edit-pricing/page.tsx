'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SiteCostingPricingEditor from '@/components/site-costing/SiteCostingPricingEditor';
import { api } from '@/lib/api';
import type { SiteCostingResult } from '@/constants/site-costing';

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

export default function QuotationEditPricingPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [quoteNumber, setQuoteNumber] = useState('');
  const [result, setResult] = useState<SiteCostingResult | null>(null);
  const [draftAmounts, setDraftAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const q = await api<{ quoteNumber: string; quotationDataJson?: { siteCosting?: SiteCostingResult } }>(
        `/quotations/${id}`,
      );
      setQuoteNumber(q.quoteNumber);
      const sc = q.quotationDataJson?.siteCosting;
      if (!sc?.lineItems?.length) {
        setError('No site costing data on this quotation. Use Site Costing Engine first.');
        setResult(null);
        return;
      }
      setResult(sc);
      const amounts: Record<string, string> = {};
      sc.lineItems.forEach((item) => { amounts[item.key] = String(item.amount); });
      setDraftAmounts(amounts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load quotation');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    setError('');
    try {
      const overrides: Record<string, number> = {};
      Object.entries(draftAmounts).forEach(([key, val]) => {
        const n = parseFloat(val);
        if (Number.isFinite(n) && n >= 0) overrides[key] = Math.round(n);
      });
      const lineItems = result.lineItems.map((item) => ({
        ...item,
        amount: overrides[item.key] ?? item.amount,
      }));
      const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);
      const marginAmount = Math.round(subtotal * ((result.profitMarginPct ?? 0) / 100));
      const subtotalWithMargin = subtotal + marginAmount;
      const gstAmount = Math.round(subtotalWithMargin * ((result.gstPct ?? 8.9) / 100));
      const totalInclGst = subtotalWithMargin + gstAmount;
      const systemKw = result.systemSizeKw;
      const updated: SiteCostingResult = {
        ...result,
        lineItems,
        subtotal,
        marginAmount,
        subtotalWithMargin,
        gstAmount,
        totalInclGst,
        pricePerWatt: systemKw > 0 ? Math.round((subtotalWithMargin / (systemKw * 1000)) * 100) / 100 : 0,
      };
      await api(`/quotations/${id}/site-costing`, {
        method: 'PUT',
        body: JSON.stringify({ siteCosting: updated }),
      });
      router.push(`/quotation/${id}/print`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const subtotal = result?.lineItems.reduce((s, i) => {
    const n = parseFloat(draftAmounts[i.key] ?? String(i.amount));
    return s + (Number.isFinite(n) ? n : 0);
  }, 0) ?? 0;

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href={`/sales/quotations`} className="text-gray-400 hover:text-gray-600">←</Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Edit Pricing — {quoteNumber}</h1>
            <p className="text-xs text-gray-400">Updates quotation, ROI, and PDF instantly</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !result}
          className="text-sm font-semibold px-4 py-2 rounded-lg text-white disabled:opacity-50"
          style={{ background: '#6690cc' }}
        >
          {saving ? 'Saving…' : 'Save & View PDF'}
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {loading && <p className="text-sm text-gray-400">Loading…</p>}
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        {result && (
          <>
            <SiteCostingPricingEditor
              lineItems={result.lineItems}
              draftAmounts={draftAmounts}
              systemSizeKw={result.systemSizeKw}
              onAmountChange={(key, value) => setDraftAmounts((d) => ({ ...d, [key]: value }))}
            />
            <div className="mt-4 bg-white rounded-2xl border p-5 text-sm space-y-1">
              <div className="flex justify-between"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
              <div className="flex justify-between font-bold pt-2 border-t">
                <span>Est. total incl. GST</span>
                <span>{fmt(subtotal + Math.round(subtotal * 0.089))}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
