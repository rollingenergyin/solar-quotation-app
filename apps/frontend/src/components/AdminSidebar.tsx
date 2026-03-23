'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: '⊞' },
  { href: '/finance/dashboard', label: 'Finance Panel', icon: '💰' },
  { href: '/admin/users', label: 'Sales Users', icon: '👥' },
  { href: '/admin/quotations', label: 'All Quotations', icon: '📋' },
  { href: '/admin/materials', label: 'Materials', icon: '⬡' },
  { href: '/admin/pricing', label: 'Weekly Pricing', icon: '₹' },
  { href: '/admin/formulas', label: 'Formulas', icon: 'ƒ' },
  { href: '/admin/templates', label: 'Quote Template', icon: '📄' },
  { href: '/admin/audit', label: 'Audit Logs', icon: '⊙' },
];

const STORAGE_KEY = 'sidebar-collapsed';

function NavContent({ collapsed, onClose }: { collapsed: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <>
      <nav className={`flex-1 py-4 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
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
                  ? 'bg-yellow-500 text-gray-900 font-medium'
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
        {!collapsed && (
          <Link href="/sales" className="block text-xs text-yellow-400 hover:text-yellow-300 mb-3 transition-colors py-2" onClick={onClose}>
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

export default function AdminSidebar() {
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
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-40 p-3 rounded-lg bg-gray-900 text-white shadow-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Open menu"
      >
        <span className="text-xl">☰</span>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:relative inset-y-0 left-0 z-50
          min-h-screen bg-gray-900 text-white flex flex-col transition-transform duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${collapsed ? 'w-16' : 'w-64'}
        `}
      >
        <div className="flex-1 flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between border-b border-gray-800 px-4 py-4 md:py-5">
            <Link href="/admin" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
              <Image src="/logo-white.png" alt="Rolling Energy" width={32} height={24} className="object-contain" unoptimized />
              <span className="font-semibold text-sm tracking-wide">Rolling Energy</span>
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="md:hidden p-2 rounded hover:bg-gray-800 text-gray-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close menu"
            >
              <span className="text-xl">×</span>
            </button>
            <button
              type="button"
              onClick={toggleCollapsed}
              className="hidden md:flex p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <span className="text-sm">‹</span>
            </button>
          </div>
          <NavContent collapsed={collapsed} onClose={() => setMobileOpen(false)} />
        </div>
      </aside>
    </>
  );
}
