import React from 'react';
import { Search, Bell, Moon, Sun, Menu, ChevronDown } from 'lucide-react';

interface HeaderProps {
  onMenuToggle: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
}

export function Header({ onMenuToggle, searchQuery, onSearchChange, theme, onThemeToggle }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="flex items-center gap-4">
        <button className="btn btn-ghost p-2" onClick={onMenuToggle}>
          <Menu size={20} />
        </button>
        
        <div className="relative hidden md:block w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
            <Search size={16} />
          </div>
          <input
            type="text"
            className="input pl-9 bg-subtle border-transparent focus:bg-surface"
            placeholder="Search leads (Cmd+K)..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="btn btn-ghost p-2 text-muted hover-bg rounded-full relative">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-danger-red rounded-full"></span>
        </button>
        <button className="btn btn-ghost p-2 text-muted hover-bg rounded-full" onClick={onThemeToggle}>
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <div className="h-6 w-px bg-border-light mx-2"></div>
        <button className="flex items-center gap-2 hover-bg p-1 pr-2 rounded-md transition-all">
          <div className="w-8 h-8 rounded-full bg-accent-blue text-white flex items-center justify-center font-medium text-sm">
            AD
          </div>
          <ChevronDown size={16} className="text-muted" />
        </button>
      </div>
    </header>
  );
}
