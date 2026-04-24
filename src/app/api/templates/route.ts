import { NextResponse } from 'next/server';
import { readJsonBlob, writeJsonBlob } from '../../../lib/blob-store';

const TEMPLATES_BLOB_NAME = 'templates.json';

export type Template = {
  id: string;
  name: string;
  imageUrl: string;
  isActive: boolean;
};

const DEFAULT_TEMPLATES: Template[] = [];

export async function GET() {
  try {
    const templates = await readJsonBlob<Template[]>(TEMPLATES_BLOB_NAME, DEFAULT_TEMPLATES);
    return NextResponse.json({ templates });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load templates' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { action, template, id } = await request.json();

    let templates = await readJsonBlob<Template[]>(TEMPLATES_BLOB_NAME, DEFAULT_TEMPLATES);

    if (action === 'add') {
      // Deactivate all existing templates so the new one can be the default
      templates = templates.map(t => ({ ...t, isActive: false }));
      templates.push({ ...template, id: `tmpl-${Date.now()}`, isActive: true });
    } else if (action === 'select') {
      templates = templates.map(t => ({
        ...t,
        isActive: t.id === id
      }));
    } else if (action === 'delete') {
      templates = templates.filter(t => t.id !== id);
      if (templates.length > 0 && !templates.some(t => t.isActive)) {
        templates[0].isActive = true;
      }
    }

    await writeJsonBlob(TEMPLATES_BLOB_NAME, templates);
    return NextResponse.json({ ok: true, templates });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update templates' }, { status: 500 });
  }
}
