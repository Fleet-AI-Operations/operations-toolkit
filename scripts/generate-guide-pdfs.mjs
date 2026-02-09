#!/usr/bin/env node

/**
 * Generate PDF versions of user guides
 *
 * Converts all markdown user guides to professionally formatted PDFs
 */

import { mdToPdf } from 'md-to-pdf';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Define guides to convert
const guides = [
  {
    input: 'Documentation/UserGuides/USER_GUIDE.md',
    output: 'Documentation/UserGuides/PDFs/USER_GUIDE.pdf',
    title: 'USER Role Guide - Operations Tools'
  },
  {
    input: 'Documentation/UserGuides/QA_GUIDE.md',
    output: 'Documentation/UserGuides/PDFs/QA_GUIDE.pdf',
    title: 'QA Role Guide - Operations Tools'
  },
  {
    input: 'Documentation/UserGuides/CORE_GUIDE.md',
    output: 'Documentation/UserGuides/PDFs/CORE_GUIDE.pdf',
    title: 'CORE Role Guide - Operations Tools'
  },
  {
    input: 'Documentation/UserGuides/FLEET_GUIDE.md',
    output: 'Documentation/UserGuides/PDFs/FLEET_GUIDE.pdf',
    title: 'FLEET Role Guide - Operations Tools'
  },
  {
    input: 'Documentation/UserGuides/INDEX.md',
    output: 'Documentation/UserGuides/PDFs/INDEX.pdf',
    title: 'User Guides Index - Operations Tools'
  }
];

// PDF styling configuration
const pdfConfig = {
  pdf_options: {
    format: 'A4',
    margin: {
      top: '25mm',
      right: '20mm',
      bottom: '25mm',
      left: '20mm'
    },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `
      <div style="font-size: 9px; color: #666; width: 100%; text-align: center; padding: 0 20mm;">
        <span class="pageNumber"></span> / <span class="totalPages"></span>
      </div>
    `
  },
  css: `
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #333;
      max-width: 100%;
    }
    h1 {
      color: #0070f3;
      font-size: 28pt;
      margin-top: 0;
      padding-bottom: 10px;
      border-bottom: 3px solid #0070f3;
    }
    h2 {
      color: #0070f3;
      font-size: 20pt;
      margin-top: 30px;
      margin-bottom: 15px;
      page-break-after: avoid;
    }
    h3 {
      color: #333;
      font-size: 16pt;
      margin-top: 20px;
      margin-bottom: 10px;
      page-break-after: avoid;
    }
    h4 {
      color: #555;
      font-size: 13pt;
      margin-top: 15px;
      margin-bottom: 8px;
      page-break-after: avoid;
    }
    p {
      margin: 10px 0;
      text-align: justify;
    }
    code {
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
      font-size: 10pt;
      color: #c7254e;
    }
    pre {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 5px;
      border-left: 4px solid #0070f3;
      overflow-x: auto;
      page-break-inside: avoid;
    }
    pre code {
      background: transparent;
      padding: 0;
      color: #333;
      font-size: 9pt;
    }
    ul, ol {
      margin: 10px 0;
      padding-left: 30px;
    }
    li {
      margin: 5px 0;
    }
    blockquote {
      border-left: 4px solid #0070f3;
      margin: 15px 0;
      padding: 10px 20px;
      background: #f8f9fa;
      font-style: italic;
      page-break-inside: avoid;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 10px;
      text-align: left;
    }
    th {
      background: #0070f3;
      color: white;
      font-weight: bold;
    }
    tr:nth-child(even) {
      background: #f8f9fa;
    }
    a {
      color: #0070f3;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    hr {
      border: none;
      border-top: 2px solid #e0e0e0;
      margin: 30px 0;
    }
    .page-break {
      page-break-after: always;
    }
    @media print {
      body {
        font-size: 10pt;
      }
      h2, h3, h4 {
        page-break-after: avoid;
      }
      pre, blockquote, table {
        page-break-inside: avoid;
      }
    }
  `
};

async function generatePDFs() {
  console.log('🚀 Generating PDF versions of user guides...\n');

  // Create output directory
  const outputDir = join(rootDir, 'Documentation/UserGuides/PDFs');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
    console.log('✅ Created PDFs directory\n');
  }

  let successCount = 0;
  let failCount = 0;

  for (const guide of guides) {
    const inputPath = join(rootDir, guide.input);
    const outputPath = join(rootDir, guide.output);

    try {
      console.log(`📄 Converting: ${guide.input}`);

      // Read markdown content
      const markdown = readFileSync(inputPath, 'utf-8');

      // Convert to PDF with custom styling
      const pdf = await mdToPdf(
        { content: markdown },
        {
          ...pdfConfig,
          dest: outputPath
        }
      );

      if (pdf) {
        console.log(`   ✅ Generated: ${guide.output}\n`);
        successCount++;
      }
    } catch (error) {
      console.error(`   ❌ Failed: ${guide.input}`);
      console.error(`   Error: ${error.message}\n`);
      failCount++;
    }
  }

  console.log('─'.repeat(60));
  console.log(`\n✨ PDF generation complete!`);
  console.log(`   Success: ${successCount}/${guides.length}`);
  if (failCount > 0) {
    console.log(`   Failed: ${failCount}/${guides.length}`);
  }
  console.log(`\n📁 PDFs saved to: Documentation/UserGuides/PDFs/\n`);
}

// Run the script
generatePDFs().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
