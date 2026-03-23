'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { href: '/finance/dashboard', label: 'Dashboard', icon: '⊞' },
  { href: '/admin/finance/expenses', label: 'Expenses', icon: '📤' },
  { href: '/admin/finance/incomes', label: 'Received', icon: '📥' },
  { href: '/admin/finance/vendors', label: 'Vendors', icon: '🏢' },
  { href: '/admin/finance/clients', label: 'Clients', icon: '👥' },
  { href: '/admin/finance/purchase-bills', label: 'Purchase Bills', icon: '📄' },
  { href: '/admin/finance/sales-bills', label: 'Sales Bills', icon: '📋' },
  { href: '/admin/finance/bank-upload', label: 'Bank Upload', icon: '🏦' },
  { href: '/admin/finance/bank-transactions', label: 'Bank Txns', icon: '💳' },
  { href: '/admin/finance/invoices', label: 'Invoices', icon: '🧾' },
  { href: '/admin/finance/products', label: 'Products', icon: '📦' },
  { href: '/admin/finance/projects', label: 'Projects', icon: '📁' },
  { href: '/admin/finance/cash-vouchers', label: 'Cash Vouchers', icon: '💵' },
];

const STORAGE_KEY = 'finance-sidebar-collapsed';

function NavContent({ collapsed, onClose }: { collapsed: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <>
      <nav className={`flex-1 py-4 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/finance/dashboard' && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              onClick={onClose}
              className={`flex items-center rounded-lg text-sm transition-colors min-h-[44px] ${
                collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
              } ${
                active
                  ? 'bg-emerald-500 text-white font-medium'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className={`text-center ${collapsed ? 'text-lg' : 'w-5'}`}>{item.icon}</span>
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      <div className={`border-t border-gray-800 ${collapsed ? 'px-2 py-4' : 'px-4 py-4'}`}>
        {!collapsed && user?.role === 'ADMIN' && (
          <Link href="/admin" className="block text-xs text-emerald-400 hover:text-emerald-300 mb-3 transition-colors py-2" onClick={onClose}>
            → Admin Panel
          </Link>
        )}
        {!collapsed && (
          <Link href="/sales" className="block text-xs text-emerald-400 hover:text-emerald-300 mb-3 transition-colors py-2" onClick={onClose}>
            → Sales Panel
          </Link>
        )}
        {!collapsed && (
          <>
            <div className="text-xs text-gray-400 mb-0.5">{user?.name}</div>
            <div className="text-xs text-gray-500 mb-3">{user?.role}</div>
            <button onClick={logout} className="text-xs text-red-400 hover:text-red-300 transition-colors py-2 min-h-[44px]">Sign out</button>
          </>
        )}
      </div>
    </>
  );
}

export default function FinanceSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) setCollapsed(stored === '1');
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
  };

  return (
    <>
      {/* Hamburger only below lg - Finance panel is PC-oriented */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-3 rounded-lg bg-gray-900 text-white shadow-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Open menu"
      >
        <span className="text-xl">☰</span>
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed lg:relative inset-y-0 left-0 z-50 flex-shrink-0
          min-h-screen bg-gray-900 text-white flex flex-col transition-transform duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${collapsed ? 'w-14' : 'w-56'}
        `}
      >
        <div className="flex-1 flex flex-col overflow-y-auto">
          <div className={`flex items-center border-b border-gray-800 ${collapsed ? 'px-2 py-4 justify-center flex-col gap-1' : 'justify-between px-4 py-4 md:py-5'}`}>
            {collapsed ? (
              <>
                <Link href="/finance/dashboard" className="flex justify-center" onClick={() => setMobileOpen(false)}>
                  <Image src="/logo-white.png" alt="RE" width={32} height={24} className="object-contain" unoptimized />
                </Link>
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  className="hidden lg:flex p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                  title="Expand sidebar"
                  aria-label="Expand sidebar"
                >
                  <span className="text-sm">›</span>
                </button>
              </>
            ) : (
              <Link href="/finance/dashboard" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
                <Image src="/logo-white.png" alt="Rolling Energy" width={32} height={24} className="object-contain" unoptimized />
                <span className="font-semibold text-sm tracking-wide">Finance</span>
              </Link>
            )}
            {!collapsed && (
              <>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="lg:hidden p-2 rounded hover:bg-gray-800 text-gray-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Close menu"
                >
                  <span className="text-xl">×</span>
                </button>
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  className="hidden lg:flex p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <span className="text-sm">‹</span>
                </button>
              </>
            )}
          </div>
          <NavContent collapsed={collapsed} onClose={() => setMobileOpen(false)} />
        </div>
      </aside>
    </>
  );
}
