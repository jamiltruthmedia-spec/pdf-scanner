import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import Tesseract from 'tesseract.js';

// In-memory storage for prototype
const documents: Map<string, {
  id: string;
  filename: string;
  jobNumber: string | null;
  formulaId: string | null;
  productName: string | null;
  extractedText: string;
  uploadedAt: string;
  fileUrl: string | null;
  pageCount: number;
  metadata: Record<string, unknown>;
}> = new Map();

// Extract job number, formula ID, and product name from OCR text
function extractMetadata(text: string) {
  const metadata: {
    jobNumber: string | null;
    formulaId: string | null;
    productName: string | null;
  } = {
    jobNumber: null,
    formulaId: null,
    productName: null,
  };

  // Job # pattern - find ALL job numbers in the document
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

// GET - List all documents
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q')?.toLowerCase();
    const jobNumber = searchParams.get('jobNumber');
    const formulaId = searchParams.get('formulaId');

    let results = Array.from(documents.values());

    if (jobNumber) {
      results = results.filter(doc => doc.jobNumber === jobNumber);
    }

    if (formulaId) {
      results = results.filter(doc => doc.formulaId === formulaId);
    }

    if (query) {
      results = results.filter(doc => 
        doc.extractedText.toLowerCase().includes(query) ||
        doc.filename.toLowerCase().includes(query) ||
        doc.productName?.toLowerCase().includes(query)
      );
    }

    results.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    return NextResponse.json({ documents: results });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

// POST - Upload and process a document
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const id = uuidv4();
    const filename = file.name;
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type;

    let extractedText = '';
    let pageCount = 1;

    console.log(`Processing file: ${filename} (${mimeType})`);

    if (mimeType === 'application/pdf') {
      // PDFs need to be converted to images for OCR to work on scanned documents
      return NextResponse.json({
        success: false,
        error: 'PDF_NEEDS_CONVERSION',
        message: 'Scanned PDFs need to be converted to images for OCR. Please use Windows Snipping Tool (Win+Shift+S) to screenshot each page and upload those instead. This gives the best OCR accuracy.',
        filename,
      }, { status: 400 });
    } else if (mimeType.startsWith('image/')) {
      // Process image with OCR
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64}`;
      
      console.log('Starting OCR for image:', filename);
      const result = await Tesseract.recognize(dataUrl, 'eng', {
        logger: (m) => console.log('OCR:', m.status, m.progress?.toFixed(2)),
      });
      
      extractedText = result.data.text;
      console.log('OCR complete, extracted', extractedText.length, 'characters');
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload images (JPG, PNG).' },
        { status: 400 }
      );
    }

    // Extract metadata from text
    const metadata = extractMetadata(extractedText);

    // Create document record
    const doc = {
      id,
      filename,
      jobNumber: metadata.jobNumber,
      formulaId: metadata.formulaId,
      productName: metadata.productName,
      extractedText,
      uploadedAt: new Date().toISOString(),
      fileUrl: null,
      pageCount,
      metadata: {},
    };

    documents.set(id, doc);

    console.log('Document saved:', {
      id,
      filename,
      pageCount,
      jobNumber: metadata.jobNumber,
      formulaId: metadata.formulaId,
      textLength: extractedText.length,
    });

    return NextResponse.json({ success: true, document: doc });
  } catch (error) {
    console.error('Error processing document:', error);
    return NextResponse.json(
      { error: 'Failed to process document: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
