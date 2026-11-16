// Gmai admin pages (loaded after admin.js helpers).

// ---------- embed mode (inside the Admin Hub) ----------
const EMBED = new URLSearchParams(location.search).get('embed') === '1';
(function takeHubToken() {
  const h = location.hash.slice(1);
  const m = h.match(/(?:^|&)t=([^&]+)/);
  if (m) {
    S.token = decodeURIComponent(m[1]);
    sessionStorage.setItem('gm_admin_token', S.token);
    history.replaceState(null, '', location.pathname + location.search + '#' + (h.split('&')[0] || 'dashboard'));
  }
  if (EMBED) document.body.classList.add('embed');
})();

// ---------- auth ----------
async function login(e) {
  e.preventDefault();
  const f = e.target;
  try {
    const r = await api('POST', '/admin/login', { username: f.username.value, password: f.password.value });
    S.token = r.token;
    localStorage.setItem('gm_admin_token', r.token);
    boot();
  } catch (err) { $('#loginErr').textContent = err.message; }
}
function logout() {
  S.token = null;
  localStorage.removeItem('gm_admin_token');
  sessionStorage.removeItem('gm_admin_token');
  $('#shell').classList.add('hidden');
  $('#login').classList.remove('hidden');
}

// ---------- navigation ----------
const NAV = [['dashboard', '📊', 'Dashboard'], ['mailboxes', '📮', 'Mail IDs'], ['compose', '✉️', 'Send mail'], ['viewer', '📥', 'Open a mailbox'], ['messages', '🗂️', 'All messages'], ['settings', '⚙️', 'App settings'], ['audit', '📜', 'Audit logs'], ['admins', '🛡️', 'Admins']];
function renderNav() { $('#nav').innerHTML = NAV.map(([id, icon, label]) => `<a href="#${id}" class="${S.route === id ? 'active' : ''}">${icon} ${label}</a>`).join(''); }
window.addEventListener('hashchange', () => { S.route = location.hash.slice(1).split('&')[0] || 'dashboard'; $('#side').classList.remove('open'); render(); });
async function render() {
  const item = NAV.find((n) => n[0] === S.route) || NAV[0];
  S.route = item[0];
  $('#pageTitle').textContent = item[2];
  renderNav();
  const page = $('#page');
  try { await PAGES[S.route](page); } catch (e) { page.innerHTML = `<div class="card">Failed to load: ${esc(e.message)}</div>`; }
}
function switchHtml(id, checked) { return `<label class="switch"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''}/><span></span></label>`; }
const CATS = [['primary', 'Primary'], ['promotions', 'Promotions'], ['social', 'Social'], ['updates', 'Updates']];
const kindPill = (m) => (m.kind === 'user' ? pill('Person', 'success') : pill('Company / sender', 'pending'));
async function loadBoxes() { S.boxes = (await api('GET', '/admin/mailboxes')).mailboxes; return S.boxes; }
const fileToBase64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).replace(/^data:[^;]+;base64,/, '')); r.onerror = rej; r.readAsDataURL(file); });

const PAGES = {};

