-- Create the pdf_documents table
CREATE TABLE IF NOT EXISTS pdf_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  job_number TEXT,
  formula_id TEXT,
  product_name TEXT,
  extracted_text TEXT NOT NULL,
  file_url TEXT,
  page_count INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes for fast searching
  CONSTRAINT pdf_documents_filename_check CHECK (char_length(filename) > 0)
);

-- Create indexes for common searches
CREATE INDEX IF NOT EXISTS idx_pdf_documents_job_number ON pdf_documents(job_number);
CREATE INDEX IF NOT EXISTS idx_pdf_documents_formula_id ON pdf_documents(formula_id);
CREATE INDEX IF NOT EXISTS idx_pdf_documents_uploaded_at ON pdf_documents(uploaded_at DESC);

-- Full-text search index on extracted_text
CREATE INDEX IF NOT EXISTS idx_pdf_documents_text_search 
ON pdf_documents USING gin(to_tsvector('english', extracted_text));

-- Create storage bucket for PDF files
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdf-scanner', 'pdf-scanner', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS but allow all operations for authenticated users
ALTER TABLE pdf_documents ENABLE ROW LEVEL SECURITY;

-- Policy to allow all operations (adjust as needed for production)
CREATE POLICY "Allow all operations on pdf_documents"
ON pdf_documents
FOR ALL
USING (true)
WITH CHECK (true);
