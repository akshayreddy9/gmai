// Gmai server: mailboxes, threads, sending/receiving between addresses, drafts, labels,
// attachments, live updates (Socket.io) and the admin API used by /admin and the Admin Hub.
const path = require('path');
const http = require('http');
const os = require('os');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const store = require('./db');
const { colorFor } = require('./seed');

const PORT = process.env.PORT || 4003;
const D = () => store.get();
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.use(cors());
app.use(express.json({ limit: '12mb' }));
app.use('/admin', express.static(path.join(__dirname, '..', 'public', 'admin')));
app.get('/', (req, res) => res.redirect('/admin'));

class AppError extends Error { constructor(status, message, code) { super(message); this.status = status; this.code = code; } }
const fail = (status, message, code) => { throw new AppError(status, message, code); };
const wrap = (fn) => async (req, res) => {
  try {
    const out = await fn(req, res);
    store.save();
    if (!res.headersSent) res.json(out === undefined ? { ok: true } : out);
  } catch (e) {
    if (!(e instanceof AppError)) console.error(e);
    if (!res.headersSent) res.status(e.status || 500).json({ error: e.message || 'Server error', code: e.code });
  }
};
const bearer = (req) => (req.headers.authorization || '').replace('Bearer ', '') || req.query.token || '';
const norm = (e) => String(e || '').trim().toLowerCase();
const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const findBox = (email) => D().mailboxes.find((m) => m.email === norm(email));

function authUser(req) {
  const sess = D().sessions[bearer(req)];
  const box = sess && D().mailboxes.find((m) => m.id === sess.boxId);
  if (!box) fail(401, 'Please sign in again', 'UNAUTHORIZED');
  if (box.blocked) fail(403, 'This account has been suspended by the administrator', 'BLOCKED');
  if (D().settings.maintenanceMode) fail(503, D().settings.maintenanceMessage, 'MAINTENANCE');
  box.lastActive = Date.now();
  return box;
}
const route = (fn) => wrap((req, res) => fn(req, authUser(req), res));

function authAdmin(req) {
  const sess = D().adminSessions[bearer(req)];
  const a = sess && D().admins.find((x) => x.id === sess.adminId);
  if (!a) fail(401, 'Admin sign-in required', 'UNAUTHORIZED');
  return a;
}
const adminRoute = (fn) => wrap((req, res) => fn(req, authAdmin(req), res));
const audit = (admin, action, details) => {
  D().auditLogs.unshift({ id: store.id('log'), at: Date.now(), admin: admin.name, action, details });
  D().auditLogs.length = Math.min(D().auditLogs.length, 1000);
};

const publicBox = (m) => ({ id: m.id, name: m.name, email: m.email, color: m.color, photo: m.photo, kind: m.kind, signature: m.signature || '' });
const clientSettings = () => {
  const s = D().settings;
  return { appName: s.appName, domain: s.domain, maintenanceMode: s.maintenanceMode, maintenanceMessage: s.maintenanceMessage, announcement: s.announcement,
    allowSignup: s.allowSignup, maxAttachmentMB: s.maxAttachmentMB, appVersion: s.appVersion, searchHint: s.searchHint, features: s.features, appIcon: s.appIcon || '' };
};
const pushSettings = () => io.emit('settings', clientSettings());

// ---------- mail helpers ----------
const msgById = (mid) => D().messages.find((m) => m.id === mid);
const itemsOf = (box) => D().items.filter((i) => i.box === box.email);
const snippet = (body) => String(body || '').replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/^##-.*-##$/gm, '').replace(/\s+/g, ' ').trim().slice(0, 140);

// Parses "Name <a@b.c>, x@y.z" or [{email,name}] into [{name,email}].
function parseAddrs(v) {
  const list = Array.isArray(v) ? v : String(v || '').split(/[,;]/);
  return list.map((x) => {
    if (x && typeof x === 'object') return { name: String(x.name || '').trim(), email: norm(x.email) };
    const s = String(x).trim();
    const m = s.match(/^(.*)<([^>]+)>$/);
    return m ? { name: m[1].trim().replace(/^"|"$/g, ''), email: norm(m[2]) } : { name: '', email: norm(s) };
  }).filter((a) => a.email);
}
const named = (a) => { const b = findBox(a.email); return { name: a.name || (b ? b.name : a.email.split('@')[0]), email: a.email }; };

const VIEWS = {
  primary: (i) => i.folder === 'inbox' && !i.archived && i.category === 'primary' && !snoozed(i),
  promotions: (i) => i.folder === 'inbox' && !i.archived && i.category === 'promotions' && !snoozed(i),
  social: (i) => i.folder === 'inbox' && !i.archived && i.category === 'social' && !snoozed(i),
  updates: (i) => i.folder === 'inbox' && !i.archived && i.category === 'updates' && !snoozed(i),
  inbox: (i) => i.folder === 'inbox' && !i.archived && !snoozed(i),
  starred: (i) => i.starred && !['trash', 'spam'].includes(i.folder),
  snoozed: (i) => snoozed(i),
  important: (i) => i.important && !['trash', 'spam'].includes(i.folder),
  sent: (i) => i.folder === 'sent',
  scheduled: (i) => i.folder === 'scheduled',
  outbox: (i) => i.folder === 'outbox',
  drafts: (i) => i.folder === 'drafts',
  all: (i) => !['trash', 'spam', 'drafts', 'scheduled'].includes(i.folder),
  spam: (i) => i.folder === 'spam',
  trash: (i) => i.folder === 'trash',
  purchases: (i) => i.folder === 'inbox' && /order|receipt|invoice|purchase|shipped|payment/i.test(msgById(i.mid)?.subject || ''),
};
const snoozed = (i) => i.snoozeUntil && i.snoozeUntil > Date.now();

