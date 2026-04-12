'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { downloadFinanceInvoicePdf } from '@/lib/pdf-download';
import { SpgsInvoiceEditor } from './SpgsInvoiceEditor';

type InvoiceMainKindUi = 'TAX_INVOICE' | 'PROFORMA_INVOICE' | 'QUOTATION' | 'EWAY_BILL';
type InvoiceSubtypeUi = 'SPGS' | 'SERVICE' | 'PRODUCT';

type SpgsPricingMode = 'perWatt' | 'totalInclGst' | 'baseExclGst';
type SpgsGstMode = 'blended' | 'split' | 'epc';

interface FinanceClient {
  id: string;
  name: string;
  companyName?: string | null;
  gstin?: string | null;
  contact?: string | null;
  address?: string | null;
  customerId?: string | null;
}

interface SalesCustomer {
  id: string;
  name: string;
  company?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  gstin?: string | null;
}

interface FinanceProduct {
  id: string;
  name: string;
  hsn?: string | null;
  type: string;
  remainingQty?: number;
}

interface NonSpgsLine {
  id: string;
  name: string;
  description: string;
  hsn: string;
  qty: number;
  rate: number;
  gstRate: number;
  amount: number;
  gstAmount: number;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function todayIsoDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function effectiveSplitRate(p12: number, p18: number) {
  const a = Math.min(1, Math.max(0, p12));
  const b = Math.min(1, Math.max(0, p18));
  const sum = a + b;
  const n12 = sum > 0 ? a / sum : 0.5;
  const n18 = sum > 0 ? b / sum : 0.5;
  return n12 * 0.12 + n18 * 0.18;
}

/** 0.7*5% + 0.3*18% = 8.9% effective on taxable value */
const EPC_EFFECTIVE_GST_RATE = 0.7 * 0.05 + 0.3 * 0.18;

/** Mirrors backend computeSpgsTotals for preview only. */
function computeSpgsPreview(input: {
  systemSizeKw: number;
  pricingMode: SpgsPricingMode;
  perWatt?: number;
  totalInclGst?: number;
  baseExclGst?: number;
  gstMode: SpgsGstMode;
  blendedGstPercent?: number;
  splitPortion12?: number;
  splitPortion18?: number;
}) {
  const watts = Math.max(0, input.systemSizeKw * 1000);
  const blended = input.blendedGstPercent ?? 8.9;
  const p12 = input.splitPortion12 ?? 0.4;
  const p18 = input.splitPortion18 ?? 0.6;

  let baseExclGst = 0;
  if (input.pricingMode === 'perWatt') {
    const pw = input.perWatt ?? 0;
    baseExclGst = round2(pw * watts);
  } else if (input.pricingMode === 'baseExclGst') {
    baseExclGst = round2(input.baseExclGst ?? 0);
  } else {
    const total = input.totalInclGst ?? 0;
    if (input.gstMode === 'epc') {
      baseExclGst = round2(total / (1 + EPC_EFFECTIVE_GST_RATE));
    } else if (input.gstMode === 'blended') {
      const r = blended / 100;
      baseExclGst = round2(total / (1 + r));
    } else {
      const eff = effectiveSplitRate(p12, p18);
      baseExclGst = round2(total / (1 + eff));
    }
  }

  let gstAmount = 0;
  const gstBreakdownLines: { label: string; amount: number }[] = [];
  if (input.gstMode === 'epc') {
    const portion70 = round2(baseExclGst * 0.7);
    const portion30 = round2(baseExclGst - portion70);
    const g5 = round2(portion70 * 0.05);
    const g18 = round2(portion30 * 0.18);
    gstAmount = round2(g5 + g18);
    gstBreakdownLines.push({ label: '70% of taxable value @ 5% GST', amount: g5 });
    gstBreakdownLines.push({ label: '30% of taxable value @ 18% GST', amount: g18 });
  } else if (input.gstMode === 'blended') {
    const r = blended / 100;
    gstAmount = round2(baseExclGst * r);
    gstBreakdownLines.push({ label: `Integrated GST (blended @ ${blended}%)`, amount: gstAmount });
  } else {
    const sum = p12 + p18;
    const n12 = sum > 0 ? p12 / sum : 0.5;
    const n18 = sum > 0 ? p18 / sum : 0.5;
    const base12 = round2(baseExclGst * n12);
    const base18 = round2(baseExclGst * n18);
    const g12 = round2(base12 * 0.12);
    const g18 = round2(base18 * 0.18);
    gstAmount = round2(g12 + g18);
    gstBreakdownLines.push({ label: `GST @ 12% on ${(n12 * 100).toFixed(0)}% of value`, amount: g12 });
    gstBreakdownLines.push({ label: `GST @ 18% on ${(n18 * 100).toFixed(0)}% of value`, amount: g18 });
  }

  const totalInclGst = round2(baseExclGst + gstAmount);
  const perWattDerived = watts > 0 ? round2(baseExclGst / watts) : 0;
  return { baseExclGst, gstAmount, totalInclGst, perWattDerived, gstBreakdownLines };
}

export type InvoiceFormMode = 'create' | 'edit';

export interface InvoiceFormProps {
  mode: InvoiceFormMode;
  /** Required when mode is edit */
  invoiceId?: string;
}

type LoadedInvoice = {
  id: string;
  mainKind: InvoiceMainKindUi;
  subtype: InvoiceSubtypeUi;
  clientId: string;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  templateId?: string | null;
  items: unknown;
};

type InvoiceTemplateRow = {
  id: string;
  name: string;
  subtype: string;
  isActive: boolean;
};

function isoFromInvoiceDate(d: string | Date | null | undefined): string {
  if (!d) return todayIsoDate();
  if (typeof d === 'string') return d.slice(0, 10);
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return todayIsoDate();
  }
}

