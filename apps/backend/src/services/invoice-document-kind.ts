import type { InvoiceMainKind } from '@prisma/client';
import type { InvoiceTemplateConfigV1 } from './invoice-template-config.js';
import { mergeInvoiceTemplateConfig } from './invoice-template-config.js';

export function canConvertInvoice(from: InvoiceMainKind, to: InvoiceMainKind): boolean {
  if (from === to) return false;
  if (from === 'QUOTATION' && (to === 'PROFORMA_INVOICE' || to === 'TAX_INVOICE')) return true;
  if (from === 'PROFORMA_INVOICE' && to === 'TAX_INVOICE') return true;
  if (from === 'TAX_INVOICE' && to === 'EWAY_BILL') return true;
  return false;
}

/** Strip title in PDF/HTML — only the main document kind changes; subtype uses the same 3 base templates. */
export function documentTitleForMainKind(mainKind: InvoiceMainKind): string {
  switch (mainKind) {
    case 'TAX_INVOICE':
      return 'TAX INVOICE';
    case 'PROFORMA_INVOICE':
      return 'PROFORMA INVOICE';
    case 'QUOTATION':
      return 'QUOTATION';
    case 'EWAY_BILL':
      return 'E-WAY BILL';
    default:
      return 'TAX INVOICE';
  }
}

/** Merge dynamic title over saved template config (does not duplicate templates per main kind). */
export function mergeTemplateConfigWithMainKind(
  baseConfig: unknown,
  mainKind: InvoiceMainKind
): InvoiceTemplateConfigV1 {
  const title = documentTitleForMainKind(mainKind);
  return mergeInvoiceTemplateConfig({
    ...(typeof baseConfig === 'object' && baseConfig !== null ? baseConfig : {}),
    labels: { strip: { taxInvoice: title } },
  });
}
