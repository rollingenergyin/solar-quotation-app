import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // ─── Users ─────────────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('Admin123!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@solar.com' },
    update: {},
    create: {
      email: 'admin@solar.com',
      password: hashedPassword,
      name: 'Admin User',
      role: 'ADMIN',
    },
  });

  const sales = await prisma.user.upsert({
    where: { email: 'sales@solar.com' },
    update: {},
    create: {
      email: 'sales@solar.com',
      password: hashedPassword,
      name: 'Sales User',
      role: 'SALES',
    },
  });

  // ─── Material Categories ───────────────────────────────────────────────
  const categories = await Promise.all([
    prisma.materialCategory.upsert({
      where: { slug: 'panels' },
      update: {},
      create: { name: 'Solar Panels', slug: 'panels', sortOrder: 1 },
    }),
    prisma.materialCategory.upsert({
      where: { slug: 'inverters' },
      update: {},
      create: { name: 'Inverters', slug: 'inverters', sortOrder: 2 },
    }),
    prisma.materialCategory.upsert({
      where: { slug: 'batteries' },
      update: {},
      create: { name: 'Batteries', slug: 'batteries', sortOrder: 3 },
    }),
    prisma.materialCategory.upsert({
      where: { slug: 'mounting' },
      update: {},
      create: { name: 'Mounting & Structure', slug: 'mounting', sortOrder: 4 },
    }),
    prisma.materialCategory.upsert({
      where: { slug: 'cables' },
      update: {},
      create: { name: 'Cables & Connectors', slug: 'cables', sortOrder: 5 },
    }),
    prisma.materialCategory.upsert({
      where: { slug: 'other' },
      update: {},
      create: { name: 'Other Components', slug: 'other', sortOrder: 99 },
    }),
  ]);

  // ─── Sample Materials ──────────────────────────────────────────────────
  const panelCat = categories.find((c) => c.slug === 'panels')!;
  const invCat = categories.find((c) => c.slug === 'inverters')!;

  await prisma.material.upsert({
    where: { id: 'seed-panel-1' },
    update: {},
    create: {
      id: 'seed-panel-1',
      categoryId: panelCat.id,
      name: '540W Mono PERC Panel',
      brand: 'Sample',
      model: 'SP-540',
      specs: { wattage: 540, efficiency: 21.2, warrantyYears: 25 },
      unit: 'WATT',
      basePrice: 22,
    },
  });

  await prisma.material.upsert({
    where: { id: 'seed-inv-1' },
    update: {},
    create: {
      id: 'seed-inv-1',
      categoryId: invCat.id,
      name: '3kW Hybrid Inverter',
      brand: 'Sample',
      model: 'HI-3K',
      specs: { capacity: 3000, warrantyYears: 5 },
      unit: 'KW',
      basePrice: 25000,
    },
  });

  // ─── Pricing Types ─────────────────────────────────────────────────────
  await Promise.all([
    prisma.pricingType.upsert({
      where: { slug: 'per-watt' },
      update: {},
      create: {
        name: 'Per Watt',
        slug: 'per-watt',
        unit: 'WATT',
        description: 'Price per watt of solar panel capacity',
        sortOrder: 1,
      },
    }),
    prisma.pricingType.upsert({
      where: { slug: 'per-unit' },
      update: {},
      create: {
        name: 'Per Unit (kWh)',
        slug: 'per-unit',
        unit: 'UNIT',
        description: 'Price per unit of electricity',
        sortOrder: 2,
      },
    }),
    prisma.pricingType.upsert({
      where: { slug: 'fixed' },
      update: {},
      create: {
        name: 'Fixed / Lump Sum',
        slug: 'fixed',
        unit: 'LUMP',
        description: 'Fixed amount',
        sortOrder: 3,
      },
    }),
  ]);

  // ─── System Default Parameters ────────────────────────────────────────
  const systemParamDefs = [
    { key: 'floor_height',         label: 'Floor Height',      value: 3,    unit: 'meters', category: 'sizing',    description: 'Average height per floor, used for cable length calculations' },
    { key: 'profit_pct',           label: 'Profit Margin',     value: 15,   unit: '%',      category: 'financial', description: 'Company profit margin applied to each project' },
    { key: 'gst_pct',              label: 'GST Rate',          value: 8.9,  unit: '%',      category: 'financial', description: 'GST percentage applied to total project cost' },
    { key: 'cable_extra_pct',      label: 'Cable Extra %',     value: 15,   unit: '%',      category: 'sizing',    description: 'Extra cable length buffer added for routing and safety' },
    { key: 'peak_sun_hours',       label: 'Peak Sun Hours',    value: 5,    unit: 'hrs',    category: 'sizing',    description: 'Average peak sun hours per day for the region' },
    { key: 'system_efficiency',    label: 'System Efficiency', value: 80,   unit: '%',      category: 'sizing',    description: 'Overall system efficiency including losses (80 = 80%)' },
    { key: 'panel_warranty_years', label: 'Panel Warranty',    value: 25,   unit: 'years',  category: 'general',   description: 'Solar panel performance warranty years shown in quotation' },
    { key: 'grid_inflation_pct',  label: 'Grid Inflation Rate', value: 3,  unit: '%/yr',   category: 'financial', description: 'Annual electricity tariff increase rate used for ROI projections' },
    { key: 'emi_rate_pct',        label: 'EMI Interest Rate',  value: 9,    unit: '%',      category: 'financial', description: 'Annual interest rate used for all loan / EMI calculations' },
    { key: 'system_life_years',   label: 'System Life',        value: 25,   unit: 'years',  category: 'general',   description: 'Expected useful life of the solar system used for ROI calculations' },
    { key: 'electricity_rate',    label: 'Default Electricity Rate', value: 8, unit: '₹/kWh', category: 'financial', description: 'Default electricity tariff per unit used when salesperson does not enter one' },
  ];

  await Promise.all(
    systemParamDefs.map(p =>
      prisma.systemParam.upsert({
        where: { key: p.key },
        update: {},
        create: p,
      })
    )
  );

  // ─── Editable Formulas ─────────────────────────────────────────────────
  type FormulaSpec = {
    slug: string; name: string; description: string; sortOrder: number;
    expression: string; variables: string[]; versionDesc: string;
  };

  const formulaSpecs: FormulaSpec[] = [
    {
      slug: 'roi', name: 'ROI Calculation',
      description: 'Calculates payback period in years',
      sortOrder: 1,
      expression: 'totalAmount / (annualSavings > 0 ? annualSavings : 1)',
      variables: ['totalAmount', 'annualSavings'],
      versionDesc: 'Payback years = Total cost / Annual savings',
    },
    {
      slug: 'emi', name: 'EMI Calculation',
      description: 'Monthly EMI for bank loan',
      sortOrder: 2,
      expression: 'P * r * pow(1 + r, n) / (pow(1 + r, n) - 1)',
      variables: ['P', 'r', 'n'],
      versionDesc: 'Standard EMI formula: P·r·(1+r)^n / ((1+r)^n - 1)',
    },
    {
      slug: 'system-size', name: 'System Size',
      description: 'Calculates required solar plant capacity (kW) from annual electricity usage',
      sortOrder: 3,
      expression: '(yearly_units / 300) / 4',
      variables: ['yearly_units'],
      versionDesc: 'kW = yearly units ÷ 300 ÷ 4 (standard sizing formula)',
    },
    {
      slug: 'average-units', name: 'Average Monthly Units',
      description: 'Calculates average monthly electricity consumption',
      sortOrder: 4,
      expression: 'total_units / months_count',
      variables: ['total_units', 'months_count'],
      versionDesc: 'Average = Total units / Number of months',
    },
    {
      slug: 'dc-cable-length', name: 'DC Cable Length',
      description: 'Estimates total DC cable required based on building height',
      sortOrder: 5,
      expression: 'building_height * 2',
      variables: ['building_height'],
      versionDesc: 'DC cable = building height × 2 (up and back)',
    },
    {
      slug: 'ac-cable-length', name: 'AC Cable Length',
      description: 'Estimates total AC cable required (slightly more than height)',
      sortOrder: 6,
      expression: 'building_height * 1.15',
      variables: ['building_height'],
      versionDesc: 'AC cable = building height × 1.15',
    },
    {
      slug: 'profit', name: 'Profit',
      description: 'Company margin added to each project',
      sortOrder: 7,
      expression: 'base_cost * profit_pct / 100',
      variables: ['base_cost', 'profit_pct'],
      versionDesc: 'Profit = Base cost × Profit % / 100',
    },
    {
      slug: 'gst', name: 'GST Amount',
      description: 'GST applied to total project cost',
      sortOrder: 8,
      expression: 'total_cost * gst_pct / 100',
      variables: ['total_cost', 'gst_pct'],
      versionDesc: 'GST = Total cost × GST rate / 100',
    },
    {
      slug: 'base-cost', name: 'Base Cost',
      description: 'Total hardware cost before profit and GST',
      sortOrder: 9,
      expression: 'system_kw * 1000 * price_per_watt',
      variables: ['system_kw', 'price_per_watt'],
      versionDesc: 'Base cost = System kW × 1000 × Price per watt',
    },
    {
      slug: 'annual-generation', name: 'Annual Energy Generation',
      description: 'Estimated annual electricity produced by the solar system',
      sortOrder: 10,
      expression: 'system_kw * peak_sun_hours * 365 * system_efficiency',
      variables: ['system_kw', 'peak_sun_hours', 'system_efficiency'],
      versionDesc: 'Annual kWh = System kW × Peak sun hours × 365 × Efficiency',
    },
    {
      slug: 'daily-production', name: 'Daily Energy Production',
      description: 'Estimated daily electricity output (used in Quick Quotation)',
      sortOrder: 11,
      expression: 'system_kw * peak_sun_hours',
      variables: ['system_kw', 'peak_sun_hours'],
      versionDesc: 'Daily kWh = System kW × Peak sun hours (no efficiency derating)',
    },
    {
      slug: 'annual-savings', name: 'Annual Savings',
      description: 'Estimated annual electricity bill savings',
      sortOrder: 12,
      expression: 'annual_gen_kwh * electricity_rate',
      variables: ['annual_gen_kwh', 'electricity_rate'],
      versionDesc: 'Annual savings = Annual kWh × Electricity rate per unit',
    },
    {
      slug: 'roof-area', name: 'Roof Area Required',
      description: 'Estimated rooftop space required for the solar system',
      sortOrder: 13,
      expression: 'system_kw * 80',
      variables: ['system_kw'],
      versionDesc: 'Roof area (sq.ft) = System kW × 80',
    },
  ];

  for (const spec of formulaSpecs) {
    const formula = await prisma.formula.upsert({
      where: { slug: spec.slug },
      update: {},
      create: { name: spec.name, slug: spec.slug, description: spec.description, sortOrder: spec.sortOrder },
    });
    const versionCount = await prisma.formulaVersion.count({ where: { formulaId: formula.id } });
    if (versionCount === 0) {
      await prisma.formulaVersion.create({
        data: {
          formulaId: formula.id,
          expression: spec.expression,
          variables: spec.variables,
          description: spec.versionDesc,
          isActive: true,
          createdById: admin.id,
        },
      });
    }
  }

  // ─── Default Quotation Template ───────────────────────────────────────
  const existingTemplate = await prisma.quotationTemplate.findFirst({ where: { isActive: true } });
  if (!existingTemplate) {
    await prisma.quotationTemplate.create({
      data: {
        version: 1,
        name: 'Default Template',
        isActive: true,
        createdById: admin.id,
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
          { srNo: 1, name: 'Solar Panels',                      specification: '575 Wp Mono PERC, DCR Certified',            make: 'Tier-1 Make (Adani / Waaree / Vikram)' },
          { srNo: 2, name: 'Solar Inverter',                    specification: 'Grid-Tied On-Grid Inverter',                  make: 'MNRE Listed Make (Solis / Growatt)' },
          { srNo: 3, name: 'Mounting Structure',                specification: 'GI / Aluminium, Fixed Tilt',                 make: 'Standard Make' },
          { srNo: 4, name: 'DC Cables',                         specification: 'Solar Grade UV Resistant',                   make: 'ISI Marked (Polycab / RR Kabel)' },
          { srNo: 5, name: 'AC Cables',                         specification: 'Armoured FR-PVC, ISI Marked',                make: 'ISI Marked (Polycab / Havells)' },
          { srNo: 6, name: 'Protection Devices (ACDB/DCDB)',   specification: 'With SPD, Surge Protection',                 make: 'Standard Make (SIEMENS / Hager)' },
          { srNo: 7, name: 'Earthing & Grounding',             specification: 'Standard Copper Plate Earthing',             make: 'Standard' },
          { srNo: 8, name: 'Remote Monitoring System',         specification: 'Cloud-Based Performance Monitoring',         make: 'Inverter Brand App / Portal' },
          { srNo: 9, name: 'Installation & Commissioning',     specification: 'Complete Turnkey, Net Metering Included',    make: 'Rolling Energy Team' },
        ],
        introLetterBody: [
          "We are delighted to present this detailed proposal for the installation of a {{system_size}} kW Grid-Connected Rooftop Solar Power System at your premises. At Rolling Energy, we specialize in delivering turnkey solar solutions that combine cutting-edge technology, premium materials, and expert engineering to maximize your return on investment.",
          "This proposal has been prepared after careful consideration of your energy consumption patterns, roof space availability, and local grid conditions. The system outlined herein is designed to significantly reduce your electricity bills, contribute to a cleaner environment, and deliver a strong financial return over its 25-year operational life.",
          "The proposal includes a complete Bill of Materials, detailed cost breakdown, government subsidy calculations under the PM Surya Ghar Muft Bijli Yojana scheme, and a comprehensive ROI analysis with EMI financing options tailored to your needs.",
          "We invite you to review this proposal and welcome any queries or clarifications you may have. Our technical team is available for a detailed walkthrough at your convenience.",
          "We look forward to partnering with you on your journey towards energy independence and sustainable savings.",
        ],
        aboutParagraphs: [
          "Rolling Energy is a premier Solar EPC (Engineering, Procurement & Construction) company committed to delivering world-class rooftop and ground-mounted solar solutions across India. Founded by industry veterans, we bring decades of combined experience in power systems, project management, and renewable energy.",
          "We partner with India's leading panel and inverter manufacturers to source only Grade-A, BIS-certified equipment, ensuring every system we install delivers peak performance for 25+ years with minimal maintenance.",
          "From a single rooftop installation to large commercial arrays, our integrated approach covers every stage — site survey, system design, procurement, installation, net metering registration, and ongoing AMC — under one roof.",
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
          { step: '01', title: 'Site Survey', subtitle: 'Assessment & Planning', desc: 'Our certified engineers visit the site to assess roof structure, orientation, shading analysis, electrical load, and grid connection feasibility. A detailed site report is prepared as the foundation for system design.', icon: '📍', duration: '1–2 Days' },
          { step: '02', title: 'System Design', subtitle: 'Engineering & Yield Analysis', desc: 'Using advanced solar simulation software, we design an optimised system layout — panel placement, string configuration, inverter sizing, and cable routing — with shadow-free maximum yield calculations.', icon: '📐', duration: '2–3 Days' },
          { step: '03', title: 'Proposal', subtitle: 'Quotation & Approvals', desc: 'We present a transparent, detailed quotation with complete BOM, cost breakdown, subsidy calculations, ROI analysis, and EMI options. We assist with any approvals or DISCOM applications required.', icon: '📋', duration: '1 Day' },
          { step: '04', title: 'Installation', subtitle: 'Civil & Electrical Work', desc: "Our trained installation team handles all civil work (mounting structure), panel installation, inverter and ACDB/DCDB wiring, grid connection, and earthing — strictly following MNRE/BIS standards.", icon: '🔧', duration: '2–5 Days' },
          { step: '05', title: 'Commissioning', subtitle: 'Testing & Net Metering', desc: 'Comprehensive system testing is followed by grid synchronisation and net meter registration with your DISCOM. We handle all paperwork end-to-end so the system is live and billing-optimised from day one.', icon: '⚡', duration: '3–7 Days' },
          { step: '06', title: 'Monitoring & AMC', subtitle: 'Lifetime Support', desc: 'Remote monitoring via cloud dashboard tracks real-time generation, consumption, and alerts. Our AMC programme ensures proactive maintenance, panel cleaning, and inverter health checks throughout the system life.', icon: '📊', duration: 'Ongoing' },
        ],
        processTimelineText: 'Total Timeline: 10–18 Working Days',
        maintenanceServices: [
          { icon: '🔍', title: 'Annual Inspection', desc: 'Full system inspection twice a year — panel torque checks, wiring integrity, inverter health diagnostics, and earthing resistance testing.' },
          { icon: '🧹', title: 'Panel Cleaning', desc: 'Scheduled panel surface cleaning using deionised water and soft brushes to maintain >98% optical transmission. Soiling can reduce output by 15–25%.' },
          { icon: '📡', title: 'Remote Monitoring', desc: 'Cloud-based performance monitoring with real-time generation data, fault alerts via SMS/email, and monthly performance reports sent to your inbox.' },
          { icon: '⚙️', title: 'Inverter Service', desc: 'Firmware updates, fan replacement, and electrolytic capacitor checks at manufacturer-recommended intervals to maximise inverter life.' },
          { icon: '🔌', title: 'Electrical Safety Check', desc: 'Annual DCDB/ACDB inspection, MCB/MCCB testing, SPD functionality verification, and earthing loop impedance measurement per IS:3043.' },
          { icon: '🚨', title: 'Emergency Support', desc: '48-hour on-site response SLA for critical faults. Remote diagnosis within 4 hours. Priority spares dispatched same business day.' },
        ],
        warrantyItems: [
          { item: 'Solar Module Performance', warranty: '{{panel_warranty_years}}-Year Linear Output Guarantee (≥80% at year {{panel_warranty_years}})' },
          { item: 'Solar Module Product', warranty: '12-Year Manufacturing Defect Warranty' },
          { item: 'Solar Inverter', warranty: '5-Year Standard (Extendable to 10 Years)' },
          { item: 'Mounting Structure', warranty: '10-Year Structural Integrity Warranty' },
          { item: 'Workmanship & Installation', warranty: '5-Year Rolling Energy Workmanship Warranty' },
          { item: 'DC/AC Cables & Connectors', warranty: 'Lifetime (as per IS specification)' },
        ],
        paymentMilestones: [
          { step: '01', title: 'Order Confirmation', pct: 50, desc: 'Token advance upon signing of agreement. Enables procurement of all equipment and scheduling of installation team.', icon: '✅' },
          { step: '02', title: 'Material Delivery', pct: 40, desc: 'Payment before delivery of all equipment to site. Modules, inverter, mounting structure and BOS components.', icon: '📦' },
          { step: '03', title: 'After Commissioning', pct: 10, desc: 'Final payment post successful installation, testing, and handover with commissioning certificate.', icon: '⚡' },
        ],
        paymentTermsBullets: [
          'Quotation valid for 30 days from the date of issue.',
          'Prices subject to revision if material costs change significantly (>5%) before order confirmation.',
          'PM Surya Ghar subsidy is subject to DISCOM approval and government policy at time of commissioning.',
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
          { icon: '🏅', title: 'MNRE Certified Installer', desc: 'Officially empanelled with the Ministry of New & Renewable Energy. Our installations meet all government standards and qualify for central subsidies.' },
          { icon: '🔬', title: 'Grade-A DCR Equipment', desc: 'We source only BIS/DCR certified Tier-1 solar panels and MNRE-listed inverters. No compromises on quality — ever.' },
          { icon: '📋', title: 'Subsidy Specialists', desc: 'Our team handles every step of PM Surya Ghar subsidy — from application to disbursement — at zero additional cost to you.' },
          { icon: '🔧', title: 'Certified Installation Team', desc: 'All our engineers are certified solar installers with hands-on training from NISE/TERI. Safety-first approach on every project.' },
          { icon: '📊', title: 'Transparent Pricing', desc: 'No hidden charges. Detailed BOM and cost breakdown provided upfront. What you see in this proposal is exactly what you pay.' },
          { icon: '🛡️', title: '5-Year Workmanship Warranty', desc: 'We back our installations with a comprehensive 5-year workmanship warranty in addition to manufacturer warranties on all equipment.' },
          { icon: '📡', title: 'Remote Monitoring Included', desc: 'Real-time performance monitoring via cloud dashboard from day one. Track generation, savings, and carbon offset from your phone.' },
          { icon: '🤝', title: 'Dedicated Project Manager', desc: 'A dedicated project manager is assigned to every client — single point of contact from survey to commissioning and beyond.' },
          { icon: '⚡', title: 'Fast Turnaround', desc: "From signed agreement to commissioned system in just 10–18 working days. India's fastest certified solar installation programme." },
        ],
        testimonials: [
          { name: 'Prakash M.', location: 'Pune, Maharashtra', text: '"Rolling Energy installed our 5 kW system in just 12 days. Subsidy received within a month. Excellent service!"' },
          { name: 'Sanjay K.', location: 'Ahmedabad, Gujarat', text: '"Transparent pricing, premium panels, and the remote monitoring app is brilliant. Electricity bill dropped by 85%."' },
        ],
        certifications: [
          '✅ MNRE Empanelled Installer',
          '✅ BIS Certified Products',
          '✅ DCR Panel Compliant',
          '✅ ISO Certified Process',
          '✅ DISCOM Registered',
        ],
      },
    });
    console.log('Default quotation template created.');
  }

  console.log('Seed completed:', {
    users: [admin.email, sales.email],
    categories: categories.length,
    pricingTypes: 3,
    formulas: formulaSpecs.length,
    systemParams: systemParamDefs.length,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
