'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { validateSignup, validateEvent, validateRegistration, decideApproval } = require('../src/lib/validate');

test('signup validation', () => {
  assert.strictEqual(validateSignup({ name: 'Ana', email: 'ana@school.edu', password: 'longenough' }).errors.length, 0);
  assert.ok(validateSignup({ name: 'A', email: 'bad', password: '123' }).errors.length >= 3);
});

test('event validation normalizes the date and requires an image URL', () => {
  const ok = validateEvent({ title: 'Seminar', description: 'Desc', event_date: '2026-11-05T09:30', image_url: 'https://x.test/a.png', max_participants: 40 });
  assert.strictEqual(ok.errors.length, 0);
  assert.strictEqual(ok.value.event_date, '2026-11-05 09:30:00');
  assert.ok(validateEvent({ title: 'Seminar', description: 'Desc', event_date: '2026-11-05T09:30', image_url: 'javascript:alert(1)', max_participants: 40 }).errors.length > 0);
  assert.ok(validateEvent({ title: 'Seminar', description: 'Desc', event_date: '2026-11-05T09:30', image_url: 'https://x.test/a.png', max_participants: 0 }).errors.length > 0);
});

test('registration form validation', () => {
  const good = { full_name: 'Ana Cruz', student_id: '2024-0001', course_year: 'BSIT 3', contact: '09171234567' };
  assert.strictEqual(validateRegistration(good).errors.length, 0);
  assert.ok(validateRegistration({ ...good, contact: 'abc' }).errors.length > 0);
});

test('approval is rejected once the event is full', () => {
  assert.strictEqual(decideApproval(9, 10), 'approved');
  assert.strictEqual(decideApproval(10, 10), 'rejected');
});
