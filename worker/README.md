# PDF Scanner - Local Worker

This runs on your home computer and processes PDFs uploaded to the web app.

## Setup (One Time)

1. Install Node.js if you don't have it: https://nodejs.org/
2. Open terminal in this folder
3. Run: `npm install`

## Start the Worker

Double-click `start-worker.bat` or run:

```bash
npm start
```

**Keep this running** while at work. It checks for new PDFs every 30 seconds.

## How It Works

1. You upload a PDF at work → stored in cloud
2. This worker detects it → downloads → OCR → uploads text
3. You search/view at work → sees the extracted text

## Troubleshooting

- **"Cannot find module"** → Run `npm install` first
- **Worker crashes** → Check internet connection, restart it
- **PDF not processing** → Check Supabase dashboard for errors

## Requirements

- Node.js 18+
- Internet connection
- Computer stays on during work hours
