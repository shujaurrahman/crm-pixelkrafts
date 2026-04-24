import { NextResponse } from 'next/server';
import { generateTextWithFallback } from '../../../lib/ai-fallback';

export const dynamic = 'force-dynamic';

type BrandName = 'Creative Services' | 'Development' | 'Digital Marketing';
type LeadStatus = 'New' | 'Contacted' | 'Quote Sent' | 'Order Confirmed' | 'Closed Lost';
type Priority = 'High' | 'Medium' | 'Low';

interface AIFieldPatch {
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
  notes?: string;
  date?: string;
  orderExpectedDate?: string;
  orderExecutionBy?: string;
  deliveryTarget?: string;
  productLines?: Array<{
    brand: BrandName;
    productCategory: string;
    productName: string;
  }>;
}

function parseJsonObject(text: string): Record<string, unknown> {
  const direct = text.trim();
  try {
    return JSON.parse(direct) as Record<string, unknown>;
  } catch {
    const match = direct.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}

function toPatch(raw: Record<string, unknown>): AIFieldPatch {
  const patch: AIFieldPatch = {};

  const toStr = (k: string) => {
    const v = raw[k];
    return typeof v === 'string' ? v.trim() : '';
  };

  const assign = (key: keyof AIFieldPatch, value: string) => {
    if (value) patch[key] = value as never;
  };

  assign('clientName', toStr('clientName'));
  assign('email', toStr('email'));
  assign('phone', toStr('phone'));
  assign('country', toStr('country'));
  assign('state', toStr('state'));
  assign('city', toStr('city'));
  assign('clientType', toStr('clientType'));
  assign('brand', toStr('brand'));
  assign('productCategory', toStr('productCategory'));
  assign('productName', toStr('productName'));
  assign('owner', toStr('owner'));
  assign('status', toStr('status'));
  assign('priority', toStr('priority'));
  assign('notes', toStr('notes'));
  assign('date', toStr('date'));
  assign('poNumber', toStr('poNumber'));
  assign('orderExpectedDate', toStr('orderExpectedDate'));
  assign('orderExecutionBy', toStr('orderExecutionBy'));
  assign('deliveryTarget', toStr('deliveryTarget'));

  const parseNum = (v: unknown) => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const n = Number(v.replace(/[^0-9.]/g, ''));
      if (Number.isFinite(n)) return n;
    }
    return undefined;
  };

  patch.expectedValue = parseNum(raw.expectedValue);
  patch.quantity = parseNum(raw.quantity);
  patch.closurePercent = parseNum(raw.closurePercent);

  const lines = raw.productLines;
  if (Array.isArray(lines)) {
    const parsedLines = lines
      .map((line) => {
        if (!line || typeof line !== 'object') return null;
        const obj = line as Record<string, unknown>;
        const brand = typeof obj.brand === 'string' ? obj.brand.trim() : '';
        const productCategory = typeof obj.productCategory === 'string' ? obj.productCategory.trim() : '';
        const productName = typeof obj.productName === 'string' ? obj.productName.trim() : '';
        if (!brand || !productName) return null;
        return { brand: brand as BrandName, productCategory, productName };
      })
      .filter((line): line is { brand: BrandName; productCategory: string; productName: string } => !!line);

    if (parsedLines.length) {
      patch.productLines = parsedLines;
    }
  }

  return patch;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      message?: string;
      brands?: string[];
      owners?: string[];
      statuses?: string[];
      clientTypes?: string[];
    };

    if (!body.message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const today = new Date().toISOString().slice(0, 10);

    const prompt = `You are an assistant that extracts lead fields from emails/chat/voice text.
Return ONLY JSON object with fields if present:
clientName,email,phone,country,state,city,clientType,brand,productCategory,productName,productLines,owner,status,priority,expectedValue,quantity,poNumber,closurePercent,notes,date,orderExpectedDate,orderExecutionBy,deliveryTarget

Rules:
- Keep fields empty if unknown.
- date must be YYYY-MM-DD. If inferred as today use ${today}.
- orderExpectedDate must be YYYY-MM-DD.
- brand must be one of: ${JSON.stringify(body.brands || [])}
- owner must be from: ${JSON.stringify(body.owners || [])}
- status from: ${JSON.stringify(body.statuses || [])}
- clientType must be from: ${JSON.stringify(body.clientTypes || [])}
- productName should be captured as plain text when mentioned.
- productCategory is optional and can be left empty.
- If the same client asks for multiple products/brands, include ALL entries in productLines as array of objects: [{brand, productCategory, productName}].
- Also set top-level brand/productCategory/productName using the first productLines item.
- If brand/product is unclear, leave those fields empty.
- expectedValue should be number only.
- quantity should be number only.
- closurePercent should be number 0-100.
- orderExecutionBy should be a name from the owners list if mentioned.
- deliveryTarget can be a text description of the timeline.

Input:
${body.message}`;

  const { text, provider } = await generateTextWithFallback(prompt);
  const content = text;

    const parsed = parseJsonObject(content);
    const patch = toPatch(parsed);

  return NextResponse.json({ patch, provider });
  } catch (error) {
    console.error('Assist API error', error);
    const message = error instanceof Error ? error.message : 'Assist request failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
