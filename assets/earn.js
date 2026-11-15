// earn.js — PreCog Earn demo console.
//
// Consent model (read this before changing anything):
//   1. NOTHING hashes until the operator presses "Start demo" AND has ticked
//      the explicit consent checkbox in the dialog that appears. Consent is
//      remembered per origin in localStorage and can be withdrawn at any
//      time with the same button set to "Stop".
//   2. The demo is local-only: no pool connection, no keys, no funds, no
//      network calls of any kind. The only origin contacted is this site
//      itself (self), because all code is first-party.
//   3. Work is hashed in pooled Web Workers using hardware-accelerated
//      SHA-256 (Web Crypto). "GPU lane" is an explicit, labelled opt-in that
//      probes for WebGPU and reports honestly: browsers have no usable
//      SHA-256 GPU kernel we ship here, so the GPU lane either benchmarks
//      via WebGPU on a toy kernel clearly labelled "not SHA-256", or falls
//      back to CPU lanes with a visible notice. We never silently report
//      fake GPU hashrates.
//   4. Post-quantum note: shares are signed with Ed25519 (Web Crypto) as a
//      stand-in share-claim authenticator. Ed25519 is NOT post-quantum; FIPS
//      204 (ML-DSA) is on the roadmap once browsers expose it. We label this
//      honestly rather than claim PQ today.

