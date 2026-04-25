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
              <h4 className="label">Bank Details:</h4>
              <div style={{ whiteSpace: 'pre-wrap', marginBottom: '16px' }}>
                {invoice.bankDetails || 'A/C: 50100656771132\nIFSC: HDFC0000651\nBranch: NOIDA SEC 26\nAccount Type: SAVINGS'}
              </div>
              <div className="upi-section" style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                <div className="upi-meta" style={{ flex: 1 }}>
                  <h4 className="label" style={{ fontSize: '10px', fontWeight: 800, marginBottom: '4px', color: '#0f172a', textTransform: 'uppercase' }}>Scan to Pay via UPI:</h4>
                  <p className="upi-id" style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', margin: '4px 0' }}>7579966178@hdfc</p>
                </div>
                <div className="upi-scanner-wrap" style={{ width: '60px', height: '60px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '4px', overflow: 'hidden' }}>
                  <img src="/UPI.jpeg" alt="UPI Scanner" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
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
        body { background: #f1f5f9; margin: 0; font-family: 'Inter', sans-serif; color: #000; }
        .invoice-container { display: flex; flex-direction: column; align-items: center; padding: 40px 0; }
        .action-bar { width: 210mm; margin-bottom: 20px; display: flex; justify-content: flex-end; }
        .btn-print { background: #000; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; }
        
        .a4-page { 
          width: 210mm; min-height: 297mm; background: white; padding: 25mm;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1); border-radius: 4px;
          display: flex; flex-direction: column;
          color: #000 !important;
        }
        .a4-page * { color: #000 !important; }

        .invoice-header { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 3px solid #000; padding-bottom: 25px; margin-bottom: 50px; align-items: start; gap: 40px; }
        .company-name { font-size: 28px; font-weight: 950; color: #000 !important; margin: 0; line-height: 1.1; }
        .msme-badge { display: inline-block; background: #000; color: #fff !important; font-size: 10px; font-weight: 900; padding: 4px 10px; border-radius: 2px; align-self: flex-start; text-transform: uppercase; margin: 5px 0; }
        .msme-badge * { color: #fff !important; }
        .company-details { font-size: 13px; color: #000 !important; margin: 0; line-height: 1.6; font-weight: 600; }
        
        .doc-title { font-size: 40px; font-weight: 950; color: #000 !important; margin: 0 0 16px 0; text-align: right; letter-spacing: 3px; line-height: 1; }
        .meta-grid { display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
        .meta-item { font-size: 14px; display: flex; gap: 12px; justify-content: flex-end; width: 100%; }
        .meta-item .label { font-weight: 950; min-width: 100px; text-align: right; }
        .meta-item .val { font-weight: 900; min-width: 150px; text-align: left; }

        .billing-section { margin-bottom: 50px; }
        .section-title { font-size: 13px; font-weight: 950; text-transform: uppercase; margin-bottom: 15px; border-bottom: 3px solid #000; display: inline-block; padding-bottom: 4px; }
        .client-name { font-size: 22px; font-weight: 950; color: #000 !important; margin: 0; }
        .client-address { font-size: 15px; color: #000 !important; margin: 10px 0; white-space: pre-wrap; line-height: 1.7; font-weight: 600; }

        .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 40px; border: 2px solid #000; }
        .invoice-table th { background: #000; text-align: left; padding: 16px 12px; font-size: 13px; font-weight: 950; text-transform: uppercase; color: #fff !important; border: 1px solid #000; }
        .invoice-table th * { color: #fff !important; }
        .invoice-table td { padding: 14px 12px; font-size: 15px; border: 1px solid #000; color: #000 !important; font-weight: 700; }
        .invoice-table .right { text-align: right; }

        .invoice-footer { display: grid; grid-template-columns: 1.3fr 1fr; gap: 80px; margin-top: auto; border-top: 4px solid #000; padding-top: 50px; }
        .amount-words { margin-bottom: 40px; }
        .amount-words .label { font-size: 12px; font-weight: 950; text-transform: uppercase; margin-bottom: 8px; display: block; }
        .amount-words .val { font-size: 15px; font-weight: 900; color: #000 !important; margin: 8px 0; text-transform: capitalize; border-bottom: 2px solid #eee; padding-bottom: 8px; line-height: 1.4; }
        
        .bank-details { font-size: 14px; color: #000 !important; line-height: 1.7; font-weight: 700; }
        .bank-details .label { font-size: 12px; font-weight: 950; margin-bottom: 15px; color: #000 !important; text-transform: uppercase; display: block; }
        
        .total-row { display: flex; justify-content: space-between; padding: 10px 0; font-size: 16px; color: #000 !important; font-weight: 900; border-bottom: 2px solid #f0f0f0; }
        .grand-total { border-top: 4px solid #000; margin-top: 20px; padding-top: 25px; font-size: 22px; font-weight: 950; }
        .grand-total span:last-child { font-size: 32px; }
        
        .signature-area { display: flex; justify-content: flex-end; margin-top: 100px; }
        .auth-sign { text-align: center; width: 280px; }
        .sign-line { border-bottom: 3px solid #000; margin-bottom: 12px; height: 70px; }
        .auth-sign p { font-size: 15px; font-weight: 950; color: #000 !important; margin: 0; }
        .comp-label { font-size: 12px !important; font-weight: 800 !important; margin-top: 4px !important; }

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
