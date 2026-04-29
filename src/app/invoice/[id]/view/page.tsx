'use client';

import { useEffect, useState, use } from 'react';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import { toast, Toaster } from 'sonner';
import { numberToWords } from '@/lib/number-to-words';
import { getLeadBalanceDue, normalizeInvoiceRecord, summarizeInvoiceLedger, type InvoiceLedger } from '@/lib/invoice-utils';

export default function InvoicePortal({ params: rawParams }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(rawParams);
  const fallbackParams = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawId = resolvedParams?.id || (fallbackParams?.id as string) || '';
  const pathnameSegments = pathname?.split('/').filter(Boolean) || [];
  const visibleInvoiceToken = pathnameSegments[0] === 'invoice' && pathnameSegments[pathnameSegments.length - 1] === 'view'
    ? (pathnameSegments[2] || '')
    : '';
  const requestedInvoiceToken = visibleInvoiceToken || searchParams?.get('invoiceToken') || searchParams?.get('invoiceNo') || '';
  const requestedInvoiceDate = searchParams?.get('invoiceDate') || '';
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Defaults
  const defaultCompanyName = 'Pixelkraft Software Solutions';
  const defaultCompanyAddress = '805 Wasil Pilibhit 262001 UP India';
  const defaultCompanyEmail = 'official@pixelkrafts.in';
  const defaultCompanyPhone = '+917579966178';
  const defaultCompanyWebsite = 'www.pixelkrafts.in';
  const defaultCompanyInstagram = '@pixelkrafts_in';
  const defaultMsmeNumber = 'UDYAM-UP-60-0038284';

  const normalizeToken = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  useEffect(() => {
    const fetchData = async () => {
      try {
        let targetId = '';
        let targetInvoiceToken = normalizeToken(requestedInvoiceToken);

        // Case 1: Standard ID (ENQ- or INV-)
        if (rawId.startsWith('ENQ-') || rawId.startsWith('INV-')) {
          const baseId = rawId.split('-').slice(0, 2).join('-');
          targetId = baseId.startsWith('INV-') ? baseId.replace('INV-', 'ENQ-') : baseId;
          if (!targetInvoiceToken && rawId.startsWith('INV-')) {
            targetInvoiceToken = normalizeToken(rawId);
          }
        } 
        // Case 2: Client Name Slug (e.g., shuja-rahman)
        else {
          const leadsRes = await fetch('/api/leads', { cache: 'no-store' });
          const leadsData = await leadsRes.json();
          const leads = leadsData.leads || [];
          
          const found = leads.find((l: any) => {
            const slug = l.clientName?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            return slug === rawId;
          });
          
          if (found) {
            targetId = found.id;
          }
        }

        if (!targetId) {
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/leads/${targetId}/invoice?t=${Date.now()}`, { cache: 'no-store' });
        const data = await res.json();

        if (!data.error) {
          if (Array.isArray(data.invoices)) {
            const ledger = data as InvoiceLedger;
            const summary = summarizeInvoiceLedger({ expectedValue: Number(data.totalLeadValue || 0) }, ledger);
            const selectedByNo = targetInvoiceToken
              ? ledger.invoices.find((entry) => normalizeToken(entry.invoiceNo) === targetInvoiceToken)
              : null;
            const selectedByDate = !selectedByNo && requestedInvoiceDate
              ? ledger.invoices.find((entry) => entry.date?.toLowerCase().replace(/[^a-z0-9]+/g, '-') === requestedInvoiceDate)
              : null;
            const requestedExactInvoice = Boolean(targetInvoiceToken || requestedInvoiceDate);
            const selectedInvoice = selectedByNo || selectedByDate || (!requestedExactInvoice ? (ledger.currentInvoice || ledger.invoices[ledger.invoices.length - 1] || null) : null);

            if (!selectedInvoice) {
              setInvoice(null);
              return;
            }

            setInvoice({ ...normalizeInvoiceRecord(selectedInvoice), ...ledger, ...selectedInvoice, ...summary });
          } else {
            setInvoice(data);
          }
        } else {
          // Fallback to lead data if invoice not found
          const leadsRes = await fetch('/api/leads', { cache: 'no-store' });
          const leadsData = await leadsRes.json();
          const lead = leadsData.leads?.find((l: any) => l.id === targetId);
          
          if (lead) {
            setInvoice({
              invoiceNo: lead.id.replace('ENQ-', 'INV-'),
              date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
              clientName: lead.clientName,
              address: [lead.city, lead.state, lead.country].filter(Boolean).join(', '),
              items: lead.enquiryItems?.map((item: any, i: number) => ({
                id: i + 1,
                desc: item.productName,
                qty: lead.quantity || 1,
                rate: Math.round(lead.expectedValue / (lead.quantity || 1)),
                total: lead.expectedValue
              })) || [],
              subtotal: lead.expectedValue,
              discount: 0,
              tax: 18,
              total: Math.round(lead.expectedValue * 1.18),
              isPaid: lead.isPaid,
              paidAt: lead.paidAt,
              amountPaid: lead.invoicePaidValue ?? lead.expectedValue,
              lastSaved: new Date().toISOString()
            });
          }
        }
      } catch (e) {
        console.error('Failed to load invoice', e);
        toast.error('Failed to load invoice.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [rawId, requestedInvoiceToken, requestedInvoiceDate]);

  if (loading) return (
    <div className="invoice-container">
      <div className="invoice-box a4-page skeleton-page">
        <div className="skeleton-header">
          <div className="skeleton-branding">
            <div className="sk-line title"></div>
            <div className="sk-line sub"></div>
            <div className="sk-line sub"></div>
          </div>
          <div className="skeleton-meta">
            <div className="sk-line title"></div>
            <div className="sk-line item"></div>
            <div className="sk-line item"></div>
          </div>
        </div>
        <div className="skeleton-billing">
          <div className="sk-line label"></div>
          <div className="sk-line name"></div>
          <div className="sk-line addr"></div>
          <div className="sk-line addr"></div>
        </div>
        <div className="skeleton-table">
          <div className="sk-row header"></div>
          <div className="sk-row"></div>
          <div className="sk-row"></div>
          <div className="sk-row"></div>
        </div>
        <div className="skeleton-footer">
          <div className="sk-footer-col">
            <div className="sk-line label"></div>
            <div className="sk-line block"></div>
          </div>
          <div className="sk-footer-col right">
            <div className="sk-line total"></div>
          </div>
        </div>
      </div>
    </div>
  );
  if (!invoice) return (
    <div className="invoice-container theme-adaptive">
      <div className="invoice-box a4-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', textAlign: 'center', boxShadow: 'none', background: 'transparent' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px', color: '#1a1a1e' }}>No Invoice Found</h2>
          <p style={{ color: '#8e8e93', fontSize: '15px' }}>You do not have any invoice raised.</p>
        </div>
      </div>
    </div>
  );

  const subtotal = invoice.subtotal || 0;
  const discountAmount = (subtotal * (invoice.discount || 0)) / 100;
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = (taxableAmount * (invoice.tax || 0)) / 100;
  const grandTotal = taxableAmount + taxAmount;
  const paidAmount = Number(invoice.amountPaid ?? subtotal ?? 0);

  // Use dynamic company details if available
  const companyName = invoice.companyName || defaultCompanyName;
  const companyAddress = invoice.companyAddress || defaultCompanyAddress;
  const companyEmail = invoice.companyEmail || defaultCompanyEmail;
  const companyPhone = invoice.companyPhone || defaultCompanyPhone;
  const companyWebsite = invoice.companyWebsite || defaultCompanyWebsite;
  const companyInstagram = invoice.companyInstagram || defaultCompanyInstagram;
  const msmeNumber = invoice.msmeNumber || defaultMsmeNumber;

  return (
    <div className="invoice-container theme-adaptive">
      <Toaster position="top-center" richColors />
      
      <div className="action-bar no-print">
        <button onClick={() => window.print()} className="btn-print">
          Download PDF / Print
        </button>
      </div>

      <div className="invoice-box a4-page" style={{ position: 'relative', overflow: 'hidden' }}>
        {invoice.isPaid && (
          <div className="vertex-ribbon-container">
            <div className="vertex-ribbon paid">PAID</div>
          </div>
        )}
        <header className="invoice-header">
          <div className="branding">
            <h1 className="company-name">{companyName}</h1>
            <div className="msme-section">
              <span className="msme-id">{msmeNumber}</span>
              <p className="msme-label">MSME Certified</p>
            </div>
            <div className="company-details">
              <p>{companyAddress}</p>
              <div className="contact-row">
                <span>{companyEmail}</span>
                <span className="separator">|</span>
                <span>{companyPhone}</span>
              </div>
              <div className="contact-row">
                <a href={`https://${companyWebsite}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>{companyWebsite}</a>
                <span className="separator">|</span>
                <a href={`https://instagram.com/${companyInstagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>{companyInstagram}</a>
              </div>
            </div>
          </div>
          <div className="invoice-meta" style={{ textAlign: 'left' }}>
            <h2 className="doc-title" style={{ textAlign: 'left' }}>Invoice</h2>
            <div className="meta-grid">
              <div className="meta-item">
                <span className="label">Invoice No:</span>
                <span className="val">{invoice.invoiceNo}</span>
              </div>
              <div className="meta-item">
                <span className="label">Date:</span>
                <span className="val">{invoice.date}</span>
              </div>
              {invoice.isPaid && (
                <div className="meta-item">
                  <span className="label">Paid On:</span>
                  <span className="val" style={{ color: '#34c759' }}>{invoice.paidAt}</span>
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="billing-section">
          <div className="bill-to">
            <h3 className="section-title">Bill To:</h3>
            <p className="client-name">{invoice.clientName}</p>
            <p className="client-address">{invoice.address}</p>
          </div>
        </section>

        {invoice.subject && (
          <div className="subject-area">
            <span>{invoice.subject}</span>
          </div>
        )}

        <div className="table-responsive">
          <table className="invoice-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>SR</th>
                <th>Description</th>
                <th className="right" style={{ width: '60px' }}>Qty</th>
                <th className="right" style={{ width: '120px' }}>Rate</th>
                <th className="right" style={{ width: '120px' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items?.map((item: any, i: number) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td style={{ whiteSpace: 'pre-wrap' }}>{item.desc}</td>
                  <td className="right">{item.qty}</td>
                  <td className="right">₹{item.rate.toLocaleString('en-IN')}</td>
                  <td className="right">₹{item.total.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!invoice.isPaid && (
          <div className="payment-instruction">
            <p>Please process the payment to the bank account or scan the QR code below.</p>
          </div>
        )}

        <footer className="invoice-footer">
          <div className="notes-col">
            <div className="amount-words">
              <span className="label">Amount in Words:</span>
              <p className="val">{numberToWords(Math.round(grandTotal))}</p>
            </div>
            <div className="bank-details">
              <h4 className="label">
                {invoice.isPaid ? 'Payment Processed to:' : 'Bank Details:'}
              </h4>
              {invoice.isPaid && (
                <p style={{ fontSize: '11px', color: '#34c759', fontWeight: 600, marginBottom: '8px', fontStyle: 'italic' }}>
                  ✓ Payment was successfully processed on {invoice.paidAt} to the account below
                </p>
              )}
              <div className="bank-content">
                {invoice.bankDetails || 'A/C: 50100656771132\nIFSC: HDFC0000651\nBranch: NOIDA SEC 26\nAccount Type: SAVINGS'}
              </div>
              {!invoice.isPaid && (
                <div className="upi-section">
                  <div className="upi-meta">
                    <h4 className="label">Scan to Pay via UPI:</h4>
                    <p className="upi-id">7579966178@hdfc</p>
                  </div>
                  <div className="upi-scanner-wrap">
                    <img src="/upi-qr.jpg" alt="UPI Scanner" className="upi-img" />
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="totals-col">
            {/* Show previous invoices paid if applicable */}
            {Array.isArray(invoice.invoices) && invoice.invoices.length > 1 && (
              <div className="total-row" style={{ color: '#8e8e93', fontSize: '13px' }}>
                <span className="label">Previously Paid:</span>
                <span className="val" style={{ color: '#34c759' }}>₹{invoice.invoices.slice(0, -1).reduce((sum: number, inv: any) => sum + Number(inv.amountPaid || (inv.isPaid ? inv.subtotal : 0)), 0).toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="total-row">
              <span className="label">Sub Total:</span>
              <span className="val">₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="total-row">
                <span className="label">Discount ({invoice.discount}%):</span>
                <span className="val">- ₹{Math.round(discountAmount).toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="total-row">
              <span className="label">GST ({invoice.tax}%):</span>
              <span className="val">₹{Math.round(taxAmount).toLocaleString('en-IN')}</span>
            </div>
            <div className="total-row grand-total">
              <span className="label">Grand Total:</span>
              <span className="val">₹{Math.round(grandTotal).toLocaleString('en-IN')}</span>
            </div>
            {/* Show remaining balance from total project value */}
            {(invoice.totalLeadValue || invoice.invoices) && (
              <div className="total-row" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f1f4', color: '#8e8e93', fontSize: '13px' }}>
                <span className="label">Remaining Balance:</span>
                <span className="val" style={{ color: Math.max(0, (invoice.totalLeadValue || 0) - (paidAmount + (Array.isArray(invoice.invoices) && invoice.invoices.length > 1 ? invoice.invoices.slice(0, -1).reduce((sum: number, inv: any) => sum + Number(inv.amountPaid || (inv.isPaid ? inv.subtotal : 0)), 0) : 0))) > 0 ? '#ff3b30' : '#34c759' }}>
                  ₹{Math.max(0, (invoice.totalLeadValue || 0) - (paidAmount + (Array.isArray(invoice.invoices) && invoice.invoices.length > 1 ? invoice.invoices.slice(0, -1).reduce((sum: number, inv: any) => sum + Number(inv.amountPaid || (inv.isPaid ? inv.subtotal : 0)), 0) : 0))).toLocaleString('en-IN')}
                </span>
              </div>
            )}
          </div>
        </footer>

        <div className="signature-area">
          <div className="auth-sign">
            <div className="signature-wrap">
              <span className="signature-text">{invoice.signatureName || 'Pixelkrafts'}</span>
            </div>
            <div className="sign-line"></div>
            <p>Authorized Signatory</p>
            <p className="comp-label">For {companyName}</p>
          </div>
        </div>
      </div>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Dancing+Script:wght@600&display=swap');

        .vertex-ribbon-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 80px;
          height: 80px;
          overflow: hidden;
          pointer-events: none;
          z-index: 10;
        }

        .vertex-ribbon {
          position: absolute;
          top: 15px;
          left: -25px;
          width: 100px;
          background: #34c759;
          color: white;
          font-size: 10px;
          font-weight: 800;
          text-align: center;
          transform: rotate(-45deg);
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          letter-spacing: 1px;
          padding: 4px 0;
          text-transform: uppercase;
        }

        .vertex-ribbon.paid {
          background: #34c759;
        }

        @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&family=Inter:wght@400;500;600;700;800;900&display=swap');

        body { 
          margin: 0; 
          font-family: 'Inter', system-ui, -apple-system, sans-serif; 
          -webkit-font-smoothing: antialiased;
        }
        
        .invoice-container { 
          display: flex; 
          flex-direction: column; 
          align-items: center; 
          padding: 60px 20px; 
          min-height: 100vh;
          background: #f9f9fb;
        }

        /* Adaptive Theme Support */
        @media (prefers-color-scheme: dark) {
          .theme-adaptive { background: #000000; }
        }

        .action-bar { width: 210mm; max-width: 100%; margin-bottom: 24px; display: flex; justify-content: flex-end; gap: 12px; }
        
        .btn-print { 
          background: #007aff; 
          color: white; 
          border: none; 
          padding: 12px 28px; 
          border-radius: 10px; 
          font-weight: 600; 
          cursor: pointer; 
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 12px rgba(0, 122, 255, 0.2);
        }
        .btn-share { 
          background: #25d366; 
          color: white; 
          border: none; 
          padding: 12px 28px; 
          border-radius: 10px; 
          font-weight: 600; 
          cursor: pointer; 
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(37, 211, 102, 0.2);
        }
        .btn-print:hover, .btn-share:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.1); }
        
        .a4-page { 
          width: 210mm; 
          min-height: 297mm; 
          background: white; 
          padding: 15mm;
          box-shadow: 0 40px 100px rgba(0,0,0,0.06);
          border-radius: 8px;
          display: flex; 
          flex-direction: column;
          color: #1a1a1e !important;
          position: relative;
        }

        .table-responsive { width: 100%; overflow-x: auto; margin: 32px 0; }

        @media (max-width: 850px) {
          .invoice-container { padding: 0; }
          .action-bar { width: 100%; padding: 16px; margin: 0; background: white; border-bottom: 1px solid #f1f1f4; position: sticky; top: 0; z-index: 100; }
          .a4-page { 
            width: 100%; 
            min-height: auto; 
            padding: 24px 16px; 
            border-radius: 0; 
            box-shadow: none;
            border-left: none;
            border-right: none;
          }
          
          .invoice-header { 
            flex-direction: column !important; 
            align-items: flex-start !important; 
            gap: 24px !important; 
            margin-bottom: 32px !important;
            padding-bottom: 24px !important;
            border-bottom: 1px solid #f1f1f4 !important;
          }
          
          .branding { order: 2; width: 100%; }
          .invoice-meta { 
            width: 100%; 
            text-align: left !important; 
            order: 1; 
            border-bottom: 1px solid #f1f1f4; 
            padding-bottom: 24px; 
            margin-bottom: 8px;
            padding-top: 20px; /* Space for the ribbon */
          }
          
          .doc-title { text-align: left !important; font-size: 28px !important; letter-spacing: -1px !important; }
          .meta-grid { align-items: flex-start !important; }
          .meta-item { align-items: flex-start !important; font-size: 13px !important; width: 100%; }
          .meta-item .val { flex: 1; text-align: right; }

          .company-name { font-size: 20px !important; }
          .company-details { font-size: 13px !important; margin-top: 12px; }

          .invoice-footer { 
            display: flex !important;
            flex-direction: column !important;
            gap: 48px !important; 
            padding-top: 32px !important;
            margin-top: 40px !important;
            border-top: 2px solid #f1f1f4 !important;
          }
          
          .totals-col { order: 1 !important; width: 100% !important; gap: 8px !important; border-top: none !important; }
          .notes-col { order: 2 !important; width: 100% !important; border-top: 1px dashed #e5e5ea !important; padding-top: 40px !important; }
          
          .total-row { font-size: 14px !important; padding: 10px 0 !important; }
          .grand-total { 
            margin-top: 16px !important; 
            padding: 24px 20px !important; 
            border-radius: 16px !important;
            background: #f9f9fb !important;
            border: 1px solid #f1f1f4 !important;
          }
          .grand-total .val { font-size: 32px !important; }

          .signature-area { margin-top: 64px !important; justify-content: center !important; }
          .auth-sign { width: 100%; max-width: 240px; }
        }

        @media (max-width: 480px) {
          .a4-page { padding: 24px 12px; }
          .doc-title { font-size: 24px !important; }
          .company-name { font-size: 18px !important; }
          .upi-section { flex-direction: column; align-items: center; text-align: center; gap: 16px; padding: 20px; }
          .upi-scanner-wrap { width: 100px; height: 100px; }
          .invoice-table th, .invoice-table td { padding: 12px 4px; font-size: 12px; }
        }
        .a4-page * { color: #1a1a1e !important; }

        .invoice-header { 
          display: flex; 
          justify-content: space-between; 
          align-items: flex-start; 
          margin-bottom: 20px; 
          padding-bottom: 16px;
          border-bottom: 1px solid #f1f1f4;
        }
        
        .branding { display: flex; flex-direction: column; gap: 6px; }
        .company-name { font-size: 24px; font-weight: 800; color: #000 !important; margin: 0; line-height: 1.1; letter-spacing: -0.03em; }
        
        .msme-section { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
        .msme-id { font-size: 11px; font-weight: 700; color: #8e8e93 !important; }
        .msme-label { font-size: 9px; font-weight: 600; padding: 2px 6px; background: #f1f1f4; border-radius: 4px; color: #8e8e93 !important; text-transform: uppercase; letter-spacing: 0.05em; }

        .company-details { font-size: 13px; color: #636366 !important; margin-top: 12px; line-height: 1.5; }
        .company-details p { margin: 0; }
        .contact-row { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
        .separator { color: #d1d1d6 !important; }
        
        .doc-title { 
          font-size: 36px; 
          font-weight: 900; 
          color: #000 !important; 
          margin: 0 0 16px 0; 
          text-align: right; 
          text-transform: uppercase;
          letter-spacing: -0.04em;
          line-height: 1;
        }
        .meta-grid { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
        .meta-item { font-size: 14px; display: flex; gap: 0; align-items: center; width: 100%; }
        .meta-item .label { font-size: 11px; font-weight: 700; color: #8e8e93 !important; text-transform: uppercase; letter-spacing: 0.05em; width: 100px; flex-shrink: 0; }
        .meta-item .val { font-weight: 700; color: #1a1a1e !important; text-align: left; }

        .billing-section { margin-bottom: 16px; }
        .section-title { 
          font-size: 9px; 
          font-weight: 700; 
          text-transform: uppercase; 
          margin-bottom: 6px; 
          color: #8e8e93 !important; 
          letter-spacing: 0.1em;
        }
        .client-name { font-size: 15px; font-weight: 700; color: #000 !important; margin: 0; }
        .client-address { font-size: 12px; color: #48484a !important; margin: 2px 0; white-space: pre-wrap; line-height: 1.3; }

        .subject-area { 
          margin-bottom: 16px; 
          font-size: 13px; 
          padding: 10px 14px; 
          background: #f9f9fb; 
          border-radius: 8px; 
          border: 1px solid #f1f1f4;
          line-height: 1.3;
          color: #1c1c1e !important;
          font-weight: 500;
        }

        .payment-instruction { 
          background: #fff9e6; 
          border: 1px solid #ffeeba; 
          padding: 12px; 
          border-radius: 8px; 
          margin-bottom: 24px; 
          text-align: center; 
          font-size: 13px; 
          color: #856404 !important; 
          font-weight: 600;
        }

        .invoice-table { width: 100%; border-collapse: separate; border-spacing: 0; }
        .invoice-table th { 
          text-align: left; 
          padding: 10px 12px; 
          font-size: 10px; 
          font-weight: 700; 
          text-transform: uppercase; 
          color: #8e8e93 !important; 
          border-bottom: 1px solid #000;
          letter-spacing: 0.1em;
          background: #fff;
        }
        .invoice-table td { padding: 12px; font-size: 13px; border-bottom: 1px solid #f1f1f4; color: #1a1a1e !important; vertical-align: top; line-height: 1.4; }
        .invoice-table .right { text-align: right; }
        .invoice-table tr:last-child td { border-bottom: none; }

        .invoice-footer { 
          display: grid; 
          grid-template-columns: 1.3fr 1fr; 
          gap: 40px; 
          margin-top: auto; 
          padding-top: 24px;
          border-top: 1px solid #f1f1f4;
        }
        
        .amount-words { margin-bottom: 16px; }
        .amount-words .label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #8e8e93 !important; letter-spacing: 0.05em; }
        .amount-words .val { font-size: 14px; font-weight: 600; color: #1a1a1e !important; margin: 6px 0; line-height: 1.4; }
        
        .bank-details .label { font-size: 11px; font-weight: 700; margin-bottom: 16px; text-transform: uppercase; color: #8e8e93 !important; display: block; letter-spacing: 0.05em; }
        .bank-content { 
          white-space: pre-wrap; 
          font-size: 13px; 
          color: #1a1a1e !important; 
          line-height: 1.7; 
          margin-bottom: 24px; 
          font-weight: 500;
          background: #f9f9fb;
          padding: 16px;
          border-radius: 12px;
          border: 1px solid #f1f1f4;
        }

        .upi-section { 
          display: flex; 
          align-items: center; 
          gap: 20px; 
          background: #fff; 
          padding: 16px; 
          border-radius: 12px; 
          border: 1px solid #f1f1f4; 
          box-shadow: 0 4px 12px rgba(0,0,0,0.03);
        }
        .upi-meta .label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #8e8e93 !important; margin-bottom: 4px; }
        .upi-id { font-size: 14px; font-weight: 700; color: #000 !important; margin: 0; }
        .upi-scanner-wrap { width: 72px; height: 72px; border: 1px solid #f1f1f4; border-radius: 8px; padding: 6px; background: #fff; }
        .upi-img { width: 100%; height: 100%; object-fit: contain; }

        .total-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; font-size: 15px; }
        .total-row .label { font-weight: 500; color: #8e8e93 !important; }
        .total-row .val { font-weight: 600; color: #1a1a1e !important; }
        
        .grand-total { 
          border-top: 2px solid #000; 
          margin-top: 16px; 
          padding-top: 20px; 
        }
        .grand-total .label { font-size: 18px; font-weight: 800; color: #000 !important; text-transform: uppercase; letter-spacing: -0.02em; }
        .grand-total .val { font-size: 32px; font-weight: 900; color: #007aff !important; letter-spacing: -0.03em; }
        
        .signature-area { display: flex; justify-content: flex-end; margin-top: 40px; }
        .auth-sign { text-align: center; width: 220px; }
        .signature-wrap { height: 40px; display: flex; align-items: center; justify-content: center; position: relative; margin-bottom: -10px; }
        .signature-text { font-family: 'Dancing Script', cursive; font-size: 32px; color: #48484a !important; opacity: 0.8; transform: rotate(-1deg); }
        .sign-line { border-bottom: 1.2px solid #1a1a1e; margin-bottom: 12px; height: 60px; position: relative; z-index: 5; }
        .auth-sign p { font-size: 10px; font-weight: 700; color: #000 !important; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
        .comp-label { margin-top: 4px !important; color: #8e8e93 !important; font-size: 9px !important; text-transform: none !important; letter-spacing: 0 !important; }
 
        .loading, .error { height: 100vh; display: flex; align-items: center; justify-content: center; font-weight: 600; }
        .error { color: #ff3b30; }

        /* Skeleton Animation */
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }

        .sk-line, .sk-row {
          background: #f1f1f4;
          animation: pulse 1.5s ease-in-out infinite;
          border-radius: 4px;
        }

        .skeleton-page { padding: 40px !important; }
        .skeleton-header { display: flex; justify-content: space-between; margin-bottom: 60px; }
        .skeleton-branding .title { width: 200px; height: 24px; margin-bottom: 12px; }
        .skeleton-branding .sub { width: 140px; height: 12px; margin-bottom: 8px; }
        .skeleton-meta { text-align: right; }
        .skeleton-meta .title { width: 120px; height: 28px; margin-bottom: 12px; margin-left: auto; }
        .skeleton-meta .item { width: 160px; height: 14px; margin-bottom: 8px; margin-left: auto; }
        
        .skeleton-billing { margin-bottom: 40px; }
        .skeleton-billing .label { width: 60px; height: 10px; margin-bottom: 12px; }
        .skeleton-billing .name { width: 180px; height: 20px; margin-bottom: 8px; }
        .skeleton-billing .addr { width: 240px; height: 12px; margin-bottom: 6px; }

        .skeleton-table { margin-bottom: 40px; }
        .sk-row { height: 40px; margin-bottom: 8px; width: 100%; }
        .sk-row.header { height: 32px; background: #eee; margin-bottom: 16px; }

        .skeleton-footer { display: flex; justify-content: space-between; margin-top: auto; padding-top: 40px; }
        .sk-footer-col .label { width: 100px; height: 10px; margin-bottom: 12px; }
        .sk-footer-col .block { width: 200px; height: 80px; }
        .sk-footer-col.right .total { width: 180px; height: 50px; }

        @media print {
          html, body { 
            height: auto !important; 
            margin: 0 !important; 
            padding: 0 !important; 
            overflow: visible !important;
            background: white !important; 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print { display: none !important; }
          .invoice-container { padding: 0 !important; margin: 0 !important; background: white !important; min-height: auto !important; display: block !important; }
          
          .invoice-header { 
            display: flex !important; 
            flex-direction: row !important; 
            justify-content: space-between !important; 
            align-items: flex-start !important;
            margin-bottom: 24px !important;
            padding-bottom: 16px !important;
            border-bottom: 1px solid #f1f1f4 !important;
          }
          .branding { width: auto !important; order: 1 !important; text-align: left !important; }
          .invoice-meta { width: auto !important; order: 2 !important; text-align: right !important; padding-top: 0 !important; border-bottom: none !important; margin-bottom: 0 !important; }
          .meta-grid { align-items: flex-end !important; }
          .meta-item { justify-content: flex-end !important; flex-direction: row !important; align-items: center !important; }
          .meta-item .label { text-align: left !important; width: 100px !important; }
          .meta-item .val { text-align: right !important; }

          .invoice-footer { 
            display: grid !important; 
            grid-template-columns: 1.3fr 1fr !important; 
            gap: 40px !important; 
            flex-direction: row !important;
            padding-top: 24px !important;
            border-top: 1px solid #f1f1f4 !important;
          }
          .notes-col { order: 1 !important; width: auto !important; border-top: none !important; padding-top: 0 !important; }
          .totals-col { order: 2 !important; width: auto !important; }
          .grand-total { margin-top: 12px !important; padding: 12px !important; border-radius: 8px !important; }

          .a4-page { 
            box-shadow: none !important; 
            padding: 10mm 12mm !important; 
            width: 210mm !important; 
            margin: 0 !important; 
            border-radius: 0 !important; 
            box-sizing: border-box !important;
            overflow: visible !important;
            zoom: 0.9;
          }
          @page { size: A4; margin: 0; }
        }
      `}</style>
    </div>
  );
}
