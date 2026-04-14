'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import LeadListPanel, { type Lead } from '@/components/sales/LeadListPanel';
import LeadDetailPanel from '@/components/sales/LeadDetailPanel';
import SmartSuggestions from '@/components/sales/SmartSuggestions';

type SalesDashboardData = {
  leads: Lead[];
  suggestions: { type: string; message: string; count: number }[];
};

export default function SalesWorkspace() {
  const { user } = useAuth();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<SalesDashboardData>({
    queryKey: ['dashboard', 'sales'],
    queryFn: () => api<SalesDashboardData>('/dashboard/sales'),
    refetchInterval: 30_000,
  });

  const leads = data?.leads ?? [];
  const suggestions = data?.suggestions ?? [];

  const hotCount = leads.filter((l) => l.priority === 'HOT').length;
  const newCount = leads.filter((l) => l.priority === 'NEW').length;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen overflow-hidden">
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5 bg-white border-b border-gray-100">
        <div>
          <div className="text-sm text-gray-500">
            {greeting}{user?.name ? `, ${user.name.split(' ')[0]}` : ''} 👋
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <h1 className="text-base font-bold text-gray-900">Sales Workspace</h1>
            {hotCount > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                {hotCount} hot
              </span>
            )}
            {newCount > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                {newCount} new
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/sales/quick-quotation"
            className="text-xs font-semibold px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors"
          >
            ⚡ Quick Quote
          </Link>
          <Link
            href="/sales/customers/new"
            className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            + Lead
          </Link>
        </div>
      </div>

      {/* Smart suggestions */}
      {suggestions.length > 0 && (
        <div className="flex-shrink-0 px-5 pt-3 pb-0">
          <SmartSuggestions suggestions={suggestions} />
        </div>
      )}

      {/* Main two-panel layout */}
      <div className="flex-1 flex min-h-0">
        {/* Lead List — left panel (40%) */}
        <div
          className={`flex-shrink-0 border-r border-gray-100 bg-white overflow-hidden flex flex-col transition-all duration-200 ${
            selectedLead ? 'hidden md:flex md:w-[38%] lg:w-[35%]' : 'w-full md:w-[38%] lg:w-[35%]'
          }`}
        >
          {isLoading && (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
              Loading leads…
            </div>
          )}
          {isError && (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6 text-center">
              <span className="text-sm text-red-500">Failed to load leads</span>
              <button
                onClick={() => refetch()}
                className="text-xs text-gray-500 underline"
              >
                Retry
              </button>
            </div>
          )}
          {!isLoading && !isError && (
            <LeadListPanel
              leads={leads}
              selectedId={selectedLead?.id ?? null}
              onSelect={setSelectedLead}
            />
          )}
        </div>

        {/* Lead Detail — right panel (60%) */}
        <div
          className={`flex-1 bg-white overflow-hidden flex flex-col ${
            !selectedLead ? 'hidden md:flex' : 'flex'
          }`}
        >
          {selectedLead ? (
            <LeadDetailPanel
              lead={selectedLead}
              onClose={() => setSelectedLead(null)}
              onRefresh={() => refetch()}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl mb-4">
                ☀️
              </div>
              <p className="text-sm font-medium text-gray-500">Select a lead to view details</p>
              <p className="text-xs text-gray-400 mt-1">
                {leads.length} lead{leads.length !== 1 ? 's' : ''} loaded
              </p>
              <div className="mt-6 flex gap-3">
                <Link
                  href="/sales/customers"
                  className="text-xs text-gray-500 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50"
                >
                  All Customers
                </Link>
                <Link
                  href="/sales/quotations"
                  className="text-xs text-gray-500 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50"
                >
                  Saved Quotations
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
