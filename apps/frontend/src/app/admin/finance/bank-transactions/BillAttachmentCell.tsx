'use client';

import { useRef, useState } from 'react';
import { API_URL } from '@/lib/api';

export interface LinkedFinanceBill {
  id: string;
  fileUrl: string | null;
  invoiceNo: string;
}

function fileLabel(fileUrl: string | null): string {
  if (!fileUrl) return 'file';
  const seg = fileUrl.split('/').pop() ?? 'file';
  return seg.length > 28 ? `…${seg.slice(-24)}` : seg;
}

async function authHeaders(): Promise<HeadersInit> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const h: Record<string, string> = {};
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export default function BillAttachmentCell({
  transactionId,
  splitId,
  purchaseBill,
  salesBill,
  onUpdated,
  disabled,
}: {
  transactionId: string;
  splitId?: string;
  purchaseBill?: LinkedFinanceBill | null;
  salesBill?: LinkedFinanceBill | null;
  onUpdated: () => void;
  /** Parent row when split: no attach (bills are per split line). */
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const bill = purchaseBill ?? salesBill ?? null;
  const hasFile = !!(bill?.fileUrl);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (splitId) fd.append('splitId', splitId);
      const res = await fetch(`${API_URL}/finance/bank-transactions/${transactionId}/bill`, {
        method: 'POST',
        headers: await authHeaders(),
        body: fd,
        credentials: 'include',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || res.statusText);
      }
      onUpdated();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!hasFile) return;
    if (!window.confirm('Remove this attachment?')) return;
    setBusy(true);
    try {
      const q = splitId ? `?splitId=${encodeURIComponent(splitId)}` : '';
      const res = await fetch(`${API_URL}/finance/bank-transactions/${transactionId}/bill${q}`, {
        method: 'DELETE',
        headers: await authHeaders(),
        credentials: 'include',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || res.statusText);
      }
      onUpdated();
    } finally {
      setBusy(false);
    }
  };

  const view = async () => {
    const url = bill?.fileUrl;
    if (!url) return;
    const path = url.startsWith('/api') ? url : `/api${url}`;
    setBusy(true);
    try {
      const res = await fetch(path, {
        headers: await authHeaders(),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Could not open file');
      const blob = await res.blob();
      const u = URL.createObjectURL(blob);
      window.open(u, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(u), 60_000);
    } finally {
      setBusy(false);
    }
  };

  if (disabled) {
    return (
      <div
        className="flex flex-col gap-0.5 min-w-[100px] rounded border border-transparent bg-gray-50 px-2 py-1 text-xs text-gray-400"
        title={hasFile ? 'Attachment is set on split lines below' : 'Attach a bill on each split line'}
      >
        {hasFile ? (
          <button
            type="button"
            className="text-left text-[10px] text-blue-600 hover:underline disabled:opacity-40"
            disabled={busy}
            onClick={() => void view()}
          >
            View existing
          </button>
        ) : (
          <span>—</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 min-w-[100px]">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpeg,.jpg,.heic,.heif,application/pdf,image/png,image/jpeg,image/heic"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void upload(f);
        }}
      />
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="text-base leading-none p-0.5 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-40"
          title={hasFile ? 'Replace attachment' : 'Attach bill'}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          📎
        </button>
        {hasFile && (
          <span className="text-[10px] text-gray-600 truncate max-w-[72px]" title={fileLabel(bill.fileUrl)}>
            {fileLabel(bill.fileUrl)}
          </span>
        )}
      </div>
      {hasFile && (
        <div className="flex flex-wrap gap-1 text-[10px]">
          <button type="button" className="text-blue-600 hover:underline" disabled={busy} onClick={() => void view()}>
            View
          </button>
          <button
            type="button"
            className="text-gray-600 hover:underline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            Replace
          </button>
          <button type="button" className="text-red-600 hover:underline" disabled={busy} onClick={() => void remove()}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
