'use client';

import type { SiteCostingLineItem } from '@/constants/site-costing';

const inputCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-300';

interface Props {
  lineItems: SiteCostingLineItem[];
  draftAmounts: Record<string, string>;
  systemSizeKw: number;
  onAmountChange: (key: string, value: string) => void;
}

function amountToPerWatt(amount: number, systemSizeKw: number): string {
  const watts = systemSizeKw * 1000;
  if (!Number.isFinite(amount) || watts <= 0) return '';
  return (amount / watts).toFixed(2);
}

export default function SiteCostingPricingEditor({
  lineItems,
  draftAmounts,
  systemSizeKw,
  onAmountChange,
}: Props) {
  const watts = systemSizeKw * 1000;

  const handlePerWattChange = (key: string, value: string) => {
    const perWatt = parseFloat(value);
    if (!Number.isFinite(perWatt) || perWatt < 0 || watts <= 0) return;
    onAmountChange(key, String(Math.round(perWatt * watts)));
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="hidden sm:grid sm:grid-cols-[1fr_7rem_8rem] gap-4 px-5 py-3 border-b border-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
        <span>Cost Component</span>
        <span className="text-right">₹/W</span>
        <span className="text-right">Amount (₹)</span>
      </div>
      <div className="divide-y divide-gray-50">
        {lineItems.map((item) => {
          const amountStr = draftAmounts[item.key] ?? String(item.amount);
          const amountNum = parseFloat(amountStr);
          const perWattStr = Number.isFinite(amountNum) ? amountToPerWatt(amountNum, systemSizeKw) : '';

          return (
            <div
              key={item.key}
              className="px-5 py-3 grid grid-cols-1 sm:grid-cols-[1fr_7rem_8rem] gap-2 sm:gap-4 sm:items-center"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">{item.label}</p>
                {item.quantity != null && item.unit && (
                  <p className="text-xs text-gray-400">
                    {item.quantity} {item.unit}
                    {item.rate != null ? ` @ ₹${item.rate}` : ''}
                  </p>
                )}
              </div>
              <div>
                <label className="sm:hidden text-xs text-gray-400 mb-1 block">₹/W</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={perWattStr}
                  onChange={(e) => handlePerWattChange(item.key, e.target.value)}
                  className={inputCls}
                  disabled={!item.editable || watts <= 0}
                />
              </div>
              <div>
                <label className="sm:hidden text-xs text-gray-400 mb-1 block">Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={amountStr}
                  onChange={(e) => onAmountChange(item.key, e.target.value)}
                  className={inputCls}
                  disabled={!item.editable}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
