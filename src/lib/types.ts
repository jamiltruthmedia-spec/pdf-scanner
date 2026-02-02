export interface Document {
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
}

export interface SearchResult {
  document: Document;
  snippet: string;
  matchScore: number;
}

export interface UploadResponse {
  success: boolean;
  document?: Document;
  error?: string;
}
