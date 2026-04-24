import { NextResponse } from 'next/server';
import { OWNER_SEED } from '../../../lib/crm-data';
import { readJsonBlob, writeJsonBlob } from '../../../lib/blob-store';

export const dynamic = 'force-dynamic';

const OWNERS_BLOB_NAME = 'owners.json';

function sanitizeOwners(input: unknown): string[] {
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
    const owners = await readJsonBlob<string[]>(OWNERS_BLOB_NAME, OWNER_SEED);
    const clean = sanitizeOwners(owners);
    const normalized = clean.length ? clean : [...OWNER_SEED];
    const changed = JSON.stringify(owners) !== JSON.stringify(normalized);

    if (changed) {
      await writeJsonBlob(OWNERS_BLOB_NAME, normalized);
    }

    return NextResponse.json({ owners: normalized });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load owners from blob';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { owners?: string[] };
    if (!Array.isArray(body.owners)) {
      return NextResponse.json({ error: 'Invalid payload. owners[] required.' }, { status: 400 });
    }

    const clean = sanitizeOwners(body.owners);
    if (!clean.length) {
      return NextResponse.json({ error: 'At least one person is required.' }, { status: 400 });
    }
    await writeJsonBlob(OWNERS_BLOB_NAME, clean);
    return NextResponse.json({ ok: true, owners: clean });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save owners to blob';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
