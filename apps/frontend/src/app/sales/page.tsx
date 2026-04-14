'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import SalesPanelLeadList from '@/components/sales/SalesPanelLeadList';
import SalesPanelLeadDetail from '@/components/sales/SalesPanelLeadDetail';
import SalesPanelActionPanel from '@/components/sales/SalesPanelActionPanel';
import type { SalesPanelLead } from '@/components/sales/salesPanel.types';

type SalesPanelResponse = { leads: SalesPanelLead[] };

// Mobile only: which right-side panel to show
type MobileTab = 'detail' | 'action';

export default function SalesPage() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<SalesPanelLead | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>('detail');

  const { data, isLoading, isError, refetch } = useQuery<SalesPanelResponse>({
    queryKey: ['dashboard', 'sales-panel'],
    queryFn: () => api<SalesPanelResponse>('/dashboard/sales-panel'),
    refetchInterval: 30_000,
  });

  const leads = data?.leads ?? [];
  const urgentCount  = leads.filter((l) => l.bucket === 'URGENT').length;
  const hotCount     = leads.filter((l) => l.bucket === 'HOT').length;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  // Sync selected lead with refreshed data so action panel reflects latest state
  function handleRefresh() {
    refetch().then((res) => {
      if (selected && res.data) {
        const fresh = res.data.leads.find((l) => l.id === selected.id);
        if (fresh) setSelected(fresh);
      }
    });
  }

  function handleSelect(lead: SalesPanelLead) {
    setSelected(lead);
    setMobileTab('detail');
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">☀️</div>
          <p className="text-sm text-gray-400">Loading your leads…</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center p-8">
          <p className="text-sm text-red-500 mb-3">Failed to load sales panel.</p>
          <button onClick={() => refetch()} className="text-xs text-gray-500 underline">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">

      {/* ── TOP BAR ─────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shadow-sm">
        <div>
          <p className="text-xs text-gray-400">
            {greeting}{user?.name ? `, ${user.name.split(' ')[0]}` : ''} 👋
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <h1 className="text-sm font-bold text-gray-900">Sales Action Panel</h1>
            {urgentCount > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 animate-pulse">
                {urgentCount} urgent
              </span>
            )}
            {hotCount > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                {hotCount} hot
              </span>
            )}
            <span className="text-xs text-gray-400">{leads.length} leads</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            ↻
          </button>
          <Link
            href="/sales/quick-quotation"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-700"
          >
            ⚡ Quote
          </Link>
        </div>
      </div>

      {/* ── MAIN CONTENT ────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0">

        {/* LEFT: Lead List — always visible on desktop, full-screen on mobile when no lead selected */}
        <div className={`
          border-r border-gray-200 bg-white flex-shrink-0 overflow-hidden flex flex-col
          transition-all duration-200
          ${selected
            ? 'hidden lg:flex lg:w-[260px]'   /* hide on mobile when lead selected */
            : 'w-full lg:w-[260px]'            /* full width on mobile, fixed on desktop */
          }
        `}>
          {leads.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="text-4xl mb-3">🎯</div>
              <p className="text-sm font-medium text-gray-700 mb-1">No CRM leads yet</p>
              <p className="text-xs text-gray-400 mb-4">Import leads via the CRM panel or add manually.</p>
              <Link
                href="/admin/crm"
                className="text-xs font-semibold px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700"
              >
                Open CRM Panel
              </Link>
            </div>
          ) : (
            <SalesPanelLeadList
              leads={leads}
              selectedId={selected?.id ?? null}
              onSelect={handleSelect}
            />
          )}
        </div>

        {/* CENTER + RIGHT panels (shown when a lead is selected) */}
        {selected ? (
          <div className="flex-1 flex min-w-0 overflow-hidden">

            {/* CENTER: Lead Detail */}
            <div className={`
              flex-1 border-r border-gray-200 overflow-hidden flex flex-col
              ${mobileTab === 'detail' ? 'flex' : 'hidden lg:flex'}
            `}>
              <SalesPanelLeadDetail
                lead={selected}
                onClose={() => setSelected(null)}
                onRefresh={handleRefresh}
              />
            </div>

            {/* RIGHT: Action Panel */}
            <div className={`
              flex-shrink-0 overflow-hidden flex flex-col
              w-full lg:w-[300px]
              ${mobileTab === 'action' ? 'flex' : 'hidden lg:flex'}
            `}>
              <SalesPanelActionPanel
                lead={selected}
                onStageUpdated={handleRefresh}
              />
            </div>

          </div>
        ) : (
          /* No lead selected (desktop empty state in center) */
          <div className="hidden lg:flex flex-1 items-center justify-center flex-col gap-3 text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl">
              ☀️
            </div>
            <p className="text-sm font-medium text-gray-500">Select a lead to start working</p>
            <p className="text-xs text-gray-400">
              Leads are sorted by AI priority score — tackle the top ones first.
            </p>
          </div>
        )}
      </div>

      {/* ── MOBILE BOTTOM TAB (when lead selected) ─────────────── */}
      {selected && (
        <div className="lg:hidden flex-shrink-0 flex bg-white border-t border-gray-200">
          <button
            onClick={() => setMobileTab('detail')}
            className={`flex-1 py-3 text-xs font-semibold flex flex-col items-center gap-1 transition-colors ${
              mobileTab === 'detail' ? 'text-gray-900 border-t-2 border-gray-900' : 'text-gray-400'
            }`}
          >
            <span>📋</span>
            Details
          </button>
          <button
            onClick={() => setMobileTab('action')}
            className={`flex-1 py-3 text-xs font-semibold flex flex-col items-center gap-1 transition-colors ${
              mobileTab === 'action' ? 'text-gray-900 border-t-2 border-gray-900' : 'text-gray-400'
            }`}
          >
            <span>⚡</span>
            Actions
            {selected.nextAction.urgency === 'CRITICAL' && (
              <span className="absolute mt-[-4px] ml-8 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setSelected(null)}
            className="flex-1 py-3 text-xs font-semibold flex flex-col items-center gap-1 text-gray-400"
          >
            <span>←</span>
            Back
          </button>
        </div>
      )}
    </div>
  );
}
