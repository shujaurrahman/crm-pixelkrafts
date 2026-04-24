import React, { useMemo } from 'react';
import { Lead, LeadStatus, STATUSES } from '../lib/crm-data';
import { Filter, LayoutGrid, LayoutList, MoreHorizontal } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatDistanceToNow } from 'date-fns';

interface KanbanBoardProps {
  leads: Lead[];
  onLeadSelect: (lead: Lead) => void;
  onLeadMove: (leadId: string, newStatus: LeadStatus) => void;
  viewMode: 'table' | 'kanban';
  onViewModeChange: (mode: 'table' | 'kanban') => void;
}

const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;

function SortableLeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id, data: { type: 'Lead', lead } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`bg-surface border p-3 rounded-lg shadow-sm cursor-grab active:cursor-grabbing mb-3 hover:border-accent-blue transition-colors group relative ${isDragging ? 'ring-2 ring-accent-blue shadow-md' : ''}`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="font-medium text-sm text-primary leading-tight">{lead.clientName}</div>
        <button className="text-muted opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover-bg rounded">
          <MoreHorizontal size={14} />
        </button>
      </div>
      <div className="text-xs text-muted mb-2">{lead.brand}</div>
      <div className="flex items-center justify-between mt-3 pt-2 border-t">
        <div className="font-semibold text-sm">{money(lead.expectedValue || 0)}</div>
        <div className="text-[10px] text-muted">{formatDistanceToNow(new Date(lead.createdAt))}</div>
      </div>
    </div>
  );
}

function KanbanColumn({ status, leads, onLeadSelect }: { status: LeadStatus; leads: Lead[], onLeadSelect: (lead: Lead) => void }) {
  const { setNodeRef } = useSortable({
    id: status,
    data: { type: 'Column', status },
  });

  const totalValue = leads.reduce((acc, l) => acc + (l.expectedValue || 0), 0);

  return (
    <div className="flex flex-col bg-bg-subtle rounded-lg w-72 flex-shrink-0 h-full max-h-full">
      <div className="p-3 border-b flex items-center justify-between sticky top-0 bg-bg-subtle z-10 rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-primary">{status}</span>
          <span className="badge badge-gray">{leads.length}</span>
        </div>
        <div className="text-xs font-semibold text-muted">{money(totalValue)}</div>
      </div>
      
      <div 
        ref={setNodeRef}
        className="flex-1 p-2 overflow-y-auto"
      >
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map(lead => (
            <SortableLeadCard key={lead.id} lead={lead} onClick={() => onLeadSelect(lead)} />
          ))}
        </SortableContext>
        {leads.length === 0 && (
          <div className="h-full min-h-[100px] border-2 border-dashed border-border-light rounded-lg flex items-center justify-center text-xs text-muted">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

export function KanbanBoard({ leads, onLeadSelect, onLeadMove, viewMode, onViewModeChange }: KanbanBoardProps) {
  const [activeLead, setActiveLead] = React.useState<Lead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const columns = useMemo(() => {
    const cols: Record<LeadStatus, Lead[]> = {
      'New': [],
      'Contacted': [],
      'Quote Sent': [],
      'Order Confirmed': [],
      'Closed Lost': []
    };
    leads.forEach(lead => {
      if (cols[lead.status]) {
        cols[lead.status].push(lead);
      }
    });
    return cols;
  }, [leads]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const lead = active.data.current?.lead;
    if (lead) setActiveLead(lead);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveLead(null);
    const { active, over } = event;
    if (!over) return;

    const leadId = active.id as string;
    
    // Find target status
    let targetStatus: LeadStatus | null = null;
    if (over.data.current?.type === 'Column') {
      targetStatus = over.data.current.status as LeadStatus;
    } else if (over.data.current?.type === 'Lead') {
      targetStatus = over.data.current.lead.status as LeadStatus;
    }

    const lead = leads.find(l => l.id === leadId);
    if (targetStatus && lead && lead.status !== targetStatus) {
      onLeadMove(leadId, targetStatus);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pipeline Kanban</h1>
        
        <div className="flex items-center gap-2">
          <div className="flex bg-bg-subtle p-1 rounded-lg border">
            <button 
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-surface shadow-sm text-primary' : 'text-muted hover:text-primary'}`}
              onClick={() => onViewModeChange('table')}
            >
              <LayoutList size={16} />
            </button>
            <button 
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-surface shadow-sm text-primary' : 'text-muted hover:text-primary'}`}
              onClick={() => onViewModeChange('kanban')}
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto pb-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full items-start">
            {STATUSES.map(status => (
              <KanbanColumn 
                key={status} 
                status={status} 
                leads={columns[status] || []} 
                onLeadSelect={onLeadSelect}
              />
            ))}
          </div>
          
          <DragOverlay>
            {activeLead ? (
              <div className="bg-surface border p-3 rounded-lg shadow-lg cursor-grabbing w-72 opacity-90 rotate-2">
                <div className="font-medium text-sm text-primary mb-2">{activeLead.clientName}</div>
                <div className="text-xs text-muted mb-2">{activeLead.brand}</div>
                <div className="font-semibold text-sm mt-3 pt-2 border-t">{money(activeLead.expectedValue || 0)}</div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
