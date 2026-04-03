import { startLoginImplicit, handleTokenCallback, isLoggedIn, logout, getClientId, setClientId } from './auth.js';
import { saveToInbox, listInbox, buildMarkdown } from './drive.js';

// --- IndexedDB: read pending shared data from service worker ---

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

async function popPendingShare() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending', 'readwrite');
    const store = tx.objectStore('pending');
    const req = store.openCursor();
    req.onsuccess = e => {
      const cursor = e.target.result;
      if (cursor) {
        const data = cursor.value;
        cursor.delete();
        resolve(data);
      } else {
        resolve(null);
      }
    };
    req.onerror = e => reject(e.target.error);
  });
}

// --- UI helpers ---

const $ = id => document.getElementById(id);

function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }

function setStatus(msg, type = 'info') {
  const el = $('status');
  el.textContent = msg;
  el.className = 'status ' + type;
  show('status');
}

function clearStatus() { hide('status'); }

// --- Main app ---

let pendingShare = null;

async function init() {
  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  }

  // Handle OAuth token return (implicit flow puts token in hash)
  const token = handleTokenCallback();
  if (token) {
    setStatus('Signed in!', 'success');
    setTimeout(clearStatus, 2000);
  }

  renderView();
}

async function renderView() {
  // Show setup if no client ID
  if (!getClientId()) {
    showSetup();
    return;
  }

  // Show login if not authenticated
  if (!isLoggedIn()) {
    showLogin();
    return;
  }

  // Check for pending share from service worker
  const params = new URLSearchParams(window.location.search);
  if (params.get('shared') === '1') {
    window.history.replaceState({}, '', '/');
    pendingShare = await popPendingShare();
  }

  if (pendingShare) {
    showCapture(pendingShare);
  } else {
    showDashboard();
  }
}

// --- Views ---

function showSetup() {
  hide('view-login');
  hide('view-capture');
  hide('view-dashboard');
  show('view-setup');

  $('setup-form').onsubmit = e => {
    e.preventDefault();
    const id = $('client-id-input').value.trim();
    if (!id) return;
    setClientId(id);
    renderView();
  };
}

function showLogin() {
  hide('view-setup');
  hide('view-capture');
  hide('view-dashboard');
  show('view-login');

  $('btn-login').onclick = async () => {
    try {
      await startLoginImplicit();
    } catch (err) {
      setStatus(err.message, 'error');
    }
  };
}

function showCapture(shared) {
  hide('view-setup');
  hide('view-login');
  hide('view-dashboard');
  show('view-capture');

  // Pre-fill fields
  $('capture-title').value = shared.title || '';
  $('capture-text').value = shared.text || (shared.url ? '' : '');
  $('capture-url').value = shared.url || '';
  $('capture-note').value = '';

  updatePreview();

  $('capture-title').oninput = updatePreview;
  $('capture-text').oninput = updatePreview;
  $('capture-url').oninput = updatePreview;
  $('capture-note').oninput = updatePreview;

  $('btn-save').onclick = () => saveCapture(shared.timestamp);
  $('btn-discard').onclick = () => {
    pendingShare = null;
    showDashboard();
  };
}

function updatePreview() {
  const md = buildMarkdown({
    title: $('capture-title').value,
    text: $('capture-text').value,
    url: $('capture-url').value,
    note: $('capture-note').value
  });
  $('preview').textContent = md;
}

async function saveCapture(timestamp) {
  const btn = $('btn-save');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    const result = await saveToInbox({
      title: $('capture-title').value,
      text: $('capture-text').value,
      url: $('capture-url').value,
      note: $('capture-note').value,
      timestamp
    });

    setStatus(`Saved: ${result.name}`, 'success');
    pendingShare = null;
    setTimeout(() => showDashboard(), 1500);
  } catch (err) {
    setStatus(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Save to Brain';
  }
}

async function showDashboard() {
  hide('view-setup');
  hide('view-login');
  hide('view-capture');
  show('view-dashboard');

  $('btn-logout').onclick = () => { logout(); renderView(); };
  $('btn-new').onclick = () => showManualCapture();

  loadRecentFiles();
}

async function loadRecentFiles() {
  const list = $('recent-files');
  list.innerHTML = '<li class="loading">Loading…</li>';

  try {
    const files = await listInbox(15);
    if (files.length === 0) {
      list.innerHTML = '<li class="empty">No files yet. Share something to get started!</li>';
      return;
    }
    list.innerHTML = files.map(f => `
      <li>
        <a href="${f.webViewLink}" target="_blank" rel="noopener">
          ${escapeHtml(f.name)}
        </a>
        <span class="date">${new Date(f.createdTime).toLocaleString()}</span>
      </li>
    `).join('');
  } catch (err) {
    list.innerHTML = `<li class="error">${escapeHtml(err.message)}</li>`;
  }
}

function showManualCapture() {
  pendingShare = { title: '', text: '', url: '', timestamp: new Date().toISOString() };
  showCapture(pendingShare);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Boot
init();
