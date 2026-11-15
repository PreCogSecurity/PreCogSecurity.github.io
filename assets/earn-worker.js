// earn-worker.js - dedicated hash worker for the PreCog Earn demo console.
//
// WHY THIS FILE EXISTS
// --------------------
// The demo console previously hashed on the main thread with a single async
// loop, which capped throughput at one core and froze the UI counters. Modern
// browsers expose hardware-accelerated SHA-256 through Web Crypto; running it
// inside pooled workers lets the demo use every consented core while keeping
// the page responsive and stoppable at any moment.
//
// This worker performs NOTHING until the main thread sends it a batch, and
// the main thread only sends batches after the operator has explicitly
// consented. There is no network, no storage, and no persistent state here.

'use strict';

const encoder = new TextEncoder();
const leadingZeroNibbles = (hex) => {
    const match = /^0*/.exec(hex);
    return match ? match[0].length : 0;
};

const toHex = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let out = '';
    for (let i = 0; i < bytes.length; i += 1) {
        out += bytes[i].toString(16).padStart(2, '0');
    }
    return out;
};

// Mine a contiguous batch of nonces against `packageId`.
// Responds with { type: 'result', attempts, accepted, nonce, hash }.
const mine = async ({ packageId, difficulty, startNonce, count }) => {
    let attempts = 0;
    let accepted = 0;
    let bestHash = null;

    for (let nonce = startNonce; nonce < startNonce + count; nonce += 1) {
        attempts += 1;
        const payload = packageId + ':' + nonce;
        // crypto.subtle is hardware-accelerated (SHA-NI / ARMv8 crypto
        // extensions) on mainstream CPUs, which is the honest meaning of
        // "hardware accelerated cryptography" in a browser context.
        const digest = await crypto.subtle.digest('SHA-256', encoder.encode(payload));
        const hex = toHex(digest);

        if (leadingZeroNibbles(hex) >= difficulty) {
            accepted += 1;
            bestHash = hex;
        }
    }

    return { attempts, accepted, bestHash };
};

self.addEventListener('message', async (event) => {
    const message = event.data || {};
    if (message.type !== 'mine') {
        return;
    }

    const result = await mine(message);
    self.postMessage({
        type: 'result',
        attempts: result.attempts,
        accepted: result.accepted,
        nonce: message.startNonce,
        packageId: message.packageId,
        hash: result.bestHash
    });
});
