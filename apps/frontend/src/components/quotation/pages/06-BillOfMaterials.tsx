import QuotationHeader from '../QuotationHeader';
import QuotationFooter from '../QuotationFooter';
import type { QuotationMaterial, TemplateConfig, TemplateBomItem } from '../../../types/quotation-template';

interface Props {
  quoteNumber: string;
  systemSizeKw: number;
  inverterSizeKw: number;
  materials: QuotationMaterial[];
  config?: TemplateConfig | null;
}

// Standard inverter sizes (kW) — pick closest for BOM specification
const INVERTER_SIZES = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 50, 75, 100];

function closestInverterKw(kw: number): number {
  if (kw <= 0) return 1;
  const above = INVERTER_SIZES.find(s => s >= kw);
  const below = [...INVERTER_SIZES].reverse().find(s => s <= kw);
  if (above == null) return INVERTER_SIZES[INVERTER_SIZES.length - 1]!;
  if (below == null) return INVERTER_SIZES[0]!;
  return (kw - below) <= (above - kw) ? below : above;
}

// Simplified default BOM — used when template has no custom items configured
function defaultBOM(systemSizeKw: number, inverterSizeKw: number): TemplateBomItem[] {
  const numPanels = Math.ceil((systemSizeKw * 1000) / 575);
  const invKw = closestInverterKw(inverterSizeKw);
  return [
    { srNo: 1, name: 'Solar Panels',                     specification: `${numPanels} × 575 Wp Mono PERC, DCR Certified`,       make: 'Tier-1 Make (Adani / Waaree / Vikram)' },
    { srNo: 2, name: 'Solar Inverter',                   specification: `${invKw} kW Grid-Tied On-Grid Inverter`,               make: 'MNRE Listed Make (Solis / Growatt)' },
    { srNo: 3, name: 'Mounting Structure',               specification: 'GI / Aluminium, Fixed Tilt',                            make: 'Standard Make' },
    { srNo: 4, name: 'DC Cables',                        specification: 'Solar Grade UV Resistant',                              make: 'ISI Marked (Polycab / RR Kabel)' },
    { srNo: 5, name: 'AC Cables',                        specification: 'Armoured FR-PVC, ISI Marked',                           make: 'ISI Marked (Polycab / Havells)' },
    { srNo: 6, name: 'Protection Devices (ACDB/DCDB)',  specification: 'With SPD, Surge Protection',                            make: 'Standard Make (SIEMENS / Hager)' },
    { srNo: 7, name: 'Earthing & Grounding',             specification: 'Standard Copper Plate Earthing',                       make: 'Standard' },
    { srNo: 8, name: 'Remote Monitoring System',         specification: 'Cloud-Based Performance Monitoring',                   make: 'Inverter Brand App / Portal' },
    { srNo: 9, name: 'Installation & Commissioning',     specification: 'Complete Turnkey, Net Metering Included',              make: 'Rolling Energy Team' },
  ];
}

export default function BillOfMaterials({ quoteNumber, systemSizeKw, inverterSizeKw, materials, config }: Props) {
  // Column visibility is controlled by admin via template config
  // Default: Qty and Unit are hidden (simplified customer view)
  const showQty  = config?.bomShowQty  ?? false;
  const showUnit = config?.bomShowUnit ?? false;

  // BOM items: saved quotation materials → template config items → system default
  let bom: TemplateBomItem[];
  if (materials.length > 0) {
    bom = materials.map(m => ({
      srNo: m.srNo,
      name: m.name,
      specification: m.specification,
      make: m.make,
      quantity: m.quantity,
      unit: m.unit,
    }));
  } else if (config?.bomItems && Array.isArray(config.bomItems) && config.bomItems.length > 0) {
    bom = config.bomItems as TemplateBomItem[];
  } else {
    bom = defaultBOM(systemSizeKw, inverterSizeKw);
  }

  // Replace {{inverter_size_kw}} placeholder in template BOM items if present
  const invKw = closestInverterKw(inverterSizeKw);
  bom = bom.map(item => ({
    ...item,
    specification: (item.specification ?? '').replace(/\{\{inverter_size_kw\}\}/g, String(invKw)),
  }));

  // Build grid template dynamically based on visible columns
  const gridCols = [
    '36px',            // Sr.
    '1fr',             // Item
    '2fr',             // Specification
    '1fr',             // Make
    showQty  ? '60px' : null,
    showUnit ? '60px' : null,
  ].filter(Boolean).join(' ');

  return (
    <div className="quotation-page flex flex-col" style={{ background: '#ffffff' }}>
      <QuotationHeader quoteNumber={quoteNumber} pageTitle="Bill of Materials" pageNumber={6} totalPages={13} />

      <div className="flex-1 px-12 py-6" style={{ paddingBottom: '36px' }}>
        <div className="mb-5">
          <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: '#6690cc' }}>
            Material Schedule
          </p>
          <h2
            className="text-2xl font-bold"
            style={{ color: '#161c34', fontFamily: 'Poppins, sans-serif' }}
          >
            Equipment &amp; Materials List
          </h2>
          <div className="mt-2 h-0.5 w-12" style={{ background: '#6690cc' }} />
        </div>

        <div className="quotation-no-break rounded-xl overflow-hidden border" style={{ borderColor: '#e5e7eb' }}>
          {/* Table header */}
          <div
            className="grid text-xs font-semibold"
            style={{
              background: '#161c34',
              color: '#ffffff',
              gridTemplateColumns: gridCols,
              padding: '10px 16px',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            <div>Sr.</div>
            <div>Item</div>
            <div>Specification</div>
            <div>Make / Brand</div>
            {showQty  && <div className="text-center">Qty</div>}
            {showUnit && <div className="text-center">Unit</div>}
          </div>

          {/* Rows */}
          {bom.map((item, idx) => (
            <div
              key={item.srNo}
              className="grid items-start py-2 px-4"
              style={{
                gridTemplateColumns: gridCols,
                background: idx % 2 === 0 ? '#ffffff' : '#f9fafb',
                borderBottom: '1px solid #f3f4f6',
                fontSize: '11px',
              }}
            >
              <div className="text-gray-400 font-medium pt-0.5">{item.srNo}</div>
              <div className="font-semibold leading-tight pt-0.5" style={{ color: '#161c34' }}>
                {item.name}
              </div>
              <div className="text-gray-500 leading-relaxed pr-2">{item.specification}</div>
              <div className="text-gray-600 font-medium leading-tight pt-0.5">{item.make}</div>
              {showQty  && (
                <div className="text-center font-bold pt-0.5" style={{ color: '#6690cc' }}>
                  {item.quantity ?? '—'}
                </div>
              )}
              {showUnit && (
                <div className="text-center text-gray-500 pt-0.5">{item.unit ?? '—'}</div>
              )}
            </div>
          ))}
        </div>

        {/* Note */}
        <p className="text-xs text-gray-400 mt-3 italic">
          * All materials are supplied with manufacturer warranty cards. Exact make/model subject to availability at time of procurement.
          DCR panels are used wherever applicable for subsidy eligibility.
        </p>
      </div>

      <QuotationFooter quoteNumber={quoteNumber} pageNumber={6} />
    </div>
  );
}
