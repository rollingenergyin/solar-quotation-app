import type {
  TemplateBomItem,
  TemplatePaymentMilestone,
  TemplatePaymentMode,
} from '@/types/quotation-template';

export const DEFAULT_QUICK_QUOTE_BOM: TemplateBomItem[] = [
  { srNo: 1, name: 'Solar Panels', specification: '575 Wp Mono PERC, DCR Certified', make: 'Tier-1 Make (Adani / Waaree / Vikram)' },
  { srNo: 2, name: 'Solar Inverter', specification: 'Grid-Tied On-Grid Inverter', make: 'MNRE Listed Make (Solis / Growatt)' },
  { srNo: 3, name: 'Mounting Structure', specification: 'GI / Aluminium, Fixed Tilt', make: 'Standard Make' },
  { srNo: 4, name: 'DC Cables', specification: 'Solar Grade UV Resistant', make: 'ISI Marked (Polycab / RR Kabel)' },
  { srNo: 5, name: 'AC Cables', specification: 'Armoured FR-PVC, ISI Marked', make: 'ISI Marked (Polycab / Havells)' },
  { srNo: 6, name: 'Protection Devices (ACDB/DCDB)', specification: 'With SPD, Surge Protection', make: 'Standard Make (SIEMENS / Hager)' },
  { srNo: 7, name: 'Earthing & Grounding', specification: 'Standard Copper Plate Earthing', make: 'Standard' },
  { srNo: 8, name: 'Remote Monitoring System', specification: 'Cloud-Based Performance Monitoring', make: 'Inverter Brand App / Portal' },
  { srNo: 9, name: 'Installation & Commissioning', specification: 'Complete Turnkey, Net Metering Included', make: 'Rolling Energy Team' },
];

export const DEFAULT_QUICK_QUOTE_PAYMENT_MILESTONES: TemplatePaymentMilestone[] = [
  { step: '01', title: 'Order Confirmation', pct: 50, desc: 'Token advance upon signing of agreement.', icon: '✅' },
  { step: '02', title: 'Material Delivery', pct: 40, desc: 'Payment before delivery of all equipment to site.', icon: '📦' },
  { step: '03', title: 'After Commissioning', pct: 10, desc: 'Final payment post successful installation and handover.', icon: '⚡' },
];

export const DEFAULT_QUICK_QUOTE_PAYMENT_MODES: TemplatePaymentMode[] = [
  { icon: '🏦', label: 'Bank Transfer (NEFT/RTGS)' },
  { icon: '📱', label: 'UPI / Mobile Payment' },
  { icon: '💳', label: 'Demand Draft / Cheque' },
  { icon: '🏢', label: 'EMI via Bank Loan (see next page)' },
];

export const DEFAULT_QUICK_QUOTE_TERMS_BULLETS = [
  'Prices subject to revision if material costs change significantly (>5%) before order confirmation.',
  'PM Surya Ghar subsidy is subject to DISCOM approval and government policy at time of commissioning.',
  "Bank loan/EMI arrangements are as per the lending institution's terms and discretion.",
];
