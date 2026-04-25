'use client';

import React, { useState, useEffect, useCallback, useMemo, use } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Lead } from '@/lib/crm-data';
import { toast, Toaster } from 'sonner';
import { numberToWords } from '@/lib/number-to-words';

export default function InvoiceEditor({ params: rawParams }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(rawParams);
  const fallbackParams = useParams();
  const id = resolvedParams?.id || (fallbackParams?.id as string) || '';
  const router = useRouter();

  const [lead, setLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // --- Editable Data State ---
  const [invoiceNo, setInvoiceNo] = useState(`INV-${String(id).split('-')[1] || id}`);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));
  const [clientName, setClientName] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [subject, setSubject] = useState('Invoice for Services Rendered');
  const [items, setItems] = useState<any[]>([
    { id: 1, desc: '[Service/Product Description]', qty: 1, rate: 0, total: 0 }
  ]);
  const [discountRate, setDiscountRate] = useState(0);
  const [gstRate, setGstRate] = useState(18);
  const [bankDetails, setBankDetails] = useState('A/C: 50100656771132\nIFSC: HDFC0000651\nBranch: NOIDA SEC 26\nAccount Type: SAVINGS');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/leads');
        const data = await res.json();
        const found = data.leads.find((l: Lead) => l.id === id);
        
        // Try to load existing invoice
        const invRes = await fetch(`/api/leads/${id}/invoice?t=${Date.now()}`);
        if (invRes.ok) {
          const invData = await invRes.json();
          setInvoiceNo(invData.invoiceNo || `INV-${String(id).split('-')[1] || id}`);
          setInvoiceDate(invData.date || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));
          setClientName(invData.clientName || found?.clientName || '');
          setToAddress(invData.address || [found?.city, found?.state, found?.country].filter(Boolean).join(', '));
          if (invData.subject) setSubject(invData.subject);
          if (invData.items) setItems(invData.items);
          if (invData.discount !== undefined) setDiscountRate(invData.discount);
          if (invData.tax !== undefined) setGstRate(invData.tax);
          if (invData.bankDetails) setBankDetails(invData.bankDetails);
        } else if (found) {
          setLead(found);
          setClientName(found.clientName);
          const contactInfo = `Ph: ${found.phone || 'N/A'}\nEmail: ${found.email || 'N/A'}`;
          const locationInfo = [found.city, found.state, found.country].filter(Boolean).join(', ');
          setToAddress(`${locationInfo}\n${contactInfo}`);
          setSubject(`Invoice for Advance - ${found.productName || 'Project'}`);
          setItems([{
            id: 1,
            desc: `Advance for project ${found.productName || 'Intimation'} - as per project scope and discussion.`,
            qty: 1,
            rate: Math.round(found.expectedValue * 0.5), // Default 50% advance
            total: Math.round(found.expectedValue * 0.5)
          }]);
        }
      } catch (e) {
        toast.error('Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const subtotal = useMemo(() => items.reduce((acc, item) => acc + (item.qty * (item.rate || 0)), 0), [items]);
  const discountAmount = useMemo(() => (subtotal * discountRate) / 100, [subtotal, discountRate]);
  const taxableAmount = useMemo(() => subtotal - discountAmount, [subtotal, discountAmount]);
  const taxAmount = useMemo(() => (taxableAmount * gstRate) / 100, [taxableAmount, gstRate]);
  const grandTotal = useMemo(() => taxableAmount + taxAmount, [taxableAmount, taxAmount]);

  const addItem = () => {
    const nextId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
    setItems([...items, { id: nextId, desc: 'New Item', qty: 1, rate: 0, total: 0 }]);
  };

  const removeItem = (itemId: number) => {
    if (items.length === 1) return;
    setItems(items.filter(i => i.id !== itemId));
  };

  const updateItem = (itemId: number, field: string, value: any) => {
    setItems(items.map(i => {
      if (i.id === itemId) {
        const updated = { ...i, [field]: value };
        updated.total = updated.qty * (updated.rate || 0);
        return updated;
      }
      return i;
    }));
  };

  const saveInvoice = async () => {
    setIsSaving(true);
    const invoiceData = {
      invoiceNo,
      date: invoiceDate,
      lastSaved: new Date().toISOString(),
      clientName,
      address: toAddress,
      subject,
      items,
      subtotal,
      discount: discountRate,
      tax: gstRate,
      bankDetails,
      total: Math.round(grandTotal),
    };

    try {
      const res = await fetch(`/api/leads/${id}/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceData)
      });
      if (res.ok) {
        toast.success('Invoice saved and synced!');
      } else {
        throw new Error('Failed to save');
      }
    } catch (e) {
      toast.error('Error saving invoice');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="loading">Loading Editor...</div>;

  return (
    <div className="editor-container">
      <Toaster position="top-center" richColors />
      
      <div className="toolbar no-print">
        <div className="toolbar-left">
          <button className="btn-back" onClick={() => router.back()}>← Back</button>
          <h2>Invoice Editor</h2>
        </div>
        <div className="toolbar-right">
          <button className="btn-save" onClick={saveInvoice} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Invoice'}
          </button>
          <button className="btn-view" onClick={() => window.open(`/invoice/${id}/view`, '_blank')}>
            View Portal
          </button>
        </div>
      </div>

      <div className="invoice-page a4-page">
        <header className="header">
          <div className="branding">
            <h1 contentEditable suppressContentEditableWarning onBlur={e => e.currentTarget.innerText}>Pixelkraft Software Solutions</h1>
            <p className="msme-badge">MSME Registered Enterprise</p>
            <p className="company-details">Bangalore, Karnataka, India | contact@pixelkrafts.in</p>
          </div>
          <div className="meta">
            <h2 className="title">TAX INVOICE</h2>
            <div className="meta-grid">
              <div className="meta-item">
                <span className="label">Invoice No:</span>
                <span className="val" contentEditable suppressContentEditableWarning onBlur={e => setInvoiceNo(e.currentTarget.innerText)}>{invoiceNo}</span>
              </div>
              <div className="meta-item">
                <span className="label">Date:</span>
                <span className="val" contentEditable suppressContentEditableWarning onBlur={e => setInvoiceDate(e.currentTarget.innerText)}>{invoiceDate}</span>
              </div>
            </div>
          </div>
        </header>

        <section className="billing">
          <div className="bill-to">
            <h3 className="section-title">Bill To:</h3>
            <p className="client-name" contentEditable suppressContentEditableWarning onBlur={e => setClientName(e.currentTarget.innerText)}>{clientName}</p>
            <p className="client-address" contentEditable suppressContentEditableWarning onBlur={e => setToAddress(e.currentTarget.innerText)}>{toAddress}</p>
          </div>
        </section>

        <div className="subject-area">
          <strong>Subject: </strong>
          <span className="editable-subject" contentEditable suppressContentEditableWarning onBlur={e => setSubject(e.currentTarget.innerText)}>{subject}</span>
        </div>

        <table className="items-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>SR</th>
              <th>Description</th>
              <th className="right" style={{ width: '60px' }}>Qty</th>
              <th className="right" style={{ width: '120px' }}>Rate</th>
              <th className="right" style={{ width: '120px' }}>Amount</th>
              <th className="no-print" style={{ width: '40px' }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id}>
                <td>{idx + 1}</td>
                <td>
                  <textarea 
                    value={item.desc} 
                    onChange={e => updateItem(item.id, 'desc', e.target.value)}
                    rows={1}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = target.scrollHeight + 'px';
                    }}
                  />
                </td>
                <td className="right">
                  <input type="number" value={item.qty} onChange={e => updateItem(item.id, 'qty', Number(e.target.value))} />
                </td>
                <td className="right">
                  <div className="price-input">
                    <span>₹</span>
                    <input type="number" value={item.rate} onChange={e => updateItem(item.id, 'rate', Number(e.target.value))} />
                  </div>
                </td>
                <td className="right">₹{item.total.toLocaleString('en-IN')}</td>
                <td className="no-print right">
                  <button className="btn-del" onClick={() => removeItem(item.id)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn-add no-print" onClick={addItem}>+ Add Line Item</button>

        <footer className="footer">
          <div className="notes-col">
            <div className="amount-words">
              <span className="label">Amount in Words:</span>
              <p className="val">{numberToWords(Math.round(grandTotal))}</p>
            </div>
            <div className="bank-details">
              <h4 className="label">Bank Details:</h4>
              <textarea 
                value={bankDetails} 
                onChange={e => setBankDetails(e.target.value)}
                rows={4}
              />
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
            <div className="total-row">
              <span className="label">Discount:</span>
              <div className="input-group">
                <input type="number" value={discountRate} onChange={e => setDiscountRate(Number(e.target.value))} />
                <span>%</span>
              </div>
            </div>
            <div className="total-row">
              <span className="label">GST:</span>
              <div className="input-group">
                <input type="number" value={gstRate} onChange={e => setGstRate(Number(e.target.value))} />
                <span>%</span>
              </div>
            </div>
            <div className="total-row grand-total">
              <span className="label">Grand Total:</span>
              <span className="val">₹{Math.round(grandTotal).toLocaleString('en-IN')}</span>
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
        .editor-container { background: #f8fafc; min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding-bottom: 100px; }
        .toolbar { width: 100%; background: #0f172a; color: white; padding: 12px 40px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .toolbar h2 { font-size: 18px; margin: 0; font-weight: 700; }
        .toolbar-left, .toolbar-right { display: flex; gap: 16px; align-items: center; }
        
        .btn-back { background: transparent; border: 1px solid #334155; color: #94a3b8; padding: 6px 12px; border-radius: 6px; cursor: pointer; transition: 0.2s; }
        .btn-back:hover { color: white; border-color: #475569; }
        
        .btn-save { background: #3b82f6; color: white; border: none; padding: 8px 24px; border-radius: 6px; font-weight: 700; cursor: pointer; transition: 0.2s; }
        .btn-save:hover { background: #2563eb; transform: translateY(-1px); }
        .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .btn-view { background: #1e293b; color: white; border: 1px solid #334155; padding: 8px 24px; border-radius: 6px; font-weight: 700; cursor: pointer; transition: 0.2s; }
        .btn-view:hover { background: #0f172a; }

        .invoice-page { width: 210mm; min-height: 297mm; background: white; padding: 25mm; margin-top: 40px; box-shadow: 0 20px 50px rgba(0,0,0,0.1); border-radius: 4px; display: flex; flex-direction: column; color: #000 !important; }
        .invoice-page * { color: #000 !important; }
        
        .header { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 3px solid #000; padding-bottom: 30px; margin-bottom: 50px; align-items: start; gap: 40px; width: 100%; }
        .branding { display: flex; flex-direction: column; gap: 10px; }
        .branding h1 { font-size: 28px; font-weight: 900; margin: 0; outline: none; line-height: 1.1; color: #000 !important; }
        .msme-badge { display: inline-block; background: #000; color: #fff !important; font-size: 10px; font-weight: 900; padding: 4px 10px; border-radius: 2px; align-self: flex-start; text-transform: uppercase; margin: 5px 0; }
        .msme-badge * { color: #fff !important; }
        .company-details { font-size: 13px; color: #000 !important; margin: 0; line-height: 1.6; font-weight: 600; }
        
        .meta { display: flex; flex-direction: column; align-items: flex-end; gap: 20px; text-align: right; }
        .title { font-size: 40px; font-weight: 950; margin: 0; letter-spacing: 4px; line-height: 1; color: #000 !important; }
        .meta-grid { display: flex; flex-direction: column; gap: 8px; align-items: flex-end; width: 100%; }
        .meta-item { font-size: 14px; display: flex; gap: 12px; justify-content: flex-end; width: 100%; }
        .meta-item .label { font-weight: 900; min-width: 100px; text-align: right; }
        .meta-item .val { font-weight: 900; outline: none; border-bottom: 2px solid #eee; min-width: 150px; text-align: left; padding: 0 4px; }
        .meta-item .val:hover, .meta-item .val:focus { background: #f8f8f8; border-color: #000; }

        .billing { margin-bottom: 50px; }
        .section-title { font-size: 13px; font-weight: 950; text-transform: uppercase; margin-bottom: 15px; border-bottom: 3px solid #000; display: inline-block; padding-bottom: 4px; }
        .client-name { font-size: 22px; font-weight: 950; margin: 0; outline: none; border-bottom: 2px solid #eee; display: inline-block; }
        .client-name:hover, .client-name:focus { background: #f8f8f8; border-color: #000; }
        .client-address { font-size: 15px; margin: 10px 0; outline: none; white-space: pre-wrap; line-height: 1.7; font-weight: 600; border: 2px solid transparent; padding: 4px; }
        .client-address:hover, .client-address:focus { background: #f8f8f8; border-color: #eee; border-style: dashed; }

        .subject-area { margin-bottom: 45px; font-size: 16px; border-left: 6px solid #000; padding: 12px 20px; background: #fafafa; border-radius: 0 4px 4px 0; }
        .subject-area strong { font-weight: 950; }
        .editable-subject { outline: none; font-weight: 900; border-bottom: 2px solid transparent; }
        .editable-subject:hover, .editable-subject:focus { border-color: #000; background: #fff; }

        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 40px; border: 2px solid #000; }
        .items-table th { background: #000; text-align: left; padding: 16px 12px; font-size: 13px; font-weight: 950; text-transform: uppercase; color: #fff !important; border: 1px solid #000; }
        .items-table th * { color: #fff !important; }
        .items-table td { padding: 14px 12px; font-size: 15px; border: 1px solid #000; vertical-align: top; font-weight: 700; color: #000 !important; }
        .items-table .right { text-align: right; }
        
        .items-table textarea { width: 100%; border: none; background: transparent; font-family: inherit; font-size: 15px; font-weight: 700; color: #000 !important; resize: none; outline: none; padding: 0; min-height: 45px; line-height: 1.5; }
        .items-table input { width: 100%; border: 1px solid transparent; background: #f9f9f9; border-radius: 4px; padding: 8px; font-family: inherit; font-size: 15px; font-weight: 900; color: #000 !important; text-align: right; outline: none; }
        .items-table input:hover, .items-table input:focus { border-color: #000; background: #fff; }
        .price-input { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
        .price-input span { font-weight: 900; }
        
        .btn-del { color: #ff0000 !important; background: transparent; border: none; font-size: 24px; cursor: pointer; font-weight: 950; padding: 0 10px; }
        .btn-add { background: #000; color: #fff !important; border: none; padding: 15px 30px; border-radius: 8px; width: 100%; font-weight: 900; cursor: pointer; margin-bottom: 60px; text-transform: uppercase; letter-spacing: 2px; transition: 0.2s; box-shadow: 0 4px 0 #333; }
        .btn-add:hover { background: #222; transform: translateY(-1px); box-shadow: 0 5px 0 #333; }
        .btn-add:active { transform: translateY(1px); box-shadow: 0 2px 0 #333; }

        .footer { display: grid; grid-template-columns: 1.3fr 1fr; gap: 80px; margin-top: auto; border-top: 4px solid #000; padding-top: 50px; }
        .amount-words { margin-bottom: 50px; }
        .amount-words .label { font-size: 12px; font-weight: 950; text-transform: uppercase; margin-bottom: 8px; display: block; }
        .amount-words .val { font-size: 15px; font-weight: 900; margin: 8px 0; text-transform: capitalize; border-bottom: 2px solid #eee; padding-bottom: 8px; line-height: 1.4; }
        
        .bank-details .label { font-size: 12px; font-weight: 950; margin-bottom: 15px; text-transform: uppercase; display: block; }
        .bank-details textarea { width: 100%; border: 2px solid #eee; background: #fff; padding: 20px; border-radius: 10px; font-family: inherit; font-size: 14px; color: #000 !important; outline: none; resize: none; margin-bottom: 25px; font-weight: 800; line-height: 1.7; }
        .bank-details textarea:focus { border-color: #000; background: #fafafa; }

        .upi-section { display: flex; align-items: center; gap: 25px; background: #f9f9f9; padding: 20px; border-radius: 12px; border: 3px solid #000; }
        .upi-meta { flex: 1; }
        .upi-id { font-size: 15px; font-weight: 950; margin: 6px 0; color: #000 !important; }
        .upi-scanner-wrap { width: 85px; height: 85px; background: white; border: 3px solid #000; border-radius: 8px; padding: 6px; }
        .upi-img { width: 100%; height: 100%; object-fit: contain; }

        .total-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; font-size: 16px; border-bottom: 2px solid #f0f0f0; }
        .total-row .label { font-weight: 900; }
        .total-row .val { font-weight: 950; }
        .grand-total { border-top: 4px solid #000; border-bottom: none; margin-top: 20px; padding-top: 25px; }
        .grand-total .label { font-size: 22px; font-weight: 950; }
        .grand-total .val { font-size: 32px; font-weight: 950; }
        
        .total-row .input-group { display: flex; align-items: center; background: #f0f0f0; border-radius: 8px; padding: 8px 15px; width: 120px; border: 2px solid transparent; }
        .total-row .input-group:focus-within { border-color: #000; background: #fff; }
        .total-row .input-group input { width: 100%; border: none; background: transparent; text-align: right; font-weight: 950; font-size: 16px; outline: none; color: #000 !important; }
        .total-row .input-group span { font-weight: 950; font-size: 14px; margin-left: 8px; }

        .signature-area { display: flex; justify-content: flex-end; margin-top: 100px; }
        .auth-sign { text-align: center; width: 280px; }
        .sign-line { border-bottom: 3px solid #000; margin-bottom: 12px; height: 70px; }
        .auth-sign p { font-size: 15px; font-weight: 950; margin: 0; }
        .comp-label { font-size: 12px !important; font-weight: 800 !important; margin-top: 4px !important; }

        .loading { height: 100vh; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #0f172a; }

        @media print {
          .no-print { display: none !important; }
          .editor-container { padding: 0; background: white; }
          .invoice-page { margin: 0; box-shadow: none; padding: 10mm; }
        }
      `}</style>
    </div>
  );
}