PAGES.dashboard = async (page) => {
  const [s, recent] = await Promise.all([api('GET', '/admin/stats'), api('GET', '/admin/messages')]);
  page.innerHTML = `
    <div class="grid stats">
      ${[['People', s.users, `${s.activeToday} active today`], ['Company / sender IDs', s.senders, 'Addresses that send to users'], ['Messages', s.transactions, `${s.messagesToday} today`],
         ['Unread in inboxes', s.unread, 'Across all mail IDs'], ['Signed-in sessions', s.sessions, 'Devices with an account'], ['Uploaded files', s.files, 'Attachments']]
        .map(([l, v, sub]) => `<div class="card stat"><div class="label">${l}</div><div class="value">${v}</div><div class="sub">${sub}</div></div>`).join('')}
    </div>
    <div class="grid two" style="margin-top:16px">
      <div class="card"><h3>Quick controls</h3>
        <div class="switch-row"><div>Maintenance mode<small>App shows a maintenance screen</small></div>${switchHtml('q-maint', s.settings.maintenanceMode)}</div>
        <div class="switch-row"><div>Allow sign up<small>People can create @${esc(s.settings.domain)} addresses in the app</small></div>${switchHtml('q-signup', s.settings.allowSignup)}</div>
        <div class="switch-row"><div>Attachments<small>Photos in emails</small></div>${switchHtml('q-att', s.settings.features.attachments)}</div>
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><a class="btn primary" href="#compose">✉️ Send mail</a><a class="btn" href="#mailboxes">+ Add mail ID</a><a class="btn" href="#viewer">📥 Open a mailbox</a></div>
      </div>
      <div class="card"><h3>How mail works here</h3>
        <p class="muted">Every address lives in this app's own database. Mail between any two addresses here is delivered instantly and shows up live in the app. Mail to an address that doesn't exist bounces back with "Address not found". Use <b>Mail IDs</b> to add people (who sign in) or company senders (like <i>support@yourshop.com</i>) and <b>Send mail</b> to send as any of them.</p>
      </div>
    </div>
    <div class="card" style="margin-top:16px"><h3>Latest messages <a href="#messages" class="btn sm" style="margin-left:auto">View all</a></h3><div id="recent"></div></div>`;
  $('#q-maint').onchange = (e) => run(() => api('PUT', '/admin/settings', { maintenanceMode: e.target.checked }), 'Maintenance ' + (e.target.checked ? 'ON' : 'OFF'));
  $('#q-signup').onchange = (e) => run(() => api('PUT', '/admin/settings', { allowSignup: e.target.checked }), 'Saved');
  $('#q-att').onchange = (e) => run(() => api('PUT', '/admin/settings', { features: { attachments: e.target.checked } }), 'Saved');
  table($('#recent'), { columns: msgColumns(), rows: recent.messages.slice(0, 8) });
};

function msgColumns() {
  return [
    { label: 'When', render: (m) => `<small>${dt(m.date)}</small>` },
    { label: 'From', render: (m) => `${esc(m.from.name)}<br><small class="muted">${esc(m.from.email)}</small>` },
    { label: 'To', render: (m) => `<small>${esc(m.to.map((t) => t.email).join(', ').slice(0, 80))}</small>` },
    { label: 'Subject', render: (m) => `<b>${esc(m.subject || '(no subject)')}</b><br><small class="muted">${esc(String(m.snippet).slice(0, 90))}</small>` },
    { label: '📎', render: (m) => (m.attachments ? m.attachments : '') },
  ];
}

