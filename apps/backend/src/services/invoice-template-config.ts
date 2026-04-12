/**
 * Versioned JSON config for SPGS HTML/PDF invoice — merged with defaults so missing keys keep legacy appearance.
 */

import type { InvoiceBrandConfig } from './invoice-branding.js';

export const INVOICE_TEMPLATE_VERSION = 1 as const;

/** When invoice data has no HSN, SPGS layout uses this (matches legacy HTML default). */
export const DEFAULT_INVOICE_HSN = '995464';

export type CompanyNameFormat = 'uppercase' | 'as_is';

/** Palette for SPGS invoice layout (borders + shaded areas). */
export interface InvoiceTemplateBrandColors {
  primary: string;
  accent: string;
  /** Inner grid / table cell borders (defaults to accent). */
  innerLine?: string;
  /** Outer box border around the invoice body (defaults to accent). */
  outerLine?: string;
  /** Background of the strip under “Tax invoice” (default #f5f8fc). */
  stripFill?: string;
  /** Product table header, GST table header, footer section titles (default #eef4fb). */
  tableHeaderFill?: string;
}

/** Seller-side text shown on the PDF; merged over env branding when set. */
export interface InvoiceTemplateSellerOverride {
  companyName?: string;
  addressLine1?: string;
  addressLine2?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  bankName?: string;
  bankBranch?: string;
  bankAccountName?: string;
  bankAccount?: string;
  bankIfsc?: string;
}

export interface InvoiceTemplateConfigV1 {
  version: typeof INVOICE_TEMPLATE_VERSION;
  /** Editor preview only: standard = blended GST table; spgs_epc = split 5%/18% rows. */
  gstPreviewStyle?: 'standard' | 'spgs_epc';
  /** Optional seller block overrides (company, address, contact, bank). */
  seller?: InvoiceTemplateSellerOverride;
  branding: {
    fontFamily: string;
    colors: InvoiceTemplateBrandColors;
    companyNameFormat: CompanyNameFormat;
    /** When false, no logo image is shown (letterhead text only). Default true. */
    showLogo?: boolean;
    /** When set, overrides filesystem logo in PDF */
    logoDataUrl?: string | null;
  };
  visibility: {
    header: boolean;
    strip: boolean;
    /** Seller GSTIN in the blue strip under “Tax invoice” */
    showSellerGstinInStrip: boolean;
    /** Buyer GSTIN row in the customer grid */
    showBuyerGstinInGrid: boolean;
    /** Buyer phone row in the customer grid */
    showBuyerPhoneInGrid: boolean;
    customerGrid: boolean;
    lineItemsTable: boolean;
    gstBreakdown: boolean;
    bankDetails: boolean;
    paymentTerms: boolean;
    rightSummary: boolean;
    totalInWords: boolean;
    table: {
      mainSystemLine: boolean;
      solarPanels: boolean;
      panelMakeOnlyIfValue: boolean;
      panelSerials: boolean;
      inverter: boolean;
      inverterMakeOnlyIfValue: boolean;
      inverterSerials: boolean;
      bos: boolean;
      installation: boolean;
      commissioning: boolean;
      labour: boolean;
    };
  };
  /** Extra description-only rows before “Sub-total” (optional). */
  extraTableRows?: { id: string; label: string; enabled: boolean }[];
  labels: {
    strip: {
      gstinPrefix: string;
      taxInvoice: string;
      originalForRecipient: string;
    };
    grid: {
      customerTitle: string;
      invoiceTitle: string;
      ms: string;
      address: string;
      phone: string;
      gstin: string;
      invoiceNo: string;
      invoiceDate: string;
      dueDate: string;
      transport: string;
      placeOfSupply: string;
      siteName: string;
      systemSize: string;
    };
    contact: {
      namePrefix: string;
      phonePrefix: string;
      emailPrefix: string;
    };
    lineItems: {
      mainDescription: string;
      solarPanels: string;
      inverter: string;
      bos: string;
      installation: string;
      commissioning: string;
      labour: string;
      makePrefix: string;
      serialPrefix: string;
      subTotal: string;
      roundOff: string;
      totalEquals: string;
    };
    tableHead: {
      srNo: string;
      description: string;
      hsnSac: string;
      quantity: string;
      rate: string;
      per: string;
      discount: string;
      amount: string;
    };
    gstTable: {
      hsnSac: string;
      taxableValue: string;
      centralTax: string;
      stateTax: string;
      rate: string;
      amount: string;
      totalTaxAmount: string;
      totalGstAmount: string;
    };
    footer: {
      totalInWords: string;
      bankDetails: string;
      paymentTerms: string;
      bankName: string;
      bankBranch: string;
      bankAccName: string;
      bankAccNo: string;
      bankIfsc: string;
      taxableAmount: string;
      addCgst: string;
      addSgst: string;
      totalTax: string;
      totalAfterTax: string;
      eoe: string;
      certified: string;
      forPrefix: string;
      authorisedSignatory: string;
      systemGenerated: string;
    };
    sumLineInrPrefix: string;
  };
  units: {
    systemSize: 'kw_dc' | 'w_dc';
    mainPer: 'set' | 'pcs';
    totalQtyUnit: 'pcs' | 'set';
  };
  gstDisplay: {
    epc: {
      cgstRate1: string;
      sgstRate1: string;
      cgstRate2: string;
      sgstRate2: string;
    };
    nonEpc: {
      centralTax: string;
      stateTax: string;
    };
  };
  /**
   * Default payment terms (one bullet per string) when the invoice omits `paymentTermsBullets`.
   * Used in PDF/HTML and the template preview. Falls back to env branding if empty or missing.
   */
  defaultPaymentTermsBullets?: string[];
  /**
   * Optional HSN/SAC overrides on the PDF. If a field is empty, falls back to the previous step
   * (invoice line item `hsnSac`, then {@link DEFAULT_INVOICE_HSN}).
   */
  hsnCodes?: {
    /** Main SPGS line in the product table */
    lineMain?: string | null;
    /** GST summary: blended single row, or EPC first band (70% taxable) */
    gstRow1?: string | null;
    /** EPC GST second band (30% taxable); for blended layout gstRow1 is used for the only row */
    gstRow2?: string | null;
  };
}

