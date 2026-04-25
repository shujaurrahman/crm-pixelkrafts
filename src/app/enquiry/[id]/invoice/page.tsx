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

  // --- Editable Company Data ---
  const [companyName, setCompanyName] = useState('Pixelkraft');
  const [companyAddress, setCompanyAddress] = useState('805 Wasil Pilibhit 262001 UP India');
  const [companyEmail, setCompanyEmail] = useState('official@pixelkrafts.in');
  const [companyPhone, setCompanyPhone] = useState('+917579966178');
  const [msmeNumber, setMsmeNumber] = useState('UDYAM-UP-60-0038284');

  // --- Editable Invoice Data ---
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
          
          // Load company details if present
          if (invData.companyName) setCompanyName(invData.companyName);
          if (invData.companyAddress) setCompanyAddress(invData.companyAddress);
          if (invData.companyEmail) setCompanyEmail(invData.companyEmail);
          if (invData.companyPhone) setCompanyPhone(invData.companyPhone);
          if (invData.msmeNumber) setMsmeNumber(invData.msmeNumber);
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
      // Save company details too
      companyName,
      companyAddress,
      companyEmail,
      companyPhone,
      msmeNumber,
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
    <div className="editor-container theme-adaptive">
      <Toaster position="top-center" richColors />
      
      <div className="toolbar no-print">
        <div className="toolbar-left">
          <button className="btn-back" onClick={() => router.back()}>← Back</button>
          <span className="editor-title">Invoice Editor</span>
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
        <header className="inv-header">
          <div className="branding">
            <h1 
              contentEditable 
              suppressContentEditableWarning 
              onBlur={e => setCompanyName(e.currentTarget.innerText)}
              className="editable-company-name"
            >
              {companyName}
            </h1>
            <div className="msme-section">
              <span 
                contentEditable 
                suppressContentEditableWarning 
                onBlur={e => setMsmeNumber(e.currentTarget.innerText)}
                className="msme-id"
              >
                {msmeNumber}
              </span>
              <p className="msme-label">MSME Certified</p>
            </div>
            <div className="company-details">
              <p 
                contentEditable 
                suppressContentEditableWarning 
                onBlur={e => setCompanyAddress(e.currentTarget.innerText)}
                className="editable-detail"
              >
                {companyAddress}
              </p>
              <div className="contact-row">
                <span 
                  contentEditable 
                  suppressContentEditableWarning 
                  onBlur={e => setCompanyEmail(e.currentTarget.innerText)}
                  className="editable-detail"
                >
                  {companyEmail}
                </span>
                <span className="separator">|</span>
                <span 
                  contentEditable 
                  suppressContentEditableWarning 
                  onBlur={e => setCompanyPhone(e.currentTarget.innerText)}
                  className="editable-detail"
                >
                  {companyPhone}
                </span>
              </div>
            </div>
          </div>
          <div className="meta">
            <h2 className="title">Invoice</h2>
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

        <section className="inv-billing">
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
            <p className="signature-italic">{companyName}</p>
            <div className="sign-line"></div>
            <p>Authorized Signatory</p>
            <p className="comp-label">{companyName}</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Dancing+Script:wght@600&display=swap');

        .editor-container { 
          min-height: 100vh; 
          display: flex; 
          flex-direction: column; 
          align-items: center; 
          padding-bottom: 100px;
          font-family: 'Inter', sans-serif;
          transition: background 0.3s ease;
        }

        /* Adaptive Theme Support - Matching CRM globals.css */
        @media (prefers-color-scheme: light) {
          .theme-adaptive { background: #f9f9fb; }
          .toolbar { border-bottom: 1px solid #e5e5ea; color: #1a1a1e; }
          .btn-back, .btn-view { background: #fff; border: 1px solid #e5e5ea; color: #1a1a1e; }
          .editor-title { color: #8e8e93; }
        }
        @media (prefers-color-scheme: dark) {
          .theme-adaptive { background: #000000; }
          .toolbar { border-bottom: 1px solid #1c1c1e; color: #f5f5f7; }
          .btn-back, .btn-view { background: #000; border: 1px solid #1c1c1e; color: #f5f5f7; }
          .editor-title { color: #86868b; }
        }
        
        .toolbar { 
          width: 100%; 
          padding: 12px 40px; 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          position: sticky; 
          top: 0; 
          z-index: 100; 
          background: transparent !important;
          backdrop-filter: blur(10px);
        }
        .editor-title { font-size: 14px; font-weight: 500; margin-left: 12px; }
        .toolbar-left, .toolbar-right { display: flex; gap: 12px; align-items: center; }
        
        .btn-back, .btn-view { 
          padding: 8px 16px; 
          border-radius: 8px; 
          cursor: pointer; 
          transition: all 0.2s; 
          font-weight: 600;
          font-size: 13px;
        }
        .btn-back:hover, .btn-view:hover { opacity: 0.8; }
        
        .btn-save { 
          background: #007aff; 
          color: white; 
          border: none; 
          padding: 8px 20px; 
          border-radius: 8px; 
          font-weight: 600; 
          cursor: pointer; 
          transition: all 0.2s;
          font-size: 13px;
        }
        .btn-save:hover { opacity: 0.9; transform: translateY(-1px); }
        .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }

        .invoice-page { 
          width: 210mm; 
          min-height: 297mm; 
          background: white !important; 
          padding: 20mm; 
          margin-top: 40px; 
          box-shadow: 0 20px 50px rgba(0,0,0,0.1); 
          border-radius: 4px; 
          display: flex; 
          flex-direction: column; 
          --text: #000000 !important;
          --paper: #ffffff !important;
          --bg: #ffffff !important;
          color: #000000 !important; 
        }
        .invoice-page *, 
        .invoice-page input, 
        .invoice-page textarea, 
        .invoice-page [contenteditable],
        .invoice-page input::placeholder,
        .invoice-page textarea::placeholder { 
          color: #000000 !important; 
          opacity: 1 !important;
          -webkit-text-fill-color: #000000 !important;
          background-color: transparent !important; 
        }
        .invoice-page p, .invoice-page h1, .invoice-page h2, .invoice-page h3 { margin: 0; padding: 0; }
        
        .inv-header { 
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 40px;
          margin-bottom: 60px; 
          padding-bottom: 40px;
          border-bottom: 2px solid #f1f1f4;
          background: white !important;
          position: relative !important; /* Force non-sticky */
          top: auto !important;
        }
        
        .branding { display: flex; flex-direction: column; text-align: left; }
        .editable-company-name { 
          font-size: 24px; 
          font-weight: 800; 
          height: 32px;
          line-height: 32px;
          outline: none; 
          letter-spacing: -0.5px;
          background: transparent !important;
          display: flex;
          align-items: center;
          justify-content: flex-start;
        }
        
        .msme-section { display: flex; flex-direction: column; gap: 0; margin-top: 12px; align-items: flex-start; }
        .msme-id { font-size: 11px; font-weight: 700; color: #000000 !important; height: 18px; display: flex; align-items: center; outline: none; }
        .msme-label { font-size: 10px; font-weight: 600; color: #000000 !important; text-transform: uppercase; letter-spacing: 0.5px; height: 18px; display: flex; align-items: center; }
        
        .company-details { font-size: 13px; color: #000000 !important; margin-top: 4px; display: flex; flex-direction: column; align-items: flex-start; }
        .editable-detail { outline: none; transition: background 0.2s; height: 18px; display: flex; align-items: center; width: 100%; justify-content: flex-start; }
        .editable-detail:hover { background: #f9f9fb; }
        .contact-row { display: flex; align-items: center; gap: 8px; margin-top: 2px; height: 18px; justify-content: flex-start; width: 100%; }
        .separator { color: #e5e5ea !important; }
        
        .meta { display: flex; flex-direction: column; align-items: flex-end; text-align: right; }
        .title { 
          font-size: 24px; 
          font-weight: 800; 
          height: 32px;
          line-height: 32px;
          text-transform: uppercase;
          letter-spacing: -1px;
          background: transparent !important;
          display: flex;
          align-items: center;
          justify-content: flex-end;
        }
        .meta-grid { 
          margin-top: 12px;
          display: flex; 
          flex-direction: column; 
          gap: 0; 
          align-items: flex-end; 
        }
        .meta-item { font-size: 13px; display: flex; gap: 12px; justify-content: flex-end; height: 18px; align-items: center; }
        .meta-item .label { font-weight: 500; color: #000000 !important; }
        .meta-item .val { font-weight: 600; outline: none; text-align: right; }
        .meta-item .val:hover { background: #f9f9fb; }

        .inv-billing { 
          margin-bottom: 40px; 
          text-align: left;
        }
        .section-title { 
          font-size: 11px; 
          font-weight: 700; 
          text-transform: uppercase; 
          margin-bottom: 12px; 
          color: #000000 !important; 
          letter-spacing: 1px;
        }
        .client-name { font-size: 18px; font-weight: 700; margin: 0; outline: none; }
        .client-name:hover { background: #f9f9fb; }
        .client-address { 
          font-size: 14px; 
          margin: 6px 0; 
          outline: none; 
          white-space: pre-wrap; 
          line-height: 1.5; 
          color: #1a1a1e !important;
        }
        .client-address:hover { background: #f9f9fb; }

        .subject-area { 
          margin-bottom: 40px; 
          font-size: 14px; 
          padding: 16px; 
          background: #f9f9fb; 
          border-radius: 8px; 
          border: 1px solid #f1f1f4;
        }
        .subject-area strong { font-weight: 600; color: #8e8e93 !important; }
        .editable-subject { outline: none; font-weight: 600; }
        .editable-subject:hover { background: #fff; }

        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        .items-table th { 
          text-align: left; 
          padding: 12px; 
          font-size: 11px; 
          font-weight: 700; 
          text-transform: uppercase; 
          color: #8e8e93 !important; 
          border-bottom: 2px solid #f1f1f4;
          letter-spacing: 1px;
        }
        .items-table td { padding: 12px; font-size: 14px; border-bottom: 1px solid #f1f1f4; vertical-align: top; }
        .items-table .right { text-align: right; }
        
        .items-table textarea { 
          width: 100%; 
          border: none; 
          background: transparent; 
          font-family: inherit; 
          font-size: 14px; 
          font-weight: 500; 
          resize: none; 
          outline: none; 
          line-height: 1.5;
        }
        .items-table textarea:hover { background: #f9f9fb; }
        
        .items-table input { 
          width: 100%; 
          border: 1px solid transparent; 
          background: transparent; 
          font-family: inherit; 
          font-size: 14px; 
          font-weight: 600; 
          text-align: right; 
          outline: none; 
        }
        .items-table input:hover, .items-table input:focus { background: #f9f9fb; border-color: #e5e5ea; }
        
        .price-input { display: flex; align-items: center; justify-content: flex-end; gap: 4px; }
        .price-input span { font-weight: 600; color: #8e8e93 !important; }
        
        .btn-del { color: #ff3b30 !important; background: transparent; border: none; font-size: 18px; cursor: pointer; padding: 4px 8px; transition: all 0.2s; }
        .btn-del:hover { background: #fff1f0; border-radius: 4px; }
        
        .btn-add { 
          background: #fff; 
          color: #007aff !important; 
          border: 1px dashed #e5e5ea; 
          padding: 12px; 
          border-radius: 8px; 
          width: 100%; 
          font-weight: 600; 
          cursor: pointer; 
          margin-bottom: 40px; 
          transition: all 0.2s; 
          font-size: 13px;
        }
        .btn-add:hover { background: #f9f9fb; border-color: #007aff; }

        .footer { 
          display: grid; 
          grid-template-columns: 1.2fr 1fr; 
          gap: 60px; 
          margin-top: auto; 
          padding-top: 40px;
          border-top: 1px solid #f1f1f4;
        }
        
        .amount-words .label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #8e8e93 !important; }
        .amount-words .val { font-size: 13px; font-weight: 600; margin: 4px 0; font-style: italic; color: #1a1a1e !important; }
        
        .bank-details .label { font-size: 10px; font-weight: 700; margin-bottom: 12px; text-transform: uppercase; color: #8e8e93 !important; display: block; }
        .bank-details textarea { 
          width: 100%; 
          border: 1px solid #f1f1f4; 
          background: #f9f9fb; 
          padding: 12px; 
          border-radius: 8px; 
          font-family: inherit; 
          font-size: 12px; 
          outline: none; 
          resize: none; 
          margin-bottom: 20px; 
          line-height: 1.6;
          color: #1a1a1e !important;
        }

        .upi-section { 
          display: flex; 
          align-items: center; 
          gap: 16px; 
          background: #fff; 
          padding: 12px; 
          border-radius: 8px; 
          border: 1px solid #f1f1f4; 
        }
        .upi-meta .label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #8e8e93 !important; margin-bottom: 4px; }
        .upi-id { font-size: 13px; font-weight: 700; margin: 0; }
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
        
        .total-row .input-group { 
          display: flex; 
          align-items: center; 
          background: #f9f9fb; 
          border-radius: 6px; 
          padding: 4px 10px; 
          width: 90px; 
          border: 1px solid #e5e5ea; 
        }
        .total-row .input-group input { width: 100%; border: none; background: transparent; text-align: right; font-weight: 700; outline: none; }

        .signature-area { display: flex; justify-content: flex-end; margin-top: 60px; }
        .auth-sign { text-align: center; width: 220px; }
        .signature-italic { font-family: 'Dancing Script', cursive; font-size: 22px; color: #1a1a1e !important; margin-bottom: -8px; }
        .sign-line { border-bottom: 1px solid #e5e5ea; margin-bottom: 12px; height: 60px; }
        .auth-sign p { font-size: 13px; font-weight: 600; margin: 0; color: #8e8e93 !important; }
 
        .loading { height: 100vh; display: flex; align-items: center; justify-content: center; font-weight: 600; }
 
        @media print {
          html, body { height: auto !important; margin: 0 !important; padding: 0 !important; background: white !important; }
          .no-print { display: none !important; }
          .editor-container { padding: 0 !important; background: white !important; min-height: auto !important; }
          .invoice-page { 
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
