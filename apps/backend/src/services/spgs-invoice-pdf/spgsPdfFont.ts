import { createRequire } from 'node:module';
import path from 'node:path';
import { Font } from '@react-pdf/renderer';

/**
 * Arimo (metric substitute for Arial) — registered TTF/WOFF so @react-pdf/layout gets valid `unitsPerEm`.
 * Body: 400; headings: 600 (semi-bold); strong emphasis: 700.
 */
export const SPGS_PDF_FONT_FAMILY = 'SpgsInvoice';

let registered = false;

export function ensureSpgsPdfFontsRegistered(): void {
  if (registered) return;
  const require = createRequire(import.meta.url);
  const arimoRoot = path.dirname(require.resolve('@fontsource/arimo/package.json'));
  const files = path.join(arimoRoot, 'files');
  Font.register({
    family: SPGS_PDF_FONT_FAMILY,
    fonts: [
      { src: path.join(files, 'arimo-latin-400-normal.woff'), fontWeight: 400 },
      { src: path.join(files, 'arimo-latin-400-italic.woff'), fontWeight: 400, fontStyle: 'italic' },
      { src: path.join(files, 'arimo-latin-600-normal.woff'), fontWeight: 600 },
      { src: path.join(files, 'arimo-latin-700-normal.woff'), fontWeight: 700 },
    ],
  });
  registered = true;
}
