/**
 * Central invoice / document branding — override via env for white-label updates.
 */

export interface InvoiceBrandConfig {
  companyName: string;
  tagline: string;
  /** Monogram shown when no logo image */
  monogram: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  /** Seller GSTIN (shown on tax invoice header) */
  gstin: string;
  /** Shown after "Name :" at top (e.g. contact person); falls back to company name */
  contactName: string;
  bankName: string;
  /** Account holder name as printed on cheque */
  bankAccountName: string;
  bankAccount: string;
  bankIfsc: string;
  bankBranch: string;
  /** Short bullets for payment terms */
  paymentTermsBullets: string[];
  colors: {
    primary: string;
    accent: string;
    muted: string;
    surface: string;
    border: string;
    success: string;
  };
}

const DEFAULT: InvoiceBrandConfig = {
  companyName: 'Rolling Energy',
  tagline: 'Solar EPC Company',
  monogram: 'RE',
  address: '2nd Floor, Solar Plaza, Baner Road, Pune 411045, Maharashtra',
  phone: '+91 98765 43210',
  email: 'info@rollingenergy.in',
  website: 'www.rollingenergy.in',
  gstin: '',
  contactName: '',
  bankName: 'HDFC Bank Ltd',
  bankAccountName: 'Rolling Energy',
  bankAccount: '50200012345678',
  bankIfsc: 'HDFC0001234',
  bankBranch: 'Baner, Pune',
  paymentTermsBullets: [
    'Payment as per agreed commercial terms and milestone schedule.',
    'GST charged as per applicable law; input tax credit as per eligibility.',
    'Overdue amounts may attract interest at 18% p.a. or as agreed in writing.',
  ],
  colors: {
    /** Rolling Energy dark blue — headers, table borders */
    primary: '#161c34',
    /** Light blue — section dividers, accents */
    accent: '#6690cc',
    muted: '#64748b',
    surface: '#ffffff',
    border: '#161c34',
    success: '#059669',
  },
};

export function getInvoiceBranding(): InvoiceBrandConfig {
  return {
    ...DEFAULT,
    companyName: process.env.INVOICE_COMPANY_NAME?.trim() || DEFAULT.companyName,
    tagline: process.env.INVOICE_TAGLINE?.trim() || DEFAULT.tagline,
    gstin: process.env.INVOICE_GSTIN?.trim() || DEFAULT.gstin,
    contactName: process.env.INVOICE_CONTACT_NAME?.trim() || DEFAULT.contactName,
    bankName: process.env.INVOICE_BANK_NAME?.trim() || DEFAULT.bankName,
    bankAccountName: process.env.INVOICE_BANK_ACCOUNT_NAME?.trim() || DEFAULT.bankAccountName,
    bankAccount: process.env.INVOICE_BANK_ACCOUNT?.trim() || DEFAULT.bankAccount,
    bankIfsc: process.env.INVOICE_BANK_IFSC?.trim() || DEFAULT.bankIfsc,
    bankBranch: process.env.INVOICE_BANK_BRANCH?.trim() || DEFAULT.bankBranch,
  };
}
