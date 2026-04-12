import type { SpgsComputed } from './invoice-spgs.service.js';

export interface SpgsPdfInput {
  invoiceNo: string;
  date: string;
  /** Shown when set (e.g. same as invoice date) */
  dueDate?: string;
  clientName: string;
  companyName?: string;
  address?: string;
  gstin?: string;
  contact?: string;
  /** e.g. "Maharashtra (27)" from buyer GSTIN */
  placeOfSupply?: string;
  /** e.g. "Hand Delivery" */
  transport?: string;
  siteName?: string;
  siteAddress?: string;
  systemSizeKw: number;
  panelWattage: number;
  /** Shown only when non-empty */
  panelMake?: string;
  /** Shown only when non-empty */
  inverterMake?: string;
  panelSerials: string[];
  /** Inverter serial numbers (optional; shown in product description cell) */
  inverterSerials?: string[];
  computed: SpgsComputed;
  gstMode: 'blended' | 'split' | 'epc';
  annexures: { label: string; fileName?: string }[];
  /** HSN/SAC for the single turnkey line (default applied in PDF) */
  hsnSac?: string;
  /** Override footer section title (default: template / "Payment Terms") */
  paymentTermsHeading?: string;
  /** Override payment term lines (default: company branding bullets) */
  paymentTermsBullets?: string[];
}
