import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import Tesseract from 'tesseract.js';

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

// GET - List all documents
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q')?.toLowerCase();
    const jobNumber = searchParams.get('jobNumber');
    const formulaId = searchParams.get('formulaId');
    const status = searchParams.get('status');

    let dbQuery = supabase
      .from('pdf_documents')
      .select('*')
      .order('uploaded_at', { ascending: false });

    if (jobNumber) {
      dbQuery = dbQuery.eq('job_number', jobNumber);
    }

    if (formulaId) {
      dbQuery = dbQuery.eq('formula_id', formulaId);
    }

    if (status) {
      dbQuery = dbQuery.eq('processing_status', status);
    }

    if (query) {
      dbQuery = dbQuery.ilike('extracted_text', `%${query}%`);
    }

    const { data, error } = await dbQuery;

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform snake_case to camelCase
    const documents = data?.map(doc => ({
      id: doc.id,
      filename: doc.filename,
      jobNumber: doc.job_number,
      formulaId: doc.formula_id,
      productName: doc.product_name,
      extractedText: doc.extracted_text || '',
      uploadedAt: doc.uploaded_at,
      processedAt: doc.processed_at,
      filePath: doc.file_path,
      pageCount: doc.page_count,
      processingStatus: doc.processing_status,
      processingError: doc.processing_error,
      metadata: doc.metadata,
    })) || [];

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

// POST - Upload a document
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

    console.log(`Processing file: ${filename} (${mimeType})`);

    if (mimeType === 'application/pdf') {
      // PDF: Upload to Supabase storage, mark as pending for local worker
      const filePath = `uploads/${id}/${filename}`;
      
      const { error: uploadError } = await getSupabase().storage
        .from('pdf-uploads')
        .upload(filePath, buffer, {
          contentType: mimeType,
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        return NextResponse.json({ error: 'Failed to upload file: ' + uploadError.message }, { status: 500 });
      }

      // Create database record with pending status
      const { data: doc, error: dbError } = await supabase
        .from('pdf_documents')
        .insert({
          id,
          filename,
          file_path: filePath,
          processing_status: 'pending',
          extracted_text: null,
        })
        .select()
        .single();

      if (dbError) {
        console.error('Database error:', dbError);
        return NextResponse.json({ error: 'Failed to save document: ' + dbError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        queued: true,
        message: 'PDF uploaded and queued for processing. Your home computer will process it automatically.',
        document: {
          id: doc.id,
          filename: doc.filename,
          processingStatus: doc.processing_status,
          uploadedAt: doc.uploaded_at,
        },
      });

    } else if (mimeType.startsWith('image/')) {
      // Image: Process with OCR immediately (fast enough for images)
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64}`;
      
      console.log('Starting OCR for image:', filename);
      const result = await Tesseract.recognize(dataUrl, 'eng', {
        logger: (m) => console.log('OCR:', m.status, m.progress?.toFixed(2)),
      });
      
      const extractedText = result.data.text;
      console.log('OCR complete, extracted', extractedText.length, 'characters');

      // Extract metadata from text
      const metadata = extractMetadata(extractedText);

      // Save to database
      const { data: doc, error: dbError } = await supabase
        .from('pdf_documents')
        .insert({
          id,
          filename,
          job_number: metadata.jobNumber,
          formula_id: metadata.formulaId,
          product_name: metadata.productName,
          extracted_text: extractedText,
          page_count: 1,
          processing_status: 'completed',
          processed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (dbError) {
        console.error('Database error:', dbError);
        return NextResponse.json({ error: 'Failed to save document: ' + dbError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        document: {
          id: doc.id,
          filename: doc.filename,
          jobNumber: doc.job_number,
          formulaId: doc.formula_id,
          productName: doc.product_name,
          extractedText: doc.extracted_text,
          uploadedAt: doc.uploaded_at,
          processedAt: doc.processed_at,
          pageCount: doc.page_count,
          processingStatus: doc.processing_status,
        },
      });

    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload PDF or images (JPG, PNG).' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error processing document:', error);
    return NextResponse.json(
      { error: 'Failed to process document: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
