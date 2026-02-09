/**
 * PDF text extraction utility
 * Wraps pdf-parse with proper error handling
 */

import pdf from 'pdf-parse';

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
export async function extractTextFromPDF(buffer: Buffer): Promise<PDFParseResult> {
    try {
        const result = await pdf(buffer);
        return {
            text: result.text || '',
            numpages: result.numpages || 0,
            info: result.info || {}
        };
    } catch (error) {
        throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
