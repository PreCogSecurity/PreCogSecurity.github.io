(() => {
  const STORE_KEY = 'precog.earn.v1';
  const BLESSED = {
    btc: 'bc1qhtnzal6wupj4xg049juwarkqmle7lqxemyezrw',
    eth: '0xa71b83C6CC50665E4B67fDCEecD63D5100cCf988'
  };
  const PROFILES = {
    sha256: { label: 'SHA-256', sub: 'Bitcoin-style proof of work', algo: 'SHA-256', prst: 0.0008, cog: 0.04, mult: 1.0 },
    sha512: { label: 'SHA-512', sub: 'High-throughput profile', algo: 'SHA-512', prst: 0.0012, cog: 0.06, mult: 1.1 },
    sha384: { label: 'SHA-384', sub: 'Balanced profile', algo: 'SHA-384', prst: 0.0011, cog: 0.055, mult: 1.05 },
    sha1: { label: 'SHA-1', sub: 'Legacy high-rate profile', algo: 'SHA-1', prst: 0.0015, cog: 0.08, mult: 1.3 },
    keccak256: { label: 'Keccak-256', sub: 'Ethereum address puzzle', algo: 'keccak256', prst: 0.002, cog: 0.11, mult: 1.6 }
  };
  const STREAMS = [
    { name: 'ZKP hash mining', type: 'crypto', rate: 'variable by profile' },
    { name: 'Keccak-256 puzzle lane', type: 'crypto', rate: 'Ethash-style target' },
    { name: 'Bounty pull requests', type: 'bounty', rate: '$30 - $5,000 per PR' },
    { name: 'Bug bounty findings', type: 'bounty', rate: '$50 - $5,000 per finding' },
    { name: 'Puzzle & CTF competitions', type: 'competition', rate: 'per event' },
    { name: 'Crypto puzzle bounties', type: 'bounty', rate: 'variable, on-chain' },
    { name: 'DataFactor improve loop', type: 'automation', rate: 'passive, CI-gated' },
    { name: 'Storefront operations', type: 'store', rate: 'margin-based' }
  ];
  const LOOP_CONFIG = {
    status: 'RUNNING',
    cycle: '120s',
    workers: 4,
    sources: ['GitHub', 'OpenOpire', 'Polar', 'BossBounty', 'Algora', 'watchlist'],
    models: ['cloud-first Gemini / OpenRouter', 'Ollama Phi-4-mini-instruct Q4_K_M', 'qwen2.5-coder:7b']
  };

  const defaults = {
    prst: 0,
    cog: 0,
    totalEarned: 0,
    shares: 0,
    algo: 'sha256',
    threads: Math.min(4, navigator.hardwareConcurrency || 2),
    auto: false,
    wallet: null,
    research: []
  };
  let state = Object.assign({}, defaults, loadState());
  let mining = false;
  let autoTimer = null;
  let nonceState = {};
  let hashWindowStart = 0;
  let hashes = 0;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }
  function saveState() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {}
  }
  function $(id) { return document.getElementById(id); }
  function fmt(n, d) { return Number(n).toFixed(d === undefined ? 4 : d); }
  function stamp() { return new Date().toLocaleTimeString(); }
  function log(message, cls) {
    const el = $('miner-log');
    if (!el) return;
    const line = document.createElement('div');
    if (cls) line.className = cls;
    line.textContent = '[' + stamp() + '] ' + message;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  }
  function researchLog(message, cls) {
    const el = $('research-log');
    if (!el) return;
    const line = document.createElement('div');
    if (cls) line.className = cls;
    line.textContent = '[' + stamp() + '] ' + message;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  }
  function toast(message) {
    const el = $('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function difficulty() {
    const base = 3;
    return Math.min(5, base + Math.floor(state.shares / 40));
  }

  function renderStats() {
    $('prst-val').textContent = fmt(state.prst);
    $('cog-val').textContent = fmt(state.cog, 2);
    $('shares-val').textContent = state.shares;
    $('difficulty-val').textContent = difficulty();
    if ($('difficulty-val-2')) $('difficulty-val-2').textContent = difficulty();
    $('total-val').textContent = fmt(state.totalEarned) + ' PRST';
    const target = '0'.repeat(difficulty());
    $('target-val').textContent = target + '…';
  }

  function renderHashRate() {
    const secs = Math.max(0.001, (performance.now() - hashWindowStart) / 1000);
    const rate = hashes / secs;
    const text = rate > 1000 ? (rate / 1000).toFixed(2) + ' kH/s' : rate.toFixed(0) + ' H/s';
    $('hashrate-val').textContent = text;
    if ($('hashrate-val-2')) $('hashrate-val-2').textContent = text;
    if (mining) {
      hashWindowStart = performance.now();
      hashes = 0;
      setTimeout(renderHashRate, 1000);
    }
  }

  function renderProfile() {
    const p = PROFILES[state.algo];
    $('profile-desc').textContent = p.sub + ' · ' + fmt(p.prst * p.mult, 5) + ' PRST + ' + fmt(p.cog * p.mult, 3) + ' COG per accepted share';
  }

  const KECCAK_MASK = 0xFFFFFFFFFFFFFFFFn;
  const KECCAK_ROT = [
    [0, 36, 3, 41, 18],
    [1, 44, 10, 45, 2],
    [62, 6, 43, 15, 61],
    [28, 55, 25, 21, 56],
    [27, 20, 39, 8, 14]
  ];
  const KECCAK_RC = [
    0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
    0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
    0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
    0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
    0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
    0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n
  ];

  function rotl64(value, shift) {
    return ((value << shift) | (value >> (64n - shift))) & KECCAK_MASK;
  }

  function keccakF1600(state) {
    for (let round = 0; round < 24; round++) {
      const c = new Array(5);
      for (let x = 0; x < 5; x++) c[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
      const d = new Array(5);
      for (let x = 0; x < 5; x++) d[x] = c[(x + 4) % 5] ^ rotl64(c[(x + 1) % 5], 1n);
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) state[x + 5 * y] ^= d[x];
      }
      const b = new Array(25);
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          b[y + 5 * ((2 * x + 3 * y) % 5)] = rotl64(state[x + 5 * y], BigInt(KECCAK_ROT[x][y]));
        }
      }
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          state[x + 5 * y] = b[x + 5 * y] ^ (~b[(x + 1) % 5 + 5 * y] & b[(x + 2) % 5 + 5 * y]);
        }
      }
      state[0] ^= KECCAK_RC[round];
    }
  }

  // Original Keccak-256 (Ethereum-style) padding: 0x01 ... 0x80.
  function keccak256(message) {
    const rate = 136;
    const state = new Array(25).fill(0n);
    const bytes = new TextEncoder().encode(message);
    const paddedLength = Math.ceil((bytes.length + 1) / rate) * rate;
    const padded = new Uint8Array(paddedLength);
    padded.set(bytes);
    padded[bytes.length] = 0x01;
    padded[paddedLength - 1] |= 0x80;
    for (let offset = 0; offset < paddedLength; offset += rate) {
      for (let j = 0; j < rate; j++) {
        state[j >> 3] ^= BigInt(padded[offset + j]) << BigInt((j % 8) * 8);
      }
      keccakF1600(state);
    }
    let out = '';
    for (let j = 0; j < 32; j++) {
      out += ((state[j >> 3] >> BigInt((j % 8) * 8)) & 0xffn).toString(16).padStart(2, '0');
    }
    return out;
  }

  async function digest(algo, text) {
    if (algo === 'keccak256') return keccak256(text);
    const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function miner(id) {
    const p = PROFILES[state.algo];
    const diff = difficulty();
    const target = '0'.repeat(diff);
    const seed = id + ':' + Date.now().toString(36) + ':' + Math.random().toString(36).slice(2);
    let n = nonceState[id] || 0;
    while (mining) {
      for (let i = 0; i < 200 && mining; i++) {
        n += 1;
        const h = await digest(p.algo, seed + ':' + n);
        hashes += 1;
        if (h.slice(0, diff) === target) {
          state.shares += 1;
          const pay = p.prst * p.mult;
          const cog = p.cog * p.mult;
          state.prst += pay;
          state.cog += cog;
          state.totalEarned += pay;
          log('share #' + state.shares + ' ' + h.slice(0, 16) + '…  +' + fmt(pay, 5) + ' PRST  +' + fmt(cog, 3) + ' COG', 'ok');
          saveState();
          renderStats();
        }
      }
      nonceState[id] = n;
      await new Promise(r => setTimeout(r, 0));
    }
  }

  async function startMining() {
    if (mining) return;
    if (state.algo !== 'keccak256' && !crypto.subtle) {
      toast('This browser does not expose WebCrypto on this origin.');
      return;
    }
    mining = true;
    hashWindowStart = performance.now();
    hashes = 0;
    $('btn-mine').textContent = 'Stop mining';
    $('btn-mine').classList.add('btn-danger');
    $('mine-status').textContent = 'mining with ' + state.threads + ' worker(s)';
    renderHashRate();
    const jobs = [];
    for (let i = 0; i < state.threads; i++) jobs.push(miner(i));
    await Promise.all(jobs);
    mining = false;
    $('btn-mine').textContent = 'Start mining';
    $('btn-mine').classList.remove('btn-danger');
    $('mine-status').textContent = 'idle';
    log('mining stopped after ' + state.shares + ' total shares');
  }

  function stopMining() {
    mining = false;
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
    saveState();
  }

  function setAuto(on) {
    state.auto = !!on;
    $('auto-toggle').checked = state.auto;
    if (state.auto) {
      if (!mining) startMining();
      autoTimer = setInterval(() => {
        if (!mining && state.auto) startMining();
      }, 2000);
      log('auto-mining enabled', 'ok');
    } else {
      if (autoTimer) clearInterval(autoTimer);
      autoTimer = null;
      stopMining();
      log('auto-mining disabled');
    }
    saveState();
  }

  function autoOptimize() {
    const cores = navigator.hardwareConcurrency || 4;
    state.threads = Math.min(8, Math.max(1, cores));
    state.algo = cores >= 8 ? 'sha1' : cores >= 4 ? 'sha512' : 'sha256';
    $('algo-select').value = state.algo;
    $('threads-input').value = state.threads;
    renderProfile();
    saveState();
    log('auto-optimizer selected ' + PROFILES[state.algo].label + ' with ' + state.threads + ' worker(s) on ' + cores + ' core(s)', 'ok');
    toast('Profile: ' + PROFILES[state.algo].label + ', ' + state.threads + ' workers');
  }

  async function connectWallet() {
    if (!window.ethereum) {
      toast('No browser wallet detected.');
      researchLog('Wallet: no window.ethereum provider found', 'warn');
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const addr = accounts[0];
      state.wallet = addr;
      saveState();
      const net = await window.ethereum.request({ method: 'eth_chainId' }).catch(() => '0x1');
      const names = { '0x1': 'Ethereum', '0x89': 'Polygon', '0xa': 'Optimism', '0xa4b1': 'Arbitrum', '0x38': 'BNB Chain' };
      const chain = names[net] || ('chain ' + net);
      let balance = '0.0000';
      try {
        const wei = await window.ethereum.request({ method: 'eth_getBalance', params: [addr, 'latest'] });
        balance = fmt(parseInt(wei, 16) / 1e18);
      } catch (e) {}
      $('wallet-status').textContent = addr.slice(0, 6) + '…' + addr.slice(-4);
      $('network-val').textContent = chain;
      $('balance-val').textContent = balance + ' ETH';
      researchLog('Wallet connected: ' + addr.slice(0, 10) + '… on ' + chain, 'ok');
    } catch (e) {
      toast('Wallet connection cancelled.');
    }
  }

  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      toast(label + ' copied');
    } catch (e) {
      toast('Copy failed');
    }
  }

  async function fetchJSON(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function pick(obj, keys) {
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
    }
    return null;
  }

  function normalizeGitHub(body) {
    const items = Array.isArray(body.items) ? body.items : [];
    return items.map(it => {
      const repo = (it.repository_url || '').split('/repos/').pop() || '';
      return {
        source: 'GitHub',
        title: it.title || 'Untitled bounty',
        url: it.html_url || '',
        repo,
        reward: null,
        labels: (it.labels || []).map(l => (typeof l === 'string' ? l : l.name)).filter(Boolean).slice(0, 4)
      };
    });
  }

  function normalizeAlgora(body) {
    let items = [];
    if (body && body.result && body.result.data) {
      const d = body.result.data;
      items = d.json || d.bounties || (Array.isArray(d) ? d : []);
    }
    if (!Array.isArray(items)) items = [];
    return items.map(it => {
      const org = it.org && typeof it.org === 'object' ? (it.org.name || it.org.handle) : it.org;
      const reward = pick(it, ['reward', 'amount', 'bounty', 'total']);
      return {
        source: 'Algora',
        title: it.title || it.name || 'Untitled bounty',
        url: it.url || it.link || '',
        repo: org || '',
        reward: reward !== null && !isNaN(Number(reward)) ? Number(reward) : null,
        labels: (it.labels || it.tags || []).slice(0, 4)
      };
    });
  }

  function normalizeOpire(body) {
    const items = Array.isArray(body) ? body : (Array.isArray(body.rewards) ? body.rewards : []);
    return items.map(it => {
      const url = it.issueUrl || it.url || it.issue_url || '';
      const repo = (url.split('github.com/')[1] || '').split('/').slice(0, 2).join('/');
      const reward = pick(it, ['amount', 'reward', 'value']);
      return {
        source: 'Opire',
        title: it.title || it.description || 'Untitled bounty',
        url,
        repo,
        reward: reward !== null && !isNaN(Number(reward)) ? Number(reward) : null,
        labels: (it.labels || []).slice(0, 4),
        currency: it.currency || 'USD'
      };
    });
  }

  async function scanBounties() {
    const btn = $('btn-scan');
    btn.disabled = true;
    btn.textContent = 'Scanning…';
    $('bounty-list').innerHTML = '<div class="empty">Querying live bounty sources…</div>';
    const jobs = [
      ['GitHub', 'https://api.github.com/search/issues?q=is:issue+is:open+label%3Abounty&sort=updated&order=desc&per_page=6', normalizeGitHub],
      ['GitHub bug-bounty', 'https://api.github.com/search/issues?q=is:issue+is:open+label%3Abug-bounty&sort=updated&order=desc&per_page=6', normalizeGitHub],
      ['GitHub paid-task', 'https://api.github.com/search/issues?q=is:issue+is:open+no%3Aassignee+%22%2Fbounty+%24%22+sort%3Acreated-desc&per_page=6', normalizeGitHub],
      ['Polar', 'https://api.github.com/search/issues?q=is:issue+is:open+no%3Aassignee+commenter%3Apolar-sh&sort=created-desc&per_page=6', normalizeGitHub],
      ['BossBounty', 'https://api.github.com/search/issues?q=is:issue+is:open+no%3Aassignee+commenter%3Aboss-bounty%5Bbot%5D&sort=created-desc&per_page=6', normalizeGitHub],
      ['Algora', 'https://console.algora.io/api/trpc/bounty.list?input=' + encodeURIComponent(JSON.stringify({ limit: 6, status: 'open' })), normalizeAlgora],
      ['Opire', 'https://api.opire.dev/rewards?limit=6', normalizeOpire]
    ];
    const all = [];
    const errors = [];
    const results = await Promise.all(jobs.map(async ([label, url, map]) => {
      try {
        const body = await fetchJSON(url);
        return map(body).map(x => Object.assign({ label }, x));
      } catch (e) {
        errors.push(label + ': ' + (e.name === 'AbortError' ? 'timeout' : e.message));
        return [];
      }
    }));
    results.flat().forEach(item => {
      if (!item.url) return;
      if (all.some(x => x.url === item.url)) return;
      all.push(item);
    });
    all.sort((a, b) => (b.reward || 0) - (a.reward || 0));
    renderBounties(all);
    log('bounty scan: ' + all.length + ' live listings from ' + jobs.length + ' sources' + (errors.length ? ' (' + errors.length + ' unavailable)' : ''), all.length ? 'ok' : 'warn');
    if (errors.length) log('unavailable: ' + errors.join(' · '), 'warn');
    btn.disabled = false;
    btn.textContent = 'Scan bounty sources';
  }

  function esc(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderBounties(items) {
    const host = $('bounty-list');
    if (!items.length) {
      host.innerHTML = '<div class="empty">No live listings returned. Rate limits or network may be blocking a source.</div>';
      return;
    }
    host.innerHTML = items.map(it => {
      const reward = it.reward ? '<span class="bounty-reward">$' + fmt(it.reward, 2) + (it.currency && it.currency !== 'USD' ? ' ' + esc(it.currency) : '') + '</span>' : '<span class="hint">open reward</span>';
      const meta = [esc(it.repo), esc(it.source), esc((it.labels || []).join(', '))].filter(Boolean).join(' · ');
      return '<a class="bounty-card" href="' + esc(it.url) + '" target="_blank" rel="noopener noreferrer">' +
        '<div class="bounty-top"><span class="badge cyan">' + esc(it.label) + '</span>' + reward + '</div>' +
        '<div class="bounty-title"></div>' +
        '<div class="bounty-meta">' + meta + '</div>' +
        '<div class="bounty-link">View bounty →</div></a>';
    }).join('');
    const titles = host.querySelectorAll('.bounty-title');
    items.forEach((it, i) => {
      if (titles[i]) titles[i].textContent = it.title;
    });
  }

  function renderStreams() {
    const host = $('stream-list');
    if (!host) return;
    host.innerHTML = STREAMS.map(s =>
      '<div class="stream"><div class="name">' + s.name + '<div class="rate">' + s.type + ' · ' + s.rate + '</div></div>' +
      '<div class="rate">session</div><div class="val" data-stream="' + s.type + '">' +
      (s.type === 'crypto' ? fmt(state.prst) + ' PRST' : 'active') + '</div></div>'
    ).join('');
  }

  function renderDestinations() {
    $('btc-dest').textContent = BLESSED.btc;
    $('eth-dest').textContent = BLESSED.eth;
  }

  function renderWallet() {
    if (state.wallet) {
      $('wallet-status').textContent = state.wallet.slice(0, 6) + '…' + state.wallet.slice(-4);
    }
  }

  function localResearch() {
    const cores = navigator.hardwareConcurrency || 4;
    const proposals = [
      ['Workflow', 'Cycle at 120s; keep GitHub writes serialised in the submitter so one rate limit does not stall a cycle.'],
      ['Concurrency', 'Loop workers ' + LOOP_CONFIG.workers + ' → ' + Math.min(8, cores) + ' to match detected cores; keep API serialisation in the submitter.'],
      ['Model pool', 'Keep cloud-first Gemini/OpenRouter routing with Ollama Phi-4-mini-instruct as the offline fallback; add qwen2.5-coder:7b for patch generation retries.'],
      ['Architecture', 'Route OpenBot/Odysseus offline tasks around the same gate; let agents propose workflow, model and tooling changes as gated pull requests.'],
      ['Puzzle desk', 'Add the Keccak-256 / Ethash-style address lane with on-chain entry and claim flow, and track competition reward pools per lane.'],
      ['Web3', 'Route bounty, puzzle and competition payouts to blessed rails and log every transfer to payout-approvals.json with its txid.'],
      ['Sources', 'Expand watchlist with rustchain-bounties and Algora repos; add a per-source cooldown back-off so one 403 does not stall a cycle.'],
      ['Quality', 'Keep CI as the merge gate; add a compacted report summary to each PR so reviewers see findings, fixes and tests.']
    ];
    proposals.forEach(([name, text]) => {
      const line = document.createElement('div');
      line.innerHTML = '<strong style="color:var(--primary)">' + name + ':</strong> ' + text;
      $('research-log').appendChild(line);
    });
    researchLog('Heuristic review of current loop configuration produced ' + proposals.length + ' proposals.', 'ok');
    return proposals;
  }

  async function askAi() {
    const key = $('ai-key').value.trim();
    if (!key) {
      researchLog('No API key supplied. Showing local heuristic review instead.', 'warn');
      localResearch();
      return;
    }
    researchLog('Requesting self-improvement analysis from the model pool…');
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({
          model: 'google/gemma-3-12b-it:free',
          messages: [
            { role: 'system', content: 'You are an AI architecture researcher. Review the following autonomous bounty loop and propose concrete upgrades to workflow, model routing, concurrency, sources and Web3 earnings. Be specific and terse.' },
            { role: 'user', content: 'Loop config: cycle ' + LOOP_CONFIG.cycle + ', workers ' + LOOP_CONFIG.workers + ', sources ' + LOOP_CONFIG.sources.join(', ') + ', models ' + LOOP_CONFIG.models.join(', ') + ', runtime PRST/COG miner with profiles SHA-256/SHA-512/SHA-384/SHA-1. Propose upgrades.' }
          ]
        })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const body = await res.json();
      const text = body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content;
      if (!text) throw new Error('empty response');
      text.split('\n').filter(Boolean).forEach(line => researchLog(line));
      state.research.push({ at: new Date().toISOString(), text });
      saveState();
    } catch (e) {
      researchLog('AI research failed: ' + e.message + ' — fell back to heuristic review.', 'err');
      localResearch();
    }
  }

  function wire() {
    $('btn-mine').addEventListener('click', () => {
      if (mining) {
        if (state.auto) setAuto(false);
        stopMining();
      } else {
        startMining();
      }
    });
    $('auto-toggle').addEventListener('change', e => setAuto(e.target.checked));
    $('btn-optimize').addEventListener('click', autoOptimize);
    $('algo-select').addEventListener('change', e => { state.algo = e.target.value; nonceState = {}; renderProfile(); saveState(); log('profile → ' + PROFILES[state.algo].label); });
    $('threads-input').addEventListener('change', e => { state.threads = Math.max(1, Math.min(8, Number(e.target.value) || 1)); e.target.value = state.threads; saveState(); log('workers → ' + state.threads); });
    $('btn-connect').addEventListener('click', connectWallet);
    $('copy-btc').addEventListener('click', () => copyText(BLESSED.btc, 'BTC address'));
    $('copy-eth').addEventListener('click', () => copyText(BLESSED.eth, 'ETH address'));
    $('btn-scan').addEventListener('click', scanBounties);
    $('btn-research').addEventListener('click', localResearch);
    $('btn-ask').addEventListener('click', askAi);
  }

  function init() {
    $('algo-select').value = state.algo;
    $('threads-input').value = state.threads;
    $('auto-toggle').checked = state.auto;
    renderStats();
    renderProfile();
    renderStreams();
    renderDestinations();
    renderWallet();
    wire();
    log('Earn console ready. Profiles: ' + Object.values(PROFILES).map(p => p.label).join(', '));
    researchLog('Loop self-improvement console attached. Local heuristic + optional cloud model review available.', 'ok');
    if (state.auto) setAuto(true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();