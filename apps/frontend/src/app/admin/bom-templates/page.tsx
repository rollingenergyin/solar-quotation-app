'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { createBomItem, serializeBomItems } from '@/constants/bom-items';
import type { BomTemplateRecord, TemplateBomItem } from '@/types/quotation-template';
import BomItemsEditor from '@/components/quick-quote/BomItemsEditor';

interface ManagedBomTemplate extends BomTemplateRecord {
  isActive: boolean;
  isDefault: boolean;
  displayOrder: number;
}

interface EditorState {
  id: string | null;
  name: string;
  description: string;
  title: string;
  items: TemplateBomItem[];
}

const emptyEditor = (): EditorState => ({
  id: null,
  name: '',
  description: '',
  title: '',
  items: [createBomItem(1)],
});

const inputCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-yellow-400';

export default function BomTemplatesAdminPage() {
  const [templates, setTemplates] = useState<ManagedBomTemplate[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setTemplates(await api<ManagedBomTemplate[]>('/templates/bom-library/manage'));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load BOM templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const editTemplate = (template: ManagedBomTemplate) => {
    setEditor({
      id: template.id,
      name: template.name,
      description: template.description ?? '',
      title: template.title,
      items: template.items.map((item) => ({
        ...item,
        alternatives: item.alternatives?.map((alternative) => ({ ...alternative })),
      })),
    });
  };

  const save = async () => {
    if (!editor) return;
    if (!editor.name.trim()) {
      setError('Template name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body = JSON.stringify({
        name: editor.name.trim(),
        description: editor.description.trim() || null,
        title: editor.title.trim() || editor.name.trim(),
        items: serializeBomItems(editor.items),
      });
      await api(
        editor.id ? `/templates/bom-library/${editor.id}` : '/templates/bom-library',
        { method: editor.id ? 'PUT' : 'POST', body },
      );
      setEditor(null);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (id: string, path: string, options: RequestInit) => {
    setBusyId(id);
    setError('');
    try {
      await api(path, options);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= templates.length) return;
    const reordered = [...templates];
    [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
    setTemplates(reordered);
    try {
      await api('/templates/bom-library/order', {
        method: 'PUT',
        body: JSON.stringify({ templateIds: reordered.map((template) => template.id) }),
      });
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : 'Failed to update order');
      await load();
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-5 md:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">BOM Templates</h1>
          <p className="mt-1 text-sm text-gray-500">
            Master templates available in all single and combined quotations.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditor(emptyEditor())}
          className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
        >
          + Create BOM Template
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {editor && (
        <section className="mb-6 rounded-xl border border-yellow-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              {editor.id ? 'Edit BOM Template' : 'Create BOM Template'}
            </h2>
            <button type="button" onClick={() => setEditor(null)} className="text-sm text-gray-500">
              Close
            </button>
          </div>
          <div className="mb-5 grid gap-4 md:grid-cols-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Template Name
              <input
                value={editor.name}
                onChange={(event) => setEditor({ ...editor, name: event.target.value })}
                className={`${inputCls} mt-1.5`}
                placeholder="Premium Residential"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Quotation Option Title
              <input
                value={editor.title}
                onChange={(event) => setEditor({ ...editor, title: event.target.value })}
                className={`${inputCls} mt-1.5`}
                placeholder="Option 1 – Premium Components"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:col-span-2">
              Description
              <textarea
                value={editor.description}
                onChange={(event) => setEditor({ ...editor, description: event.target.value })}
                className={`${inputCls} mt-1.5 min-h-20`}
                placeholder="Where and when sales users should choose this template"
              />
            </label>
          </div>
          <BomItemsEditor
            items={editor.items}
            onChange={(items) => setEditor({ ...editor, items })}
          />
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setEditor(null)} className="rounded-lg border px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="rounded-lg bg-yellow-500 px-5 py-2 text-sm font-semibold text-gray-900 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Template'}
            </button>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-8 text-center text-sm text-gray-500">Loading BOM templates…</p>
        ) : templates.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">No BOM templates found.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {templates.map((template, index) => (
              <div key={template.id} className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => void move(index, -1)}
                    className="rounded border px-2 py-1 text-xs disabled:opacity-30"
                    aria-label={`Move ${template.name} up`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={index === templates.length - 1}
                    onClick={() => void move(index, 1)}
                    className="rounded border px-2 py-1 text-xs disabled:opacity-30"
                    aria-label={`Move ${template.name} down`}
                  >
                    ↓
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{template.name}</h3>
                    {template.isDefault && (
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-800">
                        Default
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      template.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {template.isActive ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {template.description || 'No description'}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {template.items.length} items · {template.title}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => editTemplate(template)} className="rounded-lg border px-3 py-2 text-xs font-semibold">
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busyId === template.id}
                    onClick={() => void runAction(
                      template.id,
                      `/templates/bom-library/${template.id}/duplicate`,
                      { method: 'POST' },
                    )}
                    className="rounded-lg border px-3 py-2 text-xs font-semibold"
                  >
                    Duplicate
                  </button>
                  {!template.isDefault && (
                    <button
                      type="button"
                      disabled={busyId === template.id}
                      onClick={() => void runAction(
                        template.id,
                        `/templates/bom-library/${template.id}/default`,
                        { method: 'POST' },
                      )}
                      className="rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs font-semibold text-yellow-800"
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={template.isDefault || busyId === template.id}
                    onClick={() => void runAction(
                      template.id,
                      `/templates/bom-library/${template.id}/status`,
                      {
                        method: 'PATCH',
                        body: JSON.stringify({ isActive: !template.isActive }),
                      },
                    )}
                    className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40"
                  >
                    {template.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    disabled={template.isDefault || busyId === template.id}
                    onClick={() => {
                      if (confirm(`Delete "${template.name}"?`)) {
                        void runAction(
                          template.id,
                          `/templates/bom-library/${template.id}`,
                          { method: 'DELETE' },
                        );
                      }
                    }}
                    className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
