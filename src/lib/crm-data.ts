export type TabKey = 'dashboard' | 'enquires' | 'new-enquires' | 'products' | 'people' | 'quotes' | 'templates' | 'invoices';
export type LeadStatus = 'New' | 'Contacted' | 'Quote Sent' | 'Order Confirmed' | 'Closed Lost';
export type Priority = 'High' | 'Medium' | 'Low';
export type BrandName = 'Creative Services' | 'Development' | 'Digital Marketing';

export interface ProductItem {
  code: string;
  title: string;
  detail: string;
  unitPrice: number;
  category: string;
  stockStatus: 'In Stock' | 'Limited Stock' | 'Out of Stock' | 'Lead Time';
  leadTime?: string;
}

export interface EnquiryLineItem {
  brand: BrandName;
  productCategory: string;
  productName: string;
}

export interface Lead {
  id: string;
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
  expectedValue: number;
  quantity?: number;
  poNumber?: string;
  closurePercent?: number;
  advanceValue?: number;
  orderExpectedDate?: string;
  orderExecutionBy?: string;
  deliveryTarget?: string;
  notes: string;
  images?: string[];
  quoteUrl?: string;
  enquiryItems?: EnquiryLineItem[];
  history?: Array<{ date: string; action: string; prev?: string; next?: string }>;
  createdAt: string;
  acceptanceSignature?: string;
  acceptedAt?: string;
  lastInvoiceDate?: string;
  invoiceNo?: string;
}

export interface LeadDraft {
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
  quoteUrl: string;
  enquiryItems: EnquiryLineItem[];
}

export interface AIFieldPatch {
  clientName?: string;
  email?: string;
  phone?: string;
  country?: string;
  state?: string;
  city?: string;
  clientType?: string;
  brand?: BrandName;
  productCategory?: string;
  productName?: string;
  owner?: string;
  status?: LeadStatus;
  priority?: Priority;
  expectedValue?: number;
  quantity?: number;
  poNumber?: string;
  closurePercent?: number;
  advanceValue?: number;
  orderExpectedDate?: string;
  orderExecutionBy?: string;
  deliveryTarget?: string;
  notes?: string;
  date?: string;
  productLines?: EnquiryLineItem[];
}

interface BrandCatalog {
  categories: string[];
  products: Record<string, string[]>;
}

export const CLIENT_TYPES = [
  'Startup',
  'Enterprise',
  'SME',
  'Individual',
  'Agency Partner',
  'Non-Profit',
  'E-commerce',
] as const;

export const CLIENT_TYPE_SEED: string[] = [...CLIENT_TYPES];

export function normalizeClientTypes(input: unknown): string[] {
  const merged = new Set(CLIENT_TYPE_SEED);

  if (Array.isArray(input)) {
    input.forEach((item) => {
      if (typeof item !== 'string') return;
      const value = item.trim();
      if (!value) return;

      const existing = Array.from(merged).find((entry) => entry.toLowerCase() === value.toLowerCase());
      if (existing) return;
      merged.add(value);
    });
  }

  return Array.from(merged);
}

export const OWNERS = ['Rahul', 'Shuja', 'Amit', 'Sara'] as const;
export const OWNER_SEED: string[] = [...OWNERS];

export function normalizeOwners(input: unknown): string[] {
  const merged = new Set(OWNER_SEED);

  if (Array.isArray(input)) {
    input.forEach((item) => {
      if (typeof item !== 'string') return;
      const value = item.trim();
      if (!value) return;

      const existing = Array.from(merged).find((entry) => entry.toLowerCase() === value.toLowerCase());
      if (existing) return;
      merged.add(value);
    });
  }

  return Array.from(merged);
}

export const STATUSES: LeadStatus[] = ['New', 'Contacted', 'Quote Sent', 'Order Confirmed', 'Closed Lost'];

