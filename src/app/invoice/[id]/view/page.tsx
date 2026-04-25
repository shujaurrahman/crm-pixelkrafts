'use client';

import { useEffect, useState, use } from 'react';
import { useParams } from 'next/navigation';
import { toast, Toaster } from 'sonner';
import { numberToWords } from '@/lib/number-to-words';

export default function InvoicePortal({ params: rawParams }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(rawParams);
  const fallbackParams = useParams();
  const id = resolvedParams?.id || (fallbackParams?.id as string) || '';
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/leads/${id}/invoice?t=${Date.now()}`, { cache: 'no-store' });
        const data = await res.json();

        if (!data.error) {
          setInvoice(data);
        } else {
          // Fallback to lead data if invoice not found
          const leadsRes = await fetch('/api/leads', { cache: 'no-store' });
          const leadsData = await leadsRes.json();
          const lead = leadsData.leads?.find((l: any) => l.id === id);
          
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
  }, [id]);

  if (loading) return <div className="loading">Loading Invoice...</div>;
  if (!invoice) return <div className="error">Invoice not found.</div>;

  const subtotal = invoice.subtotal || 0;
  const discountAmount = (subtotal * (invoice.discount || 0)) / 100;
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = (taxableAmount * (invoice.tax || 0)) / 100;
  const grandTotal = taxableAmount + taxAmount;

  return (
    <div className="invoice-container">
      <Toaster position="top-center" richColors />
      
      <div className="no-print action-bar">
        <button onClick={() => window.print()} className="btn-print">Download / Print Invoice</button>
      </div>

      <div className="invoice-box a4-page">
        <header className="invoice-header">
          <div className="branding">
            <h1 className="company-name">Pixelkraft Software Solutions</h1>
            <p className="msme-badge">MSME Registered Enterprise</p>
            <p className="company-details">Bangalore, Karnataka, India | contact@pixelkrafts.in</p>
          </div>
          <div className="invoice-meta">
            <h2 className="doc-title">TAX INVOICE</h2>
            <div className="meta-grid">
              <div className="meta-item">
                <span className="label">Invoice No:</span>
                <span className="val">{invoice.invoiceNo}</span>
              </div>
              <div className="meta-item">
                <span className="label">Date:</span>
                <span className="val">{invoice.date}</span>
              </div>
              {invoice.lastSaved && (
                <div className="meta-item">
                  <span className="label">Last Saved:</span>
                  <span className="val">{new Date(invoice.lastSaved).toLocaleDateString()}</span>
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
          <div className="subject-line" style={{ marginBottom: '30px', borderLeft: '4px solid #0f172a', paddingLeft: '12px' }}>
            <strong style={{ fontSize: '14px' }}>Subject: </strong>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>{invoice.subject}</span>
          </div>
        )}

        <table className="invoice-table">
          <thead>
            <tr>
              <th>SR</th>
              <th>Description</th>
              <th className="right">Qty</th>
              <th className="right">Rate</th>
              <th className="right">Amount</th>
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

        <footer className="invoice-footer">
          <div className="notes-col">
            <div className="amount-words">
              <span className="label">Amount in Words:</span>
              <p className="val">{numberToWords(Math.round(grandTotal))}</p>
            </div>
            <div className="bank-details">
              <h4 className="label">Payment Info:</h4>
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {invoice.bankDetails || 'Account Name: Pixelkraft Software Solutions\nBank: HDFC Bank\nIFSC: HDFC0001234'}
              </div>
            </div>
          </div>
          <div className="totals-col">
            <div className="total-row">
              <span>Sub Total:</span>
              <span>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="total-row">
                <span>Discount ({invoice.discount}%):</span>
                <span>- ₹{Math.round(discountAmount).toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="total-row">
              <span>GST ({invoice.tax}%):</span>
              <span>₹{Math.round(taxAmount).toLocaleString('en-IN')}</span>
            </div>
            <div className="total-row grand-total">
              <span>Grand Total:</span>
              <span>₹{Math.round(grandTotal).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </footer>

        <div className="signature-area">
          <div className="auth-sign">
            <div className="sign-line"></div>
            <p>Authorized Signatory</p>
            <p className="comp-label">Pixelkraft Software Solutions</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        body { background: #f1f5f9; margin: 0; font-family: 'Inter', sans-serif; color: #1e293b; }
        .invoice-container { display: flex; flex-direction: column; align-items: center; padding: 40px 0; }
        .action-bar { width: 210mm; margin-bottom: 20px; display: flex; justify-content: flex-end; }
        .btn-print { background: #0f172a; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; }
        
        .a4-page { 
          width: 210mm; min-height: 297mm; background: white; padding: 20mm;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1); border-radius: 4px;
          display: flex; flex-direction: column;
        }

        .invoice-header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 40px; }
        .company-name { font-size: 24px; font-weight: 900; color: #0f172a; margin: 0; }
        .msme-badge { display: inline-block; background: #fef3c7; color: #92400e; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 4px; margin: 4px 0; text-transform: uppercase; }
        .company-details { font-size: 12px; color: #64748b; margin: 4px 0; }
        
        .doc-title { font-size: 32px; font-weight: 900; color: #0f172a; margin: 0 0 16px 0; text-align: right; letter-spacing: 2px; }
        .meta-grid { display: flex; flex-direction: column; gap: 4px; align-items: flex-end; }
        .meta-item { font-size: 13px; display: flex; gap: 8px; }
        .meta-item .label { font-weight: 700; color: #64748b; }
        .meta-item .val { font-weight: 700; color: #0f172a; }

        .billing-section { margin-bottom: 40px; }
        .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 8px; }
        .client-name { font-size: 18px; font-weight: 800; color: #0f172a; margin: 0; }
        .client-address { font-size: 13px; color: #475569; margin: 4px 0; white-space: pre-wrap; }

        .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
        .invoice-table th { background: #f8fafc; text-align: left; padding: 12px; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; }
        .invoice-table td { padding: 12px; font-size: 14px; border-bottom: 1px solid #f1f5f9; color: #334155; }
        .invoice-table .right { text-align: right; }

        .invoice-footer { display: grid; grid-template-columns: 1.5fr 1fr; gap: 40px; margin-top: auto; border-top: 1px solid #e2e8f0; padding-top: 20px; }
        .amount-words { margin-bottom: 20px; }
        .amount-words .label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; }
        .amount-words .val { font-size: 13px; font-weight: 700; color: #0f172a; margin: 4px 0; text-transform: capitalize; }
        
        .bank-details { font-size: 11px; color: #64748b; line-height: 1.5; }
        .bank-details .label { font-size: 10px; font-weight: 800; margin-bottom: 4px; color: #0f172a; text-transform: uppercase; }
        .bank-details p { margin: 0; }

        .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; color: #475569; }
        .grand-total { border-top: 2px solid #0f172a; margin-top: 8px; padding-top: 12px; font-size: 18px; font-weight: 900; color: #0f172a; }
        
        .signature-area { display: flex; justify-content: flex-end; margin-top: 60px; }
        .auth-sign { text-align: center; width: 200px; }
        .sign-line { border-bottom: 1px solid #0f172a; margin-bottom: 8px; height: 40px; }
        .auth-sign p { font-size: 12px; font-weight: 700; margin: 0; }
        .comp-label { font-size: 10px !important; color: #64748b; }

        .loading, .error { height: 100vh; display: flex; align-items: center; justify-content: center; font-weight: 700; }
        .error { color: #ef4444; }

        @media print {
          body { background: white; }
          .no-print { display: none; }
          .invoice-container { padding: 0; }
          .a4-page { box-shadow: none; padding: 10mm; }
          @page { size: A4; margin: 0; }
        }
      `}</style>
    </div>
  );
}