// Groups a mailbox's items into threads for one view.
function listThreads(box, q = {}) {
  const view = q.view || 'primary';
  let test = VIEWS[view];
  if (view.startsWith('label:')) { const lid = view.slice(6); test = (i) => (i.labels || []).includes(lid) && !['trash', 'spam'].includes(i.folder); }
  if (!test) fail(400, 'Unknown folder');
  const needle = norm(q.q);
  const all = itemsOf(box);
  const hits = all.filter(test);
  const byThread = new Map();
  for (const i of hits) {
    const m = msgById(i.mid);
    if (!m) continue;
    if (needle) {
      const hay = `${m.subject} ${m.body} ${m.from.name} ${m.from.email} ${m.to.map((t) => `${t.name} ${t.email}`).join(' ')} ${(m.attachments || []).map((a) => a.name).join(' ')}`.toLowerCase();
      if (!hay.includes(needle)) continue;
    }
    if (q.from && !`${m.from.name} ${m.from.email}`.toLowerCase().includes(norm(q.from))) continue;
    if (q.to && !m.to.some((t) => `${t.name} ${t.email}`.toLowerCase().includes(norm(q.to)))) continue;
    if (q.attachment === '1' && !(m.attachments || []).length) continue;
    if (q.unread === '1' && i.read) continue;
    if (q.after && m.date < Number(q.after)) continue;
    const t = byThread.get(i.tid) || { tid: i.tid, items: [] };
    t.items.push({ i, m });
    byThread.set(i.tid, t);
  }
  const labels = D().labels.filter((l) => l.box === box.email);
  const out = [...byThread.values()].map(({ tid, items }) => {
    items.sort((a, b) => a.m.date - b.m.date);
    // Count all messages of this thread in the mailbox (not trashed) for "Customer 6" style counts.
    const threadItems = all.filter((x) => x.tid === tid && (view === 'trash' || x.folder !== 'trash') && x.folder !== 'drafts');
    const last = items[items.length - 1];
    const lastAll = threadItems.map((x) => msgById(x.mid)).filter(Boolean).sort((a, b) => b.date - a.date)[0] || last.m;
    const people = [];
    threadItems.map((x) => msgById(x.mid)).filter(Boolean).sort((a, b) => a.date - b.date).forEach((m) => {
      const n = m.from.email === box.email ? 'me' : (m.from.name || m.from.email);
      if (!people.includes(n)) people.push(n);
    });
    const sentView = view === 'sent' || view === 'drafts' || view === 'scheduled' || view === 'outbox';
    const lbl = new Set();
    items.forEach(({ i }) => (i.labels || []).forEach((l) => lbl.add(l)));
    return {
      tid, subject: last.m.subject || '(no subject)', snippet: snippet(lastAll.body), date: lastAll.date,
      from: lastAll.from, to: last.m.to, people, count: threadItems.length,
      unread: items.some(({ i }) => !i.read), starred: items.some(({ i }) => i.starred), important: items.some(({ i }) => i.important),
      folders: [...new Set(threadItems.map((x) => x.folder))], category: last.i.category,
      attachments: items.flatMap(({ m }) => (m.attachments || []).map((a) => ({ id: a.id, name: a.name, type: a.type }))).slice(0, 3),
      labels: labels.filter((l) => lbl.has(l.id)).map((l) => ({ id: l.id, name: l.name, color: l.color })),
      sentView, draftId: view === 'drafts' ? last.m.id : undefined, scheduledAt: last.i.scheduledAt,
      avatar: avatarFor(sentView ? (last.m.to[0] || last.m.from) : lastAll.from.email === box.email ? (lastAll.to[0] || lastAll.from) : lastAll.from),
    };
  }).sort((a, b) => b.date - a.date);
  const limit = Math.min(Number(q.limit) || 60, 200);
  const before = Number(q.before) || Infinity;
  return out.filter((t) => t.date < before).slice(0, limit);
}
function avatarFor(a) {
  const b = a && findBox(a.email);
  return { name: (b && b.name) || a?.name || a?.email || '?', color: (b && b.color) || colorFor(a?.email || '?'), photo: (b && b.photo) || null };
}

function counts(box) {
  const items = itemsOf(box);
  const unreadThreads = (fn) => new Set(items.filter((i) => fn(i) && !i.read).map((i) => i.tid)).size;
  const threads = (fn) => new Set(items.filter(fn).map((i) => i.tid)).size;
  const summary = (cat) => {
    const list = items.filter(VIEWS[cat]).map((i) => ({ i, m: msgById(i.mid) })).filter((x) => x.m).sort((a, b) => b.m.date - a.m.date);
    const unread = list.filter((x) => !x.i.read);
    const top = (unread[0] || list[0]);
    const senders = [...new Set((unread.length ? unread : list).slice(0, 3).map((x) => x.m.from.name))];
    return { new: new Set(unread.map((x) => x.i.tid)).size, senders, subject: top ? top.m.subject : '', date: top ? top.m.date : 0 };
  };
  return {
    primary: unreadThreads(VIEWS.primary), inbox: unreadThreads(VIEWS.inbox), starred: threads(VIEWS.starred), snoozed: threads(VIEWS.snoozed),
    important: unreadThreads(VIEWS.important), purchases: unreadThreads(VIEWS.purchases), sent: 0, scheduled: threads(VIEWS.scheduled), outbox: threads(VIEWS.outbox),
    drafts: threads(VIEWS.drafts), all: unreadThreads(VIEWS.all), spam: unreadThreads(VIEWS.spam), trash: 0,
    promotions: summary('promotions'), social: summary('social'), updates: summary('updates'),
    labels: Object.fromEntries(D().labels.filter((l) => l.box === box.email).map((l) => [l.id, unreadThreads((i) => (i.labels || []).includes(l.id))])),
  };
}

