'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Lead } from '@/lib/crm-data';
import { toast } from 'sonner';

import { numberToWords } from '@/lib/number-to-words';

export default function QuotePage() {
  const { id } = useParams();
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [productsByBrand, setProductsByBrand] = useState<any>({});

  // --- Editable Data State ---
  const [quoteNo, setQuoteNo] = useState(`EQ-${String(id).split('-')[1] || id}-${new Date().getFullYear()}`);
  const [quoteDate, setQuoteDate] = useState(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));
  const [validUntil, setValidUntil] = useState('30 Days from date of quotation');
  
  const [toAddress, setToAddress] = useState('[Client Name]\n[Company Name / Apartment]\n[Street Address, City, State]\n[Phone/Email]');
  const [subject, setSubject] = useState('Quotation for PixelKraft Services - [Project Name]');
  
  const [notes, setNotes] = useState('Note: Project timelines are subject to timely asset delivery.');
  
  const [items, setItems] = useState<any[]>([
    { id: 1, desc: '[Product Name & Model]\n[Enter technical specifications and mounting type here.]', uom: 'Nos.', qty: 1, rate: 0 },
    { id: 2, desc: '[Accessory Name]\n[Enter accessory details and finish here.]', uom: 'Nos.', qty: 1, rate: 0 },
  ]);

  const [discountRate, setDiscountRate] = useState(0);
  const [gstRate, setGstRate] = useState(18);

  const [sections, setSections] = useState([
    { title: 'PROJECT TECHNICAL STACK', items: ['Frontend: React.js / Next.js / TypeScript', 'Backend: Node.js / PostgreSQL / REST API', 'Infrastructure: AWS Cloud / Vercel / Docker', 'Testing: Jest / Cypress / Unit Testing'] },
    { title: 'SCOPE OF WORK', items: ['Design and Development of digital assets as per approved brief', 'SEO Optimization and technical setup', 'Social Media Management and content calendar execution', 'Monthly performance reporting and strategy refinement'] },
    { title: 'TERMS & CONDITIONS', items: ['Payment: 50% Advance / 50% on Completion', 'Delivery: Timeline subject to project milestone approval', 'Validity: 30 Days from the date of this quotation', 'Support: 3 Months technical support post-launch'] }
  ]);

  const [companySignatory, setCompanySignatory] = useState('Authorized Signatory');
  const [companyName, setCompanyName] = useState('Pixelkraft Software Solutions');
  const [clientSignatory, setClientSignatory] = useState('Accepted By (Client)');
  const [clientStamp, setClientStamp] = useState('Signature & Stamp');

  // --- AI Modal State ---
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiInput, setAiInput] = useState('');

  // --- PERSISTENCE LOGIC ---
  const [letterhead, setLetterhead] = useState('');
  const [loadingTemplate, setLoadingTemplate] = useState(true);

  useEffect(() => {
    const fetchActiveTemplate = async () => {
      try {
        const res = await fetch('/api/templates', { cache: 'no-store' });
        const data = await res.json();
        const active = data.templates?.find((t: any) => t.isActive);
        if (active) setLetterhead(active.imageUrl);
        else setLetterhead(''); // Blank fallback
      } catch (e) {
        console.error('Failed to load letterhead', e);
        setLetterhead('');
      } finally {
        setLoadingTemplate(false);
      }
    };
    fetchActiveTemplate();
  }, []);


  const saveProgress = useCallback(() => {
    const quoteData = {
      quoteNo, quoteDate, validUntil, toAddress, subject, notes,
      items, discountRate, gstRate, sections,
      companySignatory, companyName, clientSignatory, clientStamp,
      subtotal, discountAmount, gstAmount, amountInWords, grandTotal
    };
    localStorage.setItem(`quote_progress_${id}`, JSON.stringify(quoteData));
  }, [id, quoteNo, quoteDate, validUntil, toAddress, subject, notes, items, discountRate, gstRate, sections, companySignatory, companyName, clientSignatory, clientStamp]);

  const syncQuoteToCRM = async () => {
    try {
      const todayStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      setQuoteDate(todayStr);

      await fetch(`/api/leads/${id}/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteNo, quoteDate: todayStr, validUntil, toAddress, subject, notes,
          items, discountRate, gstRate, sections,
          companySignatory, companyName, clientSignatory, clientStamp,
          subtotal, discountAmount, gstAmount, amountInWords,
          grandTotal: Math.round(grandTotal)
        })
      });
    } catch (e) {
      console.error('CRM Sync Failed', e);
    }
  };

  const handleManualSave = async () => {
    setIsSaving(true);
    saveProgress();
    await syncQuoteToCRM();
    setTimeout(() => { setIsSaving(false); toast.success('Quote synced to CRM successfully!'); }, 600);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const savedRaw = localStorage.getItem(`quote_progress_${id}`);
        let initialData = savedRaw ? JSON.parse(savedRaw) : null;

        const apiRes = await fetch(`/api/leads/${id}/quote`, { cache: 'no-store' });
        if (apiRes.ok) {
          const apiData = await apiRes.json();
          initialData = apiData;
        }

        if (initialData) {
          const todayStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
          setQuoteNo(initialData.quoteNo); 
          setQuoteDate(todayStr); 
          setValidUntil(initialData.validUntil);
          setToAddress(initialData.toAddress?.startsWith('To,\n') ? initialData.toAddress.replace('To,\n', '') : initialData.toAddress); 
          if (initialData.subject) setSubject(initialData.subject);
          if (initialData.notes) setNotes(initialData.notes);
          if (initialData.items) setItems(initialData.items);
          setDiscountRate(initialData.discountRate ?? 0); 
          setGstRate(initialData.gstRate ?? 18); 
          if (initialData.sections) setSections(initialData.sections);
          if (initialData.companySignatory) setCompanySignatory(initialData.companySignatory); 
          if (initialData.companyName) setCompanyName(initialData.companyName);
          if (initialData.clientSignatory) setClientSignatory(initialData.clientSignatory); 
          if (initialData.clientStamp) setClientStamp(initialData.clientStamp);
        } else {
          const res = await fetch('/api/leads');
          const data = await res.json();
          const found = data.leads.find((l: Lead) => l.id === id);
          if (found) {
            setLead(found);
            setToAddress(`${found.clientName}\n${found.city || ''} ${found.state || ''}\nPh: ${found.phone || ''}\nEmail: ${found.email || ''}`);
            setSubject(`Quotation for PixelKraft Services - ${found.clientName}`);
          }
        }

        // Fetch products
        const prodRes = await fetch('/api/products');
        const prodData = await prodRes.json();
        if (prodData.productsByBrand) {
          setProductsByBrand(prodData.productsByBrand);
          setProducts(Object.values(prodData.productsByBrand).flat());
        }
      } catch (e) { 
        console.error('Failed to load data', e);
        toast.error('Failed to load data'); 
      } finally { 
        setIsLoading(false); 
      }
    };
    fetchData();
  }, [id]);

  useEffect(() => { if (!isLoading) saveProgress(); }, [saveProgress, isLoading]);
  useEffect(() => { document.title = quoteNo; }, [quoteNo]);

  const toggleBold = () => document.execCommand('bold', false);

  const addItem = () => {
    const nextId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
    setItems([...items, { id: nextId, desc: '[New Product Name]\n[Technical details]', uom: 'Nos.', qty: 1, rate: 0 }]);
  };
  const removeItem = (id: number) => setItems(items.filter(i => i.id !== id));
  const updateItem = (id: number, field: string, value: any) => {
    const updated = items.map(i => i.id === id ? { ...i, [field]: value } : i);
    setItems(updated);

    // If description changed, check for product match
    if (field === 'desc') {
      const match = products.find(p => p.title.toLowerCase() === value.split('\n')[0].trim().toLowerCase());
      if (match) {
        let finalDesc = `${match.title}\n${match.detail}`;
        if (match.stockStatus === 'Out of Stock') {
          finalDesc += `\n[NOTE: Currently Out of Stock]`;
        } else if (match.stockStatus === 'Lead Time') {
          finalDesc += `\n[Lead Time: ${match.leadTime || 'Contact for info'}]`;
        } else if (match.stockStatus === 'Limited Stock') {
          finalDesc += `\n[Limited Stock Available]`;
        }
        
        setItems(items.map(i => i.id === id ? { ...i, desc: finalDesc, rate: match.unitPrice } : i));
        toast.success(`Matched: ${match.title} (${match.stockStatus})`);
      }
    }
  };

  const handleProductBlur = async (id: number, value: string) => {
    const title = value.split('\n')[0].trim();
    if (!title || title.startsWith('[') || title === 'New Product') return;

    const match = products.find(p => p.title.toLowerCase() === title.toLowerCase());
    if (!match) {
      // Suggest adding to library
      const item = items.find(i => i.id === id);
      const detail = value.split('\n').slice(1).join('\n').trim();
      const unitPrice = item?.rate || 0;

      if (confirm(`"${title}" is not in your library. Add it to Product Library?`)) {
        const brand = lead?.brand || 'Development';
        const newProd = { code: `CUS-${Date.now()}`, title, detail, unitPrice, category: 'General' };
        const nextProducts = { ...productsByBrand, [brand]: [newProd, ...(productsByBrand[brand] || [])] };
        
        try {
          await fetch('/api/products', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productsByBrand: nextProducts })
          });
          setProductsByBrand(nextProducts);
          setProducts(Object.values(nextProducts).flat());
          toast.success('Added to Library!');
        } catch (e) {
          toast.error('Failed to save to library');
        }
      }
    }
  };

  const addSection = () => setSections([...sections, { title: 'NEW SECTION HEADING', items: ['New list item...'] }]);
  const removeSection = (idx: number) => setSections(sections.filter((_, i) => i !== idx));
  const updateSectionTitle = (idx: number, title: string) => { const n = [...sections]; n[idx].title = title; setSections(n); };
  const addSectionItem = (idx: number) => { const n = [...sections]; n[idx].items.push('New item...'); setSections(n); };
  const removeSectionItem = (sIdx: number, iIdx: number) => { const n = [...sections]; n[sIdx].items = n[sIdx].items.filter((_, i) => i !== iIdx); setSections(n); };
  const updateSectionItem = (sIdx: number, iIdx: number, val: string) => { const n = [...sections]; n[sIdx].items[iIdx] = val; setSections(n); };

  const handlePrint = async () => {
    await syncQuoteToCRM();
    setTimeout(() => { window.print(); }, 100);
  };

  const shareOnWhatsApp = () => {
    const portalUrl = `${window.location.origin}/quote/${id}/view`;
    const message = `Hello, please find the quotation for your enquiry (${id}) here: ${portalUrl}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  const handleLogout = () => {
    document.cookie = 'crm-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    router.push('/login');
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset this quote? All unsaved changes will be lost.')) {
      localStorage.removeItem(`quote_progress_${id}`);
      window.location.reload();
    }
  };

  // --- AI MAGIC FILL LOGIC ---
  const processAIMagicFill = async () => {
    if (!aiInput.trim()) return toast.error('Please enter some details first.');
    
    toast.loading('AI Magic: Deep parsing with Enterprise AI...', { id: 'ai-fill' });
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `EXTRACT QUOTE DETAILS FROM THE PARAGRAPH BELOW.
          
          RETURN ONLY A VALID JSON OBJECT AND NOTHING ELSE. NO EXPLANATIONS. NO MARKDOWN.
          
          JSON SCHEMA:
          {
            "toAddress": "Extracted Address block",
            "discountRate": number,
            "gstRate": number,
            "items": [{"desc": "Product name and specs", "qty": number, "rate": number}],
            "sections": [{"title": "SECTION HEADING", "items": ["Point 1", "Point 2"]}]
          }
          
          PARAGRAPH: ${aiInput}`,
          leads: []
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      // Clean up the response to extract JSON
      const rawText = data.answer;
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI could not structure the data. Try again.');
      
      const parsed = JSON.parse(jsonMatch[0]);

      // Apply to state
      if (parsed.toAddress) setToAddress(parsed.toAddress);
      if (parsed.discountRate !== undefined) setDiscountRate(parsed.discountRate);
      if (parsed.gstRate !== undefined) setGstRate(parsed.gstRate);
      
      if (Array.isArray(parsed.items)) {
        setItems(parsed.items.map((it: any, i: number) => ({
          id: Date.now() + i,
          desc: it.desc || 'Product',
          uom: 'Nos.',
          qty: it.qty || 1,
          rate: it.rate || 0
        })));
      }

      if (Array.isArray(parsed.sections)) {
        setSections(parsed.sections);
      }

      toast.success('Magic Fill Complete!', { id: 'ai-fill' });
      setIsAIModalOpen(false);
      setAiInput('');

    } catch (error) {
      console.error('AI Error:', error);
      toast.error('AI failed to parse. Please check your text.', { id: 'ai-fill' });
    }
  };

  // --- Calculations ---
  const subtotal = useMemo(() => items.reduce((acc, item) => acc + (item.qty * (item.rate || 0)), 0), [items]);
  const discountAmount = useMemo(() => (subtotal * discountRate) / 100, [subtotal, discountRate]);
  const afterDiscount = useMemo(() => subtotal - discountAmount, [subtotal, discountAmount]);
  const gstAmount = useMemo(() => (afterDiscount * gstRate) / 100, [afterDiscount, gstRate]);
  const grandTotal = useMemo(() => afterDiscount + gstAmount, [afterDiscount, gstAmount]);
  const amountInWords = useMemo(() => numberToWords(grandTotal), [grandTotal]);

  // --- Pagination ---
  const paginatedProductChunks = useMemo(() => {
    const chunks = []; let curr = [...items];
    chunks.push(curr.splice(0, 3));
    while (curr.length > 0) { chunks.push(curr.splice(0, 7)); }
    return chunks;
  }, [items]);

  const paginatedSectionChunks = useMemo(() => {
    const chunks = []; let curr = [...sections];
    while (curr.length > 0) { chunks.push(curr.splice(0, 2)); }
    return chunks;
  }, [sections]);

  const totalPages = paginatedProductChunks.length + paginatedSectionChunks.length;

  if (isLoading || loadingTemplate) return <div className="loading">Optimizing Enterprise Quote Engine...</div>;

  return (
    <div className="quote-editor">
      {/* --- AI MAGIC MODAL --- */}
      {isAIModalOpen && (
        <div className="ai-modal-overlay">
          <div className="ai-modal minimal">
            <div className="ai-modal-header">
              <div className="ai-title-wrap">
                <span className="ai-sparkle">✨</span>
                <h3>AI MAGIC FILL</h3>
              </div>
              <button className="close-ai-btn" onClick={() => setIsAIModalOpen(false)}>×</button>
            </div>
            <div className="ai-modal-body">
              <div className="ai-input-container">
                <textarea 
                  autoFocus
                  placeholder="Paste quote details (e.g. '5 tracks of 1m at 1500 each for Elite Residences...')"
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                />
                <div className="ai-input-hint">AI will extract client, products, and prices automatically.</div>
              </div>
              
              <div className="ai-actions-minimal">
                <button className="ai-btn-secondary" onClick={() => setIsAIModalOpen(false)}>Cancel</button>
                <button className="ai-btn-primary" onClick={processAIMagicFill}>
                  Generate Quote Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- PREMIUM INLINE TOOLBAR --- */}
      <div className="no-print modern-toolbar">
        <div className="toolbar-left">
          <button className="cool-back-btn" onClick={() => router.back()}><span>←</span> Back</button>
          <div className="brand-indicator"><span className="dot"></span><h2>PIXELKRAFT DIGITAL</h2></div>
        </div>

        <div className="toolbar-center">
          <button className="ai-magic-btn" onClick={() => setIsAIModalOpen(true)}>
            ✨ AI Magic Fill
          </button>
          <div className="v-divider"></div>
          <div className="rich-text-controls">
            <button className="bold-btn" onClick={toggleBold} title="Toggle Bold">B</button>
          </div>
          <div className="v-divider"></div>
          <div className="inline-tax-control">
            <label>Discount</label>
            <div className="input-with-symbol">
              <input type="number" value={discountRate || ''} onChange={e => setDiscountRate(Number(e.target.value))} placeholder="0" />
              <span>%</span>
            </div>
          </div>
          <div className="inline-tax-control">
            <label>GST</label>
            <div className="input-with-symbol">
              <input type="number" value={gstRate || ''} onChange={e => setGstRate(Number(e.target.value))} placeholder="0" />
              <span>%</span>
            </div>
          </div>
        </div>

        <div className="toolbar-right">
          <button className="reset-btn" onClick={handleReset} title="Reset to default">Reset</button>
          <button className={`save-btn ${isSaving ? 'saving' : ''}`} onClick={handleManualSave}>
            {isSaving ? 'Saving...' : 'Save Progress'}
          </button>
          <button className="print-action-btn" onClick={handlePrint}>Print Quote</button>
            <button className="btn" onClick={() => router.back()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Back
            </button>
            <button className="btn danger" onClick={handleLogout}>
              Sign Out
            </button>
          <button className="whatsapp-btn" onClick={shareOnWhatsApp}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.7 8.38 8.38 0 0 1 3.8.9L21 3l-1.5 5.5Z"/></svg>
            WhatsApp Share
          </button>
        </div>
      </div>

      <div className="document-canvas">
        {paginatedProductChunks.map((chunk, pageIdx) => (
          <div key={`prod-${pageIdx}`} className="a4-page" style={{ backgroundImage: letterhead ? `url('${letterhead}')` : 'none', backgroundColor: 'white' }}>
            <div className="page-content">
              <div className="logo-level-date"><strong>Date:</strong> {quoteDate}</div>
              {pageIdx === 0 && (
                <>
                  <h2 className="doc-type-title">QUOTATION</h2>
                  <div className="header-meta-grid">
                    <div className="to-side">
                      <div className="to-label">To,</div>
                      <div className="editable address-val" contentEditable suppressContentEditableWarning onBlur={e => setToAddress(e.currentTarget.innerText)}>{toAddress}</div>
                    </div>
                    <div className="ref-side">
                      <div className="meta-justify-box">
                        <div className="m-line"><strong>Quotation No:</strong> <span contentEditable suppressContentEditableWarning onBlur={e => setQuoteNo(e.currentTarget.innerText)}>{quoteNo}</span></div>
                        <div className="m-line"><strong>Date:</strong> <span>{quoteDate}</span></div>
                        <div className="m-line"><strong>Validity:</strong> <span contentEditable suppressContentEditableWarning onBlur={e => setValidUntil(e.currentTarget.innerText)}>{validUntil}</span></div>
                      </div>
                    </div>
                  </div>
                  <div className="subject-box-clean">
                    <div className="editable sub-text-bold" contentEditable suppressContentEditableWarning onBlur={e => setSubject(e.currentTarget.innerText)}>{subject}</div>
                  </div>
                </>
              )}

              <div className="page-indicator">Page {pageIdx + 1} of {totalPages}</div>
              <table className="pixel-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>SR</th>
                    <th>DESCRIPTION OF PRODUCTS</th>
                    <th style={{ width: 65 }}>UOM</th>
                    <th style={{ width: 65 }}>QTY</th>
                    <th style={{ width: 110 }}>RATE</th>
                    <th style={{ width: 130 }}>TOTAL (₹)</th>
                    <th className="no-print" style={{ width: 30 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {chunk.map((item, idx) => {
                    const srNo = paginatedProductChunks.slice(0, pageIdx).reduce((acc, c) => acc + c.length, 0) + idx + 1;
                    return (
                      <tr key={item.id}>
                        <td className="center">{srNo}</td>
                        <td style={{ position: 'relative' }}>
                          <input 
                            className="editable-area"
                            value={item.desc}
                            onChange={e => updateItem(item.id, 'desc', e.target.value)}
                            onBlur={e => handleProductBlur(item.id, e.target.value)}
                            list="products-datalist"
                            autoComplete="off"
                          />
                        </td>
                        <td className="center"><div contentEditable suppressContentEditableWarning onBlur={e => updateItem(item.id, 'uom', e.currentTarget.innerText)}>{item.uom}</div></td>
                        <td className="center"><input type="number" value={item.qty || ''} onChange={e => updateItem(item.id, 'qty', Number(e.target.value))} placeholder="0" /></td>
                        <td align="right"><input type="number" value={item.rate || ''} onChange={e => updateItem(item.id, 'rate', Number(e.target.value))} placeholder="0" /></td>
                        <td align="right">₹{(item.qty * (item.rate || 0)).toLocaleString('en-IN')}</td>
                        <td className="no-print center"><button className="del-x" onClick={() => removeItem(item.id)}>×</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {pageIdx === paginatedProductChunks.length - 1 && (
                <>
                  <div className="no-print row-actions"><button className="yellow-action-btn" onClick={addItem}>+ Add Product Row</button></div>
                  <div className="summary-block">
                    <div className="sum-row"><span className="sum-label">SUB TOTAL:</span> <span className="sum-val">₹{subtotal.toLocaleString('en-IN')}</span></div>
                    <div className="sum-row"><span className="sum-label">DISCOUNT ({discountRate}%):</span> <span className="sum-val">- ₹{discountAmount.toLocaleString('en-IN')}</span></div>
                    <div className="sum-row"><span className="sum-label">AFTER DISCOUNT:</span> <span className="sum-val">₹{afterDiscount.toLocaleString('en-IN')}</span></div>
                    <div className="sum-row"><span className="sum-label">GST @ {gstRate}%:</span> <span className="sum-val">₹{gstAmount.toLocaleString('en-IN')}</span></div>
                    <div className="sum-row grand-total-line"><span className="sum-label">GRAND TOTAL:</span> <span className="sum-val">₹{Math.round(grandTotal).toLocaleString('en-IN')}</span></div>
                  </div>
                  <div className="amount-in-words"><strong>Amount in Words:</strong> {amountInWords}</div>
                  <div className="note-box" contentEditable suppressContentEditableWarning onBlur={e => setNotes(e.currentTarget.innerText)}><strong>Note:</strong> {notes}</div>
                </>
              )}
            </div>
          </div>
        ))}

        {paginatedSectionChunks.map((secChunk, pIdx) => {
          const currentPage = paginatedProductChunks.length + pIdx + 1;
          const isFinalPage = currentPage === totalPages;
          return (
            <div key={`sec-${pIdx}`} className="a4-page" style={{ backgroundImage: letterhead ? `url('${letterhead}')` : 'none', backgroundColor: 'white' }}>
              <div className="page-content">
                <div className="logo-level-date"><strong>Date:</strong> {quoteDate}</div>
                <div className="page-indicator">Page {currentPage} of {totalPages}</div>
                <div className="dynamic-sections-list">
                  {secChunk.map((section, chunkIdx) => {
                    const globalSecIdx = pIdx * 2 + chunkIdx;
                    return (
                      <div key={`g-sec-${globalSecIdx}`} className="section-block">
                        <div className="section-header-row">
                          <h3 className="section-header-editable" contentEditable suppressContentEditableWarning onBlur={e => updateSectionTitle(globalSecIdx, e.currentTarget.innerText)}>{section.title}</h3>
                          <button className="no-print del-section-btn" onClick={() => removeSection(globalSecIdx)}>Remove</button>
                        </div>
                        <ul className="editable-list">
                          {section.items.map((item, iIdx) => (
                            <li key={iIdx} className="list-item-wrapper">
                              <div className="item-val-editable" contentEditable suppressContentEditableWarning onBlur={e => updateSectionItem(globalSecIdx, iIdx, e.currentTarget.innerText)}>{item}</div>
                              <button className="no-print del-li" onClick={() => removeSectionItem(globalSecIdx, iIdx)}>−</button>
                            </li>
                          ))}
                          <button className="no-print add-item-btn" onClick={() => addSectionItem(globalSecIdx)}>+</button>
                        </ul>
                      </div>
                    );
                  })}
                </div>
                {isFinalPage && (
                  <>
                    <div className="no-print add-section-container"><button className="yellow-action-btn large" onClick={addSection}>+ Add New Section Heading</button></div>
                    <div className="boxed-signature-grid">
                      <div className="company-sign-box">
                        <div className="sig-label-editable" contentEditable suppressContentEditableWarning onBlur={e => setCompanySignatory(e.currentTarget.innerText)}>{companySignatory}</div>
                        <div className="sig-comp-editable" contentEditable suppressContentEditableWarning onBlur={e => setCompanyName(e.currentTarget.innerText)}>{companyName}</div>
                      </div>
                      <div className="client-sign-box">
                        <div className="sig-label-editable" contentEditable suppressContentEditableWarning onBlur={e => setClientSignatory(e.currentTarget.innerText)}>{clientSignatory}</div>
                        <div className="sig-stamp-editable" contentEditable suppressContentEditableWarning onBlur={e => setClientStamp(e.currentTarget.innerText)}>{clientStamp}</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap');
        ::selection { background: rgba(37, 99, 235, 0.15); color: #000; }
        .quote-editor { background: #000; min-height: 100vh; font-family: 'Montserrat', sans-serif; padding-bottom: 100px; color: #000; }
        
        .modern-toolbar { position: sticky; top: 0; background: #000; border-bottom: 1px solid #1e293b; color: white; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; z-index: 2000; }
        .toolbar-left { display: flex; align-items: center; gap: 20px; }
        .cool-back-btn { background: #000; border: 1px solid #1e293b; color: #94a3b8; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: 0.2s; }
        .cool-back-btn:hover { border-color: #3b82f6; color: white; }
        .brand-indicator { display: flex; align-items: center; gap: 10px; }
        .brand-indicator .dot { width: 8px; height: 8px; background: #2563eb; border-radius: 50%; box-shadow: 0 0 10px #2563eb; }
        .brand-indicator h2 { font-size: 14px; font-weight: 900; letter-spacing: 2px; margin: 0; color: #f8fafc; }
        
        .toolbar-center { display: flex; align-items: center; gap: 20px; }
        .ai-magic-btn { background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 800; font-size: 13px; cursor: pointer; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3); transition: 0.2s; }
        .ai-magic-btn:hover { background: #1d4ed8; transform: translateY(-1px); }
        .bold-btn { background: #000; border: 1px solid #1e293b; color: white; width: 32px; height: 32px; border-radius: 6px; font-weight: 900; cursor: pointer; }
        .bold-btn:hover { border-color: #3b82f6; }
        .v-divider { width: 1px; height: 24px; background: #1e293b; }
        
        .inline-tax-control { display: flex; align-items: center; gap: 10px; }
        .inline-tax-control label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; }
        .input-with-symbol { display: flex; align-items: center; background: #000; border: 1px solid #1e293b; border-radius: 6px; padding: 4px 8px; }
        .input-with-symbol input { background: transparent; border: none; color: white; width: 40px; font-size: 13px; font-weight: 700; outline: none; text-align: center; }
        
        .toolbar-right { display: flex; align-items: center; gap: 12px; }
        .reset-btn { background: transparent; color: #64748b; border: 1px solid #1e293b; padding: 10px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: 0.2s; font-size: 13px; }
        .reset-btn:hover { border-color: #ef4444; color: #ef4444; background: rgba(239, 68, 68, 0.05); }
        .save-btn { background: #000; color: #3b82f6; border: 1px solid #1e293b; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; transition: 0.2s; }
        .save-btn:hover { border-color: #3b82f6; background: rgba(37, 99, 235, 0.05); }
        .print-action-btn { background: #2563eb; color: white; border: none; padding: 10px 24px; border-radius: 8px; font-weight: 800; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4); }
        .print-action-btn:hover { background: #cbd5e1; }
        .whatsapp-btn { background: #22c55e; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; display: flex; align-items: center; transition: all 0.2s; }
        .whatsapp-btn:hover { background: #16a34a; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3); }

        /* --- CRM Themed Modal --- */
        .ai-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 5000; }
        .ai-modal { background: white; border-radius: 12px; width: 550px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); border: 1px solid #e2e8f0; }
        .ai-modal-header { background: #f8fafc; padding: 16px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
        .ai-modal-header h3 { margin: 0; color: #1e293b; font-size: 16px; font-weight: 700; }
        .close-ai-btn { background: none; border: none; color: #64748b; font-size: 24px; cursor: pointer; line-height: 1; }
        .ai-modal-body { padding: 24px; }
        .ai-modal-body p { color: #64748b; font-size: 13px; margin-bottom: 16px; line-height: 1.5; }
        .ai-modal-body textarea { width: 100%; height: 180px; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; color: #1e293b; font-family: inherit; font-size: 14px; outline: none; transition: border-color 0.2s; }
        .ai-modal-body textarea:focus { border-color: #2563eb; ring: 2px solid rgba(37, 99, 235, 0.1); }
        .ai-modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px; }
        .ai-cancel-btn { background: white; color: #475569; border: 1px solid #cbd5e1; padding: 8px 16px; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer; }
        .ai-process-btn { background: #2563eb; color: white; border: none; padding: 8px 20px; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer; }
        .ai-process-btn:hover { background: #1d4ed8; }

        .document-canvas { display: flex; flex-direction: column; align-items: center; gap: 40px; margin-top: 50px; }
        .a4-page { width: 210mm; height: 297mm; background-size: 100% 100%; background-repeat: no-repeat; background-color: white; box-shadow: 0 0 50px rgba(0,0,0,0.3); position: relative; color: #000 !important; }
        .a4-page * { color: #000 !important; }
        .pixel-table th, .pixel-table th * { color: #fff !important; }
        .page-content { padding: 48mm 18mm 58mm 18mm; height: 100%; display: flex; flex-direction: column; }
        .logo-level-date { position: absolute; top: 25mm; right: 20mm; font-size: 12px; font-weight: 600; }
        .doc-type-title { text-align: center; font-size: 24px; font-weight: 700; letter-spacing: 4px; margin: 0 0 25px; }

        .header-meta-grid { display: grid; grid-template-columns: 1fr 1fr; border: 2.5px solid #000; margin-bottom: 25px; }
        .to-side { padding: 15px; border-right: 2.5px solid #000; }
        .ref-side { padding: 15px; display: flex; align-items: center; justify-content: center; }
        .meta-justify-box { width: 100%; display: flex; flex-direction: column; gap: 6px; padding: 0 20px; }
        .m-line { display: grid; grid-template-columns: 110px 1fr; font-size: 13px; }
        .to-label { font-size: 14px; font-weight: 800; margin-bottom: 8px; }
        .address-val { font-size: 13.5px; line-height: 1.6; font-weight: 500; }
        .editable { outline: none; border: 1px dashed transparent; transition: 0.1s; white-space: pre-wrap; color: #000 !important; }
        .editable:hover { background: #fef9c3; border-color: #facc15; }
        .subject-box-clean { margin-bottom: 30px; }
        .sub-text-bold { font-weight: 800; font-size: 15px; }
        .page-indicator { font-size: 10px; font-weight: 700; color: #9ca3af; margin-bottom: 10px; text-transform: uppercase; }

        .pixel-table { width: 100%; border-collapse: collapse; border: 2.5px solid #000; margin-bottom: 15px; table-layout: fixed; }
        .pixel-table th { background: #1e3a8a; color: white; padding: 12px 8px; font-size: 10.5px; font-weight: 900; border: 2.5px solid #000; }
        .pixel-table td { border: 2.5px solid #000; padding: 10px; font-size: 13px; vertical-align: middle; font-weight: 600; }
        .pixel-table td.center { text-align: center; padding-left: 0 !important; padding-right: 0 !important; }
        .pixel-table input { width: 100%; border: none; font-size: 13px; font-family: inherit; font-weight: 800; outline: none; background: transparent; color: #000; }
        .del-x { color: #ef4444; background: none; border: none; font-size: 18px; cursor: pointer; display: inline-block; width: 100%; text-align: center; }
        
        .yellow-action-btn { background: #facc15; color: #000; border: 1px solid #eab308; padding: 6px 14px; border-radius: 4px; font-size: 11px; font-weight: 800; cursor: pointer; }
        .yellow-action-btn:hover { background: #eab308; }
        .yellow-action-btn.large { padding: 10px 20px; font-size: 13px; margin-top: 15px; }
        .summary-block { width: 280px; margin-left: auto; display: flex; flex-direction: column; gap: 4px; margin-top: 20px; margin-bottom: 30px; }
        .sum-row { display: flex; justify-content: space-between; font-size: 13.5px; }
        .sum-label { font-weight: 800; color: #374151; }
        .sum-val { font-weight: 900; color: #000; }
        .grand-total-line { border-top: 2.5px solid #000; padding-top: 6px; margin-top: 6px; font-size: 15px; color: #000; }
        .amount-in-words { margin-top: 15px; font-size: 11px; font-style: italic; color: #374151; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 15px; }
        .note-box { font-size: 11px; outline: none; line-height: 1.5; font-weight: 500; }

        .section-block { margin-top: 30px; }
        .section-header-row { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #000; margin-bottom: 12px; }
        .section-header-editable { font-size: 16px; font-weight: 800; margin: 0; outline: none; }
        .del-section-btn { background: none; border: none; color: #ef4444; font-size: 11px; cursor: pointer; font-weight: 600; }
        .editable-list { list-style: none; padding: 0; margin: 0; }
        .list-item-wrapper { display: flex; gap: 10px; margin-bottom: 6px; }
        .list-item-wrapper:before { content: "✓ "; font-weight: 900; color: #000; }
        .item-val-editable { flex: 1; font-size: 13.5px; font-weight: 500; outline: none; }
        .del-li { background: none; border: none; color: #ef4444; cursor: pointer; font-size: 18px; }
        .add-item-btn { background: #fef9c3; border: 1px solid #fde047; border-radius: 50%; width: 22px; height: 22px; cursor: pointer; margin-top: 5px; color: #854d0e; font-weight: 900; }
        
        .boxed-signature-grid { margin-top: auto; display: grid; grid-template-columns: 1fr 1fr; border: 2.5px solid #000; }
        .company-sign-box { text-align: left; padding: 20px; border-right: 2.5px solid #000; }
        .client-sign-box { text-align: right; padding: 20px; }
        .sig-label-editable { font-size: 15px; font-weight: 800; margin-bottom: 40px; outline: none; }
        .sig-comp-editable, .sig-stamp-editable { font-size: 13px; font-weight: 700; color: #334155; outline: none; }

        @media print {
          .no-print { display: none !important; }
          .quote-editor { background: white !important; padding: 0 !important; }
          .document-canvas { margin: 0 !important; gap: 0 !important; display: block !important; }
          .a4-page { box-shadow: none !important; margin: 0 !important; page-break-after: always !important; -webkit-print-color-adjust: exact !important; }
          .a4-page:last-child { page-break-after: avoid !important; }
          @page { size: A4; margin: 0; }
          .pixel-table th { background-color: #111827 !important; color: white !important; }
          .grand-total-line { border-top: 2.5px solid #000 !important; }
        }

        .ai-modal.minimal {
          width: 480px;
          border-radius: 20px;
          padding: 8px;
          background: #fff;
        }
        .ai-title-wrap { display: flex; align-items: center; gap: 10px; }
        .ai-sparkle { font-size: 20px; }
        .ai-modal.minimal .ai-modal-header { border: none; padding: 12px 16px; }
        .ai-modal.minimal .ai-modal-header h3 { font-size: 14px; letter-spacing: 1px; color: #1e293b; }
        .ai-input-container { padding: 0 16px; }
        .ai-input-container textarea {
          width: 100%;
          min-height: 140px;
          border: 1px solid #f1f5f9;
          background: #f8fafc;
          border-radius: 12px;
          padding: 16px;
          font-size: 15px;
          line-height: 1.6;
          resize: none;
          outline: none;
          transition: all 0.2s;
        }
        .ai-input-container textarea:focus {
          background: #fff;
          border-color: #3b82f6;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }
        .ai-input-hint { font-size: 11px; color: #94a3b8; margin-top: 8px; }
        .ai-actions-minimal { display: flex; justify-content: flex-end; gap: 12px; padding: 16px; margin-top: 8px; }
        .ai-btn-secondary { background: transparent; border: none; color: #64748b; font-weight: 600; font-size: 13px; cursor: pointer; padding: 10px 16px; border-radius: 8px; }
        .ai-btn-primary { background: #1e293b; color: white; border: none; font-weight: 700; font-size: 13px; cursor: pointer; padding: 10px 24px; border-radius: 10px; transition: all 0.2s; }
        .ai-btn-primary:hover { background: #000; transform: translateY(-1px); }

        .editable-area {
          width: 100%;
          border: none;
          background: transparent;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.6;
          resize: vertical;
          min-height: 40px;
          outline: none;
          padding: 0;
          color: #000;
          overflow: hidden;
        }
        .editable-area:hover, .editable-area:focus {
          background: #fef9c3;
        }
        .loading { height: 100vh; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: 900; }
      `}</style>
      <datalist id="products-datalist">
        {products.map(p => (
          <option key={p.code} value={p.title}>
            {p.detail} | {p.stockStatus}{p.stockStatus === 'Lead Time' ? ` (${p.leadTime})` : ''} | ₹{p.unitPrice}
          </option>
        ))}
      </datalist>
    </div>
  );
}
