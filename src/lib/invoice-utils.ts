import type { Lead } from './crm-data';

export interface InvoiceLineItem {
  id: number;
  desc: string;
  qty: number;
  rate: number;
  total: number;
}

export interface InvoiceRecord {
  invoiceNo: string;
  date: string;
  clientName: string;
  address: string;
  subject?: string;
  items: InvoiceLineItem[];
  subtotal: number;
  discount: number;
  tax: number;
  bankDetails?: string;
  total: number;
  companyName?: string;
  companyAddress?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyWebsite?: string;
  companyInstagram?: string;
  msmeNumber?: string;
  isPaid?: boolean;
  paidAt?: string;
  lastSaved?: string;
  amountPaid?: number;
}

export interface InvoiceLedger {
  leadId: string;
  invoices: InvoiceRecord[];
  totalLeadValue: number;
  totalPaidValue: number;
  balanceDue: number;
  isFullyPaid: boolean;
  updatedAt: string;
  lastInvoiceNo?: string;
  currentInvoice?: InvoiceRecord;
}

export interface LeadInvoiceSummary {
  totalLeadValue: number;
  totalPaidValue: number;
  balanceDue: number;
  invoiceCount: number;
  paidInvoiceCount: number;
  isFullyPaid: boolean;
  latestInvoice?: InvoiceRecord | null;
}

export function getInvoicePaymentAmount(invoice: Partial<InvoiceRecord>): number {
  const amount = Number(invoice.amountPaid ?? invoice.subtotal ?? invoice.total ?? 0);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

export function buildInvoiceNo(leadId: string, invoiceCount: number): string {
  return String(invoiceCount + 1).padStart(2, '0');
}

export function normalizeInvoiceRecord(raw: any): InvoiceRecord {
  const items = Array.isArray(raw?.items)
    ? raw.items.map((item: any, index: number) => ({
        id: Number.isFinite(Number(item?.id)) ? Number(item.id) : index + 1,
        desc: String(item?.desc || ''),
        qty: Number.isFinite(Number(item?.qty)) ? Number(item.qty) : 0,
        rate: Number.isFinite(Number(item?.rate)) ? Number(item.rate) : 0,
        total: Number.isFinite(Number(item?.total)) ? Number(item.total) : 0,
      }))
    : [];

  return {
    invoiceNo: String(raw?.invoiceNo || ''),
    date: String(raw?.date || ''),
    clientName: String(raw?.clientName || ''),
    address: String(raw?.address || ''),
    subject: raw?.subject ? String(raw.subject) : undefined,
    items,
    subtotal: Number.isFinite(Number(raw?.subtotal)) ? Number(raw.subtotal) : 0,
    discount: Number.isFinite(Number(raw?.discount)) ? Number(raw.discount) : 0,
    tax: Number.isFinite(Number(raw?.tax)) ? Number(raw.tax) : 0,
    bankDetails: raw?.bankDetails ? String(raw.bankDetails) : undefined,
    total: Number.isFinite(Number(raw?.total)) ? Number(raw.total) : 0,
    companyName: raw?.companyName ? String(raw.companyName) : undefined,
    companyAddress: raw?.companyAddress ? String(raw.companyAddress) : undefined,
    companyEmail: raw?.companyEmail ? String(raw.companyEmail) : undefined,
    companyPhone: raw?.companyPhone ? String(raw.companyPhone) : undefined,
    companyWebsite: raw?.companyWebsite ? String(raw.companyWebsite) : undefined,
    companyInstagram: raw?.companyInstagram ? String(raw.companyInstagram) : undefined,
    msmeNumber: raw?.msmeNumber ? String(raw.msmeNumber) : undefined,
    isPaid: Boolean(raw?.isPaid),
    paidAt: raw?.paidAt ? String(raw.paidAt) : undefined,
    lastSaved: raw?.lastSaved ? String(raw.lastSaved) : undefined,
    amountPaid: Number.isFinite(Number(raw?.amountPaid)) ? Number(raw.amountPaid) : undefined,
  };
}

export function summarizeInvoiceLedger(lead: Pick<Lead, 'expectedValue'>, ledger?: InvoiceLedger | null): LeadInvoiceSummary {
  const invoices = Array.isArray(ledger?.invoices) ? ledger.invoices : [];
  const paidInvoices = invoices.filter((invoice) => invoice.isPaid);
  const totalPaidValue = paidInvoices.reduce((sum, invoice) => sum + getInvoicePaymentAmount(invoice), 0);
  const totalLeadValue = Number(lead.expectedValue || 0);
  const balanceDue = Math.max(totalLeadValue - totalPaidValue, 0);

  return {
    totalLeadValue,
    totalPaidValue,
    balanceDue,
    invoiceCount: invoices.length,
    paidInvoiceCount: paidInvoices.length,
    isFullyPaid: totalLeadValue > 0 && balanceDue <= 0,
    latestInvoice: invoices.length ? invoices[invoices.length - 1] : null,
  };
}

export function getLeadBalanceDue(lead: Pick<Lead, 'expectedValue' | 'advanceValue' | 'invoiceBalanceDue' | 'isPaid'>): number {
  if (Number.isFinite(Number(lead.invoiceBalanceDue))) {
    return Math.max(0, Number(lead.invoiceBalanceDue));
  }

  if (lead.isPaid) {
    return 0;
  }

  const expectedValue = Number(lead.expectedValue || 0);
  const advanceValue = Number(lead.advanceValue || 0);
  return Math.max(0, expectedValue - advanceValue);
}
