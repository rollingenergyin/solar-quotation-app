import QuotationHeader from '../QuotationHeader';
import QuotationFooter from '../QuotationFooter';
import ProposalNoteBlock from '../ProposalNoteBlock';
import type {
  QuotationBomOption,
  QuotationMaterial,
  TemplateConfig,
  TemplateBomItem,
} from '../../../types/quotation-template';
import { bomItemHasAlternatives } from '@/constants/bom-items';
import type { ProposalNote } from '@/constants/proposal-note';

interface Props {
  quoteNumber: string;
  systemSizeKw: number;
  inverterSizeKw: number;
  materials: QuotationMaterial[];
  bomOptions?: QuotationBomOption[];
  config?: TemplateConfig | null;
  panelWattageWp?: number;
  numModules?: number;
  structureType?: string | null;
  meterPhase?: string | null;
  supplementaryCosts?: {
    dcCableMeters: number;
    acCableMeters: number;
  } | null;
  pageNumber?: number;
  totalPages?: number;
  proposalNote?: ProposalNote | null;
}

const INVERTER_SIZES = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 50, 75, 100];

function closestInverterKw(kw: number): number {
  if (kw <= 0) return 1;
  const above = INVERTER_SIZES.find(s => s >= kw);
  const below = [...INVERTER_SIZES].reverse().find(s => s <= kw);
  if (above == null) return INVERTER_SIZES[INVERTER_SIZES.length - 1]!;
  if (below == null) return INVERTER_SIZES[0]!;
  return (kw - below) <= (above - kw) ? below : above;
}

function defaultBOM(
  systemSizeKw: number,
  inverterSizeKw: number,
  panelWatt = 575,
  numPanelsOverride?: number,
  structureLabel?: string | null,
  meterPhase?: string | null,
  cableMeters?: { dc: number; ac: number } | null,
): TemplateBomItem[] {
  const numPanels = numPanelsOverride ?? Math.ceil((systemSizeKw * 1000) / panelWatt);
  const invKw = closestInverterKw(inverterSizeKw);
  const phaseNote = meterPhase === 'Three Phase' ? ' — Three Phase' : '';
  const dcSpec = cableMeters
    ? `Solar Grade UV Resistant (~${cableMeters.dc} m run)`
    : 'Solar Grade UV Resistant';
  const acSpec = cableMeters
    ? `Armoured FR-PVC, ISI Marked (~${cableMeters.ac} m run${phaseNote})`
    : `Armoured FR-PVC, ISI Marked${phaseNote}`;
  return [
    { srNo: 1, name: 'Solar Panels', specification: `${numPanels} × ${panelWatt} Wp Mono PERC, DCR Certified`, make: 'Tier-1 Make (Adani / Waaree / Vikram)' },
    { srNo: 2, name: 'Solar Inverter', specification: `${invKw} kW Grid-Tied On-Grid Inverter`, make: 'MNRE Listed Make (Solis / Growatt)' },
    { srNo: 3, name: 'Mounting Structure', specification: structureLabel ?? 'GI / Aluminium, Fixed Tilt', make: 'Standard Make' },
    { srNo: 4, name: 'DC Cables', specification: dcSpec, make: 'ISI Marked (Polycab / RR Kabel)' },
    { srNo: 5, name: 'AC Cables', specification: acSpec, make: 'ISI Marked (Polycab / Havells)' },
    { srNo: 6, name: 'Protection Devices (ACDB/DCDB)', specification: 'With SPD, Surge Protection', make: 'Standard Make (SIEMENS / Hager)' },
    { srNo: 7, name: 'Earthing & Grounding', specification: 'Standard Copper Plate Earthing', make: 'Standard' },
    { srNo: 8, name: 'Remote Monitoring System', specification: 'Cloud-Based Performance Monitoring', make: 'Inverter Brand App / Portal' },
    { srNo: 9, name: 'Installation & Commissioning', specification: 'Complete Turnkey, Net Metering Included', make: 'Rolling Energy Team' },
  ];
}