export const PRODUCT_CATALOG: Record<BrandName, BrandCatalog> = {
  'Creative Services': {
    categories: ['Branding', 'UI/UX Designing', 'Graphic Design'],
    products: {
      'Branding': ['Logo Design Package', 'Brand Identity Guidelines', 'Stationery Design'],
      'UI/UX Designing': ['Mobile App UI', 'Web Application UX', 'Landing Page Design', 'Prototype Development'],
      'Graphic Design': ['Social Media Kits', 'Marketing Collateral', 'Annual Reports'],
    },
  },
  'Development': {
    categories: ['Website Development', 'App Development', 'AI & Chatbots', 'APIs Development'],
    products: {
      'Website Development': ['React Next.js Website', 'WordPress CMS', 'Custom Web Portal'],
      'App Development': ['iOS App Development', 'Android App Development', 'Cross-platform Mobile App'],
      'AI & Chatbots': ['Chatbot Development', 'AI Models Development', 'Custom AI Integration'],
      'APIs Development': ['REST API Design', 'GraphQL Implementation', 'Backend System Architecture'],
    },
  },
  'Digital Marketing': {
    categories: ['SEO Services', 'Social Media Ads', 'Digital Marketing'],
    products: {
      'SEO Services': ['Monthly SEO Audit', 'Technical SEO Fixes', 'Link Building Campaign'],
      'Social Media Ads': ['Google Ads Management', 'Meta Ads Campaign', 'LinkedIn Lead Gen'],
      'Digital Marketing': ['Email Marketing Strategy', 'Content Marketing', 'Full Digital Strategy'],
    },
  },
};

const BRAND_PREFIX: Record<BrandName, string> = {
  'Creative Services': 'CR',
  'Development': 'DV',
  'Digital Marketing': 'DM',
};

function categoryCode(category: string) {
  const cleaned = category.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return cleaned.slice(0, 3).padEnd(3, 'X');
}

function createProductSeed(): Record<BrandName, ProductItem[]> {
  const seed = {} as Record<BrandName, ProductItem[]>;

  (Object.keys(PRODUCT_CATALOG) as BrandName[]).forEach((brand) => {
    const items: ProductItem[] = [];
    const indexByCategory: Record<string, number> = {};

    PRODUCT_CATALOG[brand].categories.forEach((category) => {
      const products = PRODUCT_CATALOG[brand].products[category] || [];
      products.forEach((name) => {
        indexByCategory[category] = (indexByCategory[category] || 0) + 1;
        items.push({
          category,
          title: name,
          detail: `${brand} ${name} - High quality ${category.toLowerCase()} component.`,
          unitPrice: brand === 'Creative Services' ? 15000 : brand === 'Development' ? 45000 : 25000,
          code: `${BRAND_PREFIX[brand]}-${categoryCode(category)}-${String(indexByCategory[category]).padStart(3, '0')}`,
          stockStatus: 'In Stock',
        });
      });
    });

    seed[brand] = items;
  });

  return seed;
}

export const PRODUCT_SEED: Record<BrandName, ProductItem[]> = createProductSeed();

export function normalizeProductsByBrand(input: Partial<Record<BrandName, ProductItem[]>> | null | undefined): Record<BrandName, ProductItem[]> {
  const normalized: Record<BrandName, ProductItem[]> = {
    'Creative Services': [...PRODUCT_SEED['Creative Services']],
    'Development': [...PRODUCT_SEED['Development']],
    'Digital Marketing': [...PRODUCT_SEED['Digital Marketing']],
  };

  if (!input) return normalized;

  (Object.keys(PRODUCT_CATALOG) as BrandName[]).forEach((brand) => {
    const validCategories = new Set(PRODUCT_CATALOG[brand].categories);
    const seedKeys = new Set(normalized[brand].map((item) => `${item.category}::${item.title}`.toLowerCase()));
    const usedCodes = new Set(normalized[brand].map((item) => item.code.toUpperCase()));
    const existingItems = Array.isArray(input[brand]) ? input[brand] : [];

    let customIndex = normalized[brand].filter((item) => item.code.includes('-CUS-')).length;

    existingItems.forEach((item) => {
      const title = item.title?.trim();
      const category = item.category?.trim();
      if (!title || !category) return;
      if (!validCategories.has(category)) return;

      const key = `${category}::${item.title}`.toLowerCase();
      if (seedKeys.has(key)) return;

      const proposedCode = item.code?.trim() ? item.code.trim().toUpperCase() : '';
      let finalCode = proposedCode;

      if (!finalCode || usedCodes.has(finalCode)) {
        do {
          customIndex += 1;
          finalCode = `${BRAND_PREFIX[brand]}-CUS-${String(customIndex).padStart(3, '0')}`;
        } while (usedCodes.has(finalCode));
      }

      normalized[brand].push({
        title: item.title,
        detail: item.detail || '',
        unitPrice: item.unitPrice || 0,
        category,
        code: finalCode,
        stockStatus: item.stockStatus || 'In Stock',
        leadTime: item.leadTime || '',
      });
      seedKeys.add(key);
      usedCodes.add(finalCode);
    });
  });

  return normalized;
}

export const LEADS_SEED: Lead[] = [
  {
    id: 'ENQ-0001',
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
    owner: 'Shuja',
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
  }
];
