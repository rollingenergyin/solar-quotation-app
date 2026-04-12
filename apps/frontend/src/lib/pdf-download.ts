/** Prefer RFC 5987 filename* (UTF-8); fall back to quoted filename. */
export function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      /* fall through */
    }
  }
  const q = /filename="((?:\\.|[^"\\])*)"/.exec(header);
  if (q) return q[1].replace(/\\"/g, '"');
  const plain = /filename=([^;\s]+)/i.exec(header);
  if (plain) return plain[1].replace(/^["']|["']$/g, '');
  return null;
}

/**
 * Fetches invoice PDF and saves with the server-provided filename (Invoice … kW … FY.pdf).
 */
export async function downloadFinanceInvoicePdf(invoiceId: string): Promise<void> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(`/api/finance/invoices/${invoiceId}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || 'PDF failed');
  }
  const blob = await res.blob();
  const suggested = filenameFromContentDisposition(res.headers.get('content-disposition'));
  const fallback = `invoice-${invoiceId.slice(-8)}.pdf`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggested && suggested.endsWith('.pdf') ? suggested : fallback;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Download PDF with mobile-friendly fallback.
 * Some mobile browsers block programmatic download; we open in new tab as fallback.
 */
export async function downloadQuotationPdf(
  id: string,
  quoteNumber?: string,
  onError?: (msg: string) => void
): Promise<void> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const filename = quoteNumber ? `${quoteNumber}.pdf` : 'quotation.pdf';

  try {
    const res = await fetch('/api/quotations/pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ id }),
    });

    if (!res.ok) {
      throw new Error('Failed to generate PDF');
    }

    const blob = await res.blob();

    if (!blob || blob.size === 0) {
      throw new Error('Empty PDF');
    }

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    // Mobile fallback: some phones block auto-download, open in new tab so user can view/save
    const isMobile = /iPhone|iPad|Android|webOS|Mobile/i.test(navigator.userAgent);
    if (isMobile) {
      window.open(url, '_blank');
      // Delay revoke so the new tab can load the blob
      setTimeout(() => window.URL.revokeObjectURL(url), 5000);
    } else {
      window.URL.revokeObjectURL(url);
    }
  } catch (err) {
    console.error('PDF DOWNLOAD ERROR:', err);
    const msg = err instanceof Error ? err.message : 'Failed to download PDF';
    if (onError) onError(msg);
    else alert(msg);
  }
}
