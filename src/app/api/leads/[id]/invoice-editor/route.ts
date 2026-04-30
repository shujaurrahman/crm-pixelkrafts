import { NextResponse } from 'next/server';
import { readJsonBlob } from '@/lib/blob-store';
import { Lead } from '@/lib/crm-data';
import {
  buildInvoiceNo,
  getLeadBalanceDue,
  normalizeInvoiceRecord,
  summarizeInvoiceLedger,
  type InvoiceLedger,
  type InvoiceRecord,
} from '@/lib/invoice-utils';

const LEADS_BLOB_NAME = 'leads.json';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Fetch lead + invoice ledger in parallel
    const [leads, ledgerRaw] = await Promise.all([
      readJsonBlob<Lead[]>(LEADS_BLOB_NAME, []),
      readJsonBlob<InvoiceLedger | InvoiceRecord | null>(`invoice_${id}.json`, null),
    ]);

    const lead = leads.find((l) => l.id === id) || null;

    // Normalize ledger into invoices array
    let ledgerInvoices: InvoiceRecord[] = [];
    let currentInvoice: InvoiceRecord | null = null;

    if (ledgerRaw) {
      if (Array.isArray((ledgerRaw as InvoiceLedger).invoices)) {
        const ledger = ledgerRaw as InvoiceLedger;
        ledgerInvoices = ledger.invoices.map((e) => normalizeInvoiceRecord(e));
        currentInvoice = ledger.currentInvoice
          ? normalizeInvoiceRecord(ledger.currentInvoice)
          : ledgerInvoices[ledgerInvoices.length - 1] || null;
      } else if ((ledgerRaw as InvoiceRecord).invoiceNo) {
        const single = normalizeInvoiceRecord(ledgerRaw);
        ledgerInvoices = [single];
        currentInvoice = single;
      }
    }

    const expectedValue = Number(lead?.expectedValue || 0);
    const summary = summarizeInvoiceLedger(
      { expectedValue },
      {
        leadId: id,
        invoices: ledgerInvoices,
        totalLeadValue: expectedValue,
        totalPaidValue: 0,
        balanceDue: 0,
        isFullyPaid: false,
        updatedAt: new Date().toISOString(),
        currentInvoice: currentInvoice || undefined,
      }
    );

    const leadBalance = lead ? getLeadBalanceDue(lead) : summary.balanceDue;
    const nextInvoiceNo = buildInvoiceNo(id, ledgerInvoices.length);
    const draftAmount = ledgerInvoices.length > 0
      ? summary.balanceDue
      : Number(lead?.advanceValue || leadBalance || lead?.expectedValue || 0);

    return NextResponse.json({
      lead,
      ledgerInvoices,
      currentInvoice,
      summary: {
        totalPaidValue: summary.totalPaidValue,
        balanceDue: summary.balanceDue,
        isFullyPaid: summary.isFullyPaid,
        invoiceCount: ledgerInvoices.length,
      },
      nextInvoiceNo,
      draftAmount,
    });
  } catch (error) {
    console.error('Invoice editor data fetch error:', error);
    return NextResponse.json({ error: 'Failed to load invoice data' }, { status: 500 });
  }
}
