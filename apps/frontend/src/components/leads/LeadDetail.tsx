'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  LEAD_STATUSES,
  formatDate,
  formatInr,
  statusBadge,
  type LeadStatus,
  type WebsiteLead,
} from './LeadsDashboard';

type Assignee = { id: string; name: string; email: string; role: string };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900 break-words">{value || '—'}</dd>
    </div>
  );
}

function JsonBlock({ data }: { data?: Record<string, unknown> | null }) {
  if (!data || Object.keys(data).length === 0) {
    return <p className="text-sm text-gray-500">No calculator submission attached.</p>;
  }
  const skip = new Set(['cashflow', 'dailyProfile']);
  const entries = Object.entries(data).filter(([key, value]) => !skip.has(key) && value !== undefined && value !== null);
  return (
    <dl>
      {entries.map(([key, value]) => (
        <Row
          key={key}
          label={key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}
          value={typeof value === 'object' ? JSON.stringify(value) : String(value)}
        />
      ))}
    </dl>
  );
}

export default function LeadDetail({ leadId, basePath }: { leadId: string; basePath: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'ADMIN';
  const [lead, setLead] = useState<WebsiteLead | null>(null);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<LeadStatus>('NEW');
  const [assignedToId, setAssignedToId] = useState('');
  const [nextFollowUp, setNextFollowUp] = useState('');
  const [lastContactedAt, setLastContactedAt] = useState('');

  async function load() {
    const data = await api<WebsiteLead>(`/website-leads/${leadId}`);
    setLead(data);
    setNotes(data.notes || '');
    setStatus(data.status);
    setAssignedToId(data.assignedToId || '');
    setNextFollowUp(data.nextFollowUp ? data.nextFollowUp.slice(0, 16) : '');
    setLastContactedAt(data.lastContactedAt ? data.lastContactedAt.slice(0, 16) : '');
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message || 'Unable to load lead'));
    if (isAdmin) {
      api<Assignee[]>('/website-leads/assignees').then(setAssignees).catch(() => setAssignees([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, isAdmin]);

  async function save(extra: Record<string, unknown> = {}) {
    setSaving(true);
    setError('');
    try {
      const updated = await api<WebsiteLead>(`/website-leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          notes,
          status,
          nextFollowUp: nextFollowUp || null,
          lastContactedAt: lastContactedAt || null,
          ...(isAdmin ? { assignedToId: assignedToId || null } : {}),
          ...extra,
        }),
      });
      setLead(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (error && !lead) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-600">{error}</p>
        <Link href={basePath} className="text-sm text-yellow-700 mt-3 inline-block">← Back to leads</Link>
      </div>
    );
  }

  if (!lead) {
    return <div className="p-8 text-sm text-gray-500">Loading lead…</div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={basePath} className="text-xs text-gray-500 hover:text-gray-800">← All leads</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{lead.companyName}</h1>
          <p className="text-sm text-gray-500 mt-1">{lead.name} · {statusBadge(lead.status)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {lead.quotationId ? (
            <Link
              href={`/quotation/${lead.quotationId}/print`}
              className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium"
            >
              Quotation created → View quotation
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => router.push(`/sales/quick-quotation?leadId=${lead.id}`)}
              className="rounded-lg bg-yellow-500 text-gray-900 px-4 py-2 text-sm font-semibold"
            >
              Create quotation
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Customer">
          <dl>
            <Row label="Name" value={lead.name} />
            <Row label="Company" value={lead.companyName} />
            <Row label="Phone" value={<a href={`tel:${lead.phone}`} className="text-yellow-800">{lead.phone}</a>} />
            <Row label="Email" value={<a href={`mailto:${lead.email}`} className="text-yellow-800">{lead.email}</a>} />
            <Row label="Industry" value={lead.industry} />
            <Row label="Location" value={lead.location} />
            <Row label="Notes from site" value={lead.message} />
          </dl>
        </Section>

        <Section title="Energy profile">
          <dl>
            <Row label="Monthly bill" value={formatInr(lead.monthlyElectricityBill)} />
            <Row label="Monthly units" value={lead.monthlyUnits ? `${lead.monthlyUnits} kWh` : undefined} />
            <Row label="Connected load" value={lead.connectedLoad ? `${lead.connectedLoad} kW` : undefined} />
            <Row label="Maximum demand" value={lead.maximumDemand ? `${lead.maximumDemand} kVA` : undefined} />
            <Row label="Contract demand" value={lead.contractDemand ? `${lead.contractDemand} kVA` : undefined} />
            <Row label="Operating hours" value={lead.operatingHours ? `${lead.operatingHours} h/day` : undefined} />
          </dl>
        </Section>

        <Section title="Solar requirement">
          <Row label="Solar capacity" value={lead.solarCapacity ? `${lead.solarCapacity} kW` : undefined} />
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Calculator results</p>
            <JsonBlock data={lead.solarCalculatorResults} />
          </div>
        </Section>

        <Section title="BESS requirement">
          <Row label="BESS capacity" value={lead.bessCapacity ? `${lead.bessCapacity} kWh` : undefined} />
          <Row label="Backup" value={lead.backupRequirement} />
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Calculator results</p>
            <JsonBlock data={lead.bessCalculatorResults} />
          </div>
        </Section>

        <Section title="Source">
          <dl>
            <Row label="Website page" value={lead.sourcePage} />
            <Row label="Lead type" value={lead.sourceType} />
            <Row label="Requirement" value={lead.requirementType.replaceAll('_', ' ')} />
            <Row label="Submitted" value={formatDate(lead.createdAt)} />
            <Row label="Landing page" value={lead.landingPage} />
            <Row label="Referrer" value={lead.referrer} />
            <Row label="UTM source" value={lead.utmSource} />
            <Row label="UTM medium" value={lead.utmMedium} />
            <Row label="UTM campaign" value={lead.utmCampaign} />
            <Row label="UTM term" value={lead.utmTerm} />
            <Row label="UTM content" value={lead.utmContent} />
          </dl>
        </Section>

        <Section title="Sales">
          <div className="grid gap-3">
            <label className="text-xs text-gray-500">
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as LeadStatus)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                {LEAD_STATUSES.map((item) => (
                  <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>
                ))}
              </select>
            </label>
            {isAdmin && (
              <label className="text-xs text-gray-500">
                Assigned salesperson
                <select
                  value={assignedToId}
                  onChange={(e) => setAssignedToId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="">Unassigned</option>
                  {assignees.map((person) => (
                    <option key={person.id} value={person.id}>{person.name}</option>
                  ))}
                </select>
              </label>
            )}
            {!isAdmin && <Row label="Assigned" value={lead.assignedTo?.name || 'Unassigned'} />}
            <label className="text-xs text-gray-500">
              Last contacted
              <input
                type="datetime-local"
                value={lastContactedAt}
                onChange={(e) => setLastContactedAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-gray-500">
              Next follow-up
              <input
                type="datetime-local"
                value={nextFollowUp}
                onChange={(e) => setNextFollowUp(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-gray-500">
              Notes
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={() => save()}
              disabled={saving}
              className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save follow-up'}
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}
