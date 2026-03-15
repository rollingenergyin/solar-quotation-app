declare module 'pdf-parse' {
  interface PdfData {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown> | null;
    text: string;
    version: string;
  }

  function pdfParse(
    dataBuffer: Buffer,
    options?: { pagerender?: (page: unknown) => string; max?: number }
  ): Promise<PdfData>;

  export default pdfParse;
}
