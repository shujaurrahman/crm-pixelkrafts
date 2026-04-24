import { BlobServiceClient } from '@azure/storage-blob';
import { list, put } from '@vercel/blob';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_CONTAINER = 'enquires-crm';
const LOCAL_DATA_DIR = path.join(process.cwd(), 'data');

function hasAzureConnection() {
  return Boolean(process.env.AZURE_STORAGE_CONNECTION_STRING?.trim());
}

function hasVercelBlobToken() {
  return Boolean(getVercelBlobToken());
}

function getVercelBlobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || process.env.VERCEL_BLOB_READ_WRITE_TOKEN?.trim() || '';
}

function getContainerClient() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    return null;
  }

  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || DEFAULT_CONTAINER;
  const serviceClient = BlobServiceClient.fromConnectionString(connectionString);
  return serviceClient.getContainerClient(containerName);
}

function isVercelRuntime() {
  return process.env.VERCEL === '1';
}

function ensurePersistentBackendConfigured() {
  if (hasVercelBlobToken() || hasAzureConnection()) return;
  
  if (isVercelRuntime()) {
    console.warn(
      'CRM Storage Warning: No persistent storage backend (Vercel Blob or Azure) configured. ' +
      'Data will be stored in temporary local storage and will be lost on the next deployment. ' +
      'Please ensure BLOB_READ_WRITE_TOKEN is set in your Vercel Project Settings.'
    );
  }
}

export async function readJsonBlob<T>(blobName: string, fallback: T): Promise<T> {
  ensurePersistentBackendConfigured();

  if (hasVercelBlobToken()) {
    return readJsonVercelBlob(blobName, fallback);
  }

  if (!hasAzureConnection()) {
    return readJsonLocal(blobName, fallback);
  }

  const containerClient = getContainerClient();
  if (!containerClient) {
    return readJsonLocal(blobName, fallback);
  }
  await containerClient.createIfNotExists();

  const blobClient = containerClient.getBlockBlobClient(blobName);
  if (!(await blobClient.exists())) {
    await blobClient.upload(JSON.stringify(fallback), Buffer.byteLength(JSON.stringify(fallback)), {
      blobHTTPHeaders: { blobContentType: 'application/json' },
    });
    return fallback;
  }

  const download = await blobClient.download();
  const body = await streamToString(download.readableStreamBody);
  if (!body.trim()) return fallback;

  try {
    return JSON.parse(body) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonBlob<T>(blobName: string, payload: T): Promise<void> {
  ensurePersistentBackendConfigured();

  if (hasVercelBlobToken()) {
    await writeJsonVercelBlob(blobName, payload);
    return;
  }

  if (!hasAzureConnection()) {
    await writeJsonLocal(blobName, payload);
    return;
  }

  const containerClient = getContainerClient();
  if (!containerClient) {
    await writeJsonLocal(blobName, payload);
    return;
  }
  await containerClient.createIfNotExists();

  const blobClient = containerClient.getBlockBlobClient(blobName);
  const content = JSON.stringify(payload);
  await blobClient.upload(content, Buffer.byteLength(content), {
    blobHTTPHeaders: { blobContentType: 'application/json' },
  });
}

async function readJsonVercelBlob<T>(blobName: string, fallback: T): Promise<T> {
  const token = getVercelBlobToken();
  if (!token) return fallback;

  try {
    const result = await list({ prefix: blobName, limit: 100, token });
    const blob = result.blobs.find((item) => item.pathname === blobName);

    if (!blob) {
      await writeJsonVercelBlob(blobName, fallback);
      return fallback;
    }

    const response = await fetchBlobWithAuth(blob, token);
    if (!response.ok) {
      console.error(`Failed to read Vercel Blob ${blobName}: ${response.status} ${response.statusText}`);
      return fallback;
    }

    const text = await response.text();
    if (!text.trim()) return fallback;
    try {
      return JSON.parse(text) as T;
    } catch {
      console.error(`Invalid JSON in Vercel Blob ${blobName}`);
      return fallback;
    }
  } catch (error) {
    console.error(`Unexpected Vercel Blob read error for ${blobName}`, error);
    return fallback;
  }
}

async function writeJsonVercelBlob<T>(blobName: string, payload: T): Promise<void> {
  const token = getVercelBlobToken();
  if (!token) return;

  await put(blobName, JSON.stringify(payload), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    token,
    contentType: 'application/json',
  });
}

interface BlobReadTarget {
  url: string;
  downloadUrl?: string;
}

async function fetchBlobWithAuth(blob: BlobReadTarget, token: string): Promise<Response> {
  const downloadUrl = typeof blob.downloadUrl === 'string' ? blob.downloadUrl : '';

  if (downloadUrl) {
    const direct = await fetch(downloadUrl, { cache: 'no-store' });
    if (direct.ok) return direct;
  }

  return fetch(blob.url, {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

async function readJsonLocal<T>(blobName: string, fallback: T): Promise<T> {
  const filePath = getLocalFilePath(blobName);
  await mkdir(LOCAL_DATA_DIR, { recursive: true });

  try {
    const content = await readFile(filePath, 'utf-8');
    if (!content.trim()) return fallback;
    return JSON.parse(content) as T;
  } catch {
    await writeFile(filePath, JSON.stringify(fallback, null, 2), 'utf-8');
    return fallback;
  }
}

async function writeJsonLocal<T>(blobName: string, payload: T): Promise<void> {
  const filePath = getLocalFilePath(blobName);
  await mkdir(LOCAL_DATA_DIR, { recursive: true });
  await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
}

function getLocalFilePath(blobName: string) {
  const safeName = blobName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return path.join(LOCAL_DATA_DIR, safeName);
}

async function streamToString(readable: NodeJS.ReadableStream | null | undefined): Promise<string> {
  if (!readable) return '';

  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    readable.on('data', (d) => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
    readable.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    readable.on('error', reject);
  });
}
