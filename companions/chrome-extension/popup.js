// popup.js — PreCog Earn Companion pilot.
//
// Consent model (non-negotiable):
//   - Hashing runs ONLY while `state.enabled` is true, which is only after
//     the operator clicks "Enable work (I consent)" in THIS popup.
//   - The popup is the whole node: when it closes, the work ends. There is
//     no background service worker doing hidden work. That is deliberate and
//     documented, not a missing feature.
//   - All state lives in chrome.storage.local on this device. Nothing is
//     transmitted anywhere.

'use strict';

const state = {
  enabled: false,
  attempts: 0,
  accepted: 0,
  difficulty: 2,
  packageId: 'PC-EXT-' + String(Date.now() % 10000).padStart(4, '0'),
  loop: null
};

const $ = (id) => document.getElementById(id);
const encoder = new TextEncoder();

const leadingZeroNibbles = (hex) => {
  const match = /^0*/.exec(hex);
  return match ? match[0].length : 0;
};

const render = async () => {
  $('state').textContent = state.enabled ? 'Running (visible, in this popup)' : 'Disabled';
  $('attempts').textContent = String(state.attempts);
  $('accepted').textContent = String(state.accepted);
  const stored = await chrome.storage.local.get(['log']);
  $('log-count').textContent = String((stored.log || []).length);
  $('toggle').setAttribute('aria-pressed', String(state.enabled));
  $('toggle').textContent = state.enabled ? 'Stop work (withdraw consent)' : 'Enable work (I consent)';
};

const appendLog = async (entry) => {
  const stored = await chrome.storage.local.get(['log']);
  const log = stored.log || [];
  log.push({ at: new Date().toISOString(), entry });
  while (log.length > 50) {
    log.shift();
  }
  await chrome.storage.local.set({ log });
};

const tick = async () => {
  if (!state.enabled) {
    return;
  }
  for (let i = 0; i < 16 && state.enabled; i += 1) {
    state.attempts += 1;
    const payload = `${state.packageId}:${state.attempts}`;
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(payload));
    const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    if (leadingZeroNibbles(hex) >= state.difficulty) {
      state.accepted += 1;
      await appendLog(`share candidate ${hex.slice(0, 16)}… (local only, not submitted)`);
    }
  }
  await render();
  if (state.enabled) {
    state.loop = setTimeout(tick, 30);
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  const stored = await chrome.storage.local.get(['attempts', 'accepted']);
  state.attempts = stored.attempts || 0;
  state.accepted = stored.accepted || 0;
  await render();

  $('toggle').addEventListener('click', async () => {
    state.enabled = !state.enabled;
    await appendLog(state.enabled ? 'consent granted via popup toggle' : 'consent withdrawn via popup toggle');
    if (state.enabled) {
      tick();
    } else {
      clearTimeout(state.loop);
      await chrome.storage.local.set({ attempts: state.attempts, accepted: state.accepted });
      await render();
    }
  });

  $('reset').addEventListener('click', async () => {
    state.attempts = 0;
    state.accepted = 0;
    await chrome.storage.local.set({ attempts: 0, accepted: 0, log: [] });
    await appendLog('local counters reset by operator');
    await render();
  });

  window.addEventListener('unload', () => {
    // Popup closing stops all work; persist counters for next open.
    chrome.storage.local.set({ attempts: state.attempts, accepted: state.accepted });
  });
});
