import { getToken } from './auth.js';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

// Cache folder IDs to avoid repeated lookups
const folderCache = {};

async function apiFetch(url, options = {}) {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': 'Bearer ' + token,
      ...(options.headers || {})
    }
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Drive API error: ${res.status}`);
  }

  return res.json();
}

// Find a folder by name under a parent (or root)
async function findFolder(name, parentId = 'root') {
  const cacheKey = `${parentId}/${name}`;
  if (folderCache[cacheKey]) return folderCache[cacheKey];

  const q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
  const data = await apiFetch(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)`);

  if (data.files.length > 0) {
    folderCache[cacheKey] = data.files[0].id;
    return data.files[0].id;
  }
  return null;
}

// Create a folder under a parent
async function createFolder(name, parentId = 'root') {
  const data = await apiFetch(`${API}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    })
  });

  const cacheKey = `${parentId}/${name}`;
  folderCache[cacheKey] = data.id;
  return data.id;
}

// Get or create a folder, creating parents as needed
async function ensureFolder(name, parentId = 'root') {
  const existing = await findFolder(name, parentId);
  if (existing) return existing;
  return createFolder(name, parentId);
}

// Get the /Brain/inbox folder ID, creating the path if needed
export async function getInboxFolderId() {
  const brainId = await ensureFolder('Brain');
  const inboxId = await ensureFolder('inbox', brainId);
  return inboxId;
}

// Slug a string for use in filenames
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50);
}

// Format a Date as YYYY-MM-DD_HH-MM-SS
function formatTimestamp(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}` +
         `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

// Build the .md content from shared data
export function buildMarkdown({ title, text, url, note, timestamp }) {
  const now = timestamp ? new Date(timestamp) : new Date();
  const lines = [
    '---',
    `captured: ${now.toISOString()}`,
    `status: inbox`,
    `tags: []`,
  ];
  if (url) lines.push(`source: "${url}"`);
  lines.push('---', '');

  if (title) lines.push(`# ${title}`, '');
  if (text) lines.push(text, '');
  if (url && url !== text) lines.push(`> ${url}`, '');
  if (note) lines.push('', '## Notes', '', note);

  return lines.join('\n');
}

// Upload a .md file to /Brain/inbox/
export async function saveToInbox({ title, text, url, note, timestamp }) {
  const inboxId = await getInboxFolderId();

  const now = timestamp ? new Date(timestamp) : new Date();
  const slug = slugify(title || text || 'capture');
  const filename = `${formatTimestamp(now)}_${slug}.md`;
  const content = buildMarkdown({ title, text, url, note, timestamp });

  // Multipart upload
  const metadata = JSON.stringify({
    name: filename,
    mimeType: 'text/markdown',
    parents: [inboxId]
  });

  const boundary = 'brain_capture_boundary';
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    'Content-Type: text/markdown',
    '',
    content,
    `--${boundary}--`
  ].join('\r\n');

  const token = getToken();
  const res = await fetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id,name,webViewLink`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Upload failed: ${res.status}`);
  }

  return res.json(); // { id, name, webViewLink }
}

// List recent inbox files
export async function listInbox(limit = 20) {
  const inboxId = await getInboxFolderId();
  const q = `'${inboxId}' in parents and trashed=false`;
  const data = await apiFetch(
    `${API}/files?q=${encodeURIComponent(q)}&orderBy=createdTime desc&pageSize=${limit}&fields=files(id,name,createdTime,webViewLink)`
  );
  return data.files;
}
