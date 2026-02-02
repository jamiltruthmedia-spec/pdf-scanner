export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Document {
  id: string;
  filename: string;
  jobNumber: string | null;
  formulaId: string | null;
  productName: string | null;
  extractedText: string;
  uploadedAt: string;
  processedAt: string | null;
  filePath: string | null;
  pageCount: number;
  processingStatus: ProcessingStatus;
  processingError: string | null;
  metadata: Record<string, unknown>;
}

export interface SearchResult {
  document: Document;
  snippet: string;
  matchScore: number;
}

export interface UploadResponse {
  success: boolean;
  queued?: boolean;
  message?: string;
  document?: Partial<Document>;
  error?: string;
}