// ----- mail IDs -----
PAGES.mailboxes = async (page) => {
  await loadBoxes();
  page.innerHTML = `<div class="toolbar"><input id="bq" placeholder="Search name or address" value="${esc(S.bq || '')}"/>
    <select id="bf"><option value="">All</option><option value="user">People</option><option value="sender">Company / senders</option><option value="blocked">Suspended</option></select>
    <span class="spacer"></span><button class="btn primary" id="addBox">+ Add mail ID</button></div><div id="bt"></div>`;
  $('#bf').value = S.bf || '';
  const draw = () => {
    const q = (S.bq || '').toLowerCase();
    const rows = S.boxes.filter((m) => (!q || `${m.name} ${m.email}`.toLowerCase().includes(q)) && (!S.bf || (S.bf === 'blocked' ? m.blocked : m.kind === S.bf)));
    table($('#bt'), {
      rows,
      columns: [
        { label: 'Mail ID', render: (m) => person(m, m.email) },
        { label: 'Type', render: (m) => kindPill(m) + (m.blocked ? ' ' + pill('Suspended', 'failed') : '') },
        { label: 'Lands in', render: (m) => esc((CATS.find((c) => c[0] === m.category) || [0, 'Primary'])[1]) },
        { label: 'Inbox', render: (m) => `${m.inbox} <small class="muted">(${m.unread} unread)</small>` },
        { label: 'Sent', key: 'sent' },
        { label: 'Last active', render: (m) => `<small>${m.lastActive ? dt(m.lastActive) : '—'}</small>` },
      ],
      actions: (m) => act('open', 'Open') + act('send', 'Send as') + act('edit', 'Edit') + act('block', m.blocked ? 'Restore' : 'Suspend') + act('delete', 'Delete', 'danger'),
      onAction: async (a, m) => {
        if (a === 'open') { S.viewBox = m.id; location.hash = 'viewer'; }
        if (a === 'send') { S.draft = { fromEmail: m.email, fromName: m.name }; location.hash = 'compose'; }
        if (a === 'edit') editBox(m);
        if (a === 'block') { await run(() => api('PUT', `/admin/mailboxes/${m.id}`, { blocked: !m.blocked }), m.blocked ? 'Restored' : 'Suspended and signed out'); PAGES.mailboxes(page); }
        if (a === 'delete' && await confirmBox(`Delete ${m.email} and everything in its mailbox? Messages it sent stay in other people's inboxes.`)) { await run(() => api('DELETE', `/admin/mailboxes/${m.id}`), 'Deleted'); PAGES.mailboxes(page); }
      },
      empty: 'No mail IDs match',
    });
  };
  draw();
  $('#bq').oninput = (e) => { S.bq = e.target.value; draw(); };
  $('#bf').onchange = (e) => { S.bf = e.target.value; draw(); };
  $('#addBox').onclick = () => editBox(null);
};
function editBox(m) {
  const fields = [
    { name: 'name', label: 'Display name', value: m ? m.name : '' },
    ...(m ? [] : [{ name: 'email', label: 'Email address', placeholder: 'priya  or  support@yourshop.com', hint: 'Just a username gets the app domain added.' }]),
    { name: 'kind', label: 'Type', type: 'select', value: m ? m.kind : 'user', options: [['user', 'Person (signs in to the app)'], ['sender', 'Company / sender (no sign-in)']] },
    { name: 'category', label: 'Mail from this ID lands in', type: 'select', value: m ? m.category : 'primary', options: CATS },
    { name: 'password', label: m ? 'New password (leave empty to keep)' : 'Password (people only)', type: 'text', placeholder: m ? '' : 'demo123' },
    { name: 'color', label: 'Avatar colour', type: 'color', value: m ? m.color : '#1a73e8' },
  ];
  modal({
    title: m ? `Edit ${m.email}` : 'Add a mail ID', fields, submitText: m ? 'Save' : 'Create',
    onSubmit: async (v) => {
      if (!v.password) delete v.password;
      if (m) await run(() => api('PUT', `/admin/mailboxes/${m.id}`, v), 'Saved');
      else await run(() => api('POST', '/admin/mailboxes', v), 'Mail ID created');
      PAGES.mailboxes($('#page'));
    },
  });
}

