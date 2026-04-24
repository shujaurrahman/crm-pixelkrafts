import { NextResponse } from 'next/server';
import { type Lead } from '../../../lib/crm-data';
import { readJsonBlob, writeJsonBlob } from '../../../lib/blob-store';

export const dynamic = 'force-dynamic';

const LEADS_BLOB_NAME = 'leads.json';

const LEGACY_DUMMY_SIGNATURES = new Set([
  'ENQ-0001|Rajan Mehta|2026-03-11T10:30:00.000Z',
  'ENQ-0002|Ahmed Al Rashid|2026-03-13T08:15:00.000Z',
  'ENQ-0003|Mira Design Lab|2026-03-14T11:20:00.000Z',
  'ENQ-0004|Skyline Buildtech|2026-03-15T09:05:00.000Z',
  'ENQ-0005|Nexa Furnish Works|2026-03-16T14:10:00.000Z',
  'ENQ-0006|Arina Consultants|2026-03-17T07:45:00.000Z',
  'ENQ-0007|Vertex Infra Projects|2026-03-18T12:30:00.000Z',
  'ENQ-0008|Elm Street Studio|2026-03-19T10:00:00.000Z',
  'ENQ-0009|Aurum Spaces|2026-03-20T16:25:00.000Z',
  'ENQ-0010|Bluewave Trading Co|2026-03-21T06:50:00.000Z',
]);

function stripLegacyDummyLeads(existing: Lead[]): { cleaned: Lead[]; changed: boolean } {
  const base = Array.isArray(existing) ? existing : [];
  const cleaned = base.filter((lead) => {
    const signature = `${lead.id}|${lead.clientName}|${lead.createdAt}`;
    return !LEGACY_DUMMY_SIGNATURES.has(signature);
  });
  return { cleaned, changed: cleaned.length !== base.length };
}

export async function GET() {
  try {
    const leads = await readJsonBlob<Lead[]>(LEADS_BLOB_NAME, []);
    const { cleaned, changed } = stripLegacyDummyLeads(leads);

    if (changed) {
      await writeJsonBlob(LEADS_BLOB_NAME, cleaned);
    }

    return NextResponse.json({ leads: cleaned });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load leads from blob';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { leads?: Lead[] };
    if (!Array.isArray(body.leads)) {
      return NextResponse.json({ error: 'Invalid payload. leads[] required.' }, { status: 400 });
    }

    await writeJsonBlob(LEADS_BLOB_NAME, body.leads);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save leads to blob';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { lead?: Lead };
    if (!body.lead || typeof body.lead !== 'object') {
      return NextResponse.json({ error: 'Invalid payload. lead is required.' }, { status: 400 });
    }

    const existing = await readJsonBlob<Lead[]>(LEADS_BLOB_NAME, []);
    const { cleaned } = stripLegacyDummyLeads(existing);

    const incoming = body.lead;
    const incomingLines = Array.isArray(incoming.enquiryItems)
      ? incoming.enquiryItems
          .map((line) => ({
            brand: line.brand,
            productCategory: String(line.productCategory || '').trim(),
            productName: String(line.productName || '').trim(),
          }))
          .filter((line) => line.brand && line.productName)
      : [];

    const fallbackLine = {
      brand: incoming.brand,
      productCategory: incoming.productCategory?.trim() || '',
      productName: incoming.productName?.trim() || '',
    };

    const normalizedLines = incomingLines.length
      ? incomingLines
      : fallbackLine.brand && fallbackLine.productName
        ? [fallbackLine]
        : [];

    const primary = normalizedLines[0];

    const normalizedLead: Lead = {
      ...incoming,
      id: incoming.id?.trim() || `ENQ-${Date.now()}`,
      date: incoming.date,
      clientName: incoming.clientName?.trim() || '',
      email: incoming.email?.trim() || '',
      phone: incoming.phone?.trim() || '',
      country: incoming.country?.trim() || '',
      state: incoming.state?.trim() || '',
      city: incoming.city?.trim() || '',
      clientType: incoming.clientType?.trim() || '',
      brand: (primary?.brand || incoming.brand) as Lead['brand'],
      productCategory: primary?.productCategory || incoming.productCategory?.trim() || '',
      productName: primary?.productName || incoming.productName?.trim() || '',
      owner: incoming.owner?.trim() || '',
      poNumber: incoming.poNumber?.trim() || '',
      closurePercent: Number.isFinite(Number(incoming.closurePercent))
        ? Math.max(0, Math.min(100, Number(incoming.closurePercent)))
        : undefined,
      orderExpectedDate: incoming.orderExpectedDate?.trim() || '',
      orderExecutionBy: incoming.orderExecutionBy?.trim() || '',
      deliveryTarget: incoming.deliveryTarget?.trim() || '',
      notes: incoming.notes?.trim() || '',
         expectedValue: Number(incoming.expectedValue || 0),
         quantity: Number.isFinite(Number(incoming.quantity)) ? Number(incoming.quantity) : undefined,
      createdAt: incoming.createdAt || new Date().toISOString(),
      images: Array.isArray(incoming.images) ? incoming.images : [],
      enquiryItems: normalizedLines,
    };

    const withoutSameId = cleaned.filter((lead) => lead.id !== normalizedLead.id);
    const nextLeads = [normalizedLead, ...withoutSameId];

    await writeJsonBlob(LEADS_BLOB_NAME, nextLeads);
    return NextResponse.json({ ok: true, lead: normalizedLead });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to append lead to blob';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
