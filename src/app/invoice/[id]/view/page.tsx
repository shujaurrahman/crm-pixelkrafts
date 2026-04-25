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

  // Defaults
  const defaultCompanyName = 'Pixelkraft Software Solutions';
  const defaultCompanyAddress = '805 Wasil Pilibhit 262001 UP India';
  const defaultCompanyEmail = 'official@pixelkrafts.in';
  const defaultCompanyPhone = '+917579966178';
  const defaultMsmeNumber = 'UDYAM-UP-60-0038284';

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

  // Use dynamic company details if available
  const companyName = invoice.companyName || defaultCompanyName;
  const companyAddress = invoice.companyAddress || defaultCompanyAddress;
  const companyEmail = invoice.companyEmail || defaultCompanyEmail;
  const companyPhone = invoice.companyPhone || defaultCompanyPhone;
  const msmeNumber = invoice.msmeNumber || defaultMsmeNumber;

  return (
    <div className="invoice-container theme-adaptive">
      <Toaster position="top-center" richColors />
      
      <div className="no-print action-bar">
        <button onClick={() => window.print()} className="btn-print">Download / Print Invoice</button>
      </div>

      <div className="invoice-box a4-page">
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
            </div>
          </div>
          <div className="invoice-meta">
            <h2 className="doc-title">Invoice</h2>
            <div className="meta-grid">
              <div className="meta-item">
                <span className="label">Invoice No:</span>
                <span className="val">{invoice.invoiceNo}</span>
              </div>
              <div className="meta-item">
                <span className="label">Date:</span>
                <span className="val">{invoice.date}</span>
              </div>
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
            <strong>Subject: </strong>
            <span>{invoice.subject}</span>
          </div>
        )}

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

        <footer className="invoice-footer">
          <div className="notes-col">
            <div className="amount-words">
              <span className="label">Amount in Words:</span>
              <p className="val">{numberToWords(Math.round(grandTotal))}</p>
            </div>
            <div className="bank-details">
              <h4 className="label">Bank Details:</h4>
              <div className="bank-content">
                {invoice.bankDetails || 'A/C: 50100656771132\nIFSC: HDFC0000651\nBranch: NOIDA SEC 26\nAccount Type: SAVINGS'}
              </div>
              <div className="upi-section">
                <div className="upi-meta">
                  <h4 className="label">Scan to Pay via UPI:</h4>
                  <p className="upi-id">7579966178@hdfc</p>
                </div>
                <div className="upi-scanner-wrap">
                  <img src="/UPI.jpeg" alt="UPI Scanner" className="upi-img" />
                </div>
              </div>
            </div>
          </div>
          <div className="totals-col">
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
          </div>
        </footer>

        <div className="signature-area">
          <div className="auth-sign">
            <p className="signature-italic">{companyName}</p>
            <div className="sign-line"></div>
            <p>Authorized Signatory</p>
            <p className="comp-label">{companyName}</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Dancing+Script:wght@600&display=swap');

        body { margin: 0; font-family: 'Inter', sans-serif; }
        .invoice-container { 
          display: flex; 
          flex-direction: column; 
          align-items: center; 
          padding: 40px 0; 
          min-height: 100vh;
          transition: background 0.3s ease;
        }

        /* Adaptive Theme Support */
        @media (prefers-color-scheme: light) {
          .theme-adaptive { background: #f9f9fb; }
        }
        @media (prefers-color-scheme: dark) {
          .theme-adaptive { background: #000000; }
        }

        .action-bar { width: 210mm; margin-bottom: 20px; display: flex; justify-content: flex-end; }
        
        .btn-print { 
          background: #007aff; 
          color: white; 
          border: none; 
          padding: 10px 24px; 
          border-radius: 8px; 
          font-weight: 600; 
          cursor: pointer; 
          transition: all 0.2s;
        }
        .btn-print:hover { opacity: 0.9; transform: translateY(-1px); }
        
        .a4-page { 
          width: 210mm; 
          min-height: 297mm; 
          background: white; 
          padding: 20mm;
          box-shadow: 0 20px 50px rgba(0,0,0,0.1);
          border-radius: 4px;
          display: flex; 
          flex-direction: column;
          color: #1a1a1e !important;
        }
        .a4-page * { color: #1a1a1e !important; }

        .invoice-header { 
          display: flex; 
          justify-content: space-between; 
          align-items: flex-start; 
          margin-bottom: 40px; 
          padding-bottom: 20px;
          border-bottom: 1px solid #f1f1f4;
        }
        
        .branding { display: flex; flex-direction: column; gap: 4px; flex: 1; }
        .company-name { font-size: 22px; font-weight: 800; color: #1a1a1e !important; margin: 0; line-height: 1.2; letter-spacing: -0.5px; }
        
        .msme-section { display: flex; flex-direction: column; gap: 1px; margin-top: 4px; }
        .msme-id { font-size: 10px; font-weight: 700; color: #8e8e93 !important; }
        .msme-label { font-size: 9px; font-weight: 600; color: #8e8e93 !important; text-transform: uppercase; letter-spacing: 0.5px; margin: 0; }

        .company-details { font-size: 13px; color: #8e8e93 !important; margin-top: 8px; }
        .company-details p { margin: 0; }
        .contact-row { display: flex; align-items: center; gap: 8px; margin-top: 2px; }
        .separator { color: #e5e5ea !important; }
        
        .doc-title { 
          font-size: 32px; 
          font-weight: 800; 
          color: #1a1a1e !important; 
          margin: 0 0 12px 0; 
          text-align: right; 
          text-transform: uppercase;
          letter-spacing: -1px;
        }
        .meta-grid { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }
        .meta-item { font-size: 13px; display: flex; gap: 12px; justify-content: flex-end; }
        .meta-item .label { font-weight: 500; color: #8e8e93 !important; }
        .meta-item .val { font-weight: 600; text-align: right; }

        .billing-section { margin-bottom: 40px; }
        .section-title { 
          font-size: 11px; 
          font-weight: 700; 
          text-transform: uppercase; 
          margin-bottom: 12px; 
          color: #8e8e93 !important; 
          letter-spacing: 1px;
        }
        .client-name { font-size: 18px; font-weight: 700; color: #1a1a1e !important; margin: 0; }
        .client-address { font-size: 14px; color: #1a1a1e !important; margin: 6px 0; white-space: pre-wrap; line-height: 1.5; }

        .subject-area { 
          margin-bottom: 40px; 
          font-size: 14px; 
          padding: 16px; 
          background: #f9f9fb; 
          border-radius: 8px; 
          border: 1px solid #f1f1f4;
        }
        .subject-area strong { font-weight: 600; color: #8e8e93 !important; }

        .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        .invoice-table th { 
          text-align: left; 
          padding: 12px; 
          font-size: 11px; 
          font-weight: 700; 
          text-transform: uppercase; 
          color: #8e8e93 !important; 
          border-bottom: 2px solid #f1f1f4;
          letter-spacing: 1px;
        }
        .invoice-table td { padding: 12px; font-size: 14px; border-bottom: 1px solid #f1f1f4; color: #1a1a1e !important; vertical-align: top; }
        .invoice-table .right { text-align: right; }

        .invoice-footer { 
          display: grid; 
          grid-template-columns: 1.2fr 1fr; 
          gap: 60px; 
          margin-top: auto; 
          padding-top: 40px;
          border-top: 1px solid #f1f1f4;
        }
        
        .amount-words .label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #8e8e93 !important; letter-spacing: 0.5px; }
        .amount-words .val { font-size: 13px; font-weight: 600; color: #1a1a1e !important; margin: 4px 0; font-style: italic; }
        
        .bank-details .label { font-size: 10px; font-weight: 700; margin-bottom: 12px; text-transform: uppercase; color: #8e8e93 !important; display: block; }
        .bank-content { 
          white-space: pre-wrap; 
          font-size: 12px; 
          color: #1a1a1e !important; 
          line-height: 1.6; 
          margin-bottom: 20px; 
          font-weight: 500;
          background: #f9f9fb;
          padding: 12px;
          border-radius: 8px;
        }

        .upi-section { 
          display: flex; 
          align-items: center; 
          gap: 16px; 
          background: #ffffff; 
          padding: 12px; 
          border-radius: 8px; 
          border: 1px solid #f1f1f4; 
        }
        .upi-meta .label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #8e8e93 !important; margin-bottom: 4px; }
        .upi-id { font-size: 13px; font-weight: 700; color: #1a1a1e !important; margin: 0; }
        .upi-scanner-wrap { width: 60px; height: 60px; border: 1px solid #f1f1f4; border-radius: 6px; padding: 4px; }
        .upi-img { width: 100%; height: 100%; object-fit: contain; }

        .total-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; font-size: 14px; }
        .total-row .label { font-weight: 500; color: #8e8e93 !important; }
        .total-row .val { font-weight: 600; }
        
        .grand-total { 
          border-top: 2px solid #f1f1f4; 
          margin-top: 12px; 
          padding-top: 16px; 
        }
        .grand-total .label { font-size: 18px; font-weight: 700; color: #1a1a1e !important; }
        .grand-total .val { font-size: 24px; font-weight: 800; color: #007aff !important; }
        
        .signature-area { display: flex; justify-content: flex-end; margin-top: 60px; }
        .auth-sign { text-align: center; width: 220px; }
        .signature-italic { font-family: 'Dancing Script', cursive; font-size: 22px; color: #1a1a1e !important; margin-bottom: -8px; }
        .sign-line { border-bottom: 1px solid #e5e5ea; margin-bottom: 12px; height: 60px; }
        .auth-sign p { font-size: 13px; font-weight: 600; color: #8e8e93 !important; margin: 0; }
 
        .loading, .error { height: 100vh; display: flex; align-items: center; justify-content: center; font-weight: 600; }
        .error { color: #ff3b30; }

        @media print {
          html, body { height: auto !important; margin: 0 !important; padding: 0 !important; background: white !important; }
          .no-print { display: none !important; }
          .invoice-container { padding: 0 !important; background: white !important; min-height: auto !important; }
          .a4-page { 
            box-shadow: none !important; 
            padding: 15mm !important; 
            width: 210mm !important; 
            height: 297mm !important; 
            margin: 0 auto !important; 
            border-radius: 0 !important; 
            box-sizing: border-box !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
          }
          @page { size: A4; margin: 0; }
        }
      `}</style>
    </div>
  );
}
