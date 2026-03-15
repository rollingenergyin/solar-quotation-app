/**
 * PDF generator — DCR Quotation Template
 *
 * Strategy (dual-pass):
 *
 * PASS 1 — BT-block replacement
 *   For each BT…ET block that contains a placeholder, we decode its full text
 *   (prefix + placeholder + suffix, e.g. "Rs. z1/-"), replace the placeholder
 *   with the real value, and re-encode the entire string as a single Tj call
 *   positioned at the original Tm.  This completely eliminates the Td-offset
 *   overflow that occurs when a longer value replaces a 2-char placeholder.
 *
 * PASS 2 — Per-Tj fallback
 *   For any placeholder that Pass 1 could not handle (e.g. separate BT blocks
 *   or characters missing from the local font subset) we fall back to the
 *   original two-Tj pattern replacement.
 *
 * OVERLAY — Page 1 headline
 *   The cover page renders "x1 kW" via a Montserrat-Bold font subset that
 *   only contains {x, 1, K, W, space}.  Digits like "3" are absent, so the
 *   stream-patching approaches cannot replace it.  We overlay the real value
 *   using an embedded Montserrat-Bold WOFF font drawn directly onto the page
 *   at the pre-calculated page coordinates.
 */

import { PDFDocument, PDFName, PDFNumber, rgb } from 'pdf-lib';
// @ts-ignore – fontkit has no bundled types that work with ESM
import fontkit from '@pdf-lib/fontkit';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { inflateSync, deflateSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH   = resolve(__dirname, '../../../../DCR Quotation Template.pdf');
const MONTSERRAT_BOLD = resolve(__dirname, '../../../../node_modules/@fontsource/montserrat/files/montserrat-latin-700-normal.woff');

const PLACEHOLDERS = [
  'x1', 'x2', 'x3', 'x4', 'x5', 'x6',
  'y1', 'y2', 'y3', 'y4', 'y5', 'y6', 'y7', 'y8',
  'z1', 'z2', 'z3', 'z4', 'z5',
  'a1', 'a2', 'a3',
] as const;

export type PdfValues = Record<(typeof PLACEHOLDERS)[number], string>;

// ─── Page-1 overlay coordinates ──────────────────────────────────────────────
// The "x1 kW" headline lives in Form-XObject obj-27 whose content is rendered
// with combined CTM = [0.75, 0, 0, -0.75, 101.31, 468.95].
// Tm for "x" = 1 0 0 -1 156.95 122 → page pt (219, 377), font 50 pt.
// White rect covers the full "x1 KW" span (obj-27 "x" + obj-27 "1 KW" block).
const P1_X      = 219;
const P1_Y      = 377;
const P1_SIZE   = 50;
const P1_COLOR  = rgb(0.086, 0.110, 0.204); // dark navy (.0863 .1098 .2039 rg)
const P1_RECT   = { x: 210, y: 360, width: 175, height: 65 }; // white cover

// ─── CMap / Glyph helpers ─────────────────────────────────────────────────────

function parseCMap(cmapText: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const block of cmapText.match(/beginbfchar[\s\S]*?endbfchar/g) ?? []) {
    for (const [, g, u] of block.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      map.set(String.fromCodePoint(parseInt(u, 16)), g.toUpperCase().padStart(4, '0'));
    }
  }
  for (const block of cmapText.match(/beginbfrange[\s\S]*?endbfrange/g) ?? []) {
    for (const [, gS, gE, uS] of block.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      let g = parseInt(gS, 16), u = parseInt(uS, 16);
      const gEnd = parseInt(gE, 16);
      while (g <= gEnd) {
        map.set(String.fromCodePoint(u), g.toString(16).toUpperCase().padStart(4, '0'));
        g++; u++;
      }
    }
  }
  return map; // char → glyphHex
}

function parseGlyphCMap(cmapText: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const [ch, g] of parseCMap(cmapText)) if (!map.has(g)) map.set(g, ch);
  return map; // glyphHex → char
}

interface FontMaps { c2g: Map<string, string>; g2c: Map<string, string> }

const _fontCache = new Map<unknown, FontMaps | null>();