// ----- send mail as any address -----
PAGES.compose = async (page) => {
  await loadBoxes();
  const d = S.draft || {};
  S.draft = null;
  const opts = S.boxes.filter((m) => !m.blocked).map((m) => `<option value="${esc(m.email)}" data-name="${esc(m.name)}">${esc(m.name)} &lt;${esc(m.email)}&gt;</option>`).join('');
  page.innerHTML = `<div class="card" style="max-width:820px"><form id="cf" class="form-grid">
    <label class="span2">From<select name="fromPick"><option value="">✏️ Type a new address…</option>${opts}</select></label>
    <label id="newFrom" class="span2" style="display:none">New sender address<input name="fromEmail" placeholder="noreply@yourshop.com" value="${esc(d.fromEmail || '')}"/></label>
    <label>Sender name<input name="fromName" value="${esc(d.fromName || '')}" placeholder="Shown in the inbox"/></label>
    <label>Lands in<select name="category">${CATS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
    <label class="span2">To<input name="to" value="${esc(d.to || '')}" placeholder="akshay@gmai.app, priya@gmai.app"/></label>
    <label class="check span2"><input type="checkbox" name="toAll"/> Send to every person (all user mail IDs)</label>
    <label class="span2">Cc<input name="cc" placeholder="optional"/></label>
    <label class="span2">Subject<input name="subject" value="${esc(d.subject || '')}"/></label>
    <label class="span2">Message<textarea name="body" rows="10" placeholder="Write your message">${esc(d.body || '')}</textarea>
      <small class="muted">Formatting: a line starting with "# " becomes a coloured banner, **bold**, lines starting with "- " become bullets; links and emails are clickable.</small></label>
    <label class="span2">Attachments<input type="file" name="files" multiple/></label>
    <input type="hidden" name="threadId" value="${esc(d.threadId || '')}"/><input type="hidden" name="inReplyTo" value="${esc(d.inReplyTo || '')}"/>
    <div class="span2" style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn" id="clr">Clear</button><button class="btn primary">Send</button></div>
  </form><div id="sendResult"></div></div>`;
  const f = $('#cf');
  const sync = () => {
    const opt = f.fromPick.selectedOptions[0];
    $('#newFrom').style.display = f.fromPick.value ? 'none' : '';
    if (f.fromPick.value) {
      f.fromEmail.value = f.fromPick.value;
      if (!f.fromName.value || f.fromName.dataset.auto) { f.fromName.value = opt.dataset.name; f.fromName.dataset.auto = '1'; }
      const box = S.boxes.find((m) => m.email === f.fromPick.value);
      if (box) f.category.value = box.category || 'primary';
    }
  };
  if (d.fromEmail && S.boxes.some((m) => m.email === d.fromEmail)) f.fromPick.value = d.fromEmail;
  f.fromPick.onchange = sync;
  f.fromName.oninput = () => { delete f.fromName.dataset.auto; };
  sync();
  f.toAll.onchange = () => { f.to.disabled = f.toAll.checked; };
  $('#clr').onclick = () => PAGES.compose(page);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button.primary');
    btn.disabled = true;
    try {
      const attachments = [];
      for (const file of f.files.files) {
        const r = await api('POST', '/admin/files', { name: file.name, type: file.type || 'application/octet-stream', data: await fileToBase64(file) });
        attachments.push(r.file.id);
      }
      const r = await api('POST', '/admin/send', {
        fromEmail: f.fromPick.value || f.fromEmail.value, fromName: f.fromName.value, to: f.to.value, toAll: f.toAll.checked, cc: f.cc.value,
        subject: f.subject.value, body: f.body.value, category: f.category.value, attachments, threadId: f.threadId.value || undefined, inReplyTo: f.inReplyTo.value || undefined,
      });
      $('#sendResult').innerHTML = `<p class="muted" style="margin-top:12px">✅ Delivered to ${r.delivered.length} mailbox(es)${r.bounced.length ? `. ⚠️ Not found: ${esc(r.bounced.join(', '))}` : ''}.</p>`;
      toast('Mail sent');
      f.subject.value = ''; f.body.value = ''; f.files.value = ''; f.threadId.value = ''; f.inReplyTo.value = '';
    } catch (err) { toast(err.message, true); }
    btn.disabled = false;
  };
};

