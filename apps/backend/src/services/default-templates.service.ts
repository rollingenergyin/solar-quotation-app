import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Base template content — duplicated and customized per template type */
const BASE_TEMPLATE = {
  companyName: 'Rolling Energy',
  companyTagline: 'Solar EPC Company',
  companyAddress: '2nd Floor, Solar Plaza, Baner Road, Pune 411045, Maharashtra',
  companyPhone: '+91 98765 43210',
  companyEmail: 'info@rollingenergy.in',
  companyWebsite: 'www.rollingenergy.in',
  panelWarrantyYears: 25,
  bomShowQty: false,
  bomShowUnit: false,
  bomItems: [
    { srNo: 1, name: 'Solar Panels', specification: '575 Wp Mono PERC, DCR Certified', make: 'Tier-1 Make (Adani / Waaree / Vikram)' },
    { srNo: 2, name: 'Solar Inverter', specification: 'Grid-Tied On-Grid Inverter', make: 'MNRE Listed Make (Solis / Growatt)' },
    { srNo: 3, name: 'Mounting Structure', specification: 'GI / Aluminium, Fixed Tilt', make: 'Standard Make' },
    { srNo: 4, name: 'DC Cables', specification: 'Solar Grade UV Resistant', make: 'ISI Marked (Polycab / RR Kabel)' },
    { srNo: 5, name: 'AC Cables', specification: 'Armoured FR-PVC, ISI Marked', make: 'ISI Marked (Polycab / Havells)' },
    { srNo: 6, name: 'Protection Devices (ACDB/DCDB)', specification: 'With SPD, Surge Protection', make: 'Standard Make (SIEMENS / Hager)' },
    { srNo: 7, name: 'Earthing & Grounding', specification: 'Standard Copper Plate Earthing', make: 'Standard' },
    { srNo: 8, name: 'Remote Monitoring System', specification: 'Cloud-Based Performance Monitoring', make: 'Inverter Brand App / Portal' },
    { srNo: 9, name: 'Installation & Commissioning', specification: 'Complete Turnkey, Net Metering Included', make: 'Rolling Energy Team' },
  ],
  subsidyResidential1kw: 30000,
  subsidyResidential2kw: 60000,
  subsidyResidential3to10kw: 78000,
  subsidySocietyPerKw: 18000,
  depreciationTable: [
    { year: 'Year 1', rate: '40%', note: 'WDV accelerated depreciation' },
    { year: 'Year 2', rate: '24%', note: '40% on remaining 60%' },
    { year: 'Year 3', rate: '14.4%', note: '40% on remaining 36%' },
    { year: 'Year 4+', rate: '8.6%', note: 'Diminishing balance' },
  ],
  depreciationNote: 'This solar installation may qualify for accelerated depreciation benefits under applicable tax rules.',
  introLetterBody: [
    'We are delighted to present this detailed proposal for the installation of a {{system_size}} kW Grid-Connected Rooftop Solar Power System at your premises. At Rolling Energy, we specialize in delivering turnkey solar solutions that combine cutting-edge technology, premium materials, and expert engineering to maximize your return on investment.',
    'This proposal has been prepared after careful consideration of your energy consumption patterns, roof space availability, and local grid conditions. The system outlined herein is designed to significantly reduce your electricity bills, contribute to a cleaner environment, and deliver a strong financial return over its 25-year operational life.',
    'The proposal includes a complete Bill of Materials, detailed cost breakdown, and a comprehensive ROI analysis with EMI financing options tailored to your needs.',
    'We invite you to review this proposal and welcome any queries or clarifications you may have. Our technical team is available for a detailed walkthrough at your convenience.',
    'We look forward to partnering with you on your journey towards energy independence and sustainable savings.',
  ],
  aboutParagraphs: [
    'Rolling Energy is a premier Solar EPC (Engineering, Procurement & Construction) company committed to delivering world-class rooftop and ground-mounted solar solutions across India. Founded by industry veterans, we bring decades of combined experience in power systems, project management, and renewable energy.',
    'We partner with India\'s leading panel and inverter manufacturers to source only Grade-A, BIS-certified equipment, ensuring every system we install delivers peak performance for 25+ years with minimal maintenance.',
    'From a single rooftop installation to large commercial arrays, our integrated approach covers every stage — site survey, system design, procurement, installation, net metering registration, and ongoing AMC — under one roof.',
  ],
  aboutMission: "To accelerate India's transition to clean, renewable energy by making solar power accessible, affordable, and reliable for every home and business.",
  aboutStats: [
    { label: 'Projects', value: '200+' },
    { label: 'MW Installed', value: '1.2+' },
    { label: 'States', value: '5+' },
    { label: 'Experience', value: '8 Yrs' },
  ],
  aboutHighlights: [
    { icon: '🏅', title: 'MNRE Certified', desc: 'Government-registered solar installer under Ministry of New & Renewable Energy' },
    { icon: '⚡', title: 'End-to-End EPC', desc: 'Engineering, Procurement & Construction — complete turnkey solutions' },
    { icon: '☀', title: 'DCR Panels', desc: 'Domestic Content Requirement certified modules eligible for maximum subsidies' },
    { icon: '🔧', title: 'Expert Engineers', desc: 'Team of certified solar engineers with 100+ successful installations' },
    { icon: '📋', title: 'PM Surya Ghar', desc: 'Authorised installer for central subsidy scheme — we handle all paperwork' },
    { icon: '🌱', title: 'Green Commitment', desc: "Dedicated to accelerating India's clean energy transition" },
  ],
  processSteps: [
    { step: '01', title: 'Site Survey', subtitle: 'Assessment & Planning', desc: 'Our certified engineers visit the site to assess roof structure, orientation, shading analysis, electrical load, and grid connection feasibility.', icon: '📍', duration: '1–2 Days' },
    { step: '02', title: 'System Design', subtitle: 'Engineering & Yield Analysis', desc: 'Using advanced solar simulation software, we design an optimised system layout with shadow-free maximum yield calculations.', icon: '📐', duration: '2–3 Days' },
    { step: '03', title: 'Proposal', subtitle: 'Quotation & Approvals', desc: 'We present a transparent, detailed quotation with complete BOM, cost breakdown, ROI analysis, and EMI options.', icon: '📋', duration: '1 Day' },
    { step: '04', title: 'Installation', subtitle: 'Civil & Electrical Work', desc: 'Our trained installation team handles all civil work, panel installation, inverter wiring, and earthing.', icon: '🔧', duration: '2–5 Days' },
    { step: '05', title: 'Commissioning', subtitle: 'Testing & Net Metering', desc: 'Comprehensive system testing followed by grid synchronisation and net meter registration.', icon: '⚡', duration: '3–7 Days' },
    { step: '06', title: 'Monitoring & AMC', subtitle: 'Lifetime Support', desc: 'Remote monitoring via cloud dashboard. Our AMC programme ensures proactive maintenance throughout the system life.', icon: '📊', duration: 'Ongoing' },
  ],
  processTimelineText: 'Total Timeline: 10–18 Working Days',
  maintenanceServices: [
    { icon: '🔍', title: 'Annual Inspection', desc: 'Full system inspection twice a year.' },
    { icon: '🧹', title: 'Panel Cleaning', desc: 'Scheduled panel surface cleaning to maintain >98% optical transmission.' },
    { icon: '📡', title: 'Remote Monitoring', desc: 'Cloud-based performance monitoring with real-time generation data.' },
    { icon: '⚙️', title: 'Inverter Service', desc: 'Firmware updates and manufacturer-recommended maintenance.' },
    { icon: '🔌', title: 'Electrical Safety Check', desc: 'Annual DCDB/ACDB inspection and earthing verification.' },
    { icon: '🚨', title: 'Emergency Support', desc: '48-hour on-site response SLA for critical faults.' },
  ],
  warrantyItems: [
    { item: 'Solar Module Performance', warranty: '{{panel_warranty_years}}-Year Linear Output Guarantee' },
    { item: 'Solar Module Product', warranty: '12-Year Manufacturing Defect Warranty' },
    { item: 'Solar Inverter', warranty: '5-Year Standard (Extendable to 10 Years)' },
    { item: 'Mounting Structure', warranty: '10-Year Structural Integrity Warranty' },
    { item: 'Workmanship & Installation', warranty: '5-Year Rolling Energy Workmanship Warranty' },
    { item: 'DC/AC Cables & Connectors', warranty: 'Lifetime (as per IS specification)' },
  ],
  paymentMilestones: [
    { step: '01', title: 'Order Confirmation', pct: 50, desc: 'Token advance upon signing of agreement.', icon: '✅' },
    { step: '02', title: 'Material Delivery', pct: 40, desc: 'Payment before delivery of all equipment to site.', icon: '📦' },
    { step: '03', title: 'After Commissioning', pct: 10, desc: 'Final payment post successful installation and handover.', icon: '⚡' },
  ],
  paymentTermsBullets: [
    'Quotation valid for 30 days from the date of issue.',
    'Prices subject to revision if material costs change significantly (>5%) before order confirmation.',
    'Bank loan/EMI arrangements are as per the lending institution\'s terms and discretion.',
    'Any applicable DISCOM/net metering charges are additional and borne by the customer.',
  ],
  paymentModes: [
    { icon: '🏦', label: 'Bank Transfer (NEFT/RTGS)' },
    { icon: '📱', label: 'UPI / Mobile Payment' },
    { icon: '💳', label: 'Demand Draft / Cheque' },
    { icon: '🏢', label: 'EMI via Bank Loan (see next page)' },
  ],
  whyReasons: [
    { icon: '🏅', title: 'MNRE Certified Installer', desc: 'Officially empanelled with the Ministry of New & Renewable Energy.' },
    { icon: '🔬', title: 'Grade-A DCR Equipment', desc: 'We source only BIS/DCR certified Tier-1 solar panels and MNRE-listed inverters.' },
    { icon: '📋', title: 'Subsidy Specialists', desc: 'Our team handles every step of PM Surya Ghar subsidy at zero additional cost.' },
    { icon: '🔧', title: 'Certified Installation Team', desc: 'All our engineers are certified solar installers with hands-on training.' },
    { icon: '📊', title: 'Transparent Pricing', desc: 'No hidden charges. Detailed BOM and cost breakdown provided upfront.' },
    { icon: '🛡️', title: '5-Year Workmanship Warranty', desc: 'Comprehensive 5-year workmanship warranty on all installations.' },
    { icon: '📡', title: 'Remote Monitoring Included', desc: 'Real-time performance monitoring via cloud dashboard from day one.' },
    { icon: '🤝', title: 'Dedicated Project Manager', desc: 'Single point of contact from survey to commissioning and beyond.' },
    { icon: '⚡', title: 'Fast Turnaround', desc: 'From signed agreement to commissioned system in 10–18 working days.' },
  ],
  testimonials: [
    { name: 'Prakash M.', location: 'Pune, Maharashtra', text: '"Rolling Energy installed our 5 kW system in just 12 days. Excellent service!"' },
    { name: 'Sanjay K.', location: 'Ahmedabad, Gujarat', text: '"Transparent pricing, premium panels. Electricity bill dropped by 85%."' },
  ],
  certifications: [
    '✅ MNRE Empanelled Installer',
    '✅ BIS Certified Products',
    '✅ DCR Panel Compliant',
    '✅ ISO Certified Process',
    '✅ DISCOM Registered',
  ],
} as const;

