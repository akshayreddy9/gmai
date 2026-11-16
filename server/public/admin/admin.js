/* Gmai Admin Panel: plain JS single page app. Also runs embedded inside the Admin Hub (?embed=1). */
const S = { token: (sessionStorage.getItem('gm_admin_token') || localStorage.getItem('gm_admin_token')), admin: null, route: 'dashboard', users: [], dirty: false };
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dt = (ts) => (ts ? new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

async function api(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (S.token || '') },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/admin/login') { logout(); throw new Error('Session expired'); }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function toast(msg, isError) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.className = 'toast'), 2600);
}
async function run(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast(okMsg); return r; } catch (e) { toast(e.message, true); throw e; }
}

const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
function avatar(u, size = 32) {
  if (!u) return `<span class="avatar" style="background:#9aa0a6;width:${size}px;height:${size}px">?</span>`;
  const style = `width:${size}px;height:${size}px;background-color:${u.color || '#1a73e8'};${u.photo ? `background-image:url('${u.photo}')` : ''}`;
  return `<span class="avatar" style="${style}">${u.photo ? '' : esc(initials(u.name))}</span>`;
}
const person = (u, sub) => `<div class="person">${avatar(u)}<div class="meta">${esc(u ? u.name : '—')}<small>${esc(sub ?? (u ? u.email : ''))}</small></div></div>`;
const pill = (text, cls) => `<span class="pill ${cls || esc(text)}">${esc(text)}</span>`;

// ---------- modal & forms ----------
function closeModal() {
  $('#modalRoot').innerHTML = '';
  if (S.dirty) { S.dirty = false; render(); }
}
// Shrinks an uploaded image to a small PNG data URL so it can be stored with the data.
function resizeImage(file, max = 192) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function wireImageFields(root) {
  root.querySelectorAll('[data-file]').forEach((inp) => {
    const name = inp.dataset.file;
    const hidden = root.querySelector(`input[type=hidden][name="${name}"]`);
    const prev = root.querySelector(`[data-prev="${name}"]`);
    inp.onchange = async () => {
      if (!inp.files[0]) return;
      try {
        hidden.value = await resizeImage(inp.files[0], Number(inp.dataset.max) || 192);
        prev.src = hidden.value;
        prev.style.display = '';
      } catch { toast('Could not read that image', true); }
    };
    const clear = root.querySelector(`[data-clear="${name}"]`);
    if (clear) clear.onclick = () => { hidden.value = ''; prev.removeAttribute('src'); prev.style.display = 'none'; inp.value = ''; };
  });
}

function fieldHtml(f) {
  const v = f.value ?? '';
  const name = `name="${f.name}"`;
  let input;
  if (f.type === 'image') {
    return `<label class="${f.span2 ? 'span2' : ''}">${esc(f.label)}<div class="img-field">
      <img data-prev="${f.name}" ${v ? `src="${esc(v)}"` : 'style="display:none"'} alt="" />
      <input type="file" accept="image/png,image/jpeg,image/webp" data-file="${f.name}" data-max="${f.max || 192}" />
      <input type="hidden" ${name} value="${esc(v)}" />
      <button type="button" class="btn sm" data-clear="${f.name}">Remove</button></div>${f.hint ? `<small class="muted">${esc(f.hint)}</small>` : ''}</label>`;
  }
  if (f.type === 'select') {
    input = `<select ${name}>${f.options.map((o) => {
      const [val, label] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(label)}</option>`;
    }).join('')}</select>`;
  } else if (f.type === 'checkbox') {
    return `<label class="check ${f.span2 ? 'span2' : ''}"><input type="checkbox" ${name} ${v ? 'checked' : ''}/> ${esc(f.label)}</label>`;
  } else if (f.type === 'textarea') {
    input = `<textarea ${name} rows="${f.rows || 3}" placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`;
  } else {
    input = `<input type="${f.type || 'text'}" ${name} value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" ${f.step ? `step="${f.step}"` : ''} ${f.required ? 'required' : ''}/>`;
  }
  return `<label class="${f.span2 ? 'span2' : ''}">${esc(f.label)}${input}${f.hint ? `<small class="muted">${esc(f.hint)}</small>` : ''}</label>`;
}
function readForm(form, fields) {
  const out = {};
  fields.forEach((f) => {
    const el = form.elements[f.name];
    if (!el) return;
    if (f.type === 'checkbox') out[f.name] = el.checked;
    else if (f.type === 'number') out[f.name] = el.value === '' ? undefined : Number(el.value);
    else if (f.type === 'datetime-local') out[f.name] = el.value ? new Date(el.value).getTime() : undefined;
    else out[f.name] = el.value;
  });
  return out;
}
function modal({ title, fields, body = '', submitText = 'Save', onSubmit, wide, onMount, danger }) {
  const root = $('#modalRoot');
  root.innerHTML = `<div class="modal-bg"><form class="modal ${wide ? 'wide' : ''}">
    <div class="modal-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close>✕</button></div>
    <div class="modal-body">${body}${fields ? `<div class="form-grid">${fields.map(fieldHtml).join('')}</div>` : ''}</div>
    ${onSubmit ? `<div class="modal-foot"><button type="button" class="btn" data-close>Cancel</button><button class="btn ${danger ? 'danger solid' : 'primary'}">${esc(submitText)}</button></div>` : ''}
  </form></div>`;
  const form = $('form', root);
  root.querySelectorAll('[data-close]').forEach((b) => (b.onclick = closeModal));
  $('.modal-bg', root).onmousedown = (e) => { if (e.target.classList.contains('modal-bg')) closeModal(); };
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!onSubmit) return;
    const btn = form.querySelector('.modal-foot .btn:last-child');
    btn.disabled = true;
    try {
      const keep = await onSubmit(fields ? readForm(form, fields) : {}, form);
      if (keep !== false) closeModal();
    } catch (err) { toast(err.message, true); } finally { btn.disabled = false; }
  };
  wireImageFields(root);
  if (onMount) onMount(form);
  return form;
}
function confirmBox(message, okText = 'Delete') {
  return new Promise((resolve) => {
    modal({ title: 'Are you sure?', body: `<p>${esc(message)}</p>`, submitText: okText, danger: true, onSubmit: () => resolve(true) });
    $('#modalRoot').querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => resolve(false)));
  });
}

// ---------- table ----------
function table(container, { columns, rows, actions, onAction, empty = 'Nothing here yet' }) {
  if (!rows.length) { container.innerHTML = `<div class="table-wrap"><div class="empty">${esc(empty)}</div></div>`; return; }
  container.innerHTML = `<div class="table-wrap"><table><thead><tr>${columns.map((c) => `<th>${esc(c.label)}</th>`).join('')}${actions ? '<th></th>' : ''}</tr></thead>
  <tbody>${rows.map((r, i) => `<tr>${columns.map((c) => `<td>${c.render ? c.render(r) : esc(r[c.key])}</td>`).join('')}${actions ? `<td class="actions" data-i="${i}">${actions(r)}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
  container.querySelectorAll('[data-act]').forEach((b) => {
    b.onclick = () => onAction(b.dataset.act, rows[Number(b.closest('[data-i]').dataset.i)]);
  });
}
const act = (name, label, cls = '') => `<button class="btn sm ${cls}" data-act="${name}">${label}</button>`;