// Delivers a message: sender gets "sent", local recipients get it in their inbox,
// unknown addresses bounce back with a delivery failure notice.
function deliver({ fromBox, from, to, cc = [], bcc = [], subject, body, threadId, inReplyTo, attachments = [], category, scheduledAt, keepSent = true }) {
  const now = Date.now();
  const msg = {
    id: store.id('msg'), threadId: threadId || store.id('thr'), from, to: to.map(named), cc: cc.map(named), bcc: bcc.map(named),
    subject: String(subject || '').slice(0, 300), body: String(body || '').slice(0, 100000), date: scheduledAt && scheduledAt > now ? scheduledAt : now,
    attachments, inReplyTo: inReplyTo || null,
  };
  D().messages.push(msg);
  if (fromBox && keepSent) {
    D().items.push({ id: store.id('itm'), box: fromBox.email, mid: msg.id, tid: msg.threadId, folder: scheduledAt && scheduledAt > now ? 'scheduled' : 'sent', category: 'primary', read: true, starred: false, important: false, labels: [], scheduledAt: scheduledAt || undefined });
  }
  if (scheduledAt && scheduledAt > now) return { msg, delivered: [], bounced: [] };
  return { msg, ...fanOut(msg, fromBox, category) };
}
function fanOut(msg, fromBox, category) {
  const delivered = [];
  const bounced = [];
  const seen = new Set();
  [...msg.to, ...msg.cc, ...msg.bcc].forEach((r) => {
    if (seen.has(r.email)) return;
    seen.add(r.email);
    const rb = findBox(r.email);
    if (!rb || rb.blocked) { bounced.push(r.email); return; }
    if (rb.kind !== 'user' && !rb.passHash) { delivered.push(r.email); return; } // company senders accept mail silently
    if (fromBox && rb.email === fromBox.email) return; // already has the sent copy
    D().items.push({
      id: store.id('itm'), box: rb.email, mid: msg.id, tid: msg.threadId, folder: 'inbox',
      category: category || (fromBox ? fromBox.category || 'primary' : 'primary'), read: false, starred: false, important: false, labels: [],
    });
    delivered.push(rb.email);
    io.to('box:' + rb.email).emit('mail', { tid: msg.threadId, from: msg.from, subject: msg.subject });
  });
  if (bounced.length && fromBox) {
    const n = {
      id: store.id('msg'), threadId: msg.threadId, from: { name: 'Mail Delivery Subsystem', email: 'mailer-daemon@' + D().settings.domain },
      to: [{ name: fromBox.name, email: fromBox.email }], cc: [], bcc: [], subject: 'Delivery Status Notification (Failure)',
      body: `# Address not found\n\nYour message wasn't delivered to **${bounced.join(', ')}** because the address couldn't be found, or is unable to receive mail.\n\nOnly addresses that exist in ${D().settings.appName} can receive mail in this demo.`,
      date: Date.now() + 1, attachments: [], inReplyTo: msg.id,
    };
    D().messages.push(n);
    D().items.push({ id: store.id('itm'), box: fromBox.email, mid: n.id, tid: n.threadId, folder: 'inbox', category: 'primary', read: false, starred: false, important: false, labels: [] });
    io.to('box:' + fromBox.email).emit('mail', { tid: n.threadId, from: n.from, subject: n.subject });
  }
  return { delivered, bounced };
}

// Scheduled mail: moves to sent and delivers when its time comes.
setInterval(() => {
  if (!D()) return;
  const now = Date.now();
  let changed = false;
  D().items.filter((i) => i.folder === 'scheduled' && i.scheduledAt && i.scheduledAt <= now).forEach((i) => {
    const m = msgById(i.mid);
    i.folder = 'sent';
    changed = true;
    if (m) { m.date = now; fanOut(m, findBox(i.box)); io.to('box:' + i.box).emit('mail', { tid: m.threadId }); }
  });
  if (changed) store.save();
}, 15000);

// ---------- auth ----------
app.get('/api/health', (req, res) => res.json({ ok: true, ...store.status() }));
app.get('/api/config', (req, res) => res.json({ settings: clientSettings() }));

app.post('/api/auth/login', wrap((req) => {
  const email = norm(req.body.email).includes('@') ? norm(req.body.email) : `${norm(req.body.email)}@${D().settings.domain}`;
  const box = findBox(email);
  if (!box || !box.passHash || !store.verifySecret(req.body.password || '', box.passHash)) fail(400, 'Wrong email or password. Try again or ask the admin to reset it.');
  if (box.blocked) fail(403, 'This account has been suspended by the administrator', 'BLOCKED');
  const token = store.token();
  D().sessions[token] = { boxId: box.id, at: Date.now() };
  box.lastActive = Date.now();
  return { token, account: publicBox(box), settings: clientSettings() };
}));

app.post('/api/auth/register', wrap((req) => {
  const s = D().settings;
  if (!s.allowSignup || s.features.signup === false) fail(403, 'New accounts are created by the administrator');
  const name = String(req.body.name || '').trim();
  const user = norm(req.body.username).replace(/@.*$/, '');
  if (name.length < 2) fail(400, 'Enter your name');
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(user)) fail(400, 'Username must be 3-30 letters, numbers, dots or dashes');
  if (String(req.body.password || '').length < 6) fail(400, 'Use 6 or more characters for your password');
  const email = `${user}@${s.domain}`;
  if (findBox(email)) fail(400, 'That username is taken. Try another.');
  const box = { id: store.id('box'), name, email, passHash: store.hashSecret(req.body.password), kind: 'user', color: colorFor(email), photo: null, signature: '', category: 'primary', blocked: false, createdAt: Date.now(), lastActive: Date.now() };
  D().mailboxes.push(box);
  // Welcome mail.
  deliver({ fromBox: null, from: { name: `${s.appName} Team`, email: `team@${s.domain}` }, to: [{ name, email }], subject: `Welcome to ${s.appName}, ${name.split(' ')[0]}`,
    body: `# Welcome to ${s.appName}\n\nHi ${name.split(' ')[0]},\n\nYour new address is **${email}**. You can send and receive mail with anyone on ${s.appName}.\n\nTip: add more accounts from your profile picture at the top right.\n\nThe ${s.appName} Team` });
  const token = store.token();
  D().sessions[token] = { boxId: box.id, at: Date.now() };
  return { token, account: publicBox(box), settings: clientSettings() };
}));