// ----- open any mailbox -----
const FOLDERS = [['primary', 'Primary'], ['promotions', 'Promotions'], ['social', 'Social'], ['updates', 'Updates'], ['sent', 'Sent'], ['drafts', 'Drafts'], ['scheduled', 'Scheduled'], ['spam', 'Spam'], ['trash', 'Trash'], ['all', 'All mail']];
PAGES.viewer = async (page) => {
  await loadBoxes();
  if (!S.viewBox || !S.boxes.some((m) => m.id === S.viewBox)) S.viewBox = (S.boxes.find((m) => m.kind === 'user') || S.boxes[0] || {}).id;
  S.viewFolder = S.viewFolder || 'primary';
  page.innerHTML = `<div class="toolbar"><select id="vb">${S.boxes.map((m) => `<option value="${m.id}" ${m.id === S.viewBox ? 'selected' : ''}>${esc(m.name)} &lt;${esc(m.email)}&gt;${m.unread ? ` (${m.unread} unread)` : ''}</option>`).join('')}</select>
    <input id="vq" placeholder="Search this mailbox" value="${esc(S.vq || '')}"/><span class="spacer"></span><button class="btn primary" id="vsend">✉️ Send as this ID</button></div>
    <div id="vt" style="display:flex;gap:6px;flex-wrap:wrap">${FOLDERS.map(([k, l]) => `<button class="btn sm ${k === S.viewFolder ? 'primary' : ''}" data-f="${k}">${l}</button>`).join('')}</div><div id="vlist" style="margin-top:12px"></div>`;
  const sentish = () => ['sent', 'drafts', 'scheduled'].includes(S.viewFolder);
  const load = async () => {
    const r = await api('GET', `/admin/mailboxes/${S.viewBox}/threads?view=${S.viewFolder}&q=${encodeURIComponent(S.vq || '')}`);
    table($('#vlist'), {
      rows: r.threads,
      columns: [
        { label: '', render: (t) => (t.unread ? '🔵' : '') + (t.starred ? '⭐' : '') },
        { label: sentish() ? 'To' : 'From', render: (t) => `${esc(t.sentView ? 'To: ' + ((t.to[0] && (t.to[0].name || t.to[0].email)) || '') : t.people.join(', '))}${t.count > 1 ? ` <small class="muted">${t.count}</small>` : ''}` },
        { label: 'Subject', render: (t) => `<b>${esc(t.subject)}</b><br><small class="muted">${esc(String(t.snippet).slice(0, 100))}</small>` },
        { label: 'Date', render: (t) => `<small>${dt(t.date)}</small>` },
      ],
      actions: () => act('read', 'Read'),
      onAction: (a, t) => openThread(t, r.mailbox),
      empty: 'Nothing in this folder',
    });
  };
  $('#vb').onchange = (e) => { S.viewBox = e.target.value; load(); };
  $('#vq').oninput = (e) => { S.vq = e.target.value; clearTimeout(S.vqt); S.vqt = setTimeout(load, 250); };
  $('#vt').querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { S.viewFolder = b.dataset.f; PAGES.viewer(page); }));
  $('#vsend').onclick = () => { const m = S.boxes.find((x) => x.id === S.viewBox); S.draft = { fromEmail: m.email, fromName: m.name }; location.hash = 'compose'; };
  await load();
};
async function openThread(t, box) {
  const r = await api('GET', `/admin/mailboxes/${S.viewBox}/threads/${t.tid}`);
  const last = r.messages[r.messages.length - 1];
  const body = r.messages.map((m) => `<div style="border:1px solid #e3e3e3;border-radius:12px;padding:12px;margin-bottom:10px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b>${esc(m.from.name)}</b><small class="muted">&lt;${esc(m.from.email)}&gt;</small><span style="flex:1"></span><small class="muted">${dt(m.date)} · ${esc(m.folder)}</small></div>
      <small class="muted">to ${esc(m.to.map((x) => x.email).join(', '))}${m.cc && m.cc.length ? ` · cc ${esc(m.cc.map((x) => x.email).join(', '))}` : ''}</small>
      <pre style="white-space:pre-wrap;font-family:inherit;margin:10px 0 0">${esc(m.body)}</pre>
      ${(m.attachments || []).map((a) => `<a class="btn sm" target="_blank" href="/api/files/${a.id}?token=${encodeURIComponent(S.token)}">📎 ${esc(a.name)}</a>`).join(' ')}
    </div>`).join('');
  modal({
    title: t.subject, wide: true, body, submitText: `Reply as ${box.email}`,
    onSubmit: () => {
      const other = last.from.email === box.email ? last.to.map((x) => x.email).join(', ') : last.from.email;
      S.draft = { fromEmail: box.email, fromName: box.name, to: other, subject: /^re:/i.test(t.subject) ? t.subject : `Re: ${t.subject}`, threadId: t.tid, inReplyTo: last.id };
      location.hash = 'compose';
    },
  });
}

