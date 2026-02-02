# PDF Scanner - Quick Setup

## 1. Deploy to Vercel (2 minutes)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click "Import" next to **pdf-scanner** repo
3. Click "Deploy" (no env vars needed for prototype!)
4. Wait ~1 min for build

**That's it!** You'll get a URL like `pdf-scanner-xxx.vercel.app`

## 2. Test It

1. Open your Vercel URL
2. Upload a batch sheet screenshot (JPG/PNG)
3. Wait for OCR to process (~5-10 seconds)
4. Search by Job # or any text

## Current Limitations (Prototype)

- ⚠️ **Documents reset on each deploy** (in-memory storage)
- Only JPG/PNG images work (not raw PDFs)
- No persistent storage yet

## Next Steps (After Testing)

Once you verify the UI/OCR works, I'll add:
- [ ] Supabase for persistent storage
- [ ] PDF-to-image conversion
- [ ] Mobile camera capture
- [ ] Bulk upload

---

**Quick test:** Upload the batch sheet screenshot you sent earlier!
