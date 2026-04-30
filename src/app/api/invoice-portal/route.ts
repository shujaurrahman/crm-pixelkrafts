import { NextResponse } from 'next/server';
import { readJsonBlob } from '@/lib/blob-store';
import { normalizeInvoiceRecord, summarizeInvoiceLedger, type InvoiceLedger, type InvoiceRecord } from '@/lib/invoice-utils';
import type { Lead } from '@/lib/crm-data';

const LEADS_BLOB_NAME = 'leads.json';

function slugify(value: string) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientSlug = searchParams.get('clientSlug') || '';
    const invoiceNoParam = searchParams.get('invoiceNo') || ''; // e.g. '01', '02', '0002'

    if (!clientSlug) {
      return NextResponse.json({ error: 'clientSlug is required' }, { status: 400 });
    }

    // 1. Load all leads and find the one matching the clientSlug
    const leads = await readJsonBlob<Lead[]>(LEADS_BLOB_NAME, []);

    let targetLead: Lead | null = null;
    let bestScore = -1;

    for (const lead of leads) {
      const slug = slugify(lead.clientName || '');
      if (slug === clientSlug) {
        // Prefer leads that have invoices saved
        const score = (lead.invoiceCount || 0) + (lead.invoiceNo ? 1 : 0) + (lead.status === 'Order Confirmed' ? 2 : 0);
        if (score > bestScore) {
          bestScore = score;
          targetLead = lead;
        }
      }
    }

    if (!targetLead) {
      return NextResponse.json({ error: 'Client not found', clientSlug }, { status: 404 });
    }

    // 2. Load the invoice ledger for this lead
    const ledgerRaw = await readJsonBlob<InvoiceLedger | InvoiceRecord | null>(`invoice_${targetLead.id}.json`, null);

    if (!ledgerRaw) {
      return NextResponse.json({ error: 'No invoice found for this client', leadId: targetLead.id }, { status: 404 });
    }

    // 3. Normalize into a ledger with invoices array
    let ledger: InvoiceLedger;
    if (Array.isArray((ledgerRaw as InvoiceLedger).invoices)) {
      ledger = ledgerRaw as InvoiceLedger;
    } else {
      // Legacy single-invoice format — wrap it
      const single = normalizeInvoiceRecord(ledgerRaw);
      ledger = {
        leadId: targetLead.id,
        invoices: [single],
        totalLeadValue: Number(targetLead.expectedValue || single.total || 0),
        totalPaidValue: 0,
        balanceDue: 0,
        isFullyPaid: false,
        updatedAt: single.lastSaved || new Date().toISOString(),
        currentInvoice: single,
      };
    }

    // 4. Pick the specific invoice by position
    // invoiceNoParam is '01', '02', or legacy like '0002'
    let selectedInvoice: InvoiceRecord | null = null;

    const numericTarget = parseInt(invoiceNoParam, 10);
    if (!isNaN(numericTarget) && numericTarget >= 1 && numericTarget <= ledger.invoices.length) {
      // Direct index match: '01' → index 0, '02' → index 1, '0002' → parseInt = 2 → index 1
      selectedInvoice = ledger.invoices[numericTarget - 1];
    }

    if (!selectedInvoice && invoiceNoParam) {
      // Fallback: match by stored invoiceNo field (normalized)
      const normalizedParam = slugify(invoiceNoParam);
      selectedInvoice = ledger.invoices.find((entry) => slugify(entry.invoiceNo || '') === normalizedParam) || null;
    }

    // Final fallback: return the latest invoice
    if (!selectedInvoice) {
      selectedInvoice = ledger.currentInvoice || ledger.invoices[ledger.invoices.length - 1] || null;
    }

    if (!selectedInvoice) {
      return NextResponse.json({ error: 'Invoice not found', invoiceNoParam, leadId: targetLead.id }, { status: 404 });
    }

    // 5. Calculate summary
    const totalLeadValue = Number(targetLead.expectedValue || ledger.totalLeadValue || 0);
    const summary = summarizeInvoiceLedger({ expectedValue: totalLeadValue }, ledger);

    const invoice = normalizeInvoiceRecord(selectedInvoice);

    return NextResponse.json({
      invoice,
      summary: {
        totalLeadValue,
        totalPaidValue: summary.totalPaidValue,
        balanceDue: summary.balanceDue,
        isFullyPaid: summary.isFullyPaid,
        invoiceCount: ledger.invoices.length,
      },
      leadId: targetLead.id,
      leadName: targetLead.clientName,
    });
  } catch (error) {
    console.error('Invoice portal API error:', error);
    return NextResponse.json({ error: 'Failed to load invoice' }, { status: 500 });
  }
}