// ----- all messages -----
PAGES.messages = async (page) => {
  page.innerHTML = `<div class="toolbar"><input id="mq" placeholder="Search subject, text, sender or recipient" value="${esc(S.mq || '')}"/><span class="spacer"></span><span class="muted" id="mt"></span></div><div id="ml"></div>`;
  const load = async () => {
    const r = await api('GET', `/admin/messages?q=${encodeURIComponent(S.mq || '')}`);
    $('#mt').textContent = `${r.total} messages in total`;
    table($('#ml'), {
      rows: r.messages, columns: [...msgColumns(), { label: 'Copies', key: 'copies' }],
      actions: () => act('view', 'View') + act('delete', 'Delete', 'danger'),
      onAction: async (a, m) => {
        if (a === 'view') {
          const { message, copies } = await api('GET', `/admin/messages/${m.id}`);
          modal({ title: message.subject || '(no subject)', wide: true, body: `<p><b>${esc(message.from.name)}</b> &lt;${esc(message.from.email)}&gt; → ${esc(message.to.map((x) => x.email).join(', '))}<br><small class="muted">${dt(message.date)} · in ${copies.map((c) => `${esc(c.box)} (${esc(c.folder)})`).join(', ') || 'no mailbox'}</small></p><pre style="white-space:pre-wrap;font-family:inherit">${esc(message.body)}</pre>` });
        }
        if (a === 'delete' && await confirmBox('Delete this message from every mailbox?')) { await run(() => api('DELETE', `/admin/messages/${m.id}`), 'Deleted'); load(); }
      },
      empty: 'No messages',
    });
  };
  $('#mq').oninput = (e) => { S.mq = e.target.value; clearTimeout(S.mqt); S.mqt = setTimeout(load, 250); };
  await load();
};

// ----- settings -----
const FEATURES = [['meet', 'Meet tab', 'Bottom bar Meet tab'], ['summarize', 'Summarize this email', 'Sparkle button and summary card'], ['attachments', 'Attachments', 'Photos in emails'], ['smartReply', 'Suggested replies', 'Quick reply chips under messages'], ['snooze', 'Snooze', 'Snooze conversations'], ['signup', 'Create account', 'Sign-up screen in the app']];
PAGES.settings = async (page) => {
  const { settings: s } = await api('GET', '/admin/settings');
  const fields = [
    { name: 'appName', label: 'App name', value: s.appName }, { name: 'domain', label: 'Mail domain for new accounts', value: s.domain },
    { name: 'searchHint', label: 'Search bar text', value: s.searchHint }, { name: 'appVersion', label: 'Version shown in the app', value: s.appVersion },
    { name: 'maxAttachmentMB', label: 'Max attachment size (MB)', type: 'number', value: s.maxAttachmentMB },
    { name: 'announcement', label: 'Announcement banner (empty = hidden)', type: 'textarea', value: s.announcement, span2: true },
    { name: 'maintenanceMessage', label: 'Maintenance message', type: 'textarea', value: s.maintenanceMessage, span2: true },
    { name: 'appIcon', label: 'App logo (optional)', type: 'image', value: s.appIcon || '', span2: true },
  ];
  page.innerHTML = `<div class="grid two">
    <div class="card"><h3>Branding & text</h3><form id="sf" class="form-grid">${fields.map(fieldHtml).join('')}<div class="span2" style="text-align:right"><button class="btn primary">Save</button></div></form></div>
    <div class="card"><h3>Switches</h3>
      <div class="switch-row"><div>Maintenance mode<small>Everyone sees the maintenance screen</small></div>${switchHtml('s-maint', s.maintenanceMode)}</div>
      <div class="switch-row"><div>Allow sign up<small>New @${esc(s.domain)} accounts from the app</small></div>${switchHtml('s-signup', s.allowSignup)}</div>
      ${FEATURES.map(([k, l, sub]) => `<div class="switch-row"><div>${l}<small>${sub}</small></div>${switchHtml('f-' + k, s.features[k] !== false)}</div>`).join('')}
      <h3 style="margin-top:20px">Demo data</h3><p class="muted">Puts back the original mail IDs and messages. Everyone is signed out.</p><button class="btn danger" id="reset">Reset demo data</button>
    </div></div>`;
  wireImageFields(page);
  $('#sf').onsubmit = async (e) => { e.preventDefault(); await run(() => api('PUT', '/admin/settings', readForm(e.target, fields)), 'Saved — app updated'); };
  $('#s-maint').onchange = (e) => run(() => api('PUT', '/admin/settings', { maintenanceMode: e.target.checked }), 'Saved');
  $('#s-signup').onchange = (e) => run(() => api('PUT', '/admin/settings', { allowSignup: e.target.checked }), 'Saved');
  FEATURES.forEach(([k]) => ($('#f-' + k).onchange = (e) => run(() => api('PUT', '/admin/settings', { features: { [k]: e.target.checked } }), 'Saved')));
  $('#reset').onclick = async () => { if (await confirmBox('Reset all mail, mail IDs and settings to the demo data?', 'Reset')) { await run(() => api('POST', '/admin/reset'), 'Demo data restored'); render(); } };
};

