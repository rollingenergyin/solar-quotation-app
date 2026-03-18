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
    const res = await fetch(`/api/quotations/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
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