app.post('/api/auth/logout', wrap((req) => { delete D().sessions[bearer(req)]; }));
app.get('/api/me', route((req, box) => ({ account: publicBox(box), settings: clientSettings(), counts: counts(box) })));
app.put('/api/me', route((req, box) => {
  if (req.body.name !== undefined) box.name = String(req.body.name).trim().slice(0, 60) || box.name;
  if (req.body.signature !== undefined) box.signature = String(req.body.signature).slice(0, 500);
  if (req.body.photo !== undefined) box.photo = req.body.photo ? String(req.body.photo).slice(0, 400000) : null;
  return { account: publicBox(box) };
}));
app.post('/api/me/password', route((req, box) => {
  if (!store.verifySecret(req.body.oldPassword || '', box.passHash)) fail(400, 'Current password is wrong');
  if (String(req.body.newPassword || '').length < 6) fail(400, 'Use 6 or more characters');
  box.passHash = store.hashSecret(req.body.newPassword);
}));

// ---------- mail ----------
app.get('/api/counts', route((req, box) => ({ counts: counts(box) })));
app.get('/api/threads', route((req, box) => ({ threads: listThreads(box, req.query), counts: counts(box) })));

app.get('/api/threads/:tid', route((req, box) => {
  const items = itemsOf(box).filter((i) => i.tid === req.params.tid && i.folder !== 'drafts');
  if (!items.length) fail(404, 'This conversation was deleted');
  const trashed = items.every((i) => i.folder === 'trash');
  const list = items.filter((i) => trashed || i.folder !== 'trash')
    .map((i) => ({ i, m: msgById(i.mid) })).filter((x) => x.m).sort((a, b) => a.m.date - b.m.date);
  const labels = D().labels.filter((l) => l.box === box.email);
  const lbl = new Set(list.flatMap((x) => x.i.labels || []));
  return {
    thread: {
      tid: req.params.tid, subject: list[list.length - 1]?.m.subject || '(no subject)',
      folders: [...new Set(list.map((x) => x.i.folder))], category: list[0]?.i.category,
      starred: list.some((x) => x.i.starred), important: list.some((x) => x.i.important), unread: list.some((x) => !x.i.read),
      labels: labels.filter((l) => lbl.has(l.id)),
      messages: list.map(({ i, m }) => ({
        ...m, bcc: m.from.email === box.email ? m.bcc : [], mine: m.from.email === box.email, read: i.read, starred: i.starred, folder: i.folder,
        avatar: avatarFor(m.from), toLine: m.to.map((t) => (t.email === box.email ? 'me' : (t.name || t.email).split(' ')[0])).join(', '),
      })),
    },
  };
}));

// Thread actions: read/unread, star, important, archive, move to inbox/trash/spam, snooze, labels, category.
app.patch('/api/threads/:tid', route((req, box) => {
  const items = itemsOf(box).filter((i) => i.tid === req.params.tid && i.folder !== 'drafts');
  if (!items.length) fail(404, 'Conversation not found');
  const b = req.body;
  items.forEach((i) => {
    if (b.read !== undefined) i.read = !!b.read;
    if (b.important !== undefined) i.important = !!b.important;
    if (b.category && ['primary', 'promotions', 'social', 'updates'].includes(b.category) && i.folder === 'inbox') i.category = b.category;
    if (b.snoozeUntil !== undefined) i.snoozeUntil = Number(b.snoozeUntil) || 0;
    if (b.addLabel && !(i.labels || []).includes(b.addLabel)) i.labels = [...(i.labels || []), b.addLabel];
    if (b.removeLabel) i.labels = (i.labels || []).filter((l) => l !== b.removeLabel);
    if (b.move === 'archive') { if (i.folder === 'inbox') i.archived = true; }
    if (b.move === 'inbox') { if (['trash', 'spam'].includes(i.folder)) i.folder = i.prevFolder || 'inbox'; i.archived = false; }
    if (b.move === 'trash' || b.move === 'spam') { if (i.folder !== b.move) { i.prevFolder = i.folder; i.folder = b.move; } }
  });
  // Starring marks the newest message only, like Gmail.
  if (b.starred !== undefined) {
    const sorted = items.map((i) => ({ i, m: msgById(i.mid) })).filter((x) => x.m).sort((a, c) => c.m.date - a.m.date);
    if (b.starred) { if (sorted[0]) sorted[0].i.starred = true; } else items.forEach((i) => { i.starred = false; });
  }
  return { counts: counts(box) };
}));
app.patch('/api/messages/:mid', route((req, box) => {
  const i = itemsOf(box).find((x) => x.mid === req.params.mid);
  if (!i) fail(404, 'Message not found');
  if (req.body.read !== undefined) i.read = !!req.body.read;
  if (req.body.starred !== undefined) i.starred = !!req.body.starred;
  return { ok: true };
}));
app.delete('/api/threads/:tid', route((req, box) => {
  D().items = D().items.filter((i) => !(i.box === box.email && i.tid === req.params.tid));
  return { counts: counts(box) };
}));
app.post('/api/trash/empty', route((req, box) => {
  D().items = D().items.filter((i) => !(i.box === box.email && i.folder === (req.body.folder === 'spam' ? 'spam' : 'trash')));
  return { counts: counts(box) };
}));

