import React, { useState } from 'react';
import { X } from 'lucide-react';
import { LeadDraft, CLIENT_TYPES, OWNER_SEED, BrandName } from '../lib/crm-data';

interface NewLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (lead: LeadDraft) => void;
}

export function NewLeadModal({ isOpen, onClose, onSave }: NewLeadModalProps) {
  const [form, setForm] = useState<LeadDraft>({
    date: new Date().toISOString().slice(0, 10),
    clientName: '',
    email: '',
    phone: '',
    country: 'India',
    state: '',
    city: '',
    clientType: CLIENT_TYPES[0],
    brand: 'Development',
    productCategory: '',
    productName: '',
    owner: OWNER_SEED[0],
    status: 'New',
    priority: 'Medium',
    expectedValue: '',
    quantity: '',
    poNumber: '',
    closurePercent: '',
    orderExpectedDate: '',
    orderExecutionBy: '',
    deliveryTarget: '',
    notes: '',
    images: [],
    advanceValue: '0',
    quoteUrl: '',
    enquiryItems: [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    // Clear error on change
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const newErrors: Record<string, string> = {};
    if (!form.clientName.trim()) newErrors.clientName = 'Name is required';
    if (!form.phone.trim() && !form.email.trim()) {
      newErrors.phone = 'Either phone or email is required';
      newErrors.email = 'Either phone or email is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave(form);
    
    // Reset form after save
    setForm({
      ...form,
      clientName: '',
      email: '',
      phone: '',
      expectedValue: '',
      notes: ''
    });
  };

  return (
    <div className={`modal-backdrop ${isOpen ? 'open' : ''}`}>
      <div className="modal-content">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">New Lead</h2>
          <button className="btn btn-ghost p-1 text-muted" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <form id="new-lead-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="label">Full Name *</label>
                <input 
                  type="text" 
                  name="clientName"
                  className={`input ${errors.clientName ? 'border-danger-red' : ''}`} 
                  value={form.clientName}
                  onChange={handleChange}
                  autoFocus
                />
                {errors.clientName && <span className="text-xs text-danger-red">{errors.clientName}</span>}
              </div>
              <div className="flex flex-col gap-1">
                <label className="label">Expected Value (₹)</label>
                <input 
                  type="number" 
                  name="expectedValue"
                  className="input" 
                  value={form.expectedValue}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="label">Phone Number</label>
                <input 
                  type="tel" 
                  name="phone"
                  className={`input ${errors.phone ? 'border-danger-red' : ''}`} 
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+91..."
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="label">Email Address</label>
                <input 
                  type="email" 
                  name="email"
                  className={`input ${errors.email ? 'border-danger-red' : ''}`} 
                  value={form.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="label">Source / Client Type</label>
                <select 
                  name="clientType"
                  className="input py-[9px]"
                  value={form.clientType}
                  onChange={handleChange}
                >
                  {CLIENT_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="label">Brand Interest</label>
                <select 
                  name="brand"
                  className="input py-[9px]"
                  value={form.brand}
                  onChange={handleChange}
                >
                  {['Creative Services', 'Development', 'Digital Marketing'].map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="label">Priority</label>
                <select 
                  name="priority"
                  className="input py-[9px]"
                  value={form.priority}
                  onChange={handleChange}
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="label">Assigned To</label>
                <select 
                  name="owner"
                  className="input py-[9px]"
                  value={form.owner}
                  onChange={handleChange}
                >
                  {OWNER_SEED.map(owner => (
                    <option key={owner} value={owner}>{owner}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="label">Notes</label>
              <textarea 
                name="notes"
                className="input min-h-[80px]" 
                value={form.notes}
                onChange={handleChange}
                placeholder="Initial requirements, context, etc..."
              ></textarea>
            </div>
          </form>
        </div>

        <div className="p-4 border-t bg-bg-subtle flex justify-end gap-2 rounded-b-lg">
          <button className="btn btn-ghost" onClick={onClose} type="button">Cancel</button>
          <button className="btn btn-primary" type="submit" form="new-lead-form">Create Lead</button>
        </div>
      </div>
    </div>
  );
}
