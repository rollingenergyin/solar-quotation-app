'use client';

import { ReactNode } from 'react';

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  variant?: 'default' | 'revenue' | 'expense' | 'profit';
  icon?: ReactNode;
  trend?: { value: number; label: string };
}

const variantStyles = {
  default: 'text-gray-900',
  revenue: 'text-emerald-600',
  expense: 'text-rose-600',
  profit: 'text-blue-600',
};

export default function SummaryCard({
  title,
  value,
  subtitle,
  variant = 'default',
  icon,
  trend,
}: SummaryCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className={`text-2xl font-semibold mt-1 truncate ${variantStyles[variant]}`}>
            {value}
          </p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          {trend && (
            <p
              className={`text-xs mt-1 font-medium ${
                trend.value >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {trend.value >= 0 ? '+' : ''}
              {trend.value}% {trend.label}
            </p>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
