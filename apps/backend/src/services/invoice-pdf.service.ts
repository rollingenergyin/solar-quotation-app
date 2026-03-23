/**
 * Invoice PDF Generator - A4 professional layout
 * Uses pdf-lib to create invoices from scratch
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const COMPANY = {
  name: 'Rolling Energy',
  tagline: 'Solar EPC Company',
  address: '2nd Floor, Solar Plaza, Baner Road, Pune 411045, Maharashtra',
  phone: '+91 98765 43210',
  email: 'info@rollingenergy.in',
  website: 'www.rollingenergy.in',
};

export interface InvoiceItem {
  name: string;
  description?: string;
  hsn?: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface InvoicePdfData {
  invoiceNo: string;
  type: string;
  date: string;
  client: {
    name: string;
    address?: string;
    gstin?: string;
    state?: string;
  };
  items: InvoiceItem[];
  subtotal: number;
  gstRate: number; // e.g. 18
  cgst: number;
  sgst: number;
  gstAmount: number;
  totalAmount: number;
}

const fmtNum = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCurrency = (n: number) => '₹ ' + fmtNum(n);

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([595.28, 841.89]); // A4
  const padding = 50;
  let y = 800;

  // ─── Company header ─────────────────────────────────────────────────────
  page.drawText(COMPANY.name, { x: padding, y, size: 18, font: fontBold, color: rgb(0.1, 0.2, 0.4) });
  y -= 12;
  page.drawText(COMPANY.tagline, { x: padding, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
  y -= 10;
  page.drawText(COMPANY.address, { x: padding, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
  y -= 10;
  page.drawText(`${COMPANY.phone} | ${COMPANY.email} | ${COMPANY.website}`, { x: padding, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
  y -= 30;

  // ─── Title & invoice meta ───────────────────────────────────────────────
  page.drawText('TAX INVOICE', { x: padding, y, size: 16, font: fontBold, color: rgb(0, 0, 0) });
  y -= 25;

  // Invoice no, type, date (right aligned)
  const metaX = 400;
  let metaY = y + 25;
  page.drawText(`Invoice No: ${data.invoiceNo}`, { x: metaX, y: metaY, size: 10, font: fontBold });
  metaY -= 14;
  page.drawText(`Type: ${data.type}`, { x: metaX, y: metaY, size: 9, font });
  metaY -= 12;
  page.drawText(`Date: ${data.date}`, { x: metaX, y: metaY, size: 9, font });
  y -= 20;

  // ─── Bill to ─────────────────────────────────────────────────────────────
  page.drawText('Bill To', { x: padding, y, size: 10, font: fontBold });
  y -= 12;
  page.drawText(data.client.name, { x: padding, y, size: 10, font });
  y -= 12;
  if (data.client.address) {
    page.drawText(data.client.address, { x: padding, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
    y -= 10;
  }
  if (data.client.gstin) {
    page.drawText(`GSTIN: ${data.client.gstin}`, { x: padding, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
    y -= 10;
  }
  y -= 20;

  // ─── Items table ────────────────────────────────────────────────────────
  const colW = { sr: 25, desc: 210, hsn: 50, qty: 45, rate: 65, amount: 75 };
  const startX = padding;
  const tableTop = y;

  // Header row
  const rowH = 18;
  page.drawRectangle({ x: startX, y: y - 4, width: 530, height: rowH + 4, color: rgb(0.95, 0.95, 0.95) });
  let hx = startX + 6;
  page.drawText('#', { x: hx, y: y + 4, size: 9, font: fontBold });
  hx += colW.sr;
  page.drawText('Description', { x: hx, y: y + 4, size: 9, font: fontBold });
  hx += colW.desc;
  page.drawText('HSN', { x: hx, y: y + 4, size: 9, font: fontBold });
  hx += colW.hsn;
  page.drawText('Qty', { x: hx, y: y + 4, size: 9, font: fontBold });
  hx += colW.qty;
  page.drawText('Rate (₹)', { x: hx, y: y + 4, size: 9, font: fontBold });
  hx += colW.rate;
  page.drawText('Amount (₹)', { x: hx, y: y + 4, size: 9, font: fontBold });
  y -= rowH + 4;

  data.items.forEach((item, i) => {
    const desc = (item.description ? `${item.name} – ${item.description}` : item.name).slice(0, 50);
    page.drawText(String(i + 1), { x: startX + 6, y, size: 9, font });
    page.drawText(desc, { x: startX + colW.sr + 6, y, size: 9, font });
    page.drawText(item.hsn ?? '8541', { x: startX + colW.sr + colW.desc + 6, y, size: 9, font });
    page.drawText(String(item.qty), { x: startX + colW.sr + colW.desc + colW.hsn + 6, y, size: 9, font });
    page.drawText(fmtNum(item.rate), { x: startX + colW.sr + colW.desc + colW.hsn + colW.qty + 6, y, size: 9, font });
    page.drawText(fmtNum(item.amount), { x: startX + colW.sr + colW.desc + colW.hsn + colW.qty + colW.rate + 6, y, size: 9, font });
    y -= rowH;
  });

  y -= 15;

  // ─── Totals & GST ───────────────────────────────────────────────────────
  const totX = 380;
  page.drawText(`Subtotal:`, { x: totX, y, size: 9, font });
  page.drawText(fmtCurrency(data.subtotal), { x: totX + 120, y, size: 9, font });
  y -= 12;
  if (data.gstAmount > 0) {
    page.drawText(`CGST @ ${data.gstRate / 2}%:`, { x: totX, y, size: 9, font });
    page.drawText(fmtCurrency(data.cgst), { x: totX + 120, y, size: 9, font });
    y -= 12;
    page.drawText(`SGST @ ${data.gstRate / 2}%:`, { x: totX, y, size: 9, font });
    page.drawText(fmtCurrency(data.sgst), { x: totX + 120, y, size: 9, font });
    y -= 12;
  }
  page.drawRectangle({ x: totX - 5, y: y - 2, width: 155, height: 22, color: rgb(0.96, 0.96, 0.96) });
  page.drawText('Total:', { x: totX, y: y + 4, size: 11, font: fontBold });
  page.drawText(fmtCurrency(data.totalAmount), { x: totX + 100, y: y + 4, size: 11, font: fontBold });
  y -= 35;

  // ─── Footer ─────────────────────────────────────────────────────────────
  page.drawText('System Generated – No Signature Required', {
    x: padding,
    y: 50,
    size: 8,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });
  page.drawText(`Generated on ${new Date().toLocaleString('en-IN')}`, {
    x: padding,
    y: 38,
    size: 7,
    font,
    color: rgb(0.6, 0.6, 0.6),
  });

  return doc.save();
}
