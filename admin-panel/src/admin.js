(() => {
  'use strict';
  const API = '/api';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (s) => new Date(String(s).replace(' ', 'T')).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const token = localStorage.getItem('token');
  if (!token || !user || user.role !== 'admin') { location.href = '/#/login'; return; }

  async function api(path, opts = {}, base = API) {
    const res = await fetch(base + path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { localStorage.clear(); location.href = '/#/login'; }
    if (!res.ok) throw new Error(data.error || 'Request failed.');
    return data;
  }
  const modal = (html) => { $('#modal-root').innerHTML = `<div class="modal-bg" id="mbg"><div class="modal">${html}</div></div>`; $('#mbg').onclick = (e) => { if (e.target.id === 'mbg') closeModal(); }; };
  const closeModal = () => { $('#modal-root').innerHTML = ''; };
  const toLocalInput = (s) => String(s).slice(0, 16).replace(' ', 'T');

  // ---------- Dashboard / report ----------
  async function dashboard() {
    const s = await api('/summary', {}, API + '/reports');
    const t = s.totals;
    $('#view').innerHTML = `<h2>Dashboard &amp; Report</h2><div class="stats">
      ${[['Events', t.events], ['Users', t.users], ['Registrations', t.registrations], ['Pending', t.pending], ['Approved', t.approved], ['Rejected', t.rejected], ['Full events', t.full_events]]
        .map(([k, v]) => `<div class="stat"><b>${v}</b>${k}</div>`).join('')}</div>
      <p>Most popular event: <b>${s.most_popular ? esc(s.most_popular.title) : '-'}</b></p>
      <div class="scroll"><table><tr><th>Event</th><th>Date</th><th>Approved / Max</th><th>Fill</th><th>Pending</th><th>Rejected</th></tr>
      ${s.events.map((e) => `<tr><td>${esc(e.title)}${e.is_full ? ' <span class="badge rejected">Full</span>' : ''}</td><td>${fmt(e.event_date)}</td>
        <td>${e.approved} / ${e.max_participants}</td><td><div class="bar"><i style="width:${e.fill_rate}%"></i></div>${e.fill_rate}%</td>
        <td>${e.pending}</td><td>${e.rejected}</td></tr>`).join('')}</table></div>`;
  }

  // ---------- Events CRUD ----------
  async function events() {
    const rows = await api('/events');
    $('#view').innerHTML = `<div class="toolbar"><h2>Events</h2><button class="primary" id="add">+ New event</button></div>
      <div class="scroll"><table><tr><th></th><th>Title</th><th>Date</th><th>Location</th><th>Approved/Max</th><th></th></tr>
      ${rows.map((e) => `<tr><td><img src="${esc(e.image_url)}" alt=""></td><td><b>${esc(e.title)}</b><br><small>${esc(e.description).slice(0, 80)}</small></td>
        <td>${fmt(e.event_date)}</td><td>${esc(e.location)}</td><td>${e.approved_count}/${e.max_participants}</td>
        <td><button data-edit="${e.id}">Edit</button> <button class="danger" data-del="${e.id}">Delete</button></td></tr>`).join('')}</table></div>`;
    $('#add').onclick = () => eventForm();
    document.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => eventForm(rows.find((e) => e.id == b.dataset.edit))));
    document.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
      if (!confirm('Delete this event and all its registrations?')) return;
      try { await api('/events/' + b.dataset.del, { method: 'DELETE' }); events(); } catch (e) { alert(e.message); }
    }));
  }

  function eventForm(ev = {}) {
    modal(`<h3>${ev.id ? 'Edit' : 'New'} event</h3>
      <label>Name</label><input id="e_title" value="${esc(ev.title)}">
      <label>Description</label><textarea id="e_desc" rows="3">${esc(ev.description)}</textarea>
      <label>Date &amp; time</label><input id="e_date" type="datetime-local" value="${ev.event_date ? toLocalInput(ev.event_date) : ''}">
      <label>Location</label><input id="e_loc" value="${esc(ev.location || 'School Campus')}">
      <label>Picture (image URL)</label><input id="e_img" value="${esc(ev.image_url)}" placeholder="https://...">
      <label>Max participants</label><input id="e_max" type="number" min="1" value="${ev.max_participants || 50}">
      <div class="err" id="eerr"></div>
      <div class="row"><button id="cancel">Cancel</button><button class="primary" id="save">Save</button></div>`);
    $('#cancel').onclick = closeModal;
    $('#save').onclick = async () => {
      const body = { title: $('#e_title').value, description: $('#e_desc').value, event_date: $('#e_date').value,
        location: $('#e_loc').value, image_url: $('#e_img').value, max_participants: $('#e_max').value };
      try { await api(ev.id ? '/events/' + ev.id : '/events', { method: ev.id ? 'PUT' : 'POST', body }); closeModal(); events(); }
      catch (e) { $('#eerr').textContent = e.message; }
    };
  }

  // ---------- Registrations ----------
  async function registrations(status = 'pending') {
    const rows = await api('/admin/registrations' + (status ? '?status=' + status : ''));
    $('#view').innerHTML = `<div class="toolbar"><h2>Registrations</h2><select id="flt" style="width:auto">
      ${['pending', 'approved', 'rejected', ''].map((s) => `<option value="${s}" ${s === status ? 'selected' : ''}>${s || 'all'}</option>`).join('')}</select></div>
      <div class="scroll"><table><tr><th>Event</th><th>Participant</th><th>Details</th><th>Status</th><th></th></tr>
      ${rows.map((r) => `<tr><td>${esc(r.event_title)}</td><td><b>${esc(r.full_name)}</b><br><small>${esc(r.email)}</small></td>
        <td><small>ID ${esc(r.student_id)} &middot; ${esc(r.course_year)}<br>${esc(r.contact)}${r.reason ? '<br>&ldquo;' + esc(r.reason) + '&rdquo;' : ''}</small></td>
        <td><span class="badge ${r.status}">${r.status}</span>${r.reject_reason ? '<br><small>' + esc(r.reject_reason) + '</small>' : ''}</td>
        <td>${r.status === 'pending' ? `<button class="primary" data-ok="${r.id}">Approve</button> <button class="danger" data-no="${r.id}">Reject</button>` : ''}</td></tr>`).join('')
        || '<tr><td colspan="5">Nothing here.</td></tr>'}</table></div>`;
    $('#flt').onchange = (e) => registrations(e.target.value);
    document.querySelectorAll('[data-ok]').forEach((b) => (b.onclick = async () => {
      try {
        const r = await api(`/admin/registrations/${b.dataset.ok}/approve`, { method: 'POST' });
        if (r.auto_rejected_full) alert('Event is full: registration was rejected automatically.');
        registrations(status); badge();
      } catch (e) { alert(e.message); }
    }));
    document.querySelectorAll('[data-no]').forEach((b) => (b.onclick = async () => {
      const reason = prompt('Reason for rejection (optional):', '') ?? null;
      if (reason === null) return;
      try { await api(`/admin/registrations/${b.dataset.no}/reject`, { method: 'POST', body: { reason: reason || undefined } }); registrations(status); } catch (e) { alert(e.message); }
    }));
  }

  // ---------- Notifications ----------
  async function notifications() {
    const n = await api('/notifications');
    $('#view').innerHTML = `<h2>Notifications</h2>${n.items.map((x) => `<div class="note ${x.is_read ? '' : 'unread'}">${esc(x.message)}<br><small>${fmt(x.created_at)}</small></div>`).join('') || '<p>No notifications.</p>'}`;
    if (n.unread) { await api('/notifications/read-all', { method: 'POST' }); badge(); }
  }
  async function badge() {
    try { const n = await api('/notifications'); $('#nbadge').textContent = n.unread ? `(${n.unread})` : ''; } catch { /* ignore */ }
  }

  // ---------- shell ----------
  const tabs = { dashboard, events, registrations, notifications };
  function show(tab) {
    document.querySelectorAll('[data-tab]').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
    $('#view').textContent = 'Loading...';
    tabs[tab]().catch((e) => { $('#view').textContent = e.message; });
  }
  document.querySelectorAll('[data-tab]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); show(a.dataset.tab); }));
  $('#logout').onclick = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); location.href = '/'; };
  $('#theme').onclick = () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; localStorage.setItem('theme', t); };
  show('dashboard'); badge(); setInterval(badge, 30000);
})();
