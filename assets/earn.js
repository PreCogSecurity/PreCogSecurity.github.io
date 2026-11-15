// earn.js — PreCog Earn estimator.
//
// This page has no demo miner. The estimator prints the same defensive math
// we use internally, so anybody can see the order of magnitude honestly.
// No network calls. No hashing work is performed by this file.

(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);

    // Defensive per-thread constant: ~57 H/s per thread measured on an i7-3610QM.
    // Deliberately pessimistic; treat output as an order of magnitude.
    const H_PER_THREAD = 57;
    const SHARES_PER_YEAR_PER_H = 0.9;         // pool Diff-dependent; round figure
    const POOL_SHARE_PERCENT_PER_H = 0.0000025; // absurdly conservative placeholder

    const compute = () => {
        const threads = Number($('calc-threads').value);
        const mode = $('calc-mode').value;

        const h = threads * H_PER_THREAD;
        const creditsYear = Math.round(h * SHARES_PER_YEAR_PER_H);
        // of the 50% redemption pool: conservative share
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

    $('calc-threads').addEventListener('change', compute);
    $('calc-mode').addEventListener('change', compute);
    compute();
})();
