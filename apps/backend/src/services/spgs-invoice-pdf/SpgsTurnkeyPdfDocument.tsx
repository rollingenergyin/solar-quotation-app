import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import type { SpgsPdfInput } from '../invoice-pdf-spgs-types.js';
import type { SpgsEpcBreakdown } from '../invoice-spgs.service.js';
import { amountToWordsINR } from '../invoice-amount-words.js';
import { getInvoiceBranding, type InvoiceBrandConfig } from '../invoice-branding.js';
import { SPGS_PDF_FONT_FAMILY } from './spgsPdfFont.js';

const DEFAULT_HSN = '995464';
const BORDER = '#6690cc';
const PRIMARY = '#161c34';

/** Effective GST % on full taxable for EPC (70% @ 5% + 30% @ 18%). */
const EPC_EFFECTIVE_GST_PCT = (0.7 * 5 + 0.3 * 18).toFixed(1);

function fmtNum(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function roundOffDelta(total: number, base: number, gstTotal: number): number {
  return Math.round((total - base - gstTotal) * 100) / 100;
}

function pct(part: number, whole: number): string {
  if (whole <= 0) return '-';
  return ((part / whole) * 100).toFixed(2);
}

/** Per-line EPC row figures for 70% / 30% split (matches reference two-line table). */
function epcTableRows(watts: number, perW: number, epc: SpgsEpcBreakdown) {
  const w1 = Math.round(watts * 0.7 * 100) / 100;
  const w2 = Math.round((watts - w1) * 100) / 100;
  const t1 = epc.portion70Taxable;
  const t2 = epc.portion30Taxable;
  const g1 = epc.gstAt5On70;
  const g2 = epc.gstAt18On30;
  const cgst1 = Math.round((g1 / 2) * 100) / 100;
  const sgst1 = Math.round((g1 - g1 / 2) * 100) / 100;
  const cgst2 = Math.round((g2 / 2) * 100) / 100;
  const sgst2 = Math.round((g2 - g2 / 2) * 100) / 100;
  const total1 = Math.round((t1 + g1) * 100) / 100;
  const total2 = Math.round((t2 + g2) * 100) / 100;
  return {
    row1: {
      qty: w1,
      rate: perW,
      taxable: t1,
      cgstPct: '2.50',
      cgstAmt: cgst1,
      sgstPct: '2.50',
      sgstAmt: sgst1,
      total: total1,
    },
    row2: {
      qty: w2,
      rate: perW,
      taxable: t2,
      cgstPct: '9.00',
      cgstAmt: cgst2,
      sgstPct: '9.00',
      sgstAmt: sgst2,
      total: total2,
    },
  };
}

/** Column widths (sum 100%) — aligns merged CGST/SGST headers (22%) with c6–c9. */
const W = {
  c0: '4%',
  c1: '28%',
  c2: '7%',
  c3: '7%',
  c4: '7%',
  c5: '10%',
  c6: '5%',
  c7: '6%',
  c8: '5%',
  c9: '6%',
  c10: '15%',
} as const;

function createStyles() {
  return StyleSheet.create({
    page: {
      fontFamily: SPGS_PDF_FONT_FAMILY,
      fontSize: 8,
      fontWeight: 400,
      color: '#000000',
      backgroundColor: '#ffffff',
      paddingTop: 16,
      paddingBottom: 16,
      paddingHorizontal: 16,
      lineHeight: 1.35,
    },
    invoiceOuter: {
      borderWidth: 1,
      borderColor: BORDER,
      paddingHorizontal: 20,
      paddingVertical: 20,
      flexGrow: 1,
    },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    brandLeft: { flexDirection: 'row', flex: 1, paddingRight: 12 },
    logoBox: { width: 44, height: 44, backgroundColor: PRIMARY, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    logoLetter: { color: '#ffffff', fontSize: 14, fontWeight: 700, fontFamily: SPGS_PDF_FONT_FAMILY },
    companyBlock: { flex: 1, maxWidth: '55%' },
    companyName: { fontSize: 11, fontWeight: 600, marginBottom: 4, fontFamily: SPGS_PDF_FONT_FAMILY },
    companyAddr: { fontSize: 8, lineHeight: 1.4, fontFamily: SPGS_PDF_FONT_FAMILY },
    contactRight: { width: '38%', alignItems: 'flex-end' },
    contactLine: { fontSize: 8, marginBottom: 2, textAlign: 'right', fontFamily: SPGS_PDF_FONT_FAMILY },
    contactBold: { fontWeight: 700 },
    taxStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: BORDER,
      paddingVertical: 8,
      marginBottom: 0,
      backgroundColor: '#f5f8fc',
    },
    taxStripLeft: { width: '28%', paddingLeft: 4 },
    taxStripCenter: { width: '44%', alignItems: 'center' },
    taxStripRight: { width: '28%', alignItems: 'flex-end', paddingRight: 4 },
    taxStripGstin: { fontSize: 8, fontWeight: 700, fontFamily: SPGS_PDF_FONT_FAMILY },
    taxStripTitle: { fontSize: 12, fontWeight: 700, color: PRIMARY, fontFamily: SPGS_PDF_FONT_FAMILY },
    taxStripSub: { fontSize: 8, fontWeight: 700, color: PRIMARY, fontFamily: SPGS_PDF_FONT_FAMILY },
    dualGrid: {
      flexDirection: 'row',
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: BORDER,
      marginBottom: 8,
    },
    dualCol: { width: '50%', padding: 8, borderRightWidth: 1, borderRightColor: BORDER },
    dualColLast: { width: '50%', padding: 8 },
    dualHead: { fontSize: 8, fontWeight: 600, marginBottom: 6, fontFamily: SPGS_PDF_FONT_FAMILY },
    kv: { flexDirection: 'row', marginBottom: 3 },
    kvLab: { width: '34%', fontSize: 7.5, fontFamily: SPGS_PDF_FONT_FAMILY },
    kvVal: { flex: 1, fontSize: 8, fontFamily: SPGS_PDF_FONT_FAMILY },
    siteHead: { fontSize: 8, fontWeight: 600, marginTop: 6, marginBottom: 4, fontFamily: SPGS_PDF_FONT_FAMILY },
    tableOuter: { borderWidth: 1, borderColor: BORDER, marginTop: 8, marginBottom: 8 },
    tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER },
    th: {
      fontSize: 6.5,
      fontWeight: 600,
      padding: 4,
      borderRightWidth: 1,
      borderRightColor: BORDER,
      textAlign: 'center',
      backgroundColor: '#eef4fb',
      color: PRIMARY,
      fontFamily: SPGS_PDF_FONT_FAMILY,
    },
    thLeft: { textAlign: 'left' },
    thGstTitle: { fontSize: 6.5, fontWeight: 600, textAlign: 'center', paddingTop: 4, color: PRIMARY, fontFamily: SPGS_PDF_FONT_FAMILY },
    thGstSubRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: BORDER },
    thGstSub: {
      fontSize: 6,
      fontWeight: 600,
      padding: 3,
      textAlign: 'center',
      color: PRIMARY,
      fontFamily: SPGS_PDF_FONT_FAMILY,
    },
    td: {
      fontSize: 6,
      padding: 3,
      borderRightWidth: 1,
      borderRightColor: BORDER,
      fontFamily: SPGS_PDF_FONT_FAMILY,
    },
    tdR: { textAlign: 'right' },
    tdL: { textAlign: 'left' },
    tdC: { textAlign: 'center' },
    tdB: { fontWeight: 700 },
    tdB600: { fontWeight: 600 },
    descSpgsTitle: { fontSize: 6.5, fontWeight: 700, marginBottom: 2, fontFamily: SPGS_PDF_FONT_FAMILY },
    descHierarchySub: { fontSize: 6, lineHeight: 1.35, fontFamily: SPGS_PDF_FONT_FAMILY },
    descHierarchyLabel: { fontSize: 6, fontWeight: 600, marginTop: 2, fontFamily: SPGS_PDF_FONT_FAMILY },
    descIndent: { fontSize: 5.5, paddingLeft: 6, marginTop: 1, fontFamily: SPGS_PDF_FONT_FAMILY },
    descSerial: { fontSize: 5, paddingLeft: 10, marginTop: 1, lineHeight: 1.35, fontFamily: SPGS_PDF_FONT_FAMILY },
    descHierarchyItem: { fontSize: 5.5, paddingLeft: 4, marginTop: 1, fontFamily: SPGS_PDF_FONT_FAMILY },
    descPortion: { fontSize: 5, fontStyle: 'italic', fontFamily: SPGS_PDF_FONT_FAMILY },
    gstTableRow: { backgroundColor: '#ffffff' },
    legacyNote: { fontSize: 6.5, marginBottom: 6, color: '#333333', fontFamily: SPGS_PDF_FONT_FAMILY },
    bottomRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 },
    bottomLeft: { width: '52%', paddingRight: 8 },
    bottomRight: { width: '48%', paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: BORDER },
    wordsBox: { borderWidth: 1, borderColor: BORDER, padding: 6, marginBottom: 8 },
    wordsH: { fontSize: 8, fontWeight: 600, marginBottom: 4, fontFamily: SPGS_PDF_FONT_FAMILY },
    wordsT: { fontSize: 8, lineHeight: 1.45, fontFamily: SPGS_PDF_FONT_FAMILY },
    bankH: { fontSize: 8, fontWeight: 600, marginBottom: 4, marginTop: 4, fontFamily: SPGS_PDF_FONT_FAMILY },
    bankR: { flexDirection: 'row', marginBottom: 2 },
    bankL: { width: '30%', fontSize: 8, fontFamily: SPGS_PDF_FONT_FAMILY },
    bankV: { flex: 1, fontSize: 8, fontFamily: SPGS_PDF_FONT_FAMILY },
    payH: { fontSize: 8, fontWeight: 600, marginTop: 8, marginBottom: 4, fontFamily: SPGS_PDF_FONT_FAMILY },
    payI: { flexDirection: 'row', marginBottom: 2 },
    payN: { width: 16, fontSize: 8, fontFamily: SPGS_PDF_FONT_FAMILY },
    payX: { flex: 1, fontSize: 8, fontFamily: SPGS_PDF_FONT_FAMILY },
    sumRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, paddingRight: 4 },
    sumLab: { fontSize: 8.5, fontFamily: SPGS_PDF_FONT_FAMILY },
    sumVal: { fontSize: 8.5, fontWeight: 700, fontFamily: SPGS_PDF_FONT_FAMILY },
    sumTotal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: BORDER },
    sumTotalLab: { fontSize: 9, fontWeight: 600, fontFamily: SPGS_PDF_FONT_FAMILY },
    sumTotalVal: { fontSize: 10, fontWeight: 700, fontFamily: SPGS_PDF_FONT_FAMILY },
    eoe: { fontSize: 8, textAlign: 'center', marginTop: 10, fontFamily: SPGS_PDF_FONT_FAMILY },
    cert: { fontSize: 7.5, marginTop: 8, textAlign: 'center', fontFamily: SPGS_PDF_FONT_FAMILY },
    forCo: { fontSize: 8, fontWeight: 600, marginTop: 12, textAlign: 'right', fontFamily: SPGS_PDF_FONT_FAMILY },
    sigSpace: { height: 36, marginTop: 8, borderBottomWidth: 1, borderBottomColor: BORDER, width: '100%' },
    authSig: { fontSize: 8, fontWeight: 600, marginTop: 4, textAlign: 'center', fontFamily: SPGS_PDF_FONT_FAMILY },
    footGen: { fontSize: 6.5, textAlign: 'center', marginTop: 12, color: '#444444', fontFamily: SPGS_PDF_FONT_FAMILY },
  });
}

