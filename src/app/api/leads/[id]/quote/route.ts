import { NextResponse } from 'next/server';
// Updated to use absolute-style aliases for Next.js compatibility
import { readJsonBlob, writeJsonBlob } from '@/lib/blob-store';
import { Lead } from '@/lib/crm-data';

const LEADS_BLOB_NAME = 'leads.json';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await context.params;
    const contentType = request.headers.get('content-type') || '';

    // The multipart/form-data branch for PDF uploads has been removed as per requirements.
    // Structured quote data JSON from quote builder page is now the exclusive way to save quotes.

    // Branch 2: structured quote data JSON from quote builder page
    const quoteData = await request.json();

    // 1. Load Leads
    const leads = await readJsonBlob<Lead[]>(LEADS_BLOB_NAME, []);

    let found = false;

    // 2. Find and Update Lead
    const updatedLeads = leads.map((l) => {
      if (l.id === leadId) {
        found = true;
        return {
          ...l,
          status: 'Quote Sent',
          expectedValue: Math.round(quoteData.grandTotal || l.expectedValue || 0),
          lastQuoteDate: new Date().toISOString(),
          ...(quoteData.quoteUrl ? { quoteUrl: String(quoteData.quoteUrl) } : {}),
        };
      }
      return l;
    });

    if (!found) {
      return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
    }

    // 3. Save Leads
    await writeJsonBlob(LEADS_BLOB_NAME, updatedLeads);

    // 4. Save Quote specific data separately when a structured quote was posted
    const QUOTE_BLOB_NAME = `quote_${leadId}.json`;
    const shouldSaveStructuredQuote =
      quoteData &&
      typeof quoteData === 'object' &&
      !('quoteUrl' in quoteData && Object.keys(quoteData).length === 1);

    if (shouldSaveStructuredQuote) {
      await writeJsonBlob(QUOTE_BLOB_NAME, quoteData);
    }

    return NextResponse.json({ ok: true, lead: updatedLeads.find((lead) => lead.id === leadId) ?? null });
  } catch (error) {
    console.error('Quote Sync Error:', error);
    return NextResponse.json({ error: 'Failed to sync quote to CRM' }, { status: 500 });
  }
}
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const QUOTE_BLOB_NAME = `quote_${id}.json`;
    const quoteData = await readJsonBlob(QUOTE_BLOB_NAME, null);
    
    if (!quoteData) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }
    
    return NextResponse.json(quoteData);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch quote' }, { status: 500 });
  }
}
