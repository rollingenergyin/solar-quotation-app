import type { SpgsPdfInput } from '../invoice-pdf-spgs-types.js';
import type { InvoiceTemplateConfigV1 } from '../invoice-template-config.js';
import { generateSpgsTurnkeyPdfFromHtml } from '../spgs-invoice-html/renderSpgsPdfFromHtml.js';

/** SPGS invoice PDF: strict HTML `<table>` layout + Puppeteer (matches reference grid). */
export async function generateSpgsTurnkeyPdf(
  data: SpgsPdfInput,
  options?: { templateConfig?: InvoiceTemplateConfigV1 }
): Promise<Uint8Array> {
  return generateSpgsTurnkeyPdfFromHtml(data, options);
}