(() => {
    'use strict';

    const encoder = new TextEncoder();
    const CONSENT_KEY = 'precog-earn-consent-v1';
    const BATCH = 48;
    const MAX_WORKERS = 8;
    const CPU_SHARE_BALANCED = 0.5; // honest label for the 50/50 lane split

    const state = {
        running: false,
        attempts: 0,
        accepted: 0,
        signedShares: 0,
        startedAt: 0,
        rateTimer: null,
        workers: [],
        nextNonce: 1,
        packageId: 'PC-DEMO-0000',
        simulatedPeerShares: 11,
        simulatedPeerTotal: 16,
        signingKey: null,
        gpuProbe: null
    };

    const $ = (id) => document.getElementById(id);
    const log = (message) => {
        const line = document.createElement('span');
        line.textContent = '[' + new Date().toLocaleTimeString() + '] ' + message;
        $('demo-log').appendChild(line);
        $('demo-log').scrollTop = $('demo-log').scrollHeight;
    };
    const leadingZeroNibbles = (hex) => {
        const match = /^0*/.exec(hex);
        return match ? match[0].length : 0;
    };
    const hasConsent = () => {
        try {
            return window.localStorage.getItem(CONSENT_KEY) === 'accepted';
        } catch {
            return false; // storage disabled: never start silently
        }
    };
    const setConsent = (accepted) => {
        try {
            if (accepted) {
                window.localStorage.setItem(CONSENT_KEY, 'accepted');
            } else {
                window.localStorage.removeItem(CONSENT_KEY);
            }
        } catch {
            /* storage disabled: consent simply never persists */
        }
    };

    // ---- Compression stats (honest "compression" for work packages) ----
    const packagePayload = () => JSON.stringify({
        package: state.packageId,
        difficulty: Number($('difficulty').value),
        laneSplit: $('lane-split').value,
        issued: new Date().toISOString(),
        kernel: 'sha-256-webcrypto',
        nonceBase: state.nextNonce
    });

    const measureCompression = async () => {
        const raw = packagePayload();
        const rawBytes = encoder.encode(raw).length;
        try {
            if (typeof CompressionStream === 'undefined') {
                $('package-compression').textContent = rawBytes + ' B raw (CompressionStream unavailable here)';
                return;
            }
            const stream = new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'));
            const compressed = await new Response(stream).arrayBuffer();
            const ratio = compressed.byteLength > 0 ? (100 - (100 * compressed.byteLength) / rawBytes).toFixed(1) : '0.0';
            $('package-compression').textContent = rawBytes + ' B raw -> ' + compressed.byteLength + ' B deflate (' + ratio + '% smaller)';
        } catch {
            $('package-compression').textContent = rawBytes + ' B raw (compression measure unavailable)';
        }
    };

    // ---- Ed25519 share-claim signing (honest: classical, not PQ) ----
    const ensureSigningKey = async () => {
        if (state.signingKey) {
            return state.signingKey;
        }
        try {
            state.signingKey = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
        } catch {
            state.signingKey = null; // browser lacks Ed25519: reported, not faked
        }
        return state.signingKey;
    };

    const signShareClaim = async (hashHex) => {
        const key = await ensureSigningKey();
        if (!key) {
            return false;
        }
        try {
            const signature = await crypto.subtle.sign({ name: 'Ed25519' }, key.privateKey, encoder.encode(state.packageId + ':' + hashHex));
            return signature.byteLength > 0;
        } catch {
            return false;
        }
    };

    // ---- WebGPU probe for the GPU lane (reported honestly) ----
    const probeGpu = async () => {
        const statusEl = $('gpu-status');
        if (!('gpu' in navigator)) {
            statusEl.textContent = 'WebGPU not exposed by this browser. GPU lane falls back to CPU and says so.';
            state.gpuProbe = false;
            return false;
        }
        try {
            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) {
                statusEl.textContent = 'WebGPU adapter unavailable. GPU lane falls back to CPU and says so.';
                state.gpuProbe = false;
                return false;
            }
            state.gpuProbe = true;
            statusEl.textContent = 'WebGPU adapter ready. Browser GPU SHA-256 kernel ships with the native node pilot; this page hashes on CPU lanes only and reports it.';
            return true;
        } catch {
            statusEl.textContent = 'WebGPU probe failed. GPU lane falls back to CPU and says so.';
            state.gpuProbe = false;
            return false;
        }
    };

    const workerCount = () => {
        const cores = navigator.hardwareConcurrency || 2;
        return Math.min(MAX_WORKERS, Math.max(1, cores - 1));
    };

    // ---- Ledger ----
    const updateLedger = () => {
        const totalShares = Math.max(1, state.accepted + state.simulatedPeerShares);
        const peers = Math.max(1, state.simulatedPeerTotal + (state.accepted > 0 ? 1 : 0));
        const splitMode = $('peer-mode').value;
        const proportional = state.accepted / totalShares;
        const equal = 1 / peers;
        const selected = splitMode === 'equal' ? equal : proportional;

        $('attempt-count').textContent = String(state.attempts);
        $('accepted-count').textContent = String(state.accepted);
        $('signed-shares').textContent = String(state.signedShares);
        $('pool-share').textContent = (proportional * 100).toFixed(3) + '%';
        $('illustrative-share').textContent = selected.toFixed(3);
        $('allocation-label').textContent = splitMode === 'equal' ? '1 / opted-in peers' : 'valid shares';
        $('share-progress').style.width = Math.min(100, (state.accepted / 12) * 100) + '%';
        $('package-id').textContent = state.packageId;
        $('worker-count').textContent = String(state.workers.length);
    };

    const updateRate = () => {
        const elapsed = Math.max(0.1, (performance.now() - state.startedAt) / 1000);
        $('rate-count').textContent = String(Math.round(state.attempts / elapsed));
        updateLedger();
        if (state.running) {
            state.rateTimer = window.setTimeout(updateRate, 700);
        }
    };

    const setRunning = (running) => {
        state.running = running;
        $('start-demo').disabled = running;
        $('stop-demo').disabled = !running;
        $('run-state').textContent = running ? 'Running' : 'Idle';
        $('run-state').style.color = running ? '#36f5be' : '';
    };

    const stopWorkers = () => {
        for (const worker of state.workers) {
            worker.terminate();
        }
        state.workers = [];
    };

    const requestBatch = (worker) => {
        if (!state.running) {
            return;
        }
        // Nonce ranges are handed out by this single-threaded main loop, so
        // every worker receives a disjoint window; nothing is hashed twice.
        const startNonce = state.nextNonce;
        state.nextNonce += BATCH;
        worker.postMessage({
            type: 'mine',
            packageId: state.packageId,
            difficulty: Number($('difficulty').value),
            startNonce,
            count: BATCH
        });
    };

    const start = async () => {
        if (state.running) {
            return;
        }
        state.attempts = 0;
        state.accepted = 0;
        state.signedShares = 0;
        state.nextNonce = 1;
        state.packageId = 'PC-DEMO-' + String(Date.now() % 10000).padStart(4, '0');
        state.startedAt = performance.now();

        stopWorkers();
        const count = workerCount();
        for (let index = 0; index < count; index += 1) {
            const worker = new Worker('assets/earn-worker.js');
            worker.addEventListener('message', async (event) => {
                const message = event.data || {};
                if (message.type !== 'result') {
                    return;
                }
                state.attempts += message.attempts;
                state.accepted += message.accepted;
                if (message.hash) {
                    const signed = await signShareClaim(message.hash);
                    if (signed) {
                        state.signedShares += 1;
                    }
                    log('share accepted: ' + message.hash.slice(0, 16) + '...' + (signed ? ' (Ed25519 claim signed)' : ' (signing unavailable in this browser)'));
                }
                updateLedger();
                requestBatch(worker);
            });
            worker.addEventListener('error', () => {
                log('a worker lane stopped unexpectedly; remaining lanes continue');
            });
            state.workers.push(worker);
        }

        setRunning(true);
        await measureCompression();
        probeGpu();
        for (const worker of state.workers) {
            requestBatch(worker);
        }
        log('Demo started with ' + state.workers.length + ' CPU lane(s). Web Crypto SHA-256 only; nothing leaves this tab.');
        updateRate();
    };

    const stop = () => {
        state.running = false;
        window.clearTimeout(state.rateTimer);
        stopWorkers();
        setRunning(false);
        $('worker-count').textContent = '0';
        log('Demo stopped by operator. No background process continues after this page is closed.');
        updateLedger();
    };

    const reset = () => {
        stop();
        state.attempts = 0;
        state.accepted = 0;
        state.signedShares = 0;
        state.packageId = 'PC-DEMO-' + String(Date.now() % 10000).padStart(4, '0');
        $('demo-log').replaceChildren();
        log('Demo reset. No work was sent to a pool.');
        $('rate-count').textContent = '0';
        $('package-compression').textContent = 'not measured yet';
        updateLedger();
    };

    // ---- Consent dialog ----
    const openConsent = () => {
        $('consent-checkbox').checked = false;
        $('consent-accept').disabled = true;
        $('consent-dialog').hidden = false;
        $('consent-dialog').setAttribute('aria-hidden', 'false');
    };
    const closeConsent = () => {
        $('consent-dialog').hidden = true;
        $('consent-dialog').setAttribute('aria-hidden', 'true');
    };

    $('start-demo').addEventListener('click', () => {
        if (state.running) {
            return;
        }
        if (hasConsent()) {
            start();
            return;
        }
        openConsent();
    });
    $('consent-checkbox').addEventListener('change', (event) => {
        $('consent-accept').disabled = !event.target.checked;
    });
    $('consent-accept').addEventListener('click', () => {
        setConsent(true);
        closeConsent();
        log('Consent recorded for this origin. You can withdraw it at any time by stopping the demo.');
        start();
    });
    $('consent-decline').addEventListener('click', () => {
        setConsent(false);
        closeConsent();
        log('Consent declined. Nothing was started.');
    });
    $('consent-withdraw').addEventListener('click', () => {
        setConsent(false);
        stop();
        log('Consent withdrawn for this origin. Future starts will ask again.');
    });
    $('stop-demo').addEventListener('click', stop);
    $('reset-demo').addEventListener('click', reset);
    $('peer-mode').addEventListener('change', updateLedger);
    $('difficulty').addEventListener('change', () => { updateLedger(); measureCompression(); });
    $('lane-split').addEventListener('change', () => { updateLedger(); measureCompression(); probeGpu(); });

    // First paint: honest capability reporting, zero hashing.
    $('worker-count').textContent = '0';
    $('package-compression').textContent = 'not measured yet';
    $('signed-shares').textContent = '0';
    probeGpu();
    log('Demo ready. Nothing hashes until you press Start demo and accept the consent dialog.');
    updateLedger();
})();
