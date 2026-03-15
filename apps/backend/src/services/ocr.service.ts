import { createWorker, type Worker } from 'tesseract.js';

/** Monthly reading extracted from OCR */
export interface MonthlyReading {
  month: number;
  year: number;
  unitsKwh: number;
  amount?: number;
  confidence: number;
  source: 'table' | 'chart' | 'text' | 'manual';
  rawMatch?: string;
}

/** Structured OCR result */
export interface OcrResult {
  success: boolean;
  rawText: string;
  monthlyReadings: MonthlyReading[];
  tables: string[][][];
  chartLabels: string[];
  overallConfidence: number;
  warnings: string[];
  processingTimeMs: number;
}

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const MONTH_ABBREV = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
// Marathi/Hindi month names (Devanagari): जाने, फेब्रु, मार्च, एप्रिल, मे, जून, जुलै, ऑगस्ट, सप्टें, ऑक्टो, नोव्हें, डिसें
const MARATHI_MONTHS = ['जाने', 'फेब्रु', 'मार्च', 'एप्रिल', 'मे', 'जून', 'जुलै', 'ऑगस्ट', 'सप्टें', 'ऑक्टो', 'नोव्हें', 'डिसें'];

/** Extract numbers that look like kWh consumption (typically 100-5000) */
function extractUnits(text: string): { value: number; raw: string; confidence: number }[] {
  const results: { value: number; raw: string; confidence: number }[] = [];
  const seen = new Set<string>();
  const add = (val: number, raw: string, conf: number) => {
    const key = `${val}-${raw}`;
    const isYear = val >= 2000 && val <= 2030 && String(val).length === 4;
    if (!seen.has(key) && !isYear && val >= 10 && val <= 50000) {
      seen.add(key);
      results.push({ value: val, raw, confidence: conf });
    }
  };
  const patterns = [
    /(?:units?|consumption|kwh|reading|युनिट|एकूण\s*वापर)\s*[:\-]?\s*(\d{2,5}(?:\.\d+)?)/gi,
    /(\d{2,5}(?:\.\d+)?)\s*(?:kwh|units?|युनिट)/gi,
    /current\s*reading\s*[:\-]?\s*(\d{2,5}(?:\.\d+)?)/gi,
    /(\d{2,5}(?:\.\d+)?)\s*-\s*\d{2,5}/g,
    /(?:जुलै|जून|मे|एप्रिल|मार्च|फेब्रु|जाने|डिसें|नोव्हें|ऑक्टो|ऑगस्ट)\s*\d{4}\s*[-\–]\s*(\d{2,5})/g,
    /\b(\d{2,4}(?:\.\d+)?)\b/g,
  ];

  for (const pattern of patterns) {
    let m: RegExpExecArray | null;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((m = regex.exec(text)) !== null) {
      const val = parseFloat(m[1].replace(/,/g, ''));
      const conf = /जुलै|जून|मे|एप्रिल|मार्च|फेब्रु|जाने|डिसें|नोव्हें|ऑक्टो|ऑगस्ट/.test(m[0]) ? 0.9 : 0.85;
      add(val, m[0], conf);
    }
  }

  return results;
}

/** Extract amounts (₹ or Rs) */
function extractAmounts(text: string): { value: number; raw: string }[] {
  const results: { value: number; raw: string }[] = [];
  const patterns = [
    /(?:rupees?|rs\.?|inr|₹|रु|देयक\s*रक्कम|या\s*तारखे)\s*[:\-]?\s*(\d{1,6}(?:\.\d{2})?)/gi,
    /(\d{1,6}(?:\.\d{2})?)\s*(?:rupees?|rs\.?|रु)/gi,
    /total\s*[:\-]?\s*(\d{1,6}(?:\.\d{2})?)/gi,
  ];
  for (const pattern of patterns) {
    let m: RegExpExecArray | null;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((m = regex.exec(text)) !== null) {
      results.push({ value: parseFloat(m[1].replace(/,/g, '')), raw: m[0] });
    }
  }
  return results;
}

