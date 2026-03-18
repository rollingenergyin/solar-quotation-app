'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/lib/api';
import QuotationPrint from '@/components/quotation/QuotationPrint';
import type { QuotationTemplateData } from '@/types/quotation-template';

export default function QuotationPrintPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token } = useAuth();

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else if (id) {
      router.push(`/sales/quotations/${id}`);
    } else {
      router.push('/sales/quotations');
    }
  };

  const pdfToken = searchParams.get('pdf_token');
  const isPdfMode = searchParams.get('pdf') === '1';

  const [data, setData]       = useState<QuotationTemplateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const authHeaders = useMemo((): Record<string, string> => {
    if (pdfToken) return {};
    if (token) return { Authorization: `Bearer ${token}` };
    return {};
  }, [token, pdfToken]);

  const templateDataUrl = useMemo(() => {
    const url = new URL(`${API_URL}/quotations/${id}/template-data`);
    if (pdfToken) url.searchParams.set('pdf_token', pdfToken);
    return url.toString();
  }, [id, pdfToken]);

  useEffect(() => {
    if (!id) return;
    if (!pdfToken && !token) return;

    fetch(templateDataUrl, { headers: authHeaders, credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<QuotationTemplateData>;
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  }, [token, id, templateDataUrl, authHeaders]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ background: '#161c34' }}
      >
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-full border-4 border-t-transparent animate-spin mx-auto mb-4"
            style={{ borderColor: '#6690cc', borderTopColor: 'transparent' }}
          />
          <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Building your solar proposal…
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ background: '#161c34' }}
      >
        <div
          className="rounded-2xl p-8 text-center max-w-md"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(102,144,204,0.2)' }}
        >
          <span style={{ fontSize: '48px' }}>⚠️</span>
          <p className="text-white font-semibold mt-4 mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Could not load quotation
          </p>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {error || 'Make sure the quotation is calculated before generating the proposal.'}
          </p>
          <button
            onClick={handleBack}
            className="mt-6 px-6 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: '#6690cc' }}
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  return <QuotationPrint data={data} isPdfMode={isPdfMode} quotationId={id} />;
}