// Attachments can be new uploads or files from a message this mailbox can already see (forwarding).
function checkAttachments(ids, box) {
  return (ids || []).slice(0, 10).map((x) => {
    const fid = x.id || x;
    const f = D().files.find((y) => y.id === fid);
    if (f) return { id: f.id, name: f.name, type: f.type, size: f.size };
    const mids = box ? new Set(itemsOf(box).map((i) => i.mid)) : null;
    const msg = D().messages.find((m) => (!mids || mids.has(m.id)) && (m.attachments || []).some((a) => a.id === fid));
    if (!msg) fail(400, 'An attachment is missing. Please attach it again.');
    return msg.attachments.find((a) => a.id === fid);
  });
}

app.post('/api/send', route((req, box) => {
  const b = req.body;
  const to = parseAddrs(b.to);
  const cc = parseAddrs(b.cc);
  const bcc = parseAddrs(b.bcc);
  if (!to.length && !cc.length && !bcc.length) fail(400, 'Add at least one recipient');
  const bad = [...to, ...cc, ...bcc].find((a) => !EMAIL_RE.test(a.email));
  if (bad) fail(400, `The address "${bad.email}" in the "To" field was not recognised. Please make sure that all addresses are properly formed.`);
  if (to.length + cc.length + bcc.length > 50) fail(400, 'Too many recipients (max 50)');
  if (b.threadId && !itemsOf(box).some((i) => i.tid === b.threadId)) fail(400, 'Conversation not found');
  const attachments = D().settings.features.attachments === false ? [] : checkAttachments(b.attachments, box);
  if (b.draftId) {
    D().items = D().items.filter((i) => !(i.box === box.email && i.mid === b.draftId));
    D().messages = D().messages.filter((m) => m.id !== b.draftId);
  }
  const body = String(b.body || '');
  const r = deliver({ fromBox: box, from: { name: box.name, email: box.email }, to, cc, bcc, subject: b.subject, body, threadId: b.threadId, inReplyTo: b.inReplyTo, attachments, scheduledAt: Number(b.scheduledAt) || 0 });
  return { messageId: r.msg.id, threadId: r.msg.threadId, delivered: r.delivered, bounced: r.bounced, scheduled: !!(b.scheduledAt && b.scheduledAt > Date.now()), counts: counts(box) };
}));

app.post('/api/drafts', route((req, box) => {
  const b = req.body;
  let m = b.id && D().messages.find((x) => x.id === b.id && x.from.email === box.email);
  const fields = { to: parseAddrs(b.to).map(named), cc: parseAddrs(b.cc).map(named), bcc: parseAddrs(b.bcc).map(named), subject: String(b.subject || '').slice(0, 300), body: String(b.body || ''), date: Date.now(), attachments: checkAttachments(b.attachments, box) };
  if (m) Object.assign(m, fields);
  else {
    m = { id: store.id('msg'), threadId: b.threadId || store.id('thr'), from: { name: box.name, email: box.email }, inReplyTo: b.inReplyTo || null, ...fields };
    D().messages.push(m);
    D().items.push({ id: store.id('itm'), box: box.email, mid: m.id, tid: m.threadId, folder: 'drafts', category: 'primary', read: true, starred: false, important: false, labels: [] });
  }
  return { draft: m };
}));
app.get('/api/drafts/:id', route((req, box) => {
  const m = D().messages.find((x) => x.id === req.params.id && x.from.email === box.email);
  if (!m) fail(404, 'Draft not found');
  return { draft: m };
}));
app.delete('/api/drafts/:id', route((req, box) => {
  D().items = D().items.filter((i) => !(i.box === box.email && i.mid === req.params.id && i.folder === 'drafts'));
  D().messages = D().messages.filter((m) => !(m.id === req.params.id && !D().items.some((i) => i.mid === m.id)));
}));

// Address suggestions: every mailbox plus people this account has mailed with.
app.get('/api/contacts', route((req, box) => {
  const q = norm(req.query.q);
  const seen = new Map();
  itemsOf(box).forEach((i) => { const m = msgById(i.mid); if (!m) return; [m.from, ...m.to, ...m.cc].forEach((a) => { if (a.email !== box.email) seen.set(a.email, a.name || a.email); }); });
  D().mailboxes.filter((m) => m.kind === 'user' && !m.blocked && m.email !== box.email).forEach((m) => seen.set(m.email, m.name));
  const list = [...seen.entries()].map(([email, name]) => ({ email, name, ...avatarFor({ email, name }) }))
    .filter((c) => !q || c.email.includes(q) || c.name.toLowerCase().includes(q)).slice(0, 12);
  return { contacts: list };
}));

app.get('/api/labels', route((req, box) => ({ labels: D().labels.filter((l) => l.box === box.email) })));
app.post('/api/labels', route((req, box) => {
  const name = String(req.body.name || '').trim().slice(0, 40);
  if (!name) fail(400, 'Enter a label name');
  if (D().labels.some((l) => l.box === box.email && l.name.toLowerCase() === name.toLowerCase())) fail(400, 'That label already exists');
  const l = { id: store.id('lbl'), box: box.email, name, color: colorFor(name) };
  D().labels.push(l);
  return { label: l };
}));
app.delete('/api/labels/:id', route((req, box) => {
  D().labels = D().labels.filter((l) => !(l.id === req.params.id && l.box === box.email));
  itemsOf(box).forEach((i) => { i.labels = (i.labels || []).filter((x) => x !== req.params.id); });
}));

