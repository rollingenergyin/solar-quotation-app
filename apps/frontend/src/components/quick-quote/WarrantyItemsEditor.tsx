'use client';

import type { TemplateWarranty } from '@/types/quotation-template';
import {
  MAX_WARRANTY_ITEM_ALTERNATIVES,
  createWarrantyItem,
} from '@/constants/warranty-items';

const inputCls =
  'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
      {children}
    </label>
  );
}

function InlineOrBadge() {
  return (
    <span
      className="inline-block text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full my-1"
      style={{ color: '#fff', background: 'linear-gradient(135deg, #161c34, #6690cc)' }}
    >
      or
    </span>
  );
}

interface Props {
  items: TemplateWarranty[];
  onChange: (items: TemplateWarranty[]) => void;
  panelWarrantyYears?: string;
  onPanelWarrantyYearsChange?: (value: string) => void;
}

export default function WarrantyItemsEditor({
  items,
  onChange,
  panelWarrantyYears,
  onPanelWarrantyYearsChange,
}: Props) {
  const updateItem = (index: number, patch: Partial<TemplateWarranty>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const updateAlternative = (itemIndex: number, altIndex: number, warranty: string) => {
    const item = items[itemIndex];
    if (!item) return;
    const alternatives = [...(item.alternatives ?? [])];
    alternatives[altIndex] = { warranty };
    updateItem(itemIndex, { alternatives });
  };

  const addAlternative = (itemIndex: number) => {
    const item = items[itemIndex];
    if (!item) return;
    const alternatives = item.alternatives ?? [];
    if (alternatives.length >= MAX_WARRANTY_ITEM_ALTERNATIVES) return;
    updateItem(itemIndex, {
      alternatives: [...alternatives, { warranty: item.warranty }],
    });
  };

  const removeAlternative = (itemIndex: number, altIndex: number) => {
    const item = items[itemIndex];
    if (!item?.alternatives?.length) return;
    const alternatives = item.alternatives.filter((_, i) => i !== altIndex);
    updateItem(itemIndex, { alternatives: alternatives.length ? alternatives : undefined });
  };

  return (
    <div className="space-y-4">
      {onPanelWarrantyYearsChange && (
        <div className="max-w-xs">
          <FieldLabel>Panel performance warranty (years)</FieldLabel>
          <input
            type="number"
            min="1"
            max="30"
            value={panelWarrantyYears ?? '25'}
            onChange={(e) => onPanelWarrantyYearsChange(e.target.value)}
            className={inputCls}
          />
        </div>
      )}

      <p className="text-xs text-gray-500">
        Each component can list alternative warranty coverage. Alternatives appear in the proposal on the same row, separated by a small OR.
      </p>

      {items.map((row, itemIdx) => {
        const alts = row.alternatives ?? [];
        return (
          <div key={itemIdx} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-gray-500">Row {itemIdx + 1}</span>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => onChange(items.filter((_, i) => i !== itemIdx))}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove row
                </button>
              )}
            </div>

            <div>
              <FieldLabel>Component</FieldLabel>
              <input
                type="text"
                value={row.item}
                onChange={(e) => updateItem(itemIdx, { item: e.target.value })}
                placeholder="e.g. Solar Module Product"
                className={inputCls}
              />
            </div>

            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Primary coverage</p>
              <div>
                <FieldLabel>Warranty</FieldLabel>
                <input
                  type="text"
                  value={row.warranty}
                  onChange={(e) => updateItem(itemIdx, { warranty: e.target.value })}
                  placeholder="e.g. 12-Year Manufacturing Defect Warranty"
                  className={inputCls}
                />
              </div>
            </div>

            {alts.map((alt, altIdx) => (
              <div key={altIdx}>
                <InlineOrBadge />
                <div className="p-3 rounded-xl bg-blue-50/40 border border-blue-100 space-y-2 mt-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide">
                      Alternative {altIdx + 1}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeAlternative(itemIdx, altIdx)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                  <div>
                    <FieldLabel>Warranty</FieldLabel>
                    <input
                      type="text"
                      value={alt.warranty}
                      onChange={(e) => updateAlternative(itemIdx, altIdx, e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            ))}

            {alts.length < MAX_WARRANTY_ITEM_ALTERNATIVES && (
              <button
                type="button"
                onClick={() => addAlternative(itemIdx)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                + Add alternative for this component
              </button>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => onChange([...items, createWarrantyItem()])}
        className="w-full py-2.5 text-sm font-semibold text-blue-600 border-2 border-dashed border-blue-200 rounded-xl hover:bg-blue-50"
      >
        + Add warranty row
      </button>
    </div>
  );
}