/** Default template definitions: name, systemType, siteType, and content overrides */
const DEFAULT_TEMPLATES = [
  {
    name: 'DCR Residential Template',
    systemType: 'DCR',
    siteType: 'RESIDENTIAL',
    introLetterBody: [
      'We are delighted to present this detailed proposal for the installation of a {{system_size}} kW Grid-Connected Rooftop Solar Power System at your residential premises. At Rolling Energy, we specialize in delivering turnkey solar solutions that combine cutting-edge technology, premium materials, and expert engineering to maximize your return on investment.',
      'This proposal has been prepared after careful consideration of your energy consumption patterns, roof space availability, and local grid conditions. The system outlined herein is designed to significantly reduce your electricity bills, contribute to a cleaner environment, and deliver a strong financial return over its 25-year operational life.',
      'The proposal includes a complete Bill of Materials, detailed cost breakdown, government subsidy calculations under the PM Surya Ghar Muft Bijli Yojana scheme (₹30k for 1 kW, ₹60k for 2 kW, ₹78k for 3–10 kW), and a comprehensive ROI analysis with EMI financing options tailored to your needs.',
      'We invite you to review this proposal and welcome any queries or clarifications you may have. Our technical team is available for a detailed walkthrough at your convenience.',
      'We look forward to partnering with you on your journey towards energy independence and sustainable savings.',
    ],
    paymentTermsBullets: [
      'Quotation valid for 30 days from the date of issue.',
      'Prices subject to revision if material costs change significantly (>5%) before order confirmation.',
      'PM Surya Ghar Muft Bijli Yojana subsidy is subject to DISCOM approval and government policy at time of commissioning. Residential subsidy: ₹30k (1 kW), ₹60k (2 kW), ₹78k (3–10 kW).',
      'Bank loan/EMI arrangements are as per the lending institution\'s terms and discretion.',
      'Any applicable DISCOM/net metering charges are additional and borne by the customer.',
    ],
  },
  {
    name: 'Non-DCR Residential Template',
    systemType: 'NON_DCR',
    siteType: 'RESIDENTIAL',
    depreciationNote: 'This solar installation may qualify for depreciation benefits under applicable tax regulations when installed for business purposes. Non-DCR systems do not receive PM Surya Ghar subsidy but may be eligible for accelerated depreciation if used for commercial or income-generating activities.',
    introLetterBody: [
      'We are delighted to present this detailed proposal for the installation of a {{system_size}} kW Grid-Connected Rooftop Solar Power System at your premises. At Rolling Energy, we specialize in delivering turnkey solar solutions that combine cutting-edge technology, premium materials, and expert engineering to maximize your return on investment.',
      'This proposal has been prepared after careful consideration of your energy consumption patterns, roof space availability, and local grid conditions. The system outlined herein is designed to significantly reduce your electricity bills, contribute to a cleaner environment, and deliver a strong financial return over its 25-year operational life.',
      'This is a Non-DCR (open category) system. While it does not qualify for PM Surya Ghar subsidy, it may qualify for depreciation benefits under applicable tax rules when used for business purposes. The proposal includes a complete Bill of Materials, detailed cost breakdown, and a comprehensive ROI analysis with EMI financing options.',
      'We invite you to review this proposal and welcome any queries or clarifications you may have. Our technical team is available for a detailed walkthrough at your convenience.',
      'We look forward to partnering with you on your journey towards energy independence and sustainable savings.',
    ],
    paymentTermsBullets: [
      'Quotation valid for 30 days from the date of issue.',
      'Prices subject to revision if material costs change significantly (>5%) before order confirmation.',
      'Non-DCR systems do not qualify for PM Surya Ghar subsidy. Depreciation benefits may apply for business use — consult your tax advisor.',
      'Bank loan/EMI arrangements are as per the lending institution\'s terms and discretion.',
      'Any applicable DISCOM/net metering charges are additional and borne by the customer.',
    ],
  },
  {
    name: 'DCR Society Template',
    systemType: 'DCR',
    siteType: 'SOCIETY',
    introLetterBody: [
      'We are delighted to present this detailed proposal for the installation of a {{system_size}} kW Grid-Connected Rooftop Solar Power System for your housing society. At Rolling Energy, we specialize in delivering turnkey solar solutions that combine cutting-edge technology, premium materials, and expert engineering to maximize your return on investment.',
      'This proposal has been prepared after careful consideration of your society\'s common area energy consumption, roof space availability, and local grid conditions. The system outlined herein is designed to significantly reduce common electricity bills, contribute to a cleaner environment, and deliver a strong financial return over its 25-year operational life.',
      'The proposal includes a complete Bill of Materials, detailed cost breakdown, government subsidy under PM Surya Ghar for housing societies (₹18,000 per kW), and a comprehensive ROI analysis with EMI financing options tailored to your society\'s needs.',
      'We invite you to review this proposal and welcome any queries or clarifications you may have. Our technical team is available for a detailed walkthrough at your convenience.',
      'We look forward to partnering with your society on the journey towards energy independence and sustainable savings.',
    ],
    paymentTermsBullets: [
      'Quotation valid for 30 days from the date of issue.',
      'Prices subject to revision if material costs change significantly (>5%) before order confirmation.',
      'PM Surya Ghar housing society subsidy (₹18,000 per kW) is subject to DISCOM approval and government policy at time of commissioning.',
      'Bank loan/EMI arrangements are as per the lending institution\'s terms and discretion.',
      'Any applicable DISCOM/net metering charges are additional and borne by the society.',
    ],
  },
  {
    name: 'Non-DCR Society Template',
    systemType: 'NON_DCR',
    siteType: 'SOCIETY',
    depreciationNote: 'This solar installation may qualify for accelerated depreciation benefits under applicable tax regulations when installed for society/common area use. Non-DCR systems do not receive PM Surya Ghar subsidy.',
    introLetterBody: [
      'We are delighted to present this detailed proposal for the installation of a {{system_size}} kW Grid-Connected Rooftop Solar Power System for your housing society. At Rolling Energy, we specialize in delivering turnkey solar solutions that combine cutting-edge technology, premium materials, and expert engineering to maximize your return on investment.',
      'This proposal has been prepared after careful consideration of your society\'s common area energy consumption, roof space availability, and local grid conditions. This is a Non-DCR (open category) system. While it does not qualify for PM Surya Ghar subsidy, it may qualify for depreciation benefits under applicable tax rules.',
      'The proposal includes a complete Bill of Materials, detailed cost breakdown, and a comprehensive ROI analysis with EMI financing options tailored to your society\'s needs.',
      'We invite you to review this proposal and welcome any queries or clarifications you may have. Our technical team is available for a detailed walkthrough at your convenience.',
      'We look forward to partnering with your society on the journey towards energy independence and sustainable savings.',
    ],
    paymentTermsBullets: [
      'Quotation valid for 30 days from the date of issue.',
      'Prices subject to revision if material costs change significantly (>5%) before order confirmation.',
      'Non-DCR systems do not qualify for PM Surya Ghar subsidy. Depreciation benefits may apply — consult your tax advisor.',
      'Bank loan/EMI arrangements are as per the lending institution\'s terms and discretion.',
      'Any applicable DISCOM/net metering charges are additional and borne by the society.',
    ],
  },
  {
    name: 'Commercial Template',
    systemType: 'ANY',
    siteType: 'COMMERCIAL',
    depreciationNote: 'This solar installation may qualify for depreciation benefits under applicable tax regulations when installed for business use. Commercial installations are eligible for accelerated depreciation (WDV method) as a business asset under the Income Tax Act. Consult your tax advisor for eligibility.',
    introLetterBody: [
      'We are delighted to present this detailed proposal for the installation of a {{system_size}} kW Grid-Connected Rooftop Solar Power System at your commercial premises. At Rolling Energy, we specialize in delivering turnkey solar solutions that combine cutting-edge technology, premium materials, and expert engineering to maximize your return on investment.',
      'This proposal has been prepared after careful consideration of your business energy consumption, roof space availability, and local grid conditions. The system outlined herein is designed to significantly reduce your electricity costs, contribute to a cleaner environment, and deliver a strong financial return over its 25-year operational life.',
      'Commercial installations do not qualify for PM Surya Ghar subsidy but may be eligible for depreciation benefits as a business expense. The proposal includes a complete Bill of Materials, detailed cost breakdown, and a comprehensive ROI analysis with financing options tailored to your business needs.',
      'We invite you to review this proposal and welcome any queries or clarifications you may have. Our technical team is available for a detailed walkthrough at your convenience.',
      'We look forward to partnering with you on your journey towards energy independence and sustainable savings.',
    ],
    paymentTermsBullets: [
      'Quotation valid for 30 days from the date of issue.',
      'Prices subject to revision if material costs change significantly (>5%) before order confirmation.',
      'Commercial installations do not qualify for PM Surya Ghar subsidy. Depreciation/business expense benefits may apply — consult your tax advisor.',
      'Bank loan/EMI arrangements are as per the lending institution\'s terms and discretion.',
      'Any applicable DISCOM/net metering charges are additional and borne by the customer.',
    ],
  },
  {
    name: 'Industrial Template',
    systemType: 'ANY',
    siteType: 'INDUSTRIAL',
    depreciationNote: 'This solar installation may qualify for depreciation benefits under applicable tax regulations when installed for industrial/business use. Industrial and larger commercial installations are eligible for accelerated depreciation (WDV method) as a business asset. Suitable for larger projects with higher capacity requirements.',
    introLetterBody: [
      'We are delighted to present this detailed proposal for the installation of a {{system_size}} kW Grid-Connected Rooftop/Ground-Mounted Solar Power System at your industrial premises. At Rolling Energy, we specialize in delivering turnkey solar solutions that combine cutting-edge technology, premium materials, and expert engineering to maximize your return on investment.',
      'This proposal has been prepared after careful consideration of your industrial energy consumption, available space, and local grid conditions. The system outlined herein is designed to significantly reduce your electricity costs, contribute to a cleaner environment, and deliver a strong financial return over its 25-year operational life.',
      'Industrial installations do not qualify for PM Surya Ghar subsidy but may be eligible for depreciation benefits as a business asset. This template is suitable for larger industrial projects. The proposal includes a complete Bill of Materials, detailed cost breakdown, and a comprehensive ROI analysis with financing options tailored to your industrial needs.',
      'We invite you to review this proposal and welcome any queries or clarifications you may have. Our technical team is available for a detailed walkthrough at your convenience.',
      'We look forward to partnering with you on your journey towards energy independence and sustainable savings.',
    ],
    paymentTermsBullets: [
      'Quotation valid for 30 days from the date of issue.',
      'Prices subject to revision if material costs change significantly (>5%) before order confirmation.',
      'Industrial installations do not qualify for PM Surya Ghar subsidy. Depreciation benefits may apply for business use — consult your tax advisor.',
      'Bank loan/EMI arrangements are as per the lending institution\'s terms and discretion.',
      'Any applicable DISCOM/net metering charges are additional and borne by the customer.',
    ],
  },
];

