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


// === PreCog Wallet preview + motion enhancements ===
(function () {
  const CHAINS = [
    { name:'Bitcoin', ticker:'BTC', type:'l1', cat:['l1'], fmt:'bc1… / 1… / 3…', addr:'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' },
    { name:'Ethereum', ticker:'ETH', type:'evm', cat:['evm','l1'], fmt:'0x… (EVM)', addr:'0x742d35Cc6634C0532925a3b844Bc454e4438f44e' },
    { name:'Solana', ticker:'SOL', type:'l1', cat:['l1'], fmt:'Base58', addr:'7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV' },
    { name:'Monero', ticker:'XMR', type:'l1', cat:['l1'], fmt:'4… / 8… (95 chars)', addr:'44AFFq5kSiGBoZ...example...XMRaddress' },
    { name:'BNB Chain', ticker:'BNB', type:'evm', cat:['evm','l1'], fmt:'0x… (EVM)', addr:'0x742d35Cc6634C0532925a3b844Bc454e4438f44e' },
    { name:'Polygon', ticker:'POL', type:'evm', cat:['evm','l2'], fmt:'0x… (EVM)', addr:'0x742d35Cc6634C0532925a3b844Bc454e4438f44e' },
    { name:'Arbitrum', ticker:'ARB', type:'evm', cat:['evm','l2'], fmt:'0x… (EVM)', addr:'0x742d35Cc6634C0532925a3b844Bc454e4438f44e' },
    { name:'Base', ticker:'ETH', type:'evm', cat:['evm','l2'], fmt:'0x… (EVM)', addr:'0x742d35Cc6634C0532925a3b844Bc454e4438f44e' },
    { name:'Optimism', ticker:'OP', type:'evm', cat:['evm','l2'], fmt:'0x… (EVM)', addr:'0x742d35Cc6634C0532925a3b844Bc454e4438f44e' },
    { name:'Avalanche C', ticker:'AVAX', type:'evm', cat:['evm','l1'], fmt:'0x… (EVM)', addr:'0x742d35Cc6634C0532925a3b844Bc454e4438f44e' },
    { name:'Tron', ticker:'TRX', type:'l1', cat:['l1'], fmt:'T… (Base58)', addr:'TQ5YkqP8x9r3exampleTRONaddress' },
    { name:'Litecoin', ticker:'LTC', type:'l1', cat:['l1'], fmt:'ltc1… / L… / M…', addr:'ltc1qexampleaddressforpreviewonly' },
    { name:'Dogecoin', ticker:'DOGE', type:'l1', cat:['l1'], fmt:'D…', addr:'DExampleDogecoinAddressPreview' },
    { name:'Cosmos Hub', ticker:'ATOM', type:'l1', cat:['l1'], fmt:'cosmos1…', addr:'cosmos1exampleaddresspreview' },
    { name:'Polkadot', ticker:'DOT', type:'l1', cat:['l1'], fmt:'SS58', addr:'1ExamplePolkadotAddressPreview' },
    { name:'Cardano', ticker:'ADA', type:'l1', cat:['l1'], fmt:'addr1…', addr:'addr1qexamplecardanoaddresspreview' },
    { name:'XRP Ledger', ticker:'XRP', type:'l1', cat:['l1'], fmt:'r… (+ destination tag)', addr:'rExampleXRPAddress' },
    { name:'Stellar', ticker:'XLM', type:'l1', cat:['l1'], fmt:'G… (+ memo)', addr:'GEXAMPLESTELLARADDRESSPREVIEW' },
    { name:'TON', ticker:'TON', type:'l1', cat:['l1'], fmt:'EQ… / UQ…', addr:'EQExampleTONAddressPreview' },
    { name:'Sui', ticker:'SUI', type:'l1', cat:['l1'], fmt:'0x…', addr:'0xexample_sui_address_preview' },
    { name:'Aptos', ticker:'APT', type:'l1', cat:['l1'], fmt:'0x…', addr:'0xexample_aptos_address_preview' },
    { name:'Near', ticker:'NEAR', type:'l1', cat:['l1'], fmt:'name.near', addr:'example.near' },
    { name:'Bitcoin Cash', ticker:'BCH', type:'l1', cat:['l1'], fmt:'bitcoincash:…', addr:'bitcoincash:qexamplepreview' },
    { name:'USDT (multi-chain)', ticker:'USDT', type:'stable', cat:['stable','evm'], fmt:'Chain-specific', addr:'Select a network for the correct USDT address format' },
    { name:'USDC (multi-chain)', ticker:'USDC', type:'stable', cat:['stable','evm'], fmt:'Chain-specific', addr:'Select a network for the correct USDC address format' }
  ];
  const $ = (id) => document.getElementById(id);
  const grid = $('chain-grid');
  const search = $('chain-search');
  const detailTitle = $('wallet-detail-title');
  const detailBadge = $('wallet-detail-badge');
  const detailBody = $('wallet-detail-body');
  const detailAddr = $('wallet-detail-address');
  const copyBtn = $('wallet-copy');
  let filter = 'all';
  let selected = null;
  function render() {
    if (!grid) return;
    const q = ((search && search.value) || '').trim().toLowerCase();
    const items = CHAINS.filter(c => {
      const inFilter = filter === 'all' || c.cat.includes(filter) || c.type === filter;
      const inQ = !q || c.name.toLowerCase().includes(q) || c.ticker.toLowerCase().includes(q);
      return inFilter && inQ;
    });
    grid.innerHTML = '';
    const count = $('chain-count');
    if (count) count.textContent = items.length + ' shown · 25+ supported';
    items.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chain-card' + (selected && selected.name === c.name ? ' selected' : '');
      b.innerHTML = '<div class="chain-top"><span class="chain-name"></span><span class="chain-ticker"></span></div><div class="chain-meta"></div>';
      b.querySelector('.chain-name').textContent = c.name;
      b.querySelector('.chain-ticker').textContent = c.ticker;
      b.querySelector('.chain-meta').textContent = c.fmt;
      b.addEventListener('click', () => selectChain(c));
      grid.appendChild(b);
    });
    if (!items.length) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = 'No chains match your search. Try BTC, ETH, SOL, XMR, or an L2 name.';
      grid.appendChild(p);
    }
  }
  function selectChain(c) {
    selected = c;
    if (detailTitle) detailTitle.textContent = c.name + ' (' + c.ticker + ')';
    if (detailBadge) detailBadge.textContent = c.type.toUpperCase();
    if (detailBody) detailBody.textContent = 'Receive format: ' + c.fmt + '. Preview shows an example placeholder; connect a verified wallet or set your own address for production use.';
    if (detailAddr) detailAddr.textContent = c.addr;
    if (copyBtn) { copyBtn.disabled = false; copyBtn.textContent = 'Copy'; }
    render();
  }
  document.querySelectorAll('[data-chain-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-chain-filter]').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      filter = btn.getAttribute('data-chain-filter') || 'all';
      render();
    });
  });
  if (search) search.addEventListener('input', render);
  if (copyBtn) copyBtn.addEventListener('click', async () => {
    if (!selected || !detailAddr) return;
    try { await navigator.clipboard.writeText(detailAddr.textContent || ''); copyBtn.textContent = 'Copied'; }
    catch (e) { copyBtn.textContent = 'Press Ctrl+C'; }
    setTimeout(() => { if (copyBtn) copyBtn.textContent = 'Copy'; }, 1400);
  });
  document.querySelectorAll('[data-wallet-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = btn.getAttribute('data-wallet-action');
      const msg = {
        receive: 'Receive: pick a chain below to view address format and destination details.',
        send: 'Send: connect a verified wallet/provider for the selected network to authorize transfers (self-custody).',
        swap: 'Swap: route via integrated providers once enabled for your selected chain and region.',
        connect: 'Connect: supports wallet connections where available (browser/injected providers, WalletConnect flows) — minimal fuss, explicit permissions.'
      }[a] || 'Ready.';
      if (detailBadge) detailBadge.textContent = a ? a.toUpperCase() : 'Ready';
      if (detailBody) detailBody.textContent = msg;
    });
  });
  const revealEls = document.querySelectorAll('.section, .hero-panel, .formula-card, .roadmap-card, .panel, .cta-panel');
  revealEls.forEach(el => el.classList.add('reveal'));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    revealEls.forEach(el => io.observe(el));
  } else { revealEls.forEach(el => el.classList.add('in')); }
  render();
})();
