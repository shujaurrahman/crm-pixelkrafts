import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface AppShellProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
  onNewLead: () => void;
  onLogout?: () => void;
}

export function AppShell({
  children,
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  theme,
  onThemeToggle,
  onNewLead,
  onLogout
}: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar 
        collapsed={sidebarCollapsed} 
        activeTab={activeTab} 
        onTabChange={onTabChange} 
        onNewLead={onNewLead} 
        onLogout={onLogout}
      />
      <main className="app-main">
        <Header 
          onMenuToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          theme={theme}
          onThemeToggle={onThemeToggle}
        />
        <div className="app-content">
          <div className="app-content-inner">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
