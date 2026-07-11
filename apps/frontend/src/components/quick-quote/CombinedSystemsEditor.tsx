'use client';

import {
  type CombinedSystemRow,
  type CombinedSiteType,
  type CombinedConnectionType,
  type CombinedMeterPhase,
  type CombinedStructureCategory,
  COMBINED_CONNECTION_OPTIONS,
  createCombinedSystemRow,
  MAX_COMBINED_SYSTEMS,
  MIN_COMBINED_SYSTEMS,
  parseOptionalSanctionedLoadKw,
} from '@/constants/combined-quotation';
import {
  METER_PHASE_OPTIONS,
  STRUCTURE_CATEGORIES,
  STRUCTURE_OPTIONS,
} from '@/constants/quick-quote-options';

const inputCls =
  'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white';

const GST_RATE = 0.089;

function totalInclGstFromBase(base: number): number {
  return base + Math.round(base * GST_RATE);
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
      {children}
      {required && <span className="ml-1 text-red-400">*</span>}
    </label>
  );
}

interface Props {
  systems: CombinedSystemRow[];
  onChange: (systems: CombinedSystemRow[]) => void;
  defaultSiteType?: CombinedSiteType;
  singleCosting?: boolean;
  onSingleCostingChange?: (value: boolean) => void;
}

function normalizeConnectionType(siteType?: CombinedSiteType): CombinedConnectionType {
  return siteType === 'COMMERCIAL' ? 'COMMERCIAL' : 'RESIDENTIAL';
}