function getFontMaps(fRef: unknown, pdfDoc: PDFDocument): FontMaps | null {
  if (_fontCache.has(fRef)) return _fontCache.get(fRef)!;
  const fo = (pdfDoc as any).context.lookup(fRef) as any;
  if (!fo?.dict) { _fontCache.set(fRef, null); return null; }
  const tR = fo.dict.get?.(PDFName.of('ToUnicode'));
  if (!tR) { _fontCache.set(fRef, null); return null; }
  const tO = (pdfDoc as any).context.lookup(tR) as any;
  if (!tO?.contents) { _fontCache.set(fRef, null); return null; }
  let buf: Buffer;
  try { buf = inflateSync(Buffer.from(tO.contents)); } catch { buf = Buffer.from(tO.contents); }
  const text = buf.toString('latin1');
  const c2g = parseCMap(text);
  const g2c = parseGlyphCMap(text);
  const maps: FontMaps = { c2g, g2c };
  _fontCache.set(fRef, maps);
  return maps;
}

/** Build a unified global char→glyph from all Regular/Medium fonts (priority) then Bold. */
function buildGlobalMaps(pdfDoc: PDFDocument): { c2g: Map<string, string>; g2c: Map<string, string> } {
  const ctx = (pdfDoc as any).context as { indirectObjects: Map<unknown, unknown> };
  const c2g = new Map<string, string>();
  const g2c = new Map<string, string>();
  for (const pass of [0, 1]) {
    for (const [, raw] of ctx.indirectObjects) {
      const obj = raw as any;
      if (!obj?.dict) continue;
      if (String(obj.dict.get?.(PDFName.of('Type')) ?? '') !== '/Font') continue;
      const bf = String(obj.dict.get?.(PDFName.of('BaseFont')) ?? '');
      const isReg = bf.includes('Montserrat-Regular') || bf.includes('Montserrat-Medium');
      if (pass === 0 && !isReg) continue;
      if (pass === 1 && isReg) continue;
      const maps = getFontMaps(obj, pdfDoc);
      if (!maps) continue;
      for (const [ch, g] of maps.c2g) { if (!c2g.has(ch)) c2g.set(ch, g); }
      for (const [g, ch] of maps.g2c) { if (!g2c.has(g)) g2c.set(g, ch); }
    }
  }
  return { c2g, g2c };
}