function deepMerge<T extends Record<string, unknown>>(base: T, patch: unknown): T {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return base;
  const out = { ...base } as Record<string, unknown>;
  const p = patch as Record<string, unknown>;
  for (const key of Object.keys(p)) {
    const pv = p[key];
    const bv = out[key];
    if (
      pv &&
      typeof pv === 'object' &&
      !Array.isArray(pv) &&
      bv &&
      typeof bv === 'object' &&
      !Array.isArray(bv)
    ) {
      out[key] = deepMerge(bv as Record<string, unknown>, pv);
    } else if (pv !== undefined) {
      out[key] = pv;
    }
  }
  return out as T;
}

export function createDefaultInvoiceTemplateConfig(): InvoiceTemplateConfigV1 {
  return {
    version: INVOICE_TEMPLATE_VERSION,
    gstPreviewStyle: 'spgs_epc',
    branding: {
      fontFamily: 'Arial, Helvetica, sans-serif',
      colors: {
        primary: '#161c34',
        accent: '#6690cc',
        innerLine: '#6690cc',
        outerLine: '#6690cc',
        stripFill: '#f5f8fc',
        tableHeaderFill: '#eef4fb',
      },
      companyNameFormat: 'uppercase',
      showLogo: true,
      logoDataUrl: null,
    },
    visibility: {
      header: true,
      strip: true,
      showSellerGstinInStrip: true,
      showBuyerGstinInGrid: true,
      showBuyerPhoneInGrid: true,
      customerGrid: true,
      lineItemsTable: true,
      gstBreakdown: true,
      bankDetails: true,
      paymentTerms: true,
      rightSummary: true,
      totalInWords: true,
      table: {
        mainSystemLine: true,
        solarPanels: true,
        panelMakeOnlyIfValue: true,
        panelSerials: true,
        inverter: true,
        inverterMakeOnlyIfValue: true,
        inverterSerials: true,
        bos: true,
        installation: true,
        commissioning: true,
        labour: true,
      },
    },
    extraTableRows: [],
    defaultPaymentTermsBullets: [
      'Payment as per agreed commercial terms and milestone schedule.',
      'GST charged as per applicable law; input tax credit as per eligibility.',
      'Overdue amounts may attract interest at 18% p.a. or as agreed in writing.',
    ],
    labels: {
      strip: {
        gstinPrefix: 'GSTIN :',
        taxInvoice: 'TAX INVOICE',
        originalForRecipient: 'ORIGINAL FOR RECIPIENT',
      },
      grid: {
        customerTitle: 'Customer Detail',
        invoiceTitle: 'Invoice Details',
        ms: 'M/S',
        address: 'Address',
        phone: 'Phone',
        gstin: 'GSTIN',
        invoiceNo: 'Invoice No.',
        invoiceDate: 'Invoice Date',
        dueDate: 'Due Date',
        transport: 'Transport',
        placeOfSupply: 'Place of Supply',
        siteName: 'Site name',
        systemSize: 'System size',
      },
      contact: {
        namePrefix: 'Name :',
        phonePrefix: 'Phone :',
        emailPrefix: 'Email :',
      },
      lineItems: {
        mainDescription: 'SOLAR POWER GENERATING SYSTEM',
        solarPanels: 'Solar Panels',
        inverter: 'Inverter',
        bos: 'BOS & Structure',
        installation: 'Installation (Inclusive)',
        commissioning: 'Commissioning (Inclusive)',
        labour: 'Labour (Inclusive)',
        makePrefix: 'Make –',
        serialPrefix: 'Serial nos. –',
        subTotal: 'Sub-Total =',
        roundOff: 'Round off',
        totalEquals: 'T O T A L =',
      },
      tableHead: {
        srNo: 'Sr No.',
        description: 'Description of goods',
        hsnSac: 'HSN/SAC',
        quantity: 'Quantity',
        rate: 'Rate',
        per: 'per',
        discount: 'Discount (%)',
        amount: 'Amount',
      },
      gstTable: {
        hsnSac: 'HSN/SAC',
        taxableValue: 'Taxable Value',
        centralTax: 'Central Tax',
        stateTax: 'State Tax',
        rate: 'Rate',
        amount: 'Amount',
        totalTaxAmount: 'Total Tax Amount',
        totalGstAmount: 'Total GST Amount =',
      },
      footer: {
        totalInWords: 'Total in words',
        bankDetails: 'Bank Details',
        paymentTerms: 'Payment Terms',
        bankName: 'Name',
        bankBranch: 'Branch',
        bankAccName: 'Acc. Name',
        bankAccNo: 'Acc. Number',
        bankIfsc: 'IFSC',
        taxableAmount: 'Taxable Amount',
        addCgst: 'Add : CGST',
        addSgst: 'Add : SGST',
        totalTax: 'Total Tax',
        totalAfterTax: 'Total Amount After Tax',
        eoe: '(E & O.E.)',
        certified: 'Certified that the particulars given above are true and correct.',
        forPrefix: 'For',
        authorisedSignatory: 'Authorised Signatory',
        systemGenerated: 'This invoice is system generated',
      },
      sumLineInrPrefix: 'INR –',
    },
    units: {
      systemSize: 'kw_dc',
      mainPer: 'set',
      totalQtyUnit: 'pcs',
    },
    gstDisplay: {
      epc: {
        cgstRate1: '2.5%',
        sgstRate1: '2.5%',
        cgstRate2: '9%',
        sgstRate2: '9%',
      },
      nonEpc: {
        centralTax: 'Central Tax',
        stateTax: 'State Tax',
      },
    },
  };
}

