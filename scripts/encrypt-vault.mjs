// Encrypt a vault JSON file with AES-256-GCM using a PBKDF2-SHA256 derived key.
// Output layout: [16B salt][12B iv][ciphertext || 16B GCM tag]
// Usage (passphrase via env, never argv): VAULT_PASSPHRASE=... node encrypt-vault.mjs <in.json> <out.enc>
import { readFileSync, writeFileSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';

const pass = process.env.VAULT_PASSPHRASE;
if (!pass) {
  console.error('VAULT_PASSPHRASE env var is required (never pass it as an argument)');
  process.exit(1);
}
const [inPath, outPath] = process.argv.slice(2);
if (!inPath || !outPath) {
  console.error('usage: VAULT_PASSPHRASE=... node encrypt-vault.mjs <in.json> <out.enc>');
  process.exit(1);
}

const ITERATIONS = 250000;
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const keyMaterial = await crypto.subtle.importKey(
  'raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey'],
);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
  keyMaterial,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt'],
);
const plaintext = readFileSync(inPath);
const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext));
const out = new Uint8Array(salt.length + iv.length + ct.length);
out.set(salt, 0);
out.set(iv, 16);
out.set(ct, 28);
writeFileSync(outPath, out);
console.log(`encrypted ${inPath} -> ${outPath} (${out.length} bytes, PBKDF2 ${ITERATIONS} iters)`);
