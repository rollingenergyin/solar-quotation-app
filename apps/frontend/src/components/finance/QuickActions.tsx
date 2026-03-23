'use client';

import Link from 'next/link';

const actions = [
  { href: '/admin/finance/vendors', label: 'Vendors', color: 'gray' },
  { href: '/admin/finance/clients', label: 'Clients', color: 'gray' },
  { href: '/admin/finance/expenses', label: 'Expenses', color: 'gray' },
  { href: '/admin/finance/expenses/new', label: '+ Add Expense', color: 'red' },
  { href: '/admin/finance/incomes', label: 'Received', color: 'gray' },
  { href: '/admin/finance/incomes/new', label: '+ Add Received', color: 'green' },
  { href: '/admin/finance/purchase-bills', label: 'Purchase Bills', color: 'gray' },
  { href: '/admin/finance/sales-bills', label: 'Sales Bills', color: 'gray' },
  { href: '/admin/finance/bank-upload', label: 'Bank Upload', color: 'blue' },
  { href: '/admin/finance/bank-transactions', label: 'Bank Txns', color: 'blue' },
  { href: '/admin/finance/invoices', label: 'Invoices', color: 'gray' },
  { href: '/admin/finance/invoices/new', label: '+ New Invoice', color: 'gray' },
  { href: '/admin/finance/products', label: 'Products', color: 'gray' },
  { href: '/admin/finance/cash-vouchers', label: 'Cash Vouchers', color: 'gray' },
  { href: '/admin/finance/cash-voucher/new', label: '+ Cash Voucher', color: 'amber' },
] as const;

const colorClasses = {
  gray: 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100',
  red: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
  blue: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
};

export default function QuickActions() {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${colorClasses[a.color]}`}
        >
          {a.label}
        </Link>
      ))}
    </div>
  );
}
