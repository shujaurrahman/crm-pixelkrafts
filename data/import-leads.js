const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const inputFile = '/Users/shujaurrahman/Desktop/all-leads-1776898063472.xlsx';
const outputFile = path.join(process.cwd(), 'data', 'leads.json');

const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F\u200B-\u200D\u202A-\u202E\u2066-\u2069\uFEFF]/g;
const WS_MULTI = /\s+/g;

const typoMap = { gujrat: 'Gujarat', kolkatta: 'Kolkata' };

function cleanString(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(CONTROL_CHARS, '').replace(WS_MULTI, ' ').trim();
}

function toTitleCase(s) {
  const src = cleanString(s);
  if (!src) return '';
  return src
    .toLowerCase()
    .split(' ')
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function isEmailLike(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanString(s));
}

function normalizePhone(v) {
  const p = cleanString(v);
  if (!p) return '';
  const noSpaces = p.replace(/\s+/g, '');
  if (/^\d+$/.test(noSpaces)) return noSpaces;
  return p;
}

function parseNumeric(v, fallback = 0) {
  if (v === null || v === undefined || v === '') return fallback;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : fallback;
}

function parseDateToYMD(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (d?.y && d?.m && d?.d) {
      return `${String(d.y).padStart(4, '0')}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = cleanString(v);
  if (!s) return '';
  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (m) {
    let day = Number(m[1]);
    let month = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return '';
}

function normalizeBrand(v) {
  const parts = cleanString(v).split('|').map(x => cleanString(x)).filter(Boolean);
  for (const p of parts) {
    const low = p.toLowerCase();
    if (low.includes('eubiq india')) return 'Eubiq India';
    if (low.includes('61saga')) return '61SAGA';
    if (low.includes('61gler')) return '61GLER';
  }
  return '';
}

function normalizeStatus(v) {
  const s = cleanString(v).toLowerCase();
  const map = {
    new: 'New',
    contacted: 'Contacted',
    'quote sent': 'Quote Sent',
    quoted: 'Quote Sent',
    'order confirmed': 'Order Confirmed',
    'closed lost': 'Closed Lost',
    lost: 'Closed Lost',
  };
  return map[s] || 'New';
}

function normalizePriority(v) {
  const s = cleanString(v).toLowerCase();
  if (s === 'high') return 'High';
  if (s === 'low') return 'Low';
  return 'Medium';
}

function splitPipe(v) {
  return cleanString(v).split('|').map(x => cleanString(x));
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

const wb = XLSX.readFile(inputFile, { raw: true, cellDates: true });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { raw: true, defval: null });

const correctedIds = [];
const outRows = rows.map((row) => {
  let corrected = false;

  const id = cleanString(row.ID);
  const date = parseDateToYMD(row.Date);

  let email = cleanString(row.Email);
  let phone = cleanString(row.Phone);
  if (!isEmailLike(email) && isEmailLike(phone)) {
    [email, phone] = [phone, email];
    corrected = true;
  }

  const phoneNorm = normalizePhone(phone);
  if (phoneNorm !== phone) corrected = true;

  const stateRaw = cleanString(row.State);
  const cityRaw = cleanString(row.City);
  let state = toTitleCase(stateRaw);
  let city = toTitleCase(cityRaw);
  if (typoMap[state.toLowerCase()]) {
    state = typoMap[state.toLowerCase()];
    corrected = true;
  }
  if (typoMap[city.toLowerCase()]) {
    city = typoMap[city.toLowerCase()];
    corrected = true;
  }
  if (stateRaw && state !== stateRaw) corrected = true;
  if (cityRaw && city !== cityRaw) corrected = true;

  const clientTypeRaw = cleanString(row.ClientType);
  const clientType = clientTypeRaw.toLowerCase() === 'others' ? 'Others' : clientTypeRaw;
  if (clientType !== clientTypeRaw) corrected = true;

  const brand = normalizeBrand(row.Brand);
  if (brand !== cleanString(row.Brand)) corrected = true;

  const status = normalizeStatus(row.Status);
  const priority = normalizePriority(row.Priority);

  const expectedValue = parseNumeric(row.ExpectedValueINR, 0);
  const quantityVal = parseNumeric(row.Quantity, 0);
  const quantity = quantityVal > 0 ? quantityVal : undefined;
  const closurePercent = clamp(parseNumeric(row.ClosurePercent, 0), 0, 100);

  const brands = splitPipe(row.Brand);
  const categories = splitPipe(row.Category);
  const products = splitPipe(row.Product);
  const maxLen = Math.max(brands.length, categories.length, products.length);
  const enquiryItems = [];
  for (let i = 0; i < maxLen; i++) {
    const productName = cleanString(products[i] ?? products[0]);
    if (!productName) continue;
    enquiryItems.push({
      brand: normalizeBrand(brands[i] ?? brands[0]),
      productCategory: cleanString(categories[i] ?? categories[0]),
      productName,
    });
  }

  const rec = {
    id,
    date,
    clientName: cleanString(row.Client),
    email,
    phone: phoneNorm,
    country: cleanString(row.Country),
    state,
    city,
    clientType,
    brand,
    productCategory: cleanString(row.Category),
    productName: cleanString(row.Product),
    owner: cleanString(row.Owner),
    status,
    priority,
    expectedValue,
    poNumber: cleanString(row.PO),
    closurePercent,
    orderExpectedDate: cleanString(row.OrderExpectedDate),
    orderExecutionBy: cleanString(row.OrderExecutionBy),
    deliveryTarget: cleanString(row.DeliveryTarget),
    notes: cleanString(row.ProductDetails),
    images: [],
    createdAt: date ? `${date}T00:00:00.000Z` : new Date().toISOString(),
    enquiryItems,
  };

  if (quantity !== undefined) rec.quantity = quantity;

  if (corrected) correctedIds.push(id || '(missing-id)');
  return rec;
});

function idNum(id) {
  const m = cleanString(id).match(/(\d+)/);
  return m ? Number(m[1]) : -Infinity;
}

outRows.sort((a, b) => idNum(b.id) - idNum(a.id));

fs.writeFileSync(outputFile, JSON.stringify(outRows, null, 2) + '\n');

const ids = outRows.map(r => r.id).filter(Boolean);
console.log(`Imported rows: ${outRows.length}`);
console.log(`IDs imported: ${ids.join(', ')}`);
console.log(`Rows with corrections: ${correctedIds.length}${correctedIds.length ? ` (${correctedIds.join(', ')})` : ''}`);
