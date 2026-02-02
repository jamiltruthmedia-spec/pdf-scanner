import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
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
    const query = searchParams.get('q');
    const jobNumber = searchParams.get('jobNumber');
    const formulaId = searchParams.get('formulaId');

    let dbQuery = supabaseAdmin
      .from('pdf_documents')
      .select('*')
      .order('uploaded_at', { ascending: false });

    if (jobNumber) {
      dbQuery = dbQuery.eq('job_number', jobNumber);
    }

    if (formulaId) {
      dbQuery = dbQuery.eq('formula_id', formulaId);
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
      extractedText: doc.extracted_text,
      uploadedAt: doc.uploaded_at,
      fileUrl: doc.file_url,
      pageCount: doc.page_count,
      metadata: doc.metadata,
    })) || [];

    return NextResponse.json({ documents });
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
    // For PDFs, we'd need to convert pages to images first (future enhancement)
    let extractedText = '';

    if (mimeType.startsWith('image/')) {
      const dataUrl = `data:${mimeType};base64,${base64}`;
      
      const result = await Tesseract.recognize(dataUrl, 'eng', {
        logger: (m) => console.log(m),
      });
      
      extractedText = result.data.text;
    } else if (mimeType === 'application/pdf') {
      // For PDF files, we'll store them but mark as needing image conversion
      extractedText = '[PDF - Please upload as images for OCR processing]';
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload images (JPG, PNG) or PDF.' },
        { status: 400 }
      );
    }

    // Extract metadata from OCR text
    const metadata = extractMetadata(extractedText);

    // Upload file to Supabase Storage
    const storagePath = `documents/${id}/${filename}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('pdf-scanner')
      .upload(storagePath, buffer, {
        contentType: mimeType,
      });

    let fileUrl: string | null = null;
    if (!uploadError) {
      const { data: urlData } = supabaseAdmin.storage
        .from('pdf-scanner')
        .getPublicUrl(storagePath);
      fileUrl = urlData.publicUrl;
    }

    // Save document record to database
    const { data: doc, error: dbError } = await supabaseAdmin
      .from('pdf_documents')
      .insert({
        id,
        filename,
        job_number: metadata.jobNumber,
        formula_id: metadata.formulaId,
        product_name: metadata.productName,
        extracted_text: extractedText,
        file_url: fileUrl,
        page_count: 1,
        metadata: {},
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
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
        fileUrl: doc.file_url,
        pageCount: doc.page_count,
        metadata: doc.metadata,
      },
    });
  } catch (error) {
    console.error('Error processing document:', error);
    return NextResponse.json(
      { error: 'Failed to process document' },
      { status: 500 }
    );
  }
}
