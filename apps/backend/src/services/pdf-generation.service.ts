/**
 * PDF generation using Puppeteer with static HTML template.
 * No frontend dependency — pure HTML template + data injection.
 */

import puppeteer, { type Browser } from 'puppeteer';
import { mkdir, readFile } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readdirSync } from 'fs';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads', 'quotations');
const TEMPLATE_PATH = resolve(__dirname, '../../templates/quotation.html');

/** Resolve Chrome executable */
function getChromeExecutablePath(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const chromeDir = join(process.cwd(), 'chrome');
  if (!existsSync(chromeDir)) return undefined;
  try {
    const dirs = readdirSync(chromeDir);
    const macDir = dirs.find((d: string) => d.startsWith('mac_arm-') || d.startsWith('mac-'));
    if (!macDir) return undefined;
    const exe = join(chromeDir, macDir, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
    return existsSync(exe) ? exe : undefined;
  } catch {
    return undefined;
  }
}

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) return browserInstance;
  const executablePath = getChromeExecutablePath();
  browserInstance = await puppeteer.launch({
    headless: true,
    executablePath: executablePath ?? undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });
  return browserInstance;
}

const fmtInr = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

export interface TemplateVars {
  quoteNumber: string;
  date: string;
  customerName: string;
  address: string;
  contactPerson: string;
  systemSize: string;
  inverterSize: string;
  numModules: string;
  areaSqft: string;
  dailyProduction: string;
  monthlyProduction: string;
  annualProduction: string;
  baseCost: string;
  gstAmount: string;
  subsidyAmount: string;
  netCost: string;
  annualSavings: string;
  breakevenYears: string;
}

/** Build template variables from quotation (no frontend) */
async function buildTemplateVars(quotationId: string): Promise<TemplateVars> {
  const q = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: { customer: true, site: true, result: true },
  });
  if (!q) throw new Error('Quotation not found');
  if (!q.result) throw new Error('Quotation not yet calculated');

  const breakdown = (q.result.breakdown as Record<string, unknown>) ?? {};
  const inputs = (breakdown.inputs as Record<string, number>) ?? {};
  const costBreak = (breakdown.costBreakdown as Record<string, number>) ?? {};

  const systemKw = inputs.systemSizeKw ?? (q.totalWattage ? q.totalWattage / 1000 : 0);
  const totalWatts = systemKw * 1000;
  const panelWatt = 575;
  const numPanels = Math.ceil(totalWatts / panelWatt);

  const peakSun = inputs.peakSunHours ?? 5;
  const efficiency = inputs.systemEfficiency ?? 0.8;
  const tariff = inputs.electricityRatePerUnit ?? 8;
  const annualGenKwh = systemKw * peakSun * 365 * efficiency;
  const annualSavYr1 = Math.round(annualGenKwh * tariff);

  const netCost = costBreak.netCost ?? q.totalAmount ?? 0;
  const baseCost = costBreak.baseCost ?? 0;
  const gstAmount = costBreak.gstAmount ?? 0;
  const subsidy = costBreak.subsidyAmount ?? 0;
  const breakevenYears = q.result.roiYears ? Math.round(q.result.roiYears * 10) / 10 : 0;

  const now = new Date();
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dateStr = `${now.getDate().toString().padStart(2, '0')} ${months[now.getMonth()]} ${now.getFullYear()}`;

  return {
    quoteNumber: q.quoteNumber,
    date: dateStr,
    customerName: q.customer.name,
    address: q.site.address || q.customer.address || '',
    contactPerson: q.customer.phone || q.customer.name,
    systemSize: String(systemKw),
    inverterSize: String(q.inverterSizeKw ?? systemKw),
    numModules: String(numPanels),
    areaSqft: String(Math.round(systemKw * 80)),
    dailyProduction: String(Math.round((annualGenKwh / 365) * 10) / 10),
    monthlyProduction: String(Math.round(annualGenKwh / 12)),
    annualProduction: String(Math.round(annualGenKwh)),
    baseCost: fmtInr(baseCost),
    gstAmount: fmtInr(gstAmount),
    subsidyAmount: fmtInr(subsidy),
    netCost: fmtInr(netCost),
    annualSavings: fmtInr(annualSavYr1),
    breakevenYears: String(breakevenYears),
  };
}

/** Inject template variables into HTML */
function injectTemplate(html: string, vars: TemplateVars): string {
  let out = html;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`{{${key}}}`, 'g'), String(value ?? ''));
  }
  return out;
}

export interface GeneratePdfOptions {
  quotationId: string;
  quoteNumber: string;
  version: number;
}

export interface GeneratePdfResult {
  success: true;
  filePath: string;
  relativePath: string;
  filename: string;
}

/** Generate PDF from static HTML template (no frontend) */
export async function generateQuotationPdf(options: GeneratePdfOptions): Promise<GeneratePdfResult> {
  const { quotationId, quoteNumber, version } = options;

  const vars = await buildTemplateVars(quotationId);

  const templateHtml = await readFile(TEMPLATE_PATH, 'utf-8');
  const html = injectTemplate(templateHtml, vars);

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 1,
    });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.emulateMediaType('screen');

    await page.setContent(html, {
      waitUntil: 'networkidle0',
    });
    await page.addStyleTag({
      content: 'body { margin: 0; }',
    });

    await mkdir(UPLOADS_DIR, { recursive: true });

    const filename = `${quoteNumber}_v${version}.pdf`;
    const relativePath = filename;
    const filePath = join(UPLOADS_DIR, relativePath);

    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return {
      success: true,
      filePath,
      relativePath,
      filename,
    };
  } finally {
    await page.close();
  }
}

/** Generate PDF buffer (for direct response, no file save) */
export async function generateQuotationPdfBuffer(quotationId: string): Promise<Buffer> {
  const vars = await buildTemplateVars(quotationId);

  const templateHtml = await readFile(TEMPLATE_PATH, 'utf-8');
  const html = injectTemplate(templateHtml, vars);

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 1,
    });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.emulateMediaType('screen');

    await page.setContent(html, {
      waitUntil: 'networkidle0',
    });
    await page.addStyleTag({
      content: 'body { margin: 0; }',
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await page.close();
  }
}

