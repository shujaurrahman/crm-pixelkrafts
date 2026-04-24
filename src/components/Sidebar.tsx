import React from 'react';
import { LayoutDashboard, Users, Inbox, BarChart2, Download, Settings, UserCircle, Plus, LogOut } from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onNewLead: () => void;
  onLogout?: () => void;
}

export function Sidebar({ collapsed, activeTab, onTabChange, onNewLead, onLogout }: SidebarProps) {
  const groups = [
    {
      label: 'OVERVIEW',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      label: 'LEADS',
      items: [
        { id: 'enquiries', label: 'All Enquiries', icon: Inbox },
        { id: 'pipeline', label: 'Pipeline', icon: Users },
      ],
    },
    {
      label: 'REPORTS',
      items: [
        { id: 'analytics', label: 'Analytics', icon: BarChart2 },
        { id: 'export', label: 'Export', icon: Download },
      ],
    },
    {
      label: 'SETTINGS',
      items: [
        { id: 'profile', label: 'Profile', icon: UserCircle },
        { id: 'preferences', label: 'Preferences', icon: Settings },
      ],
    },
  ];

  return (
    <aside className={`app-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          <div className="w-8 h-8 rounded bg-surface shadow-sm border border-light flex items-center justify-center text-primary font-bold">
            61
          </div>
          {!collapsed && <span>CRM Portal</span>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-6">
        {groups.map((group) => (
          <div key={group.label} className="px-3">
            {!collapsed && (
              <div className="label mb-2 px-3">{group.label}</div>
            )}
            <div className="flex flex-col gap-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`btn flex items-center justify-start ${collapsed ? 'px-2 justify-center' : 'px-3'} py-2 rounded-md transition-colors w-full ${
                      isActive ? 'bg-subtle text-primary font-medium' : 'btn-ghost'
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon size={18} className={isActive ? 'text-blue' : 'text-muted'} />
                    {!collapsed && <span>{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t flex flex-col gap-2">
        <button 
          onClick={onLogout}
          className={`btn flex items-center gap-3 w-full p-2 rounded-md transition-colors text-danger hover:bg-danger-soft ${collapsed ? 'justify-center' : 'justify-start'}`}
          title={collapsed ? "Sign Out" : undefined}
        >
          <LogOut size={18} />
          {!collapsed && <span className="font-medium">Sign Out</span>}
        </button>

        <button 
          onClick={onNewLead}
          className={`btn btn-primary w-full ${collapsed ? 'p-2 justify-center' : 'justify-start'}`}
          title={collapsed ? "New Lead" : undefined}
        >
          <Plus size={18} />
          {!collapsed && <span>New Lead</span>}
        </button>
      </div>
    </aside>
  );
}