/** Detect month/year from text */
function detectMonthYear(text: string, fallbackYear?: number): { month: number; year: number }[] {
  const found: { month: number; year: number }[] = [];
  const yearMatch = text.match(/\b(20\d{2})\b/);
  const year = fallbackYear ?? (yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear());

  for (let i = 0; i < MONTH_NAMES.length; i++) {
    if (text.toLowerCase().includes(MONTH_NAMES[i]) || text.toLowerCase().includes(MONTH_ABBREV[i])) {
      found.push({ month: i + 1, year });
    }
  }
  for (let i = 0; i < MARATHI_MONTHS.length; i++) {
    if (text.includes(MARATHI_MONTHS[i])) {
      found.push({ month: i + 1, year });
    }
  }
  if (found.length === 0 && text.match(/\b(0?[1-9]|1[0-2])\/(\d{4}|\d{2})\b/)) {
    const m = text.match(/(\d{1,2})\/(\d{2,4})/);
    if (m) {
      found.push({ month: parseInt(m[1], 10), year: m[2].length === 2 ? 2000 + parseInt(m[2], 10) : parseInt(m[2], 10) });
    }
  }
  return found;
}

/** Parse table structure from lines (rows with multiple numbers) */
function parseTables(lines: string[]): string[][][] {
  const tables: string[][][] = [];
  let current: string[][] = [];

  for (const line of lines) {
    const cells = line.split(/\s{2,}|\t/).map((c) => c.trim()).filter(Boolean);
    if (cells.length >= 2 && cells.some((c) => /^\d+(\.\d+)?$/.test(c))) {
      current.push(cells);
    } else if (current.length > 0) {
      tables.push(current);
      current = [];
    }
  }
  if (current.length > 0) tables.push(current);
  return tables;
}

/** Extract chart-related labels (axis labels, legends) */
function extractChartLabels(text: string): string[] {
  const labels: string[] = [];
  const labelPatterns = [
    /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/gi,
    /(?:units?|kwh|consumption)/gi,
    /\d{3,5}/g,
  ];
  for (const p of labelPatterns) {
    const m = text.match(p);
    if (m) labels.push(...m);
  }
  return [...new Set(labels)];
}

export async function processImage(buffer: Buffer): Promise<OcrResult> {
  const start = Date.now();
  const warnings: string[] = [];
  let worker: Worker | null = null;

  try {
    worker = await createWorker('hin+eng', 1, {
      logger: () => {},
    });

    const { data } = await worker.recognize(buffer);
    const rawText = data.text;
    const ocrConfidence = data.confidence / 100;

    const tables = parseTables(rawText.split('\n'));
    const chartLabels = extractChartLabels(rawText);
    const hasChartIndicators = /chart|graph|bar|axis|legend/i.test(rawText);

    const unitExtractions = extractUnits(rawText);
    const amountExtractions = extractAmounts(rawText);
    const monthYears = detectMonthYear(rawText);

    const monthlyReadings: MonthlyReading[] = [];
    const usedIndices = new Set<number>();

    for (let i = 0; i < unitExtractions.length; i++) {
      const u = unitExtractions[i];
      const my = monthYears[i % monthYears.length] ?? {
        month: (i % 12) + 1,
        year: new Date().getFullYear(),
      };
      const amt = amountExtractions[i];
      const fromTable = tables.some((t) => t.some((r) => r.some((c) => c.includes(String(u.value)))));
      const fromChart = hasChartIndicators && chartLabels.some((l) => l === String(u.value));

      monthlyReadings.push({
        month: my.month,
        year: my.year,
        unitsKwh: u.value,
        amount: amt?.value,
        confidence: fromChart ? 0.4 : fromTable ? ocrConfidence * 0.95 : ocrConfidence * 0.9,
        source: fromChart ? 'chart' : fromTable ? 'table' : 'text',
        rawMatch: u.raw,
      });
      usedIndices.add(i);
    }

    if (unitExtractions.length === 0 && rawText.trim().length > 50) {
      warnings.push('No consumption units detected. Try manual override.');
    }
    if (hasChartIndicators && unitExtractions.length > 0) {
      warnings.push('Chart detected. Extracted values may be inaccurate.');
    }

    const deduped = deduplicateReadings(monthlyReadings);
    const overallConfidence =
      deduped.length > 0
        ? deduped.reduce((s, r) => s + r.confidence, 0) / deduped.length
        : 0;

    return {
      success: rawText.length > 0,
      rawText,
      monthlyReadings: deduped,
      tables,
      chartLabels,
      overallConfidence: Math.round(overallConfidence * 100) / 100,
      warnings,
      processingTimeMs: Date.now() - start,
    };
  } finally {
    if (worker) await worker.terminate();
  }
}

