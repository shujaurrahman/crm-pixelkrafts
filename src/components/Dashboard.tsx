import React from 'react';
import { Lead } from '../lib/crm-data';
import { TrendingUp, Users, DollarSign, Calendar, Clock, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface DashboardProps {
  leads: Lead[];
  onNavigate: (tab: string) => void;
}

const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function Dashboard({ leads, onNavigate }: DashboardProps) {
  const totalLeads = leads.length;
  
  // Basic KPI calculations
  const totalValue = leads.reduce((acc, lead) => acc + (Number(lead.expectedValue) || 0), 0);
  const wonLeads = leads.filter(l => l.status === 'Order Confirmed');
  const conversionRate = totalLeads ? ((wonLeads.length / totalLeads) * 100).toFixed(1) : '0.0';
  
  // Follow ups logic (simulated by finding non-closed leads older than 3 days)
  const dueFollowUps = leads.filter(l => {
    if (l.status === 'Order Confirmed' || l.status === 'Closed Lost') return false;
    const ageInDays = (Date.now() - new Date(l.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return ageInDays > 3;
  }).slice(0, 5);

  const recentActivity = [...leads].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 5);

  const kpis = [
    { label: 'Total Leads', value: totalLeads, icon: Users, change: '+12% this month', positive: true },
    { label: 'Pipeline Value', value: money(totalValue), icon: DollarSign, change: '+5% this month', positive: true },
    { label: 'Conversion Rate', value: `${conversionRate}%`, icon: TrendingUp, change: '+1.2% this month', positive: true },
    { label: 'Follow-ups Due', value: dueFollowUps.length, icon: Calendar, change: 'Requires action', positive: dueFollowUps.length === 0, warning: dueFollowUps.length > 0 },
  ];

  if (totalLeads === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center">
        <div className="w-48 h-48 mb-6 text-border-light flex items-center justify-center bg-bg-subtle rounded-full">
           <Users size={64} className="text-muted" />
        </div>
        <h2 className="text-2xl font-semibold mb-2">Welcome to your CRM</h2>
        <p className="text-muted mb-8 max-w-md">You don't have any leads yet. Add your first lead to start building your pipeline and tracking your sales.</p>
        <button className="btn btn-primary btn-lg" onClick={() => onNavigate('new')}>
          Add your first lead
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="text-sm text-muted">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div key={i} className={`p-4 rounded-lg border bg-surface shadow-sm ${kpi.warning ? 'border-warning-amber' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="label">{kpi.label}</span>
                <div className={`p-2 rounded-md ${kpi.warning ? 'bg-warning-amber-subtle text-warning-amber' : 'bg-bg-subtle text-muted'}`}>
                  <Icon size={16} />
                </div>
              </div>
              <div className="text-2xl font-semibold mb-1">{kpi.value}</div>
              <div className={`text-xs font-medium ${kpi.warning ? 'text-warning-amber' : (kpi.positive ? 'text-success-green' : 'text-muted')}`}>
                {kpi.change}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="border bg-surface rounded-lg shadow-sm flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Calendar size={16} className="text-muted" />
              Today's Follow-ups
            </h3>
            {dueFollowUps.length > 0 && (
              <span className="badge badge-amber">{dueFollowUps.length} Due</span>
            )}
          </div>
          <div className="p-0 flex-1">
            {dueFollowUps.length === 0 ? (
              <div className="p-8 text-center text-muted text-sm">
                No follow-ups due today. You're all caught up!
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border-light">
                {dueFollowUps.map(lead => (
                  <div key={lead.id} className="p-4 hover-bg transition-colors flex items-center justify-between cursor-pointer" onClick={() => onNavigate(`lead-${lead.id}`)}>
                    <div>
                      <div className="font-medium text-primary mb-1">{lead.clientName}</div>
                      <div className="text-xs text-muted">Last active {formatDistanceToNow(new Date(lead.createdAt))} ago</div>
                    </div>
                    <button className="btn btn-ghost p-2 text-muted">
                      <ArrowRight size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border bg-surface rounded-lg shadow-sm flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-semibold flex items-center gap-2">
              <Clock size={16} className="text-muted" />
              Recent Activity
            </h3>
          </div>
          <div className="p-0 flex-1">
            <div className="flex flex-col divide-y divide-border-light">
              {recentActivity.map(lead => (
                <div key={lead.id} className="p-4 hover-bg transition-colors flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent-blue-subtle text-accent-blue flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Users size={14} />
                  </div>
                  <div>
                    <div className="text-sm">
                      <span className="font-medium text-primary">New lead created</span>
                      <span className="text-muted"> — {lead.clientName}</span>
                    </div>
                    <div className="text-xs text-muted mt-1">{formatDistanceToNow(new Date(lead.createdAt))} ago</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
