declare module 'pdf-parse' {
  interface PDFParseOptions {
    version?: string;
    max?: number;
    // Add other options as needed
  }

  interface PDFParseResult {
    numpages: number;
    numrender: number;
    info: any;
    metadata?: any;
    text: string;
    version: string;
  }

  function pdfParse(buffer: Buffer, options?: PDFParseOptions): Promise<PDFParseResult>;

  export = pdfParse;
}