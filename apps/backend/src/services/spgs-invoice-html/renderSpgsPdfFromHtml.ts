import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { getBrowser } from '../pdf-generation.service.js';
import type { SpgsPdfInput } from '../invoice-pdf-spgs-types.js';
import { getInvoiceBranding } from '../invoice-branding.js';
import type { InvoiceTemplateConfigV1 } from '../invoice-template-config.js';
import { buildSpgsInvoiceHtmlDocument } from './spgsInvoiceHtmlDocument.js';

/** Embed Rolling Energy logo when `frontend/public/logo-main.png` exists. */
export function resolveInvoiceLogoDataUrl(): string | undefined {
  const candidates = [
    path.join(process.cwd(), '..', 'frontend', 'public', 'logo-main.png'),
    path.join(process.cwd(), 'public', 'logo-main.png'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      const buf = readFileSync(p);
      return `data:image/png;base64,${buf.toString('base64')}`;
    }
  }
  return undefined;
}

export async function generateSpgsTurnkeyPdfFromHtml(
  data: SpgsPdfInput,
  options?: { templateConfig?: InvoiceTemplateConfigV1 }
): Promise<Uint8Array> {
  const branding = getInvoiceBranding();
  const html = buildSpgsInvoiceHtmlDocument({
    data,
    branding,
    logoDataUrl: resolveInvoiceLogoDataUrl(),
    templateConfig: options?.templateConfig,
  });

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 1,
    });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.emulateMediaType('screen');

    // Inline HTML has no network fetches; `networkidle0` often never settles and hits the 30s nav timeout.
    await page.setContent(html, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await page.addStyleTag({
      content: '@page { margin: 10mm; } body { margin: 0; }',
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
    });

    return new Uint8Array(pdfBuffer);
  } finally {
    await page.close();
  }
}