export async function processPdf(buffer: Buffer): Promise<OcrResult> {
  const start = Date.now();
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    const rawText = data.text;
    if (!rawText || rawText.trim().length < 20) {
      return {
        success: false,
        rawText: rawText ?? '',
        monthlyReadings: [],
        tables: [],
        chartLabels: [],
        overallConfidence: 0,
        warnings: ['PDF appears to be scanned/image-only. Please upload as image (PNG/JPG) for OCR.'],
        processingTimeMs: Date.now() - start,
      };
    }

    const unitExtractions = extractUnits(rawText);
    const amountExtractions = extractAmounts(rawText);
    const monthYears = detectMonthYear(rawText);
    const tables = parseTables(rawText.split('\n'));
    const chartLabels = extractChartLabels(rawText);
    const hasChartIndicators = /chart|graph|bar|axis|legend/i.test(rawText);

    const monthlyReadings: MonthlyReading[] = unitExtractions.map((u, i) => {
      const my = monthYears[i % monthYears.length] ?? {
        month: (i % 12) + 1,
        year: new Date().getFullYear(),
      };
      const amt = amountExtractions[i];
      const fromTable = tables.some((t) => t.some((r) => r.some((c) => c.includes(String(u.value)))));
      const fromChart = hasChartIndicators;
      return {
        month: my.month,
        year: my.year,
        unitsKwh: u.value,
        amount: amt?.value,
        confidence: fromChart ? 0.5 : fromTable ? 0.95 : 0.9,
        source: (fromChart ? 'chart' : fromTable ? 'table' : 'text') as MonthlyReading['source'],
        rawMatch: u.raw,
      };
    });

    const deduped = deduplicateReadings(monthlyReadings);
    const overallConfidence =
      deduped.length > 0
        ? deduped.reduce((s, r) => s + r.confidence, 0) / deduped.length
        : 0;

    return {
      success: true,
      rawText,
      monthlyReadings: deduped,
      tables,
      chartLabels,
      overallConfidence: Math.round(overallConfidence * 100) / 100,
      warnings: hasChartIndicators ? ['Chart detected. Values may need manual verification.'] : [],
      processingTimeMs: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      rawText: '',
      monthlyReadings: [],
      tables: [],
      chartLabels: [],
      overallConfidence: 0,
      warnings: [err instanceof Error ? err.message : 'PDF processing failed'],
      processingTimeMs: Date.now() - start,
    };
  }
}

function deduplicateReadings(readings: MonthlyReading[]): MonthlyReading[] {
  const byKey = new Map<string, MonthlyReading>();
  for (const r of readings) {
    const key = `${r.month}-${r.year}`;
    const existing = byKey.get(key);
    if (!existing || r.confidence > existing.confidence) {
      byKey.set(key, r);
    }
  }
  return [...byKey.values()].sort((a, b) => a.year - b.year || a.month - b.month);
}
