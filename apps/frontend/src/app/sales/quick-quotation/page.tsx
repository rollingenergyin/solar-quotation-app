'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ROI_DAYS_PER_YEAR } from '@/constants/roi-generation';
import {
  BUILDING_HEIGHT_OPTIONS,
  METER_PHASE_OPTIONS,
  PANEL_WATTAGE_OPTIONS,
  STRUCTURE_CATEGORIES,
  STRUCTURE_OPTIONS,
  DEFAULT_WARRANTY_ITEMS,
  resolvePanelWatt,
  calcNumPanels,
} from '@/constants/quick-quote-options';
import CombinedSystemsEditor from '@/components/quick-quote/CombinedSystemsEditor';
import { AlternativeCostingEditorCard } from '@/components/quick-quote/AlternativeCostingEditor';
import ProposalContentEditors from '@/components/quick-quote/ProposalContentEditors';
import {
  DEFAULT_QUICK_QUOTE_BOM,
  DEFAULT_QUICK_QUOTE_PAYMENT_MILESTONES,
  DEFAULT_QUICK_QUOTE_PAYMENT_MODES,
  DEFAULT_QUICK_QUOTE_TERMS_BULLETS,
} from '@/constants/quick-quote-proposal-defaults';
import {
  bomItemsFromStored,
  serializeBomItems,
} from '@/constants/bom-items';
import {
  warrantyItemsFromStored,
  serializeWarrantyItems,
} from '@/constants/warranty-items';
import type {
  TemplateBomItem,
  TemplatePaymentMilestone,
  TemplatePaymentMode,
  TemplateWarranty,
} from '@/types/quotation-template';
import {
  QUOTATION_MODE_OPTIONS,
  createCombinedSystemRow,
  calculateCombinedSystemsPreview,
  effectivePricePerWattForRow,
  parseOptionalSanctionedLoadKw,
  type QuotationMode,
  type CombinedSystemRow,
} from '@/constants/combined-quotation';
import {
  createCostingOptionRow,
  calculateCostingOptions,
  effectivePricePerWattForOption,
  type CostingOptionRow,
  type CostingSiteType,
} from '@/constants/costing-options';
import { OrSeparator, CostingOptionTitleBox } from '@/components/quotation/CostingSharedBlocks';
import type { ProposalNotePlacement } from '@/constants/proposal-note';
import { shouldShowDepreciationPage } from '@/constants/depreciation';
import { loadSiteCostingResult, loadSiteCostingState } from '@/constants/site-costing';

// ── Constants ─────────────────────────────────────────────────────────────────

const GST_RATE = 0.089;

function totalInclGstFromBase(base: number): number {
  return base + Math.round(base * GST_RATE);
}

/** Inverse of base + round(base × GST_RATE) for whole-rupee gross inputs. */
function baseFromTotalInclGst(gross: number): number {
  const g = Math.round(gross);
  for (let b = Math.max(0, Math.floor(g / (1 + GST_RATE)) - 20); b <= g; b++) {
    if (totalInclGstFromBase(b) === g) return b;
  }
  return Math.round(g / (1 + GST_RATE));
}

const MONTHS = [
  { key: 'jan', label: 'Jan' }, { key: 'feb', label: 'Feb' },
  { key: 'mar', label: 'Mar' }, { key: 'apr', label: 'Apr' },
  { key: 'may', label: 'May' }, { key: 'jun', label: 'Jun' },
  { key: 'jul', label: 'Jul' }, { key: 'aug', label: 'Aug' },
  { key: 'sep', label: 'Sep' }, { key: 'oct', label: 'Oct' },
  { key: 'nov', label: 'Nov' }, { key: 'dec', label: 'Dec' },
];

// ── Live calculation (client-side preview) ────────────────────────────────────

function calcSubsidyPreview(
  kw: number,
  systemType: string,
  siteType: string,
): number {
  if (systemType === 'NON_DCR' || siteType === 'COMMERCIAL' || siteType === 'INDUSTRIAL') return 0;
  if (siteType === 'SOCIETY') return Math.round(kw * 18000);
  if (kw <= 1) return 30000;
  if (kw <= 2) return 60000;
  return 78000;
}

interface LiveSummary {
  systemSizeKw: number;
  roofAreaSqft: number;
  dailyProductionKwh: number;
  annualProductionKwh: number;
  baseCost: number;
  gstAmount: number;
  grossCost: number;
  subsidyAmount: number;
  netCost: number;
  annualSavings: number;
  breakevenYears: number;
  pricePerWattEffective: number;
}

