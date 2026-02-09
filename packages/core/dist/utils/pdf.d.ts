/**
 * PDF text extraction utility
 * Wraps pdf-parse with proper error handling
 */
export interface PDFParseResult {
    text: string;
    numpages: number;
    info: Record<string, any>;
}
/**
 * Extract text from a PDF buffer
 * @param buffer PDF file as Buffer
 * @returns Parsed PDF data with text content
 */
export declare function extractTextFromPDF(buffer: Buffer): Promise<PDFParseResult>;
//# sourceMappingURL=pdf.d.ts.map