export function mergeInvoiceTemplateConfig(partial: unknown): InvoiceTemplateConfigV1 {
  const def = createDefaultInvoiceTemplateConfig();
  if (!partial || typeof partial !== 'object' || Array.isArray(partial)) return def;
  const p = partial as Record<string, unknown>;
  if (p.version !== undefined && p.version !== INVOICE_TEMPLATE_VERSION) {
    return def;
  }
  return deepMerge(def as unknown as Record<string, unknown>, partial) as unknown as InvoiceTemplateConfigV1;
}

/** Resolved HSN/SAC for each place on the SPGS invoice (after template + invoice fallbacks). */
export function resolveTemplateHsnCodes(
  tm: InvoiceTemplateConfigV1,
  invoiceHsnFromData?: string | null
): { lineMain: string; gstRow1: string; gstRow2: string } {
  const base = invoiceHsnFromData?.trim() || DEFAULT_INVOICE_HSN;
  const H = tm.hsnCodes;
  const lineMain = H?.lineMain?.trim() || base;
  const gstRow1 = H?.gstRow1?.trim() || lineMain;
  const gstRow2 = H?.gstRow2?.trim() || gstRow1;
  return { lineMain, gstRow1, gstRow2 };
}

/** Merge template seller overrides onto env branding for PDF/HTML output. */
export function mergeSellerBranding(
  base: InvoiceBrandConfig,
  tm: InvoiceTemplateConfigV1
): InvoiceBrandConfig {
  const s = tm.seller;
  if (!s) return base;
  const addr = [s.addressLine1?.trim(), s.addressLine2?.trim()].filter(Boolean).join(', ');
  return {
    ...base,
    companyName: s.companyName !== undefined ? s.companyName.trim() || base.companyName : base.companyName,
    address: addr || base.address,
    phone: s.phone !== undefined ? s.phone.trim() || base.phone : base.phone,
    email: s.email !== undefined ? s.email.trim() || base.email : base.email,
    gstin: s.gstin !== undefined ? s.gstin.trim() : base.gstin,
    bankName: s.bankName !== undefined ? s.bankName.trim() || base.bankName : base.bankName,
    bankBranch: s.bankBranch !== undefined ? s.bankBranch.trim() || base.bankBranch : base.bankBranch,
    bankAccountName: s.bankAccountName !== undefined ? s.bankAccountName.trim() || base.bankAccountName : base.bankAccountName,
    bankAccount: s.bankAccount !== undefined ? s.bankAccount.trim() || base.bankAccount : base.bankAccount,
    bankIfsc: s.bankIfsc !== undefined ? s.bankIfsc.trim() || base.bankIfsc : base.bankIfsc,
  };
}

export function formatSystemSizeLine(
  units: InvoiceTemplateConfigV1['units'],
  kw: number,
  watts: number
): string {
  if (units.systemSize === 'w_dc') {
    const w = Math.round(watts);
    return `${w.toLocaleString('en-IN')} W (DC)`;
  }
  return `${kw} kW (DC)`;
}

export function mainPerLabel(units: InvoiceTemplateConfigV1['units']): string {
  return units.mainPer === 'pcs' ? 'PCS' : 'Set';
}

export function totalQtyUnitLabel(units: InvoiceTemplateConfigV1['units']): string {
  return units.totalQtyUnit === 'set' ? 'SET' : 'PCS.';
}
