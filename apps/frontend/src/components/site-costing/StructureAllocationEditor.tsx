'use client';

import {
  CUSTOM_INSTALLATION_LOCATION_OPTIONS,
  CUSTOM_RAISE_HEIGHT_OPTIONS,
  INSTALLATION_LOCATION_OPTIONS,
  RAISE_HEIGHT_OPTIONS,
  STRUCTURE_TYPE_OPTIONS,
  applyStructureEntryDefaults,
  calcEntryCapacityKw,
  createDefaultStructureEntry,
  defaultPanelsForEntry,
  formatStructureEntryLabel,
  isFixedStructureType,
  type StructureAllocationEntry,
  type StructureAllocationSummary,
} from '@/constants/structure-allocation';

const selectCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300';
const qtyCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-right tabular-nums bg-white focus:outline-none focus:ring-2 focus:ring-blue-300';

interface Props {
  entries: StructureAllocationEntry[];
  panelWattageWp: number;
  totalPanels: number;
  structureSummary?: StructureAllocationSummary | null;
  onChange: (entries: StructureAllocationEntry[]) => void;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
      {children}
    </label>
  );
}

function QtyStepper({
  value,
  min = 0,
  max,
  disablePlus = false,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  disablePlus?: boolean;
  onChange: (n: number) => void;
}) {
  const clamp = (n: number) => {
    let v = Math.max(min, n);
    if (max != null) v = Math.min(max, v);
    return v;
  };
  const plusDisabled = disablePlus || (max != null && value >= max);

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        className="w-9 h-9 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-bold disabled:opacity-30 disabled:cursor-not-allowed"
      >
        −
      </button>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(clamp(parseInt(e.target.value, 10) || 0))}
        className={`${qtyCls} flex-1`}
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={plusDisabled}
        className="w-9 h-9 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-bold disabled:opacity-30 disabled:cursor-not-allowed"
      >
        +
      </button>
    </div>
  );
}

