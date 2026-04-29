import { NextResponse } from 'next/server';
import { readJsonBlob, writeJsonBlob } from '@/lib/blob-store';
import { Lead } from '@/lib/crm-data';
import {
  buildInvoiceNo,
  normalizeInvoiceRecord,
  summarizeInvoiceLedger,
  type InvoiceLedger,
  type InvoiceRecord,
} from '@/lib/invoice-utils';

const LEADS_BLOB_NAME = 'leads.json';

const normalizeToken = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await context.params;
    const invoiceData = await request.json();

    // 1. Load Leads
    const leads = await readJsonBlob<Lead[]>(LEADS_BLOB_NAME, []);
    const currentLead = leads.find((lead) => lead.id === leadId);

    let found = false;

    const existingLedger = await readJsonBlob<InvoiceLedger | InvoiceRecord | null>(`invoice_${leadId}.json`, null);
    const invoiceList = Array.isArray((existingLedger as InvoiceLedger | null)?.invoices)
      ? [...((existingLedger as InvoiceLedger).invoices || [])]
      : existingLedger
        ? [normalizeInvoiceRecord(existingLedger)]
        : [];

    const normalizedInvoice = normalizeInvoiceRecord({
      ...invoiceData,
      invoiceNo: invoiceData.invoiceNo || buildInvoiceNo(leadId, invoiceList.length),
      amountPaid: Number.isFinite(Number(invoiceData.amountPaid))
        ? Number(invoiceData.amountPaid)
        : Number.isFinite(Number(invoiceData.subtotal))
          ? Number(invoiceData.subtotal)
          : Number(invoiceData.total || 0),
    });

    const invoiceIndex = invoiceList.findIndex((entry) => entry.invoiceNo === normalizedInvoice.invoiceNo);
    if (invoiceIndex >= 0) {
      invoiceList[invoiceIndex] = normalizedInvoice;
    } else {
      invoiceList.push(normalizedInvoice);
    }

    const ledgerDraft: InvoiceLedger = {
      leadId,
      invoices: invoiceList,
      totalLeadValue: Number(currentLead?.expectedValue || normalizedInvoice.subtotal || 0),
      totalPaidValue: 0,
      balanceDue: 0,
      isFullyPaid: false,
      updatedAt: new Date().toISOString(),
      lastInvoiceNo: normalizedInvoice.invoiceNo,
      currentInvoice: normalizedInvoice,
    };

    const summary = summarizeInvoiceLedger({ expectedValue: ledgerDraft.totalLeadValue }, ledgerDraft);
    ledgerDraft.totalPaidValue = summary.totalPaidValue;
    ledgerDraft.balanceDue = summary.balanceDue;
    ledgerDraft.isFullyPaid = summary.isFullyPaid;

    // 2. Find and Update Lead (Optional: mark that invoice was generated)
    const updatedLeads = leads.map((l) => {
      if (l.id === leadId) {
        found = true;
        return {
          ...l,
          lastInvoiceDate: normalizedInvoice.lastSaved || new Date().toISOString(),
          invoiceNo: normalizedInvoice.invoiceNo,
          invoiceCount: invoiceList.length,
          invoicePaidValue: summary.totalPaidValue,
          invoiceBalanceDue: summary.balanceDue,
          invoiceStatus: summary.isFullyPaid ? 'paid' : summary.totalPaidValue > 0 ? 'partial' : 'unpaid',
          isPaid: summary.isFullyPaid,
          paidAt: summary.isFullyPaid ? normalizedInvoice.paidAt || l.paidAt || '' : l.paidAt,
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
      ...ledgerDraft,
      lastSaved: ledgerDraft.updatedAt,
      currentInvoice: normalizedInvoice,
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
    const invoiceData = await readJsonBlob<InvoiceLedger | InvoiceRecord | null>(INVOICE_BLOB_NAME, null);
    
    if (!invoiceData) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (Array.isArray((invoiceData as InvoiceLedger).invoices)) {
      const ledger = invoiceData as InvoiceLedger;
      const currentInvoice = ledger.currentInvoice || ledger.invoices[ledger.invoices.length - 1] || null;
      return NextResponse.json({
        ...ledger,
        ...(currentInvoice || {}),
        currentInvoice,
      });
    }
    
    return NextResponse.json(invoiceData);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await context.params;
    const url = new URL(request.url);
    const invoiceNoParam = url.searchParams.get('invoiceNo') || '';

    if (!invoiceNoParam) {
      return NextResponse.json({ error: 'invoiceNo is required' }, { status: 400 });
    }

    const leads = await readJsonBlob<Lead[]>(LEADS_BLOB_NAME, []);
    const currentLead = leads.find((lead) => lead.id === leadId);
    const existingLedger = await readJsonBlob<InvoiceLedger | InvoiceRecord | null>(`invoice_${leadId}.json`, null);

    const invoiceList = Array.isArray((existingLedger as InvoiceLedger | null)?.invoices)
      ? [...((existingLedger as InvoiceLedger).invoices || [])]
      : existingLedger
        ? [normalizeInvoiceRecord(existingLedger)]
        : [];

    const normalizedInvoiceNo = normalizeToken(invoiceNoParam);
    const filteredInvoices = invoiceList.filter((entry) => normalizeToken(entry.invoiceNo) !== normalizedInvoiceNo);

    if (filteredInvoices.length === invoiceList.length) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const ledgerDraft: InvoiceLedger = {
      leadId,
      invoices: filteredInvoices,
      totalLeadValue: Number(currentLead?.expectedValue || 0),
      totalPaidValue: 0,
      balanceDue: 0,
      isFullyPaid: false,
      updatedAt: new Date().toISOString(),
      lastInvoiceNo: filteredInvoices[filteredInvoices.length - 1]?.invoiceNo,
      currentInvoice: filteredInvoices[filteredInvoices.length - 1] || undefined,
    };

    const summary = summarizeInvoiceLedger({ expectedValue: ledgerDraft.totalLeadValue }, ledgerDraft);
    ledgerDraft.totalPaidValue = summary.totalPaidValue;
    ledgerDraft.balanceDue = summary.balanceDue;
    ledgerDraft.isFullyPaid = summary.isFullyPaid;

    const updatedLeads = leads.map((lead) => {
      if (lead.id !== leadId) return lead;
      return {
        ...lead,
        lastInvoiceDate: ledgerDraft.currentInvoice?.lastSaved || '',
        invoiceNo: ledgerDraft.currentInvoice?.invoiceNo,
        invoiceCount: filteredInvoices.length,
        invoicePaidValue: summary.totalPaidValue,
        invoiceBalanceDue: summary.balanceDue,
        invoiceStatus: summary.isFullyPaid ? 'paid' : summary.totalPaidValue > 0 ? 'partial' : 'unpaid',
        isPaid: summary.isFullyPaid,
        paidAt: summary.isFullyPaid ? ledgerDraft.currentInvoice?.paidAt || lead.paidAt || '' : lead.paidAt,
      };
    });

    await writeJsonBlob(LEADS_BLOB_NAME, updatedLeads);
    await writeJsonBlob(`invoice_${leadId}.json`, {
      ...ledgerDraft,
      lastSaved: ledgerDraft.updatedAt,
      currentInvoice: ledgerDraft.currentInvoice || null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Invoice delete error:', error);
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 });
  }
}
