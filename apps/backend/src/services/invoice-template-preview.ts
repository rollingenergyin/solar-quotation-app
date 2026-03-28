/**
 * Fixed sample data for template editor HTML preview (not a real invoice).
 */

import type { SpgsPdfInput } from './invoice-pdf-spgs-types.js';
import type { InvoiceTemplateConfigV1 } from './invoice-template-config.js';
import { computeSpgsTotals, type SpgsInput } from './invoice-spgs.service.js';

export function buildSampleSpgsPdfInputForPreview(tm?: InvoiceTemplateConfigV1): SpgsPdfInput {
  const style = tm?.gstPreviewStyle ?? 'spgs_epc';

  const sp: SpgsInput =
    style === 'standard'
      ? {
          systemSizeKw: 5,
          panelWattage: 550,
          panelSerials: ['SN001', 'SN002'],
          pricingMode: 'perWatt',
          perWatt: 45,
          gstMode: 'blended',
          blendedGstPercent: 18,
        }
      : {
          systemSizeKw: 5,
          panelWattage: 550,
          panelSerials: ['SN001', 'SN002'],
          pricingMode: 'perWatt',
          perWatt: 45,
          gstMode: 'epc',
        };

  const computed = computeSpgsTotals(sp);
  return {
    invoiceNo: 'PREVIEW',
    date: '01-Jan-2026',
    dueDate: '01-Jan-2026',
    clientName: 'Sample Client',
    companyName: 'Sample Client Pvt Ltd',
    address: '123 Sample Street, Pune 411001',
    gstin: '27AAAAA0000A1Z5',
    contact: '+91 90000 00000',
    placeOfSupply: 'Maharashtra (27)',
    transport: 'Hand Delivery',
    siteName: 'Sample rooftop site',
    siteAddress: 'Baner, Pune',
    systemSizeKw: 5,
    panelWattage: 550,
    panelSerials: ['SN001', 'SN002'],
    inverterSerials: ['INV-1'],
    panelMake: 'Example Panels',
    inverterMake: 'Example Inverter',
    computed,
    gstMode: style === 'standard' ? 'blended' : 'epc',
    annexures: [],
  };
}
