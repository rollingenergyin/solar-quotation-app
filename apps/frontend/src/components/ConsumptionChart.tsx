'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';

interface Bill { month: number; year: number; unitsKwh: number; amount?: number }

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function ConsumptionChart({ bills }: { bills: Bill[] }) {
  if (!bills.length) return (
    <div className="flex items-center justify-center h-40 text-sm text-gray-400">
      No consumption data yet.
    </div>
  );

  const data = bills.map((b) => ({
    label: `${MONTH_SHORT[b.month - 1]} ${String(b.year).slice(2)}`,
    units: b.unitsKwh,
    amount: b.amount ?? 0,
  }));

  const avg = data.reduce((s, d) => s + d.units, 0) / data.length;
  const maxUnits = Math.max(...data.map((d) => d.units));

  return (
    <div>
      <div className="flex gap-6 text-xs text-gray-500 mb-3">
        <span>Avg: <strong className="text-gray-800">{avg.toFixed(0)} kWh</strong></span>
        <span>Peak: <strong className="text-gray-800">{maxUnits.toFixed(0)} kWh</strong></span>
        <span>Annual est: <strong className="text-gray-800">{(avg * 12).toFixed(0)} kWh</strong></span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barSize={28}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(v: number | undefined) => [v != null ? `${v} kWh` : '', 'Units']}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
          />
          <ReferenceLine y={avg} stroke="#eab308" strokeDasharray="4 4" label={{ value: 'avg', fill: '#eab308', fontSize: 10 }} />
          <Bar dataKey="units" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.units > avg ? '#eab308' : '#93c5fd'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-400 inline-block" /> Above avg</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-300 inline-block" /> Below avg</span>
      </div>
    </div>
  );
}