function BomInlineOr() {
  return (
    <span
      className="inline-flex items-center justify-center text-[8px] font-bold tracking-widest uppercase rounded-full px-1.5 py-0.5 my-0.5"
      style={{
        color: '#ffffff',
        background: 'linear-gradient(135deg, #161c34, #6690cc)',
        fontFamily: 'Poppins, sans-serif',
      }}
    >
      or
    </span>
  );
}

function BomAlternativesStack({
  values,
  className = '',
}: {
  values: string[];
  className?: string;
}) {
  const parts = values.map((v) => v.trim()).filter(Boolean);
  if (!parts.length) return <span className="text-gray-300">—</span>;
  if (parts.length === 1) {
    return <span className={className}>{parts[0]}</span>;
  }

  return (
    <div className={`space-y-0.5 ${className}`}>
      {parts.map((part, i) => (
        <div key={i} className="leading-snug">
          {i > 0 && <BomInlineOr />}
          <div>{part}</div>
        </div>
      ))}
    </div>
  );
}

function BomTable({
  bom,
  showQty,
  showUnit,
  invKw,
  compact = false,
}: {
  bom: TemplateBomItem[];
  showQty: boolean;
  showUnit: boolean;
  invKw: number;
  compact?: boolean;
}) {
  const rows = bom.map(item => ({
    ...item,
    specification: (item.specification ?? '').replace(/\{\{inverter_size_kw\}\}/g, String(invKw)),
    alternatives: item.alternatives?.map((alt) => ({
      ...alt,
      specification: (alt.specification ?? '').replace(/\{\{inverter_size_kw\}\}/g, String(invKw)),
    })),
  }));

  const gridCols = [
    '36px',
    '1fr',
    '2fr',
    '1fr',
    showQty ? '60px' : null,
    showUnit ? '60px' : null,
  ].filter(Boolean).join(' ');

  return (
    <div className="quotation-no-break rounded-xl overflow-hidden border" style={{ borderColor: '#e5e7eb' }}>
      <div
        className="grid text-xs font-semibold"
        style={{
          background: '#161c34',
          color: '#ffffff',
          gridTemplateColumns: gridCols,
          padding: compact ? '5px 12px' : '10px 16px',
          fontFamily: 'Poppins, sans-serif',
          fontSize: compact ? '9.5px' : undefined,
        }}
      >
        <div>Sr.</div>
        <div>Item</div>
        <div>Specification</div>
        <div>Make / Brand</div>
        {showQty && <div className="text-center">Qty</div>}
        {showUnit && <div className="text-center">Unit</div>}
      </div>

      {rows.map((item, idx) => {
        const specValues = [
          item.specification,
          ...(item.alternatives?.map((alt) => alt.specification) ?? []),
        ];
        const makeValues = [
          item.make,
          ...(item.alternatives?.map((alt) => alt.make) ?? []),
        ];

        return (
          <div
            key={`${item.srNo}-${idx}`}
            className={`grid items-start ${compact ? 'py-1 px-3' : 'py-2 px-4'}`}
            style={{
              gridTemplateColumns: gridCols,
              background: idx % 2 === 0 ? '#ffffff' : '#f9fafb',
              borderBottom: '1px solid #f3f4f6',
              fontSize: compact ? '9.5px' : '11px',
            }}
          >
            <div className="text-gray-400 font-medium pt-0.5">{item.srNo}</div>
            <div className="font-semibold leading-tight pt-0.5" style={{ color: '#161c34' }}>
              {item.name}
            </div>
            <BomAlternativesStack values={specValues} className="text-gray-500 leading-relaxed pr-2" />
            <BomAlternativesStack values={makeValues} className="text-gray-600 font-medium leading-tight pt-0.5" />
            {showQty && (
              <div className="text-center font-bold pt-0.5" style={{ color: '#6690cc' }}>
                {item.quantity ?? '—'}
              </div>
            )}
            {showUnit && (
              <div className="text-center text-gray-500 pt-0.5">{item.unit ?? '—'}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function BillOfMaterials({
  quoteNumber, systemSizeKw, inverterSizeKw, materials,
  bomOptions, config, panelWattageWp, numModules, structureType, meterPhase, supplementaryCosts,
  pageNumber = 6, totalPages = 13, proposalNote,
}: Props) {
  const showQty = config?.bomShowQty ?? false;
  const showUnit = config?.bomShowUnit ?? false;
  const invKw = closestInverterKw(inverterSizeKw);

  let fallbackBom: TemplateBomItem[];

  if (config?.bomItems?.length) {
    fallbackBom = config.bomItems;
  } else if (materials.length > 0) {
    fallbackBom = materials.map(m => ({
      srNo: m.srNo,
      name: m.name,
      specification: m.specification,
      make: m.make,
      quantity: m.quantity,
      unit: m.unit,
    }));
  } else {
    fallbackBom = defaultBOM(
      systemSizeKw,
      inverterSizeKw,
      panelWattageWp ?? 575,
      numModules,
      structureType,
      meterPhase,
      supplementaryCosts
        ? { dc: supplementaryCosts.dcCableMeters, ac: supplementaryCosts.acCableMeters }
        : null,
    );
  }

  const resolvedOptions: QuotationBomOption[] = bomOptions?.length
    ? bomOptions.slice(0, 2)
    : [{
        id: 'default',
        templateId: 'default',
        templateName: 'Default BOM',
        title: '',
        items: fallbackBom,
      }];
  const comparison = resolvedOptions.length > 1;
  const hasAlternatives = resolvedOptions.some((option) =>
    option.items.some(bomItemHasAlternatives),
  );

  return (
    <div className="quotation-page flex flex-col" style={{ background: '#ffffff' }}>
      <QuotationHeader quoteNumber={quoteNumber} pageTitle="Bill of Materials" pageNumber={pageNumber} totalPages={totalPages} />

      <div
        className={`flex-1 px-12 ${comparison ? 'py-3' : 'py-6'}`}
        style={{ paddingBottom: '36px' }}
      >
        <div className={comparison ? 'mb-2' : 'mb-5'}>
          <h2
            className={`${comparison ? 'text-xl' : 'text-2xl'} font-bold`}
            style={{ color: '#161c34', fontFamily: 'Poppins, sans-serif' }}
          >
            Equipment &amp; Materials List
          </h2>
          <div className="mt-2 h-0.5 w-12" style={{ background: '#6690cc' }} />
        </div>

        {resolvedOptions.map((option, index) => (
          <div key={option.id} className="quotation-no-break">
            {index > 0 && (
              <div className="flex items-center gap-3 my-1" aria-label="Alternative BOM">
                <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, #6690cc)' }} />
                <span
                  className="rounded-full px-3 py-1 text-[9px] font-bold tracking-widest"
                  style={{ color: '#ffffff', background: 'linear-gradient(135deg, #161c34, #6690cc)' }}
                >
                  OR
                </span>
                <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, #6690cc, transparent)' }} />
              </div>
            )}
            {(comparison || option.title) && (
              <p
                className={`${comparison ? 'text-[11px] mb-1' : 'text-sm mb-2'} font-bold`}
                style={{ color: '#161c34', fontFamily: 'Poppins, sans-serif' }}
              >
                {option.title || `BOM Option ${index + 1}`}
              </p>
            )}
            <BomTable
              bom={option.items}
              showQty={showQty}
              showUnit={showUnit}
              invKw={invKw}
              compact={comparison}
            />
          </div>
        ))}

        <p className={`${comparison ? 'text-[9px] mt-1.5' : 'text-xs mt-3'} text-gray-400 italic`}>
          * All materials are supplied with manufacturer warranty cards. Exact make/model subject to availability at time of procurement.
          {comparison || hasAlternatives ? ' Where OR is shown, alternative system options with different pricing may be offered.' : ''}
        </p>

        <ProposalNoteBlock placement="bill_of_materials" proposalNote={proposalNote} />
      </div>

      <QuotationFooter quoteNumber={quoteNumber} pageNumber={pageNumber} />
    </div>
  );
}
