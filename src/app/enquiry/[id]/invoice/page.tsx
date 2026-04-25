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
  const [bankDetails, setBankDetails] = useState('Account Name: Pixelkraft Software Solutions\nBank: HDFC Bank\nIFSC: HDFC0001234');

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
          setToAddress([found.city, found.state, found.country].filter(Boolean).join(', '));
          setItems([{
            id: 1,
            desc: found.productName || 'General Services',
            qty: found.quantity || 1,
            rate: Math.round(found.expectedValue / (found.quantity || 1)),
            total: found.expectedValue
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
              <h4 className="label">Payment Info:</h4>
              <textarea 
                value={bankDetails} 
                onChange={e => setBankDetails(e.target.value)}
                rows={4}
              />
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

        .invoice-page { width: 210mm; min-height: 297mm; background: white; padding: 15mm; margin-top: 40px; box-shadow: 0 20px 50px rgba(0,0,0,0.1); border-radius: 4px; display: flex; flex-direction: column; }
        
        .header { display: flex; justify-content: space-between; border-bottom: 2.5px solid #0f172a; padding-bottom: 20px; margin-bottom: 40px; }
        .branding h1 { font-size: 24px; font-weight: 900; color: #0f172a; margin: 0; outline: none; }
        .msme-badge { display: inline-block; background: #fef3c7; color: #92400e; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 4px; margin: 4px 0; text-transform: uppercase; }
        .company-details { font-size: 12px; color: #64748b; margin: 4px 0; }
        
        .title { font-size: 32px; font-weight: 900; color: #0f172a; margin: 0 0 16px 0; text-align: right; letter-spacing: 2px; }
        .meta-grid { display: flex; flex-direction: column; gap: 4px; align-items: flex-end; }
        .meta-item { font-size: 13px; display: flex; gap: 8px; }
        .meta-item .label { font-weight: 700; color: #64748b; }
        .meta-item .val { font-weight: 700; color: #0f172a; outline: none; }

        .billing { margin-bottom: 40px; }
        .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 8px; }
        .client-name { font-size: 18px; font-weight: 800; color: #0f172a; margin: 0; outline: none; }
        .client-address { font-size: 13px; color: #475569; margin: 4px 0; outline: none; white-space: pre-wrap; }

        .subject-area { margin-bottom: 30px; font-size: 14px; border-left: 4px solid #0f172a; padding-left: 12px; }
        .editable-subject { outline: none; font-weight: 600; }

        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .items-table th { background: #f8fafc; text-align: left; padding: 12px; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #0f172a; }
        .items-table td { padding: 10px; font-size: 14px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
        .items-table .right { text-align: right; }
        
        .items-table textarea { width: 100%; border: none; background: transparent; font-family: inherit; font-size: 14px; font-weight: 600; color: #334155; resize: none; outline: none; padding: 0; }
        .items-table input { width: 100%; border: none; background: #f8fafc; border-radius: 4px; padding: 4px 8px; font-family: inherit; font-size: 14px; font-weight: 700; color: #0f172a; text-align: right; outline: none; }
        .price-input { display: flex; align-items: center; justify-content: flex-end; gap: 4px; }
        .price-input span { font-weight: 700; color: #64748b; }
        
        .btn-del { color: #ef4444; background: transparent; border: none; font-size: 20px; cursor: pointer; }
        .btn-add { background: #f1f5f9; color: #475569; border: 1px dashed #cbd5e1; padding: 8px 16px; border-radius: 6px; width: 100%; font-weight: 700; cursor: pointer; margin-bottom: 40px; }
        .btn-add:hover { background: #e2e8f0; color: #1e293b; }

        .footer { display: grid; grid-template-columns: 1.2fr 1fr; gap: 60px; margin-top: auto; border-top: 2px solid #0f172a; padding-top: 30px; }
        .amount-words { margin-bottom: 30px; }
        .amount-words .label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; }
        .amount-words .val { font-size: 13px; font-weight: 700; color: #0f172a; margin: 4px 0; text-transform: capitalize; }
        
        .bank-details .label { font-size: 10px; font-weight: 800; margin-bottom: 8px; color: #0f172a; text-transform: uppercase; }
        .bank-details textarea { width: 100%; border: 1px solid #f1f5f9; background: #f8fafc; padding: 12px; border-radius: 8px; font-family: inherit; font-size: 12px; color: #475569; outline: none; resize: none; }

        .total-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 14px; }
        .total-row .label { font-weight: 700; color: #64748b; }
        .total-row .val { font-weight: 800; color: #0f172a; }
        .grand-total { border-top: 2px solid #0f172a; margin-top: 10px; padding-top: 16px; }
        .grand-total .label { font-size: 18px; font-weight: 900; color: #0f172a; }
        .grand-total .val { font-size: 24px; font-weight: 900; color: #0f172a; }
        
        .total-row .input-group { display: flex; align-items: center; background: #f8fafc; border-radius: 6px; padding: 4px 8px; width: 80px; }
        .total-row .input-group input { width: 100%; border: none; background: transparent; text-align: right; font-weight: 800; font-size: 14px; outline: none; }
        .total-row .input-group span { font-weight: 700; color: #64748b; font-size: 12px; margin-left: 4px; }

        .signature-area { display: flex; justify-content: flex-end; margin-top: 60px; }
        .auth-sign { text-align: center; width: 220px; }
        .sign-line { border-bottom: 1.5px solid #0f172a; margin-bottom: 8px; height: 40px; }
        .auth-sign p { font-size: 12px; font-weight: 700; margin: 0; }
        .comp-label { font-size: 10px !important; color: #64748b; }

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
