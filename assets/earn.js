(() => {
    'use strict';

    const textEncoder = new TextEncoder();
    const state = {
        running: false,
        attempts: 0,
        accepted: 0,
        startedAt: 0,
        rateTimer: null,
        loopHandle: null,
        packageId: 'PC-DEMO-' + String(Date.now() % 10000).padStart(4, '0'),
        simulatedPeerShares: 11,
        simulatedPeerTotal: 16
    };

    const $ = (id) => document.getElementById(id);
    const log = (message) => {
        const line = document.createElement('span');
        line.textContent = '[' + new Date().toLocaleTimeString() + '] ' + message;
        $('demo-log').appendChild(line);
        $('demo-log').scrollTop = $('demo-log').scrollHeight;
    };
    const leadingZeros = (hex) => {
        const match = /^0*/.exec(hex);
        return match ? match[0].length : 0;
    };
    const updateLedger = () => {
        const totalShares = Math.max(1, state.accepted + state.simulatedPeerShares);
        const peers = Math.max(1, state.simulatedPeerTotal + (state.accepted > 0 ? 1 : 0));
        const splitMode = $('peer-mode').value;
        const proportional = state.accepted / totalShares;
        const equal = 1 / peers;
        const selected = splitMode === 'equal' ? equal : proportional;

        $('attempt-count').textContent = String(state.attempts);
        $('accepted-count').textContent = String(state.accepted);
        $('pool-share').textContent = (proportional * 100).toFixed(3) + '%';
        $('illustrative-share').textContent = selected.toFixed(3);
        $('allocation-label').textContent = splitMode === 'equal' ? '1 / opted-in peers' : 'valid shares';
        $('share-progress').style.width = Math.min(100, (state.accepted / 12) * 100) + '%';
        $('package-id').textContent = state.packageId;
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
    const reset = () => {
        window.clearTimeout(state.rateTimer);
        window.clearTimeout(state.loopHandle);
        state.running = false;
        state.attempts = 0;
        state.accepted = 0;
        state.startedAt = 0;
        state.packageId = 'PC-DEMO-' + String(Date.now() % 10000).padStart(4, '0');
        $('demo-log').replaceChildren();
        log('Demo reset. No work was sent to a pool.');
        setRunning(false);
        $('rate-count').textContent = '0';
        updateLedger();
    };
    const runLoop = async () => {
        if (!state.running) return;

        for (let i = 0; i < 28 && state.running; i += 1) {
            state.attempts += 1;
            const payload = state.packageId + ':' + state.attempts + ':' + crypto.getRandomValues(new Uint32Array(1))[0];
            const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(payload));
            const hex = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
            if (leadingZeros(hex) >= Number($('difficulty').value)) {
                state.accepted += 1;
                log('share accepted: ' + hex.slice(0, 16) + '...');
            }
        }

        updateLedger();
        state.loopHandle = window.setTimeout(runLoop, 24);
    };
    const start = () => {
        if (state.running) return;
        state.attempts = state.attempts || 0;
        state.startedAt = performance.now();
        setRunning(true);
        log('Local demo started. Work is computed in this tab only.');
        updateRate();
        runLoop();
    };
    const stop = () => {
        state.running = false;
        window.clearTimeout(state.rateTimer);
        window.clearTimeout(state.loopHandle);
        setRunning(false);
        log('Demo stopped by operator.');
        updateLedger();
    };

    $('start-demo').addEventListener('click', start);
    $('stop-demo').addEventListener('click', stop);
    $('reset-demo').addEventListener('click', reset);
    $('peer-mode').addEventListener('change', updateLedger);
    $('difficulty').addEventListener('change', updateLedger);

    log('Demo ready. No mining begins until you press Start demo.');
    updateLedger();
})();
