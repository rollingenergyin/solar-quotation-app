'use client';

type KPIs = {
  revenueThisMonth: number;
  revenueLastMonth: number;
  quotationsThisMonth: number;
  quotationsLastMonth: number;
  momDelta: number;
  conversionRate: number;
  activeLeads: number;
  totalCustomers: number;
};

function fmt(n: number) {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)}Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

function Delta({ value }: { value: number }) {
  if (value === 0) return <span className="text-xs text-gray-400">vs last month</span>;
  const positive = value > 0;
  return (
    <span className={`text-xs font-medium ${positive ? 'text-green-600' : 'text-red-500'}`}>
      {positive ? '▲' : '▼'} {Math.abs(value)}% vs last month
    </span>
  );
}

type MetricCard = {
  label: string;
  value: string;
  subValue?: string;
  delta?: React.ReactNode;
  accent: string;
  icon: string;
};

export default function MetricsRow({ kpis }: { kpis: KPIs }) {
  const cards: MetricCard[] = [
    {
      label: 'Revenue This Month',
      value: fmt(kpis.revenueThisMonth),
      delta: <Delta value={Math.round(kpis.revenueLastMonth > 0 ? ((kpis.revenueThisMonth - kpis.revenueLastMonth) / kpis.revenueLastMonth) * 100 : 0)} />,
      accent: 'bg-green-500',
      icon: '💰',
    },
    {
      label: 'Quotations Sent',
      value: String(kpis.quotationsThisMonth),
      delta: <Delta value={kpis.momDelta} />,
      accent: 'bg-blue-500',
      icon: '📋',
    },
    {
      label: 'Conversion Rate',
      value: `${kpis.conversionRate}%`,
      subValue: 'Won / total closed',
      accent: 'bg-yellow-500',
      icon: '🎯',
    },
    {
      label: 'Active Leads',
      value: String(kpis.activeLeads),
      subValue: `${kpis.totalCustomers} total customers`,
      accent: 'bg-purple-500',
      icon: '⚡',
    },
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div key={card.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between mb-3">
            <span className="text-2xl">{card.icon}</span>
            <div className={`w-2 h-2 rounded-full ${card.accent} mt-1`} />
          </div>
          <div className="text-2xl font-bold text-gray-900">{card.value}</div>
          <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
          {card.delta && <div className="mt-1">{card.delta}</div>}
          {card.subValue && (
            <div className="mt-1 text-xs text-gray-400">{card.subValue}</div>
          )}
        </div>
      ))}
    </div>
  );
}