// ----- audit & admins -----
PAGES.audit = async (page) => {
  const { logs } = await api('GET', '/admin/audit');
  page.innerHTML = '<div id="al"></div>';
  table($('#al'), { rows: logs, columns: [{ label: 'When', render: (l) => `<small>${dt(l.at)}</small>` }, { label: 'Admin', key: 'admin' }, { label: 'Action', render: (l) => pill(l.action, '') }, { label: 'Details', key: 'details' }], empty: 'No activity yet' });
};
PAGES.admins = async (page) => {
  const { admins } = await api('GET', '/admin/admins');
  page.innerHTML = '<div class="toolbar"><span class="spacer"></span><button class="btn" id="pw">Change my password</button><button class="btn primary" id="addA">+ Add admin</button></div><div id="adl"></div>';
  table($('#adl'), {
    rows: admins, columns: [{ label: 'Name', key: 'name' }, { label: 'Username', key: 'username' }, { label: 'Role', render: (a) => pill(a.role, '') }, { label: 'Added', render: (a) => `<small>${dt(a.createdAt)}</small>` }],
    actions: (a) => (a.role === 'super' ? '' : act('del', 'Remove', 'danger')),
    onAction: async (x, a) => { if (await confirmBox(`Remove admin ${a.username}?`)) { await run(() => api('DELETE', `/admin/admins/${a.id}`), 'Removed'); PAGES.admins(page); } },
  });
  $('#addA').onclick = () => modal({ title: 'Add admin', fields: [{ name: 'name', label: 'Name' }, { name: 'username', label: 'Username' }, { name: 'password', label: 'Password', type: 'password' }], onSubmit: async (v) => { await run(() => api('POST', '/admin/admins', v), 'Admin added'); PAGES.admins(page); } });
  $('#pw').onclick = () => modal({ title: 'Change password', fields: [{ name: 'oldPassword', label: 'Current password', type: 'password' }, { name: 'newPassword', label: 'New password', type: 'password' }], onSubmit: (v) => run(() => api('POST', '/admin/password', v), 'Password changed') });
};

async function boot() {
  if (!S.token) return logout();
  try { const { admin } = await api('GET', '/admin/me'); S.admin = admin; } catch { return; }
  $('#login').classList.add('hidden');
  $('#shell').classList.remove('hidden');
  $('#who').textContent = S.admin.name;
  S.route = location.hash.slice(1).split('&')[0] || 'dashboard';
  render();
}
$('#loginForm').onsubmit = login;
$('#logoutBtn').onclick = logout;
boot();
