'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { SalesPanelLead } from './salesPanel.types';

const STAGE_ORDER = [
  'NEW', 'CONTACTED', 'QUALIFIED',
  'SITE_VISIT_SCHEDULED', 'SITE_VISIT_DONE',
  'PROPOSAL_SENT', 'NEGOTIATION',
];
const STAGE_LABEL: Record<string, string> = {
  NEW: 'New', CONTACTED: 'Contacted', QUALIFIED: 'Qualified',
  SITE_VISIT_SCHEDULED: 'Visit Sched', SITE_VISIT_DONE: 'Visit Done',
  PROPOSAL_SENT: 'Proposal', NEGOTIATION: 'Negotiating',
  CLOSED_WON: 'Won ✅', CLOSED_LOST: 'Lost ❌',
};
const LANG_LABEL: Record<string, string> = { EN: '🇬🇧 EN', HI: '🇮🇳 HI', MR: '🟠 MR' };

const TIMELINE_STYLE: Record<string, { dot: string; bg: string; icon: string }> = {
  LEAD_CREATED:  { dot: 'bg-green-500',  bg: 'bg-green-50',  icon: '✨' },
  STAGE_CHANGED: { dot: 'bg-blue-500',   bg: 'bg-blue-50',   icon: '🔄' },
  MESSAGE_SENT:  { dot: 'bg-yellow-500', bg: 'bg-yellow-50', icon: '📤' },
  MESSAGE_IN:    { dot: 'bg-green-500',  bg: 'bg-green-50',  icon: '💬' },
  MESSAGE_OUT:   { dot: 'bg-yellow-500', bg: 'bg-yellow-50', icon: '📤' },
  NOTE_ADDED:    { dot: 'bg-gray-400',   bg: 'bg-gray-50',   icon: '📝' },
  CALL_LOGGED:   { dot: 'bg-purple-500', bg: 'bg-purple-50', icon: '📞' },
  SCORE_UPDATED: { dot: 'bg-indigo-500', bg: 'bg-indigo-50', icon: '⭐' },
  LEAD_ASSIGNED: { dot: 'bg-teal-500',   bg: 'bg-teal-50',   icon: '👤' },
  DEFAULT:       { dot: 'bg-gray-400',   bg: 'bg-gray-50',   icon: '○' },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = diff / 3_600_000;
  if (h < 1) return `${Math.round(h * 60)}m ago`;
  if (h < 24) return `${Math.round(h)}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export default function SalesPanelLeadDetail({
  lead,
  onClose,
  onRefresh,
}: {
  lead: SalesPanelLead;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const currentStageIndex = STAGE_ORDER.indexOf(lead.stage);
  const isClosed = lead.stage === 'CLOSED_WON' || lead.stage === 'CLOSED_LOST';

  async function saveNote() {
    if (!note.trim()) return;
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await api<any>(`/crm/leads/${lead.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ notes: note }),
      });
      setSavedMsg('✓ Saved');
      setNote('');
      setTimeout(() => setSavedMsg(''), 2000);
      onRefresh();
    } catch {
      setSavedMsg('Failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-4 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-gray-900 truncate">{lead.name}</h2>
            <div className="flex flex-wrap gap-3 mt-1 text-sm">
              {lead.phone && (
                <a href={`tel:${lead.phone}`} className="text-blue-600 hover:text-blue-800 font-medium">
                  📞 {lead.phone}
                </a>
              )}
              {lead.city && <span className="text-gray-500">📍 {lead.city}</span>}
              <span className="text-gray-400 text-xs px-2 py-0.5 bg-gray-100 rounded-full">
                {LANG_LABEL[lead.language] ?? lead.language}
              </span>
              {lead.systemKw && (
                <span className="text-gray-500">⚡ {lead.systemKw} kW</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-3 text-gray-400 hover:text-gray-600 text-xl flex-shrink-0 leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Score + Conversion probability */}
        <div className="flex gap-4 mt-3">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">Lead Score</span>
              <span className="text-xs font-semibold text-gray-700">{lead.score}/100</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-400 rounded-full"
                style={{ width: `${lead.score}%` }}
              />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">Close Probability</span>
              <span className="text-xs font-semibold text-green-700">{lead.conversionProbability}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  lead.conversionProbability >= 60 ? 'bg-green-500' :
                  lead.conversionProbability >= 30 ? 'bg-yellow-400' : 'bg-red-400'
                }`}
                style={{ width: `${lead.conversionProbability}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stage pipeline */}
      {!isClosed && (
        <div className="flex-shrink-0 px-5 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-0 overflow-x-auto pb-1">
            {STAGE_ORDER.map((s, i) => {
              const isPast    = i < currentStageIndex;
              const isCurrent = i === currentStageIndex;
              const isFuture  = i > currentStageIndex;
              return (
                <div key={s} className="flex items-center flex-shrink-0">
                  <div className={`flex flex-col items-center`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                      isCurrent ? 'bg-gray-900 border-gray-900 text-white' :
                      isPast    ? 'bg-green-500 border-green-500 text-white' :
                      'bg-white border-gray-300 text-gray-400'
                    }`}>
                      {isPast ? '✓' : i + 1}
                    </div>
                    <span className={`text-xs mt-0.5 whitespace-nowrap ${
                      isCurrent ? 'text-gray-900 font-semibold' :
                      isPast    ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      {STAGE_LABEL[s] ?? s}
                    </span>
                  </div>
                  {i < STAGE_ORDER.length - 1 && (
                    <div className={`w-6 h-0.5 mx-0.5 mt-[-14px] ${i < currentStageIndex ? 'bg-green-400' : 'bg-gray-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Body: Timeline + Notes */}
      <div className="flex-1 overflow-y-auto">
        {/* Timeline */}
        <div className="px-5 pt-4 pb-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Activity Timeline</h3>

          {lead.timeline.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No activity recorded yet.</p>
          ) : (
            <div className="relative space-y-3">
              {/* Vertical line */}
              <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gray-100" />

              {lead.timeline.map((item) => {
                const style = TIMELINE_STYLE[item.eventType] ?? TIMELINE_STYLE.DEFAULT;
                return (
                  <div key={item.id} className="flex gap-3 relative">
                    <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs z-10 ${style.bg}`}>
                      <span>{style.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-gray-800">
                            {item.description}
                            {item.detail && (
                              <span className="ml-1 text-xs text-gray-500 font-medium">{item.detail}</span>
                            )}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">{relativeTime(item.at)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 mt-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Add Note</h3>
          {lead.notes && (
            <div className="mb-2 text-sm text-gray-700 bg-gray-50 rounded-xl p-3 border border-gray-100">
              {lead.notes}
            </div>
          )}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Type a follow-up note…"
            rows={3}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none outline-none focus:ring-2 focus:ring-yellow-400 placeholder:text-gray-400"
          />
          <div className="flex items-center gap-2 mt-1.5">
            <button
              onClick={saveNote}
              disabled={saving || !note.trim()}
              className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-gray-900 text-white disabled:opacity-40 hover:bg-gray-700"
            >
              {saving ? 'Saving…' : 'Save Note'}
            </button>
            {savedMsg && <span className="text-xs text-green-600">{savedMsg}</span>}
          </div>
        </div>

        {/* Meta */}
        <div className="px-5 pb-4 text-xs text-gray-400 space-y-0.5">
          <div>Source: {lead.source}</div>
          {lead.assignedTo && <div>Assigned to: {lead.assignedTo.name}</div>}
          <div>Added: {new Date(lead.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
        </div>
      </div>
    </div>
  );
}
