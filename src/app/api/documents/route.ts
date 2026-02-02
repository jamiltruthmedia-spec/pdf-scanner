import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import Tesseract from 'tesseract.js';

// In-memory storage for prototype (replace with Supabase later)
// Note: This resets on each deploy/restart - just for testing!
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

  // Job # pattern: "Job #: 554992" or "Job # 554992" or "Job #554992"
  const jobMatch = text.match(/Job\s*#[:\s]*(\d+)/i);
  if (jobMatch) {
    metadata.jobNumber = jobMatch[1];
  }

  // Formula ID pattern: "Formula ID 202076" or "Formula ID: 202076"
  const formulaMatch = text.match(/Formula\s*ID[:\s]*(\d+)/i);
  if (formulaMatch) {
    metadata.formulaId = formulaMatch[1];
  }

  // Product name - look for "Name" field followed by text
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

    // Apply filters
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

    // Sort by upload date (newest first)
    results.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    return NextResponse.json({ documents: results });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
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
    const base64 = buffer.toString('base64');
    const mimeType = file.type;

    // For images, run OCR directly
    let extractedText = '';

    if (mimeType.startsWith('image/')) {
      const dataUrl = `data:${mimeType};base64,${base64}`;
      
      console.log('Starting OCR for:', filename);
      const result = await Tesseract.recognize(dataUrl, 'eng', {
        logger: (m) => console.log('OCR:', m.status, m.progress),
      });
      
      extractedText = result.data.text;
      console.log('OCR complete, extracted', extractedText.length, 'characters');
    } else if (mimeType === 'application/pdf') {
      extractedText = '[PDF files need to be converted to images first. Please upload JPG/PNG screenshots of the batch sheets.]';
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload images (JPG, PNG).' },
        { status: 400 }
      );
    }

    // Extract metadata from OCR text
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
      fileUrl: null, // Would be storage URL in production
      pageCount: 1,
      metadata: {},
    };

    // Store in memory
    documents.set(id, doc);

    console.log('Document saved:', {
      id,
      filename,
      jobNumber: metadata.jobNumber,
      formulaId: metadata.formulaId,
      productName: metadata.productName,
    });

    return NextResponse.json({
      success: true,
      document: doc,
    });
  } catch (error) {
    console.error('Error processing document:', error);
    return NextResponse.json(
      { error: 'Failed to process document: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
