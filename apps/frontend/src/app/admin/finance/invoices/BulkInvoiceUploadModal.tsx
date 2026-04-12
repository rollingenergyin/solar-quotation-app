'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFormData, API_URL } from '@/lib/api';

export type BulkParsedRow = {
  rowIndex: number;
  documentNumber: string | null;
  invoiceDate: string | null;
  documentKindRaw: string | null;
  subtypeRaw: string | null;
  consumerName: string | null;
  gstin: string | null;
  systemSizeKw: number | null;
  baseExclGst: number | null;
  templateInput?: string | null;
  clientPhone?: string | null;
  lineDescription?: string | null;
  siteName?: string | null;
  siteAddress?: string | null;
  errors: string[];
  normalized?: {
    rowIndex: number;
    documentNumber: string | null;
    invoiceDate: string;
    mainKind: string;
    subtype: string;
    consumerName: string;
    gstin: string | null;
    systemSizeKw: number;
    baseExclGst: number;
    templateId?: string | null;
    templateInput?: string | null;
    clientPhone?: string | null;
    lineDescription?: string | null;
    siteName?: string | null;
    siteAddress?: string | null;
  };
};

type ParseResult =
  | {
      format: 'xlsx';
      sheetName: string | null;
      rows: BulkParsedRow[];
    }
  | {
      format: 'pdf';
      rows: BulkParsedRow[];
      pdfNeedsManualMapping: boolean;
      pdfNote: string | null;
      textPreview: string | null;
    };

type CreateResult = {
  created: number;
  failed: number;
  results: { rowIndex: number; ok: boolean; invoiceId?: string; error?: string }[];
};

function escapeCsvCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCreateFailuresReport(results: CreateResult['results']) {
  const failed = results.filter((r) => !r.ok);
  if (failed.length === 0) return;
  const header = 'Row,Error';
  const lines = failed.map((r) =>
    [r.rowIndex, escapeCsvCell(r.error ?? '')].join(',')
  );
  const blob = new Blob([header + '\n' + lines.join('\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoice-bulk-create-failures-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadErrorReport(rows: BulkParsedRow[]) {
  const header = [
    'Row',
    'Errors',
    'Document number',
    'Invoice date',
    'Document kind',
    'Subtype',
    'Consumer name',
    'GSTIN',
    'Phone',
    'System size kW',
    'Base amount excl GST',
    'Template / category',
    'Line description',
    'Site name',
    'Site address',
  ].join(',');
  const lines = rows
    .filter((r) => r.errors.length > 0)
    .map((r) =>
      [
        r.rowIndex,
        escapeCsvCell(r.errors.join('; ')),
        escapeCsvCell(r.documentNumber ?? ''),
        escapeCsvCell(r.invoiceDate ?? ''),
        escapeCsvCell(r.documentKindRaw ?? ''),
        escapeCsvCell(r.subtypeRaw ?? ''),
        escapeCsvCell(r.consumerName ?? ''),
        escapeCsvCell(r.gstin ?? ''),
        escapeCsvCell(r.clientPhone ?? ''),
        r.systemSizeKw ?? '',
        r.baseExclGst ?? '',
        escapeCsvCell(r.templateInput ?? ''),
        escapeCsvCell(r.lineDescription ?? ''),
        escapeCsvCell(r.siteName ?? ''),
        escapeCsvCell(r.siteAddress ?? ''),
      ].join(',')
    );
  const blob = new Blob([header + '\n' + lines.join('\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoice-bulk-errors-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function bulkCreateRequest(
  rows: NonNullable<BulkParsedRow['normalized']>[]
): Promise<CreateResult> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const res = await fetch(`${API_URL}/finance/invoices/bulk/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ rows, skipInvalidRows: false }),
      credentials: 'include',
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as CreateResult & {
      error?: string;
      failures?: { rowIndex: number; errors: string[] }[];
    };
    if (!res.ok) {
      if (data.failures && data.failures.length > 0) {
        const lines = data.failures.map(
          (f) => `Row ${f.rowIndex}: ${f.errors.join('; ')}`
        );
        throw new Error([data.error ?? 'Validation failed', ...lines].join('\n'));
      }
      const msg = typeof data.error === 'string' ? data.error : res.statusText;
      throw new Error(msg);
    }
    return data as CreateResult;
  } finally {
    clearTimeout(timeout);
  }
}

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function BulkInvoiceUploadModal({ open, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<'idle' | 'preview' | 'done'>('idle');
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [createResult, setCreateResult] = useState<CreateResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [skipInvalidRows, setSkipInvalidRows] = useState(false);

  const reset = useCallback(() => {
    setStep('idle');
    setParseResult(null);
    setCreateResult(null);
    setLocalError(null);
    setSkipInvalidRows(false);
    setParsing(false);
    setCreating(false);
  }, []);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setLocalError(null);
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await apiFormData<ParseResult>('/finance/invoices/bulk/parse', fd);
      setParseResult(data);
      setStep('preview');
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Parse failed');
    } finally {
      setParsing(false);
    }
  };

  const rows = parseResult?.rows ?? [];
  const validRows = rows.filter((r) => r.normalized);
  const invalidRows = rows.filter((r) => r.errors.length > 0);
  const canCreate =
    validRows.length > 0 && (invalidRows.length === 0 || skipInvalidRows);

  const runCreate = async () => {
    const toSend = validRows.map((r) => r.normalized!);
    if (toSend.length === 0) {
      setLocalError('No valid rows to create. Fix the spreadsheet or use XLSX with all required columns.');
      return;
    }
    setLocalError(null);
    setCreating(true);
    try {
      const result = await bulkCreateRequest(toSend);
      setCreateResult(result);
      setStep('done');
      onSuccess();
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Bulk create failed');
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-upload-title"
        className="w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl bg-white shadow-xl border border-gray-200"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 id="bulk-upload-title" className="text-lg font-semibold text-gray-900">
            Bulk upload invoices
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-800 text-sm font-medium"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {localError && (
            <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800 whitespace-pre-wrap">
              {localError}
            </div>
          )}

          {step === 'idle' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Upload an <strong>XLSX</strong> with columns: Document number, Invoice Date, Document kind (Tax /
                Proforma / Quotation), Subtype (SPGS / Service / Product), Consumer Name, Total system size (kW
                DC), <strong>Base amount (excl. GST)</strong> — taxable value before GST; totals are computed with your
                usual invoice logic.                 Optional columns (leave cells blank to keep the invoice field blank):{' '}
                <strong>GSTIN</strong> (if blank, client is matched or created by name without GSTIN),{' '}
                <strong>Phone</strong> (saved on client), <strong>Invoice template</strong> / <strong>Category</strong>,{' '}
                <strong>Line description</strong> (Service/Product lines only), <strong>Site name</strong> /{' '}
                <strong>Site address</strong> (SPGS only). Optional: <strong>PDF</strong> — limited extraction; prefer
                XLSX for full rows.
              </p>
              <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/80 px-6 py-10 cursor-pointer hover:border-blue-300 transition">
                <input
                  type="file"
                  accept=".xlsx,.xls,.pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf"
                  className="sr-only"
                  disabled={parsing}
                  onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
                />
                <span className="text-sm font-medium text-blue-600">
                  {parsing ? 'Reading file…' : 'Choose .xlsx or .pdf'}
                </span>
                <span className="text-xs text-gray-500">Max 15 MB</span>
              </label>
            </div>
          )}

          {step === 'preview' && parseResult && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                <span className="font-medium text-gray-800">
                  {parseResult.format === 'xlsx' ? 'Spreadsheet' : 'PDF'}
                </span>
                {parseResult.format === 'xlsx' && parseResult.sheetName && (
                  <span>Sheet: {parseResult.sheetName}</span>
                )}
                <span>
                  {rows.length} row{rows.length === 1 ? '' : 's'} · {validRows.length} valid
                  {invalidRows.length > 0 ? ` · ${invalidRows.length} with issues` : ''}
                </span>
              </div>

              {parseResult.format === 'pdf' && parseResult.pdfNote && (
                <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-sm text-amber-900">
                  {parseResult.pdfNote}
                  {parseResult.textPreview && (
                    <pre className="mt-2 text-xs text-amber-800/90 whitespace-pre-wrap max-h-32 overflow-auto">
                      {parseResult.textPreview.slice(0, 800)}
                      {parseResult.textPreview.length > 800 ? '…' : ''}
                    </pre>
                  )}
                </div>
              )}

              {rows.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 text-left text-gray-700">
                      <tr>
                        <th className="px-2 py-2 font-semibold">#</th>
                        <th className="px-2 py-2 font-semibold">Doc no</th>
                        <th className="px-2 py-2 font-semibold">Date</th>
                        <th className="px-2 py-2 font-semibold">Kind</th>
                        <th className="px-2 py-2 font-semibold">Subtype</th>
                        <th className="px-2 py-2 font-semibold">Client</th>
                        <th className="px-2 py-2 font-semibold">GSTIN</th>
                        <th className="px-2 py-2 font-semibold">Phone</th>
                        <th className="px-2 py-2 font-semibold text-right">kW</th>
                        <th className="px-2 py-2 font-semibold text-right">Base (excl.)</th>
                        <th className="px-2 py-2 font-semibold max-w-[100px]">Template</th>
                        <th className="px-2 py-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r) => (
                        <tr
                          key={r.rowIndex}
                          className={r.errors.length > 0 ? 'bg-red-50/80' : 'bg-white'}
                        >
                          <td className="px-2 py-1.5 tabular-nums">{r.rowIndex}</td>
                          <td className="px-2 py-1.5">{r.documentNumber ?? '—'}</td>
                          <td className="px-2 py-1.5">{r.invoiceDate ?? '—'}</td>
                          <td className="px-2 py-1.5">{r.documentKindRaw ?? '—'}</td>
                          <td className="px-2 py-1.5">{r.subtypeRaw ?? '—'}</td>
                          <td className="px-2 py-1.5 max-w-[140px] truncate" title={r.consumerName ?? ''}>
                            {r.consumerName ?? '—'}
                          </td>
                          <td className="px-2 py-1.5 font-mono text-[11px]">{r.gstin ?? '—'}</td>
                          <td className="px-2 py-1.5 max-w-[88px] truncate text-[11px]" title={r.clientPhone ?? ''}>
                            {r.clientPhone ?? ''}
                          </td>
                          <td className="px-2 py-1.5 text-right">{r.systemSizeKw ?? '—'}</td>
                          <td className="px-2 py-1.5 text-right">{r.baseExclGst ?? '—'}</td>
                          <td className="px-2 py-1.5 max-w-[100px] truncate text-[11px]" title={r.templateInput ?? ''}>
                            {r.templateInput ?? '—'}
                          </td>
                          <td className="px-2 py-1.5">
                            {r.errors.length > 0 ? (
                              <span className="text-red-700">{r.errors.join('; ')}</span>
                            ) : (
                              <span className="text-emerald-700">OK</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {invalidRows.length > 0 && (
                <div className="flex flex-wrap items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={skipInvalidRows}
                      onChange={(e) => setSkipInvalidRows(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    Skip rows with errors (create only valid rows)
                  </label>
                  <button
                    type="button"
                    onClick={() => downloadErrorReport(rows)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800"
                  >
                    Download error report (CSV)
                  </button>
                </div>
              )}

              {creating && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                  Creating invoices…
                </div>
              )}
            </div>
          )}

          {step === 'done' && createResult && (
            <div className="space-y-2 text-sm">
              <p className="font-medium text-gray-900">
                Done: <span className="text-emerald-700">{createResult.created} created</span>
                {createResult.failed > 0 && (
                  <span className="text-red-700"> · {createResult.failed} failed</span>
                )}
              </p>
              {createResult.failed > 0 && (
                <button
                  type="button"
                  onClick={() => downloadCreateFailuresReport(createResult.results)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  Download failure report (CSV)
                </button>
              )}
              <ul className="max-h-48 overflow-y-auto text-gray-600 space-y-1">
                {createResult.results.map((r) => (
                  <li key={`${r.rowIndex}-${r.ok}`}>
                    Row {r.rowIndex}:{' '}
                    {r.ok ? (
                      <span className="text-emerald-700">created {r.invoiceId?.slice(-8)}</span>
                    ) : (
                      <span className="text-red-700">{r.error}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50/80">
          {step === 'preview' && (
            <>
              <button
                type="button"
                onClick={() => {
                  reset();
                  setStep('idle');
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!canCreate || creating || validRows.length === 0}
                onClick={() => void runCreate()}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating…' : `Create ${validRows.length} invoice${validRows.length === 1 ? '' : 's'}`}
              </button>
            </>
          )}
          {step === 'done' && (
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
