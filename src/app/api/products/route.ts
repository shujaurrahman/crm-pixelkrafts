import { NextResponse } from 'next/server';
import { PRODUCT_SEED, type BrandName, type ProductItem } from '../../../lib/crm-data';
import { readJsonBlob, writeJsonBlob } from '../../../lib/blob-store';
import { normalizeProductsByBrand } from '../../../lib/crm-data';

export const dynamic = 'force-dynamic';

const PRODUCTS_BLOB_NAME = 'products-by-brand.json';

type ProductMap = Record<BrandName, ProductItem[]>;

export async function GET() {
  try {
    const productsByBrand = await readJsonBlob<ProductMap>(PRODUCTS_BLOB_NAME, PRODUCT_SEED);
    const merged = normalizeProductsByBrand(productsByBrand);
    const changed = JSON.stringify(productsByBrand) !== JSON.stringify(merged);

    if (changed) {
      await writeJsonBlob(PRODUCTS_BLOB_NAME, merged);
    }

    return NextResponse.json({ productsByBrand: merged });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load products from blob';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { productsByBrand?: ProductMap };
    if (!body.productsByBrand || typeof body.productsByBrand !== 'object') {
      return NextResponse.json({ error: 'Invalid payload. productsByBrand required.' }, { status: 400 });
    }

    const clean = normalizeProductsByBrand(body.productsByBrand);
    await writeJsonBlob(PRODUCTS_BLOB_NAME, clean);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save products to blob';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
