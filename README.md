# Enquires CRM (Next.js + TypeScript)

Lead CRM for Eubiq India, 61SAGA, and 61GLER.

## Implemented

- Full TypeScript app on Next.js App Router
- Runs on port 3000 (`next dev -p 3000`)
- Dashboard analytics with brand/status/product insights
- AI analytics chat on dashboard (`/api/chat`)
- Enquires table filters and lead status progression
- Export all or filtered leads to Excel
- New Enquires form with product dependency by brand/category
- AI-assisted form fill from plain mail/chat text (`/api/assist`)
- Voice-to-text input for AI-assisted lead fill
- Brand-wise product management
- Vercel Blob backend for leads/products (`/api/leads`, `/api/products`)

## Setup

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run start
```

## Env

Create `.env.local`:

```bash
GEMINI_API_KEY=your_key_here
HUGGINGFACE_API_KEY=your_huggingface_key
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
AZURE_STORAGE_CONNECTION_STRING=your_azure_storage_connection_string
AZURE_STORAGE_CONTAINER_NAME=enquires-crm
```

Without these variables:

- `GEMINI_API_KEY`: primary AI provider for AI chat and assist.
- `HUGGINGFACE_API_KEY`: fallback AI provider when Gemini daily/quota limits are hit.
- `BLOB_READ_WRITE_TOKEN`: enables Vercel Blob and first-load seed of default leads/products.
- `AZURE_STORAGE_CONNECTION_STRING`: optional fallback backend when Vercel Blob token is not set.

Storage priority:

1. Vercel Blob (when `BLOB_READ_WRITE_TOKEN` exists)
2. Azure Blob (when `AZURE_STORAGE_CONNECTION_STRING` exists)
3. Local JSON files under `data/`

If `AZURE_STORAGE_CONTAINER_NAME` is omitted, the app defaults to `enquires-crm`.

## Main Files

- `src/app/page.tsx`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/api/chat/route.ts`
- `src/app/api/assist/route.ts`
- `src/app/api/leads/route.ts`
- `src/app/api/products/route.ts`
- `src/lib/blob-store.ts`
- `src/lib/crm-data.ts`
