import { NextResponse } from 'next/server';
import { readJsonBlob, writeJsonBlob } from '../../../lib/blob-store';

const TEMPLATES_BLOB_NAME = 'templates.json';

export type Template = {
  id: string;
  name: string;
  imageUrl: string;
  isActive: boolean;
};

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'default',
    name: 'PixelKraft Standard',
    imageUrl: '/Letter Head PixelKraft.png',
    isActive: true
  }
];

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
      const isFirst = templates.length === 0;
      templates.push({ ...template, id: `tmpl-${Date.now()}`, isActive: isFirst });
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
