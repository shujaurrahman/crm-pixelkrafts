'use client';

import { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  CLIENT_TYPE_SEED,
  CLIENT_TYPES,
  PRODUCT_SEED,
  normalizeProductsByBrand,
  OWNER_SEED,
  STATUSES,
  type AIFieldPatch,
  type BrandName,
  type EnquiryLineItem,
  type Lead,
  type LeadDraft,
  type LeadStatus,
  type Priority,
  type ProductItem,
  type TabKey,
} from '../lib/crm-data';

export type Template = {
  id: string;
  name: string;
  imageUrl: string;
  isActive: boolean;
};

interface SpeechRecognitionResultItem {
  transcript: string;
}

interface SpeechRecognitionResultSet {
  0: SpeechRecognitionResultItem;
}

interface SpeechRecognitionEventLike {
  results: SpeechRecognitionResultSet[];
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface LeadEditDraft {
  date: string;
  clientName: string;
  email: string;
  phone: string;
  country: string;
  state: string;
  city: string;
  clientType: string;
  brand: BrandName;
  productCategory: string;
  productName: string;
  owner: string;
  status: LeadStatus;
  priority: Priority;
  expectedValue: string;
  quantity: string;
  poNumber: string;
  closurePercent: string;
  advanceValue: string;
  orderExpectedDate: string;
  orderExecutionBy: string;
  deliveryTarget: string;
  notes: string;
  images: string[];
  enquiryItems: EnquiryLineItem[];
  quoteUrl: string;
}

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    SpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

const BRANDS: BrandName[] = ['Creative Services', 'Development', 'Digital Marketing'];
const LEADS_CACHE_KEY = 'crm-leads-cache-v1';
const CLIENT_TYPES_CACHE_KEY = 'crm-client-types-cache-v1';
const OWNERS_CACHE_KEY = 'crm-owners-cache-v1';

const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;

function statusClass(status: LeadStatus) {
  if (status === 'New') return 'st-new';
  if (status === 'Contacted') return 'st-contacted';
  if (status === 'Quote Sent') return 'st-quote';
  if (status === 'Order Confirmed') return 'st-order';
  return 'st-lost';
}

function relativeTime(date: string) {
  const d = new Date(date).getTime();
  const diff = Date.now() - d;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? 's' : ''} ago`;
}

function formatDate(value?: string) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function normalizeLineItem(line: EnquiryLineItem): EnquiryLineItem {
  return {
    brand: line.brand,
    productCategory: line.productCategory.trim(),
    productName: line.productName.trim(),
  };
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const raw = await response.text();
  let payload: (T & { error?: string }) | null = null;

  if (raw) {
    try {
      payload = JSON.parse(raw) as T & { error?: string };
    } catch {
      if (!response.ok) {
        throw new Error(raw || `Request failed: ${response.status}`);
      }
      throw new Error('Invalid server response.');
    }
  }

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed: ${response.status}`);
  }
  if (!payload) {
    throw new Error('Empty server response.');
  }
  return payload;
}

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('crm-theme');
    if (saved === 'dark' || saved === 'light') {
      setTheme(saved);
    } else {
      const attr = document.documentElement.getAttribute('data-theme');
      if (attr === 'dark' || attr === 'light') setTheme(attr);
    }
  }, []);

  const [tab, setTab] = useState<TabKey>('dashboard');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isTemplateBusy, setIsTemplateBusy] = useState(false);
  const [isAddProductMenuOpen, setIsAddProductMenuOpen] = useState(false);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      if (data.templates) setTemplates(data.templates);
    } catch (e) {
      console.error('Template Load Failed', e);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const selectTemplate = async (id: string) => {
    if (isTemplateBusy) return;
    setIsTemplateBusy(true);
    try {
      await fetch('/api/templates', {
        method: 'POST',
        body: JSON.stringify({ action: 'select', id })
      });
      await fetchTemplates();
      toast.success('Active letterhead updated!');
    } catch (e) {
      toast.error('Failed to update template');
    } finally {
      setIsTemplateBusy(false);
    }
  };

  const addTemplate = async (name: string, imageUrl: string) => {
    if (!name || !imageUrl) return;
    setIsTemplateBusy(true);
    try {
      await fetch('/api/templates', {
        method: 'POST',
        body: JSON.stringify({ action: 'add', template: { name, imageUrl } })
      });
      await fetchTemplates();
      toast.success('New template added and set as default!');
    } catch (e) {
      toast.error('Failed to add template');
    } finally {
      setIsTemplateBusy(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    const t = templates.find(x => x.id === id);
    if (t?.isActive) return toast.error('Cannot delete the active letterhead.');
    if (id === 'default') return toast.error('Cannot delete the standard system template.');

    if (!window.confirm('Are you sure you want to delete this letterhead?')) return;

    setIsTemplateBusy(true);
    try {
      await fetch('/api/templates', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', id })
      });
      await fetchTemplates();
      toast.success('Template removed.');
    } catch (e) {
      toast.error('Failed to delete template');
    } finally {
      setIsTemplateBusy(false);
    }
  };
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const lastSyncTime = useRef(0);

  const setSyncingStatus = (val: boolean) => {
    syncingRef.current = val;
    setSyncing(val);
    if (!val) lastSyncTime.current = Date.now();
  };

  const [clientTypes, setClientTypes] = useState<string[]>([...CLIENT_TYPES]);
  const [newClientType, setNewClientType] = useState('');
  const [owners, setOwners] = useState<string[]>([...OWNER_SEED]);
  const [newOwner, setNewOwner] = useState('');

  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState<'All' | BrandName>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | LeadStatus>('All');
  const [ownerFilter, setOwnerFilter] = useState<'All' | string>('All');

  const [assistantInput, setAssistantInput] = useState('');
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [assistantMessage, setAssistantMessage] = useState('Speak or paste details. AI can map service category and item.');

  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [leadEditDraft, setLeadEditDraft] = useState<LeadEditDraft | null>(null);

  const [chatQuestion, setChatQuestion] = useState('');
  const [chatAnswer, setChatAnswer] = useState('Ask anything like: Which owner has highest pipeline?');
  const [chatBusy, setChatBusy] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewClientName, setPreviewClientName] = useState('');
  const [activePreviewImage, setActivePreviewImage] = useState(0);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const selectedLead = useMemo(() => leads.find(l => l.id === selectedLeadId) || null, [leads, selectedLeadId]);

  // De-cluttering states
  const [formStep, setFormStep] = useState(1);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  const [productsByBrand, setProductsByBrand] = useState(PRODUCT_SEED);

  // Inline editing states for Team & Product
  const [editingOwner, setEditingOwner] = useState<string | null>(null);
  const [editingOwnerValue, setEditingOwnerValue] = useState('');
  const [editingProductKey, setEditingProductKey] = useState<string | null>(null);
  const [editingProductValue, setEditingProductValue] = useState('');

  const isMounted = useRef(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

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
    owner: OWNER_SEED[1] || OWNER_SEED[0], // Prefer 'Shuja' if available
    status: 'New',
    priority: 'Medium',
    expectedValue: '0',
    quantity: '',
    poNumber: '',
    closurePercent: '',
    advanceValue: '0',
    orderExpectedDate: '',
    orderExecutionBy: '',
    deliveryTarget: '',
    notes: '',
    images: [],
    quoteUrl: '',
    enquiryItems: [],
  });

  const getLeadItems = (lead: Lead): EnquiryLineItem[] => {
    if (Array.isArray(lead.enquiryItems) && lead.enquiryItems.length) {
      return lead.enquiryItems;
    }
    if (!lead.productName && !lead.productCategory) {
      return [];
    }
    return [{ brand: lead.brand, productCategory: lead.productCategory, productName: lead.productName }];
  };

  const ownerOptions = useMemo(() => (owners.length ? owners : [...OWNER_SEED]), [owners]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(open => !open);
      }
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  useEffect(() => {
    const loadData = async (isInitial = false) => {
      // Don't overwrite if we are currently syncing or just finished syncing (within 2s)
      if (syncingRef.current || (Date.now() - lastSyncTime.current < 2000)) {
        return;
      }

      try {
        if (isInitial) setIsLoading(true);

        const [leadResult, clientTypeResult, ownerResult] = await Promise.allSettled([
          requestJson<{ leads: Lead[] }>('/api/leads', { cache: 'no-store' }),
          requestJson<{ clientTypes: string[] }>('/api/client-types', { cache: 'no-store' }),
          requestJson<{ owners: string[] }>('/api/owners', { cache: 'no-store' }),
        ]);

        // Check again before setting state
        if (syncingRef.current) return;

        const loadErrors: string[] = [];

        if (leadResult.status === 'fulfilled') {
          const loadedLeads = Array.isArray(leadResult.value.leads) ? leadResult.value.leads : [];
          setLeads(loadedLeads);
          if (typeof window !== 'undefined') {
            localStorage.setItem(LEADS_CACHE_KEY, JSON.stringify(loadedLeads));
          }
        } else {
          loadErrors.push('Leads');
        }

        if (clientTypeResult.status === 'fulfilled') {
          const loadedClientTypes = Array.isArray(clientTypeResult.value.clientTypes)
            ? clientTypeResult.value.clientTypes
            : [...CLIENT_TYPE_SEED];
          const nextTypes = loadedClientTypes.length ? loadedClientTypes : [...CLIENT_TYPES];
          setClientTypes(nextTypes);
          if (typeof window !== 'undefined') {
            localStorage.setItem(CLIENT_TYPES_CACHE_KEY, JSON.stringify(nextTypes));
          }
        } else {
          loadErrors.push('Client Types');
        }

        if (ownerResult.status === 'fulfilled') {
          const loadedOwners = Array.isArray(ownerResult.value.owners) ? ownerResult.value.owners : [...OWNER_SEED];
          const nextOwners = loadedOwners.length ? loadedOwners : [...OWNER_SEED];
          setOwners(nextOwners);
          if (typeof window !== 'undefined') {
            localStorage.setItem(OWNERS_CACHE_KEY, JSON.stringify(nextOwners));
          }
        } else {
          loadErrors.push('Owners');
        }

        if (loadErrors.length && isInitial) {
          toast.error(`Some data could not be refreshed (${loadErrors.join(', ')}). Showing latest available values.`);
        }
      } catch (error) {
        if (isInitial) {
          toast.error(error instanceof Error ? error.message : 'Unable to load CRM data. Showing latest available values.');
        }
      } finally {
        if (isInitial) setIsLoading(false);
      }
    };

    void loadData(true);

    const handleFocus = () => {
      // Throttled focus reload
      if (Date.now() - lastSyncTime.current > 5000) {
        void loadData(false);
      }
    };

    window.addEventListener('focus', handleFocus);

    // Polling every 60 seconds for background sync (increased from 30s)
    const interval = setInterval(() => loadData(false), 60000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  const handleLogout = () => {
    document.cookie = 'crm-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    router.push('/login');
  };

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      // If we are mounting, and the state is still the default 'light',
      // check if we should actually be dark before applying anything.
      const saved = localStorage.getItem('crm-theme');
      if (saved && saved !== theme) return;
    }

    document.documentElement.setAttribute('data-theme', theme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('crm-theme', theme);
      document.documentElement.classList.remove('no-transitions');
    }
  }, [theme]);

  useEffect(() => {
    if (!ownerOptions.length) return;
    setForm((prev) => (ownerOptions.includes(prev.owner) ? prev : { ...prev, owner: ownerOptions[0] }));
    setForm((prev) => (prev.orderExecutionBy && !ownerOptions.includes(prev.orderExecutionBy) ? { ...prev, orderExecutionBy: '' } : prev));
    if (ownerFilter !== 'All' && !ownerOptions.includes(ownerFilter)) {
      setOwnerFilter('All');
    }
  }, [ownerOptions, ownerFilter]);

  useEffect(() => {
    if (!clientTypes.length) return;
    setForm((prev) => (clientTypes.includes(prev.clientType) ? prev : { ...prev, clientType: clientTypes[0] }));
  }, [clientTypes]);

  useEffect(() => {
    if (isMounted.current && productsByBrand !== PRODUCT_SEED) {
      void syncProducts(productsByBrand);
    }
  }, [productsByBrand]);

  useEffect(() => {
    if (!previewImages.length && !selectedLead) return;

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewImages([]);
        setPreviewClientName('');
        setActivePreviewImage(0);
        setSelectedLeadId(null);
      }
    };

    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [previewImages.length, selectedLead]);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();

    return leads
      .filter((lead) => {
        const items = getLeadItems(lead);
        if (brandFilter !== 'All' && !items.some((item) => item.brand === brandFilter)) return false;
        if (statusFilter !== 'All' && lead.status !== statusFilter) return false;
        if (ownerFilter !== 'All' && lead.owner !== ownerFilter) return false;
        if (!query) return true;
        const itemText = items.map((item) => `${item.brand} ${item.productCategory} ${item.productName}`).join(' ');
        return [lead.id, lead.clientName, lead.phone, lead.city, lead.country, lead.productName, lead.notes, String(lead.quantity || ''), lead.poNumber || '', String(lead.closurePercent || '')]
          .concat(itemText)
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [leads, search, brandFilter, statusFilter, ownerFilter]);

  const analytics = useMemo(() => {
    const byBrand: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byOwner: Record<string, { leads: number; value: number; won: number }> = {};
    const byProduct: Record<string, number> = {};
    const byPriority: Record<Priority, number> = { High: 0, Medium: 0, Low: 0 };

    let totalValue = 0;
    let wonValue = 0;
    let openValue = 0;
    let quoteSentValue = 0;
    let staleCount = 0;

    const monthMap: Record<string, number> = {};

    leads.forEach((lead) => {
      const items = getLeadItems(lead);

      items.forEach((item) => {
        byBrand[item.brand] = (byBrand[item.brand] || 0) + 1;
        if (item.productName) {
          byProduct[item.productName] = (byProduct[item.productName] || 0) + 1;
        }
      });

      byStatus[lead.status] = (byStatus[lead.status] || 0) + 1;
      byPriority[lead.priority] += 1;

      if (!byOwner[lead.owner]) {
        byOwner[lead.owner] = { leads: 0, value: 0, won: 0 };
      }
      byOwner[lead.owner].leads += 1;
      byOwner[lead.owner].value += lead.expectedValue;

      totalValue += lead.expectedValue;
      if (lead.status === 'Order Confirmed') {
        wonValue += lead.expectedValue;
        byOwner[lead.owner].won += 1;
      } else if (lead.status !== 'Closed Lost') {
        openValue += lead.expectedValue;
        if (lead.status === 'Quote Sent') {
          quoteSentValue += lead.expectedValue;
        }
      }

      const leadAge = (Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      if (leadAge > 7 && lead.status !== 'Order Confirmed' && lead.status !== 'Closed Lost') {
        staleCount += 1;
      }

      const monthKey = new Date(lead.createdAt).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      monthMap[monthKey] = (monthMap[monthKey] || 0) + 1;
    });

    const openLeads = leads.filter((x) => x.status !== 'Order Confirmed' && x.status !== 'Closed Lost').length;
    const conversionRate = leads.length ? ((byStatus['Order Confirmed'] || 0) / leads.length) * 100 : 0;
    const avgDeal = leads.length ? totalValue / leads.length : 0;
    const avgOpenDeal = openLeads ? openValue / openLeads : 0;
    const openPipelineShare = totalValue ? (openValue / totalValue) * 100 : 0;

    const ownerBoard = Object.entries(byOwner)
      .map(([name, data]) => ({
        name,
        leads: data.leads,
        value: data.value,
        winRate: data.leads ? (data.won / data.leads) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    const trend = Object.entries(monthMap).slice(-6);

    return {
      totalLeads: leads.length,
      totalValue,
      wonValue,
      openValue,
      quoteSentValue,
      staleCount,
      openLeads,
      conversionRate,
      avgDeal,
      avgOpenDeal,
      openPipelineShare,
      byBrand,
      byStatus,
      byPriority,
      topProducts: Object.entries(byProduct).sort((a, b) => b[1] - a[1]).slice(0, 6),
      ownerBoard,
      trend,
      recent: [...leads].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 6),
    };
  }, [leads]);

  const syncLeads = async (nextLeads: Lead[]) => {
    setSyncingStatus(true);
    try {
      await requestJson<{ ok: true }>('/api/leads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: nextLeads }),
      });

    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to sync leads');
    } finally {
      setSyncingStatus(false);
    }
  };

  const insertDummyLead = async () => {
    const dummyId = 'ENQ-DEMO-001';
    if (leads.some(l => l.id === dummyId)) {
      toast.info('Demo lead already exists — click it to open!');
      return;
    }
    const demo: Lead = {
      id: dummyId,
      date: new Date().toISOString().slice(0, 10),
      clientName: 'Future Tech Systems',
      email: 'contact@futuretech.com',
      phone: '+91 99887 76655',
      country: 'India',
      state: 'Karnataka',
      city: 'Bangalore',
      clientType: 'Enterprise',
      brand: 'Development',
      productCategory: 'Web Dev',
      productName: 'React Next.js Website',
      owner: owners[0] || 'Shuja',
      status: 'New',
      priority: 'High',
      expectedValue: 500000,
      advanceValue: 100000,
      quantity: 1,
      poNumber: '',
      closurePercent: 20,
      orderExpectedDate: '2026-06-01',
      orderExecutionBy: 'Dev Team',
      deliveryTarget: 'Go-live by June 15th',
      notes: 'Initial inquiry for a corporate website redesign and migration to Next.js.',
      images: [],
      enquiryItems: [
        { brand: 'Development', productCategory: 'Web Dev', productName: 'React Next.js Website' }
      ],
      createdAt: new Date().toISOString(),
    };
    const next = [demo, ...leads];
    setLeads(next);
    await syncLeads(next);
    toast.success('Demo lead added! Click it to explore the detail view.');
  };

  const syncClientTypes = async (nextClientTypes: string[]) => {
    setSyncing(true);
    try {
      await requestJson<{ ok: true; clientTypes: string[] }>('/api/client-types', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientTypes: nextClientTypes }),
      });

    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to sync client types');
    } finally {
      setSyncingStatus(false);
    }
  };

  const syncOwners = async (nextOwners: string[]) => {
    setSyncing(true);
    try {
      await requestJson<{ ok: true; owners: string[] }>('/api/owners', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owners: nextOwners }),
      });

    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to sync owners');
    } finally {
      setSyncingStatus(false);
    }
  };

  const syncProducts = async (nextProducts: Record<BrandName, ProductItem[]>) => {
    setSyncing(true);
    try {
      await requestJson<{ ok: true }>('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productsByBrand: nextProducts }),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to sync products');
    } finally {
      setSyncingStatus(false);
    }
  };

  const nextId = () => {
    const max = leads.reduce((acc, lead) => {
      const n = Number(lead.id.replace('ENQ-', ''));
      return Number.isFinite(n) ? Math.max(acc, n) : acc;
    }, 0);
    return `ENQ-${String(max + 1).padStart(4, '0')}`;
  };

  const resetForm = () => {
    setFormStep(1);
    setForm((prev) => ({
      ...prev,
      date: new Date().toISOString().slice(0, 10),
      clientName: '',
      email: '',
      phone: '',
      state: '',
      city: '',
      expectedValue: '0',
      quantity: '',
      poNumber: '',
      closurePercent: '',
      advanceValue: '0',
      productCategory: '',
      productName: '',
      orderExpectedDate: '',
      orderExecutionBy: '',
      deliveryTarget: '',
      notes: '',
      images: [],
      quoteUrl: '',
      enquiryItems: [],
    }));
  };

  const addEnquiryItem = () => {
    if (!form.productName.trim()) return;

    const line = normalizeLineItem({
      brand: form.brand,
      productCategory: form.productCategory,
      productName: form.productName,
    });

    setForm((prev) => {
      const exists = prev.enquiryItems.some(
        (item) =>
          item.brand === line.brand &&
          item.productCategory.toLowerCase() === line.productCategory.toLowerCase() &&
          item.productName.toLowerCase() === line.productName.toLowerCase(),
      );
      if (exists) return prev;
      return { ...prev, enquiryItems: [...prev.enquiryItems, line] };
    });
  };

  const removeEnquiryItem = (index: number) => {
    setForm((prev) => ({ ...prev, enquiryItems: prev.enquiryItems.filter((_, i) => i !== index) }));
  };

  const addClientType = () => {
    const value = newClientType.trim();
    if (!value) return;
    const exists = clientTypes.some((item) => item.toLowerCase() === value.toLowerCase());
    if (exists) {
      setForm((prev) => ({ ...prev, clientType: clientTypes.find((item) => item.toLowerCase() === value.toLowerCase()) || prev.clientType }));
      setNewClientType('');
      setAssistantMessage('Client type already exists. Selected in form.');
      return;
    }

    const updated = [...clientTypes, value];
    setClientTypes(updated);
    setForm((prev) => ({ ...prev, clientType: value }));
    setNewClientType('');
    setAssistantMessage(`Client type "${value}" added and selected.`);
    if (typeof window !== 'undefined') {
      localStorage.setItem(CLIENT_TYPES_CACHE_KEY, JSON.stringify(updated));
    }
    void syncClientTypes(updated);
  };

  const renameClientType = (currentType: string) => {
    const nextValue = prompt('Edit client type', currentType)?.trim();
    if (!nextValue || nextValue === currentType) return;

    const duplicate = clientTypes.some((type) => type.toLowerCase() === nextValue.toLowerCase() && type !== currentType);
    if (duplicate) {
      setAssistantMessage(`Client type "${nextValue}" already exists.`);
      return;
    }

    const updated = clientTypes.map((type) => (type === currentType ? nextValue : type));
    setClientTypes(updated);
    setForm((prev) => ({ ...prev, clientType: prev.clientType === currentType ? nextValue : prev.clientType }));
    setLeadEditDraft((prev) => (prev ? { ...prev, clientType: prev.clientType === currentType ? nextValue : prev.clientType } : prev));
    setAssistantMessage(`Client type updated: "${currentType}" to "${nextValue}".`);
    if (typeof window !== 'undefined') {
      localStorage.setItem(CLIENT_TYPES_CACHE_KEY, JSON.stringify(updated));
    }
    void syncClientTypes(updated);
  };

  const deleteClientType = (typeToDelete: string) => {
    if (clientTypes.length <= 1) {
      toast.error('At least one client type is required.');
      return;
    }
    if (!confirm(`Are you sure you want to delete "${typeToDelete}"?`)) return;

    const updated = clientTypes.filter((type) => type !== typeToDelete);
    setClientTypes(updated);
    setForm((prev) => ({
      ...prev,
      clientType: prev.clientType === typeToDelete ? updated[0] : prev.clientType,
    }));
    setLeadEditDraft((prev) => (
      prev
        ? {
          ...prev,
          clientType: prev.clientType === typeToDelete ? updated[0] : prev.clientType,
        }
        : prev
    ));
    toast.success(`Client type "${typeToDelete}" deleted`);
    if (typeof window !== 'undefined') {
      localStorage.setItem(CLIENT_TYPES_CACHE_KEY, JSON.stringify(updated));
    }
    void syncClientTypes(updated);
  };

  const addOwner = () => {
    const value = newOwner.trim();
    if (!value) return;
    const exists = ownerOptions.some((item) => item.toLowerCase() === value.toLowerCase());
    if (exists) {
      const selectedOwner = ownerOptions.find((item) => item.toLowerCase() === value.toLowerCase()) || value;
      setForm((prev) => ({ ...prev, owner: selectedOwner, orderExecutionBy: selectedOwner }));
      setNewOwner('');
      setAssistantMessage('Person already exists. Selected in form and order execution.');
      return;
    }

    const updated = [...ownerOptions, value];
    setOwners(updated);
    setForm((prev) => ({ ...prev, owner: value, orderExecutionBy: value }));
    setNewOwner('');
    setAssistantMessage(`Person "${value}" added and selected.`);
    if (typeof window !== 'undefined') {
      localStorage.setItem(OWNERS_CACHE_KEY, JSON.stringify(updated));
    }
    void syncOwners(updated);
  };

  const renameProduct = (brand: BrandName, code: string, newTitle: string) => {
    setProductsByBrand(prev => {
      const next = { ...prev };
      if (next[brand]) {
        next[brand] = next[brand].map(p => p.code === code ? { ...p, title: newTitle } : p);
      }
      return next;
    });
  };

  const deleteProduct = (brand: BrandName, code: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    setProductsByBrand(prev => {
      const next = { ...prev };
      if (next[brand]) {
        next[brand] = next[brand].filter(p => p.code !== code);
      }
      return next;
    });
    toast.success('Product deleted');
  };

  const startEditOwner = (person: string) => {
    setEditingOwner(person);
    setEditingOwnerValue(person);
  };

  const commitEditOwner = (currentOwner: string) => {
    const nextValue = editingOwnerValue.trim();
    setEditingOwner(null);
    if (!nextValue || nextValue === currentOwner) return;

    const duplicate = ownerOptions.some((owner) => owner.toLowerCase() === nextValue.toLowerCase() && owner !== currentOwner);
    if (duplicate) {
      toast.error(`Person "${nextValue}" already exists.`);
      return;
    }

    const updated = ownerOptions.map((owner) => (owner === currentOwner ? nextValue : owner));
    setOwners(updated);
    setForm((prev) => ({
      ...prev,
      owner: prev.owner === currentOwner ? nextValue : prev.owner,
      orderExecutionBy: prev.orderExecutionBy === currentOwner ? nextValue : prev.orderExecutionBy,
    }));
    setLeadEditDraft((prev) => (
      prev
        ? {
          ...prev,
          owner: prev.owner === currentOwner ? nextValue : prev.owner,
          orderExecutionBy: prev.orderExecutionBy === currentOwner ? nextValue : prev.orderExecutionBy,
        }
        : prev
    ));
    if (ownerFilter === currentOwner) {
      setOwnerFilter(nextValue);
    }
    toast.success(`Renamed "${currentOwner}" → "${nextValue}"`);
    if (typeof window !== 'undefined') {
      localStorage.setItem(OWNERS_CACHE_KEY, JSON.stringify(updated));
    }
    void syncOwners(updated);
  };

  const startEditProduct = (brand: BrandName, code: string, title: string) => {
    setEditingProductKey(`${brand}::${code}`);
    setEditingProductValue(title);
  };

  const commitEditProduct = (brand: BrandName, code: string) => {
    const newTitle = editingProductValue.trim();
    setEditingProductKey(null);
    if (!newTitle) return;
    setProductsByBrand(prev => {
      const next = { ...prev };
      if (next[brand]) {
        next[brand] = next[brand].map(p => p.code === code ? { ...p, title: newTitle } : p);
      }
      return next;
    });
    toast.success('Product title updated');
  };

  const deleteOwner = (ownerToDelete: string) => {
    if (ownerOptions.length <= 1) {
      toast.error('At least one person is required.');
      return;
    }
    if (!confirm(`Are you sure you want to remove "${ownerToDelete}" from the team?`)) return;

    const updated = ownerOptions.filter((owner) => owner !== ownerToDelete);
    const fallback = updated[0] || OWNER_SEED[0];
    setOwners(updated);
    setForm((prev) => ({
      ...prev,
      owner: prev.owner === ownerToDelete ? fallback : prev.owner,
      orderExecutionBy: prev.orderExecutionBy === ownerToDelete ? '' : prev.orderExecutionBy,
    }));
    setLeadEditDraft((prev) => (
      prev
        ? {
          ...prev,
          owner: prev.owner === ownerToDelete ? fallback : prev.owner,
          orderExecutionBy: prev.orderExecutionBy === ownerToDelete ? '' : prev.orderExecutionBy,
        }
        : prev
    ));
    if (ownerFilter === ownerToDelete) {
      setOwnerFilter('All');
    }
    toast.success(`Team member "${ownerToDelete}" removed`);
    if (typeof window !== 'undefined') {
      localStorage.setItem(OWNERS_CACHE_KEY, JSON.stringify(updated));
    }
    void syncOwners(updated);
  };

  const toDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error('Failed to read image'));
      reader.readAsDataURL(file);
    });

  const onSelectLeadImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    try {
      const encoded = (await Promise.all(files.map((file) => toDataUrl(file)))).filter(Boolean);
      setForm((prev) => ({ ...prev, images: [...prev.images, ...encoded].slice(0, 10) }));

    } catch {
      toast.error('Some images could not be processed.');
    } finally {
      event.target.value = '';
    }
  };

  const removeLeadImage = (index: number) => {
    setForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  };

  const onSelectEditLeadImages = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!leadEditDraft) return;
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    try {
      const encoded = (await Promise.all(files.map((file) => toDataUrl(file)))).filter(Boolean);
      setLeadEditDraft((prev) => (prev ? { ...prev, images: [...prev.images, ...encoded].slice(0, 10) } : prev));

    } catch {
      toast.error('Some images could not be processed.');
    } finally {
      event.target.value = '';
    }
  };

  const removeEditLeadImage = (index: number) => {
    setLeadEditDraft((prev) => (prev ? { ...prev, images: prev.images.filter((_, i) => i !== index) } : prev));
  };

  const openImagePreview = (lead: Lead) => {
    const images = lead.images || [];
    if (!images.length) return;
    setPreviewImages(images);
    setPreviewClientName(lead.clientName);
    setActivePreviewImage(0);
  };

  const closeImagePreview = () => {
    setPreviewImages([]);
    setPreviewClientName('');
    setActivePreviewImage(0);
  };

  const validateLeadForm = () => {
    if (!form.clientName.trim()) return 'Client Name is required.';
    if (!form.email.trim() && !form.phone.trim()) return 'Either Phone or Email is required.';
    return '';
  };

  const createLead = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateLeadForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const normalizedManual = normalizeLineItem({
      brand: form.brand,
      productCategory: form.productCategory,
      productName: form.productName,
    });

    const items = form.enquiryItems.length
      ? form.enquiryItems.map(normalizeLineItem)
      : normalizedManual.productName
        ? [normalizedManual]
        : [];

    const primary = items[0] || { brand: form.brand, productCategory: '', productName: '' };

    const newLead: Lead = {
      id: nextId(),
      date: form.date,
      clientName: form.clientName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      country: form.country.trim(),
      state: form.state.trim(),
      city: form.city.trim(),
      clientType: form.clientType,
      brand: primary.brand,
      productCategory: primary.productCategory,
      productName: primary.productName,
      owner: form.owner,
      status: form.status,
      priority: form.priority,
      expectedValue: Number(form.expectedValue || 0),
      quantity: Number.isFinite(Number(form.quantity)) ? Number(form.quantity) : undefined,
      poNumber: form.poNumber.trim(),
      closurePercent: Number.isFinite(Number(form.closurePercent))
        ? Math.max(0, Math.min(100, Number(form.closurePercent)))
        : undefined,
      advanceValue: Number(form.advanceValue || 0),
      orderExpectedDate: form.orderExpectedDate,
      orderExecutionBy: form.orderExecutionBy.trim(),
      deliveryTarget: form.deliveryTarget.trim(),
      notes: form.notes.trim(),
      images: form.images,
      quoteUrl: form.quoteUrl || undefined,
      enquiryItems: items,
      createdAt: new Date().toISOString(),
    };

    const previousLeads = [...leads];
    const optimisticLeads = [newLead, ...leads];
    
    // UI state updates (optimistic)
    setLeads(optimisticLeads);
    setTab('enquires');
    resetForm();
    toast.success('Lead created successfully!');

    setSyncingStatus(true);
    try {
      const payload = await requestJson<{ ok: true; lead: Lead }>('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead: newLead }),
      });

      const savedLead = payload.lead || newLead;
      const finalLeads = [savedLead, ...leads.filter((lead) => lead.id !== savedLead.id)];
      setLeads(finalLeads);
      
      if (typeof window !== 'undefined') {
        localStorage.setItem(LEADS_CACHE_KEY, JSON.stringify(finalLeads));
      }
    } catch (error) {
      // Rollback on error
      setLeads(previousLeads);
      toast.error(error instanceof Error ? error.message : 'Failed to save lead');
    } finally {
      setSyncingStatus(false);
    }
  };

  const cycleStatus = (id: string) => {
    const nextLeads = leads.map((lead) => {
      if (lead.id !== id) return lead;
      const i = STATUSES.indexOf(lead.status);
      const nextStatus = STATUSES[(i + 1) % STATUSES.length];
      const historyEntry = {
        date: new Date().toISOString(),
        action: 'Status Change',
        prev: lead.status,
        next: nextStatus
      };
      return {
        ...lead,
        status: nextStatus,
        history: [...(lead.history || []), historyEntry]
      };
    });
    setLeads(nextLeads);
    void syncLeads(nextLeads);
    toast.success('Status updated');
  };

  const deleteLead = (id: string) => {
    const nextLeads = leads.filter((lead) => lead.id !== id);
    setLeads(nextLeads);
    void syncLeads(nextLeads);
  };

  const copyQuoteShareLink = async (leadId: string) => {
    const shareUrl = `${window.location.origin}/quote/${leadId}/view`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Quote link copied');
    } catch {
      toast.error('Could not copy quote link');
    }
  };

  const shareOnWhatsApp = (leadId: string) => {
    const portalUrl = `${window.location.origin}/quote/${leadId.replace(/[^a-zA-Z0-9-]/g, '_')}/view`;
    const message = `Hello, please find the quotation for your enquiry (${leadId}) here: ${portalUrl}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  const startLeadEdit = (lead: Lead) => {
    const firstItem = Array.isArray(lead.enquiryItems) && lead.enquiryItems.length
      ? lead.enquiryItems[0]
      : { brand: lead.brand, productCategory: lead.productCategory, productName: lead.productName };
    const editItems = (Array.isArray(lead.enquiryItems) && lead.enquiryItems.length
      ? lead.enquiryItems
      : [firstItem]
    ).map(normalizeLineItem);

    setEditingLeadId(lead.id);
    setLeadEditDraft({
      date: lead.date,
      clientName: lead.clientName,
      email: lead.email,
      phone: lead.phone,
      country: lead.country,
      state: lead.state,
      city: lead.city,
      clientType: lead.clientType,
      brand: firstItem.brand,
      productCategory: firstItem.productCategory,
      productName: firstItem.productName,
      owner: lead.owner,
      status: lead.status,
      priority: lead.priority,
      expectedValue: String(lead.expectedValue),
      quantity: String(lead.quantity ?? ''),
      poNumber: lead.poNumber || '',
      closurePercent: String(lead.closurePercent ?? ''),
      advanceValue: String(lead.advanceValue ?? '0'),
      orderExpectedDate: lead.orderExpectedDate || '',
      orderExecutionBy: lead.orderExecutionBy || '',
      deliveryTarget: lead.deliveryTarget || '',
      notes: lead.notes,
      images: Array.isArray(lead.images) ? lead.images : [],
      enquiryItems: editItems,
      quoteUrl: lead.quoteUrl || '',
    });
  };

  const cancelLeadEdit = () => {
    setEditingLeadId(null);
    setLeadEditDraft(null);
  };

  const saveLeadEdit = () => {
    if (!editingLeadId || !leadEditDraft) return;
    if (!leadEditDraft.clientName.trim()) {
      toast.error('Client Name is required.');
      return;
    }
    if (!leadEditDraft.phone.trim() && !leadEditDraft.email.trim()) {
      toast.error('Either Phone or Email is required.');
      return;
    }
    const nextLeads = leads.map((lead) => {
      if (lead.id !== editingLeadId) return lead;

      const existingItems = Array.isArray(lead.enquiryItems) && lead.enquiryItems.length
        ? lead.enquiryItems
        : [{ brand: lead.brand, productCategory: lead.productCategory, productName: lead.productName }];
      const draftItems = Array.isArray(leadEditDraft.enquiryItems)
        ? leadEditDraft.enquiryItems.map(normalizeLineItem).filter((item) => item.productName)
        : [];
      const firstUpdated = normalizeLineItem({
        brand: leadEditDraft.brand,
        productCategory: leadEditDraft.productCategory || existingItems[0]?.productCategory || '',
        productName: leadEditDraft.productName,
      });
      const nextItems = draftItems.length
        ? draftItems
        : firstUpdated.productName
          ? [firstUpdated, ...existingItems.slice(1)]
          : existingItems;
      const primary = nextItems[0] || firstUpdated;

      return {
        ...lead,
        date: leadEditDraft.date,
        clientName: leadEditDraft.clientName.trim(),
        email: leadEditDraft.email.trim(),
        phone: leadEditDraft.phone.trim(),
        country: leadEditDraft.country.trim(),
        state: leadEditDraft.state.trim(),
        city: leadEditDraft.city.trim(),
        clientType: leadEditDraft.clientType,
        brand: primary.brand,
        productCategory: primary.productCategory,
        productName: primary.productName,
        enquiryItems: nextItems,
        owner: leadEditDraft.owner,
        status: leadEditDraft.status,
        priority: leadEditDraft.priority,
        expectedValue: Number(leadEditDraft.expectedValue || 0),
        quantity: Number.isFinite(Number(leadEditDraft.quantity)) ? Number(leadEditDraft.quantity) : undefined,
        poNumber: leadEditDraft.poNumber.trim(),
        closurePercent: Number.isFinite(Number(leadEditDraft.closurePercent))
          ? Math.max(0, Math.min(100, Number(leadEditDraft.closurePercent)))
          : undefined,
        advanceValue: Number(leadEditDraft.advanceValue || 0),
        orderExpectedDate: leadEditDraft.orderExpectedDate,
        orderExecutionBy: leadEditDraft.orderExecutionBy.trim(),
        deliveryTarget: leadEditDraft.deliveryTarget.trim(),
        notes: leadEditDraft.notes.trim(),
        images: leadEditDraft.images,
        quoteUrl: leadEditDraft.quoteUrl || undefined,
      };
    });

    setLeads(nextLeads);
    void syncLeads(nextLeads);
    cancelLeadEdit();
  };

  const exportLeads = (rows: Lead[], fileName: string) => {
    const sheetData = rows.map((lead) => {
      const items = Array.isArray(lead.enquiryItems) && lead.enquiryItems.length
        ? lead.enquiryItems
        : [{ brand: lead.brand, productCategory: lead.productCategory, productName: lead.productName }];

      return {
        ID: lead.id,
        Date: lead.date,
        Client: lead.clientName,
        Email: lead.email,
        Phone: lead.phone,
        Country: lead.country,
        State: lead.state,
        City: lead.city,
        ClientType: lead.clientType,
        Brand: items.map((item) => item.brand).join(' | '),
        Category: items.map((item) => item.productCategory).join(' | '),
        Product: items.map((item) => item.productName).join(' | '),
        Owner: lead.owner,
        Status: lead.status,
        Priority: lead.priority,
        ExpectedValueINR: lead.expectedValue,
        AdvanceReceivedINR: lead.advanceValue || 0,
        Quantity: lead.quantity ?? '',
        PO: lead.poNumber || '',
        ClosurePercent: lead.closurePercent ?? '',
        OrderExpectedDate: lead.orderExpectedDate || '',
        OrderExecutionBy: lead.orderExecutionBy || '',
        DeliveryTarget: lead.deliveryTarget || '',
        ProductDetails: lead.notes,
        ImagesCount: lead.images?.length || 0,
      };
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');
    XLSX.writeFile(workbook, fileName);
  };

  const applyPatchToForm = (patch: AIFieldPatch) => {
    setForm((prev) => {
      const nextLines = Array.isArray(patch.productLines) && patch.productLines.length
        ? patch.productLines.map(normalizeLineItem)
        : prev.enquiryItems;
      const firstLine = nextLines[0];

      return {
        ...prev,
        date: patch.date || prev.date,
        clientName: patch.clientName || prev.clientName,
        email: patch.email || prev.email,
        phone: patch.phone || prev.phone,
        country: patch.country || prev.country,
        state: patch.state || prev.state,
        city: patch.city || prev.city,
        clientType: patch.clientType || prev.clientType,
        brand: firstLine?.brand || patch.brand || prev.brand,
        productCategory: firstLine?.productCategory || patch.productCategory || prev.productCategory,
        productName: firstLine?.productName || patch.productName || prev.productName,
        enquiryItems: nextLines,
        owner: patch.owner || prev.owner,
        status: patch.status || prev.status,
        priority: patch.priority || prev.priority,
        expectedValue: patch.expectedValue !== undefined ? String(patch.expectedValue) : prev.expectedValue,
        quantity: patch.quantity !== undefined ? String(patch.quantity) : prev.quantity,
        poNumber: patch.poNumber || prev.poNumber,
        closurePercent: patch.closurePercent !== undefined ? String(patch.closurePercent) : prev.closurePercent,
        orderExpectedDate: patch.orderExpectedDate || prev.orderExpectedDate,
        orderExecutionBy: patch.orderExecutionBy || prev.orderExecutionBy,
        deliveryTarget: patch.deliveryTarget || prev.deliveryTarget,
        notes: patch.notes ? `${prev.notes ? `${prev.notes}\n` : ''}${patch.notes}` : prev.notes,
      };
    });
  };

  const sanitizeAIPatch = (patch: AIFieldPatch): { patch: AIFieldPatch; messages: string[] } => {
    const next: AIFieldPatch = { ...patch };
    const messages: string[] = [];

    if (next.owner && !ownerOptions.some((owner) => owner.toLowerCase() === next.owner?.toLowerCase())) {
      messages.push(`Owner \"${next.owner}\" not recognized, kept current owner.`);
      delete next.owner;
    }

    if (next.status && !STATUSES.includes(next.status as LeadStatus)) {
      messages.push(`Status \"${next.status}\" not recognized, kept current status.`);
      delete next.status;
    }

    if (next.brand && !BRANDS.includes(next.brand)) {
      messages.push(`Brand \"${next.brand}\" not recognized, kept current brand.`);
      delete next.brand;
    }

    if (Array.isArray(next.productLines)) {
      const mapped = next.productLines
        .map((line) => {
          const brand = BRANDS.includes(line.brand) ? line.brand : next.brand;
          const productName = line.productName?.trim() || '';
          const productCategory = line.productCategory?.trim() || '';
          if (!brand || !productName) return null;
          return { brand, productCategory, productName };
        })
        .filter((line): line is EnquiryLineItem => !!line);

      const unique: EnquiryLineItem[] = [];
      const seen = new Set<string>();
      mapped.forEach((item) => {
        const key = `${item.brand}::${item.productName}`.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        unique.push(item);
      });

      if (unique.length) {
        next.productLines = unique;
        next.brand = unique[0].brand;
        next.productCategory = unique[0].productCategory;
        next.productName = unique[0].productName;
      } else {
        delete next.productLines;
      }
    } else {
      if (next.productName) next.productName = next.productName.trim();
      if (next.productCategory) next.productCategory = next.productCategory.trim();
    }

    return { patch: next, messages };
  };

  const runAILeadAssist = async () => {
    if (!assistantInput.trim()) return;
    setAssistantBusy(true);
    setAssistantMessage('Processing input with AI...');

    try {
      const response = await fetch('/api/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: assistantInput,
          brands: BRANDS,
          owners: ownerOptions,
          statuses: STATUSES,
          clientTypes,
        }),
      });

      const payload = (await response.json()) as { patch?: AIFieldPatch; error?: string };
      if (!response.ok || !payload.patch) throw new Error(payload.error || 'AI assist failed');
      const normalized = sanitizeAIPatch(payload.patch);
      applyPatchToForm(normalized.patch);
      setFormStep(3); // Go to final step to review AI filled details
      setIsAssistantOpen(false); // Close drawer
      toast.success('AI filled the form details! Review them in Step 3.');
      setAssistantMessage(
        normalized.messages.length
          ? `AI filled form with checks: ${normalized.messages.join(' ')}`
          : 'AI filled the form successfully with brand and product details.',
      );
      setTab('new-enquires');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'AI assist failed';
      setAssistantMessage(msg);
      alert(msg);
    } finally {
      setAssistantBusy(false);
    }
  };

  const askAI = async () => {
    if (!chatQuestion.trim()) return;
    setChatBusy(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: chatQuestion, leads }),
      });
      const payload = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok || !payload.answer) throw new Error(payload.error || 'AI chat failed');
      setChatAnswer(payload.answer);
    } catch (error) {
      setChatAnswer(error instanceof Error ? error.message : 'AI chat failed');
    } finally {
      setChatBusy(false);
    }
  };

  const startVoiceCapture = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (listening) return;

    const recognition = new Recognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const last = event.results[event.results.length - 1];
      const text = last?.[0]?.transcript || '';
      if (!text) return;
      setAssistantInput((prev) => (prev ? `${prev} ${text}` : text));
    };
    recognition.onerror = () => {
      setListening(false);
      alert('Voice input failed. Try again.');
    };
    recognition.onend = () => {
      setListening(false);
    };
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  };

  const stopVoiceCapture = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const smartPromptSet = [
    'Client: Future Tech, city: Bangalore, country: India, brand: Development, product: React Next.js Website, productCategory: Website Development, owner: Shuja, priority: High, budget: 500000',
    'Client: Orion Interiors, city: Mumbai, country: India, brand: Creative Services, product: Mobile App UI, productCategory: UI/UX Designing, owner: Rahul, status: New, priority: High, budget: 800000',
    'Client: Greenline Build, city: Bangalore, country: India, brand: Digital Marketing, product: SEO Audit, productCategory: SEO Services, owner: Priya, status: Contacted, budget: 600000',
  ];

  return (
    <div className={`app-layout ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="app-sidebar">
        <div className="sidebar-toggle-fixed" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            {isSidebarCollapsed ? (
              <path d="m9 18 6-6-6-6" />
            ) : (
              <path d="m15 18-6-6 6-6" />
            )}
          </svg>
        </div>
        <div className="app-sidebar-header">
          <div className="premium-branding">
            <div className="brand-meta">
              <h1 className="brand-artistic">
                <span className="brand-name">{isSidebarCollapsed ? 'PK' : 'Pixelkrafts'}</span>
                {!isSidebarCollapsed && (
                  <>
                    <span className="brand-divider"></span>
                    <span className="brand-type">CRM</span>
                  </>
                )}
              </h1>
            </div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')} title="Insights">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            <span>Insights</span>
          </button>
          <button className={`nav-item ${tab === 'enquires' ? 'active' : ''}`} onClick={() => setTab('enquires')} title="Pipeline">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            <span>Pipeline</span>
          </button>
          <button className={`nav-item ${tab === 'new-enquires' ? 'active' : ''}`} onClick={() => setTab('new-enquires')} title="Capture Lead">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
            <span>Capture Lead</span>
          </button>
          <button className={`nav-item ${tab === 'quotes' ? 'active' : ''}`} onClick={() => setTab('quotes')} title="Quotations">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            <span>Quotations</span>
          </button>
          <div className="nav-divider" />
          <button className={`nav-item ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
            <span>Products</span>
          </button>
          <button className={`nav-item ${tab === 'people' ? 'active' : ''}`} onClick={() => setTab('people')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            <span>Team</span>
          </button>
          <button className={`nav-item ${tab === 'templates' ? 'active' : ''}`} onClick={() => setTab('templates')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
            <span>Letterheads</span>
          </button>
          <button className="nav-item" onClick={() => window.open('https://bank.pixelkrafts.in', '_blank')} title="Payments">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
            <span>Payments</span>
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">SR</div>
            {!isSidebarCollapsed && (
              <div className="user-info">
                <span className="user-name">Shuja Rahman</span>
                <span className="user-role">Administrator</span>
              </div>
            )}
          </div>

          <button
            className="signout-footer-btn"
            onClick={handleLogout}
            title="Sign Out"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
            {!isSidebarCollapsed && <span>Sign Out</span>}
          </button>

          {!isSidebarCollapsed && (
            <div className="creator-credit">
              CRM v3.0.0 • Pixelkrafts
            </div>
          )}
        </div>
      </aside>

      <main className="app-main">
        <header className="header" style={{
          padding: '0 32px',
          borderBottom: '1px solid var(--line)',
          backgroundColor: 'var(--paper)',
          height: '64px',
          marginBottom: 0,
          position: 'sticky',
          top: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{ flex: 1 }}></div>
          <div className="meta-stack" style={{ flexWrap: 'nowrap', alignItems: 'center' }}>
            <button className="mode-toggle" onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}>
              {mounted && (theme === 'light' ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>)}
            </button>
            {syncing && (
              <div className="meta-pill sync-indicator" style={{ display: 'flex', alignItems: 'center', gap: '6px', borderColor: 'var(--blue)', color: 'var(--blue)', background: 'var(--blue-soft)' }}>
                <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ animation: 'spin 1s linear infinite' }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <span>Saving...</span>
              </div>
            )}
            {!syncing && mounted && (
              <div className="meta-pill" style={{ opacity: 0.6, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ color: 'var(--green)' }}><polyline points="20 6 9 17 4 12"></polyline></svg>
                Synced
              </div>
            )}
            <div className="meta-pill" style={{ whiteSpace: 'nowrap' }}>{analytics.totalLeads} leads</div>
            <div className="meta-pill" style={{ whiteSpace: 'nowrap' }}>{money(analytics.totalValue)} pipeline</div>
            <div className="meta-pill" style={{ whiteSpace: 'nowrap' }}>{money(analytics.openValue)} open pipeline</div>
          </div>
        </header>

        <div className="container" style={{ paddingTop: '24px' }}>


          {isLoading && (
            <section className="global-skeleton-wrap">
              <div className="skeleton-stats">
                {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="sk-card-mini" />)}
              </div>
              <div className="sk-card-main" />
              <style jsx>{`
              .global-skeleton-wrap { display: flex; flex-direction: column; gap: 24px; padding-top: 12px; }
              .skeleton-stats { display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px; }
              .sk-card-mini { height: 100px; background: var(--paper-strong); border-radius: 12px; border: 1px solid var(--line); position: relative; overflow: hidden; }
              .sk-card-main { height: 500px; background: var(--paper-strong); border-radius: 16px; border: 1px solid var(--line); position: relative; overflow: hidden; }
              .sk-card-mini::after, .sk-card-main::after {
                content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                background: linear-gradient(90deg, transparent, var(--line-strong), transparent);
                animation: shimmer 2s infinite linear;
              }
              @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
            `}</style>
            </section>
          )}

          {!isLoading && tab === 'dashboard' && (
            <section>
              <div className="stats-grid">
                {[
                  ['Total Leads', String(analytics.totalLeads)],
                  ['Open Leads', String(analytics.openLeads)],
                  ['Open Pipeline', money(analytics.openValue)],
                  ['Conversion Rate', `${analytics.conversionRate.toFixed(1)}%`],
                  ['Won Value', money(analytics.wonValue)],
                  ['Avg Deal Size', money(analytics.avgDeal)],
                  ['Avg Open Deal', money(analytics.avgOpenDeal)],
                  ['Stale > 7 Days', String(analytics.staleCount)],
                  ['Quote Sent Value', money(analytics.quoteSentValue)],
                ].map(([label, value]) => (
                  <article className="card stat-card" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </article>
                ))}
              </div>

              <div className="three-col metric-ribbon" style={{ marginTop: '18px' }}>
                <article className="card panel">
                  <h3>Pipeline Health</h3>
                  <div className="line-item">
                    <span>Open Share</span>
                    <strong>{analytics.openPipelineShare.toFixed(1)}%</strong>
                  </div>
                  <div className="line-item">
                    <span>Open Value</span>
                    <strong>{money(analytics.openValue)}</strong>
                  </div>
                  <div className="line-item">
                    <span>Quoted Value</span>
                    <strong>{money(analytics.quoteSentValue)}</strong>
                  </div>
                </article>
                <article className="card panel">
                  <h3>Lead Momentum</h3>
                  <div className="line-item">
                    <span>Open Leads</span>
                    <strong>{analytics.openLeads}</strong>
                  </div>
                  <div className="line-item">
                    <span>Won Leads</span>
                    <strong>{analytics.byStatus['Order Confirmed'] || 0}</strong>
                  </div>
                  <div className="line-item">
                    <span>Stale Leads</span>
                    <strong>{analytics.staleCount}</strong>
                  </div>
                </article>
                <article className="card panel">
                  <h3>Revenue Signal</h3>
                  <div className="line-item">
                    <span>Total Pipeline</span>
                    <strong>{money(analytics.totalValue)}</strong>
                  </div>
                  <div className="line-item">
                    <span>Won Value</span>
                    <strong>{money(analytics.wonValue)}</strong>
                  </div>
                  <div className="line-item">
                    <span>Average Deal</span>
                    <strong>{money(analytics.avgDeal)}</strong>
                  </div>
                </article>
              </div>

              <div className="three-col metric-ribbon">
                <article className="card panel">
                  <h3>Priority Mix</h3>
                  {(['High', 'Medium', 'Low'] as Priority[]).map((level) => (
                    <div className="line-item" key={level}>
                      <span>{level}</span>
                      <strong>{analytics.byPriority[level] || 0}</strong>
                    </div>
                  ))}
                </article>
                <article className="card panel">
                  <h3>Status Funnel</h3>
                  {STATUSES.map((status) => (
                    <div className="line-item" key={status}>
                      <span>{status}</span>
                      <strong>{analytics.byStatus[status] || 0}</strong>
                    </div>
                  ))}
                </article>
                <article className="card panel">
                  <div className="header" style={{ padding: 0, border: 'none', background: 'transparent', height: 'auto', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0 }}>Monthly Trend</h3>
                    <span className="status">Last 6 Months</span>
                  </div>
                  <div className="chart-container">
                    {analytics.trend.length > 1 ? (
                      <svg className="trend-chart-svg" viewBox="0 0 400 150">
                        <defs>
                          <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--text)" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="var(--text)" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        {(() => {
                          const maxVal = Math.max(...analytics.trend.map(t => t[1]), 1);
                          const points = analytics.trend.map((t, i) => ({
                            x: (i / (analytics.trend.length - 1)) * 400,
                            y: 150 - (t[1] / maxVal) * 120 - 20,
                            val: t[1],
                            month: t[0]
                          }));
                          const linePath = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
                          const areaPath = `${linePath} L ${points[points.length - 1].x},150 L 0,150 Z`;

                          return (
                            <g>
                              <path d={areaPath} className="trend-area" />
                              <path d={linePath} className="trend-line" />
                              {points.map((p, i) => (
                                <g key={i}>
                                  <circle cx={p.x} cy={p.y} r="4" fill="var(--paper)" stroke="var(--text)" strokeWidth="2" />
                                  <text x={p.x} y={p.y - 12} textAnchor="middle" className="chart-label" style={{ fill: 'var(--text)' }}>{p.val}</text>
                                  <text x={p.x} y="145" textAnchor="middle" className="chart-label" style={{ fill: 'var(--muted)' }}>{p.month}</text>
                                </g>
                              ))}
                            </g>
                          );
                        })()}
                      </svg>
                    ) : (
                      <div className="empty compact">Not enough data for trend</div>
                    )}
                  </div>
                </article>
              </div>

              <div className="two-col">
                <article className="card panel">
                  <h3>Brand Distribution</h3>
                  {Object.entries(analytics.byBrand).map(([brand, count]) => {
                    const max = Math.max(...Object.values(analytics.byBrand), 1);
                    return (
                      <div className="bar-row" key={brand}>
                        <span>{brand}</span>
                        <div className="bar-wrap">
                          <div className="bar-fill" style={{ width: `${Math.round((count / max) * 100)}%` }} />
                        </div>
                        <strong>{count}</strong>
                      </div>
                    );
                  })}
                  <h3 className="subheading">Top Products</h3>
                  {analytics.topProducts.map(([name, count]) => (
                    <div className="line-item" key={name}>
                      <span>{name}</span>
                      <strong>{count}</strong>
                    </div>
                  ))}
                </article>

                <article className="card panel">
                  <h3>Owner Performance</h3>
                  {analytics.ownerBoard.map((owner) => (
                    <div className="leader-item" key={owner.name}>
                      <div>
                        <div className="leader-name">{owner.name}</div>
                        <small>
                          {owner.leads} leads | Win rate {owner.winRate.toFixed(0)}%
                        </small>
                      </div>
                      <strong>{money(owner.value)}</strong>
                    </div>
                  ))}
                </article>
              </div>

              <div className="two-col stretch">
                <article className="card panel">
                  <h3>AI Analytics Chat</h3>
                  <div className="toolbar compact">
                    <input
                      className="field"
                      value={chatQuestion}
                      onChange={(e) => setChatQuestion(e.target.value)}
                      placeholder="Ask: which region is slow, owner with biggest risk, what to prioritize this week"
                    />
                    <button className="btn primary" onClick={askAI} disabled={chatBusy}>
                      {chatBusy ? 'Thinking...' : 'Ask AI'}
                    </button>
                  </div>
                  <div className="answer-box">{chatAnswer}</div>
                </article>

                <article className="card panel">
                  <h3>Recent Enquires</h3>
                  {analytics.recent.map((lead) => (
                    <div className="line-item" key={lead.id}>
                      <div>
                        <div>{lead.clientName}</div>
                        <small>
                          {lead.brand} | {lead.productName || 'No product yet'} | {relativeTime(lead.createdAt)}
                        </small>
                      </div>
                      <span className={`status ${statusClass(lead.status)}`}>{lead.status}</span>
                    </div>
                  ))}
                </article>
              </div>
            </section>
          )}

          {!isLoading && tab === 'enquires' && (
            <div className="enquiry-pipeline-view">
              <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '8px' }}>Enquiry Pipeline</h1>
                <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Manage and track all active sales opportunities.</p>
              </div>

              <section className="card panel">
                <div className="kpi-strip">
                  <div className="kpi-box">
                    <span>Filtered Leads</span>
                    <strong>{filteredLeads.length}</strong>
                  </div>
                  <div className="kpi-box">
                    <span>Filtered Value</span>
                    <strong>{money(filteredLeads.reduce((acc, x) => acc + x.expectedValue, 0))}</strong>
                  </div>
                  <div className="kpi-box">
                    <span>High Priority</span>
                    <strong>{filteredLeads.filter((x) => x.priority === 'High').length}</strong>
                  </div>
                </div>

                <div className="toolbar" style={{ padding: '16px 24px', borderBottom: '1px solid var(--line)', gap: '16px' }}>
                  <div className="search-container">
                    <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input
                      ref={searchInputRef}
                      className="search-input"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search Enquiries..."
                      style={{ height: '36px' }}
                    />
                  </div>

                  <div className="view-toggle">
                    <button className={`btn ${viewMode === 'table' ? 'primary' : ''}`} onClick={() => setViewMode('table')}>Table</button>
                    <button className={`btn ${viewMode === 'kanban' ? 'primary' : ''}`} onClick={() => setViewMode('kanban')}>Board</button>
                  </div>

                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                    <button className="btn" onClick={() => exportLeads(leads, `all-leads-${Date.now()}.xlsx`)}>Export</button>
                  </div>
                </div>

                <div className="filter-bar">
                  <div className="filter-group">
                    <label className="filter-label">Brand</label>
                    <select className="filter-select" value={brandFilter} onChange={(e) => setBrandFilter(e.target.value as 'All' | BrandName)}>
                      <option value="All">All Brands</option>
                      {BRANDS.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
                    </select>
                  </div>
                  <div className="filter-group">
                    <label className="filter-label">Status</label>
                    <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'All' | LeadStatus)}>
                      <option value="All">All Status</option>
                      {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </div>
                  <div className="filter-group">
                    <label className="filter-label">Owner</label>
                    <select className="filter-select" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value as 'All' | string)}>
                      <option value="All">All Owners</option>
                      {ownerOptions.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
                    </select>
                  </div>
                  <button className="btn-link" style={{ marginLeft: 'auto' }} onClick={() => { setSearch(''); setBrandFilter('All'); setStatusFilter('All'); setOwnerFilter('All'); }}>Clear</button>
                </div>

                {viewMode === 'table' ? (
                  <div className="table-wrap">
                    <table className="enquiry-table">
                      <thead>
                        <tr>
                          {['ID', 'Date', 'Client', 'Brand', 'Enquiry', 'Nos', 'Status', 'PO', 'Closure %', 'Budget', 'Priority', 'Actions', 'Images'].map((h) => (
                            <th key={h}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {!filteredLeads.length && (
                          <tr>
                            <td colSpan={13} style={{ padding: '80px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>
                              No enquiries found.
                            </td>
                          </tr>
                        )}
                        {filteredLeads.map((lead) => {
                          const leadItems = getLeadItems(lead);
                          const requestedNos = Number.isFinite(Number(lead.quantity)) && Number(lead.quantity) > 0
                            ? Number(lead.quantity)
                            : leadItems.length || '-';
                          return (
                            <Fragment key={lead.id}>
                              <tr key={lead.id} className="enquiry-row" onClick={() => router.push(`/enquiry/${lead.id}`)} style={{ cursor: 'pointer' }}>
                                <td>{lead.id}</td>
                                <td>{formatDate(lead.date)}</td>
                                <td>
                                  <div className="client-main">{lead.clientName}</div>
                                  <small className="client-subtext">
                                    {lead.city}, {lead.country}
                                  </small>
                                  <small className="client-subtext">
                                    {leadItems.length} enquiry item{leadItems.length > 1 ? 's' : ''}
                                  </small>
                                </td>
                                <td>
                                  {[...new Set(leadItems.map((item) => item.brand))].join(', ') || lead.brand}
                                </td>
                                <td>
                                  <div>
                                    {leadItems.slice(0, 2).map((item, idx) => (
                                      <small key={`${lead.id}-product-${idx}`}>
                                        {item.productName || 'No product'}
                                        {item.productCategory ? ` (category: ${item.productCategory})` : ''}
                                      </small>
                                    ))}
                                    {!leadItems.length && <small>No product yet</small>}
                                    {leadItems.length > 2 && <small>+{leadItems.length - 2} more</small>}
                                  </div>
                                </td>
                                <td>{requestedNos}</td>
                                <td className="status-cell">
                                  <span className={`status status-pill ${statusClass(lead.status)}`}>{lead.status}</span>
                                </td>
                                <td>{lead.poNumber || '-'}</td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div className="lead-intelligence-score" style={{ width: '40px', marginBottom: 0 }}>
                                      <div
                                        className="lead-intelligence-fill"
                                        style={{
                                          width: `${lead.closurePercent || 0}%`,
                                          backgroundColor: (lead.closurePercent || 0) > 70 ? 'var(--green)' : (lead.closurePercent || 0) > 40 ? 'var(--amber)' : 'var(--danger)'
                                        }}
                                      ></div>
                                    </div>
                                    <span>{lead.closurePercent !== undefined ? `${lead.closurePercent}%` : '-'}</span>
                                  </div>
                                </td>
                                <td>{money(lead.expectedValue)}</td>
                                <td>{lead.priority}</td>
                                <td>
                                  <div className="act-row act-row-tight">
                                    <button className="btn btn-compact" onClick={(e) => { e.stopPropagation(); router.push(`/enquiry/${lead.id}`); }}>
                                      View
                                    </button>
                                    <button className="btn btn-compact" onClick={(e) => { e.stopPropagation(); cycleStatus(lead.id); }}>
                                      Next
                                    </button>
                                    <button className="btn btn-compact" onClick={(e) => { e.stopPropagation(); startLeadEdit(lead); }}>
                                      Edit
                                    </button>
                                    <button className="btn btn-compact" onClick={(e) => { e.stopPropagation(); deleteLead(lead.id); }}>
                                      Delete
                                    </button>
                                  </div>
                                </td>
                                <td>
                                  {lead.images?.length ? (
                                    <button className="btn image-preview-btn" onClick={(e) => { e.stopPropagation(); openImagePreview(lead); }}>
                                      <img src={lead.images[0]} alt={`${lead.clientName} preview`} />
                                      <span>View ({lead.images.length})</span>
                                    </button>
                                  ) : (
                                    <small>No images</small>
                                  )}
                                </td>
                              </tr>
                              {editingLeadId === lead.id && leadEditDraft && (
                                <tr key={`${lead.id}-edit`}>
                                  <td colSpan={13}>
                                    <div className="inline-edit-grid">
                                      <div><label>Lead Date</label><input className="field" type="date" value={leadEditDraft.date} onChange={(e) => setLeadEditDraft((p) => (p ? { ...p, date: e.target.value } : p))} /></div>
                                      <div><label>Client Name</label><input className="field" value={leadEditDraft.clientName} onChange={(e) => setLeadEditDraft((p) => (p ? { ...p, clientName: e.target.value } : p))} /></div>
                                      <div><label>Phone</label><input className="field" value={leadEditDraft.phone} onChange={(e) => setLeadEditDraft((p) => (p ? { ...p, phone: e.target.value } : p))} /></div>
                                      <div><label>Email</label><input className="field" value={leadEditDraft.email} onChange={(e) => setLeadEditDraft((p) => (p ? { ...p, email: e.target.value } : p))} /></div>
                                      <div><label>Country</label><input className="field" value={leadEditDraft.country} onChange={(e) => setLeadEditDraft((p) => (p ? { ...p, country: e.target.value } : p))} /></div>
                                      <div><label>State</label><input className="field" value={leadEditDraft.state} onChange={(e) => setLeadEditDraft((p) => (p ? { ...p, state: e.target.value } : p))} /></div>
                                      <div><label>City</label><input className="field" value={leadEditDraft.city} onChange={(e) => setLeadEditDraft((p) => (p ? { ...p, city: e.target.value } : p))} /></div>
                                      <div><label>Client Type</label>
                                        <input
                                          className="field"
                                          value={leadEditDraft.clientType}
                                          list="client-types-list"
                                          onChange={(e) => setLeadEditDraft((p) => (p ? { ...p, clientType: e.target.value } : p))}
                                        />
                                      </div>
                                      <div><label>Brand</label><select className="field" value={leadEditDraft.brand} onChange={(e) => {
                                        const brand = e.target.value as BrandName;
                                        setLeadEditDraft((p) => (p ? { ...p, brand } : p));
                                      }}>
                                        {BRANDS.map((v) => (
                                          <option key={v} value={v}>
                                            {v}
                                          </option>
                                        ))}
                                      </select></div>
                                      <div><label>Product</label>
                                        <input
                                          className="field"
                                          value={leadEditDraft.productName}
                                          list="products-list"
                                          onChange={(e) => setLeadEditDraft((p) => (p ? { ...p, productName: e.target.value } : p))}
                                        />
                                      </div>
                                      <div><label>Owner</label><select className="field" value={leadEditDraft.owner} onChange={(e) => setLeadEditDraft((p) => (p ? { ...p, owner: e.target.value } : p))}>
                                        {!ownerOptions.includes(leadEditDraft.owner) && leadEditDraft.owner ? (
                                          <option value={leadEditDraft.owner}>{leadEditDraft.owner}</option>
                                        ) : null}
                                        {ownerOptions.map((v) => (
                                          <option key={v} value={v}>
                                            {v}
                                          </option>
                                        ))}
                                      </select></div>
                                      <div><label>Status</label><select className="field" value={leadEditDraft.status} onChange={(e) => setLeadEditDraft((p) => (p ? { ...p, status: e.target.value as LeadStatus } : p))}>
                                        {STATUSES.map((v) => (
                                          <option key={v} value={v}>
                                            {v}
                                          </option>
                                        ))}
                                      </select></div>
                                      <div><label>Priority</label><select className="field" value={leadEditDraft.priority} onChange={(e) => setLeadEditDraft((p) => (p ? { ...p, priority: e.target.value as Priority } : p))}>
                                        {(['High', 'Medium', 'Low'] as Priority[]).map((v) => (
                                          <option key={v} value={v}>
                                            {v}
                                          </option>
                                        ))}
                                      </select></div>
                                      <div><label>Expected Value</label><input className="field" type="number" value={leadEditDraft.expectedValue} onChange={(e) => setLeadEditDraft((p) => (p ? { ...p, expectedValue: e.target.value } : p))} /></div>
                                      <div><label>Advance Received</label><input className="field" type="number" value={leadEditDraft.advanceValue} onChange={(e) => setLeadEditDraft((p) => (p ? { ...p, advanceValue: e.target.value } : p))} /></div>
                                      <div><label>Nos</label><input className="field" type="number" min="0" value={leadEditDraft.quantity} onChange={(e) => setLeadEditDraft((p) => (p ? { ...p, quantity: e.target.value } : p))} /></div>
                                      <div><label>PO</label><input className="field" value={leadEditDraft.poNumber} onChange={(e) => setLeadEditDraft((p) => (p ? { ...p, poNumber: e.target.value } : p))} /></div>
                                      <div><label>Closure %</label><input className="field" type="number" min="0" max="100" value={leadEditDraft.closurePercent} onChange={(e) => setLeadEditDraft((p) => (p ? { ...p, closurePercent: e.target.value } : p))} /></div>
                                      <div><label>Order Execution By</label><select className="field" value={leadEditDraft.orderExecutionBy} onChange={(e) => setLeadEditDraft((p) => (p ? { ...p, orderExecutionBy: e.target.value } : p))}>
                                        <option value="">Order Execution By</option>
                                        {!ownerOptions.includes(leadEditDraft.orderExecutionBy) && leadEditDraft.orderExecutionBy ? (
                                          <option value={leadEditDraft.orderExecutionBy}>{leadEditDraft.orderExecutionBy}</option>
                                        ) : null}
                                        {ownerOptions.map((v) => (
                                          <option key={`exec-${v}`} value={v}>
                                            {v}
                                          </option>
                                        ))}
                                      </select></div>
                                      <div><label>Delivery Target</label><input className="field" value={leadEditDraft.deliveryTarget} onChange={(e) => setLeadEditDraft((p) => (p ? { ...p, deliveryTarget: e.target.value } : p))} /></div>
                                      <div className="span-2"><label>Product Details</label><textarea className="field" value={leadEditDraft.notes} onChange={(e) => setLeadEditDraft((p) => (p ? { ...p, notes: e.target.value } : p))} /></div>


                                      <div className="span-2" style={{ borderTop: '1px solid var(--line)', paddingTop: '16px', marginTop: '8px' }}>
                                        <label style={{ marginBottom: '12px', display: 'block' }}>Enquiry Items</label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                          {leadEditDraft.enquiryItems.map((item, idx) => (
                                            <div key={idx} className="mgmt-list-item" style={{ padding: '8px 12px', background: 'var(--paper-strong)', borderRadius: '8px', borderBottom: 'none' }}>
                                              <div className="mgmt-item-icon" style={{ background: 'var(--blue-soft)', color: 'var(--blue)', width: '28px', height: '28px' }}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                              </div>
                                              <div className="mgmt-item-body">
                                                <span className="mgmt-item-name" style={{ fontSize: '12px' }}>{item.brand} | {item.productName}</span>
                                                <span className="mgmt-item-meta" style={{ fontSize: '10px' }}>{item.productCategory}</span>
                                              </div>
                                              <button
                                                className="mgmt-delete-btn"
                                                style={{ opacity: 1, width: '24px', height: '24px' }}
                                                onClick={() => {
                                                  if (confirm('Remove this item?')) {
                                                    setLeadEditDraft(p => p ? { ...p, enquiryItems: p.enquiryItems.filter((_, i) => i !== idx) } : p);
                                                  }
                                                }}
                                              >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                              </button>
                                            </div>
                                          ))}
                                          <div className="act-row" style={{ marginTop: '4px' }}>
                                            <input
                                              className="field"
                                              placeholder="Add product name..."
                                              id={`edit-add-prod-${lead.id}`}
                                              list="products-list"
                                            />
                                            <button
                                              className="btn primary"
                                              onClick={() => {
                                                const input = document.getElementById(`edit-add-prod-${lead.id}`) as HTMLInputElement;
                                                const val = input.value.trim();
                                                if (val) {
                                                  setLeadEditDraft(p => p ? { ...p, enquiryItems: [...p.enquiryItems, { brand: p.brand, productCategory: p.productCategory, productName: val }] } : p);
                                                  input.value = '';
                                                }
                                              }}
                                            >
                                              Add
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="span-2">
                                        <label>Edit Images (multiple)</label>
                                        <input className="field" type="file" accept="image/*" multiple onChange={onSelectEditLeadImages} />
                                        {!!leadEditDraft.images.length && (
                                          <div className="chip-row" style={{ marginTop: 8 }}>
                                            {leadEditDraft.images.map((src, index) => (
                                              <div key={`${src.slice(0, 30)}-${index}`} style={{ position: 'relative' }}>
                                                <img src={src} alt={`Edit ${index + 1}`} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />
                                                <button
                                                  className="btn"
                                                  type="button"
                                                  onClick={() => removeEditLeadImage(index)}
                                                  style={{ position: 'absolute', top: -6, right: -6, padding: '1px 6px' }}
                                                >
                                                  x
                                                </button>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="action-row" style={{ marginTop: 10 }}>
                                      <button className="btn primary" onClick={saveLeadEdit}>
                                        Save Lead
                                      </button>
                                      <button className="btn" onClick={cancelLeadEdit}>
                                        Cancel
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                        {!filteredLeads.length && (
                          <tr>
                            <td colSpan={13} className="empty">
                              No enquiries found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="kanban-board">
                    {STATUSES.map(status => {
                      const columnLeads = filteredLeads.filter(l => l.status === status);
                      return (
                        <div
                          key={status}
                          className="kanban-column"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const leadId = e.dataTransfer.getData('leadId');
                            if (leadId) {
                              const updatedLeads = leads.map(l => l.id === leadId ? { ...l, status } : l);
                              setLeads(updatedLeads);
                              void syncLeads(updatedLeads);
                              toast.success(`Moved to ${status}`);
                            }
                          }}
                        >
                          <div className="kanban-column-header">
                            <div className="brand-row" style={{ gap: '8px' }}>
                              <span className="status-dot" style={{
                                backgroundColor: status === 'New' ? 'var(--blue)' : status === 'Order Confirmed' ? 'var(--green)' : status === 'Closed Lost' ? 'var(--danger)' : status === 'Contacted' ? 'var(--amber)' : 'var(--muted)'
                              }}></span>
                              {status}
                            </div>
                            <span className="kanban-column-count">{columnLeads.length}</span>
                          </div>
                          <div className="kanban-column-body">
                            {columnLeads.map(lead => (
                              <div
                                key={lead.id}
                                className="kanban-card"
                                draggable
                                onDragStart={(e) => e.dataTransfer.setData('leadId', lead.id)}
                                onClick={() => router.push(`/enquiry/${lead.id}`)}
                              >
                                <div className="kanban-card-title">{lead.clientName}</div>
                                <div className="kanban-card-meta">
                                  <span>{lead.brand}</span>
                                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>{money(lead.expectedValue)}</span>
                                </div>
                                {(lead.advanceValue ?? 0) > 0 && (
                                  <div style={{ fontSize: '10px', color: 'var(--green)', marginTop: '4px', fontWeight: 600 }}>
                                    Advance: {money(lead.advanceValue ?? 0)}
                                  </div>
                                )}
                                <div className="kanban-card-footer">
                                  <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{lead.id} {lead.closurePercent ? `• ${lead.closurePercent}%` : ''}</span>
                                  <div className="act-row-tight" onClick={e => e.stopPropagation()}>
                                    <button className="btn btn-compact" style={{ padding: '4px 8px' }} onClick={() => router.push(`/enquiry/${lead.id}`)}>Details</button>
                                    <button className="btn btn-compact" style={{ padding: '4px 8px' }} onClick={() => startLeadEdit(lead)}>Edit</button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}

          {!!previewImages.length && (
            <div className="image-modal-backdrop" onClick={closeImagePreview}>
              <div className="image-modal" onClick={(e) => e.stopPropagation()}>
                <div className="image-modal-header">
                  <div>
                    <strong>{previewClientName}</strong>
                    <div className="helper-text">{previewImages.length} image(s)</div>
                  </div>
                  <button className="btn" onClick={closeImagePreview}>
                    Close
                  </button>
                </div>

                <div className="image-preview-main">
                  <img src={previewImages[activePreviewImage]} alt={`${previewClientName} image ${activePreviewImage + 1}`} />
                </div>

                <div className="image-preview-strip">
                  {previewImages.map((src, index) => (
                    <button
                      key={`${src.slice(0, 30)}-${index}`}
                      className={`image-thumb ${activePreviewImage === index ? 'active' : ''}`}
                      onClick={() => setActivePreviewImage(index)}
                    >
                      <img src={src} alt={`${previewClientName} thumb ${index + 1}`} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className={`slide-over-backdrop ${selectedLeadId ? 'open' : ''}`} onClick={() => setSelectedLeadId(null)} />
          <aside className={`slide-over-panel ${selectedLeadId ? 'open' : ''}`}>
            {selectedLead && (
              <>
                <div className="slide-over-header">
                  <div>
                    <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>{selectedLead.clientName}</h2>
                    <div className="helper-text">{selectedLead.id} • {selectedLead.date}</div>
                  </div>
                  <button className="btn" onClick={() => setSelectedLeadId(null)} style={{ padding: '6px' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>

                <div className="slide-over-body">
                  <div className="slide-over-section">
                    <h3>Lead Overview</h3>
                    <div className="detail-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                      <div className="detail-item">
                        <span className="detail-label">Status</span>
                        <span
                          className={`status-pill ${selectedLead.status.split(' ')[0]} clickable`}
                          onClick={() => cycleStatus(selectedLead.id)}
                          title="Click to change status"
                        >
                          <span className="status-dot"></span>
                          {selectedLead.status}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Priority</span>
                        <span className="detail-value">{selectedLead.priority}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Expected Value</span>
                        <span className="detail-value" style={{ color: 'var(--blue)', fontWeight: 700 }}>{money(selectedLead.expectedValue || 0)}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Advance Received</span>
                        <span className="detail-value">{money(selectedLead.advanceValue || 0)}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">PO Number</span>
                        <span className="detail-value">{selectedLead.poNumber || '-'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Closure %</span>
                        <span className="detail-value">{selectedLead.closurePercent ? `${selectedLead.closurePercent}%` : '-'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Owner</span>
                        <span className="detail-value">{selectedLead.owner}</span>
                      </div>
                    </div>
                  </div>

                  <div className="slide-over-section">
                    <h3>Contact Information</h3>
                    <div className="detail-grid">
                      <div className="detail-item">
                        <span className="detail-label">Email</span>
                        <span className="detail-value">{selectedLead.email || '-'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Phone</span>
                        <span className="detail-value">{selectedLead.phone || '-'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Location</span>
                        <span className="detail-value">{[selectedLead.city, selectedLead.state, selectedLead.country].filter(Boolean).join(', ') || '-'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="slide-over-section">
                    <h3>Enquiry Items</h3>
                    <div className="chip-row">
                      {getLeadItems(selectedLead).map((item, idx) => (
                        <span className="chip-btn" key={`${selectedLead.id}-detail-item-${idx}`} style={{ cursor: 'default', background: 'var(--paper-strong)' }}>
                          {item.brand} | {item.productName || 'No product'}
                        </span>
                      ))}
                      {!getLeadItems(selectedLead).length && <span className="helper-text">No products added yet.</span>}
                    </div>
                  </div>

                  <div className="slide-over-section">
                    <h3>Product Details</h3>
                    <div className="answer-box" style={{ background: 'var(--paper-strong)', border: 'none' }}>{selectedLead.notes || 'No product details added.'}</div>
                  </div>

                  {(selectedLead.images && selectedLead.images.length > 0) && (
                    <div className="slide-over-section">
                      <h3>Images</h3>
                      <div className="image-preview-strip" style={{ marginTop: 0 }}>
                        {selectedLead.images.map((src, index) => (
                          <button
                            key={`${selectedLead.id}-detail-image-${index}`}
                            className="image-thumb"
                            onClick={() => {
                              setPreviewImages(selectedLead.images || []);
                              setPreviewClientName(selectedLead.clientName);
                              setActivePreviewImage(index);
                            }}
                          >
                            <img src={src} alt={`${selectedLead.clientName} ${index + 1}`} style={{ width: 80, height: 80 }} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="slide-over-section">
                    <h3>Activity History</h3>
                    <div className="timeline" style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '7px', top: '10px', bottom: '10px', width: '2px', background: 'var(--line)' }} />
                      <div className="timeline-item" style={{ position: 'relative', paddingLeft: '24px' }}>
                        <div style={{ position: 'absolute', left: '0', top: '4px', width: '16px', height: '16px', borderRadius: '50%', background: 'var(--green)', border: '4px solid var(--paper)' }} />
                        <div className="detail-label">Lead Created</div>
                        <div className="detail-value" style={{ fontSize: '12px' }}>{formatDate(selectedLead.createdAt)}</div>
                      </div>
                      {selectedLead.history?.map((h, i) => (
                        <div key={i} className="timeline-item" style={{ position: 'relative', paddingLeft: '24px' }}>
                          <div style={{ position: 'absolute', left: '0', top: '4px', width: '16px', height: '16px', borderRadius: '50%', background: 'var(--blue)', border: '4px solid var(--paper)' }} />
                          <div className="detail-label">{h.action}</div>
                          <div className="detail-value" style={{ fontSize: '12px' }}>
                            {h.prev ? (
                              <>Changed from <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{h.prev}</span> to <strong>{h.next}</strong></>
                            ) : (
                              <strong>{h.next}</strong>
                            )}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{formatDate(h.date)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="slide-over-footer">
                  <button className="btn primary" onClick={() => { const s = selectedLead; setSelectedLeadId(null); startLeadEdit(s); }} style={{ flex: 1 }}>Edit Lead</button>
                  <button className="btn" onClick={() => setSelectedLeadId(null)} style={{ flex: 1 }}>Close</button>
                </div>
              </>
            )}

          </aside>

          {!isLoading && tab === 'new-enquires' && (
            <div className="new-lead-container" style={{ maxWidth: '800px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                  <h2 style={{ fontSize: '26px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>New Enquiry</h2>
                  <p style={{ color: 'var(--muted)', fontSize: '14px', marginTop: '4px' }}>Fill in the details or use AI to auto-populate.</p>
                </div>
                <button
                  className="btn primary"
                  style={{ gap: '8px' }}
                  onClick={() => setIsAssistantOpen(true)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                  AI Magic Fill
                </button>
              </div>

              <div className="stepper">
                <div className="step-item">
                  <div className={`step-dot ${formStep >= 1 ? 'active' : ''} ${formStep > 1 ? 'completed' : ''}`}>1</div>
                  <span className="step-label">Basic Info</span>
                </div>
                <div className={`step-line ${formStep > 1 ? 'active' : ''}`} />
                <div className="step-item">
                  <div className={`step-dot ${formStep >= 2 ? 'active' : ''} ${formStep > 2 ? 'completed' : ''}`}>2</div>
                  <span className="step-label">Products</span>
                </div>
                <div className={`step-line ${formStep > 2 ? 'active' : ''}`} />
                <div className="step-item">
                  <div className={`step-dot ${formStep >= 3 ? 'active' : ''}`}>3</div>
                  <span className="step-label">Confirm</span>
                </div>
              </div>

              <article className="card panel" style={{ padding: '40px' }}>
                <form onSubmit={createLead}>
                  {formStep === 1 && (
                    <div className="form-grid">
                      <div className="span-4"><h3 style={{ marginBottom: '20px', fontSize: '18px' }}>Customer Information</h3></div>
                      <div>
                        <label>Lead Date</label>
                        <input className="field" type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} required />
                      </div>
                      <div>
                        <label>Client Name</label>
                        <input className="field" value={form.clientName} onChange={(e) => setForm((p) => ({ ...p, clientName: e.target.value }))} required />
                      </div>
                      <div>
                        <label>Phone</label>
                        <input className="field" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
                      </div>
                      <div>
                        <label>Email</label>
                        <input className="field" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                      </div>
                      <div>
                        <label>City</label>
                        <input className="field" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
                      </div>
                      <div>
                        <label>Country</label>
                        <input className="field" value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} />
                      </div>
                      <div>
                        <label>Client Type</label>
                        <input
                          className="field"
                          value={form.clientType}
                          list="client-types-list"
                          onChange={(e) => setForm((p) => ({ ...p, clientType: e.target.value }))}
                          placeholder="Select or type..."
                        />
                      </div>
                      <div className="span-4" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="btn primary" type="button" onClick={() => setFormStep(2)}>Continue to Enquiry</button>
                      </div>
                    </div>
                  )}

                  {formStep === 2 && (
                    <div className="form-grid">
                      <div className="span-4"><h3 style={{ marginBottom: '20px', fontSize: '18px' }}>Enquiry Details</h3></div>
                      <div>
                        <label>Brand</label>
                        <select className="field" value={form.brand} onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value as BrandName }))}>
                          {BRANDS.map((v) => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                      <div>
                        <label>Expected Value (INR)</label>
                        <input className="field" type="number" value={form.expectedValue} onChange={(e) => setForm((p) => ({ ...p, expectedValue: e.target.value }))} />
                      </div>
                      <div>
                        <label>Advance Received (INR)</label>
                        <input className="field" type="number" value={form.advanceValue} onChange={(e) => setForm((p) => ({ ...p, advanceValue: e.target.value }))} />
                      </div>
                      <div>
                        <label>Closure Probability (%)</label>
                        <input className="field" type="number" value={form.closurePercent} onChange={(e) => setForm((p) => ({ ...p, closurePercent: e.target.value }))} placeholder="0-100" />
                      </div>
                      <div>
                        <label>PO Number (if any)</label>
                        <input className="field" value={form.poNumber} onChange={(e) => setForm((p) => ({ ...p, poNumber: e.target.value }))} placeholder="PO Ref..." />
                      </div>
                      <div className="span-4">
                        <label>Product Items</label>
                        <div className="act-row" style={{ marginBottom: '12px' }}>
                          <div style={{ flex: 1, position: 'relative' }}>
                            <input
                              className="field"
                              value={form.productName}
                              list="products-list"
                              onChange={(e) => setForm((p) => ({ ...p, productName: e.target.value }))}
                              placeholder="Search or enter product..."
                              style={{ width: '100%' }}
                            />
                          </div>
                          <button className="btn" type="button" onClick={addEnquiryItem}>Add Item</button>
                        </div>
                        <div className="chip-row">
                          {form.enquiryItems.map((item, idx) => (
                            <button key={idx} className="chip-btn" type="button" onClick={() => removeEnquiryItem(idx)}>
                              {item.brand} | {item.productName || 'No product'} x
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="span-4" style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
                        <button className="btn" type="button" onClick={() => setFormStep(1)}>Back</button>
                        <button className="btn primary" type="button" onClick={() => setFormStep(3)}>Continue to Assignment</button>
                      </div>
                    </div>
                  )}

                  {formStep === 3 && (
                    <div className="form-grid">
                      <div className="span-4"><h3 style={{ marginBottom: '20px', fontSize: '18px' }}>Assignment & Finalize</h3></div>
                      <div>
                        <label>Person In Charge</label>
                        <select className="field" value={form.owner} onChange={(e) => setForm((p) => ({ ...p, owner: e.target.value }))}>
                          {ownerOptions.map((v) => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                      <div>
                        <label>Priority</label>
                        <select className="field" value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as Priority }))}>
                          {(['High', 'Medium', 'Low'] as Priority[]).map((v) => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                      <div className="span-4">
                        <label>Product Details / Notes</label>
                        <textarea className="field" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={4} />
                      </div>
                      <div className="span-4">
                        <label>Images</label>
                        <input className="field" type="file" accept="image/*" multiple onChange={onSelectLeadImages} />
                        {!!form.images.length && (
                          <div className="chip-row" style={{ marginTop: 8 }}>
                            {form.images.map((src, index) => (
                              <div key={index} style={{ position: 'relative' }}>
                                <img src={src} alt="Lead" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8 }} />
                                <button className="btn" type="button" onClick={() => removeLeadImage(index)} style={{ position: 'absolute', top: -6, right: -6, padding: '1px 6px' }}>x</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="span-4" style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
                        <button className="btn" type="button" onClick={() => setFormStep(2)}>Back</button>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <button className="btn" type="button" onClick={resetForm}>Reset</button>
                          <button className="btn primary" type="submit">Create Enquiry</button>
                        </div>
                      </div>
                    </div>
                  )}
                </form>
              </article>
            </div>
          )}


          <div className={`ai-modal-backdrop ${isAssistantOpen ? 'open' : ''}`} onClick={() => setIsAssistantOpen(false)}>
            <div className="ai-modal" onClick={e => e.stopPropagation()}>
              <div className="ai-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>AI Magic Fill</h3>
                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)' }}>Paste any text and AI will extract lead data</p>
                  </div>
                </div>
                <button onClick={() => setIsAssistantOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div className="ai-modal-body">
                <textarea
                  className="ai-textarea"
                  value={assistantInput}
                  onChange={(e) => setAssistantInput(e.target.value)}
                  placeholder="Paste email, WhatsApp chat, or any text about the lead here. AI will extract: client name, phone, location, product interest, budget..."
                  autoFocus
                />
              </div>
              <div className="ai-modal-footer">
                <button
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid var(--line)', borderRadius: '8px', padding: '0 12px', height: '36px', cursor: 'pointer', fontSize: '13px', color: listening ? 'var(--danger)' : 'var(--text)' }}
                  onClick={listening ? stopVoiceCapture : startVoiceCapture}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                  {listening ? 'Stop' : 'Voice'}
                </button>
                {assistantMessage && !assistantBusy && (
                  <span style={{ fontSize: '12px', color: 'var(--green)', display: 'flex', alignItems: 'center', gap: '4px' }}>✓ {assistantMessage}</span>
                )}
                <div style={{ marginLeft: 'auto' }}>
                  <button className="btn primary" style={{ minWidth: '120px' }} onClick={runAILeadAssist} disabled={assistantBusy || !assistantInput.trim()}>
                    {assistantBusy ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                        Extracting...
                      </span>
                    ) : 'Magic Fill'}
                  </button>
                </div>
              </div>
            </div>
          </div>


          {tab === 'quotes' && (
            <div className="mgmt-view">
              <div className="mgmt-header">
                <div>
                  <h2 className="mgmt-title">Quotation Hub</h2>
                  <p className="mgmt-subtitle">Select an enquiry to generate a professional quote</p>
                </div>
              </div>
              <div className="mgmt-card">
                <div className="mgmt-card-header">
                  <h3 className="mgmt-card-title">Recent Enquiries</h3>
                </div>
                <div className="mgmt-list">
                  {leads.slice(0, 20).map((l) => (
                    <div key={l.id} className="mgmt-list-item">
                      <div className="mgmt-item-icon" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                      </div>
                      <div className="mgmt-item-body">
                        <span className="mgmt-item-name">{l.clientName}</span>
                        <span className="mgmt-item-meta">{l.id} · {l.brand} · {l.status}</span>
                      </div>
                      <div className="mgmt-item-actions">
                        {l.quoteUrl || l.status === 'Quote Sent' ? (
                          <>
                            <button className="btn primary" onClick={() => router.push(`/quote/${l.id}/view`)}>
                              View Quote
                            </button>
                            <button className="btn" onClick={() => shareOnWhatsApp(l.id)} style={{ background: '#22c55e', color: 'white', borderColor: '#22c55e' }}>
                              WhatsApp
                            </button>
                          </>
                        ) : (
                          <button className="btn primary" onClick={() => router.push(`/enquiry/${l.id}/quote`)}>
                            Generate Quote
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {!leads.length && (
                    <div className="mgmt-empty">
                      <p>No enquiries found to generate quotes for.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'products' && (
            <div className="mgmt-view">
              <div className="mgmt-header">
                <div>
                  <h2 className="mgmt-title">Product Library</h2>
                  <p className="mgmt-subtitle">{Object.values(productsByBrand).flat().length} products across {BRANDS.length} brands</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ position: 'relative' }}>
                    <button className="btn primary" onClick={() => setIsAddProductMenuOpen(!isAddProductMenuOpen)}>
                      + Add New Product
                      <svg style={{ marginLeft: '8px' }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
                    </button>
                    {isAddProductMenuOpen && (
                      <>
                        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }} onClick={() => setIsAddProductMenuOpen(false)} />
                        <div style={{
                          position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: 'white', border: '1px solid var(--line)',
                          borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 101, minWidth: '160px', overflow: 'hidden'
                        }}>
                          {BRANDS.map(brand => (
                            <button
                              key={brand}
                              style={{ width: '100%', textAlign: 'left', padding: '10px 16px', border: 'none', background: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'black' }}
                              onMouseOver={e => e.currentTarget.style.background = 'var(--paper-hover)'}
                              onMouseOut={e => e.currentTarget.style.background = 'none'}
                              onClick={() => {
                                const code = `CUS-${Date.now()}`;
                                setProductsByBrand(prev => ({
                                  ...prev,
                                  [brand]: [{ code, title: 'New Product', detail: 'Description here', unitPrice: 0, category: 'General', stockStatus: 'In Stock' }, ...(prev[brand] || [])]
                                }));
                                startEditProduct(brand, code, 'New Product');
                                setIsAddProductMenuOpen(false);
                              }}
                            >
                              {brand}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <button className="btn" onClick={() => setProductsByBrand(PRODUCT_SEED)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                    Reset to Defaults
                  </button>
                </div>
              </div>
              <div className="product-brand-grid">
                {BRANDS.map(brand => (
                  <article key={brand} className="mgmt-card">
                    <div className="mgmt-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="mgmt-brand-badge">
                        <span className="mgmt-brand-icon">{brand.charAt(0)}</span>
                        <div>
                          <h3 className="mgmt-card-title">{brand}</h3>
                          <span className="mgmt-card-count">{productsByBrand[brand]?.length || 0} products</span>
                        </div>
                      </div>
                      <button
                        className="btn btn-compact"
                        style={{ padding: '4px 10px', fontSize: '11px' }}
                        onClick={() => {
                          const code = `CUS-${Date.now()}`;
                          setProductsByBrand(prev => ({
                            ...prev,
                            [brand]: [{ code, title: 'New Product', detail: 'Description here', unitPrice: 0, category: 'General', stockStatus: 'In Stock' }, ...(prev[brand] || [])]
                          }));
                          startEditProduct(brand, code, 'New Product');
                        }}
                      >
                        + Add
                      </button>
                    </div>
                    <div className="mgmt-list">
                      {productsByBrand[brand]?.map(product => {
                        const isEditing = editingProductKey === `${brand}::${product.code}`;
                        return (
                          <div key={product.code} className={`mgmt-list-item ${isEditing ? 'editing' : ''}`} style={{ alignItems: 'flex-start' }}>
                            <div className="mgmt-item-icon" style={{ background: 'var(--blue-soft)', color: 'var(--blue)', marginTop: '4px' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                            </div>
                            <div className="mgmt-item-body" style={{ flex: 1 }}>
                              {isEditing ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                                  <input
                                    className="mgmt-inline-input"
                                    value={editingProductValue}
                                    onChange={e => setEditingProductValue(e.target.value)}
                                    placeholder="Product Title"
                                    autoFocus
                                  />
                                  <textarea
                                    className="field"
                                    style={{ fontSize: '12px', minHeight: '60px' }}
                                    value={product.detail}
                                    onChange={e => setProductsByBrand(prev => {
                                      const next = { ...prev };
                                      next[brand] = next[brand].map(p => p.code === product.code ? { ...p, detail: e.target.value } : p);
                                      return next;
                                    })}
                                    placeholder="Product Details..."
                                  />
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                                    <label style={{ fontSize: '11px', fontWeight: 600 }}>Unit Price: ₹</label>
                                    <input
                                      type="number"
                                      className="field"
                                      style={{ width: '100px', height: '28px' }}
                                      value={product.unitPrice}
                                      onChange={e => setProductsByBrand(prev => {
                                        const next = { ...prev };
                                        next[brand] = next[brand].map(p => p.code === product.code ? { ...p, unitPrice: Number(e.target.value) } : p);
                                        return next;
                                      })}
                                    />

                                    <label style={{ fontSize: '11px', fontWeight: 600, marginLeft: '8px' }}>Stock:</label>
                                    <select
                                      className="field"
                                      style={{ width: '120px', height: '28px', fontSize: '12px' }}
                                      value={product.stockStatus}
                                      onChange={e => setProductsByBrand(prev => {
                                        const next = { ...prev };
                                        next[brand] = next[brand].map(p => p.code === product.code ? { ...p, stockStatus: e.target.value as any } : p);
                                        return next;
                                      })}
                                    >
                                      <option value="In Stock">In Stock</option>
                                      <option value="Limited Stock">Limited Stock</option>
                                      <option value="Out of Stock">Out of Stock</option>
                                      <option value="Lead Time">Lead Time</option>
                                    </select>

                                    {product.stockStatus === 'Lead Time' && (
                                      <input
                                        className="field"
                                        style={{ width: '120px', height: '28px', fontSize: '12px' }}
                                        placeholder="e.g. 2 weeks"
                                        value={product.leadTime || ''}
                                        onChange={e => setProductsByBrand(prev => {
                                          const next = { ...prev };
                                          next[brand] = next[brand].map(p => p.code === product.code ? { ...p, leadTime: e.target.value } : p);
                                          return next;
                                        })}
                                      />
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button className="btn primary" style={{ padding: '4px 12px' }} onClick={() => commitEditProduct(brand, product.code)}>Save</button>
                                    <button className="btn" style={{ padding: '4px 12px' }} onClick={() => setEditingProductKey(null)}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <span className="mgmt-item-name" style={{ fontWeight: 700 }}>{product.title}</span>
                                    <div style={{ textAlign: 'right' }}>
                                      <div style={{ fontWeight: 800, color: 'var(--blue)', fontSize: '13px' }}>₹{product.unitPrice.toLocaleString('en-IN')}</div>
                                      <div style={{
                                        fontSize: '10px',
                                        fontWeight: 800,
                                        marginTop: '2px',
                                        color: product.stockStatus === 'In Stock' ? 'var(--green)' : product.stockStatus === 'Out of Stock' ? 'var(--danger)' : 'var(--amber)'
                                      }}>
                                        {product.stockStatus}
                                        {product.stockStatus === 'Lead Time' && product.leadTime ? ` (${product.leadTime})` : ''}
                                      </div>
                                    </div>
                                  </div>
                                  <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', lineHeight: '1.4' }}>{product.detail}</p>
                                  <span className="mgmt-item-meta" style={{ marginTop: '4px', display: 'block' }}>{product.category} · {product.code}</span>
                                </>
                              )}
                            </div>
                            {!isEditing && (
                              <div className="mgmt-item-actions">
                                <button
                                  className="mgmt-edit-btn"
                                  onClick={() => startEditProduct(brand, product.code, product.title)}
                                  title="Edit product"
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                                </button>
                                <button
                                  className="mgmt-delete-btn"
                                  onClick={() => deleteProduct(brand, product.code)}
                                  title="Delete product"
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {tab === 'people' && (
            <div className="mgmt-view">
              <div className="mgmt-header">
                <div>
                  <h2 className="mgmt-title">Team & Settings</h2>
                  <p className="mgmt-subtitle">Manage team members and client classification</p>
                </div>
              </div>

              <div className="mgmt-split">
                {/* Team Members */}
                <div className="mgmt-card">
                  <div className="mgmt-card-header">
                    <h3 className="mgmt-card-title">Team Members</h3>
                  </div>
                  <div className="mgmt-add-row">
                    <input
                      className="mgmt-add-input"
                      value={newOwner}
                      onChange={(e) => setNewOwner(e.target.value)}
                      placeholder="Add team member..."
                      onKeyDown={e => { if (e.key === 'Enter') addOwner(); }}
                    />
                    <button className="btn primary" onClick={addOwner} disabled={!newOwner.trim()}>Add</button>
                  </div>
                  <div className="mgmt-list">
                    {ownerOptions.map((person, idx) => {
                      const isEditing = editingOwner === person;
                      const initials = person.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                      const hue = (idx * 67 + 200) % 360;
                      return (
                        <div key={person} className={`mgmt-list-item ${isEditing ? 'editing' : ''}`}>
                          <div className="mgmt-item-icon mgmt-avatar" style={{ background: `hsl(${hue}, 50%, 92%)`, color: `hsl(${hue}, 55%, 40%)` }}>
                            {initials}
                          </div>
                          <div className="mgmt-item-body">
                            {isEditing ? (
                              <input
                                className="mgmt-inline-input"
                                value={editingOwnerValue}
                                onChange={e => setEditingOwnerValue(e.target.value)}
                                onBlur={() => commitEditOwner(person)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') commitEditOwner(person);
                                  if (e.key === 'Escape') setEditingOwner(null);
                                }}
                                autoFocus
                              />
                            ) : (
                              <span className="mgmt-item-name">{person}</span>
                            )}
                          </div>
                          {!isEditing && (
                            <div className="mgmt-item-actions">
                              <button className="mgmt-edit-btn" onClick={() => startEditOwner(person)}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg></button>
                              <button className="mgmt-delete-btn" onClick={() => deleteOwner(person)}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg></button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Client Types */}
                <div className="mgmt-card">
                  <div className="mgmt-card-header">
                    <h3 className="mgmt-card-title">Client Types</h3>
                  </div>
                  <div className="mgmt-add-row">
                    <input
                      className="mgmt-add-input"
                      value={newClientType}
                      onChange={(e) => setNewClientType(e.target.value)}
                      placeholder="Add client type..."
                      onKeyDown={e => { if (e.key === 'Enter') addClientType(); }}
                    />
                    <button className="btn primary" onClick={addClientType} disabled={!newClientType.trim()}>Add</button>
                  </div>
                  <div className="mgmt-list">
                    {clientTypes.map((type) => (
                      <div key={type} className="mgmt-list-item">
                        <div className="mgmt-item-icon" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                        </div>
                        <div className="mgmt-item-body">
                          <span className="mgmt-item-name">{type}</span>
                        </div>
                        <div className="mgmt-item-actions">
                          <button className="mgmt-edit-btn" onClick={() => renameClientType(type)}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg></button>
                          <button className="mgmt-delete-btn" onClick={() => deleteClientType(type)}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Global Search Modal */}
        <div className={`ai-modal-backdrop ${isSearchOpen ? 'open' : ''}`} onClick={() => setIsSearchOpen(false)} style={{ alignItems: 'flex-start', paddingTop: '10vh' }}>
          <div className="ai-modal cmd-k-modal" onClick={e => e.stopPropagation()}>
            <input
              className="cmd-k-input"
              value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              placeholder="Search leads by name, email, or PO (Cmd+K)..."
              autoFocus
            />
            {globalSearchQuery && (
              <div className="cmd-k-results">
                {leads.filter(l =>
                  l.clientName.toLowerCase().includes(globalSearchQuery.toLowerCase()) ||
                  (l.email && l.email.toLowerCase().includes(globalSearchQuery.toLowerCase())) ||
                  (l.poNumber && l.poNumber.toLowerCase().includes(globalSearchQuery.toLowerCase()))
                ).slice(0, 5).map(lead => (
                  <div key={lead.id} className="cmd-k-item" onClick={() => {
                    setSelectedLeadId(lead.id);
                    setIsSearchOpen(false);
                    setGlobalSearchQuery('');
                  }}>
                    <div>
                      <div className="cmd-k-item-title">{lead.clientName}</div>
                      <div className="cmd-k-item-sub">{lead.email || 'No email'} • {lead.status}</div>
                    </div>
                    <div className="badge">{lead.priority}</div>
                  </div>
                ))}
                {leads.filter(l => l.clientName.toLowerCase().includes(globalSearchQuery.toLowerCase())).length === 0 && (
                  <div className="empty compact" style={{ padding: '20px' }}>No results found</div>
                )}
              </div>
            )}
          </div>
        </div>

        {tab === 'templates' && (
          <div className="mgmt-view" style={{ padding: '32px' }}>
            <div className="mgmt-header" style={{ marginBottom: '40px' }}>
              <div>
                <h2 className="mgmt-title">Letterhead Templates</h2>
                <p className="mgmt-subtitle">Manage and select the active letterhead for all quotations.</p>
              </div>
            </div>

            <div className="two-col stretch">
              <div className="mgmt-card" style={{ flex: 2 }}>
                <div className="mgmt-card-header">
                  <h3 className="mgmt-card-title">Available Templates</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '24px', padding: '24px' }}>
                  {templates.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', padding: '60px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '16px', border: '2px dashed #cbd5e1' }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" style={{ marginBottom: '16px' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <div style={{ fontSize: '15px', fontWeight: 900, color: '#475569', marginBottom: '8px', letterSpacing: '0.5px' }}>
                        PIXELKRAFT STANDARD A4
                      </div>
                      <div style={{ fontSize: '13px', color: '#64748b', maxWidth: '300px', margin: '0 auto', lineHeight: '1.6' }}>
                        No custom templates uploaded. Using the system standard A4 layout. Upload your agency letterhead on the right to customize.
                      </div>
                    </div>
                  ) : (
                    templates.map(t => (
                    <div key={t.id} className={`template-preview-card ${t.isActive ? 'active' : ''}`}
                      style={{
                        background: 'var(--card)',
                        border: t.isActive ? '3px solid #2563eb' : '1px solid var(--line)',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: t.isActive ? '0 10px 25px -5px rgba(37, 99, 235, 0.2)' : 'none',
                        transform: t.isActive ? 'scale(1.02)' : 'scale(1)',
                        position: 'relative'
                      }}
                      onClick={() => selectTemplate(t.id)}>
                      <div style={{ height: '240px', background: '#f1f5f9', position: 'relative' }}>
                        <img src={t.imageUrl} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        {t.isActive && (
                          <div style={{
                            position: 'absolute',
                            top: '0', left: '0', right: '0', bottom: '0',
                            background: 'rgba(37, 99, 235, 0.05)',
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'flex-end',
                            padding: '12px',
                            pointerEvents: 'none'
                          }}>
                            <div style={{ background: '#2563eb', color: 'white', fontSize: '11px', fontWeight: 900, padding: '4px 12px', borderRadius: '20px', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)' }}>
                              ACTIVE DEFAULT
                            </div>
                          </div>
                        )}
                        {!t.isActive && (
                          <div className="template-hover-overlay" style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0,
                            transition: 'opacity 0.2s ease',
                            pointerEvents: 'none'
                          }}>
                            <div style={{ background: 'white', color: 'black', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '12px' }}>
                              CLICK TO SELECT
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ padding: '16px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: t.isActive ? '#f8fafc' : 'transparent' }}>
                        <span style={{ fontWeight: 800, fontSize: '14px', color: t.isActive ? '#1e3a8a' : 'inherit' }}>{t.name}</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {!t.isActive && (
                            <button 
                              className="btn btn-compact"
                              style={{ padding: '4px 8px', fontSize: '10px', background: '#2563eb', color: 'white', border: 'none' }}
                              onClick={(e) => { e.stopPropagation(); selectTemplate(t.id); }}
                            >
                              Set Active
                            </button>
                          )}
                          {!t.isActive && t.id !== 'default' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); }}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                              title="Delete Template"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                            </button>
                          )}
                        </div>
                      </div>
                      <style jsx>{`
                        .template-preview-card:hover .template-hover-overlay {
                          opacity: 1 !important;
                        }
                      `}</style>
                    </div>
                  )))}
                </div>
              </div>

              <div className="mgmt-card" style={{ flex: 1 }}>
                <div className="mgmt-card-header">
                  <h3 className="mgmt-card-title">Add New Template</h3>
                </div>
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="form-group">
                    <label className="label">Template Name</label>
                    <input id="tmpl-name" className="field" placeholder="e.g. My Agency Letterhead" />
                  </div>
                  <div className="form-group">
                    <label className="label">Upload Letterhead Image</label>
                    <input
                      id="tmpl-file"
                      type="file"
                      className="field"
                      accept="image/*"
                      style={{ padding: '8px' }}
                    />
                  </div>
                  <button className="btn primary" disabled={isTemplateBusy} onClick={async () => {
                    const nameInput = document.getElementById('tmpl-name') as HTMLInputElement;
                    const fileInput = document.getElementById('tmpl-file') as HTMLInputElement;
                    const file = fileInput.files?.[0];
                    if (!nameInput.value || !file) return toast.error('Please provide name and file');

                    setIsTemplateBusy(true);
                    const reader = new FileReader();
                    reader.onload = async (e) => {
                      const imageUrl = e.target?.result as string;
                      await addTemplate(nameInput.value, imageUrl);
                      nameInput.value = '';
                      fileInput.value = '';
                    };
                    reader.readAsDataURL(file);
                  }}>
                    {isTemplateBusy ? 'Uploading...' : 'Upload & Save Template'}
                  </button>
                  <div className="note-box" style={{ fontSize: '12px', lineHeight: '1.5', opacity: 0.8 }}>
                    <strong>Tip:</strong> Ensure the image is A4 aspect ratio (210x297) for the best fit in the quotation editor.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <datalist id="client-types-list">
        {clientTypes.map((v) => <option key={v} value={v} />)}
      </datalist>
      <datalist id="products-list">
        {(tab === 'new-enquires' ? productsByBrand[form.brand] : (leadEditDraft ? productsByBrand[leadEditDraft.brand] : [])).map(p => (
          <option key={p.code} value={p.title} />
        ))}
      </datalist>
    </div>
  );
}
