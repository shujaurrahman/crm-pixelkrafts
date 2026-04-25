import { NextResponse } from 'next/server';
import { readJsonBlob, writeJsonBlob } from '@/lib/blob-store';
import { Lead } from '@/lib/crm-data';

const LEADS_BLOB_NAME = 'leads.json';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await context.params;
    const invoiceData = await request.json();

    // 1. Load Leads
    const leads = await readJsonBlob<Lead[]>(LEADS_BLOB_NAME, []);

    let found = false;

    // 2. Find and Update Lead (Optional: mark that invoice was generated)
    const updatedLeads = leads.map((l) => {
      if (l.id === leadId) {
        found = true;
        return {
          ...l,
          lastInvoiceDate: new Date().toISOString(),
          invoiceNo: invoiceData.invoiceNo || l.id.replace('ENQ-', 'INV-'),
        };
      }
      return l;
    });

    if (!found) {
      return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
    }

    // 3. Save Leads
    await writeJsonBlob(LEADS_BLOB_NAME, updatedLeads);

    // 4. Save Invoice specific data
    const INVOICE_BLOB_NAME = `invoice_${leadId}.json`;
    await writeJsonBlob(INVOICE_BLOB_NAME, {
      ...invoiceData,
      lastSaved: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Invoice Sync Error:', error);
    return NextResponse.json({ error: 'Failed to sync invoice' }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const INVOICE_BLOB_NAME = `invoice_${id}.json`;
    const invoiceData = await readJsonBlob(INVOICE_BLOB_NAME, null);
    
    if (!invoiceData) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    
    return NextResponse.json(invoiceData);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 });
  }
}
