// PreCog Executive Portal - Google Identity Services auth + encrypted vault unlock.
// Layers: (1) Google sign-in, ID token verified cryptographically (Google JWKS,
// RS256), audience/issuer/expiry checked, email allowlist enforced;
// (2) AES-256-GCM vault encrypted at rest, PBKDF2-SHA256 passphrase.
'use strict';

const CLIENT_ID = '772714846400-hfpqo5drk383v14v7kh7a4bfo7s3fa6c.apps.googleusercontent.com';
const ADMIN_EMAIL = 'timlangeveldt@gmail.com';
const VAULT_URL = 'data/vault.enc';
const SESSION_KEY = 'pcg_exec_jwt';
const PBKDF2_ITERS = 250000;

let jwksCache = { keys: null, at: 0 };

function b64urlToBytes(s) {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = t.length % 4 === 0 ? '' : '='.repeat(4 - (t.length % 4));
  return Uint8Array.from(atob(t + pad), (c) => c.charCodeAt(0));
}

async function getJwks() {
  if (jwksCache.keys && Date.now() - jwksCache.at < 3600e3) return jwksCache.keys;
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs', { cache: 'no-store' });
  if (!res.ok) throw new Error('Google key fetch failed (' + res.status + ')');
  const j = await res.json();
  jwksCache = { keys: j.keys, at: Date.now() };
  return jwksCache.keys;
}

async function verifyGoogleIdToken(token) {
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('malformed token');
  const [h, p, s] = parts;
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
  if (header.alg !== 'RS256') throw new Error('unexpected signing algorithm');
  let keys = await getJwks();
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) { // key rotation - refetch once
    jwksCache = { keys: null, at: 0 };
    keys = await getJwks();
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) throw new Error('signing key not found');
  const key = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'],
  );
  const ok = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    b64urlToBytes(s),
    new TextEncoder().encode(h + '.' + p),
  );
  if (!ok) throw new Error('signature verification failed');
  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') throw new Error('bad issuer');
  if (payload.aud !== CLIENT_ID) throw new Error('bad audience');
  if (!payload.exp || payload.exp < now) throw new Error('token expired');
  if (payload.email_verified !== true && payload.email_verified !== 'true') throw new Error('email not verified');
  if (String(payload.email || '').toLowerCase() !== ADMIN_EMAIL) throw new Error('unauthorized Google account');
  return payload;
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = 'ACCESS DENIED - ' + msg;
  el.style.display = 'block';
}

function startGis() {
  if (!(window.google && google.accounts && google.accounts.id)) {
    setTimeout(startGis, 100);
    return;
  }
  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: async (res) => {
      try {
        const payload = await verifyGoogleIdToken(res.credential);
        sessionStorage.setItem(SESSION_KEY, res.credential);
        showApp(payload);
      } catch (e) {
        showAuthError(e.message);
      }
    },
    auto_select: false,
    cancel_on_tap_outside: false,
  });
  google.accounts.id.renderButton(document.getElementById('g_id_signin'), {
    theme: 'outline', size: 'large', text: 'sign_in_with',
    shape: 'rectangular', width: 320,
  });
}

function showApp(payload) {
  document.getElementById('auth-gate').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('whoami').textContent = payload.email;
  document.getElementById('vault-pass').focus();
}

document.getElementById('signout').addEventListener('click', () => {
  sessionStorage.removeItem(SESSION_KEY);
  location.reload();
});

document.getElementById('vault-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const status = document.getElementById('vault-status');
  status.textContent = 'Deriving key...';
  status.className = 'vault-status';
  const pass = document.getElementById('vault-pass').value;
  try {
    const res = await fetch(VAULT_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('vault fetch failed (' + res.status + ')');
    const u8 = new Uint8Array(await res.arrayBuffer());
    if (u8.length < 29) throw new Error('vault corrupt');
    const salt = u8.slice(0, 16);
    const iv = u8.slice(16, 28);
    const ct = u8.slice(28);
    const keyMaterial = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey'],
    );
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );
    let pt;
    try {
      pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    } catch {
      throw new Error('Wrong passphrase, or vault data corrupted.');
    }
    renderVault(JSON.parse(new TextDecoder().decode(pt)));
    status.textContent = 'Vault unlocked.';
    status.className = 'vault-status ok';
    document.getElementById('vault-form').style.display = 'none';
  } catch (err) {
    status.textContent = err.message;
    status.className = 'vault-status err';
  }
});

function prettyKey(k) {
  return k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderVault(data) {
  const root = document.getElementById('vault-content');
  root.innerHTML = '';
  const meta = document.createElement('div');
  meta.className = 'vault-meta';
  meta.textContent = (data.classification || 'CONFIDENTIAL') + '  ·  generated ' + (data.generated_utc || 'unknown');
  root.appendChild(meta);
  for (const [k, v] of Object.entries(data)) {
    if (k === 'classification' || k === 'generated_utc') continue;
    root.appendChild(renderCard(k, v));
  }
}

function renderCard(title, val) {
  const card = document.createElement('div');
  card.className = 'vault-card';
  const h = document.createElement('h3');
  h.textContent = prettyKey(title);
  card.appendChild(h);
  const body = document.createElement('div');
  body.className = 'vault-body';
  if (Array.isArray(val)) {
    const ul = document.createElement('ul');
    for (const item of val) {
      const li = document.createElement('li');
      if (item && typeof item === 'object') {
        li.className = 'vault-obj';
        li.textContent = Object.entries(item).map(([a, b]) => prettyKey(a) + ': ' + (b && typeof b === 'object' ? JSON.stringify(b) : b)).join('\n');
      } else {
        li.textContent = String(item);
      }
      ul.appendChild(li);
    }
    body.appendChild(ul);
  } else if (val && typeof val === 'object') {
    for (const [sk, sv] of Object.entries(val)) {
      const row = document.createElement('div');
      row.className = 'vault-row';
      const strong = document.createElement('strong');
      strong.textContent = prettyKey(sk) + ': ';
      row.appendChild(strong);
      if (sv && typeof sv === 'object') {
        const pre = document.createElement('span');
        pre.className = 'vault-obj';
        pre.textContent = JSON.stringify(sv, null, 2);
        row.appendChild(pre);
      } else {
        row.appendChild(document.createTextNode(String(sv)));
      }
      body.appendChild(row);
    }
  } else {
    body.textContent = String(val);
  }
  card.appendChild(body);
  return card;
}

async function boot() {
  const saved = sessionStorage.getItem(SESSION_KEY);
  if (saved) {
    try {
      const payload = await verifyGoogleIdToken(saved);
      showApp(payload);
      return;
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }
  document.getElementById('auth-gate').style.display = 'block';
  startGis();
}

boot();
