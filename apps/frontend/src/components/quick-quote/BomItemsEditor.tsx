'use client';

import type { BomItemAlternative, TemplateBomItem } from '@/types/quotation-template';
import {
  MAX_BOM_ITEM_ALTERNATIVES,
  createBomItem,
} from '@/constants/bom-items';

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
  items: TemplateBomItem[];
  onChange: (items: TemplateBomItem[]) => void;
}

export default function BomItemsEditor({ items, onChange }: Props) {
  const updateItem = (index: number, patch: Partial<TemplateBomItem>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const updateAlternative = (
    itemIndex: number,
    altIndex: number,
    patch: Partial<BomItemAlternative>,
  ) => {
    const item = items[itemIndex];
    if (!item) return;
    const alternatives = [...(item.alternatives ?? [])];
    alternatives[altIndex] = { ...alternatives[altIndex]!, ...patch };
    updateItem(itemIndex, { alternatives });
  };

  const addAlternative = (itemIndex: number) => {
    const item = items[itemIndex];
    if (!item) return;
    const alternatives = item.alternatives ?? [];
    if (alternatives.length >= MAX_BOM_ITEM_ALTERNATIVES) return;
    updateItem(itemIndex, {
      alternatives: [
        ...alternatives,
        { specification: item.specification, make: item.make },
      ],
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
      <p className="text-xs text-gray-500">
        Each product can list alternative specifications and makes. Alternatives appear in the proposal on the same row, separated by a small OR.
      </p>

      {items.map((item, itemIdx) => {
        const alts = item.alternatives ?? [];
        return (
          <div key={itemIdx} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-gray-500">Line {itemIdx + 1}</span>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(
                      items
                        .filter((_, i) => i !== itemIdx)
                        .map((row, i) => ({ ...row, srNo: i + 1 })),
                    );
                  }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove line
                </button>
              )}
            </div>

            <div>
              <FieldLabel>Product / Item</FieldLabel>
              <input
                type="text"
                value={item.name}
                onChange={(e) => updateItem(itemIdx, { name: e.target.value })}
                placeholder="e.g. Solar Panels"
                className={inputCls}
              />
            </div>

            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Primary option</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <FieldLabel>Specification</FieldLabel>
                  <input
                    type="text"
                    value={item.specification}
                    onChange={(e) => updateItem(itemIdx, { specification: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <FieldLabel>Make / Brand</FieldLabel>
                  <input
                    type="text"
                    value={item.make}
                    onChange={(e) => updateItem(itemIdx, { make: e.target.value })}
                    className={inputCls}
                  />
                </div>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <FieldLabel>Specification</FieldLabel>
                      <input
                        type="text"
                        value={alt.specification}
                        onChange={(e) => updateAlternative(itemIdx, altIdx, { specification: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <FieldLabel>Make / Brand</FieldLabel>
                      <input
                        type="text"
                        value={alt.make}
                        onChange={(e) => updateAlternative(itemIdx, altIdx, { make: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {alts.length < MAX_BOM_ITEM_ALTERNATIVES && (
              <button
                type="button"
                onClick={() => addAlternative(itemIdx)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                + Add alternative for this product
              </button>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => onChange([...items, createBomItem(items.length + 1)])}
        className="w-full py-2.5 text-sm font-semibold text-blue-600 border-2 border-dashed border-blue-200 rounded-xl hover:bg-blue-50"
      >
        + Add BOM line
      </button>
    </div>
  );
}
