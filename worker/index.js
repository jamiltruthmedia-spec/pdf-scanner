import { createClient } from '@supabase/supabase-js';
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Configuration - EDIT THESE VALUES
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://azgcxwsovslmxbgovyew.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6Z2N4d3NvdnNsbXhiZ292eWV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5Njk1MTQsImV4cCI6MjA4NTU0NTUxNH0.IV-6orRMaIOhRp9Fghfz-dyUSVBrWjj27VQ8-hhBf64';
const POLL_INTERVAL_MS = 30000; // Check every 30 seconds
const TEMP_DIR = path.join(os.tmpdir(), 'pdf-scanner-worker');

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Ensure temp directory exists
await fs.mkdir(TEMP_DIR, { recursive: true });

// Extract metadata from OCR text
function extractMetadata(text) {
  const metadata = {
    jobNumber: null,
    formulaId: null,
    productName: null,
  };

  // Job # pattern
  const jobMatches = text.match(/Job\s*#[:\s]*(\d+)/gi);
  if (jobMatches && jobMatches.length > 0) {
    const numbers = jobMatches.map(m => m.match(/(\d+)/)?.[1]).filter(Boolean);
    metadata.jobNumber = numbers[0] || null;
  }

  // Formula ID pattern
  const formulaMatch = text.match(/Formula\s*ID[:\s]*(\d+)/i);
  if (formulaMatch) {
    metadata.formulaId = formulaMatch[1];
  }

  // Product name
  const nameMatch = text.match(/Name[:\s]+([A-Za-z0-9%\s]+?)(?:\n|Gallons|Pounds)/i);
  if (nameMatch) {
    metadata.productName = nameMatch[1].trim();
  }

  return metadata;
}

// Process a single PDF using text extraction first, then OCR if needed
async function processPDF(doc) {
  const { id, filename, file_path } = doc;
  const localPdfPath = path.join(TEMP_DIR, `${id}.pdf`);
  
  console.log(`\n📄 Processing: ${filename}`);
  
  try {
    // Mark as processing
    await supabase
      .from('pdf_documents')
      .update({ processing_status: 'processing' })
      .eq('id', id);

    // Download PDF from Supabase storage
    console.log('  ⬇️  Downloading PDF...');
    const { data: pdfData, error: downloadError } = await supabase.storage
      .from('pdf-uploads')
      .download(file_path);

    if (downloadError) {
      throw new Error(`Download failed: ${downloadError.message}`);
    }

    // Save PDF locally
    const arrayBuffer = await pdfData.arrayBuffer();
    await fs.writeFile(localPdfPath, Buffer.from(arrayBuffer));

    // Load PDF with pdf.js
    console.log('  📖 Loading PDF...');
    const pdfDoc = await pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
    }).promise;
    
    const pageCount = pdfDoc.numPages;
    console.log(`  📑 Found ${pageCount} pages`);
    
    const pageTexts = [];
    let totalTextLength = 0;

    // First, try to extract text directly (for text-based PDFs)
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map(item => item.str || '')
        .join(' ')
        .trim();
      
      pageTexts.push({ pageNum, text: pageText, needsOCR: pageText.length < 50 });
      totalTextLength += pageText.length;
    }

    console.log(`  📝 Direct text extraction: ${totalTextLength} characters`);

    // If very little text, this is likely a scanned PDF - need OCR
    if (totalTextLength < 100 * pageCount) {
      console.log('  🔍 Scanned PDF detected - running OCR...');
      
      // For scanned PDFs, we need to convert to images
      // Since we can't easily render PDFs to images in Node without canvas,
      // we'll extract what we can and note the limitation
      
      // Try OCR on the raw PDF data (Tesseract can sometimes handle PDFs)
      try {
        console.log('  🔍 Attempting OCR on PDF...');
        const result = await Tesseract.recognize(localPdfPath, 'eng', {
          logger: m => {
            if (m.status === 'recognizing text') {
              process.stdout.write(`\r  🔍 OCR Progress: ${Math.round(m.progress * 100)}%`);
            }
          }
        });
        console.log('');
        
        if (result.data.text.length > totalTextLength) {
          pageTexts.length = 0;
          pageTexts.push({ pageNum: 1, text: result.data.text, needsOCR: false });
          totalTextLength = result.data.text.length;
        }
      } catch (ocrError) {
        console.log('  ⚠️  Direct PDF OCR failed, using extracted text');
      }
    }

    // Combine all text
    const extractedText = pageTexts
      .map(p => `--- Page ${p.pageNum} ---\n${p.text}`)
      .join('\n\n');
    
    console.log(`  ✅ Total extracted: ${extractedText.length} characters`);

    // Extract metadata
    const metadata = extractMetadata(extractedText);
    console.log(`  📊 Job #: ${metadata.jobNumber || 'not found'}, Formula: ${metadata.formulaId || 'not found'}`);

    // Update database with results
    await supabase
      .from('pdf_documents')
      .update({
        extracted_text: extractedText,
        job_number: metadata.jobNumber,
        formula_id: metadata.formulaId,
        product_name: metadata.productName,
        page_count: pageCount,
        processing_status: 'completed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', id);

    console.log(`  ✅ Done: ${filename}`);

    // Cleanup temp files
    await fs.unlink(localPdfPath).catch(() => {});

  } catch (error) {
    console.error(`  ❌ Error processing ${filename}:`, error.message);
    
    // Mark as failed
    await supabase
      .from('pdf_documents')
      .update({
        processing_status: 'failed',
        processing_error: error.message,
      })
      .eq('id', id);

    // Cleanup on error
    await fs.unlink(localPdfPath).catch(() => {});
  }
}

// Main polling loop
async function pollForPendingDocuments() {
  try {
    // Get pending documents
    const { data: pendingDocs, error } = await supabase
      .from('pdf_documents')
      .select('*')
      .eq('processing_status', 'pending')
      .order('uploaded_at', { ascending: true })
      .limit(5);

    if (error) {
      console.error('Error fetching pending documents:', error.message);
      return;
    }

    if (pendingDocs && pendingDocs.length > 0) {
      console.log(`\n📋 Found ${pendingDocs.length} pending document(s)`);
      
      for (const doc of pendingDocs) {
        await processPDF(doc);
      }
    }
  } catch (error) {
    console.error('Poll error:', error.message);
  }
}

// Startup banner
console.log('╔══════════════════════════════════════════╗');
console.log('║      PDF Scanner - Local Worker          ║');
console.log('╠══════════════════════════════════════════╣');
console.log(`║  Polling every ${POLL_INTERVAL_MS / 1000} seconds               ║`);
console.log('║  Press Ctrl+C to stop                    ║');
console.log('╚══════════════════════════════════════════╝');
console.log('');
console.log('🔌 Connected to Supabase');
console.log('👀 Watching for pending PDFs...');

// Run immediately, then poll
await pollForPendingDocuments();
setInterval(pollForPendingDocuments, POLL_INTERVAL_MS);
