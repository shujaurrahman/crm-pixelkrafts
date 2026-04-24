import { NextResponse } from 'next/server';
import { CLIENT_TYPE_SEED } from '../../../lib/crm-data';
import { readJsonBlob, writeJsonBlob } from '../../../lib/blob-store';

export const dynamic = 'force-dynamic';

const CLIENT_TYPES_BLOB_NAME = 'client-types.json';

function sanitizeClientTypes(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const unique = new Set<string>();

  input.forEach((item) => {
    if (typeof item !== 'string') return;
    const value = item.trim();
    if (!value) return;
    const existing = Array.from(unique).find((entry) => entry.toLowerCase() === value.toLowerCase());
    if (existing) return;
    unique.add(value);
  });

  return Array.from(unique);
}

export async function GET() {
  try {
    const clientTypes = await readJsonBlob<string[]>(CLIENT_TYPES_BLOB_NAME, CLIENT_TYPE_SEED);
    const clean = sanitizeClientTypes(clientTypes);
    const normalized = clean.length ? clean : [...CLIENT_TYPE_SEED];
    const changed = JSON.stringify(clientTypes) !== JSON.stringify(normalized);

    if (changed) {
      await writeJsonBlob(CLIENT_TYPES_BLOB_NAME, normalized);
    }

    return NextResponse.json({ clientTypes: normalized });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load client types from blob';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { clientTypes?: string[] };
    if (!Array.isArray(body.clientTypes)) {
      return NextResponse.json({ error: 'Invalid payload. clientTypes[] required.' }, { status: 400 });
    }

    const clean = sanitizeClientTypes(body.clientTypes);
    if (!clean.length) {
      return NextResponse.json({ error: 'At least one client type is required.' }, { status: 400 });
    }
    await writeJsonBlob(CLIENT_TYPES_BLOB_NAME, clean);
    return NextResponse.json({ ok: true, clientTypes: clean });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save client types to blob';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
