-- PDF Documents table with processing status
CREATE TABLE IF NOT EXISTS pdf_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  job_number TEXT,
  formula_id TEXT,
  product_name TEXT,
  extracted_text TEXT,
  file_path TEXT,  -- Path in Supabase storage
  page_count INTEGER DEFAULT 0,
  processing_status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  processing_error TEXT,
  metadata JSONB DEFAULT '{}',
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  
  CONSTRAINT valid_status CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Indexes for searching
CREATE INDEX IF NOT EXISTS idx_pdf_documents_job_number ON pdf_documents(job_number);
CREATE INDEX IF NOT EXISTS idx_pdf_documents_formula_id ON pdf_documents(formula_id);
CREATE INDEX IF NOT EXISTS idx_pdf_documents_status ON pdf_documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_pdf_documents_uploaded_at ON pdf_documents(uploaded_at DESC);

-- Full-text search on extracted text
CREATE INDEX IF NOT EXISTS idx_pdf_documents_text_search 
ON pdf_documents USING gin(to_tsvector('english', COALESCE(extracted_text, '')));

-- Storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdf-uploads', 'pdf-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies
ALTER TABLE pdf_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on pdf_documents"
ON pdf_documents FOR ALL USING (true) WITH CHECK (true);

-- Storage policies (allow uploads and downloads)
CREATE POLICY "Allow uploads to pdf-uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'pdf-uploads');

CREATE POLICY "Allow downloads from pdf-uploads"
ON storage.objects FOR SELECT
USING (bucket_id = 'pdf-uploads');

CREATE POLICY "Allow deletes from pdf-uploads"
ON storage.objects FOR DELETE
USING (bucket_id = 'pdf-uploads');
