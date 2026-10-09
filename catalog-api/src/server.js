'use strict';
const http = require('http');
const { pool, ensureAdmin } = require('./db');
const { hashPassword, verifyPassword, signToken, verifyToken } = require('./lib/auth');
const { validateSignup, validateEvent, validateRegistration, decideApproval } = require('./lib/validate');
const { HttpError, send, readJson } = require('./lib/http');

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const routes = [];
const route = (method, path, auth, handler) =>
  routes.push({ method, re: new RegExp('^' + path.replace(/:(\w+)/g, '(?<$1>\\d+)') + '$'), auth, handler });

const bad = (errors) => { if (errors.length) throw new HttpError(400, errors.join(' ')); };
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });
const tokenFor = (u) => signToken({ sub: u.id, role: u.role, name: u.name }, SECRET);

const EVENT_SELECT = `SELECT e.*, (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'approved') AS approved_count FROM events e`;

// ---------- health ----------
route('GET', '/health', null, async () => {
  await pool.query('SELECT 1');
  return { status: 'ok', service: 'catalog-api' };
});

// ---------- auth ----------
route('POST', '/auth/register', null, async (ctx) => {
  const { errors, value } = validateSignup(ctx.body); bad(errors);
  try {
    const [r] = await pool.query('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, "user")',
      [value.name, value.email, hashPassword(value.password)]);
    const user = { id: r.insertId, name: value.name, email: value.email, role: 'user' };
    ctx.status = 201;
    return { token: tokenFor(user), user };
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'That email is already registered.');
    throw e;
  }
});

route('POST', '/auth/login', null, async (ctx) => {
  const email = String(ctx.body.email || '').trim().toLowerCase();
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  if (!rows.length || !verifyPassword(String(ctx.body.password || ''), rows[0].password_hash))
    throw new HttpError(401, 'Invalid email or password.');
  return { token: tokenFor(rows[0]), user: publicUser(rows[0]) };
});

route('GET', '/auth/me', 'user', async (ctx) => {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [ctx.user.sub]);
  if (!rows.length) throw new HttpError(401, 'Account no longer exists.');
  return publicUser(rows[0]);
});

// ---------- events (catalog) ----------
route('GET', '/events', null, async () => {
  const [rows] = await pool.query(`${EVENT_SELECT} ORDER BY e.event_date ASC`);
  return rows;
});

route('GET', '/events/:id', null, async (ctx) => {
  const [rows] = await pool.query(`${EVENT_SELECT} WHERE e.id = ?`, [ctx.params.id]);
  if (!rows.length) throw new HttpError(404, 'Event not found.');
  return rows[0];
});

route('POST', '/events', 'admin', async (ctx) => {
  const { errors, value } = validateEvent(ctx.body); bad(errors);
  const [r] = await pool.query('INSERT INTO events SET ?', [value]);
  ctx.status = 201;
  return { id: r.insertId, ...value };
});

route('PUT', '/events/:id', 'admin', async (ctx) => {
  const { errors, value } = validateEvent(ctx.body); bad(errors);
  const [[cnt]] = await pool.query("SELECT COUNT(*) AS c FROM registrations WHERE event_id = ? AND status = 'approved'", [ctx.params.id]);
  if (value.max_participants < cnt.c) throw new HttpError(409, `Max participants cannot be below the ${cnt.c} already approved.`);
  const [r] = await pool.query('UPDATE events SET ? WHERE id = ?', [value, ctx.params.id]);
  if (!r.affectedRows) throw new HttpError(404, 'Event not found.');
  return { id: Number(ctx.params.id), ...value };
});

route('DELETE', '/events/:id', 'admin', async (ctx) => {
  const [r] = await pool.query('DELETE FROM events WHERE id = ?', [ctx.params.id]);
  if (!r.affectedRows) throw new HttpError(404, 'Event not found.');
  return { deleted: true };
});

// ---------- registrations (users) ----------
route('POST', '/events/:id/register', 'user', async (ctx) => {
  if (ctx.user.role === 'admin') throw new HttpError(403, 'Admin accounts cannot register for events.');
  const [ev] = await pool.query('SELECT id FROM events WHERE id = ?', [ctx.params.id]);
  if (!ev.length) throw new HttpError(404, 'Event not found.');
  const { errors, value } = validateRegistration(ctx.body); bad(errors);
  try {
    const [r] = await pool.query('INSERT INTO registrations SET ?', [{ ...value, user_id: ctx.user.sub, event_id: ctx.params.id }]);
    ctx.status = 201;
    return { id: r.insertId, status: 'pending' };
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'You already registered for this event.');
    throw e;
  }
});

route('GET', '/registrations/mine', 'user', async (ctx) => {
  const [rows] = await pool.query(
    `SELECT r.id, r.event_id, r.status, r.reject_reason, r.created_at, e.title, e.event_date, e.location, e.image_url
     FROM registrations r JOIN events e ON e.id = r.event_id WHERE r.user_id = ? ORDER BY r.created_at DESC`, [ctx.user.sub]);
  return rows;
});

