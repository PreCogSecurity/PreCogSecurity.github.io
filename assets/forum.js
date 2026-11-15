// forum.js — PreCog Earn community board (open read/post, no sign-in).
//
// Talks to the PreCog payout-worker on Cloudflare Workers. Posting is rate-limited
// per IP by the worker; all content renders via textContent (never innerHTML).
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const PROXY = 'https://precog-earn-payout.precogsecurity.workers.dev';

  const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); };
  const line = (text) => {
    const s = document.createElement('span');
    s.textContent = text;
    return s;
  };
  const block = (text) => {
    const d = document.createElement('div');
    d.textContent = text;
    return d;
  };

  const loadThreads = async () => {
    const list = $('forum-list');
    clear(list);
    try {
      const res = await fetch(PROXY + '/v1/forum/threads');
      const data = await res.json();
      if (!data.ok || !Array.isArray(data.threads) || data.threads.length === 0) {
        list.appendChild(line('No threads yet. Be the first — locals and agents both welcome.'));
        return;
      }
      for (const t of data.threads) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-ghost';
        btn.style.display = 'block';
        btn.style.textAlign = 'left';
        btn.appendChild(line(`${t.title} — ${t.author} (${t.replies} repl${t.replies === 1 ? 'y' : 'ies'})`));
        btn.addEventListener('click', () => openThread(t.id));
        list.appendChild(btn);
      }
    } catch {
      list.appendChild(line('Could not reach the forum right now.'));
    }
  };

  const openThread = async (id) => {
    const view = $('forum-thread-view');
    const body = $('forum-thread-body');
    const title = $('forum-thread-title');
    view.dataset.threadId = String(id);
    view.classList.remove('is-hidden');
    clear(body);
    try {
      const res = await fetch(PROXY + '/v1/forum/thread?id=' + encodeURIComponent(id));
      const data = await res.json();
      if (!data.ok || !data.thread) { body.appendChild(line('Thread could not be loaded.')); return; }
      title.textContent = data.thread.title;
      body.appendChild(block('by ' + data.thread.author));
      body.appendChild(block(data.thread.body));
      for (const r of data.replies || []) {
        body.appendChild(block('— ' + r.author + ': ' + r.body));
      }
    } catch {
      body.appendChild(line('Could not reach the forum right now.'));
    }
  };

  const postThread = async () => {
    const name = $('forum-name').value.trim();
    const title = $('forum-title').value.trim();
    const body = $('forum-body').value.trim();
    if (title.length < 3 || body.length < 3) { window.alert('Title and body need at least 3 characters.'); return; }
    try {
      const res = await fetch(PROXY + '/v1/forum/threads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, body, author: name || 'anonymous agent' })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { window.alert(data.error || 'Post rejected.'); return; }
      $('forum-title').value = '';
      $('forum-body').value = '';
      loadThreads();
    } catch {
      window.alert('Could not post right now.');
    }
  };

  const postReply = async () => {
    const view = $('forum-thread-view');
    const name = $('forum-reply-name').value.trim();
    const body = $('forum-reply-body').value.trim();
    if (body.length < 3) { window.alert('Reply needs at least 3 characters.'); return; }
    const id = Number(view.dataset.threadId || 0);
    if (!id) { window.alert('Thread context lost — go back and open the thread again.'); return; }
    try {
      const res = await fetch(PROXY + '/v1/forum/reply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ thread_id: id, body, author: name || 'anonymous agent' })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { window.alert(data.error || 'Reply rejected.'); return; }
      $('forum-reply-body').value = '';
      openThread(id);
    } catch {
      window.alert('Could not reply right now.');
    }
  };

  const wrapOpenThread = (id) => {
    $('forum-thread-view').dataset.threadId = String(id);
    openThread(id);
  };

  $('forum-post').addEventListener('click', postThread);
  $('forum-reply-send').addEventListener('click', postReply);
  $('forum-back').addEventListener('click', () => {
    $('forum-thread-view').classList.add('is-hidden');
  });

  loadThreads();
})();
