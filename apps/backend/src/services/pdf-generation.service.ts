/**
 * HTML-to-PDF generation using Puppeteer.
 * Renders the quotation print page and captures it as PDF.
 */

import puppeteer, { type Browser } from 'puppeteer';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync, readdirSync } from 'fs';
import { randomBytes } from 'crypto';

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';

/** Resolve Chrome executable (from PUPPETEER_EXECUTABLE_PATH or local chrome/ install) */
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
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads', 'quotations');

// Short-lived tokens for PDF generation (quotationId -> token, 5 min expiry)
const pdfTokens = new Map<string, { token: string; expiresAt: number }>();
const TOKEN_TTL_MS = 5 * 60 * 1000;

function cleanupExpiredTokens() {
  const now = Date.now();
  for (const [id, { expiresAt }] of pdfTokens.entries()) {
    if (expiresAt < now) pdfTokens.delete(id);
  }
}

/** Generate a one-time token for the print page (used by Puppeteer) */
export function createPdfToken(quotationId: string): string {
  cleanupExpiredTokens();
  const token = randomBytes(32).toString('hex');
  pdfTokens.set(quotationId, { token, expiresAt: Date.now() + TOKEN_TTL_MS });
  return token;
}

/** Validate token for template-data endpoint */
export function validatePdfToken(quotationId: string, token: string): boolean {
  const entry = pdfTokens.get(quotationId);
  if (!entry || entry.token !== token || entry.expiresAt < Date.now()) return false;
  pdfTokens.delete(quotationId); // One-time use
  return true;
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

/**
 * Generate PDF by rendering the quotation print page with Puppeteer.
 * Saves to quotations/{quoteNumber}_v{version}.pdf
 */
export async function generateQuotationPdf(
  options: GeneratePdfOptions
): Promise<GeneratePdfResult> {
  const { quotationId, quoteNumber, version } = options;
  const token = createPdfToken(quotationId);
  const printUrl = `${FRONTEND_URL}/quotation/${quotationId}/print?pdf_token=${token}&pdf=1`;

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
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    const response = await page.goto(printUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    if (!response || !response.ok()) {
      throw new Error(`Failed to load print page: ${response?.status() ?? 'unknown'}`);
    }

    // Wait for quotation content to be ready (data attribute set by frontend)
    await page.waitForSelector('#quotation-root[data-pdf-ready="true"]', {
      timeout: 15000,
    });

    await mkdir(UPLOADS_DIR, { recursive: true });

    const filename = `${quoteNumber}_v${version}.pdf`;
    const relativePath = filename;
    const filePath = join(UPLOADS_DIR, relativePath);

    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
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
