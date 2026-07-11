'use client';

import {
  type CostingOptionRow,
  type CostingSystemType,
  type CostingSiteType,
  MAX_COSTING_OPTIONS,
  MIN_COSTING_OPTIONS,
  createCostingOptionRow,
  totalInclGstFromBase,
  baseFromTotalInclGst,
} from '@/constants/costing-options';
import { OrSeparator, CostingOptionTitleBox } from '@/components/quotation/CostingSharedBlocks';

const inputCls =
  'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white';

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
      {children}
      {required && <span className="ml-1 text-red-400">*</span>}
    </label>
  );
}

interface Props {
  options: CostingOptionRow[];
  onChange: (options: CostingOptionRow[]) => void;
  systemSizeKw: number;
  defaultSiteType?: CostingSiteType;
  defaultSystemType?: CostingSystemType;
  sectionNumber?: string;
}

export default function AlternativeCostingEditor({
  options,
  onChange,
  systemSizeKw,
  defaultSiteType = 'RESIDENTIAL',
  defaultSystemType = 'DCR',
  sectionNumber = '5',
}: Props) {
  const update = (id: string, patch: Partial<CostingOptionRow>) => {
    onChange(options.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };

  const syncFromPpw = (row: CostingOptionRow, ppw: string) => {
    const p = parseFloat(ppw);
    if (p > 0 && systemSizeKw > 0) {
      const base = Math.round(systemSizeKw * 1000 * p);
      return {
        pricePerWatt: ppw,
        totalBaseAmount: String(base),
        totalCostInclGst: String(totalInclGstFromBase(base)),
      };
    }
    return { pricePerWatt: ppw, totalBaseAmount: '', totalCostInclGst: '' };
  };

  const syncFromBase = (row: CostingOptionRow, baseStr: string) => {
    const base = parseFloat(baseStr);
    if (base > 0 && systemSizeKw > 0) {
      return {
        totalBaseAmount: baseStr,
        pricePerWatt: (base / (systemSizeKw * 1000)).toFixed(2),
        totalCostInclGst: String(totalInclGstFromBase(Math.round(base))),
      };
    }
    return { totalBaseAmount: baseStr, pricePerWatt: '', totalCostInclGst: '' };
  };

  const syncFromGross = (row: CostingOptionRow, grossStr: string) => {
    const gross = parseFloat(grossStr);
    if (gross > 0 && systemSizeKw > 0) {
      const base = baseFromTotalInclGst(gross);
      return {
        totalCostInclGst: grossStr,
        totalBaseAmount: String(base),
        pricePerWatt: (base / (systemSizeKw * 1000)).toFixed(2),
      };
    }
    return { totalCostInclGst: grossStr, totalBaseAmount: '', pricePerWatt: '' };
  };

  const addOption = () => {
    if (options.length >= MAX_COSTING_OPTIONS) return;
    const last = options[options.length - 1];
    const normalized = options.map((o, i) => ({
      ...o,
      title: o.title.trim() || (i === 0 ? 'Standard Option' : `Option ${i + 1}`),
    }));
    onChange([
      ...normalized,
      createCostingOptionRow(options.length + 1, {
        systemType: defaultSystemType,
        siteType: defaultSiteType,
        pricePerWatt: last?.pricePerWatt ?? '55',
      }),
    ]);
  };

  const removeOption = (id: string) => {
    if (options.length <= MIN_COSTING_OPTIONS) return;
    const next = options.filter((o) => o.id !== id);
    if (next.length === 1) {
      onChange([{ ...next[0], title: '' }]);
      return;
    }
    onChange(next);
  };

  const multipleOptions = options.length > 1;

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        {multipleOptions
          ? `Configure up to ${MAX_COSTING_OPTIONS} alternative costing options. Each option requires a title and pricing.`
          : 'Enter pricing for your system. Add alternative costing to compare multiple price options.'}
        {systemSizeKw > 0 && (
          <span className="block mt-1 text-blue-700">
            System capacity{multipleOptions ? ' for all options' : ''}: <strong>{systemSizeKw} kW</strong>
          </span>
        )}
      </p>

      {options.map((row, idx) => (
        <div key={row.id}>
          {idx > 0 && (
            <div className="my-6">
              <OrSeparator />
            </div>
          )}

          <div className="rounded-xl border border-gray-200 p-4 bg-gray-50/50">
            {multipleOptions && (
              <div className="flex items-start justify-between gap-3 mb-3">
                <CostingOptionTitleBox
                  index={idx + 1}
                  title={row.title}
                />
                <button
                  type="button"
                  onClick={() => removeOption(row.id)}
                  className="text-xs text-red-500 hover:text-red-700 shrink-0 mt-1"
                >
                  Remove
                </button>
              </div>
            )}

            {multipleOptions && (
              <div className="mb-3">
                <FieldLabel required>Costing Title</FieldLabel>
                <input
                  type="text"
                  value={row.title}
                  onChange={(e) => update(row.id, { title: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. Premium DCR Option, Budget Option"
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <FieldLabel required>Price per Watt (₹/W)</FieldLabel>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={row.pricePerWatt}
                  onChange={(e) => update(row.id, syncFromPpw(row, e.target.value))}
                  className={`${inputCls} text-right tabular-nums`}
                />
              </div>
              <div>
                <FieldLabel>Base Amount (ex GST)</FieldLabel>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={row.totalBaseAmount}
                  onChange={(e) => update(row.id, syncFromBase(row, e.target.value))}
                  className={`${inputCls} text-right tabular-nums`}
                />
              </div>
              <div>
                <FieldLabel>Total incl. GST</FieldLabel>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={row.totalCostInclGst}
                  onChange={(e) => update(row.id, syncFromGross(row, e.target.value))}
                  className={`${inputCls} text-right tabular-nums`}
                />
              </div>
            </div>
          </div>
        </div>
      ))}

      {options.length < MAX_COSTING_OPTIONS && (
        <button
          type="button"
          onClick={addOption}
          className="w-full py-2.5 rounded-xl text-sm font-medium border border-dashed border-gray-300 text-gray-600 hover:border-gray-500 hover:bg-white"
        >
          + Add Alternative Costing ({options.length}/{MAX_COSTING_OPTIONS})
        </button>
      )}
    </div>
  );
}

export function AlternativeCostingEditorCard(props: Props & { icon?: string }) {
  const multipleOptions = props.options.length > 1;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <span className="text-xl">{props.icon ?? '💰'}</span>
        <h3 className="text-sm font-semibold text-gray-800">
          {props.sectionNumber}. {multipleOptions ? 'Pricing & Costing Options' : 'Pricing'}
        </h3>
      </div>
      <div className="p-5">
        <AlternativeCostingEditor {...props} />
      </div>
    </div>
  );
}