// Attachments: upload as base64, download with the session token.
app.post('/api/files', route(async (req, box) => {
  const s = D().settings;
  if (s.features.attachments === false) fail(403, 'Attachments are turned off');
  const data = String(req.body.data || '').replace(/^data:[^;]+;base64,/, '');
  const size = Math.floor(data.length * 0.75);
  if (!data) fail(400, 'Empty file');
  if (size > (s.maxAttachmentMB || 2) * 1024 * 1024) fail(400, `Attachments can be up to ${s.maxAttachmentMB || 2} MB in this demo`);
  const f = { id: store.id('fil'), name: String(req.body.name || 'file').slice(0, 120), type: String(req.body.type || 'application/octet-stream'), size, owner: box.email, at: Date.now() };
  await store.putFile(f.id, { name: f.name, type: f.type }, data);
  D().files.push(f);
  return { file: f };
}));
async function sendFile(req, res, f) {
  const buf = await store.getFile(f.id);
  res.setHeader('Content-Type', f.type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `${/^image\//.test(f.type) && !req.query.download ? 'inline' : 'attachment'}; filename="${String(f.name).replace(/"/g, '')}"`);
  if (buf) return res.end(buf);
  res.setHeader('Content-Type', 'text/plain');
  res.end(`${f.name}\n\nThis is a sample attachment from the ${D().settings.appName} demo data.`);
}
app.get('/api/files/:id', wrap(async (req, res) => {
  const viewer = D().sessions[bearer(req)] && D().mailboxes.find((m) => m.id === D().sessions[bearer(req)].boxId);
  const isAdmin = !!D().adminSessions[bearer(req)];
  if (!viewer && !isAdmin) fail(401, 'Sign in to download');
  const msg = D().messages.find((m) => (m.attachments || []).some((a) => a.id === req.params.id));
  const meta = msg ? msg.attachments.find((a) => a.id === req.params.id) : D().files.find((x) => x.id === req.params.id);
  if (!meta) fail(404, 'File not found');
  if (!isAdmin) {
    const ok = (msg && itemsOf(viewer).some((i) => i.mid === msg.id)) || D().files.some((x) => x.id === req.params.id && x.owner === viewer.email);
    if (!ok) fail(403, 'You do not have access to this file');
  }
  await sendFile(req, res, meta);
}));

// ---------- admin ----------
app.post('/api/admin/login', wrap((req) => {
  const a = D().admins.find((x) => x.username === String(req.body.username || '').trim());
  if (!a || !store.verifySecret(req.body.password || '', a.passHash)) fail(400, 'Wrong username or password');
  const token = store.token();
  D().adminSessions[token] = { adminId: a.id, createdAt: Date.now() };
  audit(a, 'login', 'Signed in to admin panel');
  return { token, admin: { id: a.id, name: a.name, username: a.username, role: a.role } };
}));
app.get('/api/admin/me', adminRoute((req, a) => ({ admin: { id: a.id, name: a.name, username: a.username, role: a.role } })));

// Tells the shared Admin Hub that this app brings its own admin pages (mail, not payments).
app.get('/api/admin/schema', adminRoute(() => ({
  app: { name: D().settings.appName, kind: 'mail', version: 1 },
  panel: 'embed',
  embedPath: '/admin/',
  nav: [['dashboard', '📊', 'Dashboard'], ['mailboxes', '📮', 'Mail IDs'], ['compose', '✉️', 'Send mail'], ['viewer', '📥', 'Open a mailbox'], ['messages', '🗂️', 'All messages'], ['settings', '⚙️', 'App settings'], ['audit', '📜', 'Audit logs'], ['admins', '🛡️', 'Admins']],
  summaryLabels: ['Mail IDs', 'Messages', 'Today', 'Unread'],
})));

function stats() {
  const d = D();
  const day = new Date().setHours(0, 0, 0, 0);
  const users = d.mailboxes.filter((m) => m.kind === 'user');
  const today = d.messages.filter((m) => m.date >= day).length;
  const unread = d.items.filter((i) => i.folder === 'inbox' && !i.read).length;
  return {
    users: users.length, transactions: d.messages.length, failed: 0, volumeToday: today, volumeTotal: d.messages.length, totalBalance: 0, openTickets: 0,
    senders: d.mailboxes.length - users.length, unread, messagesToday: today, activeToday: users.filter((u) => u.lastActive >= day).length,
    sessions: Object.keys(d.sessions).length, files: d.files.length, settings: d.settings,
    summary: [['Mail IDs', d.mailboxes.length], ['Messages', d.messages.length], ['Today', today], ['Unread', unread]],
  };
}
app.get('/api/admin/stats', adminRoute(() => stats()));
app.get('/api/admin/settings', adminRoute(() => ({ settings: D().settings })));
app.put('/api/admin/settings', adminRoute((req, admin) => {
  const s = D().settings;
  const b = req.body;
  ['appName', 'maintenanceMessage', 'announcement', 'appVersion', 'searchHint', 'appIcon'].forEach((k) => { if (b[k] !== undefined) s[k] = String(b[k]); });
  if (b.domain !== undefined && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(norm(b.domain))) s.domain = norm(b.domain);
  if (b.maxAttachmentMB !== undefined) s.maxAttachmentMB = Math.max(1, Math.min(8, Number(b.maxAttachmentMB) || 2));
  ['maintenanceMode', 'allowSignup'].forEach((k) => { if (b[k] !== undefined) s[k] = !!b[k]; });
  if (b.features) Object.keys(b.features).forEach((k) => { s.features[k] = !!b.features[k]; });
  audit(admin, 'settings.update', 'Changed: ' + Object.keys(b).join(', '));
  pushSettings();
  return { settings: s };
}));