/**
 * Ensures all 6 default quotation templates exist. Creates only if no template
 * (including soft-deleted) exists for that systemType+siteType. Respects admin
 * deletions — never recreates a template that was intentionally deleted.
 */
export async function ensureDefaultTemplates(): Promise<void> {
  let created = 0;
  for (const def of DEFAULT_TEMPLATES) {
    const exists = await prisma.quotationTemplate.findFirst({
      where: { systemType: def.systemType, siteType: def.siteType },
      // No isDeleted filter — if any template exists (deleted or not), do not recreate
    });
    if (exists) continue;

    const base = { ...BASE_TEMPLATE };
    const overrides = def as Record<string, unknown>;
    const introLetterBody = (overrides.introLetterBody ?? base.introLetterBody) as string[];
    const paymentTermsBullets = (overrides.paymentTermsBullets ?? base.paymentTermsBullets) as string[];
    const depreciationNote = (overrides.depreciationNote ?? base.depreciationNote) as string;

    await prisma.quotationTemplate.create({
      data: {
        version: 1,
        name: def.name,
        isActive: true,
        isDefaultTemplate: true,
        systemType: def.systemType,
        siteType: def.siteType,
        companyName: base.companyName,
        companyTagline: base.companyTagline,
        companyAddress: base.companyAddress,
        companyPhone: base.companyPhone,
        companyEmail: base.companyEmail,
        companyWebsite: base.companyWebsite,
        panelWarrantyYears: base.panelWarrantyYears,
        bomShowQty: base.bomShowQty,
        bomShowUnit: base.bomShowUnit,
        bomItems: base.bomItems,
        subsidyResidential1kw: base.subsidyResidential1kw,
        subsidyResidential2kw: base.subsidyResidential2kw,
        subsidyResidential3to10kw: base.subsidyResidential3to10kw,
        subsidySocietyPerKw: base.subsidySocietyPerKw,
        depreciationNote,
        depreciationTable: base.depreciationTable,
        introLetterBody,
        aboutParagraphs: base.aboutParagraphs,
        aboutMission: base.aboutMission,
        aboutStats: base.aboutStats,
        aboutHighlights: base.aboutHighlights,
        processSteps: base.processSteps,
        processTimelineText: base.processTimelineText,
        maintenanceServices: base.maintenanceServices,
        warrantyItems: base.warrantyItems,
        paymentMilestones: base.paymentMilestones,
        paymentTermsBullets,
        paymentModes: base.paymentModes,
        whyReasons: base.whyReasons,
        testimonials: base.testimonials,
        certifications: base.certifications,
      },
    });
    created++;
  }
  if (created > 0) {
    console.log(`[Default Templates] Created ${created} missing template(s).`);
  }
}
