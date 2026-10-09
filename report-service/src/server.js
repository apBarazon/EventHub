'use strict';
const http = require('http');
const { pool } = require('./db');
const { verifyToken } = require('./lib/auth');
const { buildSummary } = require('./summary');

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const send = (res, status, data) => {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
};

async function handle(req, res) {
  const path = new URL(req.url, 'http://x').pathname;
  if (req.method === 'GET' && (path === '/health' || path === '/reports/health')) {
    await pool.query('SELECT 1');
    return send(res, 200, { status: 'ok', service: 'report-service' });
  }
  if (req.method === 'GET' && path === '/reports/summary') {
    const p = verifyToken((req.headers.authorization || '').replace(/^Bearer /, ''), SECRET);
    if (!p) return send(res, 401, { error: 'Please log in.' });
    if (p.role !== 'admin') return send(res, 403, { error: 'Admin access only.' });
    const [rows] = await pool.query(`
      SELECT e.id, e.title, e.event_date, e.max_participants,
        COALESCE(SUM(r.status = 'approved'), 0) AS approved,
        COALESCE(SUM(r.status = 'pending'), 0)  AS pending,
        COALESCE(SUM(r.status = 'rejected'), 0) AS rejected
      FROM events e LEFT JOIN registrations r ON r.event_id = e.id
      GROUP BY e.id ORDER BY e.event_date`);
    const [[u]] = await pool.query("SELECT COUNT(*) AS n FROM users WHERE role = 'user'");
    return send(res, 200, buildSummary(rows, u.n));
  }
  send(res, 404, { error: 'Not found.' });
}

http.createServer((req, res) => handle(req, res).catch((e) => { console.error(e); send(res, 500, { error: 'Internal server error.' }); }))
  .listen(process.env.PORT || 4000, () => console.log('report-service listening'));
