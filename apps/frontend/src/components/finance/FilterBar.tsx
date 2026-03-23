'use client';

interface FilterBarProps {
  period: 'daily' | 'monthly' | 'yearly';
  onPeriodChange: (period: 'daily' | 'monthly' | 'yearly') => void;
  projectId: string;
  onProjectChange: (projectId: string) => void;
  projects?: { id: string; name: string }[];
  dateFrom?: string;
  dateTo?: string;
  onDateRangeChange?: (from: string, to: string) => void;
}

export default function FilterBar({
  period,
  onPeriodChange,
  projectId,
  onProjectChange,
  projects = [],
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={period}
        onChange={(e) => onPeriodChange(e.target.value as 'daily' | 'monthly' | 'yearly')}
        className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
      >
        <option value="daily">Last 24 hours</option>
        <option value="monthly">This month</option>
        <option value="yearly">This year</option>
      </select>

      {projects.length > 0 && (
        <select
          value={projectId}
          onChange={(e) => onProjectChange(e.target.value)}
          className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
