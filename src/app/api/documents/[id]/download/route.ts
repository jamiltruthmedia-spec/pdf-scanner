import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get document from database
    const { data: doc, error: dbError } = await getSupabase()
      .from('pdf_documents')
      .select('file_path, filename')
      .eq('id', id)
      .single();

    if (dbError || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (!doc.file_path) {
      return NextResponse.json({ error: 'No file stored for this document' }, { status: 404 });
    }

    // Create signed URL for download (valid for 1 hour)
    const { data: signedUrl, error: urlError } = await getSupabase().storage
      .from('pdf-uploads')
      .createSignedUrl(doc.file_path, 3600);

    if (urlError || !signedUrl) {
      return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 });
    }

    return NextResponse.json({ 
      url: signedUrl.signedUrl,
      filename: doc.filename 
    });
  } catch (error) {
    console.error('Error getting download URL:', error);
    return NextResponse.json({ error: 'Failed to get download URL' }, { status: 500 });
  }
}
