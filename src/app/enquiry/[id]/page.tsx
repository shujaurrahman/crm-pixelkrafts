'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { type Lead } from '../../../lib/crm-data';
import { toast } from 'sonner';

export default function EnquiryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [lead, setLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quotePreviewUrl, setQuotePreviewUrl] = useState('');

  // Sync theme from localStorage so the detail page matches the dashboard
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const attr = document.documentElement.getAttribute('data-theme');
      if (attr === 'dark' || attr === 'light') return attr as 'light' | 'dark';
      const saved = localStorage.getItem('crm-theme');
      if (saved === 'dark' || saved === 'light') return saved as 'light' | 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('crm-theme', theme);
  }, [theme]);

  useEffect(() => {
    const fetchLead = async () => {
      try {
        const res = await fetch('/api/leads');
        const data = await res.json();
        const found = data.leads.find((l: Lead) => l.id === id);
        if (found) {
          setLead(found);
          setQuotePreviewUrl(found.quoteUrl || '');
        }
        else { toast.error('Enquiry not found'); router.push('/'); }
      } catch { toast.error('Failed to load enquiry details'); }
      finally { setIsLoading(false); }
    };
    fetchLead();
  }, [id, router]);

  const handleLogout = () => {
    document.cookie = 'crm-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    router.push('/login');
  };

  const money = (val: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

  const fmtDate = (d?: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };



  const removeEnquiryItem = async (index: number) => {
    if (!lead || !confirm('Are you sure you want to remove this item?')) return;
    
    try {
      const currentItems = Array.isArray(lead.enquiryItems) && lead.enquiryItems.length
        ? lead.enquiryItems
        : lead.productName || lead.productCategory
          ? [{ brand: lead.brand, productCategory: lead.productCategory, productName: lead.productName }]
          : [];

      if (!currentItems.length) {
        toast.error('No enquiry items to remove');
        return;
      }

      const nextItems = currentItems.filter((_, i) => i !== index);
      const primary = nextItems[0] || { brand: lead.brand, productCategory: '', productName: '' };
      const res = await fetch('/api/leads');
      const data = await res.json();
      const updated = (data.leads as Lead[]).map((l) =>
        l.id === lead.id
          ? {
              ...l,
              brand: primary.brand,
              productCategory: primary.productCategory,
              productName: primary.productName,
              enquiryItems: nextItems,
            }
          : l
      );
      
      await fetch('/api/leads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: updated }),
      });
      
      setLead(prev => prev ? {
        ...prev,
        brand: primary.brand,
        productCategory: primary.productCategory,
        productName: primary.productName,
        enquiryItems: nextItems,
      } : prev);
      toast.success('Item removed');
    } catch {
      toast.error('Failed to remove item');
    }
  };

  if (isLoading) {
    return (
      <div className="eq-page eq-loading-page">
        <header className="eq-header skeleton-header">
          <div className="skeleton-title-row">
            <div className="sk-box title" />
            <div className="sk-box badge" />
            <div className="sk-box pill" />
          </div>
          <div className="sk-box subtitle" />
        </header>
        
        <main className="eq-body">
          <div className="eq-col">
            <div className="sk-card score" />
            <div className="sk-card details" />
            <div className="sk-card contact" />
          </div>
          <div className="eq-col">
            <div className="sk-card financial" />
            <div className="sk-card plan" />
          </div>
        </main>

        <style jsx>{`
          .eq-loading-page { min-height: 100vh; background: var(--bg); }
          .skeleton-header { border-bottom: 1px solid var(--line); padding: 32px 40px; background: var(--paper); }
          .skeleton-title-row { display: flex; gap: 12px; margin-bottom: 16px; align-items: center; }
          .sk-box { background: var(--line); border-radius: 8px; position: relative; overflow: hidden; }
          .sk-box::after {
            content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: linear-gradient(90deg, transparent, var(--paper-strong), transparent);
            animation: shimmer 2s infinite linear;
          }
          .sk-box.title { width: 320px; height: 36px; }
          .sk-box.badge { width: 60px; height: 24px; border-radius: 4px; }
          .sk-box.pill { width: 140px; height: 28px; border-radius: 20px; }
          .sk-box.subtitle { width: 500px; height: 16px; opacity: 0.5; }
          
          .sk-card { 
            background: var(--paper); border: 1px solid var(--line); border-radius: 16px; 
            position: relative; overflow: hidden; padding: 24px;
            box-shadow: var(--shadow-sm);
          }
          .sk-card::after {
            content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: linear-gradient(90deg, transparent, var(--paper-strong), transparent);
            animation: shimmer 2s infinite linear;
          }
          .sk-card.score { height: 180px; }
          .sk-card.details { height: 320px; }
          .sk-card.contact { height: 160px; }
          .sk-card.financial { height: 240px; }
          .sk-card.plan { height: 400px; }

          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    );
  }

  if (!lead) return null;

  const closure = lead.closurePercent ?? 0;
  const advancePct = lead.expectedValue > 0
    ? Math.min(100, Math.round(((lead.advanceValue ?? 0) / lead.expectedValue) * 100))
    : 0;

  const closureColor = closure >= 70 ? 'var(--green)' : closure >= 40 ? 'var(--amber)' : 'var(--danger)';
  const closureLabel = closure >= 70 ? 'Hot Lead' : closure >= 40 ? 'Warm Opportunity' : 'Early Stage';

  const statusColors: Record<string, string> = {
    'New': 'var(--blue)', 'Contacted': 'var(--amber)',
    'Quote Sent': '#8b5cf6', 'Order Confirmed': 'var(--green)', 'Closed Lost': 'var(--danger)',
  };
  const dotColor = statusColors[lead.status] ?? 'var(--muted)';
  const quoteActionUrl = quotePreviewUrl || lead.quoteUrl || '';
  const canViewQuote = Boolean(quoteActionUrl) || lead.status === 'Quote Sent';

  const shareOnWhatsApp = () => {
    const portalUrl = `${window.location.origin}/quote/${lead.id}/view`;
    const message = `Hello, please find the quotation for your enquiry (${lead.id}) here: ${portalUrl}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="eq-page">

      {/* ── Header ── */}
      <header className="eq-header">
        <div className="eq-header-left">
          <div className="eq-title-row">
            <h1 className="eq-title">{lead.clientName}</h1>
            <span className="eq-id-badge">{lead.id}</span>
            <span className="eq-status-pill" style={{ background: `${dotColor}18`, color: dotColor, borderColor: `${dotColor}30` }}>
              <span className="eq-status-dot" style={{ background: dotColor }} />
              {lead.status}
            </span>
          </div>
          <div className="eq-subtitle">
            {[lead.city, lead.state, lead.country].filter(Boolean).join(', ')} &nbsp;·&nbsp; {lead.clientType || 'Client'} &nbsp;·&nbsp; Created {fmtDate(lead.createdAt)}
          </div>
        </div>
        <div className="eq-header-actions">
          <button className="btn" onClick={() => router.back()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back
          </button>
          <button className="btn" onClick={() => window.print()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/></svg>
            Print
          </button>
          <a href={quoteActionUrl || `/quote/${lead.id}/view`} target="_blank" rel="noreferrer" className="btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            View Quote
          </a>
          <button className="btn" onClick={shareOnWhatsApp} style={{ background: '#22c55e', color: 'white', borderColor: '#22c55e' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.7 8.38 8.38 0 0 1 3.8.9L21 3l-1.5 5.5Z"/></svg>
            WhatsApp
          </button>
          <button className="btn danger" onClick={handleLogout} style={{ marginLeft: '12px' }}>
            Sign Out
          </button>
          {!canViewQuote ? (
            <button className="btn primary" onClick={() => router.push(`/enquiry/${id}/quote`)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
              Generate Quote
            </button>
          ) : (
             <button className="btn primary" onClick={() => router.push(`/enquiry/${id}/quote`)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                Edit Quote
              </button>
          )}
        </div>
      </header>

      {/* ── Insight Banner ── */}
      {closure >= 60 && (
        <div className="eq-insight">
          <span className="eq-insight-icon">✦</span>
          <p><strong>High-value opportunity:</strong> {closure}% closure probability — prioritise follow-up and finalise quote this week.</p>
        </div>
      )}

      {/* ── Body ── */}
      <main className="eq-body">
        {/* Left column */}
        <div className="eq-col">

          {/* Closure Score */}
          <section className="eq-card">
            <div className="eq-card-head">
              <h2>Lead Score</h2>
              <span className="eq-badge" style={{ background: `${closureColor}18`, color: closureColor }}>{closureLabel}</span>
            </div>
            <div className="eq-score-row">
              <div className="eq-score-ring">
                <svg viewBox="0 0 80 80" width="80" height="80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="var(--line)" strokeWidth="8"/>
                  <circle
                    cx="40" cy="40" r="34"
                    fill="none"
                    stroke={closureColor}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - closure / 100)}`}
                    transform="rotate(-90 40 40)"
                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                  />
                </svg>
                <span className="eq-score-num" style={{ color: closureColor }}>{closure}%</span>
              </div>
              <div className="eq-score-info">
                <div className="eq-prop-item">
                  <span className="eq-prop-label">Current Status</span>
                  <span className="eq-prop-val">{lead.status}</span>
                </div>
                <div className="eq-prop-item">
                  <span className="eq-prop-label">Expected Close</span>
                  <span className="eq-prop-val">{fmtDate(lead.orderExpectedDate)}</span>
                </div>
                <div className="eq-prop-item">
                  <span className="eq-prop-label">Priority</span>
                  <span className="eq-prop-val">{lead.priority}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Enquiry Details */}
          <section className="eq-card">
            <div className="eq-card-head"><h2>Enquiry Details</h2></div>
            <div className="eq-prop-grid">
              <div className="eq-prop-item">
                <span className="eq-prop-label">Brand</span>
                <span className="eq-prop-val">{lead.brand}</span>
              </div>
              <div className="eq-prop-item">
                <span className="eq-prop-label">Product Category</span>
                <span className="eq-prop-val">{lead.productCategory || '—'}</span>
              </div>
              <div className="eq-prop-item">
                <span className="eq-prop-label">Product</span>
                <span className="eq-prop-val">{lead.productName || '—'}</span>
              </div>
              <div className="eq-prop-item">
                <span className="eq-prop-label">Quantity</span>
                <span className="eq-prop-val">{lead.quantity ?? '—'}</span>
              </div>
              <div className="eq-prop-item">
                <span className="eq-prop-label">PO Number</span>
                <span className="eq-prop-val" style={{ fontFamily: 'monospace' }}>{lead.poNumber || 'Not Issued'}</span>
              </div>
              <div className="eq-prop-item">
                <span className="eq-prop-label">Owner</span>
                <span className="eq-prop-val">{lead.owner}</span>
              </div>
              <div className="eq-prop-item">
                <span className="eq-prop-label">Execution By</span>
                <span className="eq-prop-val">{lead.orderExecutionBy || '—'}</span>
              </div>
              <div className="eq-prop-item">
                <span className="eq-prop-label">Delivery Target</span>
                <span className="eq-prop-val">{lead.deliveryTarget || '—'}</span>
              </div>
            </div>
          </section>

          {quoteActionUrl && (
            <section className="eq-card">
              <div className="eq-card-head">
                <h2>Quote Document</h2>
                <a href={quoteActionUrl} target="_blank" rel="noreferrer" className="btn-link">Open in new tab</a>
              </div>
              <div style={{ border: '1px solid var(--line)', borderRadius: '12px', overflow: 'hidden', background: 'var(--paper-strong)' }}>
                <iframe title="Quote preview" src={quoteActionUrl} style={{ width: '100%', minHeight: '420px', border: 0, display: 'block' }} />
              </div>
            </section>
          )}

          {/* Contact */}
          <section className="eq-card">
            <div className="eq-card-head"><h2>Contact</h2></div>
            <div className="eq-prop-grid">
              <div className="eq-prop-item">
                <span className="eq-prop-label">Phone</span>
                <a href={`tel:${lead.phone}`} className="eq-prop-val eq-link">{lead.phone || '—'}</a>
              </div>
              <div className="eq-prop-item">
                <span className="eq-prop-label">Email</span>
                <a href={`mailto:${lead.email}`} className="eq-prop-val eq-link">{lead.email || '—'}</a>
              </div>
              <div className="eq-prop-item">
                <span className="eq-prop-label">City</span>
                <span className="eq-prop-val">{lead.city || '—'}</span>
              </div>
              <div className="eq-prop-item">
                <span className="eq-prop-label">Country</span>
                <span className="eq-prop-val">{lead.country || '—'}</span>
              </div>
            </div>
          </section>

          {/* Notes */}
          {lead.notes && (
            <section className="eq-card">
              <div className="eq-card-head"><h2>Notes</h2></div>
              <p className="eq-notes">{lead.notes}</p>
            </section>
          )}
        </div>

        {/* Right column */}
        <div className="eq-col">

          {/* Financials */}
          <section className="eq-card eq-financial-card">
            <div className="eq-card-head"><h2>Financial Overview</h2></div>
            <div className="eq-finance-main">
              <span className="eq-finance-label">Total Expected Value</span>
              <span className="eq-finance-value">{money(lead.expectedValue)}</span>
            </div>
            <div className="eq-finance-split">
              <div>
                <span className="eq-finance-label">Advance Received</span>
                <span className="eq-finance-sub" style={{ color: 'var(--green)' }}>{money(lead.advanceValue ?? 0)}</span>
              </div>
              <div>
                <span className="eq-finance-label">Balance Due</span>
                <span className="eq-finance-sub">{money(lead.expectedValue - (lead.advanceValue ?? 0))}</span>
              </div>
            </div>
            <div className="eq-progress-wrap">
              <div className="eq-progress-bar">
                <div className="eq-progress-fill" style={{ width: `${advancePct}%` }} />
              </div>
              <span className="eq-progress-label">{advancePct}% collected</span>
            </div>
          </section>

          {/* Action Plan */}
          <section className="eq-card">
            <div className="eq-card-head"><h2>Action Plan</h2></div>
            <div className="eq-steps">
              {[
                { label: 'Lead Captured', desc: `Logged on ${fmtDate(lead.createdAt)}`, done: true },
                { label: 'Initial Contact', desc: 'Follow-up call / email sent', done: lead.status !== 'New' },
                { label: 'Quote Shared', desc: 'Formal quotation delivered', done: ['Quote Sent', 'Order Confirmed'].includes(lead.status), active: lead.status === 'Contacted' },
                { label: 'PO & Advance', desc: lead.poNumber ? `PO: ${lead.poNumber}` : 'Awaiting PO confirmation', done: !!lead.poNumber, active: lead.status === 'Quote Sent' },
                { label: 'Order Confirmed', desc: `Target close: ${fmtDate(lead.orderExpectedDate)}`, done: lead.status === 'Order Confirmed' },
              ].map((step, i) => (
                <div key={i} className={`eq-step ${step.done ? 'done' : ''} ${step.active ? 'active' : ''}`}>
                  <div className="eq-step-icon">
                    {step.done ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    ) : (
                      <span>{i + 1}</span>
                    )}
                  </div>
                  <div className="eq-step-body">
                    <div className="eq-step-label">{step.label}</div>
                    <div className="eq-step-desc">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Products */}
          {lead.enquiryItems && lead.enquiryItems.length > 0 && (
            <section className="eq-card">
              <div className="eq-card-head"><h2>Enquiry Items</h2></div>
              <div className="eq-items">
                {lead.enquiryItems.map((item, idx) => (
                  <div key={idx} className="eq-item-row">
                    <div className="eq-item-brand">{item.brand}</div>
                    <div className="eq-item-name">{item.productName}</div>
                    {item.productCategory && (
                      <span className="eq-item-cat">{item.productCategory}</span>
                    )}
                    <button 
                      className="eq-item-del" 
                      onClick={() => removeEnquiryItem(idx)}
                      title="Remove item"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Gallery */}
          {lead.images && lead.images.length > 0 && (
            <section className="eq-card">
              <div className="eq-card-head"><h2>Reference Images</h2></div>
              <div className="eq-gallery">
                {lead.images.map((src, i) => (
                  <img key={i} src={src} alt={`Reference ${i + 1}`} className="eq-gallery-img" />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <style jsx>{`
        .eq-page {
          min-height: 100vh;
          background: var(--bg);
          color: var(--text);
          font-family: inherit;
        }

        .eq-loader {
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          color: var(--muted);
          font-size: 14px;
        }

        .eq-spin {
          width: 32px; height: 32px;
          border: 2.5px solid var(--line);
          border-top-color: var(--text);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { opacity: 0.65; }
          50% { opacity: 1; }
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .eq-loading-page {
          min-height: 100vh;
          padding: 24px;
          background: linear-gradient(180deg, var(--paper) 0%, var(--paper-soft) 100%);
        }

        .eq-loading-shell {
          max-width: 1280px;
          margin: 0 auto;
          display: grid;
          gap: 18px;
        }

        .eq-loading-hero,
        .eq-loading-card {
          border-radius: 18px;
          background: linear-gradient(90deg, var(--paper-strong) 0%, var(--paper) 50%, var(--paper-strong) 100%);
          background-size: 200% 100%;
          animation: shimmer 1.5s linear infinite;
        }

        .eq-loading-hero { height: 92px; }
        .eq-loading-grid { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr); gap: 18px; }
        .eq-loading-stack, .eq-loading-side { display: grid; gap: 18px; }
        .eq-loading-card-lg { min-height: 180px; }
        .eq-loading-card-md { min-height: 156px; }
        .eq-loading-card-sm { min-height: 132px; }
        .eq-loading-card-xl { min-height: 252px; }

        /* Header */
        .eq-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 40px;
          border-bottom: 1px solid var(--line);
          background: var(--paper);
          gap: 24px;
        }

        .eq-header-left {
          flex: 1;
          min-width: 0;
        }

        .eq-title-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .eq-title {
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.03em;
          margin: 0;
        }

        .eq-id-badge {
          background: var(--paper-strong);
          border: 1px solid var(--line);
          padding: 3px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-family: monospace;
          color: var(--muted);
        }

        .eq-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          border: 1px solid transparent;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .eq-status-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
        }

        .eq-subtitle {
          font-size: 13px;
          color: var(--muted);
          margin-top: 6px;
        }

        .eq-header-actions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-shrink: 0;
        }

        .eq-header-actions .btn {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* Insight Banner */
        .eq-insight {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 40px;
          background: var(--paper-strong);
          border-bottom: 1px solid var(--line);
          font-size: 13px;
        }
        .eq-insight-icon { font-size: 16px; color: var(--blue); }
        .eq-insight p { margin: 0; color: var(--text); }
        .eq-insight strong { font-weight: 600; }

        /* Body Layout */
        .eq-body {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 24px;
          padding: 32px 40px;
          max-width: 1400px;
          margin: 0 auto;
          align-items: start;
        }

        .eq-col {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* Card */
        .eq-card {
          background: var(--paper);
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 24px;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .eq-card-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .eq-card-head h2 {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted);
          margin: 0;
        }

        .eq-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 12px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        /* Score */
        .eq-score-row {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .eq-score-ring {
          position: relative;
          flex-shrink: 0;
          width: 80px; height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .eq-score-ring svg { position: absolute; }

        .eq-score-num {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.02em;
          position: relative;
          z-index: 1;
        }

        .eq-score-info {
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex: 1;
        }

        /* Property grid */
        .eq-prop-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .eq-prop-item {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .eq-prop-label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--muted);
        }

        .eq-prop-val {
          font-size: 14px;
          font-weight: 500;
          color: var(--text);
        }

        .eq-link {
          color: var(--blue);
          text-decoration: none;
        }
        .eq-link:hover { text-decoration: underline; }

        /* Notes */
        .eq-notes {
          font-size: 14px;
          line-height: 1.7;
          color: var(--text);
          margin: 0;
        }

        /* Financial */
        .eq-financial-card { background: var(--paper); }

        .eq-finance-main {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 20px;
        }

        .eq-finance-label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--muted);
          display: block;
        }

        .eq-finance-value {
          font-size: 36px;
          font-weight: 800;
          letter-spacing: -0.04em;
          color: var(--text);
          font-family: monospace;
        }

        .eq-finance-split {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 20px;
        }

        .eq-finance-sub {
          display: block;
          font-size: 18px;
          font-weight: 700;
          letter-spacing: -0.02em;
          margin-top: 4px;
        }

        .eq-progress-wrap { display: flex; align-items: center; gap: 12px; }

        .eq-progress-bar {
          flex: 1;
          height: 6px;
          background: var(--line);
          border-radius: 99px;
          overflow: hidden;
        }

        .eq-progress-fill {
          height: 100%;
          background: var(--green);
          border-radius: 99px;
          transition: width 1s ease-out;
        }

        .eq-progress-label { font-size: 11px; color: var(--muted); white-space: nowrap; }

        /* Steps */
        .eq-steps { display: flex; flex-direction: column; gap: 0; }

        .eq-step {
          display: flex;
          gap: 14px;
          position: relative;
          padding-bottom: 20px;
        }

        .eq-step:last-child { padding-bottom: 0; }

        .eq-step:not(:last-child)::after {
          content: '';
          position: absolute;
          left: 13px;
          top: 28px;
          bottom: 0;
          width: 2px;
          background: var(--line);
        }

        .eq-step.done:not(:last-child)::after { background: var(--green); opacity: 0.3; }

        .eq-step-icon {
          width: 28px; height: 28px;
          border-radius: 50%;
          border: 2px solid var(--line);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          color: var(--muted);
          background: var(--paper);
          flex-shrink: 0;
          z-index: 1;
        }

        .eq-step.done .eq-step-icon {
          background: var(--green);
          border-color: var(--green);
          color: white;
        }

        .eq-step.active .eq-step-icon {
          border-color: var(--blue);
          color: var(--blue);
        }

        .eq-step-body { padding-top: 4px; }

        .eq-step-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
        }

        .eq-step.done .eq-step-label { color: var(--muted); }

        .eq-step-desc {
          font-size: 11px;
          color: var(--muted);
          margin-top: 2px;
        }

        /* Items */
        .eq-items { display: flex; flex-direction: column; gap: 8px; }

        .eq-item-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: var(--paper-strong);
          border-radius: 8px;
          font-size: 13px;
        }

        .eq-item-brand {
          font-weight: 700;
          font-size: 11px;
          color: var(--blue);
          background: var(--blue-soft);
          padding: 2px 8px;
          border-radius: 4px;
          white-space: nowrap;
        }

        .eq-item-name { flex: 1; font-weight: 500; }

        .eq-item-cat {
          font-size: 11px;
          color: var(--muted);
        }

        .eq-item-del {
          width: 24px;
          height: 24px;
          border-radius: 4px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--muted);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
          opacity: 0;
          margin-left: auto;
        }

        .eq-item-row:hover .eq-item-del {
          opacity: 1;
        }

        .eq-item-del:hover {
          background: var(--danger-soft);
          color: var(--danger);
          border-color: var(--danger);
        }

        /* Gallery */
        .eq-gallery {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
          gap: 10px;
        }

        .eq-gallery-img {
          width: 100%;
          aspect-ratio: 1;
          object-fit: cover;
          border-radius: 8px;
          border: 1px solid var(--line);
          cursor: zoom-in;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .eq-gallery-img:hover {
          transform: scale(1.04);
          box-shadow: var(--shadow);
        }

        @media (max-width: 900px) {
          .eq-body { grid-template-columns: 1fr; padding: 20px; }
          .eq-header { padding: 20px; flex-direction: column; gap: 16px; }
          .eq-finance-value { font-size: 28px; }
        }

        @media print {
          .eq-header-actions, .eq-back, .eq-insight { display: none; }
          .eq-card { box-shadow: none; border-color: #ddd; }
        }
      `}</style>
    </div>
  );
}
