/**
 * Versioned JSON config for SPGS HTML/PDF invoice — merged with defaults so missing keys keep legacy appearance.
 */

import type { InvoiceBrandConfig } from './invoice-branding.js';

export const INVOICE_TEMPLATE_VERSION = 1 as const;

export type CompanyNameFormat = 'uppercase' | 'as_is';

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
    colors: { primary: string; accent: string };
    companyNameFormat: CompanyNameFormat;
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
      },
      companyNameFormat: 'uppercase',
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