// ---------- registrations (admin) ----------
route('GET', '/admin/registrations', 'admin', async (ctx) => {
  const where = [], args = [];
  if (['pending', 'approved', 'rejected'].includes(ctx.query.status)) { where.push('r.status = ?'); args.push(ctx.query.status); }
  if (/^\d+$/.test(ctx.query.event_id || '')) { where.push('r.event_id = ?'); args.push(ctx.query.event_id); }
  const [rows] = await pool.query(
    `SELECT r.*, e.title AS event_title, e.max_participants, u.email
     FROM registrations r JOIN events e ON e.id = r.event_id JOIN users u ON u.id = r.user_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY r.created_at DESC`, args);
  return rows;
});

async function notify(conn, userId, message) {
  await conn.query('INSERT INTO notifications (user_id, message) VALUES (?, ?)', [userId, message]);
}

route('POST', '/admin/registrations/:id/approve', 'admin', async (ctx) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[reg]] = await conn.query(
      `SELECT r.*, e.title, e.max_participants FROM registrations r JOIN events e ON e.id = r.event_id WHERE r.id = ? FOR UPDATE`, [ctx.params.id]);
    if (!reg) throw new HttpError(404, 'Registration not found.');
    if (reg.status !== 'pending') throw new HttpError(409, `Already ${reg.status}.`);
    const [[{ c }]] = await conn.query("SELECT COUNT(*) AS c FROM registrations WHERE event_id = ? AND status = 'approved'", [reg.event_id]);
    const decision = decideApproval(c, reg.max_participants);

    if (decision === 'approved') {
      await conn.query("UPDATE registrations SET status = 'approved', reviewed_at = NOW() WHERE id = ?", [reg.id]);
      await notify(conn, reg.user_id, `Your registration for "${reg.title}" was approved.`);
      if (c + 1 >= reg.max_participants) {
        const [admins] = await conn.query("SELECT id FROM users WHERE role = 'admin'");
        for (const a of admins) await notify(conn, a.id, `"${reg.title}" has reached its maximum of ${reg.max_participants} participants.`);
      }
    } else {
      const why = 'Maximum number of participants reached.';
      await conn.query("UPDATE registrations SET status = 'rejected', reject_reason = ?, reviewed_at = NOW() WHERE id = ?", [why, reg.id]);
      await notify(conn, reg.user_id, `Your registration for "${reg.title}" was rejected: ${why}`);
    }
    await conn.commit();
    return { status: decision, auto_rejected_full: decision === 'rejected' };
  } catch (e) { await conn.rollback(); throw e; }
  finally { conn.release(); }
});

route('POST', '/admin/registrations/:id/reject', 'admin', async (ctx) => {
  const reason = String(ctx.body.reason || 'Rejected by administrator.').slice(0, 200);
  const [[reg]] = await pool.query(
    `SELECT r.*, e.title FROM registrations r JOIN events e ON e.id = r.event_id WHERE r.id = ?`, [ctx.params.id]);
  if (!reg) throw new HttpError(404, 'Registration not found.');
  if (reg.status !== 'pending') throw new HttpError(409, `Already ${reg.status}.`);
  await pool.query("UPDATE registrations SET status = 'rejected', reject_reason = ?, reviewed_at = NOW() WHERE id = ?", [reason, reg.id]);
  await notify(pool, reg.user_id, `Your registration for "${reg.title}" was rejected: ${reason}`);
  return { status: 'rejected' };
});

// ---------- notifications ----------
route('GET', '/notifications', 'user', async (ctx) => {
  const [items] = await pool.query('SELECT id, message, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30', [ctx.user.sub]);
  const [[u]] = await pool.query('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', [ctx.user.sub]);
  return { items, unread: u.n };
});

route('POST', '/notifications/read-all', 'user', async (ctx) => {
  await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [ctx.user.sub]);
  return { ok: true };
});

// ---------- dispatcher ----------
async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = r.re.exec(url.pathname);
    if (!m) continue;
    const ctx = { query: Object.fromEntries(url.searchParams), params: m.groups || {}, user: null, status: 200, body: {} };
    if (r.auth) {
      const payload = verifyToken((req.headers.authorization || '').replace(/^Bearer /, ''), SECRET);
      if (!payload) throw new HttpError(401, 'Please log in.');
      if (r.auth === 'admin' && payload.role !== 'admin') throw new HttpError(403, 'Admin access only.');
      ctx.user = payload;
    }
    if (req.method === 'POST' || req.method === 'PUT') ctx.body = await readJson(req);
    const out = await r.handler(ctx);
    return send(res, ctx.status, out);
  }
  throw new HttpError(404, 'Not found.');
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message });
    console.error(e);
    send(res, 500, { error: 'Internal server error.' });
  });
});

const PORT = process.env.PORT || 3000;
ensureAdmin().catch((e) => console.error('Admin seed failed:', e.message))
  .finally(() => server.listen(PORT, () => console.log(`catalog-api listening on ${PORT}`)));
