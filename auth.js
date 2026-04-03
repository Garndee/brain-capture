// Google OAuth 2.0 with PKCE (no backend required)
// Scopes needed: Drive file creation in /Brain/inbox/
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const REDIRECT_URI = window.location.origin + '/';

// Set your Google OAuth client ID here (from Google Cloud Console)
// See README.md for setup instructions
let CLIENT_ID = localStorage.getItem('google_client_id') || '';

export function setClientId(id) {
  CLIENT_ID = id.trim();
  localStorage.setItem('google_client_id', CLIENT_ID);
}

export function getClientId() {
  return CLIENT_ID;
}

// --- PKCE helpers ---

function base64urlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64urlEncode(array);
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64urlEncode(digest);
}

// --- Auth flow ---

export async function startLogin() {
  if (!CLIENT_ID) {
    throw new Error('No client ID configured. See setup instructions.');
  }

  const verifier = await generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);

  sessionStorage.setItem('pkce_verifier', verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent'
  });

  window.location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + params;
}

export async function handleAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return false;

  const verifier = sessionStorage.getItem('pkce_verifier');
  if (!verifier) return false;

  // Exchange code for tokens
  // NOTE: PKCE was designed for this — but Google requires a client_secret for
  // server-side token exchange. For a purely static PWA we use the implicit/token
  // flow instead. We'll switch to token response_type below.
  // The code above is kept for reference; actual exchange happens via token endpoint
  // which needs a backend. For a static-only app we use implicit flow (token).

  // Clean up URL
  window.history.replaceState({}, '', '/');
  return false; // Signal to use implicit flow path
}

// Implicit flow (simpler for static PWA, token in URL hash)
export async function startLoginImplicit() {
  if (!CLIENT_ID) {
    throw new Error('No client ID configured.');
  }

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'token',
    scope: SCOPES,
    include_granted_scopes: 'true'
  });

  window.location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + params;
}

export function handleTokenCallback() {
  // Tokens come back in URL hash for implicit flow
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const token = hash.get('access_token');
  const expiresIn = hash.get('expires_in');

  if (token) {
    const expiry = Date.now() + parseInt(expiresIn, 10) * 1000;
    localStorage.setItem('access_token', token);
    localStorage.setItem('token_expiry', expiry);
    window.history.replaceState({}, '', '/');
    return token;
  }
  return null;
}

export function getToken() {
  const token = localStorage.getItem('access_token');
  const expiry = parseInt(localStorage.getItem('token_expiry') || '0', 10);
  if (token && Date.now() < expiry - 60000) return token; // 1 min buffer
  return null;
}

export function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('token_expiry');
}

export function isLoggedIn() {
  return !!getToken();
}
