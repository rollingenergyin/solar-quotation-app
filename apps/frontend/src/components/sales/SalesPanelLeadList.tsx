'use client';

import { useState } from 'react';
import type { SalesPanelLead, Bucket } from './salesPanel.types';

const BUCKET_BORDER: Record<Bucket, string> = {
  URGENT: 'border-l-red-500',
  HOT:    'border-l-orange-400',
  WARM:   'border-l-yellow-400',
  COLD:   'border-l-gray-300',
};

const BUCKET_BADGE: Record<Bucket, string> = {
  URGENT: 'bg-red-100 text-red-700',
  HOT:    'bg-orange-100 text-orange-700',
  WARM:   'bg-yellow-100 text-yellow-800',
  COLD:   'bg-gray-100 text-gray-500',
};

const BUCKET_DOT: Record<Bucket, string> = {
  URGENT: 'bg-red-500',
  HOT:    'bg-orange-400',
  WARM:   'bg-yellow-400',
  COLD:   'bg-gray-400',
};

const SIGNAL_ICON: Record<string, { icon: string; color: string; label: string }> = {
  REPLIED:     { icon: '💬', color: 'text-green-600',  label: 'Replied'     },
  OPENED:      { icon: '👁', color: 'text-blue-500',   label: 'Opened'      },
  MISSED_CALL: { icon: '📵', color: 'text-yellow-600', label: 'Missed call' },
  IGNORED:     { icon: '⚠️', color: 'text-red-500',   label: 'No response' },
  NONE:        { icon: '⬜', color: 'text-gray-400',   label: 'No activity' },
};

const STAGE_SHORT: Record<string, string> = {
  NEW: 'New', CONTACTED: 'Contacted', QUALIFIED: 'Qualified',
  SITE_VISIT_SCHEDULED: 'Visit Sched', SITE_VISIT_DONE: 'Visit Done',
  PROPOSAL_SENT: 'Proposal', NEGOTIATION: 'Negotiating',
  CLOSED_WON: 'Won', CLOSED_LOST: 'Lost', DISQUALIFIED: 'Disq',
};

const RISK_LABEL: Record<string, string> = {
  COLD_LEAD:   '❄️ Cold',
  IGNORED:     '👻 Ignored',
  AT_RISK:     '🚨 At Risk',
  STALLED:     '⏸ Stalled',
  HIGH_VALUE:  '💎 High Value',
};

function timeAgo(isoAt: string, hoursInactive: number): string {
  if (hoursInactive < 1) return 'Just now';
  if (hoursInactive < 24) return `${Math.round(hoursInactive)}h ago`;
  const days = Math.floor(hoursInactive / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

type Filter = 'ALL' | Bucket;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL',    label: 'All'     },
  { key: 'URGENT', label: '🔴 Urgent' },
  { key: 'HOT',    label: '🔥 Hot'   },
  { key: 'WARM',   label: '🟡 Warm'  },
  { key: 'COLD',   label: '❄️ Cold'  },
];

export default function SalesPanelLeadList({
  leads,
  selectedId,
  onSelect,
}: {
  leads: SalesPanelLead[];
  selectedId: string | null;
  onSelect: (lead: SalesPanelLead) => void;
}) {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');

  const filtered = leads
    .filter((l) => filter === 'ALL' || l.bucket === filter)
    .filter((l) =>
      !search ||
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      (l.phone ?? '').includes(search) ||
      (l.city ?? '').toLowerCase().includes(search.toLowerCase())
    );

  const countFor = (b: Bucket) => leads.filter((l) => l.bucket === b).length;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
          <input
            type="text"
            placeholder="Search name, phone, city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-7 pr-3 py-2 text-sm rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-yellow-400 placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-3 pb-2 overflow-x-auto">
        {FILTERS.map((f) => {
          const count = f.key === 'ALL' ? leads.length : countFor(f.key as Bucket);
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-shrink-0 flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                filter === f.key
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
              <span className={`text-xs opacity-70 ${filter === f.key ? '' : 'font-normal'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
        {filtered.length === 0 && (
          <div className="p-6 text-center text-sm text-gray-400">
            {search ? 'No leads match your search.' : 'No leads in this category.'}
          </div>
        )}

        {filtered.map((lead) => {
          const isSelected = selectedId === lead.id;
          const signal = SIGNAL_ICON[lead.engagementSignal] ?? SIGNAL_ICON.NONE;
          const hasRisk = lead.riskFlags.length > 0;

          return (
            <button
              key={lead.id}
              onClick={() => onSelect(lead)}
              className={`w-full text-left px-4 py-3 border-l-[3px] transition-all hover:bg-gray-50 ${
                BUCKET_BORDER[lead.bucket]
              } ${isSelected ? 'bg-yellow-50' : 'bg-white'}`}
            >
              {/* Row 1: Name + bucket badge */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${BUCKET_DOT[lead.bucket]}`} />
                  <span className="font-semibold text-sm text-gray-900 truncate">{lead.name}</span>
                </div>
                <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ml-1 ${BUCKET_BADGE[lead.bucket]}`}>
                  {lead.bucket}
                </span>
              </div>

              {/* Row 2: Stage + city + activity */}
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span className="flex items-center gap-1.5">
                  <span className="font-medium text-gray-700">{STAGE_SHORT[lead.stage] ?? lead.stage}</span>
                  {lead.city && <span className="text-gray-400">· {lead.city}</span>}
                </span>
                <span className="flex items-center gap-1">
                  <span className={signal.color}>{signal.icon}</span>
                  <span className="text-gray-400">{timeAgo(lead.createdAt, lead.hoursInactive)}</span>
                </span>
              </div>

              {/* Row 3: Score bar + risk flags */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      lead.priorityScore >= 70 ? 'bg-red-400' :
                      lead.priorityScore >= 50 ? 'bg-orange-400' :
                      lead.priorityScore >= 30 ? 'bg-yellow-400' : 'bg-gray-300'
                    }`}
                    style={{ width: `${lead.priorityScore}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">{lead.priorityScore}</span>
                {hasRisk && (
                  <span className="text-xs text-red-500 flex-shrink-0">
                    {RISK_LABEL[lead.riskFlags[0]] ?? '⚠️'}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
