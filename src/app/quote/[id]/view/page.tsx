'use client';

import { useEffect, useState, useMemo, use } from 'react';
import { useParams } from 'next/navigation';
import { toast, Toaster } from 'sonner';

import { numberToWords } from '@/lib/number-to-words';

export default function ClientQuotePortal({ params: rawParams }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(rawParams);
  const fallbackParams = useParams();
  const id = resolvedParams?.id || (fallbackParams?.id as string) || '';
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [signature, setSignature] = useState('');
  const [letterhead, setLetterhead] = useState('');

  const buildFallbackQuote = (lead: any) => {
    const itemsSource = Array.isArray(lead?.enquiryItems) && lead.enquiryItems.length
      ? lead.enquiryItems
      : lead?.productName
        ? [{ brand: lead.brand, productCategory: lead.productCategory || '', productName: lead.productName }]
        : [];
    const total = Number(lead?.expectedValue || 0);
    const qty = Number(lead?.quantity || itemsSource.length || 1) || 1;
    const rate = qty > 0 ? Math.round(total / qty) : total;

    const fallback = {
      quoteNo: `${lead?.id || id}`,
      quoteDate: lead?.date || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      validUntil: '30 Days from date of quotation',
      toAddress: [lead?.clientName, [lead?.city, lead?.state].filter(Boolean).join(' '), lead?.phone ? `Ph: ${lead.phone}` : '', lead?.email ? `Email: ${lead.email}` : '']
        .filter(Boolean)
        .join('\n'),
      subject: `Quotation for ${lead?.clientName || 'Enquiry'}`,
      items: itemsSource.map((item: any, index: number) => ({
        id: index + 1,
        desc: item.productName || 'Product',
        uom: 'Nos.',
        qty,
        rate,
      })),
      discountRate: 0,
      gstRate: 18,
      sections: [
        { title: 'PROJECT TECHNICAL STACK', items: ['Frontend: React.js / Next.js / TypeScript', 'Backend: Node.js / PostgreSQL / REST API', 'Infrastructure: AWS Cloud / Vercel / Docker', 'Testing: Jest / Cypress / Unit Testing'] },
        { title: 'SCOPE OF WORK', items: ['Design and Development of digital assets as per approved brief', 'SEO Optimization and technical setup', 'Social Media Management and content calendar execution', 'Monthly performance reporting and strategy refinement'] },
        { title: 'TERMS & CONDITIONS', items: ['Payment: 50% Advance / 50% on Completion', 'Delivery: Timeline subject to project milestone approval', 'Validity: 30 Days from the date of this quotation', 'Support: 3 Months technical support post-launch'] }
      ],
      companySignatory: 'Authorized Signatory',
      companyName: 'Pixelkraft Software Solutions',
      clientSignatory: 'Accepted By (Client)',
      clientStamp: 'Signature & Stamp',
      subtotal: total,
      discountAmount: 0,
      gstAmount: Math.round((total * 18) / 100),
      grandTotal: total,
      amountInWords: '',
      isFallbackQuote: true,
    };
    fallback.amountInWords = numberToWords(Math.round(total + fallback.gstAmount));
    return fallback;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Quote Data
        const qRes = await fetch(`/api/leads/${id}/quote?t=${Date.now()}`, { cache: 'no-store' });
        const qData = await qRes.json();
        let fallbackLead: any = null;

        // Always check the lead record for an uploaded PDF fallback
        const leadsRes = await fetch('/api/leads', { cache: 'no-store' });
        const leadsData = await leadsRes.json();
        fallbackLead = Array.isArray(leadsData.leads)
          ? leadsData.leads.find((l: any) => l.id === id)
          : null;

        if (!qData.error) {
          setQuote(qData);
        } else if (fallbackLead) {
          setQuote(buildFallbackQuote(fallbackLead));
        }

        if (qData.error && !fallbackLead) {
          throw new Error(qData.error);
        }

        // Fetch Active Letterhead
        const tRes = await fetch('/api/templates', { cache: 'no-store' });
        const tData = await tRes.json();
        const active = tData.templates?.find((t: any) => t.isActive);
        setLetterhead(active?.imageUrl || '');

      } catch (e) {
        console.error('Failed to load portal', e);
        toast.error('Failed to load quotation.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleAccept = async () => {
    if (!signature.trim()) return toast.error('Please enter your name to sign the quote.');
    
    try {
      setLoading(true);
      const res = await fetch(`/api/leads/${id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature })
      });
      if (res.ok) {
        setAccepted(true);
        toast.success('Quotation Accepted Successfully!');
      }
    } catch (e) {
      toast.error('Acceptance failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const paginatedProductChunks = useMemo(() => {
    if (!quote) return [];
    const chunks = []; let curr = [...quote.items];
    chunks.push(curr.splice(0, 3));
    while (curr.length > 0) { chunks.push(curr.splice(0, 7)); }
    return chunks;
  }, [quote]);

  const paginatedSectionChunks = useMemo(() => {
    if (!quote) return [];
    const chunks = []; let curr = [...quote.sections];
    while (curr.length > 0) { chunks.push(curr.splice(0, 2)); }
    return chunks;
  }, [quote]);

  if (loading && !quote) {
    return (
      <div className="skeleton-portal">
        <div className="skeleton-bar" />
        <div className="skeleton-canvas">
          <div className="skeleton-page">
            <div className="skeleton-line title" />
            <div className="skeleton-grid">
              <div className="skeleton-block" />
              <div className="skeleton-block" />
            </div>
            <div className="skeleton-line" />
            <div className="skeleton-table" />
          </div>
        </div>
        <style jsx>{`
          .skeleton-portal { background: #f8fafc; min-height: 100vh; }
          .skeleton-bar { height: 60px; background: #e2e8f0; margin-bottom: 40px; }
          .skeleton-canvas { display: flex; justify-content: center; padding: 20px; }
          .skeleton-page { 
            width: 210mm; height: 297mm; background: white; padding: 40mm 20mm;
            box-shadow: 0 10px 25px rgba(0,0,0,0.05); border-radius: 4px;
          }
          .skeleton-line { height: 20px; background: #f1f5f9; margin-bottom: 20px; border-radius: 4px; width: 100%; }
          .skeleton-line.title { height: 40px; width: 40%; margin: 0 auto 40px auto; }
          .skeleton-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
          .skeleton-block { height: 100px; background: #f1f5f9; border-radius: 4px; }
          .skeleton-table { height: 300px; background: #f8fafc; border-radius: 4px; border: 1px solid #e2e8f0; }
          @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
          .skeleton-line, .skeleton-block, .skeleton-table { animation: pulse 1.5s infinite ease-in-out; }
        `}</style>
      </div>
    );
  }

  if (!quote) return <div className="error">Quotation not found or expired.</div>;

  const totalPages = paginatedProductChunks.length + paginatedSectionChunks.length;

  return (
    <div className="client-portal">
      <Toaster position="top-center" richColors />
      
      <div className="action-bar no-print">
        <div className="bar-inner">
          <div className="status-label">
            {accepted ? (
              <span className="status-badge won">✓ Quotation Accepted</span>
            ) : (
              <span className="status-badge pending">Pending Your Approval</span>
            )}
          </div>
          <div className="actions">
            {!accepted ? (
              <div className="sign-group">
                <input 
                  type="text" 
                  className="sig-input" 
                  placeholder="Type full name to sign..."
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                />
                <button className="btn-accept" onClick={handleAccept}>Accept & Sign Quote</button>
              </div>
            ) : (
              <button className="btn-print" onClick={() => window.print()}>Download PDF</button>
            )}
          </div>
        </div>
      </div>

      <div className="document-canvas">
        {paginatedProductChunks.map((chunk, pageIdx) => (
          <div key={`prod-${pageIdx}`} className="a4-page" style={{ backgroundImage: letterhead ? `url('${letterhead}')` : 'none', backgroundColor: 'white' }}>
            <div className="page-content">
              <div className="logo-level-date"><strong>Date:</strong> {quote.quoteDate}</div>
              {pageIdx === 0 && (
                <>
                  <h2 className="doc-type-title">QUOTATION</h2>
                  <div className="header-meta-grid">
                    <div className="to-side">
                      <div className="metadata-box" style={{ minHeight: '110px' }}>
                        <div className="to-label">To,</div>
                        <div className="address-val">{quote.toAddress}</div>
                      </div>
                    </div>
                    <div className="ref-side">
                      <div className="metadata-box" style={{ minHeight: '110px' }}>
                        <div className="m-line">
                          <strong className="m-label">Quotation No:</strong> 
                          <span className="m-val">{quote.quoteNo}</span>
                        </div>
                        <div className="m-line">
                          <strong className="m-label">Date:</strong> 
                          <span className="m-val">{quote.quoteDate}</span>
                        </div>
                        <div className="m-line">
                          <strong className="m-label">Validity:</strong> 
                          <span className="m-val">{quote.validUntil}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="subject-box-clean">
                    {quote.subject}
                  </div>
                </>
              )}

              <table className="pixel-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px', textAlign: 'center' }}>SR</th>
                    <th style={{ textAlign: 'left' }}>DESCRIPTION</th>
                    <th style={{ width: '60px', textAlign: 'center' }}>UOM</th>
                    <th style={{ width: '60px', textAlign: 'center' }}>QTY</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>RATE</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>TOTAL (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {chunk.map((item: any, i: number) => {
                    const itemIdx = pageIdx === 0 ? i : (3 + (pageIdx-1)*7 + i);
                    return (
                      <tr key={i}>
                        <td style={{ textAlign: 'center' }}>{itemIdx + 1}</td>
                        <td className="desc-cell">{item.desc}</td>
                        <td style={{ textAlign: 'center' }}>{item.uom}</td>
                        <td style={{ textAlign: 'center' }}>{item.qty}</td>
                        <td style={{ textAlign: 'right' }}>₹{item.rate.toLocaleString('en-IN')}</td>
                        <td style={{ textAlign: 'right' }}>₹{(item.qty * item.rate).toLocaleString('en-IN')}</td>
                      </tr>
                    );
                  })}
                  {pageIdx === paginatedProductChunks.length - 1 && (() => {
                    const subtotal = Number(quote.items.reduce((acc: number, item: any) => acc + (Number(item.qty) * Number(item.rate)), 0));
                    const discountRate = Number(quote.discountRate || 0);
                    const discountAmount = (subtotal * discountRate) / 100;
                    const afterDiscount = subtotal - discountAmount;
                    const gstRate = Number(quote.gstRate || 0);
                    const gstAmount = (afterDiscount * gstRate) / 100;
                    const grandTotal = afterDiscount + gstAmount;
                    
                    return (
                      <>
                        <tr className="summary-row-start">
                          <td></td><td></td><td></td><td></td>
                          <td className="total-label">SUB TOTAL</td>
                          <td className="total-val">₹{subtotal.toLocaleString('en-IN')}</td>
                        </tr>
                        <tr>
                          <td></td><td></td><td></td><td></td>
                          <td className="total-label">DISCOUNT ({discountRate}%)</td>
                          <td className="total-val">- ₹{Math.round(discountAmount).toLocaleString('en-IN')}</td>
                        </tr>
                        <tr>
                          <td></td><td></td><td></td><td></td>
                          <td className="total-label">GST @ {gstRate}%</td>
                          <td className="total-val">+ ₹{Math.round(gstAmount).toLocaleString('en-IN')}</td>
                        </tr>
                        <tr className="grand-total-row">
                          <td></td><td></td><td></td><td></td>
                          <td className="total-label">GRAND TOTAL</td>
                          <td className="total-val">₹{Math.round(grandTotal).toLocaleString('en-IN')}</td>
                        </tr>
                      </>
                    );
                  })()}
                </tbody>
              </table>

          {pageIdx === paginatedProductChunks.length - 1 && (() => {
            const subtotal = Number(quote.items.reduce((acc: number, item: any) => acc + (Number(item.qty) * Number(item.rate)), 0));
            const discountRate = Number(quote.discountRate || 0);
            const discountAmount = (subtotal * discountRate) / 100;
            const afterDiscount = subtotal - discountAmount;
            const gstRate = Number(quote.gstRate || 0);
            const gstAmount = (afterDiscount * gstRate) / 100;
            const grandTotal = afterDiscount + gstAmount;
            const words = numberToWords(Math.round(grandTotal));
                return (
                  <div className="after-table-info">
                    <div className="words-block">
                      <span className="words-title">Amount in Words:</span>
                      <span className="words-text">{words}</span>
                    </div>
                    {quote.notes && (
                      <div className="notes-block">
                        <div className="notes-title">Note:</div>
                        <div className="notes-text">{quote.notes}</div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        ))}

        {paginatedSectionChunks.map((chunk, pIdx) => {
          const currentPage = paginatedProductChunks.length + pIdx + 1;
          const isFinalPage = currentPage === totalPages;
          return (
            <div key={`sec-${pIdx}`} className="a4-page" style={{ backgroundImage: letterhead ? `url('${letterhead}')` : 'none', backgroundColor: 'white' }}>
              <div className="page-content">
                <div className="logo-level-date"><strong>Date:</strong> {quote.quoteDate}</div>
                
                <div className="sections-container">
                  {chunk.map((sec: any, sIdx: number) => (
                    <div key={sIdx} className="terms-section">
                      <h4 className="section-title">{sec.title}</h4>
                      <ul className="section-list">
                        {sec.items.map((li: string, liIdx: number) => (
                          <li key={liIdx}>{li}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                {isFinalPage && (
                  <div className="signature-grid">
                    <div className="company-sign-box">
                      <div className="sig-label">{quote.companySignatory}</div>
                      <div className="sig-comp">{quote.companyName}</div>
                      <div className="sig-stamp">For PixelKraft Digital Agency</div>
                    </div>
                    <div className="client-sign-box">
                      <div className="sig-label">{quote.clientSignatory}</div>
                      {accepted ? (
                        <div className="digital-sig-block">
                          <div className="sig-name">{signature}</div>
                          <div className="sig-meta">Digitally Accepted on {new Date().toLocaleDateString()}</div>
                        </div>
                      ) : (
                        <div className="sig-stamp">Pending Client Signature</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style jsx global>{`
        body { background: #f8fafc; margin: 0; font-family: 'Inter', -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
        
        .action-bar { 
          position: sticky; top: 0; z-index: 100; 
          background: linear-gradient(to right, #0f172a, #1e293b); color: white; padding: 12px 0;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2); border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .bar-inner { max-width: 210mm; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; padding: 0 24px; }
        
        .status-badge { padding: 6px 14px; border-radius: 30px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
        .status-badge.pending { background: #fef3c7; color: #92400e; }
        .status-badge.won { background: #dcfce7; color: #166534; }

        .sign-group { display: flex; gap: 8px; align-items: center; }
        .sig-input { 
          background: rgba(255,255,255,0.05); border: 1px solid #334155; color: white; 
          padding: 8px 14px; border-radius: 6px; font-size: 12px; width: 220px;
          outline: none; transition: all 0.2s;
        }
        .sig-input:focus { border-color: #3b82f6; background: rgba(255,255,255,0.1); }
        .btn-accept { 
          background: #3b82f6; color: white; border: none; padding: 8px 18px; 
          border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer; transition: all 0.2s;
        }
        .btn-accept:hover { background: #2563eb; transform: translateY(-1px); }
        .btn-print { 
          background: white; color: #0f172a; border: 1px solid #e2e8f0; 
          padding: 8px 18px; border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer;
        }

        .document-canvas { display: flex; flex-direction: column; align-items: center; gap: 32px; padding: 48px 0; }
        .a4-page { 
          width: 210mm; height: 297mm; background-size: 100% 100%; 
          background-color: white !important; box-shadow: 0 20px 50px rgba(0,0,0,0.08); 
          position: relative; color: #000 !important; border-radius: 2px;
        }
        .page-content { padding: 48mm 20mm 58mm 20mm; height: 100%; display: flex; flex-direction: column; color: #000 !important; }
        
        .logo-level-date { position: absolute; top: 25mm; right: 20mm; font-size: 12px; font-weight: 600; color: #000 !important; }
        .doc-type-title { text-align: center; font-size: 28px; font-weight: 900; letter-spacing: 6px; margin: 0 0 30px 0; color: #000 !important; }
        
        .header-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; align-items: flex-start; }
        .to-label { font-weight: 900; font-size: 11px; text-transform: uppercase; color: #64748b !important; margin-bottom: 8px; }
        .address-val { font-size: 13px; line-height: 1.6; white-space: pre-wrap; font-weight: 700; color: #000 !important; text-align: left; }
        
        .metadata-box { border: 1.5px solid #000; padding: 16px; border-radius: 4px; background: #fff; display: flex; flex-direction: column; justify-content: center; box-shadow: 4px 4px 0px rgba(0,0,0,0.05); }
        .m-line { font-size: 12px; line-height: 2; color: #000 !important; display: flex; align-items: flex-start; gap: 0; }
        .m-label { width: 110px; flex-shrink: 0; font-weight: 800; display: inline-block; }
        .m-val { font-weight: 700; flex: 1; text-align: left; }
        
        .subject-box-clean { border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 14px 0; margin-bottom: 32px; font-size: 15px; color: #000 !important; font-weight: 800; text-align: left; text-transform: uppercase; letter-spacing: 0.5px; }
        
        .pixel-table { width: 100%; border-collapse: collapse; font-size: 11px; color: #000 !important; border: 1.5px solid #000; }
        .pixel-table th { background: #0f172a; color: white !important; padding: 12px 10px; text-align: left; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 800; border: 1.5px solid #000; font-size: 10px; }
        .pixel-table td { border: 1.5px solid #000; padding: 10px 10px; vertical-align: top; line-height: 1.4; color: #000 !important; font-weight: 600; }
        
        .center { text-align: center; }
        .right { text-align: right; }
        .desc-cell { white-space: pre-wrap; font-weight: 700; color: #000 !important; text-align: left; }
        
        .totals-table { border-top: none; }
        .totals-table td { padding: 8px 12px; }
        .total-label { text-align: right; font-weight: 800; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; background: #f8fafc; width: 140px; }
        .total-val { text-align: right; font-weight: 800; font-size: 12px; width: 120px; }
        .grand-total-row td { background: #0f172a !important; color: white !important; border-color: #000 !important; }
        .grand-total-row .total-val { font-size: 15px; }

        .after-table-info { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
        .words-block { display: flex; gap: 6px; align-items: baseline; padding: 0; background: none; border: none; }
        .words-title { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
        .words-text { font-size: 10px; font-weight: 700; color: #000; text-transform: capitalize; }
        
        .notes-block { padding: 0; border: none; background: none; }
        .notes-title { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 2px; letter-spacing: 0.5px; }
        .notes-text { font-size: 9px; font-weight: 600; color: #334155; line-height: 1.4; }
 
        .section-title { font-size: 14px; font-weight: 900; color: #0f172a !important; margin: 40px 0 16px 0; letter-spacing: 1px; border-bottom: 2px solid #0f172a; display: inline-block; padding-bottom: 4px; text-align: left; text-transform: uppercase; }
        .section-list { padding-left: 20px; margin: 0; text-align: left; }
        .section-list li { font-size: 13px; margin-bottom: 10px; color: #000 !important; line-height: 1.5; font-weight: 600; }
  
        .signature-grid { margin-top: auto; display: grid; grid-template-columns: 1fr 1fr; border-top: 2px solid #000; padding-top: 40px; }
        .sig-label { font-weight: 900; font-size: 14px; margin-bottom: 40px; color: #000 !important; text-transform: uppercase; text-align: left; }
        .sig-comp { font-size: 14px; font-weight: 800; color: #000 !important; text-align: left; }
        .sig-stamp { font-size: 11px; color: #64748b; font-style: italic; margin-top: 4px; text-align: left; }
  
        .client-sign-box { text-align: right; }
        .client-sign-box .sig-label, .client-sign-box .sig-comp, .client-sign-box .sig-stamp { text-align: right; }
        
        .digital-sig-block { text-align: right; min-width: 180px; display: inline-flex; flex-direction: column; align-items: flex-end; }
        .sig-name { font-family: 'Dancing Script', cursive; font-size: 20px; color: #000 !important; font-weight: 600; border-bottom: 1px solid #000; padding: 0 8px 2px 8px; min-width: 140px; text-align: center; }
        .sig-meta { font-size: 8px; color: #64748b; margin-top: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }

        .error { height: 100vh; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #ef4444; }

        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .document-canvas { padding: 0; gap: 0; }
          .a4-page { box-shadow: none; margin: 0; page-break-after: always; -webkit-print-color-adjust: exact; border-radius: 0; }
          @page { size: A4; margin: 0; }
        }
      `}</style>
    </div>
  );
}


