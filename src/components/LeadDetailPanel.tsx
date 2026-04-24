import React, { useState } from 'react';
import { Lead, STATUSES, LeadStatus } from '../lib/crm-data';
import { X, User, Phone, Mail, Building, Target, DollarSign, MapPin, Tag, Clock, Calendar as CalendarIcon, MessageSquare } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface LeadDetailPanelProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus: (id: string, status: LeadStatus) => void;
}

const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function LeadDetailPanel({ lead, isOpen, onClose, onUpdateStatus }: LeadDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'notes'>('overview');

  if (!lead && !isOpen) return null;

  return (
    <>
      <div className={`slide-over-backdrop ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <div className={`slide-over-panel ${isOpen ? 'open' : ''}`}>
        {lead && (
          <>
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-lg font-semibold">{lead.clientName}</h2>
                <div className="text-sm text-muted">Created {formatDistanceToNow(new Date(lead.createdAt))} ago</div>
              </div>
              <button className="btn btn-ghost p-2" onClick={onClose}>
                <X size={20} />
              </button>
            </div>

            <div className="p-4 border-b bg-bg-subtle">
              <div className="flex items-center gap-3">
                <select 
                  className="input flex-1 py-1.5 px-3 h-auto" 
                  value={lead.status}
                  onChange={(e) => onUpdateStatus(lead.id, e.target.value as LeadStatus)}
                >
                  {STATUSES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <div className="font-semibold text-lg">{money(lead.expectedValue || 0)}</div>
              </div>
            </div>

            <div className="flex border-b px-4 gap-4">
              <button 
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'overview' ? 'border-accent-blue text-accent-blue' : 'border-transparent text-muted hover:text-primary'}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button 
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'timeline' ? 'border-accent-blue text-accent-blue' : 'border-transparent text-muted hover:text-primary'}`}
                onClick={() => setActiveTab('timeline')}
              >
                Timeline
              </button>
              <button 
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'notes' ? 'border-accent-blue text-accent-blue' : 'border-transparent text-muted hover:text-primary'}`}
                onClick={() => setActiveTab('notes')}
              >
                Notes
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'overview' && (
                <div className="flex flex-col gap-6">
                  <section>
                    <h3 className="label mb-3">Contact Details</h3>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3 text-sm">
                        <Phone size={16} className="text-muted" />
                        <span>{lead.phone || '-'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <Mail size={16} className="text-muted" />
                        <span>{lead.email || '-'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <Building size={16} className="text-muted" />
                        <span>{lead.clientType}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <MapPin size={16} className="text-muted" />
                        <span>{[lead.city, lead.state, lead.country].filter(Boolean).join(', ') || '-'}</span>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="label mb-3">Lead Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-muted mb-1 flex items-center gap-1"><Tag size={12}/> Brand</div>
                        <div className="text-sm font-medium">{lead.brand}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted mb-1 flex items-center gap-1"><Target size={12}/> Product Category</div>
                        <div className="text-sm font-medium">{lead.productCategory || '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted mb-1 flex items-center gap-1"><User size={12}/> Owner</div>
                        <div className="text-sm font-medium">{lead.owner}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted mb-1 flex items-center gap-1"><DollarSign size={12}/> Value</div>
                        <div className="text-sm font-medium">{money(lead.expectedValue || 0)}</div>
                      </div>
                    </div>
                  </section>

                  {lead.notes && (
                    <section>
                      <h3 className="label mb-2">Initial Notes</h3>
                      <div className="text-sm bg-bg-subtle p-3 rounded-lg border">
                        {lead.notes}
                      </div>
                    </section>
                  )}
                </div>
              )}

              {activeTab === 'timeline' && (
                <div className="flex flex-col gap-4 relative">
                  <div className="absolute left-4 top-2 bottom-2 w-px bg-border-light"></div>
                  
                  <div className="flex gap-4 relative z-10">
                    <div className="w-8 h-8 rounded-full bg-accent-blue-subtle text-accent-blue flex items-center justify-center flex-shrink-0 border border-bg-surface mt-1">
                      <MessageSquare size={14} />
                    </div>
                    <div className="flex-1 bg-surface border rounded-lg p-3">
                      <div className="text-sm font-medium mb-1">Status changed to {lead.status}</div>
                      <div className="text-xs text-muted">{format(new Date(lead.createdAt), 'MMM d, yyyy h:mm a')}</div>
                    </div>
                  </div>

                  <div className="flex gap-4 relative z-10">
                    <div className="w-8 h-8 rounded-full bg-bg-subtle text-muted flex items-center justify-center flex-shrink-0 border border-bg-surface mt-1">
                      <CalendarIcon size={14} />
                    </div>
                    <div className="flex-1 bg-surface border rounded-lg p-3">
                      <div className="text-sm font-medium mb-1">Lead created</div>
                      <div className="text-xs text-muted">by {lead.owner} on {format(new Date(lead.createdAt), 'MMM d, yyyy h:mm a')}</div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'notes' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1">
                    {/* Placeholder for list of notes */}
                    <div className="text-center p-8 text-muted text-sm">
                      No additional notes yet.
                    </div>
                  </div>
                  <div className="mt-auto border-t pt-4">
                    <textarea 
                      className="input w-full min-h-[100px] mb-2 resize-y" 
                      placeholder="Add a new note... (Markdown supported)"
                    ></textarea>
                    <div className="flex justify-end">
                      <button className="btn btn-primary">Save Note</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