export default function CombinedSystemsEditor({
  systems,
  onChange,
  defaultSiteType = 'RESIDENTIAL',
  singleCosting = false,
  onSingleCostingChange,
}: Props) {
  const rowDefaults = {
    siteType: normalizeConnectionType(defaultSiteType),
    meterPhase: 'SINGLE' as CombinedMeterPhase,
    structureCategory: 'STANDARD' as CombinedStructureCategory,
    structureOption: '1ft',
  };

  const update = (id: string, patch: Partial<CombinedSystemRow>) => {
    onChange(systems.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const syncPricingFromPpw = (row: CombinedSystemRow, ppw: string) => {
    const kw = parseFloat(row.capacityKw);
    const p = parseFloat(ppw);
    if (p > 0 && kw > 0) {
      const base = Math.round(kw * 1000 * p);
      return {
        pricePerWatt: ppw,
        totalBaseAmount: String(base),
        totalCostInclGst: String(totalInclGstFromBase(base)),
      };
    }
    return { pricePerWatt: ppw, totalBaseAmount: '', totalCostInclGst: '' };
  };

  const syncPricingFromBase = (row: CombinedSystemRow, baseStr: string) => {
    const kw = parseFloat(row.capacityKw);
    const base = parseFloat(baseStr);
    if (base > 0 && kw > 0) {
      return {
        totalBaseAmount: baseStr,
        pricePerWatt: (base / (kw * 1000)).toFixed(2),
        totalCostInclGst: String(totalInclGstFromBase(Math.round(base))),
      };
    }
    return { totalBaseAmount: baseStr, pricePerWatt: '', totalCostInclGst: '' };
  };

  const addSystem = () => {
    if (systems.length >= MAX_COMBINED_SYSTEMS) return;
    onChange([...systems, createCombinedSystemRow(systems.length + 1, rowDefaults)]);
  };

  const removeSystem = (id: string) => {
    if (systems.length <= MIN_COMBINED_SYSTEMS) return;
    onChange(systems.filter((s) => s.id !== id));
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Add {MIN_COMBINED_SYSTEMS}–{MAX_COMBINED_SYSTEMS} systems. Each system can have its own connection type
        (residential/commercial), meter phase, and mounting structure.
      </p>

      <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 cursor-pointer hover:border-gray-300 transition-colors">
        <input
          type="checkbox"
          checked={singleCosting}
          onChange={(e) => onSingleCostingChange?.(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <div>
          <span className="text-sm font-semibold text-gray-800">Multiple Systems with Single Costing</span>
          <p className="text-xs text-gray-500 mt-0.5">
            Show each system separately for technical and documentation purposes, but generate one combined commercial offer and ROI.
          </p>
        </div>
      </label>

      {singleCosting && (
        <p className="text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
          Enter capacity and consumer number per system below. Combined pricing is set in the Pricing section.
        </p>
      )}

      {systems.map((row, idx) => (
        <div key={row.id} className="rounded-xl border border-gray-200 p-4 bg-gray-50/50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-800">{row.label || `System ${idx + 1}`}</h4>
            {systems.length > MIN_COMBINED_SYSTEMS && (
              <button
                type="button"
                onClick={() => removeSystem(row.id)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <FieldLabel>System Name</FieldLabel>
              <input
                type="text"
                value={row.label}
                onChange={(e) => update(row.id, { label: e.target.value })}
                className={inputCls}
                placeholder={`System ${idx + 1}`}
              />
            </div>
            <div>
              <FieldLabel>Consumer Number</FieldLabel>
              <input
                type="text"
                value={row.consumerNumber}
                onChange={(e) => update(row.id, { consumerNumber: e.target.value })}
                className={inputCls}
                placeholder="e.g. 123456"
              />
            </div>
            <div>
              <FieldLabel required>Capacity (kW)</FieldLabel>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={row.capacityKw}
                onChange={(e) => {
                  const capacityKw = e.target.value;
                  const next = { ...row, capacityKw };
                  const patch = row.pricePerWatt
                    ? syncPricingFromPpw(next, row.pricePerWatt)
                    : { capacityKw };
                  const kw = parseFloat(capacityKw);
                  const loadPatch =
                    !row.sanctionedLoadIncreasedToManual && Number.isFinite(kw) && kw > 0
                      ? { sanctionedLoadIncreasedToKw: String(kw) }
                      : {};
                  update(row.id, { capacityKw, ...patch, ...loadPatch });
                }}
                className={`${inputCls} text-right tabular-nums`}
              />
            </div>
            {!singleCosting && (
            <>
            <div>
              <FieldLabel required>Price per Watt (₹/W)</FieldLabel>
              <input
                type="number"
                min="1"
                step="0.5"
                value={row.pricePerWatt}
                onChange={(e) => update(row.id, syncPricingFromPpw(row, e.target.value))}
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
                onChange={(e) => update(row.id, syncPricingFromBase(row, e.target.value))}
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
                onChange={(e) => update(row.id, { totalCostInclGst: e.target.value })}
                className={`${inputCls} text-right tabular-nums`}
              />
            </div>
            </>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <FieldLabel>Connection / Meter Type</FieldLabel>
              <select
                value={normalizeConnectionType(row.siteType)}
                onChange={(e) => update(row.id, { siteType: e.target.value as CombinedConnectionType })}
                className={inputCls}
              >
                {COMBINED_CONNECTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-gray-400 mt-1">Residential or commercial meter per system</p>
            </div>
            <div>
              <FieldLabel>Meter Phase</FieldLabel>
              <select
                value={row.meterPhase}
                onChange={(e) => update(row.id, { meterPhase: e.target.value as CombinedMeterPhase })}
                className={inputCls}
              >
                {METER_PHASE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Mounting Structure</FieldLabel>
              <select
                value={row.structureCategory}
                onChange={(e) => {
                  const cat = e.target.value as CombinedStructureCategory;
                  update(row.id, {
                    structureCategory: cat,
                    structureOption: STRUCTURE_OPTIONS[cat]?.[0]?.value ?? '1ft',
                  });
                }}
                className={inputCls}
              >
                {STRUCTURE_CATEGORIES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Structure Option</FieldLabel>
              <select
                value={row.structureOption}
                onChange={(e) => update(row.id, { structureOption: e.target.value })}
                className={inputCls}
              >
                {(STRUCTURE_OPTIONS[row.structureCategory] ?? []).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <FieldLabel>Present Sanctioned Load (kW)</FieldLabel>
              <input
                type="number"
                min="0"
                step="0.5"
                placeholder="e.g. 5"
                value={row.sanctionedLoadKw}
                onChange={(e) => update(row.id, { sanctionedLoadKw: e.target.value })}
                className={`${inputCls} text-right tabular-nums`}
              />
              <p className="text-[10px] text-gray-400 mt-1">Optional — per consumer / meter</p>
            </div>
            <div>
              <FieldLabel>Sanctioned load to be increased to (kW)</FieldLabel>
              <input
                type="number"
                min="0"
                step="0.5"
                placeholder={row.capacityKw || '—'}
                value={row.sanctionedLoadIncreasedToKw}
                onChange={(e) =>
                  update(row.id, {
                    sanctionedLoadIncreasedToKw: e.target.value,
                    sanctionedLoadIncreasedToManual: true,
                  })
                }
                className={`${inputCls} text-right tabular-nums`}
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Defaults to this system&apos;s capacity unless changed
              </p>
            </div>
          </div>

          {(() => {
            const present = parseOptionalSanctionedLoadKw(row.sanctionedLoadKw);
            const kw = parseFloat(row.capacityKw);
            if (present == null || !Number.isFinite(kw) || kw <= 0) return null;
            const sufficient = kw <= present;
            return (
              <div
                className="mt-3 rounded-lg px-3 py-2.5 border text-xs"
                style={{
                  background: sufficient ? '#f0fdf4' : '#fffbeb',
                  borderColor: sufficient ? '#bbf7d0' : '#fde68a',
                  color: sufficient ? '#14532d' : '#78350f',
                }}
              >
                <span className="mr-1.5">{sufficient ? '✅' : '⚠️'}</span>
                <strong>{row.label || `System ${idx + 1}`}:</strong>{' '}
                {sufficient
                  ? 'Present sanctioned load is sufficient for this system.'
                  : 'Present sanctioned load may need to be increased for this system.'}
              </div>
            );
          })()}

          {row.consumerNumber.trim() && (
            <p className="text-xs text-blue-700 mt-2">
              Display: <strong>{row.label} – Consumer No. {row.consumerNumber.trim()}</strong>
            </p>
          )}
        </div>
      ))}

      {systems.length < MAX_COMBINED_SYSTEMS && (
        <button
          type="button"
          onClick={addSystem}
          className="w-full py-2.5 rounded-xl text-sm font-medium border border-dashed border-gray-300 text-gray-600 hover:border-gray-500 hover:bg-white"
        >
          + Add System {systems.length + 1}
        </button>
      )}
    </div>
  );
}