app.get('/api/admin/mailboxes', adminRoute(() => ({
  mailboxes: D().mailboxes.map((m) => {
    const items = D().items.filter((i) => i.box === m.email);
    return { ...publicBox(m), category: m.category, blocked: m.blocked, hasPassword: !!m.passHash, createdAt: m.createdAt, lastActive: m.lastActive,
      inbox: items.filter((i) => i.folder === 'inbox').length, unread: items.filter((i) => i.folder === 'inbox' && !i.read).length, sent: D().messages.filter((x) => x.from.email === m.email).length };
  }).sort((a, b) => (a.kind === b.kind ? b.createdAt - a.createdAt : a.kind === 'user' ? -1 : 1)),
})));
app.post('/api/admin/mailboxes', adminRoute((req, admin) => {
  const b = req.body;
  let email = norm(b.email);
  if (!email.includes('@')) email = `${email}@${D().settings.domain}`;
  if (!EMAIL_RE.test(email)) fail(400, 'Enter a valid email address, e.g. support@yourcompany.com');
  if (findBox(email)) fail(400, 'That mail ID already exists');
  const kind = b.kind === 'sender' ? 'sender' : 'user';
  if (kind === 'user' && String(b.password || '').length < 6) fail(400, 'People who sign in need a password of 6+ characters');
  const m = { id: store.id('box'), name: String(b.name || email.split('@')[0]).trim(), email, passHash: b.password ? store.hashSecret(b.password) : '', kind,
    color: b.color || colorFor(email), photo: null, signature: '', category: ['primary', 'promotions', 'social', 'updates'].includes(b.category) ? b.category : 'primary', blocked: false, createdAt: Date.now(), lastActive: 0 };
  D().mailboxes.push(m);
  audit(admin, 'mailbox.create', `Created ${kind} mail ID ${email}`);
  return { mailbox: publicBox(m) };
}));
app.put('/api/admin/mailboxes/:id', adminRoute((req, admin) => {
  const m = D().mailboxes.find((x) => x.id === req.params.id) || fail(404, 'Mail ID not found');
  const b = req.body;
  if (b.name !== undefined) m.name = String(b.name).trim() || m.name;
  if (b.color) m.color = b.color;
  if (b.category && ['primary', 'promotions', 'social', 'updates'].includes(b.category)) m.category = b.category;
  if (b.kind && ['user', 'sender'].includes(b.kind)) m.kind = b.kind;
  if (b.password) { if (String(b.password).length < 6) fail(400, 'Password must be 6+ characters'); m.passHash = store.hashSecret(b.password); }
  if (b.blocked !== undefined) {
    m.blocked = !!b.blocked;
    if (m.blocked) { Object.keys(D().sessions).forEach((t) => { if (D().sessions[t].boxId === m.id) delete D().sessions[t]; }); io.to('box:' + m.email).emit('blocked'); }
  }
  audit(admin, 'mailbox.update', `Updated ${m.email}: ${Object.keys(b).filter((k) => k !== 'password').join(', ')}${b.password ? ' (password reset)' : ''}`);
  return { mailbox: publicBox(m) };
}));
app.delete('/api/admin/mailboxes/:id', adminRoute((req, admin) => {
  const m = D().mailboxes.find((x) => x.id === req.params.id) || fail(404, 'Mail ID not found');
  D().mailboxes = D().mailboxes.filter((x) => x.id !== m.id);
  D().items = D().items.filter((i) => i.box !== m.email);
  Object.keys(D().sessions).forEach((t) => { if (D().sessions[t].boxId === m.id) delete D().sessions[t]; });
  io.to('box:' + m.email).emit('blocked');
  audit(admin, 'mailbox.delete', `Deleted mail ID ${m.email} and its mailbox`);
}));

// Send as any address (creates a sender ID on the fly), to any addresses or to everyone.
app.post('/api/admin/send', adminRoute((req, admin) => {
  const b = req.body;
  const fromEmail = norm(b.fromEmail);
  if (!EMAIL_RE.test(fromEmail)) fail(400, 'Enter a valid "From" address');
  let fromBox = findBox(fromEmail);
  if (!fromBox) {
    fromBox = { id: store.id('box'), name: String(b.fromName || fromEmail.split('@')[0]).trim(), email: fromEmail, passHash: '', kind: 'sender', color: colorFor(fromEmail), photo: null, signature: '', category: b.category || 'primary', blocked: false, createdAt: Date.now(), lastActive: 0 };
    D().mailboxes.push(fromBox);
  }
  let to = parseAddrs(b.to);
  if (b.toAll) to = D().mailboxes.filter((m) => m.kind === 'user' && !m.blocked && m.email !== fromBox.email).map((m) => ({ name: m.name, email: m.email }));
  if (!to.length) fail(400, 'Add at least one recipient');
  const bad = to.find((a) => !EMAIL_RE.test(a.email));
  if (bad) fail(400, `"${bad.email}" is not a valid address`);
  if (!String(b.subject || '').trim() && !String(b.body || '').trim()) fail(400, 'Write a subject or a message');
  const r = deliver({ fromBox, from: { name: b.fromName ? String(b.fromName).trim() : fromBox.name, email: fromBox.email }, to, cc: parseAddrs(b.cc), subject: b.subject, body: b.body,
    threadId: b.threadId, inReplyTo: b.inReplyTo, category: b.category, attachments: checkAttachments(b.attachments), keepSent: true });
  audit(admin, 'mail.send', `Sent "${String(b.subject || '').slice(0, 60)}" as ${fromBox.email} to ${b.toAll ? 'all users' : to.map((t) => t.email).join(', ')}`);
  return { delivered: r.delivered, bounced: r.bounced, threadId: r.msg.threadId };
}));
app.post('/api/admin/files', adminRoute(async (req) => {
  const data = String(req.body.data || '').replace(/^data:[^;]+;base64,/, '');
  const size = Math.floor(data.length * 0.75);
  if (!data) fail(400, 'Empty file');
  if (size > 8 * 1024 * 1024) fail(400, 'Max 8 MB');
  const f = { id: store.id('fil'), name: String(req.body.name || 'file').slice(0, 120), type: String(req.body.type || 'application/octet-stream'), size, owner: 'admin', at: Date.now() };
  await store.putFile(f.id, { name: f.name, type: f.type }, data);
  D().files.push(f);
  return { file: f };
}));

