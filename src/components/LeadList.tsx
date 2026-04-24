import React, { useState } from 'react';
import { Lead } from '../lib/crm-data';
import { Filter, Search, ChevronDown, MoreHorizontal, LayoutGrid, LayoutList } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface LeadListProps {
  leads: Lead[];
  onLeadSelect: (lead: Lead) => void;
  viewMode: 'table' | 'kanban';
  onViewModeChange: (mode: 'table' | 'kanban') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function LeadList({ leads, onLeadSelect, viewMode, onViewModeChange, searchQuery, onSearchChange }: LeadListProps) {
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());

  const toggleSelectAll = () => {
    if (selectedLeads.size === leads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(leads.map(l => l.id)));
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedLeads(newSelected);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'New': return <span className="badge badge-blue">New</span>;
      case 'Contacted': return <span className="badge badge-amber">Contacted</span>;
      case 'Quote Sent': return <span className="badge badge-amber">Quote Sent</span>;
      case 'Order Confirmed': return <span className="badge badge-green">Won</span>;
      case 'Closed Lost': return <span className="badge badge-red">Lost</span>;
      default: return <span className="badge badge-gray">{status}</span>;
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">All Enquiries</h1>
        
        <div className="flex items-center gap-2">
          <div className="flex bg-bg-subtle p-1 rounded-lg border">
            <button 
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-surface shadow-sm text-primary' : 'text-muted hover:text-primary'}`}
              onClick={() => onViewModeChange('table')}
              title="Table View"
            >
              <LayoutList size={16} />
            </button>
            <button 
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-surface shadow-sm text-primary' : 'text-muted hover:text-primary'}`}
              onClick={() => onViewModeChange('kanban')}
              title="Kanban View"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
          
          <button className="btn btn-outline">
            <Filter size={16} />
            <span>Filter</span>
          </button>
        </div>
      </div>

      {selectedLeads.size > 0 && (
        <div className="bg-accent-blue-subtle border border-accent-blue rounded-lg p-3 flex items-center justify-between">
          <span className="text-accent-blue font-medium text-sm">{selectedLeads.size} leads selected</span>
          <div className="flex items-center gap-2">
            <button className="btn bg-white text-sm">Update Status</button>
            <button className="btn btn-danger text-sm">Delete</button>
          </div>
        </div>
      )}

      <div className="border bg-surface rounded-lg shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="table-container flex-1 overflow-y-auto relative">
          <table className="table w-full">
            <thead className="bg-bg-subtle sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="w-12 text-center">
                  <input 
                    type="checkbox" 
                    checked={selectedLeads.size === leads.length && leads.length > 0}
                    onChange={toggleSelectAll}
                    className="cursor-pointer"
                  />
                </th>
                <th>Name</th>
                <th>Contact</th>
                <th>Service Category</th>
                <th>Status</th>
                <th>Value</th>
                <th>Last Active</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center p-8 text-muted">
                    No leads found matching your criteria.
                  </td>
                </tr>
              ) : (
                leads.map(lead => (
                  <tr key={lead.id} onClick={() => onLeadSelect(lead)}>
                    <td className="text-center" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={selectedLeads.has(lead.id)}
                        onChange={(e) => toggleSelect(lead.id, e as any)}
                        className="cursor-pointer"
                      />
                    </td>
                    <td>
                      <div className="font-medium text-primary">{lead.clientName}</div>
                      <div className="text-xs text-muted">{lead.clientType}</div>
                    </td>
                    <td>
                      <div className="text-sm">{lead.email || '-'}</div>
                      <div className="text-xs text-muted">{lead.phone || '-'}</div>
                    </td>
                    <td>
                      <div className="text-sm">{lead.brand}</div>
                      <div className="text-xs text-muted">{lead.productCategory || 'N/A'}</div>
                    </td>
                    <td>{getStatusBadge(lead.status)}</td>
                    <td className="font-medium">{money(lead.expectedValue || 0)}</td>
                    <td className="text-sm text-muted">
                      {formatDistanceToNow(new Date(lead.createdAt))} ago
                    </td>
                    <td>
                      <button className="btn btn-ghost p-1 text-muted" onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {leads.length > 0 && (
          <div className="p-3 border-t flex items-center justify-between text-sm text-muted bg-bg-subtle">
            <div>Showing {leads.length} leads</div>
            <div className="flex gap-1">
              <button className="btn btn-outline py-1 px-2 text-xs" disabled>Previous</button>
              <button className="btn btn-outline py-1 px-2 text-xs">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
