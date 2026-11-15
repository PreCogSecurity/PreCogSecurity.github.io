// earn.js — PreCog Earn estimator + live telemetry.
//
// This page shows the same defensive math we use internally, and reads the
// public pool stats for any wallet you paste (operator treasury by default).
// No network calls beyond the public pool-stats proxy. No hashing work is
// performed by this file.

(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const PROXY = 'https://precog-earn-payout.precogsecurity.workers.dev/v1/pool-stats';
    const REFRESH_MS = 20000;

    // ---------- estimator ----------
    const H_PER_THREAD = 57;
    const SHARES_PER_YEAR_PER_H = 0.9;         // pool Diff-dependent; round figure
    const POOL_SHARE_PERCENT_PER_H = 0.0000025; // absurdly conservative placeholder

    const compute = () => {
        const threads = Number($('calc-threads').value);
        const mode = $('calc-mode').value;

        const h = threads * H_PER_THREAD;
        const creditsYear = Math.round(h * SHARES_PER_YEAR_PER_H);
        const poolPct = (h * POOL_SHARE_PERCENT_PER_H * 100).toFixed(4) + '%';

        $('est-h').textContent = String(h);
        $('est-year-credits').textContent = creditsYear.toLocaleString();
        $('est-pool-share').textContent = mode === 'equal' ? '1/N cohort' : poolPct;

        const log = $('calc-log');
        log.replaceChildren();
        const line = document.createElement('span');
        line.textContent = `${threads} thread(s) ≈ ${h} H/s · references: 3 threads ≈ 170 H/s on an i7-3610QM. Not a promise.`;
        log.appendChild(line);
    };

    // ---------- live telemetry ----------
    const logLine = (msg) => {
        const log = $('telemetry-log');
        const line = document.createElement('span');
        line.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
        log.appendChild(line);
        log.scrollTop = log.scrollHeight;
    };
    const setBadge = (state) => {
        const el = $('telemetry-state');
        el.textContent = state;
        el.style.color = state === 'Live' ? '#36f5be' : '';
    };
    const fmtNum = (n) => Number(n).toLocaleString();
    const refresh = async (manual) => {
        const wallet = ($('telemetry-wallet').value || '').trim();
        if (!/^[48A-Za-z0-9]{95}$/.test(wallet)) {
            setBadge('Bad wallet');
            logLine('wallet must be a 95-character XMR standard or subaddress');
            return;
        }
        setBadge('Loading');
        try {
            const res = await fetch(PROXY + '?wallet=' + encodeURIComponent(wallet));
            const body = await res.json();
            if (!res.ok || !body.ok) {
                setBadge('Error');
                logLine('proxy rejected: ' + (body.error || res.status));
                return;
            }
            const stats = body.wallet_pool_stats || {};
            $('t-hashrate').textContent = fmtNum(stats.hashrate);
            $('t-shares').textContent = fmtNum(stats.valid_shares);
            $('t-total').textContent = fmtNum(stats.total_hashes);
            setBadge('Live');
            logLine(`hashrate ${fmtNum(stats.hashrate)} H/s · ${fmtNum(stats.valid_shares)} valid shares · ${fmtNum(stats.total_hashes)} total hashes`);
        } catch (e) {
            setBadge('Error');
            logLine('network error reading pool stats');
        }
    };

    $('calc-threads').addEventListener('change', compute);
    $('calc-mode').addEventListener('change', compute);
    $('telemetry-refresh').addEventListener('click', () => refresh(true));

    compute();
    refresh(false);
    window.setInterval(refresh, REFRESH_MS);
})();
