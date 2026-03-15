'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { href: '/sales',                  label: 'Dashboard',      icon: '⊞' },
  { href: '/sales/customers',        label: 'Customers',      icon: '👥' },
  { href: '/sales/quotations',       label: 'My Quotations',  icon: '📋' },
  { href: '/sales/quick-quotation',  label: 'Quick Quote',    icon: '⚡' },
  { href: '/sales/profile',          label: 'Profile',       icon: '👤' },
];

const STORAGE_KEY = 'sidebar-collapsed';

export default function SalesSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

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
    <aside
      className={`min-h-screen bg-gray-900 text-white flex flex-col transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className={`flex items-center border-b border-gray-800 ${collapsed ? 'px-2 py-4 justify-center' : 'px-6 py-5'}`}>
        {collapsed ? (
          <Link href="/sales" className="flex justify-center">
            <Image src="/logo-white.png" alt="RE" width={32} height={24} className="object-contain" unoptimized />
          </Link>
        ) : (
          <div className="flex items-center justify-between w-full">
            <Link href="/sales" className="flex items-center gap-2">
              <Image src="/logo-white.png" alt="Rolling Energy" width={32} height={24} className="object-contain" unoptimized />
              <span className="font-semibold text-sm tracking-wide">Rolling Energy</span>
            </Link>
            <button
              type="button"
              onClick={toggleCollapsed}
              className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <span className="text-sm">‹</span>
            </button>
          </div>
        )}
      </div>

      <nav className={`flex-1 py-4 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/sales' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center rounded-lg text-sm transition-colors ${
                collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
              } ${
                active ? 'bg-yellow-500 text-gray-900 font-medium' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
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
          <Link href="/admin" className="block text-xs text-yellow-400 hover:text-yellow-300 mb-3 transition-colors">
            → Admin Panel
          </Link>
        )}
        {collapsed ? (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={toggleCollapsed}
              className="w-full p-2 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors flex justify-center"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <span className="text-sm">›</span>
            </button>
            <button
              type="button"
              onClick={logout}
              className="w-full p-2 rounded hover:bg-gray-800 text-red-400 hover:text-red-300 transition-colors flex justify-center"
              title="Sign out"
              aria-label="Sign out"
            >
              <span className="text-xs">←</span>
            </button>
          </div>
        ) : (
          <>
            <div className="text-xs text-gray-400 mb-0.5">{user?.name}</div>
            <div className="text-xs text-gray-500 mb-3">{user?.role}</div>
            <button onClick={logout} className="text-xs text-red-400 hover:text-red-300 transition-colors">Sign out</button>
            <button
              type="button"
              onClick={toggleCollapsed}
              className="mt-3 block w-full text-left text-xs text-gray-500 hover:text-gray-400 transition-colors"
              title="Collapse sidebar"
            >
              ‹ Collapse
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
