'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { SalesPanelLead, Urgency } from './salesPanel.types';

const URGENCY_STYLE: Record<Urgency, { bg: string; text: string; border: string; pulse: boolean }> = {
  CRITICAL: { bg: 'bg-red-600',    text: 'text-white', border: 'border-red-600',    pulse: true  },
  HIGH:     { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-500', pulse: false },
  MEDIUM:   { bg: 'bg-blue-600',   text: 'text-white', border: 'border-blue-600',   pulse: false },
  LOW:      { bg: 'bg-gray-500',   text: 'text-white', border: 'border-gray-500',   pulse: false },
};

const URGENCY_LABEL: Record<Urgency, string> = {
  CRITICAL: '🔴 CRITICAL', HIGH: '🟠 HIGH', MEDIUM: '🔵 MEDIUM', LOW: '⚪ LOW',
};

const ACTION_ICON: Record<string, string> = {
  CALL: '📞', WHATSAPP: '💬', EMAIL: '✉️', STAGE_UPDATE: '🔄',
};

const NEXT_STAGES: Record<string, string[]> = {
  NEW:                    ['CONTACTED'],
  CONTACTED:              ['QUALIFIED', 'DISQUALIFIED'],
  QUALIFIED:              ['SITE_VISIT_SCHEDULED', 'DISQUALIFIED'],
  SITE_VISIT_SCHEDULED:   ['SITE_VISIT_DONE', 'QUALIFIED'],
  SITE_VISIT_DONE:        ['PROPOSAL_SENT'],
  PROPOSAL_SENT:          ['NEGOTIATION', 'CLOSED_LOST'],
  NEGOTIATION:            ['CLOSED_WON', 'CLOSED_LOST'],
};

const STAGE_DISPLAY: Record<string, string> = {
  NEW: 'New', CONTACTED: 'Contacted', QUALIFIED: 'Qualified',
  SITE_VISIT_SCHEDULED: 'Visit Scheduled', SITE_VISIT_DONE: 'Visit Done',
  PROPOSAL_SENT: 'Proposal Sent', NEGOTIATION: 'Negotiating',
  CLOSED_WON: '✅ Won', CLOSED_LOST: '❌ Lost', DISQUALIFIED: 'Disqualified',
};

const STAGE_BTN: Record<string, string> = {
  CONTACTED:           'bg-blue-100 text-blue-800 hover:bg-blue-200',
  QUALIFIED:           'bg-indigo-100 text-indigo-800 hover:bg-indigo-200',
  SITE_VISIT_SCHEDULED:'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
  SITE_VISIT_DONE:     'bg-orange-100 text-orange-800 hover:bg-orange-200',
  PROPOSAL_SENT:       'bg-purple-100 text-purple-800 hover:bg-purple-200',
  NEGOTIATION:         'bg-pink-100 text-pink-800 hover:bg-pink-200',
  CLOSED_WON:          'bg-green-600 text-white hover:bg-green-700',
  CLOSED_LOST:         'bg-red-100 text-red-700 hover:bg-red-200',
  DISQUALIFIED:        'bg-gray-200 text-gray-600 hover:bg-gray-300',
};

type Lang = 'en' | 'hi' | 'mr';

export default function SalesPanelActionPanel({
  lead,
  onStageUpdated,
}: {
  lead: SalesPanelLead;
  onStageUpdated: () => void;
}) {
  const qc = useQueryClient();
  const [lang, setLang] = useState<Lang>(() => {
    if (lead.language === 'HI') return 'hi';
    if (lead.language === 'MR') return 'mr';
    return 'en';
  });
  const [copied, setCopied] = useState(false);
  const [stageSuccess, setStageSuccess] = useState('');

  const na = lead.nextAction;
  const urgencyStyle = URGENCY_STYLE[na.urgency];
  const nextStages = NEXT_STAGES[lead.stage] ?? [];

  const stageMutation = useMutation({
    mutationFn: (toStage: string) =>
      api(`/crm/leads/${lead.id}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ toStage }),
      }),
    onSuccess: (_, toStage) => {
      setStageSuccess(`✓ Moved to ${STAGE_DISPLAY[toStage] ?? toStage}`);
      setTimeout(() => setStageSuccess(''), 3000);
      qc.invalidateQueries({ queryKey: ['dashboard', 'sales-panel'] });
      onStageUpdated();
    },
  });

  const suggestedMsg = na.suggestedMessage?.[lang] ?? '';

  function copyMessage() {
    navigator.clipboard.writeText(suggestedMsg).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function whatsappLink(msg: string) {
    const phone = (lead.phone ?? '').replace(/\D/g, '');
    const fullPhone = phone.startsWith('91') ? phone : `91${phone}`;
    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
  }

  return (
    <div className="flex flex-col h-full bg-white overflow-y-auto">
      <div className="px-4 py-4 space-y-4">

        {/* ── PRIMARY: NEXT ACTION ──────────────────────────────── */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">⚡ Next Action</span>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${urgencyStyle.bg} ${urgencyStyle.text}`}>
              {URGENCY_LABEL[na.urgency]}
            </span>
          </div>

          <div className={`rounded-2xl border-2 ${urgencyStyle.border} overflow-hidden`}>
            <div className={`${urgencyStyle.bg} px-4 py-3`}>
              <div className={`text-xs font-semibold opacity-80 ${urgencyStyle.text} mb-1`}>
                {ACTION_ICON[na.type]} {na.type}
              </div>
              <p className={`text-sm font-medium leading-snug ${urgencyStyle.text}`}>{na.reason}</p>
            </div>

            {/* Big CTA */}
            {na.type === 'CALL' && lead.phone && (
              <a
                href={`tel:${lead.phone}`}
                className={`block w-full text-center py-3 text-base font-bold ${urgencyStyle.bg} ${urgencyStyle.text} hover:opacity-90 transition-opacity ${urgencyStyle.pulse ? 'animate-pulse' : ''}`}
              >
                {ACTION_ICON.CALL} {na.cta}
              </a>
            )}
            {na.type === 'WHATSAPP' && lead.phone && suggestedMsg && (
              <a
                href={whatsappLink(suggestedMsg)}
                target="_blank"
                rel="noopener noreferrer"
                className={`block w-full text-center py-3 text-base font-bold ${urgencyStyle.bg} ${urgencyStyle.text} hover:opacity-90 transition-opacity`}
              >
                💬 {na.cta}
              </a>
            )}
          </div>
        </div>

        {/* ── QUICK ACTIONS ─────────────────────────────────────── */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Quick Actions</h3>
          <div className="grid grid-cols-3 gap-2">
            {lead.phone && (
              <a
                href={`tel:${lead.phone}`}
                className="flex flex-col items-center gap-1 py-2.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span className="text-xl">📞</span>
                Call
              </a>
            )}
            {lead.phone && (
              <a
                href={`https://wa.me/91${(lead.phone).replace(/\D/g,'')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 py-2.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span className="text-xl">💬</span>
                WhatsApp
              </a>
            )}
            {lead.email && (
              <a
                href={`mailto:${lead.email}`}
                className="flex flex-col items-center gap-1 py-2.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span className="text-xl">✉️</span>
                Email
              </a>
            )}
          </div>
        </div>

        {/* ── SUGGESTED MESSAGE ─────────────────────────────────── */}
        {na.suggestedMessage && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">💬 Suggested Message</h3>
              {/* Language toggle */}
              <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
                {(['en', 'hi', 'mr'] as Lang[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`text-xs font-semibold px-2 py-0.5 rounded-md transition-colors ${
                      lang === l ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                    }`}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-800 leading-relaxed min-h-[72px]">
              {suggestedMsg}
            </div>

            <div className="flex gap-2 mt-2">
              <button
                onClick={copyMessage}
                className="flex-1 text-xs font-semibold py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {copied ? '✓ Copied!' : '📋 Copy'}
              </button>
              {lead.phone && (
                <a
                  href={whatsappLink(suggestedMsg)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-xs font-semibold py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 transition-colors text-center"
                >
                  💬 Open WhatsApp
                </a>
              )}
            </div>
          </div>
        )}

        {/* ── STAGE TRANSITION ──────────────────────────────────── */}
        {nextStages.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              🔄 Update Stage
            </h3>
            <div className="bg-gray-50 rounded-xl p-3 mb-3">
              <div className="text-xs text-gray-500 mb-0.5">Current</div>
              <div className="text-sm font-semibold text-gray-800">{STAGE_DISPLAY[lead.stage] ?? lead.stage}</div>
            </div>
            <div className="space-y-1.5">
              {nextStages.map((s) => (
                <button
                  key={s}
                  onClick={() => stageMutation.mutate(s)}
                  disabled={stageMutation.isPending}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${STAGE_BTN[s] ?? 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  → {STAGE_DISPLAY[s] ?? s}
                </button>
              ))}
            </div>
            {stageSuccess && (
              <p className="text-xs text-green-600 mt-2 font-medium">{stageSuccess}</p>
            )}
            {stageMutation.isError && (
              <p className="text-xs text-red-500 mt-2">{(stageMutation.error as Error)?.message}</p>
            )}
          </div>
        )}

        {/* ── RISK FLAGS ────────────────────────────────────────── */}
        {lead.riskFlags.length > 0 && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3">
            <h3 className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1.5">⚠️ Risk Signals</h3>
            <div className="flex flex-wrap gap-1.5">
              {lead.riskFlags.map((f) => (
                <span key={f} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  {f.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
