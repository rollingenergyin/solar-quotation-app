'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import RollingEnergyLogo from '@/components/quotation/RollingEnergyLogo';

export default function SalesDashboard() {
  const [customers, setCustomers] = useState<unknown[]>([]);

  useEffect(() => {
    api<unknown[]>('/customers').then(setCustomers).catch(() => {});
  }, []);

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-6">
        <RollingEnergyLogo variant="light" size="md" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-0.5">Sales Dashboard</h1>
          <p className="text-sm text-gray-500">Rolling Energy — Manage customers, upload bills, and generate quotations.</p>
        </div>
      </div>

      {/* Quick action cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {/* Quick Quotation — featured card */}
        <Link href="/sales/quick-quotation"
          className="col-span-1 group rounded-2xl p-6 flex flex-col justify-between cursor-pointer border-0 transition-all hover:scale-[1.02] hover:shadow-xl"
          style={{ background: 'linear-gradient(135deg, #161c34 0%, #2c4570 100%)' }}
        >
          <div>
            <span className="text-3xl">⚡</span>
            <h3 className="text-lg font-bold text-white mt-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Quick Quotation
            </h3>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Generate a complete solar proposal in 2 minutes — no detailed data entry required
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span
              className="text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ background: '#6690cc', color: '#fff' }}
            >
              Start Quick Quote →
            </span>
          </div>
        </Link>

        {/* Stats */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="text-3xl font-bold text-gray-900">{customers.length}</div>
          <div className="text-sm text-gray-500 mt-1">Total Customers</div>
        </div>

        {/* New customer */}
        <Link href="/sales/customers/new"
          className="bg-white rounded-2xl border border-dashed border-gray-300 shadow-sm p-5 flex flex-col items-center justify-center gap-2 hover:border-yellow-400 hover:bg-yellow-50 transition-all text-center group"
        >
          <span className="text-2xl">👤</span>
          <span className="text-sm font-semibold text-gray-700 group-hover:text-yellow-700">+ New Customer</span>
          <span className="text-xs text-gray-400">Full workflow with bill upload</span>
        </Link>
      </div>

      {/* Quick links */}
      <div className="flex gap-3">
        <Link href="/sales/customers"
          className="border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
          View All Customers
        </Link>
        <Link href="/sales/quotations"
          className="border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
          Saved Quotations
        </Link>
      </div>
    </div>
  );
}