function computeLive(
  systemSizeKw: number,
  pricePerWatt: number,
  electricityRate: number,
  peakSunHours: number,
  systemType: string,
  siteType: string,
): LiveSummary | null {
  if (
    typeof systemSizeKw !== 'number' || systemSizeKw <= 0 ||
    typeof pricePerWatt !== 'number' || pricePerWatt <= 0 ||
    !Number.isFinite(electricityRate) || electricityRate <= 0 ||
    !Number.isFinite(peakSunHours) || peakSunHours <= 0
  ) return null;

  const roofAreaSqft         = Math.round(systemSizeKw * 80);
  const dailyProductionKwh   = Math.round(systemSizeKw * peakSunHours * 10) / 10;
  const annualProductionKwh  = Math.round(dailyProductionKwh * ROI_DAYS_PER_YEAR);

  // Quick Quotation: no profit addition — the entered base cost is the total price
  const baseCost      = Math.round(systemSizeKw * 1000 * pricePerWatt);
  const gstAmount     = Math.round(baseCost * 0.089);
  const grossCost     = baseCost + gstAmount;
  const subsidyAmount = calcSubsidyPreview(systemSizeKw, systemType, siteType);
  const netCost       = Math.max(0, grossCost - subsidyAmount);
  const annualSavings = Math.round(annualProductionKwh * electricityRate);
  const breakevenYears = annualSavings > 0 ? Math.round((netCost / annualSavings) * 10) / 10 : 0;

  // Guard against Infinity/NaN
  const safe = (x: number) => (Number.isFinite(x) ? x : 0);
  return {
    systemSizeKw: safe(systemSizeKw),
    roofAreaSqft: safe(roofAreaSqft),
    dailyProductionKwh: safe(dailyProductionKwh),
    annualProductionKwh: safe(annualProductionKwh),
    baseCost: safe(baseCost),
    gstAmount: safe(gstAmount),
    grossCost: safe(grossCost),
    subsidyAmount: safe(subsidyAmount),
    netCost: safe(netCost),
    annualSavings: safe(annualSavings),
    breakevenYears: safe(breakevenYears),
    pricePerWattEffective: safe(pricePerWatt),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number): string => {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '0';
  try {
    return n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  } catch {
    return String(Math.round(n));
  }
};
const fmtL = (n: number): string => {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return '₹0';
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`;
  return `₹${fmt(n)}`;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function QuickQuotationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Customer
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress]           = useState('');
  const [city, setCity]                 = useState('');
  const [phone, setPhone]               = useState('');
  const [email, setEmail]               = useState('');

  // ── System
  const [systemType, setSystemType] = useState<'DCR' | 'NON_DCR'>('DCR');
  const [siteType, setSiteType]     = useState<'RESIDENTIAL' | 'SOCIETY' | 'COMMERCIAL' | 'INDUSTRIAL'>('RESIDENTIAL');
  const [quotationMode, setQuotationMode] = useState<QuotationMode>('SINGLE');
  const [combinedSystems, setCombinedSystems] = useState<CombinedSystemRow[]>(() => [
    createCombinedSystemRow(1),
    createCombinedSystemRow(2),
  ]);
  const [combinedSingleCosting, setCombinedSingleCosting] = useState(false);

  // ── Sizing
  const [sizingMode, setSizingMode]       = useState<'monthly' | 'direct'>('direct');
  const [monthlyUnits, setMonthlyUnits]   = useState<Record<string, string>>({});
  const [directKw, setDirectKw]           = useState('');
  const [inverterSizeKw, setInverterSizeKw] = useState('');
  const [inverterManuallyEdited, setInverterManuallyEdited] = useState(false);

  // ── Pricing / costing options
  const [costingOptions, setCostingOptions] = useState<CostingOptionRow[]>(() => [
    createCostingOptionRow(1, { systemType: 'DCR', siteType: 'RESIDENTIAL', pricePerWatt: '55' }),
  ]);

  useEffect(() => {
    setCostingOptions((prev) =>
      prev.every((o) => o.systemType === systemType)
        ? prev
        : prev.map((o) => ({ ...o, systemType })),
    );
  }, [systemType]);

  useEffect(() => {
    setCostingOptions((prev) =>
      prev.every((o) => o.siteType === siteType)
        ? prev
        : prev.map((o) => ({ ...o, siteType })),
    );
  }, [siteType]);

  // ── Params
  const [electricityRate, setElectricityRate]     = useState('18');
  const [peakSunHours, setPeakSunHours]           = useState('4');
  const [sanctionedLoadKw, setSanctionedLoadKw]   = useState('');
  const [sanctionedLoadIncreasedToKw, setSanctionedLoadIncreasedToKw] = useState('');
  const [sanctionedLoadIncreasedToManual, setSanctionedLoadIncreasedToManual] = useState(false);

  // ── Site & equipment (Phase 1)
  const [buildingHeight, setBuildingHeight] = useState('G');
  const [buildingHeightCustomFloors, setBuildingHeightCustomFloors] = useState('');
  const [meterPhase, setMeterPhase] = useState<'SINGLE' | 'THREE'>('SINGLE');
  const [panelWattage, setPanelWattage] = useState('DEFAULT');
  const [panelWattageCustom, setPanelWattageCustom] = useState('');
  const [structureCategory, setStructureCategory] = useState<'TRAPEZOID' | 'STANDARD' | 'RAISED'>('STANDARD');
  const [structureOption, setStructureOption] = useState('1ft');

  // ── Deep edit panel (warranties, BOM, payment, T&C — collapsed by default)
  const [deepEditOpen, setDeepEditOpen] = useState(false);
  const [panelWarrantyYears, setPanelWarrantyYears] = useState('25');
  const [warrantyItems, setWarrantyItems] = useState(
    () => DEFAULT_WARRANTY_ITEMS.map((w) => ({ ...w })),
  );

  const [bomItems, setBomItems] = useState<TemplateBomItem[]>(() =>
    bomItemsFromStored(DEFAULT_QUICK_QUOTE_BOM).length
      ? bomItemsFromStored(DEFAULT_QUICK_QUOTE_BOM)
      : DEFAULT_QUICK_QUOTE_BOM.map((b) => ({ ...b })),
  );
  const [paymentMilestones, setPaymentMilestones] = useState<TemplatePaymentMilestone[]>(() =>
    DEFAULT_QUICK_QUOTE_PAYMENT_MILESTONES.map((m) => ({ ...m })),
  );
  const [paymentModes, setPaymentModes] = useState<TemplatePaymentMode[]>(() =>
    DEFAULT_QUICK_QUOTE_PAYMENT_MODES.map((m) => ({ ...m })),
  );
  const [paymentTermsBullets, setPaymentTermsBullets] = useState<string[]>(() =>
    [...DEFAULT_QUICK_QUOTE_TERMS_BULLETS],
  );
  const [proposalNoteText, setProposalNoteText] = useState('');
  const [proposalNotePlacement, setProposalNotePlacement] = useState<ProposalNotePlacement>('executive_summary');

  // ── Form state
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState('');

  // ── Derived system size ───────────────────────────────────────────────────

  const derivedSystemKw = useMemo(() => {
    if (sizingMode === 'direct') {
      const v = parseFloat(directKw);
      return v > 0 ? v : 0;
    }
    const valid = Object.values(monthlyUnits)
      .map(v => parseFloat(v))
      .filter(v => !isNaN(v) && v > 0);
    if (valid.length === 0) return 0;
    const avg = valid.reduce((s, v) => s + v, 0) / valid.length;
    // Formula: (avg_monthly / 100), rounded to nearest 0.5 kW
    return Math.max(1, Math.ceil((avg / 100) * 2) / 2);
  }, [sizingMode, directKw, monthlyUnits]);

  const combinedTotalKw = useMemo(() => {
    if (quotationMode !== 'COMBINED') return 0;
    return combinedSystems.reduce((sum, row) => {
      const kw = parseFloat(row.capacityKw);
      return sum + (Number.isFinite(kw) && kw > 0 ? kw : 0);
    }, 0);
  }, [quotationMode, combinedSystems]);

  const pricingKw =
    quotationMode === 'COMBINED' ? combinedTotalKw : derivedSystemKw;

  const costingOptionsCalculated = useMemo(
    () => calculateCostingOptions(costingOptions, pricingKw),
    [costingOptions, pricingKw],
  );

  const primaryCosting = costingOptionsCalculated[0];

  const showDepreciation = useMemo(
    () => shouldShowDepreciationPage({
      siteType: primaryCosting?.siteType ?? siteType,
      combinedSystems: quotationMode === 'COMBINED' ? combinedSystems : undefined,
    }),
    [primaryCosting?.siteType, siteType, quotationMode, combinedSystems],
  );

  // ── Effective price per watt (primary option) ─────────────────────────────

  const effectivePricePerWatt = useMemo(() => {
    if (primaryCosting) return primaryCosting.pricePerWatt;
    return effectivePricePerWattForOption(costingOptions[0], pricingKw);
  }, [primaryCosting, costingOptions, pricingKw]);

  // Auto-fill inverter size when system size changes (unless manually edited)
  useEffect(() => {
    if (!inverterManuallyEdited && derivedSystemKw > 0) {
      setInverterSizeKw(String(derivedSystemKw));
    }
  }, [derivedSystemKw]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Sanctioned load to be increased to" defaults to proposed system kW (unless user changed it)
  useEffect(() => {
    if (sanctionedLoadIncreasedToManual) return;
    if (derivedSystemKw > 0) {
      setSanctionedLoadIncreasedToKw(String(derivedSystemKw));
    } else {
      setSanctionedLoadIncreasedToKw('');
    }
  }, [derivedSystemKw, sanctionedLoadIncreasedToManual]);

  // Prefill from Site Costing Engine only when opened via that flow (not direct Quick Quote)
  useEffect(() => {
    if (searchParams.get('fromSiteCosting') !== '1') return;

    const kw = searchParams.get('systemKw');
    const ppw = searchParams.get('pricePerWatt');
    if (kw && Number.isFinite(parseFloat(kw))) {
      setSizingMode('direct');
      setDirectKw(kw);
    }
    if (ppw && Number.isFinite(parseFloat(ppw))) {
      const ppwStr = ppw;
      const sizeKw = kw && Number.isFinite(parseFloat(kw)) ? parseFloat(kw) : 0;
      setCostingOptions((prev) => {
        const first = prev[0] ?? createCostingOptionRow(1);
        const p = parseFloat(ppwStr);
        const base = sizeKw > 0 && p > 0 ? Math.round(sizeKw * 1000 * p) : 0;
        return [
          {
            ...first,
            pricePerWatt: ppwStr,
            totalBaseAmount: base > 0 ? String(base) : '',
            totalCostInclGst: base > 0 ? String(totalInclGstFromBase(base)) : '',
          },
          ...prev.slice(1),
        ];
      });
    }
    const bh = searchParams.get('buildingHeight');
    if (bh) setBuildingHeight(bh as typeof buildingHeight);
    const bhf = searchParams.get('buildingHeightCustomFloors');
    if (bhf) setBuildingHeightCustomFloors(bhf);
    const mp = searchParams.get('meterPhase');
    if (mp === 'SINGLE' || mp === 'THREE') setMeterPhase(mp);
    const pw = searchParams.get('panelWattage');
    if (pw) setPanelWattage(pw as typeof panelWattage);
    const pwc = searchParams.get('panelWattageCustom');
    if (pwc) setPanelWattageCustom(pwc);
    const sc = searchParams.get('structureCategory');
    if (sc === 'TRAPEZOID' || sc === 'STANDARD' || sc === 'RAISED') setStructureCategory(sc);
    const so = searchParams.get('structureOption');
    if (so) setStructureOption(so);

    const siteResult = loadSiteCostingResult();
    if (siteResult && !ppw && siteResult.pricePerWatt > 0) {
      const ppwStr = String(siteResult.pricePerWatt);
      setCostingOptions((prev) => {
        const first = prev[0] ?? createCostingOptionRow(1);
        const sizeKw = siteResult.systemSizeKw > 0 ? siteResult.systemSizeKw : parseFloat(directKw) || 0;
        const base = sizeKw > 0 ? Math.round(sizeKw * 1000 * siteResult.pricePerWatt) : 0;
        return [
          {
            ...first,
            pricePerWatt: ppwStr,
            totalBaseAmount: base > 0 ? String(base) : '',
            totalCostInclGst: base > 0 ? String(totalInclGstFromBase(base)) : '',
          },
          ...prev.slice(1),
        ];
      });
    }
    if (siteResult && !kw && siteResult.systemSizeKw > 0) {
      setSizingMode('direct');
      setDirectKw(String(siteResult.systemSizeKw));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load template proposal defaults when system/site type changes
  useEffect(() => {
    api<{
      panelWarrantyYears?: number;
      warrantyItems?: TemplateWarranty[] | null;
      bomItems?: TemplateBomItem[] | null;
      bomOptions?: unknown;
      paymentMilestones?: TemplatePaymentMilestone[];
      paymentModes?: TemplatePaymentMode[];
      paymentTermsBullets?: string[];
    }>(`/templates/active?systemType=${systemType}&siteType=${siteType}`)
      .then((tpl) => {
        if (tpl.panelWarrantyYears) setPanelWarrantyYears(String(tpl.panelWarrantyYears));
        if (tpl.warrantyItems?.length) {
          const loaded = warrantyItemsFromStored(tpl.warrantyItems);
          setWarrantyItems(loaded.length ? loaded : DEFAULT_WARRANTY_ITEMS.map((w) => ({ ...w })));
        } else {
          setWarrantyItems(DEFAULT_WARRANTY_ITEMS.map((w) => ({ ...w })));
        }
        const loaded = bomItemsFromStored(tpl.bomItems, tpl.bomOptions);
        if (loaded.length) {
          setBomItems(loaded);
        } else {
          setBomItems(DEFAULT_QUICK_QUOTE_BOM.map((b) => ({ ...b })));
        }
        if (tpl.paymentMilestones?.length) {
          setPaymentMilestones(tpl.paymentMilestones.map((m) => ({ ...m })));
        } else {
          setPaymentMilestones(DEFAULT_QUICK_QUOTE_PAYMENT_MILESTONES.map((m) => ({ ...m })));
        }
        if (tpl.paymentModes?.length) {
          setPaymentModes(tpl.paymentModes.map((m) => ({ ...m })));
        } else {
          setPaymentModes(DEFAULT_QUICK_QUOTE_PAYMENT_MODES.map((m) => ({ ...m })));
        }
        if (tpl.paymentTermsBullets?.length) {
          setPaymentTermsBullets([...tpl.paymentTermsBullets]);
        } else {
          setPaymentTermsBullets([...DEFAULT_QUICK_QUOTE_TERMS_BULLETS]);
        }
      })
      .catch(() => {
        setPanelWarrantyYears('25');
        setWarrantyItems(DEFAULT_WARRANTY_ITEMS.map((w) => ({ ...w })));
        setBomItems(DEFAULT_QUICK_QUOTE_BOM.map((b) => ({ ...b })));
        setPaymentMilestones(DEFAULT_QUICK_QUOTE_PAYMENT_MILESTONES.map((m) => ({ ...m })));
        setPaymentModes(DEFAULT_QUICK_QUOTE_PAYMENT_MODES.map((m) => ({ ...m })));
        setPaymentTermsBullets([...DEFAULT_QUICK_QUOTE_TERMS_BULLETS]);
      });
  }, [systemType, siteType]);

  const resolvedPanelWatt = useMemo(
    () => resolvePanelWatt(
      panelWattage,
      panelWattageCustom ? parseFloat(panelWattageCustom) : null,
    ),
    [panelWattage, panelWattageCustom],
  );

  const numPanels = useMemo(
    () => calcNumPanels(derivedSystemKw, resolvedPanelWatt),
    [derivedSystemKw, resolvedPanelWatt],
  );

  const totalPanelWatts = numPanels * resolvedPanelWatt;

  // ── Live summary ─────────────────────────────────────────────────────────

  const combinedPreview = useMemo(
    () => calculateCombinedSystemsPreview(
      combinedSystems,
      systemType,
      siteType,
      parseFloat(electricityRate) || 18,
      parseFloat(peakSunHours) || 4,
      combinedSingleCosting
        ? { singleCosting: true, combinedPricePerWatt: effectivePricePerWatt }
        : undefined,
    ),
    [combinedSystems, systemType, siteType, electricityRate, peakSunHours, combinedSingleCosting, effectivePricePerWatt],
  );

  const summary = useMemo(() => {
    if (quotationMode === 'COMBINED') {
      if (!combinedPreview) return null;
      const c = combinedPreview.combined;
      return {
        systemSizeKw: c.systemSizeKw,
        roofAreaSqft: Math.round(c.systemSizeKw * 80),
        dailyProductionKwh: c.dailyProductionKwh,
        annualProductionKwh: c.annualProductionKwh,
        baseCost: c.baseCost,
        gstAmount: c.gstAmount,
        grossCost: c.grossCost,
        subsidyAmount: c.subsidyAmount,
        netCost: c.netCost,
        annualSavings: c.annualSavings,
        breakevenYears: c.breakevenYears,
        pricePerWattEffective: c.blendedPricePerWatt,
      };
    }
    return computeLive(
      derivedSystemKw,
      effectivePricePerWatt,
      parseFloat(electricityRate) || 18,
      parseFloat(peakSunHours) || 4,
      systemType,
      siteType,
    );
  }, [
    quotationMode, combinedPreview, derivedSystemKw, effectivePricePerWatt,
    electricityRate, peakSunHours, systemType, siteType,
  ]);

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setFormError('');

    if (!customerName.trim()) { setFormError('Customer name is required.'); return; }
    if (!address.trim())      { setFormError('Address is required.'); return; }
    if (!(parseFloat(electricityRate) > 0)) { setFormError('Enter a valid electricity rate.'); return; }

    if (costingOptionsCalculated.length === 0) {
      setFormError('Enter pricing for at least one costing option.');
      return;
    }
    if (costingOptions.length > 1 && costingOptions.some((o) => !o.title.trim())) {
      setFormError('Every alternative costing option requires a title.');
      return;
    }

    if (quotationMode === 'COMBINED') {
      if (!combinedPreview) {
        setFormError(
          combinedSingleCosting
            ? 'Enter capacity for at least 2 systems and combined pricing.'
            : 'Enter capacity and pricing for at least 2 systems.',
        );
        return;
      }
    } else {
      if (derivedSystemKw <= 0) { setFormError('Please enter monthly units or a system size.'); return; }
    }

    const submitSystemType = primaryCosting?.systemType ?? systemType;
    const submitSiteType = primaryCosting?.siteType ?? siteType;

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        customerName: customerName.trim(),
        address: address.trim(),
        city: city.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        systemType: submitSystemType,
        siteType: submitSiteType,
        quotationMode,
        combinedSingleCosting: quotationMode === 'COMBINED' ? combinedSingleCosting : undefined,
        costingOptions: costingOptions.map((row) => ({
          title: row.title.trim(),
          systemType: row.systemType,
          siteType: row.siteType,
          pricePerWatt: effectivePricePerWattForOption(row, pricingKw),
        })),
        systemSizeKw: quotationMode === 'COMBINED'
          ? combinedPreview!.combined.systemSizeKw
          : derivedSystemKw,
        inverterSizeKw: quotationMode === 'COMBINED'
          ? combinedPreview!.combined.systemSizeKw
          : (inverterSizeKw ? parseFloat(inverterSizeKw) : derivedSystemKw),
        pricePerWatt: quotationMode === 'COMBINED'
          ? combinedPreview!.combined.blendedPricePerWatt
          : effectivePricePerWatt,
        systems: quotationMode === 'COMBINED'
          ? combinedSystems.map((row) => {
              const kw = parseFloat(row.capacityKw);
              const increasedManual = parseOptionalSanctionedLoadKw(row.sanctionedLoadIncreasedToKw);
              return {
                label: row.label,
                consumerNumber: row.consumerNumber,
                systemSizeKw: kw,
                pricePerWatt: combinedSingleCosting
                  ? effectivePricePerWatt
                  : effectivePricePerWattForRow(row),
                siteType: row.siteType,
                meterPhase: row.meterPhase,
                structureCategory: row.structureCategory,
                structureOption: row.structureOption,
                sanctionedLoadKw: parseOptionalSanctionedLoadKw(row.sanctionedLoadKw) ?? undefined,
                sanctionedLoadIncreasedToKw:
                  increasedManual ?? (Number.isFinite(kw) && kw > 0 ? kw : undefined),
              };
            })
          : undefined,
        electricityRatePerUnit: parseFloat(electricityRate) || 18,
        peakSunHours: parseFloat(peakSunHours) || 4,
        ...(quotationMode !== 'COMBINED'
          ? {
              sanctionedLoadKw:
                sanctionedLoadKw.trim() !== '' && Number.isFinite(parseFloat(sanctionedLoadKw))
                  ? parseFloat(sanctionedLoadKw)
                  : undefined,
              sanctionedLoadIncreasedToKw:
                sanctionedLoadIncreasedToKw.trim() !== '' &&
                Number.isFinite(parseFloat(sanctionedLoadIncreasedToKw))
                  ? parseFloat(sanctionedLoadIncreasedToKw)
                  : undefined,
            }
          : {}),
        buildingHeight,
        buildingHeightCustomFloors:
          buildingHeight === 'CUSTOM' &&
          buildingHeightCustomFloors.trim() !== '' &&
          Number.isFinite(parseFloat(buildingHeightCustomFloors))
            ? parseFloat(buildingHeightCustomFloors)
            : undefined,
        meterPhase,
        panelWattage,
        panelWattageCustom:
          panelWattage === 'CUSTOM' &&
          panelWattageCustom.trim() !== '' &&
          Number.isFinite(parseFloat(panelWattageCustom))
            ? parseFloat(panelWattageCustom)
            : undefined,
        structureCategory,
        structureOption,
        panelWarrantyYears: parseInt(panelWarrantyYears, 10) || 25,
        warrantyItems: serializeWarrantyItems(warrantyItems),
        bomItems: serializeBomItems(bomItems),
        paymentMilestones: paymentMilestones.filter((m) => m.title.trim()),
        paymentModes: paymentModes.filter((m) => m.label.trim()),
        paymentTermsBullets: paymentTermsBullets.filter((b) => b.trim()),
        ...(proposalNoteText.trim()
          ? {
              proposalNote: {
                text: proposalNoteText.trim(),
                placement: proposalNotePlacement,
              },
            }
          : {}),
        ...(searchParams.get('fromSiteCosting') === '1'
          ? (() => {
              const sc = loadSiteCostingResult();
              const photos = loadSiteCostingState().sitePhotos?.map((p) => ({
                name: p.name,
                url: p.dataUrl ?? p.url,
              }));
              return {
                ...(sc ? { siteCosting: sc } : {}),
                ...(photos?.length ? { sitePhotos: photos } : {}),
              };
            })()
          : {}),
      };

      const res = await api<{ quotationId: string; quoteNumber: string }>('/quotations/quick', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      router.push(`/quotation/${res.quotationId}/print`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to generate quotation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/sales" className="text-gray-400 hover:text-gray-600 text-xl leading-none">←</Link>
          <div className="h-5 w-px bg-gray-200" />
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <div>
              <h1 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Quick Quotation
              </h1>
              <p className="text-xs text-gray-400">Generate a professional solar proposal in minutes</p>
            </div>
          </div>
        </div>
        <Link
          href="/sales/customers/new"
          className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg"
        >
          Need detailed workflow? → Full Quotation
        </Link>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 flex flex-col lg:flex-row gap-6 w-full">

        {/* ── LEFT: Form ──────────────────────────────────────────────────── */}
        <div className="flex-1 space-y-5 min-w-0">

          {/* ── Section 1: Customer Info ─────────────────────────────────── */}
          <FormCard title="1. Customer Information" icon="👤">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="col-span-2">
                <FieldLabel required>Customer Name</FieldLabel>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Sharma / ABC Pvt. Ltd."
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="col-span-2">
                <FieldLabel required>Address / Location</FieldLabel>
                <input
                  type="text"
                  placeholder="Plot / flat, street, area"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <FieldLabel>City</FieldLabel>
                <input type="text" placeholder="Pune" value={city} onChange={e => setCity(e.target.value)} className={inputCls} />
              </div>
              <div>
                <FieldLabel>Phone</FieldLabel>
                <input type="tel" placeholder="+91 98765 43210" value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} />
              </div>
              <div className="col-span-2">
                <FieldLabel>Email</FieldLabel>
                <input type="email" placeholder="customer@email.com" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
              </div>
            </div>
          </FormCard>

          {/* ── Section 2: System Type ──────────────────────────────────── */}
          <FormCard title="2. System Configuration" icon="⚙️">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FieldLabel>System Type</FieldLabel>
                <ToggleGroup
                  options={[
                    { value: 'DCR',     label: 'DCR',     hint: 'Eligible for subsidy' },
                    { value: 'NON_DCR', label: 'Non-DCR', hint: 'Depreciation benefits' },
                  ]}
                  value={systemType}
                  onChange={v => setSystemType(v as 'DCR' | 'NON_DCR')}
                  accent="#6690cc"
                />
              </div>
              <div>
                <FieldLabel>Site Type</FieldLabel>
                <ToggleGroup
                  options={[
                    { value: 'RESIDENTIAL', label: 'Residential', hint: '' },
                    { value: 'SOCIETY',     label: 'Society',     hint: '' },
                    { value: 'COMMERCIAL',  label: 'Commercial',  hint: '' },
                    { value: 'INDUSTRIAL',  label: 'Industrial',  hint: '' },
                  ]}
                  value={siteType}
                  onChange={v => setSiteType(v as 'RESIDENTIAL' | 'SOCIETY' | 'COMMERCIAL' | 'INDUSTRIAL')}
                  accent="#6690cc"
                />
                {quotationMode === 'COMBINED' && (
                  <p className="text-xs text-gray-500 mt-2">
                    For reference and template selection. Connection type per system is set in Combined Systems below.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <FieldLabel>Quotation Mode</FieldLabel>
              <div className="flex flex-col sm:flex-row gap-2">
                {QUOTATION_MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setQuotationMode(opt.value)}
                    className={`flex-1 text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                      quotationMode === opt.value
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <span className="font-semibold block">{opt.label}</span>
                    <span className={`text-xs mt-0.5 block ${quotationMode === opt.value ? 'text-gray-300' : 'text-gray-400'}`}>
                      {opt.hint}
                    </span>
                  </button>
                ))}
              </div>
            </div>

          </FormCard>

          {quotationMode === 'COMBINED' && (
            <FormCard title="3. Combined Systems" icon="🔗">
              <CombinedSystemsEditor
                systems={combinedSystems}
                onChange={setCombinedSystems}
                defaultSiteType={siteType}
                singleCosting={combinedSingleCosting}
                onSingleCostingChange={setCombinedSingleCosting}
              />
            </FormCard>
          )}

          {/* ── Section 3: Site & Equipment ─────────────────────────────── */}
          <FormCard title={`${quotationMode === 'COMBINED' ? '4' : '3'}. Site & Equipment Details`} icon="🏗️">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Building Height</FieldLabel>
                <select
                  value={buildingHeight}
                  onChange={(e) => setBuildingHeight(e.target.value)}
                  className={selectCls}
                >
                  {BUILDING_HEIGHT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {buildingHeight === 'CUSTOM' && (
                  <div className="mt-2">
                    <FieldLabel>Custom floors above ground</FieldLabel>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="e.g. 6"
                      value={buildingHeightCustomFloors}
                      onChange={(e) => setBuildingHeightCustomFloors(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1">Affects wiring length and installation estimates</p>
              </div>

              {quotationMode !== 'COMBINED' && (
              <div>
                <FieldLabel>Meter Phase</FieldLabel>
                <select
                  value={meterPhase}
                  onChange={(e) => setMeterPhase(e.target.value as 'SINGLE' | 'THREE')}
                  className={selectCls}
                >
                  {METER_PHASE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              )}

              <div>
                <FieldLabel>Panel Wattage</FieldLabel>
                <select
                  value={panelWattage}
                  onChange={(e) => setPanelWattage(e.target.value)}
                  className={selectCls}
                >
                  {PANEL_WATTAGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {panelWattage === 'CUSTOM' && (
                  <div className="mt-2">
                    <FieldLabel>Custom panel wattage (Wp)</FieldLabel>
                    <input
                      type="number"
                      min="100"
                      step="5"
                      placeholder="e.g. 610"
                      value={panelWattageCustom}
                      onChange={(e) => setPanelWattageCustom(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                )}
                {(() => {
                  const displayKw = quotationMode === 'COMBINED'
                    ? (combinedPreview?.combined.systemSizeKw ?? 0)
                    : derivedSystemKw;
                  const displayPanels = quotationMode === 'COMBINED'
                    ? calcNumPanels(displayKw, resolvedPanelWatt)
                    : numPanels;
                  if (displayKw <= 0 || displayPanels <= 0) return null;
                  return (
                    <p className="text-xs text-blue-700 bg-blue-50 rounded-lg px-2 py-1.5 mt-2 tabular-nums">
                      {displayPanels} panels × {resolvedPanelWatt} Wp ={' '}
                      <strong>{fmt(displayPanels * resolvedPanelWatt)} Wp</strong>
                    </p>
                  );
                })()}
              </div>

              {quotationMode !== 'COMBINED' && (
              <div>
                <FieldLabel>Mounting Structure</FieldLabel>
                <select
                  value={structureCategory}
                  onChange={(e) => {
                    const cat = e.target.value as 'TRAPEZOID' | 'STANDARD' | 'RAISED';
                    setStructureCategory(cat);
                    setStructureOption(STRUCTURE_OPTIONS[cat]?.[0]?.value ?? '1ft');
                  }}
                  className={selectCls}
                >
                  {STRUCTURE_CATEGORIES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <select
                  value={structureOption}
                  onChange={(e) => setStructureOption(e.target.value)}
                  className={`${selectCls} mt-2`}
                >
                  {(STRUCTURE_OPTIONS[structureCategory] ?? []).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              )}
            </div>
          </FormCard>

          {quotationMode === 'SINGLE' && (
          <>
          <FormCard title="4. System Sizing" icon="☀️">
            {/* Mode toggle */}
            <div className="flex gap-2 mb-4">
              {[
                { id: 'direct',  label: '⚡ Enter System Size Directly' },
                { id: 'monthly', label: '📊 Enter Monthly Units' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setSizingMode(opt.id as 'monthly' | 'direct')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                    sizingMode === opt.id
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {sizingMode === 'monthly' ? (
              <div>
                <p className="text-xs text-gray-500 mb-3">
                  Enter the units consumed each month. You can leave months blank — average is calculated from filled months only.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {MONTHS.map(m => (
                    <div key={m.key}>
                      <label className="text-xs text-gray-500 mb-1 block">{m.label}</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="—"
                        value={monthlyUnits[m.key] ?? ''}
                        onChange={e => setMonthlyUnits(prev => ({ ...prev, [m.key]: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>
                  ))}
                </div>
                {derivedSystemKw > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                    <span>📐</span>
                    <span>Recommended system size based on usage: <strong>{derivedSystemKw} kW</strong></span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <FieldLabel required>System Size (kW)</FieldLabel>
                  <div className="flex items-center">
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      placeholder="e.g. 5"
                      value={directKw}
                      onChange={e => setDirectKw(e.target.value)}
                      className={`${inputCls} text-right tabular-nums`}
                    />
                    <span className="ml-2 text-sm font-medium text-gray-500 whitespace-nowrap">kW</span>
                  </div>
                </div>
                {derivedSystemKw > 0 && (
                  <div className="flex-1 bg-gray-50 rounded-xl px-4 py-2.5">
                    <p className="text-xs text-gray-500">Roof area required</p>
                    <p className="text-lg font-bold text-gray-800 tabular-nums">{derivedSystemKw * 80} <span className="text-sm font-normal text-gray-400">sqft</span></p>
                  </div>
                )}
              </div>
            )}

            {derivedSystemKw > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <FieldLabel>Inverter Size (kW)</FieldLabel>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  placeholder={`${derivedSystemKw} (same as system)`}
                  value={inverterSizeKw}
                  onChange={e => { setInverterSizeKw(e.target.value); setInverterManuallyEdited(true); }}
                  className="w-32 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <p className="text-xs text-gray-400 mt-1">Defaults to system size. Edit to undersize or oversize inverter.</p>
              </div>
            )}
          </FormCard>

          <AlternativeCostingEditorCard
            sectionNumber="5"
            options={costingOptions}
            onChange={setCostingOptions}
            systemSizeKw={pricingKw}
            defaultSiteType={siteType as CostingSiteType}
            defaultSystemType={systemType}
          />
          </>
          )}

          {quotationMode === 'COMBINED' && (
            <AlternativeCostingEditorCard
              sectionNumber="5"
              options={costingOptions}
              onChange={setCostingOptions}
              systemSizeKw={pricingKw}
              defaultSiteType={siteType as CostingSiteType}
              defaultSystemType={systemType}
            />
          )}

          <FormCard title={`${quotationMode === 'COMBINED' ? '6' : '6'}. Quick Parameters`} icon="🔧">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Electricity Rate (₹ per unit)</FieldLabel>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={electricityRate}
                    onChange={e => setElectricityRate(e.target.value)}
                    className={`${inputCls} text-right tabular-nums`}
                  />
                  <span className="text-sm text-gray-400 whitespace-nowrap">₹/kWh</span>
                </div>
              </div>
              <div>
                <FieldLabel>Peak Sun Hours per Day</FieldLabel>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="12"
                    step="0.5"
                    value={peakSunHours}
                    onChange={e => setPeakSunHours(e.target.value)}
                    className={`${inputCls} text-right tabular-nums`}
                  />
                  <span className="text-sm text-gray-400 whitespace-nowrap">hrs/day</span>
                </div>
              </div>
              {quotationMode !== 'COMBINED' && (
                <>
                  <div>
                    <FieldLabel>Present Sanctioned Load (kW)</FieldLabel>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        placeholder="e.g. 5"
                        value={sanctionedLoadKw}
                        onChange={(e) => setSanctionedLoadKw(e.target.value)}
                        className={`${inputCls} text-right tabular-nums`}
                      />
                      <span className="text-sm text-gray-400 whitespace-nowrap">kW</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Optional — used to assess load sufficiency</p>
                  </div>
                  <div>
                    <FieldLabel>Sanctioned load to be increased to (kW)</FieldLabel>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        placeholder={derivedSystemKw > 0 ? String(derivedSystemKw) : '—'}
                        value={sanctionedLoadIncreasedToKw}
                        onChange={(e) => {
                          setSanctionedLoadIncreasedToManual(true);
                          setSanctionedLoadIncreasedToKw(e.target.value);
                        }}
                        className={`${inputCls} text-right tabular-nums`}
                      />
                      <span className="text-sm text-gray-400 whitespace-nowrap">kW</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Defaults to the proposed system size; change if the target sanctioned load after upgrade should differ.
                    </p>
                  </div>
                </>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Note: Quick Quotation uses <strong>Direct Production</strong> (system size × sun hours) without derating. For detailed efficiency analysis, use the full quotation workflow.
            </p>
          </FormCard>

          <ProposalContentEditors
            sectionNumber={quotationMode === 'COMBINED' ? '6' : '7'}
            open={deepEditOpen}
            onOpenChange={setDeepEditOpen}
            panelWarrantyYears={panelWarrantyYears}
            onPanelWarrantyYearsChange={setPanelWarrantyYears}
            warrantyItems={warrantyItems}
            onWarrantyItemsChange={setWarrantyItems}
            bomItems={bomItems}
            onBomItemsChange={setBomItems}
            paymentMilestones={paymentMilestones}
            onPaymentMilestonesChange={setPaymentMilestones}
            paymentModes={paymentModes}
            onPaymentModesChange={setPaymentModes}
            paymentTermsBullets={paymentTermsBullets}
            onPaymentTermsBulletsChange={setPaymentTermsBullets}
            quotationMode={quotationMode}
            showDepreciation={showDepreciation}
            proposalNoteText={proposalNoteText}
            onProposalNoteTextChange={setProposalNoteText}
            proposalNotePlacement={proposalNotePlacement}
            onProposalNotePlacementChange={setProposalNotePlacement}
          />

          {/* ── Sanctioned Load Note (live preview — single system only) ── */}
          {quotationMode !== 'COMBINED' &&
            sanctionedLoadKw &&
            Number.isFinite(parseFloat(sanctionedLoadKw)) &&
            parseFloat(sanctionedLoadKw) > 0 &&
            derivedSystemKw > 0 && (
            <div
              className="rounded-2xl px-5 py-4 border"
              style={{
                background: derivedSystemKw > parseFloat(sanctionedLoadKw) ? '#fffbeb' : '#f0fdf4',
                borderColor: derivedSystemKw > parseFloat(sanctionedLoadKw) ? '#fde68a' : '#bbf7d0',
              }}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">{derivedSystemKw > parseFloat(sanctionedLoadKw) ? '⚠️' : '✅'}</span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: derivedSystemKw > parseFloat(sanctionedLoadKw) ? '#92400e' : '#166534' }}>
                    Sanctioned Load Assessment
                  </p>
                  <div className="text-xs mt-1 space-y-0.5" style={{ color: derivedSystemKw > parseFloat(sanctionedLoadKw) ? '#78350f' : '#14532d' }}>
                    <p>Present Sanctioned Load: <strong>{sanctionedLoadKw} kW</strong></p>
                    <p>Proposed Solar System: <strong>{derivedSystemKw} kW</strong></p>
                    <p className="mt-1 font-medium">
                      {derivedSystemKw > parseFloat(sanctionedLoadKw)
                        ? 'The present sanctioned load may need to be increased to support the proposed solar installation.'
                        : 'The present sanctioned load is sufficient for the proposed solar installation.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Error ──────────────────────────────────────────────────── */}
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
              <span>✗</span> {formError}
            </div>
          )}
        </div>

        {/* ── RIGHT: Live Summary ──────────────────────────────────────────── */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="sticky top-[73px] space-y-3">

            {/* Summary card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div
                className="px-5 py-4 flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #161c34, #2c4570)' }}
              >
                <span className="text-xl">📊</span>
                <div>
                  <p className="text-sm font-semibold text-white">Live Estimate</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Updates as you type</p>
                </div>
              </div>

              {summary ? (
                <div className="p-5 space-y-4">
                  {quotationMode === 'COMBINED' && combinedPreview && !combinedSingleCosting && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Per System
                      </p>
                      <div className="space-y-2">
                        {combinedPreview.systems.map((sys) => (
                          <div key={sys.index} className="rounded-lg bg-gray-50 px-3 py-2 text-xs">
                            <p className="font-semibold text-gray-800 mb-1">{sys.displayName}</p>
                            <SummaryRow label="Capacity" value={`${sys.systemSizeKw} kW`} />
                            <SummaryRow label="Net Cost" value={fmtL(sys.netCost)} />
                            <SummaryRow label="Annual Savings" value={`₹${fmt(sys.annualSavings)}`} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {quotationMode === 'COMBINED' && combinedPreview && combinedSingleCosting && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Per System
                      </p>
                      <div className="space-y-2">
                        {combinedPreview.systems.map((sys) => (
                          <div key={sys.index} className="rounded-lg bg-gray-50 px-3 py-2 text-xs">
                            <p className="font-semibold text-gray-800 mb-1">{sys.displayName}</p>
                            <SummaryRow label="Capacity" value={`${sys.systemSizeKw} kW`} />
                            <SummaryRow label="Daily Generation" value={`${sys.dailyProductionKwh} kWh`} />
                            <SummaryRow label="Annual Savings" value={`₹${fmt(sys.annualSavings)}`} />
                            <SummaryRow label="30-Year Savings" value={fmtL(sys.savings30YrRs)} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      {quotationMode === 'COMBINED' ? 'Commercial Summary' : 'System'}
                    </p>
                    <div className="space-y-1.5">
                      <SummaryRow label="System Size" value={`${summary.systemSizeKw} kW`} accent />
                      {quotationMode === 'SINGLE' && (
                        <SummaryRow
                          label="Panels"
                          value={`${numPanels} × ${resolvedPanelWatt} W = ${fmt(totalPanelWatts)} W`}
                        />
                      )}
                      <SummaryRow label="Meter Phase" value={meterPhase === 'THREE' ? 'Three Phase' : 'Single Phase'} />
                      <SummaryRow label="Roof Area Required" value={`${fmt(summary.roofAreaSqft)} sq.ft`} />
                      <SummaryRow label="Daily Production" value={`${summary.dailyProductionKwh} kWh`} />
                      <SummaryRow label="Annual Production" value={`${fmt(summary.annualProductionKwh)} kWh`} />
                    </div>
                  </div>

                  <div className="h-px bg-gray-100" />

                  {/* Cost — primary or multiple options */}
                  {costingOptionsCalculated.length > 1 ? (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Costing Options
                      </p>
                      <div className="space-y-3">
                        {costingOptionsCalculated.map((opt, idx) => (
                          <div key={opt.index}>
                            {idx > 0 && (
                              <div className="my-3">
                                <OrSeparator layout="compact" />
                              </div>
                            )}
                            <CostingOptionTitleBox
                              index={opt.index}
                              title={opt.title}
                              layout="compact"
                              className="mb-2"
                            />
                            <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs">
                              <SummaryRow label="Effective Cost" value={`₹${opt.pricePerWatt.toFixed(1)} / Wp`} />
                              <SummaryRow label="Net Payable" value={fmtL(opt.netCost)} accent />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : summary ? (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Cost Breakdown</p>
                    <div className="space-y-1.5">
                      <SummaryRow label="Base Cost (incl. all)" value={fmtL(summary.baseCost)} />
                      <SummaryRow label="GST (8.9%)" value={`+ ${fmtL(summary.gstAmount)}`} />
                      <SummaryRow label="Total Cost" value={fmtL(summary.grossCost)} />
                      {summary.subsidyAmount > 0 && (
                        <SummaryRow label="PM Surya Ghar Subsidy" value={`− ${fmtL(summary.subsidyAmount)}`} highlight="green" />
                      )}
                    </div>
                    <div className="mt-2 px-3 py-2.5 rounded-xl" style={{ background: '#f0f4ff' }}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold" style={{ color: '#161c34' }}>Net Payable</span>
                        <span className="text-lg font-bold" style={{ color: '#6690cc', fontFamily: 'Poppins, sans-serif' }}>
                          {fmtL(summary.netCost)}
                        </span>
                      </div>
                    </div>
                  </div>
                  ) : null}

                  <div className="h-px bg-gray-100" />

                  {/* ROI */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Returns</p>
                    <div className="space-y-1.5">
                      <SummaryRow label="Annual Savings" value={`₹${fmt(summary.annualSavings)}`} />
                      <SummaryRow label="Breakeven" value={`~${summary.breakevenYears} years`} accent />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-gray-400 text-sm">Enter system size and pricing to see live estimate</p>
                </div>
              )}
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={
                submitting ||
                costingOptionsCalculated.length === 0 ||
                (quotationMode === 'COMBINED' ? !combinedPreview : derivedSystemKw <= 0)
              }
              className="w-full py-4 rounded-2xl text-base font-bold text-white transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: submitting || costingOptionsCalculated.length === 0 ||
                  (quotationMode === 'COMBINED' ? !combinedPreview : derivedSystemKw <= 0)
                  ? '#9ca3af'
                  : 'linear-gradient(135deg, #6690cc, #3c5e94)',
              }}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Generating Quote…
                </span>
              ) : (
                '⚡ Generate Quotation'
              )}
            </button>

            <p className="text-xs text-gray-400 text-center px-2">
              Creates customer record & generates professional PDF-ready proposal instantly
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small reusable sub-components ────────────────────────────────────────────

const inputCls =
  'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white';

const selectCls =
  'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-gray-800';

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
      {children}
      {required && <span className="ml-1 text-red-400">*</span>}
    </label>
  );
}

function FormCard({
  title, icon, children,
}: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

interface ToggleOption { value: string; label: string; hint?: string }
function ToggleGroup({
  options, value, onChange, accent = '#6690cc',
}: { options: ToggleOption[]; value: string; onChange: (v: string) => void; accent?: string }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          title={opt.hint}
          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
            value === opt.value ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
          }`}
          style={value === opt.value ? { background: accent, borderColor: accent } : {}}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SummaryRow({
  label, value, accent, highlight,
}: { label: string; value: string; accent?: boolean; highlight?: 'green' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span
        className="text-sm font-semibold tabular-nums"
        style={{
          color: highlight === 'green' ? '#16a34a' : accent ? '#6690cc' : '#161c34',
        }}
      >
        {value}
      </span>
    </div>
  );
}