export interface SpgsTurnkeyPdfDocumentProps {
  data: SpgsPdfInput;
  branding?: InvoiceBrandConfig;
  logoSrc?: string;
}

function annexSummary(data: SpgsPdfInput): string {
  const parts: string[] = [];
  if (data.panelSerials?.length) {
    const s = data.panelSerials.join(', ');
    parts.push(`Panel S/N: ${s.length > 90 ? `${s.slice(0, 87)}...` : s}`);
  }
  if (data.annexures?.length) {
    parts.push(data.annexures.map((a) => (a.fileName ? `${a.label} (${a.fileName})` : a.label)).join('; '));
  }
  return parts.join(' | ');
}

function serialListText(list: string[] | undefined): string {
  if (!list?.length) return '—';
  return list.join(', ');
}

type SpgsPdfStyles = ReturnType<typeof createStyles>;

function SpgsProductDescriptionCell({
  data,
  styles,
  kw,
  portionNote,
}: {
  data: SpgsPdfInput;
  styles: SpgsPdfStyles;
  kw: number;
  portionNote?: string;
}) {
  const panels = serialListText(data.panelSerials);
  const inv = serialListText(data.inverterSerials);

  return (
    <View style={{ padding: 3 }}>
      <Text style={styles.descSpgsTitle}>SPGS SYSTEM / TURNKEY SOLAR SYSTEM</Text>
      <Text style={styles.descHierarchySub}>
        Installation, Commissioning, Liasoning & Service of {kw} kW Solar Plant
      </Text>
      <Text style={styles.descHierarchyLabel}>Panels</Text>
      <Text style={styles.descIndent}>{'\u2192'} Serial Numbers:</Text>
      <Text style={styles.descSerial}>{panels}</Text>
      <Text style={styles.descHierarchyLabel}>Inverter</Text>
      <Text style={styles.descIndent}>{'\u2192'} Serial Numbers:</Text>
      <Text style={styles.descSerial}>{inv}</Text>
      <Text style={[styles.descHierarchyItem, { marginTop: 2 }]}>BOS & Structure (Inclusive)</Text>
      <Text style={styles.descHierarchyItem}>Installation (Inclusive)</Text>
      <Text style={styles.descHierarchyItem}>Commissioning (Inclusive)</Text>
      <Text style={styles.descHierarchyItem}>Labour (Inclusive)</Text>
      {portionNote ? <Text style={[styles.descPortion, { marginTop: 3 }]}>{portionNote}</Text> : null}
    </View>
  );
}

