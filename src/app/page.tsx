'use client';

import { useState, useEffect, useCallback } from 'react';
import { Document } from '@/lib/types';

export default function Home() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [jobNumberFilter, setJobNumberFilter] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const fetchDocuments = useCallback(async () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (jobNumberFilter) params.set('jobNumber', jobNumberFilter);

    const res = await fetch(`/api/documents?${params.toString()}`);
    const data = await res.json();
    setDocuments(data.documents || []);
  }, [searchQuery, jobNumberFilter]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadStatus(null);

    let successCount = 0;
    let errorMessages: string[] = [];

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/documents', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        
        if (data.success) {
          console.log('Uploaded:', data.document);
          successCount++;
        } else if (data.error === 'PDF_NEEDS_CONVERSION') {
          errorMessages.push(`📄 ${file.name}: PDFs need to be screenshots. Use Win+Shift+S to capture each page as an image.`);
        } else {
          errorMessages.push(`❌ ${file.name}: ${data.error || data.message || 'Upload failed'}`);
        }
      } catch (error) {
        console.error('Upload error:', error);
        errorMessages.push(`❌ ${file.name}: Network error`);
      }
    }

    setIsUploading(false);
    
    if (errorMessages.length > 0) {
      setUploadStatus(errorMessages.join('\n'));
    } else if (successCount > 0) {
      setUploadStatus(`✅ ${successCount} file${successCount > 1 ? 's' : ''} uploaded and processed!`);
      setTimeout(() => setUploadStatus(null), 3000);
    }
    
    fetchDocuments();
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleUpload(e.dataTransfer.files);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📄</span>
              <h1 className="text-xl font-bold">PDF Scanner</h1>
            </div>
            <div className="text-sm text-gray-400">
              {documents.length} document{documents.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Search & Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search all text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="w-full sm:w-48">
            <input
              type="text"
              placeholder="Job # filter"
              value={jobNumberFilter}
              onChange={(e) => setJobNumberFilter(e.target.value)}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <button
            onClick={() => fetchDocuments()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            Search
          </button>
        </div>

        {/* Upload Zone */}
        <div
          className={`mb-4 border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-gray-700 hover:border-gray-600'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
              <p className="text-gray-400">Processing document with OCR...</p>
              <p className="text-xs text-gray-500">This may take 10-20 seconds</p>
            </div>
          ) : (
            <>
              <input
                type="file"
                id="fileInput"
                multiple
                accept="image/*"
                onChange={(e) => handleUpload(e.target.files)}
                className="hidden"
              />
              <label
                htmlFor="fileInput"
                className="cursor-pointer flex flex-col items-center gap-3"
              >
                <span className="text-4xl">📤</span>
                <p className="text-lg font-medium">
                  Drop images here or click to upload
                </p>
                <p className="text-sm text-gray-400">
                  Upload screenshots of batch sheets (JPG, PNG)
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  💡 Tip: Use <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-300">Win+Shift+S</kbd> to screenshot pages from scanned PDFs
                </p>
              </label>
            </>
          )}
        </div>

        {/* Upload Status Message */}
        {uploadStatus && (
          <div className={`mb-6 p-4 rounded-lg whitespace-pre-wrap text-sm ${
            uploadStatus.includes('✅') 
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'
          }`}>
            {uploadStatus}
          </div>
        )}

        {/* Documents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              onClick={() => setSelectedDoc(doc)}
              className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 cursor-pointer transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">📋</span>
                {doc.jobNumber && (
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                    Job #{doc.jobNumber}
                  </span>
                )}
              </div>
              <h3 className="font-medium mb-1 truncate">{doc.filename}</h3>
              {doc.productName && (
                <p className="text-sm text-gray-400 mb-2">{doc.productName}</p>
              )}
              <p className="text-xs text-gray-500 line-clamp-2">
                {doc.extractedText.substring(0, 150)}...
              </p>
              <div className="mt-3 pt-3 border-t border-gray-800 flex justify-between text-xs text-gray-500">
                <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                {doc.formulaId && <span>Formula: {doc.formulaId}</span>}
              </div>
            </div>
          ))}
        </div>

        {documents.length === 0 && !uploadStatus && (
          <div className="text-center py-12 text-gray-500">
            <span className="text-4xl block mb-4">📭</span>
            <p className="mb-2">No documents yet. Upload some batch sheets to get started!</p>
            <p className="text-sm">Screenshot your scanned PDFs with Win+Shift+S and upload the images.</p>
          </div>
        )}
      </main>

      {/* Document Detail Modal */}
      {selectedDoc && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedDoc(null)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg">{selectedDoc.filename}</h2>
                <div className="flex gap-3 mt-1 text-sm text-gray-400">
                  {selectedDoc.jobNumber && (
                    <span>Job #{selectedDoc.jobNumber}</span>
                  )}
                  {selectedDoc.formulaId && (
                    <span>Formula: {selectedDoc.formulaId}</span>
                  )}
                  {selectedDoc.productName && (
                    <span>{selectedDoc.productName}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <h3 className="text-sm font-medium text-gray-400 mb-2">
                Extracted Text
              </h3>
              <pre className="whitespace-pre-wrap text-sm bg-gray-950 p-4 rounded-lg border border-gray-800 font-mono">
                {selectedDoc.extractedText}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
