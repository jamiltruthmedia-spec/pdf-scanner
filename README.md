# PDF Scanner

Upload, OCR, and search your production batch sheets by Job #, Formula ID, or any text.

## Features

- 📤 Drag & drop file upload
- 🔍 OCR processing with Tesseract.js
- 🔎 Search by Job #, Formula ID, or full text
- 📱 Mobile-friendly dark theme
- ⚡ Fast search with indexed database

## Setup

### 1. Supabase

Create a new Supabase project or use an existing one.

Run the migration in `supabase/migrations/001_create_pdf_documents.sql` in the Supabase SQL editor.

### 2. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Install & Run

```bash
npm install
npm run dev
```

## Deployment

Deploy to Vercel:

```bash
vercel
```

Add environment variables in Vercel dashboard.

## Usage

1. **Upload**: Drag and drop image files (JPG, PNG) of batch sheets
2. **Wait**: OCR processing extracts text (takes a few seconds)
3. **Search**: Use the search box or Job # filter to find documents

## Tech Stack

- Next.js 14 (App Router)
- Tailwind CSS
- Supabase (Postgres + Storage)
- Tesseract.js (OCR)

## Future Improvements

- [ ] PDF direct upload with page-to-image conversion
- [ ] Bulk upload with progress
- [ ] Date range filtering
- [ ] Export to CSV/Excel
- [ ] Mobile camera capture
