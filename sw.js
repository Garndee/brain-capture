const CACHE_NAME = 'brain-capture-v1';
const ASSETS = ['/', '/index.html', '/style.css', '/app.js', '/auth.js', '/drive.js'];

// Install: cache app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: serve from cache, fall back to network
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Handle share target POST
  if (url.pathname === '/share-target' && e.request.method === 'POST') {
    e.respondWith(handleShareTarget(e.request));
    return;
  }

  // Cache-first for app shell
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

async function handleShareTarget(request) {
  const formData = await request.formData();
  const shared = {
    title: formData.get('title') || '',
    text: formData.get('text') || '',
    url: formData.get('url') || '',
    timestamp: new Date().toISOString()
  };

  // Store in IndexedDB for the main page to pick up
  await storeSharedData(shared);

  // Redirect to main app
  return Response.redirect('/?shared=1', 303);
}

// --- IndexedDB helpers ---

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('brain-capture', 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('pending', { autoIncrement: true });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

async function storeSharedData(data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending', 'readwrite');
    tx.objectStore('pending').add(data);
    tx.oncomplete = resolve;
    tx.onerror = e => reject(e.target.error);
  });
}
