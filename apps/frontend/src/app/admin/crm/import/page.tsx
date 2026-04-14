'use client';

import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

type ImportRecord = {
  id: string; filename: string; totalRows: number; imported: number;
  duplicates: number; failed: number; status: string;
  createdAt: string; completedAt: string | null;
  errorReport: { row: number; reason: string }[];
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  PROCESSING: 'bg-yellow-100 text-yellow-700',
  DONE: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
};

export default function SheetImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lastImportId, setLastImportId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Poll the last import status
  const { data: importStatus } = useQuery<ImportRecord>({
    queryKey: ['crm', 'import', lastImportId],
    queryFn: () => api<ImportRecord>(`/crm/import/${lastImportId}`),
    enabled: !!lastImportId,
    refetchInterval: (query) => {
      const status = (query.state.data as ImportRecord | undefined)?.status;
      return status === 'PROCESSING' || status === 'PENDING' ? 2000 : false;
    },
  });

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/crm/import/sheet', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { importId: string };
      setLastImportId(data.importId);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const isProcessing = importStatus?.status === 'PROCESSING' || importStatus?.status === 'PENDING';

  return (
    <div className="p-5 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Sheet Import</h1>
        <p className="text-sm text-gray-500 mt-0.5">Upload Excel / CSV files to bulk-import leads. Supports 10,000+ rows.</p>
      </div>

      {/* Upload zone */}
      <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center mb-5">
        <div className="text-4xl mb-3">📥</div>
        <p className="text-sm font-semibold text-gray-700 mb-1">Drop your Excel or CSV file here</p>
        <p className="text-xs text-gray-400 mb-4">Required columns: <code className="bg-gray-100 px-1.5 py-0.5 rounded">name</code>, <code className="bg-gray-100 px-1.5 py-0.5 rounded">phone</code> — optional: email, city, state, kw, language</p>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUpload} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading || isProcessing}
          className="text-sm font-semibold px-6 py-2.5 rounded-xl bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
        >
          {uploading ? 'Uploading…' : isProcessing ? 'Processing…' : 'Choose File'}
        </button>
        {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
      </div>

      {/* Column format guide */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 mb-5">
        <h3 className="text-sm font-semibold text-blue-900 mb-3">Column Format Guide</h3>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="text-blue-700 border-b border-blue-100">
                {['Column', 'Required', 'Example', 'Notes'].map((h) => (
                  <th key={h} className="text-left pb-2 font-semibold pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="text-blue-800">
              {[
                ['name / Name', '✓', 'Rajesh Kumar', 'Customer full name'],
                ['phone / Phone / mobile', '✓', '9876543210', '10-digit Indian mobile'],
                ['email / Email', '—', 'raj@email.com', 'Optional'],
                ['city / City', '—', 'Pune', 'Optional'],
                ['state / State', '—', 'Maharashtra', 'Optional'],
                ['kw / systemKw', '—', '5', 'Desired system size in kW'],
                ['language / Language', '—', 'MR', 'EN / HI / MR (default EN)'],
              ].map(([col, req, ex, note]) => (
                <tr key={col} className="border-b border-blue-50">
                  <td className="py-1.5 pr-4 font-mono font-semibold">{col}</td>
                  <td className="py-1.5 pr-4">{req}</td>
                  <td className="py-1.5 pr-4 font-mono">{ex}</td>
                  <td className="py-1.5 text-blue-600">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import result */}
      {importStatus && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="font-semibold text-gray-900">{importStatus.filename}</span>
              <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[importStatus.status]}`}>
                {importStatus.status}
              </span>
            </div>
            <span className="text-xs text-gray-400">{new Date(importStatus.createdAt).toLocaleString('en-IN')}</span>
          </div>

          {isProcessing && (
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
              <div className="h-full bg-yellow-400 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          )}

          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Total Rows', value: importStatus.totalRows, color: 'text-gray-900' },
              { label: 'Imported', value: importStatus.imported, color: 'text-green-600' },
              { label: 'Duplicates', value: importStatus.duplicates, color: 'text-orange-600' },
              { label: 'Failed', value: importStatus.failed, color: 'text-red-600' },
            ].map((s) => (
              <div key={s.label} className="text-center p-3 bg-gray-50 rounded-xl">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {importStatus.errorReport.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Error Report ({importStatus.errorReport.length} rows)
              </h3>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {importStatus.errorReport.map((e, i) => (
                  <div key={i} className="text-xs flex gap-3 p-2 bg-red-50 rounded-lg">
                    <span className="text-red-500 font-mono">Row {e.row}</span>
                    <span className="text-red-700">{e.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
