'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { hashPassword, verifyPassword, signToken, verifyToken } = require('../src/lib/auth');

test('password hash verifies only the right password', () => {
  const h = hashPassword('secret123');
  assert.ok(verifyPassword('secret123', h));
  assert.ok(!verifyPassword('wrong', h));
});

test('token round-trips and carries the role', () => {
  const t = signToken({ sub: 1, role: 'admin' }, 's');
  const p = verifyToken(t, 's');
  assert.strictEqual(p.sub, 1);
  assert.strictEqual(p.role, 'admin');
});

test('tampered or wrong-secret or expired tokens are rejected', () => {
  const t = signToken({ sub: 1, role: 'user' }, 's');
  assert.strictEqual(verifyToken(t, 'other'), null);
  const [body, sig] = t.split('.');
  const forged = Buffer.from(JSON.stringify({ sub: 1, role: 'admin', exp: 9999999999 })).toString('base64url');
  assert.strictEqual(verifyToken(`${forged}.${sig}`, 's'), null);
  assert.strictEqual(verifyToken(signToken({ sub: 1 }, 's', -10), 's'), null);
  assert.strictEqual(verifyToken('garbage', 's'), null);
});
