(() => {
  'use strict';
  const API = '/api';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (s) => new Date(String(s).replace(' ', 'T')).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  const FALLBACK_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="#cbd2e1"/><text x="50%" y="50%" text-anchor="middle" fill="#667085" font-size="28">No image</text></svg>');
  const img = (u, cls = '') => `<img class="${cls}" src="${esc(u)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK_IMG}'">`;

  const state = {
    token: localStorage.getItem('token'),
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    notes: { items: [], unread: 0 }, panelOpen: false,
  };

  async function api(path, opts = {}) {
    const res = await fetch(API + path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && state.token) logout(false);
    if (!res.ok) throw new Error(data.error || 'Request failed.');
    return data;
  }

  function setSession(data) {
    state.token = data.token; state.user = data.user;
    localStorage.setItem('token', data.token); localStorage.setItem('user', JSON.stringify(data.user));
  }
  function logout(go = true) {
    state.token = null; state.user = null; state.notes = { items: [], unread: 0 };
    localStorage.removeItem('token'); localStorage.removeItem('user');
    if (go) location.hash = '#/'; renderNav();
  }
  const isAdmin = () => state.user && state.user.role === 'admin';

  // ---------- navbar ----------
  function renderNav() {
    const u = state.user;
    $('#nav').innerHTML = `<a class="brand" href="#/">&#127903; EventHub</a><nav>
      ${isAdmin() ? '<a href="/admin/">Admin Panel</a>' : '<a href="#/my">My Event Registrations</a>'}
      ${u ? `${isAdmin() ? '' : `<button id="bell" class="bell">&#128276; ${state.notes.unread || ''}</button>`}
        <span>${esc(u.name)}</span><button id="logout" class="link">Logout</button>`
        : '<a href="#/login">Login</a><a href="#/sign-up">Sign Up</a>'}
      <button id="theme" title="Dark mode">${document.documentElement.dataset.theme === 'dark' ? '&#9728;&#65039;' : '&#127769;'}</button></nav>
      ${state.panelOpen ? `<div class="panel">${state.notes.items.length ? state.notes.items.map((n) =>
        `<p class="${n.is_read ? '' : 'unread'}">${esc(n.message)}<br><small>${fmt(n.created_at)}</small></p>`).join('') : '<p>No notifications yet.</p>'}</div>` : ''}`;
    $('#theme').onclick = () => {
      const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = t; localStorage.setItem('theme', t); renderNav();
    };
    if ($('#logout')) $('#logout').onclick = () => logout();
    if ($('#bell')) $('#bell').onclick = toggleNotes;
  }

  async function loadNotes() {
    if (!state.user || isAdmin()) return;
    try { state.notes = await api('/notifications'); renderNav(); } catch { /* ignore */ }
  }
  async function toggleNotes() {
    state.panelOpen = !state.panelOpen; renderNav();
    if (!state.panelOpen && state.notes.unread) { await api('/notifications/read-all', { method: 'POST' }); await loadNotes(); }
  }

  // ---------- modal ----------
  function openModal(html) { $('#modal-root').innerHTML = `<div class="modal-bg" id="mbg"><div class="modal">${html}</div></div>`; $('#mbg').onclick = (e) => { if (e.target.id === 'mbg') closeModal(); }; }
  function closeModal() { $('#modal-root').innerHTML = ''; }

  // ---------- views ----------
  async function homeView() {
    if (isAdmin()) { location.href = '/admin/'; return; }
    $('#view').innerHTML = '<h2>Upcoming School Events</h2><div class="grid" id="grid">Loading...</div>';
    try {
      const events = await api('/events');
      $('#grid').innerHTML = events.map((e) => {
        const full = e.approved_count >= e.max_participants;
        return `<div class="card" data-id="${e.id}">${img(e.image_url)}<div class="body">
          <h3>${esc(e.title)}</h3><div class="meta">&#128197; ${fmt(e.event_date)}</div><div class="meta">&#128205; ${esc(e.location)}</div>
          <p class="desc">${esc(e.description)}</p>
          <span class="badge ${full ? 'rejected' : 'approved'}">${full ? 'Full' : `${e.max_participants - e.approved_count} spots left`}</span></div></div>`;
      }).join('') || '<p>No events yet.</p>';
      document.querySelectorAll('.card').forEach((c) => (c.onclick = () => openRegister(events.find((e) => e.id == c.dataset.id))));
    } catch (e) { $('#grid').textContent = e.message; }
  }

  function openRegister(ev) {
    if (!state.user) {
      openModal(`<h3>Create an account first</h3><p>Please log in or sign up to register for <b>${esc(ev.title)}</b>.</p>
        <div class="row"><button id="cancel">Cancel</button><button class="primary" id="goLogin">Login</button><button class="primary" id="goSignup">Sign Up</button></div>`);
      $('#cancel').onclick = closeModal;
      $('#goLogin').onclick = () => { closeModal(); location.hash = '#/login'; };
      $('#goSignup').onclick = () => { closeModal(); location.hash = '#/sign-up'; };
      return;
    }
    openModal(`<h3>Register: ${esc(ev.title)}</h3><div class="meta">${fmt(ev.event_date)} &middot; ${esc(ev.location)}</div>
      <label>Full name</label><input id="f_name" value="${esc(state.user.name)}">
      <label>Student ID</label><input id="f_sid" placeholder="2024-0001">
      <label>Course &amp; year</label><input id="f_course" placeholder="BSIT - 3rd year">
      <label>Contact number</label><input id="f_contact" placeholder="09171234567">
      <label>Why do you want to attend? (optional)</label><textarea id="f_reason" rows="3"></textarea>
      <div class="err" id="ferr"></div>
      <div class="row"><button id="cancel">Cancel</button><button class="primary" id="submit">Submit registration</button></div>`);
    $('#cancel').onclick = closeModal;
    $('#submit').onclick = async () => {
      try {
        await api(`/events/${ev.id}/register`, { method: 'POST', body: {
          full_name: $('#f_name').value, student_id: $('#f_sid').value, course_year: $('#f_course').value,
          contact: $('#f_contact').value, reason: $('#f_reason').value } });
        closeModal(); location.hash = '#/my';
      } catch (e) { $('#ferr').textContent = e.message; }
    };
  }

  async function myView() {
    if (!state.user) { location.hash = '#/login'; return; }
    if (isAdmin()) { location.href = '/admin/'; return; }
    $('#view').innerHTML = '<h2>My Event Registrations</h2><div id="mine">Loading...</div>';
    try {
      const rows = await api('/registrations/mine');
      $('#mine').innerHTML = rows.map((r) => `<div class="reg">${img(r.image_url)}<div style="flex:1">
        <b>${esc(r.title)}</b><div class="meta">${fmt(r.event_date)} &middot; ${esc(r.location)}</div>
        ${r.reject_reason ? `<div class="meta">${esc(r.reject_reason)}</div>` : ''}</div>
        <span class="badge ${r.status}">${r.status}</span></div>`).join('') || '<p>You have not registered for any event yet. <a href="#/">Browse events</a></p>';
    } catch (e) { $('#mine').textContent = e.message; }
  }

  function authView(mode) {
    const signup = mode === 'signup';
    $('#view').innerHTML = `<div class="form-box"><h2>${signup ? 'Sign Up' : 'Login'}</h2>
      ${signup ? '<label>Full name</label><input id="a_name">' : ''}
      <label>Email</label><input id="a_email" type="email">
      <label>Password</label><input id="a_pass" type="password" placeholder="${signup ? 'At least 8 characters' : ''}">
      ${signup ? '<label>Confirm password</label><input id="a_pass2" type="password">' : ''}
      <div class="err" id="aerr"></div>
      <div class="row"><button class="primary" id="go">${signup ? 'Create account' : 'Login'}</button></div>
      <p class="meta">${signup ? 'Have an account? <a href="#/login">Login</a>' : 'No account? <a href="#/sign-up">Sign Up</a>'}</p></div>`;
    $('#go').onclick = async () => {
      try {
        if (signup && $('#a_pass').value !== $('#a_pass2').value) throw new Error('Passwords do not match.');
        const body = { email: $('#a_email').value, password: $('#a_pass').value, ...(signup ? { name: $('#a_name').value } : {}) };
        const data = await api(signup ? '/auth/register' : '/auth/login', { method: 'POST', body });
        setSession(data);
        if (data.user.role === 'admin') { location.href = '/admin/'; return; }
        location.hash = '#/'; renderNav(); loadNotes();
      } catch (e) { $('#aerr').textContent = e.message; }
    };
  }

  function router() {
    state.panelOpen = false; renderNav();
    const h = location.hash || '#/';
    if (h === '#/login') authView('login');
    else if (h === '#/sign-up') authView('signup');
    else if (h === '#/my') myView();
    else homeView();
  }

  window.addEventListener('hashchange', router);
  router(); loadNotes(); setInterval(loadNotes, 30000);
})();
