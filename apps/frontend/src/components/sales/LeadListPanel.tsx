'use client';

import { useState } from 'react';

export type Priority = 'HOT' | 'FOLLOW_UP' | 'NEW' | 'COLD';

export type Lead = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  siteCity: string | null;
  createdAt: string;
  createdBy: string | null;
  priority: Priority;
  quotationCount: number;
  lastQuotedAt: string | null;
  daysSinceLastQuote: number | null;
  quotations: {
    id: string;
    qtNumber: string | null;
    createdAt: string;
    status: string | null;
    systemSizeKw: number | null;
    totalPrice: number | null;
  }[];
};

type Filter = 'ALL' | Priority;

const PRIORITY_LABEL: Record<Priority, string> = {
  HOT: 'Hot',
  FOLLOW_UP: 'Follow-up',
  NEW: 'New',
  COLD: 'Cold',
};

const PRIORITY_DOT: Record<Priority, string> = {
  HOT: 'bg-red-500',
  FOLLOW_UP: 'bg-orange-400',
  NEW: 'bg-green-500',
  COLD: 'bg-gray-400',
};

const PRIORITY_BADGE: Record<Priority, string> = {
  HOT: 'bg-red-100 text-red-700',
  FOLLOW_UP: 'bg-orange-100 text-orange-700',
  NEW: 'bg-green-100 text-green-700',
  COLD: 'bg-gray-100 text-gray-600',
};

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'HOT', label: '🔥 Hot' },
  { key: 'FOLLOW_UP', label: '🔁 Follow-up' },
  { key: 'NEW', label: '✨ New' },
  { key: 'COLD', label: '❄️ Cold' },
];

function dayLabel(days: number | null) {
  if (days === null) return 'No quote yet';
  if (days === 0) return 'Quoted today';
  if (days === 1) return 'Quoted yesterday';
  return `Quoted ${days}d ago`;
}

export default function LeadListPanel({
  leads,
  selectedId,
  onSelect,
}: {
  leads: Lead[];
  selectedId: string | null;
  onSelect: (lead: Lead) => void;
}) {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');

  const filtered = leads
    .filter((l) => filter === 'ALL' || l.priority === filter)
    .filter(
      (l) =>
        !search ||
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        (l.phone ?? '').includes(search) ||
        (l.city ?? '').toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-gray-100">
        <input
          type="text"
          placeholder="Search name, phone, city…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm rounded-lg border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent placeholder:text-gray-400"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 px-3 py-2 border-b border-gray-100 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex-shrink-0 text-xs font-medium px-3 py-1 rounded-full transition-colors ${
              filter === f.key
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
            {f.key !== 'ALL' && (
              <span className="ml-1 opacity-60">
                {leads.filter((l) => l.priority === f.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="p-6 text-center text-sm text-gray-400">No leads match this filter.</div>
        )}
        {filtered.map((lead) => (
          <button
            key={lead.id}
            onClick={() => onSelect(lead)}
            className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-yellow-50 transition-colors ${
              selectedId === lead.id ? 'bg-yellow-50 border-l-2 border-l-yellow-400' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-sm text-gray-900 truncate pr-2">{lead.name}</span>
              <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_BADGE[lead.priority]}`}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${PRIORITY_DOT[lead.priority]}`} />
                {PRIORITY_LABEL[lead.priority]}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {lead.phone && <span>{lead.phone}</span>}
              {lead.city && <span>· {lead.city}</span>}
            </div>
            <div className="mt-1 text-xs text-gray-400">
              {lead.quotationCount > 0
                ? `${lead.quotationCount} quotation${lead.quotationCount > 1 ? 's' : ''} · ${dayLabel(lead.daysSinceLastQuote)}`
                : 'No quotations yet'}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
