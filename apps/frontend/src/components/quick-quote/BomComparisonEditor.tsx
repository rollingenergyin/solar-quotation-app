'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type {
  BomTemplateRecord,
  QuotationBomOption,
  TemplateBomItem,
} from '@/types/quotation-template';
import {
  createQuotationBomOption,
  MAX_QUOTATION_BOM_OPTIONS,
} from '@/constants/bom-items';
import BomItemsEditor from './BomItemsEditor';

interface BomLibraryResponse {
  defaultTemplate: BomTemplateRecord;
  templates: BomTemplateRecord[];
}

interface Props {
  options: QuotationBomOption[];
  onChange: (options: QuotationBomOption[]) => void;
  systemType: 'DCR' | 'NON_DCR';
  siteType: 'RESIDENTIAL' | 'SOCIETY' | 'COMMERCIAL' | 'INDUSTRIAL';
}

const selectCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300';
const inputCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300';

function cloneItems(items: TemplateBomItem[]): TemplateBomItem[] {
  return items.map((item, index) => ({
    ...item,
    srNo: index + 1,
    alternatives: item.alternatives?.map((alternative) => ({ ...alternative })),
  }));
}

export default function BomComparisonEditor({
  options,
  onChange,
  systemType,
  siteType,
}: Props) {
  const [library, setLibrary] = useState<BomLibraryResponse | null>(null);
  const [libraryKey, setLibraryKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingIds, setEditingIds] = useState<Record<string, boolean>>({});
  const [addingAlternate, setAddingAlternate] = useState(false);
  const hydratedDefaultFor = useRef<string | null>(null);

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api<BomLibraryResponse>(
        `/templates/bom-library?systemType=${systemType}&siteType=${siteType}`,
      );
      setLibrary(result);
      setLibraryKey(`${systemType}:${siteType}`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load BOM templates');
    } finally {
      setLoading(false);
    }
  }, [siteType, systemType]);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  useEffect(() => {
    if (!library) return;
    const key = `${systemType}:${siteType}`;
    if (libraryKey !== key) return;
    if (hydratedDefaultFor.current === key) return;
    hydratedDefaultFor.current = key;
    const primary = options[0];
    if (!primary || primary.templateId !== 'default') return;
    onChange([
      {
        ...primary,
        templateId: library.defaultTemplate.id,
        templateName: library.defaultTemplate.name,
        title: library.defaultTemplate.title || primary.title,
        items: cloneItems(library.defaultTemplate.items),
      },
      ...options.slice(1),
    ]);
  }, [library, libraryKey, onChange, options, siteType, systemType]);

  const updateOption = (id: string, patch: Partial<QuotationBomOption>) => {
    onChange(options.map((option) => (option.id === id ? { ...option, ...patch } : option)));
  };

  const selectTemplate = (option: QuotationBomOption, templateId: string) => {
    const template =
      templateId === 'default'
        ? library?.defaultTemplate
        : library?.templates.find((entry) => entry.id === templateId);
    if (!template) return;

    updateOption(option.id, {
      templateId: template.id,
      templateName: template.name,
      title: template.title || option.title,
      items: cloneItems(template.items),
    });
  };

  const addAlternateFromTemplate = (templateId: string) => {
    if (options.length >= MAX_QUOTATION_BOM_OPTIONS) return;
    const template =
      templateId === 'default'
        ? library?.defaultTemplate
        : library?.templates.find((entry) => entry.id === templateId);
    if (!template) return;

    onChange([
      ...options,
      createQuotationBomOption(
        2,
        cloneItems(template.items),
        {
          id: template.id,
          name: template.name,
          title: template.title || 'Option 2 – Value Engineering Option',
        },
      ),
    ]);
    setAddingAlternate(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Select an admin-managed template for each option. Edit BOM creates changes for this
        quotation only and never changes the master template.
      </p>

      {loading && <p className="text-xs text-gray-400">Loading BOM templates…</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {options.map((option, index) => (
        <div key={option.id}>
          {index > 0 && (
            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-blue-100" />
              <span className="rounded-full bg-[#161c34] px-3 py-1 text-[10px] font-bold tracking-widest text-white">
                OR
              </span>
              <div className="h-px flex-1 bg-blue-100" />
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">BOM Option {index + 1}</p>
                <p className="text-xs text-gray-400">{option.templateName}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingIds((current) => ({
                    ...current,
                    [option.id]: !current[option.id],
                  }))}
                  className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                >
                  {editingIds[option.id] ? 'Close Edit' : 'Edit BOM'}
                </button>
              {index === 1 && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(options.filter((entry) => entry.id !== option.id));
                    setEditingIds((current) => {
                      const next = { ...current };
                      delete next[option.id];
                      return next;
                    });
                  }}
                  className="text-xs font-medium text-red-500 hover:text-red-700"
                >
                  Remove Alternate BOM
                </button>
              )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs font-semibold text-gray-500 mb-1">
                  Select Existing BOM Template
                </span>
                <select
                  value={
                    option.templateId === library?.defaultTemplate.id
                      ? 'default'
                      : option.templateId ?? 'quotation-copy'
                  }
                  onChange={(event) => selectTemplate(option, event.target.value)}
                  className={selectCls}
                >
                  <option value="default">
                    {library?.defaultTemplate.name ?? 'Default BOM'}
                  </option>
                  {library?.templates.map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                  {!option.templateId && (
                    <option value="quotation-copy" disabled>Quotation-specific BOM</option>
                  )}
                </select>
                {(() => {
                  const selected = option.templateId === library?.defaultTemplate.id
                    ? library?.defaultTemplate
                    : library?.templates.find((template) => template.id === option.templateId);
                  return selected?.description ? (
                    <span className="mt-1 block text-[11px] text-gray-400">
                      {selected.description}
                    </span>
                  ) : null;
                })()}
              </label>

              <label className="block">
                <span className="block text-xs font-semibold text-gray-500 mb-1">
                  Quotation Option Title
                </span>
                <input
                  value={option.title}
                  onChange={(event) => updateOption(option.id, { title: event.target.value })}
                  className={inputCls}
                  placeholder={`Option ${index + 1} – Components`}
                />
              </label>
            </div>

            {editingIds[option.id] && (
              <div className="space-y-4 rounded-xl border border-blue-100 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  Edit quotation copy — BOM Option {index + 1}
                </p>
                <p className="text-xs text-gray-500">
                  These edits are saved only with this quotation.
                </p>
                <BomItemsEditor
                  items={option.items}
                  onChange={(items) => updateOption(option.id, { items })}
                />
              </div>
            )}
          </div>
        </div>
      ))}

      {options.length < MAX_QUOTATION_BOM_OPTIONS && (
        addingAlternate ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">Select Alternate BOM Template</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Selecting a template adds it immediately. You can optionally use Edit BOM afterward.
              </p>
            </div>
            <select
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) addAlternateFromTemplate(event.target.value);
              }}
              className={selectCls}
              autoFocus
            >
              <option value="" disabled>Choose a BOM template…</option>
              <option value="default">Default BOM Template</option>
              {library?.templates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setAddingAlternate(false)}
              className="text-xs font-semibold text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingAlternate(true)}
            className="w-full rounded-xl border-2 border-dashed border-blue-200 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50"
          >
            + Add Alternate BOM
          </button>
        )
      )}
    </div>
  );
}