async function uploadAnnexure(file: File): Promise<{ fileUrl: string; fileName: string }> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/finance/invoices/annexure-upload', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Upload failed');
  }
  return res.json() as Promise<{ fileUrl: string; fileName: string }>;
}

export function InvoiceForm({ mode, invoiceId }: InvoiceFormProps) {
  const router = useRouter();
  const [clients, setClients] = useState<FinanceClient[]>([]);
  const [salesCustomers, setSalesCustomers] = useState<SalesCustomer[]>([]);
  const [products, setProducts] = useState<FinanceProduct[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadingInvoice, setLoadingInvoice] = useState(mode === 'edit');

  const [mainKind, setMainKind] = useState<InvoiceMainKindUi>('TAX_INVOICE');
  const [subtype, setSubtype] = useState<InvoiceSubtypeUi>('SPGS');
  const [invoiceTemplates, setInvoiceTemplates] = useState<InvoiceTemplateRow[]>([]);
  const [templateId, setTemplateId] = useState('');

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(todayIsoDate);

  const [clientId, setClientId] = useState('');
  const [clientDraft, setClientDraft] = useState({
    name: '',
    companyName: '',
    gstin: '',
    contact: '',
    address: '',
  });
  const [showClientForm, setShowClientForm] = useState(false);
  /** When prefilling from sales dashboard, link new FinanceClient to Customer */
  const [importCustomerId, setImportCustomerId] = useState<string | null>(null);

  const [spgs, setSpgs] = useState({
    siteName: '',
    siteAddress: '',
    systemSizeKw: 0,
    panelWattage: 0,
    panelSerialText: '',
    pricingMode: 'perWatt' as SpgsPricingMode,
    perWatt: 0,
    totalInclGst: 0,
    baseExclGst: 0,
    gstMode: 'epc' as SpgsGstMode,
    blendedGstPercent: 8.9,
    splitPortion12: 0.4,
    splitPortion18: 0.6,
    paymentTermsHeading: '',
    paymentTermsText: '',
  });

  const [annexureDraft, setAnnexureDraft] = useState({ label: 'DCR certificate', file: null as File | null });
  const [annexures, setAnnexures] = useState<{ label: string; fileName: string; fileUrl: string }[]>([]);
  const [uploadingAnnex, setUploadingAnnex] = useState(false);

  const [lines, setLines] = useState<NonSpgsLine[]>([
    {
      id: 'l-0',
      name: '',
      description: '',
      hsn: '8541',
      qty: 1,
      rate: 0,
      gstRate: 18,
      amount: 0,
      gstAmount: 0,
    },
  ]);

  const loadClients = useCallback(() => {
    api<FinanceClient[]>('/finance/clients').then(setClients).catch(() => []);
  }, []);

  useEffect(() => {
    loadClients();
    api<SalesCustomer[]>('/finance/sales-customers').then(setSalesCustomers).catch(() => []);
    api<InvoiceTemplateRow[]>('/finance/invoice-templates').then(setInvoiceTemplates).catch(() => []);
  }, [loadClients]);

  useEffect(() => {
    if (mode === 'edit' || invoiceTemplates.length === 0) return;
    const forSub = invoiceTemplates.filter((t) => t.subtype === subtype);
    setTemplateId((prev) => {
      if (prev && forSub.some((t) => t.id === prev)) return prev;
      return '';
    });
  }, [subtype, invoiceTemplates, mode]);

  useEffect(() => {
    if (mode === 'edit') return;
    api<{ next: string }>(`/finance/invoices/next-number?mainKind=${encodeURIComponent(mainKind)}`)
      .then((r) => setInvoiceNumber(r.next))
      .catch(() => {});
  }, [mainKind, mode]);

  useEffect(() => {
    if (mode !== 'edit' || !invoiceId) return;
    setLoadingInvoice(true);
    setError('');
    api<LoadedInvoice & { client: FinanceClient; template?: { id: string; name: string } | null }>(
      `/finance/invoices/${invoiceId}`
    )
      .then((inv) => {
        const raw = inv.items;
        if (!raw || typeof raw !== 'object' || Array.isArray(raw) || (raw as { version?: number }).version !== 2) {
          setError('This invoice can only be edited in the newer format (version 2).');
          setLoadingInvoice(false);
          return;
        }
        const v2 = raw as {
          billingMode?: string;
          documentMeta?: { invoiceNumber?: string; invoiceDate?: string };
        };
        setMainKind(inv.mainKind);
        setSubtype(inv.subtype);
        setTemplateId(inv.templateId?.trim() || inv.template?.id || '');
        setClientId(inv.clientId);
        setInvoiceNumber(inv.invoiceNumber?.trim() || v2.documentMeta?.invoiceNumber?.trim() || '');
        setInvoiceDate(isoFromInvoiceDate(inv.invoiceDate ?? v2.documentMeta?.invoiceDate));
        setClientDraft({
          name: inv.client.name,
          companyName: inv.client.companyName ?? '',
          gstin: inv.client.gstin ?? '',
          contact: inv.client.contact ?? '',
          address: inv.client.address ?? '',
        });

        if (v2.billingMode === 'SPGS' && inv.subtype === 'SPGS') {
          const spg = (raw as { spgs?: Record<string, unknown> }).spgs;
          if (!spg) {
            setError('Invoice data is missing SPGS details.');
            setLoadingInvoice(false);
            return;
          }
          const panelSerials = spg.panelSerials as string[] | undefined;
          setSpgs({
            siteName: String(spg.siteName ?? ''),
            siteAddress: String(spg.siteAddress ?? ''),
            systemSizeKw: Number(spg.systemSizeKw) || 0,
            panelWattage: Number(spg.panelWattage) || 0,
            panelSerialText: Array.isArray(panelSerials) ? panelSerials.join('\n') : '',
            pricingMode: (spg.pricingMode as SpgsPricingMode) || 'perWatt',
            perWatt: Number(spg.perWatt) || 0,
            totalInclGst: Number(spg.totalInclGst) || 0,
            baseExclGst: Number(spg.baseExclGst) || 0,
            gstMode: (spg.gstMode as SpgsGstMode) || 'epc',
            blendedGstPercent:
              spg.blendedGstPercent != null && !Number.isNaN(Number(spg.blendedGstPercent))
                ? Number(spg.blendedGstPercent)
                : 8.9,
            splitPortion12:
              spg.splitPortion12 != null && !Number.isNaN(Number(spg.splitPortion12))
                ? Number(spg.splitPortion12)
                : 0.4,
            splitPortion18:
              spg.splitPortion18 != null && !Number.isNaN(Number(spg.splitPortion18))
                ? Number(spg.splitPortion18)
                : 0.6,
            paymentTermsHeading: String(spg.paymentTermsHeading ?? ''),
            paymentTermsText: Array.isArray(spg.paymentTermsBullets)
              ? (spg.paymentTermsBullets as string[]).join('\n')
              : '',
          });
          const ax = spg.annexures as { label: string; fileName?: string; fileUrl?: string }[] | undefined;
          setAnnexures(
            Array.isArray(ax)
              ? ax.map((a) => ({
                  label: a.label,
                  fileName: a.fileName ?? '',
                  fileUrl: a.fileUrl ?? '',
                }))
              : []
          );
        } else if (
          v2.billingMode === 'NON_SPGS' &&
          (inv.subtype === 'PRODUCT' || inv.subtype === 'SERVICE')
        ) {
          const rows = (raw as { nonSpgs?: { items?: unknown[] } }).nonSpgs?.items ?? [];
          const mapped: NonSpgsLine[] = rows.map((row, i) => {
            const r = row as {
              name?: string;
              description?: string;
              hsn?: string;
              qty?: number;
              rate?: number;
              amount?: number;
              gstAmount?: number;
            };
            const amount = Number(r.amount) || 0;
            const gstAmount = Number(r.gstAmount) || 0;
            const gstRate = amount > 0 ? Math.round((gstAmount / amount) * 100) : 18;
            return {
              id: `l-${i}`,
              name: r.name ?? '',
              description: r.description ?? '',
              hsn: r.hsn ?? '8541',
              qty: Number(r.qty) || 0,
              rate: Number(r.rate) || 0,
              gstRate,
              amount,
              gstAmount,
            };
          });
          setLines(
            mapped.length
              ? mapped
              : [
                  {
                    id: 'l-0',
                    name: '',
                    description: '',
                    hsn: '8541',
                    qty: 1,
                    rate: 0,
                    gstRate: 18,
                    amount: 0,
                    gstAmount: 0,
                  },
                ]
          );
        } else {
          setError('This invoice type cannot be edited here.');
        }
        setLoadingInvoice(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load invoice');
        setLoadingInvoice(false);
      });
  }, [mode, invoiceId]);

  useEffect(() => {
    if (subtype === 'SPGS') return;
    api<FinanceProduct[]>('/finance/products').then(setProducts).catch(() => []);
  }, [subtype]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId),
    [clients, clientId]
  );

  useEffect(() => {
    if (!selectedClient) return;
    setClientDraft({
      name: selectedClient.name,
      companyName: selectedClient.companyName ?? '',
      gstin: selectedClient.gstin ?? '',
      contact: selectedClient.contact ?? '',
      address: selectedClient.address ?? '',
    });
  }, [selectedClient]);

  const spgsPreview = useMemo(() => {
    return computeSpgsPreview({
      systemSizeKw: spgs.systemSizeKw,
      pricingMode: spgs.pricingMode,
      perWatt: spgs.perWatt,
      totalInclGst: spgs.totalInclGst,
      baseExclGst: spgs.baseExclGst,
      gstMode: spgs.gstMode,
      blendedGstPercent: spgs.blendedGstPercent,
      splitPortion12: spgs.splitPortion12,
      splitPortion18: spgs.splitPortion18,
    });
  }, [spgs]);

  const nonSpgsTotals = useMemo(() => {
    const sub = lines.reduce((s, l) => s + l.amount, 0);
    const gst = lines.reduce((s, l) => s + l.gstAmount, 0);
    return { subtotal: sub, gstAmount: gst, total: sub + gst };
  }, [lines]);

  const recalcLine = (line: NonSpgsLine): NonSpgsLine => {
    const amount = round2(line.qty * line.rate);
    const gstAmount = Math.round((amount * line.gstRate) / 100);
    return { ...line, amount, gstAmount };
  };

  const updateLine = (id: string, upd: Partial<NonSpgsLine>) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        return recalcLine({ ...l, ...upd });
      })
    );
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: `l-${Date.now()}`,
        name: '',
        description: '',
        hsn: '8541',
        qty: 1,
        rate: 0,
        gstRate: 18,
        amount: 0,
        gstAmount: 0,
      },
    ]);
  };

  const removeLine = (id: string) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const applyProductFromCatalog = (lineId: string, productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    updateLine(lineId, { name: p.name, hsn: p.hsn || '8541' });
  };

  const saveLineAsProduct = async (line: NonSpgsLine) => {
    if (!line.name.trim()) {
      setError('Enter a name before saving to catalog');
      return;
    }
    await api<FinanceProduct>('/finance/products', {
      method: 'POST',
      body: JSON.stringify({ name: line.name.trim(), hsn: line.hsn || null, type: 'EXTERNAL' }),
    });
    const list = await api<FinanceProduct[]>('/finance/products');
    setProducts(list);
  };

  const saveClientDraft = async () => {
    if (!clientId) return;
    await api<FinanceClient>(`/finance/clients/${clientId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: clientDraft.name.trim(),
        companyName: clientDraft.companyName.trim() || null,
        gstin: clientDraft.gstin.trim() || null,
        contact: clientDraft.contact.trim() || null,
        address: clientDraft.address.trim() || null,
        customerId: selectedClient?.customerId ?? null,
      }),
    });
    loadClients();
  };

  const createClient = async () => {
    if (!clientDraft.name.trim()) {
      setError('Client name is required');
      return;
    }
    const c = await api<FinanceClient>('/finance/clients', {
      method: 'POST',
      body: JSON.stringify({
        name: clientDraft.name.trim(),
        companyName: clientDraft.companyName.trim() || null,
        gstin: clientDraft.gstin.trim() || null,
        contact: clientDraft.contact.trim() || null,
        address: clientDraft.address.trim() || null,
        ...(importCustomerId ? { customerId: importCustomerId } : {}),
      }),
    });
    setClients((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)));
    setClientId(c.id);
    setImportCustomerId(null);
    setShowClientForm(false);
  };

  const importFromSales = (customerId: string) => {
    const sc = salesCustomers.find((x) => x.id === customerId);
    if (!sc) return;
    const addr = [sc.address, sc.city, sc.state, sc.pincode].filter(Boolean).join(', ');
    setClientId('');
    setImportCustomerId(sc.id);
    setClientDraft({
      name: sc.name,
      companyName: sc.company ?? '',
      gstin: sc.gstin ?? '',
      contact: '',
      address: addr,
    });
    setShowClientForm(true);
  };

  const handleAddAnnexure = async () => {
    if (!annexureDraft.file) {
      setError('Choose a file');
      return;
    }
    setUploadingAnnex(true);
    setError('');
    try {
      const { fileUrl, fileName } = await uploadAnnexure(annexureDraft.file);
      setAnnexures((prev) => [...prev, { label: annexureDraft.label, fileName, fileUrl }]);
      setAnnexureDraft((d) => ({ ...d, file: null }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploadingAnnex(false);
    }
  };

  /** Download PDF without opening a new tab; filename from server (Invoice … kW … FY.pdf). */
  const downloadPdfInvoice = (invoiceId: string) => downloadFinanceInvoicePdf(invoiceId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const invNo = invoiceNumber.trim();
    if (invNo && !/^\d+$/.test(invNo)) {
      setError('Invoice number must be digits only (e.g. 1, 2, 3)');
      return;
    }
    if (!clientId) {
      setError('Select a client');
      return;
    }
    setSaving(true);
    try {
      if (subtype === 'SPGS') {
        if (spgs.systemSizeKw <= 0) {
          setError('Enter system size (kW)');
          setSaving(false);
          return;
        }
        const panelSerials = spgs.panelSerialText
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean);

        const ptLines = spgs.paymentTermsText
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean);
        const spgsPayload = {
          systemSizeKw: spgs.systemSizeKw,
          panelWattage: Math.max(0, spgs.panelWattage),
          panelSerials,
          pricingMode: spgs.pricingMode,
          ...(spgs.pricingMode === 'perWatt' ? { perWatt: spgs.perWatt } : {}),
          ...(spgs.pricingMode === 'totalInclGst' ? { totalInclGst: spgs.totalInclGst } : {}),
          ...(spgs.pricingMode === 'baseExclGst' ? { baseExclGst: spgs.baseExclGst } : {}),
          gstMode: spgs.gstMode,
          blendedGstPercent: spgs.blendedGstPercent,
          splitPortion12: spgs.splitPortion12,
          splitPortion18: spgs.splitPortion18,
          siteName: spgs.siteName.trim() || undefined,
          siteAddress: spgs.siteAddress.trim() || undefined,
          annexures: annexures.map((a) => ({
            label: a.label,
            fileName: a.fileName,
            fileUrl: a.fileUrl,
          })),
          ...(spgs.paymentTermsHeading.trim()
            ? { paymentTermsHeading: spgs.paymentTermsHeading.trim() }
            : {}),
          ...(ptLines.length > 0 ? { paymentTermsBullets: ptLines } : {}),
        };

        if (mode === 'edit' && invoiceId) {
          await api(`/finance/invoices/${invoiceId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              mainKind,
              clientId,
              ...(invNo ? { invoiceNumber: invNo } : {}),
              invoiceDate,
              ...(templateId ? { templateId } : {}),
              spgsPayload,
            }),
          });
          try {
            await downloadPdfInvoice(invoiceId);
          } catch {
            /* PDF can be downloaded from the list */
          }
        } else {
          const inv = await api<{ id: string }>('/finance/invoices', {
            method: 'POST',
            body: JSON.stringify({
              mainKind,
              subtype: 'SPGS',
              clientId,
              ...(invNo ? { invoiceNumber: invNo } : {}),
              invoiceDate,
              ...(templateId ? { templateId } : {}),
              spgsPayload,
            }),
          });
          try {
            await downloadPdfInvoice(inv.id);
          } catch {
            /* invoice created; PDF can be downloaded from the list */
          }
        }
      } else {
        const lineItems = lines.map((l) => ({
          name: l.name || 'Item',
          description: l.description || undefined,
          hsn: l.hsn || undefined,
          qty: l.qty,
          rate: l.rate,
          amount: l.amount,
          gstAmount: l.gstAmount,
        }));
        if (mode === 'edit' && invoiceId) {
          await api(`/finance/invoices/${invoiceId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              mainKind,
              clientId,
              ...(invNo ? { invoiceNumber: invNo } : {}),
              invoiceDate,
              ...(templateId ? { templateId } : {}),
              lineItems,
              totalAmount: nonSpgsTotals.total,
            }),
          });
          try {
            await downloadPdfInvoice(invoiceId);
          } catch {
            /* PDF can be downloaded from the list */
          }
        } else {
          const inv = await api<{ id: string }>('/finance/invoices', {
            method: 'POST',
            body: JSON.stringify({
              mainKind,
              subtype,
              clientId,
              ...(invNo ? { invoiceNumber: invNo } : {}),
              invoiceDate,
              ...(templateId ? { templateId } : {}),
              lineItems,
              totalAmount: nonSpgsTotals.total,
            }),
          });
          try {
            await downloadPdfInvoice(inv.id);
          } catch {
            /* invoice created; PDF can be downloaded from the list */
          }
        }
      }
      router.replace('/admin/finance/invoices');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : mode === 'edit'
            ? 'Failed to save invoice'
            : 'Failed to create invoice'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/90">
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-8 md:py-10">
      <Link href="/admin/finance/invoices" className="mb-6 inline-block text-sm font-medium text-slate-500 transition hover:text-slate-800">
        ← Invoices
      </Link>
      <header className="mb-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">Finance</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          {mode === 'edit' ? 'Edit invoice' : 'Create invoice'}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate-600">
          {mode === 'edit'
            ? 'Update the same fields as when creating a new invoice. Save to refresh the stored PDF and totals.'
            : 'SPGS turnkey or itemized Non-SPGS — output matches the new Rolling Energy document style.'}
        </p>
        {mode === 'create' ? (
          <p className="mt-3 max-w-xl text-xs text-slate-500">
            PDF layout is chosen automatically by invoice type (SPGS vs product). You can edit each type under{' '}
            <Link href="/admin/finance/invoice-templates" className="text-blue-600 hover:underline">
              Invoice layout
            </Link>
            .
          </p>
        ) : null}
      </header>

      {loadingInvoice ? (
        <p className="text-sm text-slate-500">Loading invoice…</p>
      ) : null}

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

      {!loadingInvoice && (
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Document number</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value.replace(/\D/g, ''))}
              placeholder="Auto from series"
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            />
            <p className="mt-1 text-xs text-gray-500">Digits only. Leave empty to use the next number for this document type.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice date *</label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Document kind *</label>
            <select
              value={mainKind}
              onChange={(e) => setMainKind(e.target.value as InvoiceMainKindUi)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            >
              <option value="TAX_INVOICE">Tax invoice</option>
              <option value="PROFORMA_INVOICE">Proforma invoice</option>
              <option value="QUOTATION">Quotation</option>
              <option value="EWAY_BILL">E-Way bill</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subtype *</label>
            <select
              value={subtype}
              onChange={(e) => setSubtype(e.target.value as InvoiceSubtypeUi)}
              disabled={mode === 'edit'}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 disabled:bg-slate-100 disabled:text-slate-600"
            >
              <option value="SPGS">SPGS (turnkey)</option>
              <option value="SERVICE">Service</option>
              <option value="PRODUCT">Product (itemized)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category (invoice template / layout)
            </label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            >
              <option value="">Default (active template for {subtype})</option>
              {invoiceTemplates
                .filter((t) => t.subtype === subtype)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.isActive ? ' · active' : ''}
                  </option>
                ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Choose which saved layout from{' '}
              <Link href="/admin/finance/invoice-templates" className="text-blue-600 hover:underline">
                Invoice layout
              </Link>{' '}
              applies to this document. Must match the subtype above.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
            <div className="flex gap-2">
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2"
              >
                <option value="">— Select —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.companyName ? ` (${c.companyName})` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setClientId('');
                  setImportCustomerId(null);
                  setClientDraft({ name: '', companyName: '', gstin: '', contact: '', address: '' });
                  setShowClientForm(true);
                }}
                className="px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 whitespace-nowrap"
              >
                Add client
              </button>
            </div>
            {salesCustomers.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-gray-500">From sales:</span>
                <select
                  className="border border-gray-100 rounded px-2 py-1 text-sm max-w-[220px]"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) importFromSales(e.target.value);
                    e.target.value = '';
                  }}
                >
                  <option value="">Import from sales…</option>
                  {salesCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {clientId && (
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-800">Client details (editable)</h3>
              <button
                type="button"
                onClick={() => void saveClientDraft()}
                className="text-sm text-blue-600 font-medium"
              >
                Save changes
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <label className="block">
                <span className="text-gray-600">Name</span>
                <input
                  className="mt-0.5 w-full border rounded px-2 py-1.5"
                  value={clientDraft.name}
                  onChange={(e) => setClientDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-gray-600">Company / legal name</span>
                <input
                  className="mt-0.5 w-full border rounded px-2 py-1.5"
                  value={clientDraft.companyName}
                  onChange={(e) => setClientDraft((d) => ({ ...d, companyName: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-gray-600">GSTIN</span>
                <input
                  className="mt-0.5 w-full border rounded px-2 py-1.5"
                  value={clientDraft.gstin}
                  onChange={(e) => setClientDraft((d) => ({ ...d, gstin: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-gray-600">Contact</span>
                <input
                  className="mt-0.5 w-full border rounded px-2 py-1.5"
                  value={clientDraft.contact}
                  onChange={(e) => setClientDraft((d) => ({ ...d, contact: e.target.value }))}
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-gray-600">Address</span>
                <textarea
                  className="mt-0.5 w-full border rounded px-2 py-1.5 min-h-[60px]"
                  value={clientDraft.address}
                  onChange={(e) => setClientDraft((d) => ({ ...d, address: e.target.value }))}
                />
              </label>
            </div>
          </div>
        )}

        {showClientForm && !clientId && (
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 space-y-3">
            <h3 className="text-sm font-semibold text-gray-800">New client</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <label className="block">
                <span className="text-gray-600">Name *</span>
                <input
                  className="mt-0.5 w-full border rounded px-2 py-1.5"
                  value={clientDraft.name}
                  onChange={(e) => setClientDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-gray-600">Company</span>
                <input
                  className="mt-0.5 w-full border rounded px-2 py-1.5"
                  value={clientDraft.companyName}
                  onChange={(e) => setClientDraft((d) => ({ ...d, companyName: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-gray-600">GSTIN</span>
                <input
                  className="mt-0.5 w-full border rounded px-2 py-1.5"
                  value={clientDraft.gstin}
                  onChange={(e) => setClientDraft((d) => ({ ...d, gstin: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-gray-600">Contact</span>
                <input
                  className="mt-0.5 w-full border rounded px-2 py-1.5"
                  value={clientDraft.contact}
                  onChange={(e) => setClientDraft((d) => ({ ...d, contact: e.target.value }))}
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-gray-600">Address</span>
                <textarea
                  className="mt-0.5 w-full border rounded px-2 py-1.5 min-h-[60px]"
                  value={clientDraft.address}
                  onChange={(e) => setClientDraft((d) => ({ ...d, address: e.target.value }))}
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => void createClient()} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm">
                Create & select
              </button>
              <button type="button" onClick={() => setShowClientForm(false)} className="px-4 py-2 rounded-lg border text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        {subtype === 'SPGS' && (
          <>
          <SpgsInvoiceEditor
            spgs={spgs}
            setSpgs={setSpgs}
            spgsPreview={spgsPreview}
            annexureDraft={annexureDraft}
            setAnnexureDraft={setAnnexureDraft}
            annexures={annexures}
            setAnnexures={setAnnexures}
            uploadingAnnex={uploadingAnnex}
            onAddAnnexure={handleAddAnnexure}
          />
          </>
        )}

        {(subtype === 'PRODUCT' || subtype === 'SERVICE') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">Line items (non-SPGS)</h3>
              <button type="button" onClick={addLine} className="text-sm text-blue-600 font-medium">
                + Add line
              </button>
            </div>
            <div className="border border-gray-200 rounded-xl overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-2 py-2 text-left font-semibold text-gray-700 w-36">Product</th>
                    <th className="px-2 py-2 text-left font-semibold text-gray-700">Description</th>
                    <th className="px-2 py-2 text-left font-semibold text-gray-700 w-16">HSN</th>
                    <th className="px-2 py-2 text-right font-semibold text-gray-700 w-20">Qty</th>
                    <th className="px-2 py-2 text-right font-semibold text-gray-700 w-24">Rate</th>
                    <th className="px-2 py-2 text-right font-semibold text-gray-700 w-16">GST %</th>
                    <th className="px-2 py-2 text-right font-semibold text-gray-700 w-24">Taxable</th>
                    <th className="px-2 py-2 text-right font-semibold text-gray-700 w-24">GST</th>
                    <th className="px-2 py-2 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lines.map((line) => (
                    <tr key={line.id} className="hover:bg-gray-50/50 align-top">
                      <td className="px-2 py-2">
                        <input
                          value={line.name}
                          onChange={(e) => updateLine(line.id, { name: e.target.value })}
                          className="w-full border rounded px-2 py-1 text-xs"
                          placeholder="Name"
                        />
                        {products.length > 0 && (
                          <select
                            className="mt-1 w-full border rounded px-1 py-0.5 text-xs text-gray-600"
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) applyProductFromCatalog(line.id, e.target.value);
                              e.target.value = '';
                            }}
                          >
                            <option value="">From catalog…</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={line.description}
                          onChange={(e) => updateLine(line.id, { description: e.target.value })}
                          className="w-full border rounded px-2 py-1 text-xs"
                          placeholder="Optional"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={line.hsn}
                          onChange={(e) => updateLine(line.id, { hsn: e.target.value })}
                          className="w-14 border rounded px-1 py-1 text-xs"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={line.qty || ''}
                          onChange={(e) => updateLine(line.id, { qty: Number(e.target.value) || 0 })}
                          className="w-full border rounded px-2 py-1 text-right text-xs"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={line.rate || ''}
                          onChange={(e) => updateLine(line.id, { rate: Number(e.target.value) || 0 })}
                          className="w-full border rounded px-2 py-1 text-right text-xs"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={line.gstRate || ''}
                          onChange={(e) => updateLine(line.id, { gstRate: Number(e.target.value) || 0 })}
                          className="w-full border rounded px-2 py-1 text-right text-xs"
                        />
                      </td>
                      <td className="px-2 py-2 text-right text-xs font-medium">{line.amount.toLocaleString('en-IN')}</td>
                      <td className="px-2 py-2 text-right text-xs">{line.gstAmount.toLocaleString('en-IN')}</td>
                      <td className="px-2 py-2 text-xs text-right">
                        <button type="button" onClick={() => void saveLineAsProduct(line)} className="text-blue-600 block mb-1">
                          Save to catalog
                        </button>
                        <button type="button" onClick={() => removeLine(line.id)} className="text-rose-500">
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 max-w-sm ml-auto text-sm">
              <div className="flex justify-between py-1">
                <span className="text-gray-600">Taxable</span>
                <span>₹ {nonSpgsTotals.subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-600">GST</span>
                <span>₹ {nonSpgsTotals.gstAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between font-semibold text-base py-2 border-t mt-2">
                <span>Total</span>
                <span>₹ {nonSpgsTotals.total.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? (mode === 'edit' ? 'Saving…' : 'Creating…') : mode === 'edit' ? 'Save changes' : 'Create invoice'}
          </button>
          <Link
            href="/admin/finance/invoices"
            className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Cancel
          </Link>
        </div>
      </form>
      )}
      </div>
    </div>
  );
}