export default function StructureAllocationEditor({
  entries,
  panelWattageWp,
  totalPanels,
  structureSummary,
  onChange,
}: Props) {
  const allocatedPanels = entries.reduce((s, e) => s + (parseInt(e.numPanels, 10) || 0), 0);
  const panelMismatch =
    allocatedPanels > 0 && totalPanels > 0 && allocatedPanels !== totalPanels;

  const updateEntry = (id: string, patch: Partial<StructureAllocationEntry>) => {
    onChange(
      entries.map((e) =>
        e.id === id ? applyStructureEntryDefaults(e, patch) : e,
      ),
    );
  };

  const removeEntry = (id: string) => {
    if (entries.length <= 1) return;
    onChange(entries.filter((e) => e.id !== id));
  };

  const addEntry = () => {
    onChange([...entries, createDefaultStructureEntry()]);
  };

  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  return (
    <div className="space-y-4">
      {entries.map((entry, index) => {
        const panels = parseInt(entry.numPanels, 10) || 0;
        const fixedType = isFixedStructureType(entry.structureType);
        const maxPanels = defaultPanelsForEntry(entry);
        const capacityKw = calcEntryCapacityKw(panels, panelWattageWp);
        const costRow = structureSummary?.entries.find((e) => e.id === entry.id);

        return (
          <div
            key={entry.id}
            className="rounded-xl border border-gray-200 bg-gray-50/60 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-white">
              <p className="text-sm font-semibold text-gray-800">
                Structure {index + 1}
              </p>
              <div className="flex items-center gap-2">
                {costRow && (
                  <span className="text-xs font-medium text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full">
                    {fmt(costRow.totalCost)}
                  </span>
                )}
                {entries.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeEntry(entry.id)}
                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Structure Type</FieldLabel>
                <select
                  value={entry.structureType}
                  onChange={(e) =>
                    updateEntry(entry.id, {
                      structureType: e.target.value as StructureAllocationEntry['structureType'],
                    })
                  }
                  className={selectCls}
                >
                  {STRUCTURE_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {entry.structureType === 'CUSTOM' && (
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="Custom ₹/W"
                    value={entry.customStructurePricePerWatt}
                    onChange={(e) =>
                      updateEntry(entry.id, { customStructurePricePerWatt: e.target.value })
                    }
                    className={`${qtyCls} mt-2`}
                  />
                )}
              </div>

              <div>
                <FieldLabel>Installation Location</FieldLabel>
                <select
                  value={entry.installationLocation}
                  onChange={(e) =>
                    updateEntry(entry.id, {
                      installationLocation: e.target
                        .value as StructureAllocationEntry['installationLocation'],
                    })
                  }
                  className={selectCls}
                >
                  {INSTALLATION_LOCATION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {entry.installationLocation === 'CUSTOM' && (
                  <select
                    value={entry.customInstallationLocation}
                    onChange={(e) =>
                      updateEntry(entry.id, { customInstallationLocation: e.target.value })
                    }
                    className={`${selectCls} mt-2`}
                  >
                    {CUSTOM_INSTALLATION_LOCATION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <FieldLabel>Raise Height</FieldLabel>
                <select
                  value={entry.raiseHeight}
                  onChange={(e) =>
                    updateEntry(entry.id, {
                      raiseHeight: e.target.value as StructureAllocationEntry['raiseHeight'],
                    })
                  }
                  className={selectCls}
                >
                  {RAISE_HEIGHT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {entry.raiseHeight === 'CUSTOM' && (
                  <select
                    value={entry.customRaiseHeightFt}
                    onChange={(e) =>
                      updateEntry(entry.id, { customRaiseHeightFt: e.target.value })
                    }
                    className={`${selectCls} mt-2`}
                  >
                    {CUSTOM_RAISE_HEIGHT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <FieldLabel>Number of Structures</FieldLabel>
                <QtyStepper
                  value={parseInt(entry.numStructures, 10) || 1}
                  min={1}
                  onChange={(n) => updateEntry(entry.id, { numStructures: String(n) })}
                />
              </div>

              <div>
                <FieldLabel>
                  Panels on this Structure
                  {fixedType && maxPanels != null && (
                    <span className="normal-case font-normal text-gray-400 ml-1">
                      (max {maxPanels})
                    </span>
                  )}
                </FieldLabel>
                <QtyStepper
                  value={panels}
                  min={0}
                  max={fixedType ? maxPanels ?? undefined : undefined}
                  onChange={(n) => updateEntry(entry.id, { numPanels: String(n) })}
                />
              </div>

              <div>
                <FieldLabel>Capacity (auto)</FieldLabel>
                <div className="h-[42px] flex items-center justify-end px-3 rounded-lg border border-dashed border-gray-200 bg-white text-sm font-semibold text-gray-700 tabular-nums">
                  {capacityKw > 0 ? `${capacityKw} kW` : '—'}
                </div>
              </div>
            </div>

            <div className="px-4 pb-3">
              <p className="text-xs text-gray-500 italic">
                {formatStructureEntryLabel(entry, panelWattageWp)}
              </p>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addEntry}
        className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm font-semibold text-gray-600 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50/50 transition-colors"
      >
        + Add Structure
      </button>

      {panelMismatch && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          Panel allocation ({allocatedPanels}) differs from system total ({totalPanels}). Leave
          panels blank to auto-distribute across structures.
        </p>
      )}

      {structureSummary && structureSummary.entries.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white p-4 text-sm space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Structure Cost Summary
          </p>
          <div className="flex justify-between">
            <span className="text-gray-600">Fabrication</span>
            <span className="font-medium">{fmt(structureSummary.totalFabricationCost)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Structure</span>
            <span className="font-medium">{fmt(structureSummary.totalStructureCost)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Raised structure premium</span>
            <span className="font-medium">{fmt(structureSummary.totalRaisedStructureCost)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-100 font-semibold">
            <span>Combined total</span>
            <span style={{ color: '#161c34' }}>{fmt(structureSummary.totalCost)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