// Open any mailbox: its folders, threads and messages (read-only view plus reply as that ID).
app.get('/api/admin/mailboxes/:id/threads', adminRoute((req) => {
  const m = D().mailboxes.find((x) => x.id === req.params.id) || fail(404, 'Mail ID not found');
  return { threads: listThreads(m, { ...req.query, limit: 150 }), counts: counts(m), mailbox: publicBox(m) };
}));
app.get('/api/admin/mailboxes/:id/threads/:tid', adminRoute((req) => {
  const m = D().mailboxes.find((x) => x.id === req.params.id) || fail(404, 'Mail ID not found');
  const items = D().items.filter((i) => i.box === m.email && i.tid === req.params.tid);
  const msgs = items.map((i) => ({ ...msgById(i.mid), folder: i.folder, read: i.read })).filter((x) => x.id).sort((a, b) => a.date - b.date);
  return { messages: msgs };
}));

app.get('/api/admin/messages', adminRoute((req) => {
  const q = norm(req.query.q);
  const list = D().messages.filter((m) => !q || `${m.subject} ${m.body} ${m.from.email} ${m.from.name} ${m.to.map((t) => t.email).join(' ')}`.toLowerCase().includes(q))
    .sort((a, b) => b.date - a.date).slice(0, 300)
    .map((m) => ({ id: m.id, threadId: m.threadId, from: m.from, to: m.to, cc: m.cc, subject: m.subject, snippet: snippet(m.body), date: m.date, attachments: (m.attachments || []).length, copies: D().items.filter((i) => i.mid === m.id).length }));
  return { messages: list, total: D().messages.length };
}));
app.get('/api/admin/messages/:id', adminRoute((req) => {
  const m = msgById(req.params.id) || fail(404, 'Message not found');
  return { message: m, copies: D().items.filter((i) => i.mid === m.id).map((i) => ({ box: i.box, folder: i.folder, read: i.read })) };
}));
app.delete('/api/admin/messages/:id', adminRoute((req, admin) => {
  const m = msgById(req.params.id) || fail(404, 'Message not found');
  const boxes = [...new Set(D().items.filter((i) => i.mid === m.id).map((i) => i.box))];
  D().items = D().items.filter((i) => i.mid !== m.id);
  D().messages = D().messages.filter((x) => x.id !== m.id);
  boxes.forEach((bx) => io.to('box:' + bx).emit('mail', { tid: m.threadId, removed: true }));
  audit(admin, 'message.delete', `Deleted "${m.subject}" from ${boxes.length} mailbox(es)`);
}));

app.get('/api/admin/audit', adminRoute(() => ({ logs: D().auditLogs.slice(0, 300) })));
app.get('/api/admin/admins', adminRoute(() => ({ admins: D().admins.map(({ passHash, ...a }) => a) })));
app.post('/api/admin/admins', adminRoute((req, admin) => {
  if (admin.role !== 'super') fail(403, 'Only the super admin can add admins');
  const { username, password, name } = req.body;
  if (!username || String(password || '').length < 6) fail(400, 'Username and a 6+ character password are required');
  if (D().admins.some((a) => a.username === username)) fail(400, 'Username already exists');
  const a = { id: store.id('adm'), username, name: name || username, passHash: store.hashSecret(password), role: 'admin', createdAt: Date.now() };
  D().admins.push(a);
  audit(admin, 'admin.create', `Added admin ${username}`);
  return { admin: { id: a.id, username, name: a.name, role: a.role } };
}));
app.delete('/api/admin/admins/:id', adminRoute((req, admin) => {
  const a = D().admins.find((x) => x.id === req.params.id) || fail(404, 'Not found');
  if (a.role === 'super' || a.id === admin.id) fail(400, 'This admin cannot be removed');
  D().admins = D().admins.filter((x) => x.id !== a.id);
  audit(admin, 'admin.delete', `Removed admin ${a.username}`);
}));
app.post('/api/admin/password', adminRoute((req, admin) => {
  if (!store.verifySecret(req.body.oldPassword || '', admin.passHash)) fail(400, 'Current password is wrong');
  if (String(req.body.newPassword || '').length < 6) fail(400, 'Use 6+ characters');
  admin.passHash = store.hashSecret(req.body.newPassword);
  audit(admin, 'admin.password', 'Changed own password');
}));
app.post('/api/admin/reset', adminRoute((req, admin) => {
  if (admin.role !== 'super') fail(403, 'Only the super admin can reset demo data');
  store.reset();
  io.emit('blocked');
  pushSettings();
  audit(D().admins[0], 'reset', 'Demo data reset');
}));

// ---------- live updates ----------
io.on('connection', (socket) => {
  const t = socket.handshake.auth && socket.handshake.auth.token;
  const sess = t && D().sessions[t];
  const box = sess && D().mailboxes.find((m) => m.id === sess.boxId);
  if (box) socket.join('box:' + box.email);
  socket.emit('settings', clientSettings());
});

process.on('SIGINT', async () => { await store.flush(); process.exit(0); });
store.load().then(() => {
  const d = D();
  ['files', 'labels'].forEach((k) => { if (!d[k]) d[k] = []; });
  server.listen(PORT, () => {
    const lan = Object.values(os.networkInterfaces()).flat().find((n) => n && n.family === 'IPv4' && !n.internal);
    console.log(`\n${d.settings.appName} server running on port ${PORT}`);
    console.log(`  Admin panel: http://localhost:${PORT}/admin   (admin / admin123)`);
    if (lan) console.log(`  Phone/LAN:   http://${lan.address}:${PORT}\n`);
  });
});
