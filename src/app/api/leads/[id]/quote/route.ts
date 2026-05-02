import { NextResponse } from 'next/server';
import { readJsonBlob, writeJsonBlob } from '@/lib/blob-store';
import { Lead } from '@/lib/crm-data';

const LEADS_BLOB_NAME = 'leads.json';
const toQuoteSummary = (quoteData: any, quoteId: string) => ({
  quoteId,
  quoteNo: String(quoteData?.quoteNo || quoteId),
  date: String(quoteData?.quoteDate || new Date().toISOString()),
  grandTotal: Math.round(Number(quoteData?.grandTotal || 0)),
  subject: String(quoteData?.subject || ''),
  updatedAt: new Date().toISOString(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await context.params;
    const { searchParams } = new URL(request.url);
    const cloneFrom = searchParams.get('clone');
    const quoteData = await request.json();

    // Clone always creates a new quote version.
    if (cloneFrom) {
      quoteData.quoteId = null;
      if (quoteData.quoteNo) {
        quoteData.quoteNo = `${quoteData.quoteNo} (Copy)`;
      }
    }

    const quoteId = String(quoteData.quoteId || `${leadId}-${Date.now()}`);
    const quotePayload = {
      ...quoteData,
      quoteId,
      leadId,
      grandTotal: Math.round(Number(quoteData?.grandTotal || 0)),
    };

    // 1. Save detailed quote blob.
    await writeJsonBlob(`quote_${quoteId}.json`, quotePayload);

    // 2. Update lead quote index.
    const indexBlobName = `quotes_${leadId}.json`;
    const quoteIndex = await readJsonBlob<any[]>(indexBlobName, []);
    const summary = toQuoteSummary(quotePayload, quoteId);
    const existingIdx = quoteIndex.findIndex((entry) => entry.quoteId === quoteId);
    if (existingIdx >= 0) {
      quoteIndex[existingIdx] = summary;
    } else {
      quoteIndex.unshift(summary);
    }
    await writeJsonBlob(indexBlobName, quoteIndex);

    // 3. Keep legacy latest quote blob for backward compatibility.
    await writeJsonBlob(`quote_${leadId}.json`, quotePayload);

    // 4. Load Leads
    const leads = await readJsonBlob<Lead[]>(LEADS_BLOB_NAME, []);

    let found = false;

    // 5. Find and Update Lead
    const updatedLeads = leads.map((l) => {
      if (l.id === leadId) {
        found = true;
        return {
          ...l,
          status: 'Quote Sent',
          expectedValue: Math.round(Number(quoteData.grandTotal || l.expectedValue || 0)),
          lastQuoteDate: new Date().toISOString(),
          quoteUrl: `/quote/${quoteId}/view`,
        };
      }
      return l;
    });

    if (!found) {
      return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
    }

    // 6. Save Leads
    await writeJsonBlob(LEADS_BLOB_NAME, updatedLeads);

    return NextResponse.json({
      ok: true,
      quoteId,
      lead: updatedLeads.find((lead) => lead.id === leadId) ?? null,
    });
  } catch (error) {
    console.error('Quote Sync Error:', error);
    return NextResponse.json({ error: 'Failed to sync quote to CRM' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await context.params;
    const { searchParams } = new URL(request.url);
    const quoteId = searchParams.get('qid');

    if (!quoteId) {
      return NextResponse.json({ error: 'Quote ID is required' }, { status: 400 });
    }

    const indexBlobName = `quotes_${leadId}.json`;
    const quoteIndex = await readJsonBlob<any[]>(indexBlobName, []);
    const filtered = quoteIndex.filter((entry) => entry.quoteId !== quoteId);
    await writeJsonBlob(indexBlobName, filtered);

    const leads = await readJsonBlob<Lead[]>(LEADS_BLOB_NAME, []);
    const latest = filtered[0] || null;
    const updatedLeads = leads.map((l) => {
      if (l.id !== leadId) return l;
      return {
        ...l,
        quoteUrl: latest ? `/quote/${latest.quoteId}/view` : undefined,
      };
    });
    await writeJsonBlob(LEADS_BLOB_NAME, updatedLeads);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete quote' }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const listOnly = searchParams.get('list') === 'true';
    const qid = searchParams.get('qid');

    if (listOnly) {
      const indexBlobName = `quotes_${id}.json`;
      const quotes = await readJsonBlob<any[]>(indexBlobName, []);
      return NextResponse.json({
        quotes: [...quotes].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))),
      });
    }

    const quoteBlobName = qid ? `quote_${qid}.json` : `quote_${id}.json`;
    const quoteData = await readJsonBlob(quoteBlobName, null);

    if (!quoteData) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    return NextResponse.json(quoteData);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch quote' }, { status: 500 });
  }
}
