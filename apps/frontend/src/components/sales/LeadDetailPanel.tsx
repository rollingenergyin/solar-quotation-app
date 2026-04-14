'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Lead } from './LeadListPanel';
import { api } from '@/lib/api';

const STATUS_COLOR: Record<string, string> = {
  WON: 'bg-green-100 text-green-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  LOST: 'bg-red-100 text-red-700',
  REJECTED: 'bg-red-100 text-red-700',
  DRAFT: 'bg-gray-100 text-gray-600',
  SENT: 'bg-blue-100 text-blue-700',
};

function fmt(n: number | null) {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export default function LeadDetailPanel({
  lead,
  onClose,
  onRefresh,
}: {
  lead: Lead;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  async function saveNotes() {
    if (!notes.trim()) return;
    setSaving(true);
    try {
      await api(`/customers/${lead.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ notes }),
      });
      setSavedMsg('Saved');
      setTimeout(() => setSavedMsg(''), 2000);
    } catch {
      setSavedMsg('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function updateQuotationStatus(quotationId: string, status: 'WON' | 'LOST') {
    try {
      await api(`/quotations/${quotationId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      onRefresh();
    } catch {
      alert('Failed to update status');
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-gray-100 bg-white">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-gray-900 truncate">{lead.name}</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-sm text-gray-500">
            {lead.phone && (
              <a href={`tel:${lead.phone}`} className="hover:text-yellow-600 font-medium">
                📞 {lead.phone}
              </a>
            )}
            {lead.email && <span>✉ {lead.email}</span>}
            {lead.siteCity && <span>📍 {lead.siteCity}</span>}
          </div>
        </div>
        <button
          onClick={onClose}
          className="ml-3 text-gray-400 hover:text-gray-600 text-xl leading-none flex-shrink-0"
        >
          ×
        </button>
      </div>

      {/* Action Panel */}
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex gap-2 flex-wrap">
        <Link
          href={`/sales/quick-quotation?customerId=${lead.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors"
        >
          ⚡ New Quotation
        </Link>
        <Link
          href={`/sales/customers/${lead.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 transition-colors"
        >
          👤 View Profile
        </Link>
        {lead.phone && (
          <a
            href={`tel:${lead.phone}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            📞 Call
          </a>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Quotation Timeline */}
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Quotation History
          </h3>
          {lead.quotations.length === 0 ? (
            <p className="text-sm text-gray-400">No quotations yet.</p>
          ) : (
            <ul className="space-y-2">
              {lead.quotations.map((q) => (
                <li key={q.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-white">
                  <div>
                    <span className="text-sm font-semibold text-gray-800">
                      {q.qtNumber ?? 'Draft'}
                    </span>
                    {q.systemSizeKw && (
                      <span className="ml-2 text-xs text-gray-500">{q.systemSizeKw} kW</span>
                    )}
                    <div className="text-xs text-gray-400 mt-0.5">
                      {new Date(q.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">{fmt(q.totalPrice)}</span>
                    {q.status && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[q.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {q.status}
                      </span>
                    )}
                    {q.status && !['WON', 'ACCEPTED', 'LOST', 'REJECTED'].includes(q.status) && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => updateQuotationStatus(q.id, 'WON')}
                          className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200"
                        >
                          Won
                        </button>
                        <button
                          onClick={() => updateQuotationStatus(q.id, 'LOST')}
                          className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200"
                        >
                          Lost
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Notes */}
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Quick Note
          </h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add a follow-up note…"
            rows={3}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent placeholder:text-gray-400"
          />
          <div className="flex items-center gap-2 mt-1.5">
            <button
              onClick={saveNotes}
              disabled={saving || !notes.trim()}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-900 text-white disabled:opacity-40 hover:bg-gray-700 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Note'}
            </button>
            {savedMsg && <span className="text-xs text-green-600">{savedMsg}</span>}
          </div>
        </section>

        {/* Meta */}
        <section className="text-xs text-gray-400 space-y-1 border-t border-gray-100 pt-4">
          <div>Added by {lead.createdBy ?? 'unknown'}</div>
          <div>
            Customer since{' '}
            {new Date(lead.createdAt).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