/** Get per-font-name maps from a stream's Resource dict. */
function getStreamFontByName(obj: any, pdfDoc: PDFDocument): Map<string, FontMaps> {
  const result = new Map<string, FontMaps>();
  const resRef = obj.dict.get?.(PDFName.of('Resources'));
  const resObj = resRef ? (pdfDoc as any).context.lookup(resRef) as any : null;
  const resDict = resObj?.dict ?? null;
  if (!resDict) return result;
  const flR = resDict.get?.(PDFName.of('Font'));
  const flO = flR ? (pdfDoc as any).context.lookup(flR) as any : null;
  if (!flO?.dict) return result;
  for (const [fname, fRef] of flO.dict.entries()) {
    const maps = getFontMaps(fRef, pdfDoc);
    if (maps) result.set(String(fname).replace(/^\//, ''), maps);
  }
  return result;
}

/** Get merged char→glyph for a stream's fonts (placeholder-bearing fonts first, then others). */
function getMergedC2G(
  obj: any,
  pdfDoc: PDFDocument,
  globalC2G: Map<string, string>,
): Map<string, string> {
  const merged = new Map<string, string>();
  const fontByName = getStreamFontByName(obj, pdfDoc);
  for (const pass of [0, 1]) {
    for (const [, maps] of fontByName) {
      const hasPlaceholderChars = maps.c2g.has('x') || maps.c2g.has('y') || maps.c2g.has('z') || maps.c2g.has('a');
      if (pass === 0 && !hasPlaceholderChars) continue;
      if (pass === 1 && hasPlaceholderChars) continue;
      for (const [ch, g] of maps.c2g) if (!merged.has(ch)) merged.set(ch, g);
    }
  }
  for (const [ch, g] of globalC2G) if (!merged.has(ch)) merged.set(ch, g);
  return merged;
}

// ─── PDF literal string helpers ───────────────────────────────────────────────

function unescapePdfBytes(s: string): string {
  return s.replace(/\\(.)/g, (_, c) => c);
}

function escapePdfLiteral(bytes: string): string {
  let out = '';
  for (const ch of bytes) {
    if (ch === '(' || ch === ')' || ch === '\\') out += '\\' + ch;
    else out += ch;
  }
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function glyphToBytes(g: string): string {
  return String.fromCharCode(parseInt(g.slice(0, 2), 16), parseInt(g.slice(2, 4), 16));
}

function strToGlyphBinary(str: string, c2g: Map<string, string>): string | null {
  let out = '';
  for (const ch of str) {
    const g = c2g.get(ch);
    if (!g) return null;
    out += glyphToBytes(g);
  }
  return out;
}

// ─── PASS 1 — BT-block replacement ────────────────────────────────────────────

/**
 * For each BT…ET block in the stream:
 *   • decode all Tj text (literal + hex) using the block's specific font
 *     plus global fallback for missing chars
 *   • if a placeholder substring is found, replace it
 *   • re-encode the full updated string and rebuild as a single Tm+Tj block
 *
 * This approach completely fixes suffix-overflow problems (e.g. "Rs. z1/-").
 */
function patchStreamBTBlocks(
  rawBytes: Uint8Array,
  values: PdfValues,
  fontByName: Map<string, FontMaps>,
  globalG2C: Map<string, string>,
  globalC2G: Map<string, string>,
): Uint8Array | null {
  let decompressed: Buffer;
  let wasFlate = false;
  try { decompressed = inflateSync(Buffer.from(rawBytes)); wasFlate = true; }
  catch { decompressed = Buffer.from(rawBytes); }

  let content = decompressed.toString('latin1');
  const before = content;

  content = content.replace(/BT([\s\S]*?)ET/g, (fullBlock, btContent) => {
    const tfM = btContent.match(/\/(\w+)\s+([\d.]+)\s+Tf/);
    const tmM = btContent.match(/1\s+0\s+0\s+-1\s+([\d.]+)\s+([\d.]+)\s+Tm/);
    if (!tfM || !tmM) return fullBlock;

    const fontName = tfM[1];
    const maps = fontByName.get(fontName);
    const fontG2C = maps?.g2c ?? new Map<string, string>();
    const fontC2G = maps?.c2g ?? new Map<string, string>();

    // Decode all Tj calls in order (literal + hex)
    let decoded = '';
    const re = /(?:\(((?:[^()\\]|\\.)*)\)|<([0-9A-Fa-f]{4})>)\s*Tj/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(btContent)) !== null) {
      if (m[1] !== undefined) {
        const bytes = unescapePdfBytes(m[1]);
        for (let i = 0; i + 1 < bytes.length; i += 2) {
          const g = bytes.charCodeAt(i).toString(16).padStart(2, '0').toUpperCase()
                  + bytes.charCodeAt(i + 1).toString(16).padStart(2, '0').toUpperCase();
          decoded += fontG2C.get(g) ?? globalG2C.get(g) ?? '';
        }
      } else if (m[2]) {
        const g = m[2].toUpperCase();
        decoded += fontG2C.get(g) ?? globalG2C.get(g) ?? '';
      }
    }

    if (!decoded) return fullBlock;

    let newText = decoded;
    let modified = false;
    for (const ph of PLACEHOLDERS) {
      if (newText.includes(ph)) {
        newText = newText.replace(new RegExp(ph, 'g'), values[ph]);
        modified = true;
      }
    }
    if (!modified) return fullBlock;

    // Re-encode using font-specific c2g + global fallback
    let glyphs = '';
    for (const ch of newText) {
      const g = fontC2G.get(ch) ?? globalC2G.get(ch);
      if (!g) return fullBlock; // missing glyph → keep original, let Pass 2 handle
      glyphs += glyphToBytes(g);
    }

    return `BT\n/${tfM[1]} ${tfM[2]} Tf\n1 0 0 -1 ${tmM[1]} ${tmM[2]} Tm\n(${escapePdfLiteral(glyphs)}) Tj\nET`;
  });

  if (content === before) return null;
  const buf = Buffer.from(content, 'latin1');
  return new Uint8Array(wasFlate ? deflateSync(buf) : buf);
}

// ─── PASS 2 — Per-Tj pattern fallback ─────────────────────────────────────────

interface Replacement { pattern: RegExp; replacement: string }

function buildPatterns(values: PdfValues, charToGlyph: Map<string, string>): Replacement[] {
  const result: Replacement[] = [];
  for (const ph of PLACEHOLDERS) {
    const g1 = charToGlyph.get(ph[0]);
    const g2 = charToGlyph.get(ph[1]);
    if (!g1 || !g2) continue;

    const valueGlyphs = strToGlyphBinary(values[ph], charToGlyph);
    if (!valueGlyphs) continue;

    const b1pdf = escapePdfLiteral(glyphToBytes(g1));
    const b2pdf = escapePdfLiteral(glyphToBytes(g2));

    const pat = new RegExp(
      `\\(${escapeRegex(b1pdf)}\\)\\s+Tj\\n[\\d.]+\\s+0\\s+Td\\n\\(${escapeRegex(b2pdf)}\\)\\s+Tj`,
      'g',
    );
    result.push({ pattern: pat, replacement: `(${escapePdfLiteral(valueGlyphs)}) Tj` });
  }
  return result;
}

function patchStreamPerTj(rawBytes: Uint8Array, replacements: Replacement[]): Uint8Array | null {
  let decompressed: Buffer;
  let wasFlate = false;
  try { decompressed = inflateSync(Buffer.from(rawBytes)); wasFlate = true; }
  catch { decompressed = Buffer.from(rawBytes); }

  let content = decompressed.toString('latin1');
  const before = content;
  for (const { pattern, replacement } of replacements) {
    content = content.replace(pattern, replacement);
  }
  if (content === before) return null;
  const buf = Buffer.from(content, 'latin1');
  return new Uint8Array(wasFlate ? deflateSync(buf) : buf);
}

// ─── Main replacement orchestrator ───────────────────────────────────────────

function applyReplacements(
  pdfDoc: PDFDocument,
  values: PdfValues,
  globalMaps: { c2g: Map<string, string>; g2c: Map<string, string> },
): void {
  const ctx = (pdfDoc as any).context as { indirectObjects: Map<unknown, unknown> };

  const skipObj = (obj: any): boolean => {
    if (!(obj?.contents instanceof Uint8Array) || !obj.dict) return true;
    const sub = String(obj.dict.get?.(PDFName.of('Subtype')) ?? '');
    const typ = String(obj.dict.get?.(PDFName.of('Type')) ?? '');
    if (sub === '/Image' || sub === '/XML') return true;
    if (typ === '/Font' || typ === '/ObjStm') return true;
    if (obj.dict.has?.(PDFName.of('FontFile')))  return true;
    if (obj.dict.has?.(PDFName.of('FontFile2'))) return true;
    if (obj.dict.has?.(PDFName.of('FontFile3'))) return true;
    return false;
  };

  for (const [, raw] of ctx.indirectObjects) {
    const obj = raw as any;
    if (skipObj(obj)) continue;

    const fontByName = getStreamFontByName(obj, pdfDoc);

    // ── Pass 1: BT-block approach ─────────────────────────────────────────
    let newBytes = patchStreamBTBlocks(
      obj.contents as Uint8Array,
      values,
      fontByName,
      globalMaps.g2c,
      globalMaps.c2g,
    );
    if (newBytes) {
      obj.contents = newBytes;
      obj.dict.set(PDFName.of('Length'), PDFNumber.of(newBytes.length));
    }

    // ── Pass 2: Per-Tj fallback for any remaining placeholders ────────────
    const mergedC2G = getMergedC2G(obj, pdfDoc, globalMaps.c2g);
    const replacements = buildPatterns(values, mergedC2G);
    if (replacements.length > 0) {
      const p2Bytes = patchStreamPerTj(obj.contents as Uint8Array, replacements);
      if (p2Bytes) {
        obj.contents = p2Bytes;
        obj.dict.set(PDFName.of('Length'), PDFNumber.of(p2Bytes.length));
      }
    }
  }
}

// ─── Structure tree update ────────────────────────────────────────────────────

function updateStructureTree(pdfDoc: PDFDocument, values: PdfValues): void {
  const ctx = (pdfDoc as any).context as { indirectObjects: Map<unknown, unknown> };
  for (const [, raw] of ctx.indirectObjects) {
    const obj = raw as any;
    if (!obj?.contents) continue;
    let buf: Buffer;
    try { buf = inflateSync(Buffer.from(obj.contents)); } catch { buf = Buffer.from(obj.contents); }
    const text = buf.toString('latin1');
    if (!text.includes('/E ')) continue;
    let updated = text;
    for (const ph of PLACEHOLDERS) {
      updated = updated.replace(
        new RegExp(`(/E\\s*\\([^)]*?)\\b${ph}\\b([^)]*\\))`, 'g'),
        (_m, pre, post) => `${pre}${values[ph]}${post}`,
      );
    }
    if (updated === text) continue;
    const nb = Buffer.from(updated, 'latin1');
    const rc = new Uint8Array((() => { try { return deflateSync(nb); } catch { return nb; } })());
    obj.contents = rc;
    obj.dict?.set?.(PDFName.of('Length'), PDFNumber.of(rc.length));
  }
}

// ─── Page-1 overlay ───────────────────────────────────────────────────────────

async function overlayPage1Headline(pdfDoc: PDFDocument, systemKwValue: string): Promise<void> {
  try {
    const woffBytes = readFileSync(MONTSERRAT_BOLD);
    const page1 = pdfDoc.getPages()[0];

    // Cover the original "x1 KW" characters (spans two separate BT blocks)
    page1.drawRectangle({
      x: P1_RECT.x,
      y: P1_RECT.y,
      width:  P1_RECT.width,
      height: P1_RECT.height,
      color: rgb(1, 1, 1),
      opacity: 1,
    });

    // Draw the actual system size
    const font = await pdfDoc.embedFont(woffBytes);
    page1.drawText(`${systemKwValue} kW`, {
      x:    P1_X,
      y:    P1_Y,
      font,
      size:  P1_SIZE,
      color: P1_COLOR,
    });
  } catch (err) {
    // Non-fatal: if font can't be embedded, the stream replacement (Pass 2) at
    // least shows the correct value in the subtitle block (obj-540).
    console.warn('[pdf] page-1 overlay failed:', (err as Error).message);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateFilledPdf(values: PdfValues): Promise<Uint8Array> {
  const nodeBuf = readFileSync(TEMPLATE_PATH);
  const cleanBuf = nodeBuf.buffer.slice(nodeBuf.byteOffset, nodeBuf.byteOffset + nodeBuf.byteLength);

  const doc = await PDFDocument.load(cleanBuf, { ignoreEncryption: true });
  doc.registerFontkit(fontkit);

  _fontCache.clear();

  const globalMaps = buildGlobalMaps(doc);

  // Stream-level replacements (Pass 1 + Pass 2 on every content object)
  applyReplacements(doc, values, globalMaps);

  // Accessibility structure tree
  updateStructureTree(doc, values);

  // Page-1 Montserrat-Bold overlay for the large "x1 kW" headline
  await overlayPage1Headline(doc, values.x1);

  // Remove placeholder-index reference sheet (original page 3, index 2)
  if (doc.getPageCount() > 2) {
    doc.removePage(2);
  }

  return doc.save();
}

// ─── Route helpers ────────────────────────────────────────────────────────────

export function calc30YrSavings(annualSavingsYr1: number, gridInflationPct: number): number {
  let total = 0;
  for (let y = 0; y < 30; y++) {
    total += Math.round(annualSavingsYr1 * Math.pow(1 + gridInflationPct / 100, y));
  }
  return total;
}

/**
 * EMI using standard reducing balance formula:
 * EMI = P × r × (1+r)^n / ((1+r)^n − 1)
 * P = loan amount, r = monthly rate (9% → 0.0075), n = months
 */
export function calcLoanEmi(
  totalCost: number,
  loanFraction: number,
  annualRatePct: number,
  tenureMonths: number,
): number {
  const P = totalCost * loanFraction;
  const r = annualRatePct / (12 * 100);
  const n = tenureMonths;
  if (P <= 0) return 0;
  if (r === 0) return Math.round(P / n);
  const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return Math.round(emi);
}
