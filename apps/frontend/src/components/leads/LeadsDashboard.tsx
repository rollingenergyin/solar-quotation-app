'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export const LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'SITE_VISIT',
  'QUOTATION',
  'NEGOTIATION',
  'WON',
  'LOST',
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type WebsiteLead = {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  companyName: string;
  phone: string;
  email: string;
  industry?: string | null;
  location?: string | null;
  message?: string | null;
  requirementType: string;
  solarCapacity?: number | null;
  bessCapacity?: number | null;
  monthlyElectricityBill?: number | null;
  monthlyUnits?: number | null;
  connectedLoad?: number | null;
  maximumDemand?: number | null;
  contractDemand?: number | null;
  backupRequirement?: string | null;
  operatingHours?: number | null;
  solarCalculatorResults?: Record<string, unknown> | null;
  bessCalculatorResults?: Record<string, unknown> | null;
  sourcePage?: string | null;
  sourceType?: string | null;
  status: LeadStatus;
  assignedToId?: string | null;
  notes?: string | null;
  quotationId?: string | null;
  lastContactedAt?: string | null;
  nextFollowUp?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  landingPage?: string | null;
  referrer?: string | null;
  assignedTo?: { id: string; name: string; email: string; role: string } | null;
  quotation?: { id: string; quoteNumber: string; status: string } | null;
};

type LeadStats = {
  total: number;
  new: number;
  today: number;
  thisWeek: number;
  siteVisit: number;
  quotation: number;
  won: number;
  lost: number;
  conversionRate: number;
};

type Assignee = { id: string; name: string; email: string; role: string };

const STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  SITE_VISIT: 'Site visit',
  QUOTATION: 'Quotation',
  NEGOTIATION: 'Negotiation',
  WON: 'Won',
  LOST: 'Lost',
};

const STATUS_CLASS: Record<LeadStatus, string> = {
  NEW: 'bg-sky-50 text-sky-800',
  CONTACTED: 'bg-indigo-50 text-indigo-800',
  QUALIFIED: 'bg-violet-50 text-violet-800',
  SITE_VISIT: 'bg-amber-50 text-amber-800',
  QUOTATION: 'bg-yellow-50 text-yellow-800',
  NEGOTIATION: 'bg-orange-50 text-orange-800',
  WON: 'bg-emerald-50 text-emerald-800',
  LOST: 'bg-gray-100 text-gray-600',
};

export function statusBadge(status: LeadStatus) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function formatInr(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

export function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LeadsDashboard({ basePath }: { basePath: string }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [leads, setLeads] = useState<WebsiteLead[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [industry, setIndustry] = useState('');
  const [requirementType, setRequirementType] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [sourceType, setSourceType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [company, setCompany] = useState('');

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (industry) params.set('industry', industry);
    if (requirementType) params.set('requirementType', requirementType);
    if (assignedTo) params.set('assignedTo', assignedTo);
    if (sourceType) params.set('sourceType', sourceType);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (company) params.set('company', company);
    const [list, nextStats] = await Promise.all([
      api<{ leads: WebsiteLead[] }>(`/website-leads?${params}`),
      api<LeadStats>('/website-leads/stats'),
    ]);
    setLeads(list.leads);
    setStats(nextStats);
  }, [search, status, industry, requirementType, assignedTo, sourceType, from, to, company]);

  useEffect(() => {
    if (isAdmin) {
      api<Assignee[]>('/website-leads/assignees').then(setAssignees).catch(() => setAssignees([]));
    }
  }, [isAdmin]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch(() => {
        setLeads([]);
        setStats(null);
      })
      .finally(() => setLoading(false));
  }, [load]);

  const cards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Total leads', value: stats.total },
      { label: 'New', value: stats.new },
      { label: "Today's leads", value: stats.today },
      { label: 'This week', value: stats.thisWeek },
      { label: 'Site visits', value: stats.siteVisit },
      { label: 'Quotation stage', value: stats.quotation },
      { label: 'Won', value: stats.won },
      { label: 'Lost', value: stats.lost },
      { label: 'Conversion', value: `${stats.conversionRate}%` },
    ];
  }, [stats]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Website leads</h1>
        <p className="text-sm text-gray-500 mt-1">C&I enquiries from rollingenergy.co — qualify, follow up, then create a quotation.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-3 mb-6">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-400">{card.label}</p>
            <p className="mt-1 text-lg font-bold text-gray-900 tabular-nums">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4 grid gap-3 md:grid-cols-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, company, phone, email"
          className="md:col-span-2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Company"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        <input
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          placeholder="Industry"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((item) => (
            <option key={item} value={item}>{STATUS_LABEL[item]}</option>
          ))}
        </select>
        <select value={requirementType} onChange={(e) => setRequirementType(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
          <option value="">All requirements</option>
          <option value="SOLAR">Solar</option>
          <option value="BESS">BESS</option>
          <option value="SOLAR_PLUS_BESS">Solar + BESS</option>
          <option value="SITE_SURVEY">Site survey</option>
          <option value="ENERGY_ASSESSMENT">Energy assessment</option>
          <option value="CONSULTATION">Consultation</option>
        </select>
        <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
          <option value="">All sources</option>
          <option value="contact">Contact</option>
          <option value="solar_calculator">Solar calculator</option>
          <option value="bess_calculator">BESS calculator</option>
          <option value="resources">Resources</option>
        </select>
        {isAdmin && (
          <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <option value="">All salespeople</option>
            {assignees.map((person) => (
              <option key={person.id} value={person.id}>{person.name}</option>
            ))}
          </select>
        )}
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-gray-500">Loading leads…</p>
        ) : leads.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No website leads match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Company / contact</th>
                  <th className="px-4 py-3">Requirement</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Assigned</th>
                  <th className="px-4 py-3">Received</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`${basePath}/${lead.id}`} className="font-semibold text-gray-900 hover:text-yellow-700">
                        {lead.companyName}
                      </Link>
                      <p className="text-xs text-gray-500">{lead.name} · {lead.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {lead.requirementType.replaceAll('_', ' ')}
                      {lead.solarCapacity ? <p className="text-xs text-gray-500">{lead.solarCapacity} kW solar</p> : null}
                      {lead.bessCapacity ? <p className="text-xs text-gray-500">{lead.bessCapacity} kWh BESS</p> : null}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{lead.sourceType || '—'}</td>
                    <td className="px-4 py-3">{statusBadge(lead.status)}</td>
                    <td className="px-4 py-3 text-gray-600">{lead.assignedTo?.name || 'Unassigned'}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(lead.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