function GstHeaderBlock({ label, styles }: { label: string; styles: SpgsPdfStyles }) {
  return (
    <View style={{ width: '11%', borderRightWidth: 1, borderRightColor: BORDER, backgroundColor: '#eef4fb' }}>
      <Text style={styles.thGstTitle}>{label}</Text>
      <View style={styles.thGstSubRow}>
        <Text style={[styles.thGstSub, { width: '45%', borderRightWidth: 1, borderRightColor: BORDER }]}>%</Text>
        <Text style={[styles.thGstSub, { width: '55%' }]}>Amount</Text>
      </View>
    </View>
  );
}

function GstLabelPctCell({
  label,
  pct,
  styles,
  w,
}: {
  label: string;
  pct: string;
  styles: SpgsPdfStyles;
  w: string;
}) {
  return (
    <View style={[styles.td, { width: w }, styles.tdC, { padding: 2, justifyContent: 'center' }]}>
      <Text style={{ fontSize: 5.5, fontFamily: SPGS_PDF_FONT_FAMILY, fontWeight: 400 }}>{label}</Text>
      <Text style={{ fontSize: 5.5, fontFamily: SPGS_PDF_FONT_FAMILY, fontWeight: 400 }}>{pct}</Text>
    </View>
  );
}

export function SpgsTurnkeyPdfDocument({ data, branding, logoSrc }: SpgsTurnkeyPdfDocumentProps) {
  const b = branding ?? getInvoiceBranding();
  const styles = createStyles();
  const nameForContact = b.contactName?.trim() || b.companyName;
  const billName = data.companyName?.trim() || data.clientName;
  const hsn = data.hsnSac?.trim() || DEFAULT_HSN;
  const watts = data.computed.watts;
  const base = data.computed.baseExclGst;
  const cgst = data.computed.cgst;
  const sgst = data.computed.sgst;
  const gstTotal = data.computed.gstAmount;
  const total = data.computed.totalInclGst;
  const ratePerW = data.computed.perWattDerived;
  const epc = data.computed.epc;
  const hasAnnex =
    (data.panelSerials && data.panelSerials.length > 0) || (data.annexures && data.annexures.length > 0);

  const kw = data.systemSizeKw;

  const gstModeNote =
    data.gstMode === 'blended'
      ? 'GST computed at blended rate (legacy invoice).'
      : data.gstMode === 'split'
        ? 'GST computed with split slabs (legacy invoice).'
        : '';

  const epcRows =
    data.gstMode === 'epc' && epc ? epcTableRows(watts, ratePerW, epc) : null;

  const roundOff = roundOffDelta(total, base, gstTotal);
  const panelMake = data.panelMake?.trim();
  const inverterMake = data.inverterMake?.trim();

  return (
    <Document title={`Invoice ${data.invoiceNo}`} author={b.companyName} subject="Tax Invoice">
      <Page size="A4" style={styles.page}>
        <View style={styles.invoiceOuter}>
        <View style={styles.topRow}>
          <View style={styles.brandLeft}>
            {logoSrc ? (
              <Image src={logoSrc} style={{ width: 72, height: 32, marginRight: 10, objectFit: 'contain' }} />
            ) : (
              <View style={styles.logoBox}>
                <Text style={styles.logoLetter}>{b.monogram}</Text>
              </View>
            )}
            <View style={styles.companyBlock}>
              <Text style={styles.companyName}>{b.companyName}</Text>
              <Text style={styles.companyAddr}>{b.address}</Text>
            </View>
          </View>
          <View style={styles.contactRight}>
            <Text style={styles.contactLine}>
              <Text style={styles.contactBold}>Name: </Text>
              {nameForContact}
            </Text>
            <Text style={styles.contactLine}>
              <Text style={styles.contactBold}>Phone: </Text>
              {b.phone}
            </Text>
            <Text style={styles.contactLine}>
              <Text style={styles.contactBold}>Email: </Text>
              {b.email}
            </Text>
          </View>
        </View>

        <View style={styles.taxStrip}>
          <View style={styles.taxStripLeft}>
            <Text style={styles.taxStripGstin}>GSTIN : {b.gstin || '-'}</Text>
          </View>
          <View style={styles.taxStripCenter}>
            <Text style={styles.taxStripTitle}>TAX INVOICE</Text>
          </View>
          <View style={styles.taxStripRight}>
            <Text style={styles.taxStripSub}>ORIGINAL FOR RECIPIENT</Text>
          </View>
        </View>

        <View style={styles.dualGrid}>
          <View style={styles.dualCol}>
            <Text style={styles.dualHead}>Customer Detail</Text>
            <View style={styles.kv}>
              <Text style={styles.kvLab}>M/S</Text>
              <Text style={styles.kvVal}>{billName}</Text>
            </View>
            {data.address ? (
              <View style={styles.kv}>
                <Text style={styles.kvLab}>Address</Text>
                <Text style={styles.kvVal}>{data.address}</Text>
              </View>
            ) : null}
            <View style={styles.kv}>
              <Text style={styles.kvLab}>Phone</Text>
              <Text style={styles.kvVal}>{data.contact?.trim() || '-'}</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.kvLab}>GSTIN</Text>
              <Text style={styles.kvVal}>{data.gstin?.trim() || '-'}</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.kvLab}>Place of Supply</Text>
              <Text style={styles.kvVal}>{data.placeOfSupply ?? '-'}</Text>
            </View>
          </View>
          <View style={styles.dualColLast}>
            <Text style={styles.dualHead}>Invoice Details</Text>
            <View style={styles.kv}>
              <Text style={styles.kvLab}>Invoice No.</Text>
              <Text style={styles.kvVal}>{data.invoiceNo}</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.kvLab}>Invoice Date</Text>
              <Text style={styles.kvVal}>{data.date}</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.kvLab}>Due Date</Text>
              <Text style={styles.kvVal}>{data.dueDate ?? '-'}</Text>
            </View>
            <View style={styles.kv}>
              <Text style={styles.kvLab}>Transport</Text>
              <Text style={styles.kvVal}>{data.transport ?? '-'}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.siteHead}>Site / Project</Text>
        <View style={styles.kv}>
          <Text style={styles.kvLab}>Site Name</Text>
          <Text style={styles.kvVal}>{data.siteName?.trim() || '-'}</Text>
        </View>
        <View style={styles.kv}>
          <Text style={styles.kvLab}>Location</Text>
          <Text style={styles.kvVal}>{data.siteAddress?.trim() || '-'}</Text>
        </View>
        <View style={styles.kv}>
          <Text style={styles.kvLab}>System size</Text>
          <Text style={styles.kvVal}>{kw} kW (DC)</Text>
        </View>
        <View style={styles.kv}>
          <Text style={styles.kvLab}>Panel wattage</Text>
          <Text style={styles.kvVal}>{data.panelWattage} Wp</Text>
        </View>
        {panelMake ? (
          <View style={styles.kv}>
            <Text style={styles.kvLab}>Make of Panel</Text>
            <Text style={styles.kvVal}>{panelMake}</Text>
          </View>
        ) : null}
        {inverterMake ? (
          <View style={styles.kv}>
            <Text style={styles.kvLab}>Make of Inverter</Text>
            <Text style={styles.kvVal}>{inverterMake}</Text>
          </View>
        ) : null}

        <View style={styles.tableOuter}>
          <View style={styles.tr}>
            <Text style={[styles.th, { width: W.c0 }]}>Sr. No.</Text>
            <Text style={[styles.th, { width: W.c1 }, styles.thLeft]}>Name of Product / Service</Text>
            <Text style={[styles.th, { width: W.c2 }]}>HSN / SAC</Text>
            <Text style={[styles.th, { width: W.c3 }]}>Qty</Text>
            <Text style={[styles.th, { width: W.c4 }]}>Rate</Text>
            <Text style={[styles.th, { width: W.c5 }]}>Taxable Value</Text>
            <GstHeaderBlock label="CGST" styles={styles} />
            <GstHeaderBlock label="SGST" styles={styles} />
            <Text style={[styles.th, { width: W.c10, borderRightWidth: 0 }]}>Total</Text>
          </View>

          {epcRows ? (
            <>
              <View style={styles.tr}>
                <Text style={[styles.td, { width: W.c0 }, styles.tdL]}>1</Text>
                <View style={[styles.td, { width: W.c1 }, styles.tdL]}>
                  <SpgsProductDescriptionCell
                    data={data}
                    styles={styles}
                    kw={kw}
                    portionNote="(70% of taxable value — first GST slab)"
                  />
                </View>
                <Text style={[styles.td, { width: W.c2 }, styles.tdC]}>{hsn}</Text>
                <Text style={[styles.td, { width: W.c3 }, styles.tdR]}>{fmtNum(epcRows.row1.qty)}</Text>
                <Text style={[styles.td, { width: W.c4 }, styles.tdR]}>{fmtNum(epcRows.row1.rate)}</Text>
                <Text style={[styles.td, { width: W.c5 }, styles.tdR]}>{fmtNum(epcRows.row1.taxable)}</Text>
                <Text style={[styles.td, { width: W.c6 }, styles.tdR]}>{epcRows.row1.cgstPct}</Text>
                <Text style={[styles.td, { width: W.c7 }, styles.tdR]}>{fmtNum(epcRows.row1.cgstAmt)}</Text>
                <Text style={[styles.td, { width: W.c8 }, styles.tdR]}>{epcRows.row1.sgstPct}</Text>
                <Text style={[styles.td, { width: W.c9 }, styles.tdR]}>{fmtNum(epcRows.row1.sgstAmt)}</Text>
                <Text style={[styles.td, { width: W.c10, borderRightWidth: 0 }, styles.tdR, styles.tdB]}>
                  {fmtNum(epcRows.row1.total)}
                </Text>
              </View>
              <View style={styles.tr}>
                <Text style={[styles.td, { width: W.c0 }, styles.tdL]}>2</Text>
                <View style={[styles.td, { width: W.c1 }, styles.tdL]}>
                  <SpgsProductDescriptionCell
                    data={data}
                    styles={styles}
                    kw={kw}
                    portionNote="(30% of taxable value — second GST slab)"
                  />
                </View>
                <Text style={[styles.td, { width: W.c2 }, styles.tdC]}>{hsn}</Text>
                <Text style={[styles.td, { width: W.c3 }, styles.tdR]}>{fmtNum(epcRows.row2.qty)}</Text>
                <Text style={[styles.td, { width: W.c4 }, styles.tdR]}>{fmtNum(epcRows.row2.rate)}</Text>
                <Text style={[styles.td, { width: W.c5 }, styles.tdR]}>{fmtNum(epcRows.row2.taxable)}</Text>
                <Text style={[styles.td, { width: W.c6 }, styles.tdR]}>{epcRows.row2.cgstPct}</Text>
                <Text style={[styles.td, { width: W.c7 }, styles.tdR]}>{fmtNum(epcRows.row2.cgstAmt)}</Text>
                <Text style={[styles.td, { width: W.c8 }, styles.tdR]}>{epcRows.row2.sgstPct}</Text>
                <Text style={[styles.td, { width: W.c9 }, styles.tdR]}>{fmtNum(epcRows.row2.sgstAmt)}</Text>
                <Text style={[styles.td, { width: W.c10, borderRightWidth: 0 }, styles.tdR, styles.tdB]}>
                  {fmtNum(epcRows.row2.total)}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.tr}>
              <Text style={[styles.td, { width: W.c0 }, styles.tdL]}>1</Text>
              <View style={[styles.td, { width: W.c1 }, styles.tdL]}>
                <SpgsProductDescriptionCell data={data} styles={styles} kw={kw} />
              </View>
              <Text style={[styles.td, { width: W.c2 }, styles.tdC]}>{hsn}</Text>
              <Text style={[styles.td, { width: W.c3 }, styles.tdR]}>{fmtNum(watts)}</Text>
              <Text style={[styles.td, { width: W.c4 }, styles.tdR]}>{fmtNum(ratePerW)}</Text>
              <Text style={[styles.td, { width: W.c5 }, styles.tdR]}>{fmtNum(base)}</Text>
              <Text style={[styles.td, { width: W.c6 }, styles.tdR]}>{pct(cgst, base)}</Text>
              <Text style={[styles.td, { width: W.c7 }, styles.tdR]}>{fmtNum(cgst)}</Text>
              <Text style={[styles.td, { width: W.c8 }, styles.tdR]}>{pct(sgst, base)}</Text>
              <Text style={[styles.td, { width: W.c9 }, styles.tdR]}>{fmtNum(sgst)}</Text>
              <Text style={[styles.td, { width: W.c10, borderRightWidth: 0 }, styles.tdR, styles.tdB]}>{fmtNum(total)}</Text>
            </View>
          )}

          <View style={[styles.tr, styles.gstTableRow]}>
            <Text style={[styles.td, { width: W.c0 }]} />
            <Text style={[styles.td, { width: W.c1 }]} />
            <Text style={[styles.td, { width: W.c2 }]} />
            <Text style={[styles.td, { width: W.c3 }]} />
            <Text style={[styles.td, { width: W.c4 }]} />
            <Text style={[styles.td, { width: W.c5 }, styles.tdR, styles.tdB600]}>Sub-Total =</Text>
            <Text style={[styles.td, { width: W.c6 }]} />
            <Text style={[styles.td, { width: W.c7 }]} />
            <Text style={[styles.td, { width: W.c8 }]} />
            <Text style={[styles.td, { width: W.c9 }]} />
            <Text style={[styles.td, { width: W.c10, borderRightWidth: 0 }, styles.tdR, styles.tdB]}>{fmtNum(base)}</Text>
          </View>

          {data.gstMode === 'epc' && epc && epcRows ? (
            <>
              <View style={[styles.tr, styles.gstTableRow]}>
                <Text style={[styles.td, { width: W.c0 }]} />
                <Text style={[styles.td, { width: W.c1 }, styles.tdC, styles.tdB600]}>{`G S T - ${EPC_EFFECTIVE_GST_PCT}%`}</Text>
                <Text style={[styles.td, { width: W.c2 }, styles.tdC, styles.tdB600]}>on 70% of project cost</Text>
                <Text style={[styles.td, { width: W.c3 }]} />
                <Text style={[styles.td, { width: W.c4 }]} />
                <Text style={[styles.td, { width: W.c5 }]} />
                <GstLabelPctCell label="CGST" pct="2.5%" styles={styles} w={W.c6} />
                <Text style={[styles.td, { width: W.c7 }, styles.tdR]}>{fmtNum(epcRows.row1.cgstAmt)}</Text>
                <GstLabelPctCell label="SGST" pct="2.5%" styles={styles} w={W.c8} />
                <Text style={[styles.td, { width: W.c9 }, styles.tdR]}>{fmtNum(epcRows.row1.sgstAmt)}</Text>
                <Text style={[styles.td, { width: W.c10, borderRightWidth: 0 }, styles.tdR]}>
                  {fmtNum(epc.gstAt5On70)}
                </Text>
              </View>
              <View style={[styles.tr, styles.gstTableRow]}>
                <Text style={[styles.td, { width: W.c0 }]} />
                <Text style={[styles.td, { width: W.c1 }]} />
                <Text style={[styles.td, { width: W.c2 }, styles.tdC, styles.tdB600]}>on 30% of project Cost</Text>
                <Text style={[styles.td, { width: W.c3 }]} />
                <Text style={[styles.td, { width: W.c4 }]} />
                <Text style={[styles.td, { width: W.c5 }]} />
                <GstLabelPctCell label="CGST" pct="9%" styles={styles} w={W.c6} />
                <Text style={[styles.td, { width: W.c7 }, styles.tdR]}>{fmtNum(epcRows.row2.cgstAmt)}</Text>
                <GstLabelPctCell label="SGST" pct="9%" styles={styles} w={W.c8} />
                <Text style={[styles.td, { width: W.c9 }, styles.tdR]}>{fmtNum(epcRows.row2.sgstAmt)}</Text>
                <Text style={[styles.td, { width: W.c10, borderRightWidth: 0 }, styles.tdR]}>
                  {fmtNum(epc.gstAt18On30)}
                </Text>
              </View>
            </>
          ) : (
            <View style={[styles.tr, styles.gstTableRow]}>
              <Text style={[styles.td, { width: W.c0 }]} />
              <Text style={[styles.td, { width: W.c1 }, styles.tdL, styles.tdB600]}>GST (as applicable)</Text>
              <Text style={[styles.td, { width: W.c2 }]} />
              <Text style={[styles.td, { width: W.c3 }]} />
              <Text style={[styles.td, { width: W.c4 }]} />
              <Text style={[styles.td, { width: W.c5 }]} />
              <Text style={[styles.td, { width: W.c6 }, styles.tdC]}>{pct(cgst, base)}</Text>
              <Text style={[styles.td, { width: W.c7 }, styles.tdR]}>{fmtNum(cgst)}</Text>
              <Text style={[styles.td, { width: W.c8 }, styles.tdC]}>{pct(sgst, base)}</Text>
              <Text style={[styles.td, { width: W.c9 }, styles.tdR]}>{fmtNum(sgst)}</Text>
              <Text style={[styles.td, { width: W.c10, borderRightWidth: 0 }, styles.tdR]}>{fmtNum(gstTotal)}</Text>
            </View>
          )}

          <View style={[styles.tr, styles.gstTableRow]}>
            <Text style={[styles.td, { width: W.c0 }]} />
            <Text style={[styles.td, { width: W.c1 }]} />
            <Text style={[styles.td, { width: W.c2 }]} />
            <Text style={[styles.td, { width: W.c3 }]} />
            <Text style={[styles.td, { width: W.c4 }]} />
            <Text style={[styles.td, { width: W.c5 }, styles.tdR, styles.tdB600]}>Round off</Text>
            <Text style={[styles.td, { width: W.c6 }]} />
            <Text style={[styles.td, { width: W.c7 }]} />
            <Text style={[styles.td, { width: W.c8 }]} />
            <Text style={[styles.td, { width: W.c9 }]} />
            <Text style={[styles.td, { width: W.c10, borderRightWidth: 0 }, styles.tdR]}>{fmtNum(roundOff)}</Text>
          </View>

          <View style={[styles.tr, styles.gstTableRow]}>
            <Text style={[styles.td, { width: W.c0 }]} />
            <Text style={[styles.td, { width: W.c1 }, styles.tdC, styles.tdB]}>T O T A L =</Text>
            <Text style={[styles.td, { width: W.c2 }]} />
            <Text style={[styles.td, { width: W.c3 }, styles.tdC, styles.tdB]}>1</Text>
            <Text style={[styles.td, { width: W.c4 }, styles.tdC, styles.tdB]}>PCS.</Text>
            <Text style={[styles.td, { width: W.c5 }]} />
            <Text style={[styles.td, { width: W.c6 }]} />
            <Text style={[styles.td, { width: W.c7 }]} />
            <Text style={[styles.td, { width: W.c8 }]} />
            <Text style={[styles.td, { width: W.c9 }]} />
            <Text style={[styles.td, { width: W.c10, borderRightWidth: 0 }, styles.tdR, styles.tdB]}>{fmtNum(total)}</Text>
          </View>
        </View>

        {gstModeNote ? <Text style={styles.legacyNote}>{gstModeNote}</Text> : null}

        <View style={styles.bottomRow}>
          <View style={styles.bottomLeft}>
            <View style={styles.wordsBox}>
              <Text style={styles.wordsH}>Total in words</Text>
              <Text style={styles.wordsT}>{amountToWordsINR(total)} ONLY</Text>
            </View>
            <Text style={styles.bankH}>Bank Details</Text>
            <View style={styles.bankR}>
              <Text style={styles.bankL}>Name</Text>
              <Text style={styles.bankV}>{b.bankName}</Text>
            </View>
            <View style={styles.bankR}>
              <Text style={styles.bankL}>Branch</Text>
              <Text style={styles.bankV}>{b.bankBranch}</Text>
            </View>
            <View style={styles.bankR}>
              <Text style={styles.bankL}>Acc. Name</Text>
              <Text style={styles.bankV}>{b.bankAccountName}</Text>
            </View>
            <View style={styles.bankR}>
              <Text style={styles.bankL}>Acc. Number</Text>
              <Text style={styles.bankV}>{b.bankAccount}</Text>
            </View>
            <View style={styles.bankR}>
              <Text style={styles.bankL}>IFSC</Text>
              <Text style={styles.bankV}>{b.bankIfsc}</Text>
            </View>
            <Text style={styles.payH}>Payment Terms</Text>
            {b.paymentTermsBullets.map((line, i) => (
              <View key={i} style={styles.payI}>
                <Text style={styles.payN}>{i + 1}.</Text>
                <Text style={styles.payX}>{line}</Text>
              </View>
            ))}
          </View>

          <View style={styles.bottomRight}>
            <View style={styles.sumRow}>
              <Text style={styles.sumLab}>Taxable Amount</Text>
              <Text style={styles.sumVal}>{fmtNum(base)}</Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.sumLab}>Add : CGST</Text>
              <Text style={styles.sumVal}>{fmtNum(cgst)}</Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.sumLab}>Add : SGST</Text>
              <Text style={styles.sumVal}>{fmtNum(sgst)}</Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.sumLab}>Total Tax</Text>
              <Text style={styles.sumVal}>{fmtNum(gstTotal)}</Text>
            </View>
            <View style={styles.sumTotal}>
              <Text style={styles.sumTotalLab}>Total Amount After Tax</Text>
              <Text style={styles.sumTotalVal}>₹{fmtNum(total)}</Text>
            </View>
            <Text style={styles.eoe}>{'(E & O.E.)'}</Text>
            <Text style={styles.cert}>Certified that the particulars given above are true and correct.</Text>
            <Text style={styles.forCo}>For {b.companyName}</Text>
            <View style={styles.sigSpace} />
            <Text style={styles.authSig}>Authorised Signatory</Text>
          </View>
        </View>

        <Text style={styles.footGen}>
          System generated invoice. {new Date().toLocaleString('en-IN')}
          {hasAnnex ? ` | ${annexSummary(data)}` : ''}
        </Text>
        </View>
      </Page>
    </Document>
  );
}
