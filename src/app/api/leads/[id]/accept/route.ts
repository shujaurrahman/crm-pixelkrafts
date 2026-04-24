import { NextResponse } from 'next/server';
import { readJsonBlob, writeJsonBlob } from '@/lib/blob-store';
import { Lead, LEADS_SEED } from '@/lib/crm-data';

const LEADS_BLOB_NAME = 'leads.json';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { signature } = await request.json();
    const { id: leadId } = await context.params;

    // 1. Load Leads
    const leads = await readJsonBlob<Lead[]>(LEADS_BLOB_NAME, LEADS_SEED);

    // 2. Find and Update Lead Status
    const updatedLeads = leads.map((l) => {
      if (l.id === leadId) {
        return {
          ...l,
          status: 'Order Confirmed' as const,
          acceptanceSignature: signature,
          acceptedAt: new Date().toISOString()
        };
      }
      return l;
    });

    // 3. Save Leads
    await writeJsonBlob(LEADS_BLOB_NAME, updatedLeads);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Quote Acceptance Error:', error);
    return NextResponse.json({ error: 'Failed to accept quote' }, { status: 500 });
  }
}
