/**
 * SPGS turnkey invoice PDF — modern layout via @react-pdf/renderer.
 */

export type { SpgsPdfInput } from './invoice-pdf-spgs-types.js';
export { amountToWordsINR } from './invoice-amount-words.js';
export { generateSpgsTurnkeyPdf } from './spgs-invoice-pdf/renderSpgsTurnkeyPdf.js';
