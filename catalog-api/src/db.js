'use strict';
const mysql = require('mysql2/promise');
const { hashPassword } = require('./lib/auth');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'eventhub',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
});

// Creates the admin account from environment variables (never stored in Git).
async function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return console.warn('ADMIN_EMAIL / ADMIN_PASSWORD not set; no admin seeded.');
  const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (rows.length) return;
  await pool.query('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, "admin")', ['Administrator', email, hashPassword(password)]);
  console.log('Admin account created:', email);
}

module.exports = { pool, ensureAdmin };
